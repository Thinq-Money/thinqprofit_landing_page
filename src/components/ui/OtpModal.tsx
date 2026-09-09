import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Check, ShieldCheck, X, RefreshCw } from 'lucide-react'
import Button from './Button'
import ThinqMark from './ThinqMark'
import {
  AuthError,
  formatCountdown,
  loadCatalogue,
  renderMessage,
  sendOtp,
  verifyOtp,
  type SendOtpResult,
} from '../../lib/authService'
import { trackOtpRequested, trackOtpVerified, trackSignupCompleted } from '../../lib/analytics'

/** How often the two deadlines are re-read. */
const TICK_MS = 500

/**
 * How many codes authService will send for one journey before it answers
 * RESEND_LIMIT.
 */
const MAX_SENDS_PER_JOURNEY = 6

/**
 * How many RESENDS that leaves.
 *
 * One fewer than the send budget, because the send that opened this modal
 * already spent one of the six. Offering six resends would put a seventh code
 * on a journey that allows six, so the last press would always be refused —
 * the button would look available and simply fail.
 *
 * This is a courtesy limit, not a control. authService counts independently and
 * refuses past its own ceiling whatever this says, which is what makes the rule
 * unbypassable: editing this number, or the counter in devtools, buys nothing
 * but a RESEND_LIMIT response that the modal then displays.
 */
const MAX_RESENDS = MAX_SENDS_PER_JOURNEY - 1

interface OtpModalProps {
  isOpen: boolean
  phone: string
  /** The journey this modal belongs to, from the send that opened it. */
  attempt: SendOtpResult | null
  /** A resend replaces the attempt, so the parent holds it. */
  onAttempt: (attempt: SendOtpResult | null) => void
  onPhoneChange?: (phone: string) => void
  onClose: () => void
  onSuccess: (outcome: 'SIGNED_IN' | 'REGISTERED') => void
  onEditPhone?: () => void
}

/** Seconds from now until an absolute instant, floored at zero. */
function secondsUntil(instant: string | undefined, now: number): number {
  if (!instant) return 0
  return Math.max(0, Math.ceil((new Date(instant).getTime() - now) / 1000))
}

/** Formats seconds into mm:ss string (e.g. 24 -> 0:24, 83 -> 1:23) */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

export default function OtpModal({
  isOpen,
  phone,
  attempt,
  onAttempt,
  onPhoneChange,
  onClose,
  onSuccess,
  onEditPhone,
}: OtpModalProps) {
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', ''])
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [isSendingPhone, setIsSendingPhone] = useState(false)
  const [phoneError, setPhoneError] = useState('')
  const [isVerified, setIsVerified] = useState(false)
  const [outcome, setOutcome] = useState<'SIGNED_IN' | 'REGISTERED' | null>(null)
  /*
   * The failure, kept as its parts rather than as finished text.
   *
   * Several catalogue templates ask for {countdown}, and no response ever
   * carries that value — the contract sends absolute instants, so the seconds
   * remaining are ours to compute. Storing a rendered string would freeze the
   * number at the moment of the error; storing the parts lets it tick down with
   * the same clock every other deadline here uses.
   */
  const [errorInfo, setErrorInfo] = useState<{
    messageId?: string
    params?: Record<string, string | number>
    fallback: string
    retryExpiresAt?: string
  } | null>(null)
  const clearError = () => setErrorInfo(null)
  /** Set by ACCOUNT_LOCKED, and by the resend limits. Absolute instants. */
  const [lockedUntil, setLockedUntil] = useState<string | undefined>()
  const [resendBlockedUntil, setResendBlockedUntil] = useState<string | undefined>()
  const [retriesLeft, setRetriesLeft] = useState(MAX_RESENDS)
  const [now, setNow] = useState(() => Date.now())

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  /*
   * One clock for every deadline.
   *
   * The countdowns are derived from the absolute instants the server sent, not
   * decremented from a starting number — a slow request would otherwise push
   * the deadline out by however long it spent in flight, and a backgrounded tab
   * would drift by however long it was throttled.
   */
  useEffect(() => {
    if (!isOpen) return
    const id = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(id)
  }, [isOpen])

  // The copy for every server message id comes from here.
  const [catalogue, setCatalogue] = useState<Awaited<ReturnType<typeof loadCatalogue>>>(null)
  useEffect(() => {
    if (!isOpen) return
    let live = true
    void loadCatalogue().then((c) => {
      if (live) setCatalogue(c)
    })
    return () => {
      live = false
    }
  }, [isOpen])

  // Lock background body scroll while modal is open
  useEffect(() => {
    if (!isOpen) return
    const originalStyle = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalStyle
    }
  }, [isOpen])

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setOtp(['', '', '', '', '', ''])
      setIsVerifying(false)
      setIsResending(false)
      setIsVerified(false)
      setOutcome(null)
      clearError()
      setLockedUntil(undefined)
      setResendBlockedUntil(undefined)
      setRetriesLeft(MAX_RESENDS)
      setNow(Date.now())
      setTimeout(() => {
        inputRefs.current[0]?.focus()
      }, 100)
    }
  }, [isOpen])

  const codeExpiresIn = secondsUntil(attempt?.expiresAt, now)
  const cooldownEndsIn = secondsUntil(
    resendBlockedUntil ?? attempt?.resendAvailableAt,
    now,
  )
  const lockedFor = secondsUntil(lockedUntil, now)
  const isLocked = lockedFor > 0

  /*
   * The message, rendered fresh every tick.
   *
   * `{countdown}` is filled here rather than by the server, from whichever
   * absolute instant the failure carried — a dispatch cap, a resend limit, a
   * lock. That is why this is derived during render instead of stored: the
   * number counts down while the reader is looking at it, instead of freezing
   * at whatever it was when the request failed.
   */
  const error = errorInfo
    ? renderMessage(
        catalogue,
        { id: errorInfo.messageId, params: errorInfo.params },
        errorInfo.fallback,
        { countdown: formatCountdown(secondsUntil(errorInfo.retryExpiresAt, now)) },
      )
    : ''

  /*
   * Resend opens either when the cooldown lapses OR once the code has expired.
   *
   * The second half matters: past `expiresAt` the server accepts a resend even
   * inside the 30s window, so watching only the cooldown would grey out a button
   * the server would have honoured — leaving a reader holding a dead code with
   * no way to ask for another.
   *
   * `retriesLeft` is the local budget, MAX_RESENDS. The server's own count is
   * what actually decides; when it refuses, RESEND_LIMIT arrives and
   * `resendBlockedUntil` holds the button shut until the instant it names.
   */
  const canResend = !isLocked && !isResending && retriesLeft > 0 && (cooldownEndsIn === 0 || codeExpiresIn === 0)

  /** Turns a failure into copy, and into whatever state it implies. */
  const applyError = (err: unknown, fallback: string) => {
    if (!(err instanceof AuthError)) {
      setErrorInfo({ fallback })
      return
    }
    switch (err.code) {
      case 'ACCOUNT_LOCKED':
        setLockedUntil(err.retryExpiresAt)
        break
      case 'RESEND_COOLDOWN':
      case 'RESEND_LIMIT':
      case 'DISPATCH_CAP':
        setResendBlockedUntil(err.retryExpiresAt)
        break
      default:
        break
    }
    setErrorInfo({
      messageId: err.messageId,
      params: err.params,
      // INTERNAL and UPSTREAM_UNAVAILABLE carry no message id at all, so these
      // are the words for "the catalogue has nothing to say".
      fallback:
        err.code === 'NETWORK'
          ? "Couldn't reach the server. Check your connection and try again."
          : fallback,
      // Drives {countdown} in the caps and lock templates.
      retryExpiresAt: err.retryExpiresAt,
    })
  }

   if (!isOpen || typeof document === 'undefined') return null

  const handleInputChange = (index: number, value: string) => {
    // Only numeric input
    if (value && !/^\d+$/.test(value)) return

    const newOtp = [...otp]
    // Handle paste of 6 digits
    if (value.length > 1) {
      const pastedDigits = value.slice(0, 6).split('')
      for (let i = 0; i < 6; i++) {
        newOtp[i] = pastedDigits[i] || ''
      }
      setOtp(newOtp)
      const nextFocus = Math.min(pastedDigits.length, 5)
      inputRefs.current[nextFocus]?.focus()

      const fullPastedCode = newOtp.join('')
      if (fullPastedCode.length === 6) {
        void executeVerification(fullPastedCode)
      }
      return
    }

    newOtp[index] = value.slice(-1)
    setOtp(newOtp)
    clearError()

    const fullTypedCode = newOtp.join('')
    if (fullTypedCode.length === 6) {
      void executeVerification(fullTypedCode)
    } else if (value && index < 5) {
      // Auto-advance to next input
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const executeVerification = async (codeToVerify: string) => {
    if (isLocked || isVerifying || isVerified) return
    if (!attempt) {
      setErrorInfo({ fallback: 'That request expired. Start again from your number.' })
      return
    }

    setIsVerifying(true)
    clearError()

    try {
      const result = await verifyOtp({ attemptId: attempt.attemptId, code: codeToVerify })
      /*
       * Analytics, inside the try and after the await — so a rejected code
       * throws past this and reports nothing. `signup_completed` is the
       * narrower of the two: it fires only when the outcome is REGISTERED,
       * because SIGNED_IN means an existing member returned rather than a new
       * account being created. See src/lib/analytics.ts.
       */
      trackOtpVerified(result.outcome)
      trackSignupCompleted(result.outcome)
      setOutcome(result.outcome)
      setIsVerified(true)
    } catch (err) {
      applyError(err, 'That code was not accepted. Check it and try again.')
      setOtp(['', '', '', '', '', ''])
      setTimeout(() => {
        inputRefs.current[0]?.focus()
      }, 50)
    } finally {
      setIsVerifying(false)
    }
  }

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleaned = phone.replace(/\D/g, '')
    if (!cleaned || cleaned.length < 10) {
      setPhoneError('Please enter a valid 10-digit mobile number')
      return
    }
    setPhoneError('')
    setIsSendingPhone(true)
    try {
      const started = await sendOtp({ value: phone })
      // Reported only after the server accepted the request. handleResend hits
      // the same endpoint and is deliberately NOT instrumented — it is the same
      // reader asking again for the same step, not a new one.
      trackOtpRequested()
      onAttempt(started)
      setOtp(['', '', '', '', '', ''])
      setTimeout(() => {
        inputRefs.current[0]?.focus()
      }, 100)
    } catch (err) {
      if (err instanceof AuthError) {
        applyError(err, "Couldn't send a code just now. Please try again.")
      } else {
        setPhoneError("Couldn't send a code just now. Please try again.")
      }
    } finally {
      setIsSendingPhone(false)
    }
  }

  const handleResend = async () => {
    if (!canResend || !attempt || retriesLeft <= 0) return
    setIsResending(true)
    clearError()
    try {
      // Same endpoint, carrying the attempt — that makes it a resend against
      // this journey rather than the start of a new one.
      const next = await sendOtp({ value: phone, attemptId: attempt.attemptId })
      onAttempt(next)
      setResendBlockedUntil(undefined)
      setRetriesLeft((prev) => Math.max(0, prev - 1))
      setOtp(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } catch (err) {
      applyError(err, "Couldn't send a new code. Try again in a moment.")
    } finally {
      setIsResending(false)
    }
  }

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault()
    const enteredOtp = otp.join('')
    if (enteredOtp.length === 6) {
      void executeVerification(enteredOtp)
    }
  }

  /*
   * Prefer the server's mask over anything derived from what was typed. It is
   * the number the code actually went to, after normalisation, so it is the
   * only version that can confirm the message went where the reader meant.
   *
   * `attempt?.maskedTo` comes from the server and is already masked, e.g.
   * "+91-XXXXXX0121", and it must not be run through a digit filter: stripping
   * non-digits removes the X's along with the punctuation and leaves "+91-0121",
   * which reads as a broken number rather than a masked one.
   *
   * Only the local fallback — what the reader typed, used for the instant
   * between opening and the first response — needs formatting.
   */
  const formattedPhone =
    attempt?.maskedTo ?? `+91-${phone.replace(/^\+?91/, '').replace(/\D/g, '')}`

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 isolate">
      {/* Backdrop Dimmer Overlay — Solid dark backdrop without blur distortion */}
      <div
        className="fixed inset-0 bg-black/90 transition-opacity duration-300 animate-in fade-in z-0"
        onClick={onClose}
      />

      {/*
        * Modal Dialog Card.
        *
        * Height is capped and allowed to scroll inside itself. A phone in
        * landscape is about 390px tall and the card wanted 391, so it sat a
        * pixel past the fold with nothing able to reach the rest of it — the
        * page behind is scroll-locked while this is open, so an overflowing
        * card is simply unreachable rather than merely awkward.
        *
        * `100dvh` rather than `100vh`: on mobile Safari and Chrome the visual
        * viewport shrinks as the browser chrome and the keyboard appear, and
        * `vh` keeps reporting the taller figure — which is precisely the
        * moment this needs to be right, since the keyboard is open for the
        * whole of the code entry.
        */}
      <div className="relative z-10 w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-3xl border border-white/15 bg-[#0a0a0c] p-6 sm:p-8 shadow-[0_32px_96px_rgba(0,0,0,0.95)] transition-all animate-in zoom-in-95 duration-200">
        {/* Subtle Edge Specular Highlight */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent z-10" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent z-10" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-white/50 hover:bg-white/10 hover:text-white transition-colors z-20"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Top Centered Thinq Logo & Text Brand Lockup */}
        <div className="relative z-10 flex flex-col items-center justify-center text-center pb-4 mb-5 border-b border-white/10">
          <div className="flex items-center justify-center gap-2.5">
            <ThinqMark size={32} tone="steel" />
            <span className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-white">
              Thinq
            </span>
          </div>
        </div>

        {isVerified ? (
          /* Success State */
          <div className="relative z-10 flex flex-col items-center justify-center py-4 text-center animate-in zoom-in-95 duration-400">
            {/* Clean Checkmark in Silver / White Theme Color */}
            <div className="flex items-center justify-center mb-4 animate-in zoom-in-50 duration-500">
              <Check className="h-14 w-14 text-white stroke-[2.5]" />
            </div>

            {/*
              * SIGNED_IN means the number was already registered — it is the
              * server's way of saying "we have seen this one before". So it
              * gets told it is already on the list rather than being
              * congratulated on joining, which would read as a second signup
              * and leave someone wondering whether they are now on it twice.
              *
              * The two outcomes are indistinguishable until this moment: the
              * send that started the journey is identical in shape and timing
              * either way, by design, so this is the first and only point at
              * which the screen can know which of the two happened.
              */}
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-display">
              {outcome === 'SIGNED_IN'
                ? "Already on the waitlist!"
                : "You're on the waitlist!"}
            </h3>

            <p className="mt-2 text-sm text-white/70 max-w-xs leading-relaxed font-sans">
              {outcome === 'SIGNED_IN' ? (
                <>
                  Mobile <span className="font-mono font-medium text-white tracking-wide">{formattedPhone}</span> is registered. We'll notify you as early access opens.
                </>
              ) : (
                <>
                  Your spot is confirmed for <span className="font-mono font-medium text-white tracking-wide">{formattedPhone}</span>. We'll notify you as early access opens.
                </>
              )}
            </p>

            {/* Manual Close / Done Control Button */}
            <Button
              type="button"
              onClick={() => {
                if (outcome) onSuccess(outcome)
                onClose()
              }}
              size="lg"
              fullWidth
              className="mt-6 shadow-[0_0_24px_rgba(255,158,122,0.2)] hover:shadow-[0_0_32px_rgba(255,158,122,0.35)]"
            >
              Done
            </Button>
          </div>
        ) : !attempt ? (
          /* Mobile Number Entry State (Step 1) */
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-white/80 shrink-0" strokeWidth={1.75} />
              <p className="text-xs sm:text-sm text-white/80 leading-relaxed font-sans">
                Enter your 10-digit mobile number to join the waitlist.
              </p>
            </div>

            <form onSubmit={handlePhoneSubmit} className="mt-6 space-y-4">
              <div className="relative flex-1 w-full flex items-center rounded-full border border-white/25 bg-black/60 backdrop-blur-2xl px-4 py-3.5 text-white transition-all duration-300 focus-within:border-white/60 focus-within:bg-black/80 shadow-[0_4px_24px_rgba(0,0,0,0.6)]">
                <span className="text-white/90 font-mono text-sm font-medium mr-3 border-r border-white/20 pr-3 shrink-0">
                  +91
                </span>
                <input
                  type="tel"
                  name="phone"
                  id="modal-phone"
                  aria-label="Mobile number"
                  autoComplete="tel-national"
                  inputMode="numeric"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => {
                    onPhoneChange?.(e.target.value)
                    setPhoneError('')
                  }}
                  placeholder="Enter 10-digit mobile number"
                  /*
                   * 16px, and not for looks: iOS Safari zooms the page in when
                   * it focuses a field whose font is under 16px, and leaves the
                   * reader zoomed afterwards. This was text-sm — 14px — so
                   * tapping it jumped the whole layout.
                   *
                   * The other way to stop that is `maximum-scale=1` on the
                   * viewport meta, which is worse: it disables pinch-zoom for
                   * the entire site and fails WCAG 1.4.4. Clearing the
                   * threshold costs two pixels of type instead.
                   *
                   * The code boxes below are already text-lg, so they never had
                   * the problem. Any field added here needs 16px or more.
                   */
                  className="w-full bg-transparent text-base text-white placeholder-white/40 outline-none font-normal"
                />
              </div>

              {phoneError && (
                <p className="text-center text-xs font-medium text-rose-400 font-sans">
                  {phoneError}
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                fullWidth
                disabled={isSendingPhone}
                className="shadow-[0_0_24px_rgba(255,255,255,0.2)] hover:shadow-[0_0_32px_rgba(255,255,255,0.35)]"
              >
                {isSendingPhone ? 'Sending OTP...' : 'Get OTP'}
              </Button>

              {/* By continuing consent line */}
              <p className="mt-4 text-center text-xs text-white/60 font-normal font-sans">
                By continuing you agree to our{' '}
                <a
                  href="/terms"
                  onClick={() => {
                    sessionStorage.setItem('return_to_otp', 'true')
                    if (phone) {
                      sessionStorage.setItem('otp_phone', phone)
                    }
                  }}
                  className="font-semibold text-white underline hover:text-white/80 transition-colors inline-block font-sans"
                >
                  T&amp;C
                </a>
                .
              </p>
            </form>
          </div>
        ) : (
          /* OTP Entry State (Step 2) */
          <div className="relative z-10">
            {/* Header Subtitle with Target Phone */}
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-white/80 shrink-0" strokeWidth={1.75} />
              <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
                Enter 6-digit OTP sent to{' '}
                <span className="font-mono font-semibold text-white tracking-wide">
                  {formattedPhone}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (onEditPhone) {
                      onEditPhone()
                    } else {
                      onAttempt(null)
                    }
                  }}
                  className="ml-2 font-medium text-white/90 hover:text-white underline transition-colors font-sans"
                >
                  Edit
                </button>
              </p>
            </div>

            {/* OTP Input Boxes Form */}
            <form onSubmit={handleVerify} className="mt-6">
              <div className="flex items-center justify-center gap-1.5 sm:gap-3">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      inputRefs.current[idx] = el
                    }}
                    type="text"
                    inputMode="numeric"
                    /*
                     * This is what makes iOS offer the code.
                     *
                     * When a field declares `one-time-code`, iOS reads the
                     * arriving SMS and puts the code on the QuickType bar above
                     * the keyboard; Android's autofill and Safari on macOS use
                     * the same signal. Without it the reader has to leave the
                     * page, open Messages, memorise six digits and come back —
                     * which is where a waitlist signup gets abandoned.
                     *
                     * It sits on all six boxes rather than only the first,
                     * because the reader can focus any of them and iOS offers
                     * the suggestion for whichever has focus.
                     *
                     * Filling it puts the WHOLE code into one field, not one
                     * digit per box. That already works: maxLength is 6, not 1,
                     * and handleInputChange spreads a multi-character value
                     * across the boxes and then verifies. A maxLength of 1 here
                     * would silently truncate the fill to a single digit, which
                     * is the usual way this feature appears to do nothing.
                     */
                    autoComplete="one-time-code"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={6}
                    value={digit}
                    disabled={isLocked}
                    onChange={(e) => handleInputChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    className="h-12 sm:h-14 min-w-0 flex-1 max-w-[3rem] rounded-xl border border-white/20 bg-white/5 text-center font-mono text-lg font-bold text-white outline-none transition-all focus:border-white/60 focus:bg-white/10 focus:ring-2 focus:ring-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                ))}
              </div>

              {error && (
                <p className="mt-3 text-center text-xs font-medium text-rose-400">
                  {error}
                </p>
              )}

              {/* Status / Resend Row — Single countdown at a time, sans-serif typography, no internal retry budgets exposed */}
              <div className="mt-5 flex items-center justify-between text-xs text-white/60 font-sans">
                {retriesLeft <= 0 ? (
                  <span className="text-rose-400 font-medium font-sans">
                    Too many attempts. Try again in 15 minutes.
                  </span>
                ) : isLocked ? (
                  <span className="text-rose-400/80 font-medium font-sans">
                    Locked · try again in {formatTime(lockedFor)}
                  </span>
                ) : codeExpiresIn === 0 ? (
                  <div className="flex items-center justify-between w-full font-sans">
                    <span className="text-rose-400 font-medium font-sans">Code expired</span>
                    <button
                      type="button"
                      onClick={() => void handleResend()}
                      className="flex items-center gap-1.5 font-semibold text-white hover:text-white/80 transition-colors font-sans"
                    >
                      <RefreshCw className="h-3 w-3" /> Resend OTP
                    </button>
                  </div>
                ) : canResend ? (
                  <div className="flex items-center justify-end w-full font-sans">
                    <button
                      type="button"
                      onClick={() => void handleResend()}
                      className="flex items-center gap-1.5 font-semibold text-white hover:text-white/80 transition-colors font-sans"
                    >
                      <RefreshCw className="h-3 w-3" /> Resend OTP
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-end w-full font-sans">
                    <span className="text-white/50 font-normal font-sans">
                      {isResending ? 'Sending…' : `Resend in ${formatTime(cooldownEndsIn)}`}
                    </span>
                  </div>
                )}
              </div>

              {/* By continuing consent line */}
              <p className="mt-4 text-center text-xs text-white/60 font-normal font-sans">
                By continuing you agree to our{' '}
                <a
                  href="/terms"
                  onClick={() => {
                    sessionStorage.setItem('return_to_otp', 'true')
                    if (phone) {
                      sessionStorage.setItem('otp_phone', phone)
                    }
                    if (attempt) {
                      sessionStorage.setItem('otp_attempt', JSON.stringify(attempt))
                    }
                  }}
                  className="font-semibold text-white underline hover:text-white/80 transition-colors inline-block font-sans"
                >
                  T&amp;C
                </a>
                .
              </p>
            </form>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
