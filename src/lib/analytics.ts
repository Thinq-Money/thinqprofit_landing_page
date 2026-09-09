/**
 * Google Analytics 4, via the official gtag.js tag.
 *
 * Deliberately the whole implementation: one module, two exported functions, no
 * npm package. `react-ga4` and friends wrap the same three lines of dataLayer
 * bookkeeping that appear below and add a dependency to keep current, and the
 * tag itself is a documented, stable interface. This file can be deleted and
 * its two call sites removed to take analytics out entirely.
 *
 * ── Why the tag is not in index.html ───────────────────────────────────────
 *
 * The copy-paste snippet Google gives you goes in <head>. It is not used here
 * for two reasons. The measurement ID would be hardcoded into markup rather
 * than following this project's existing `import.meta.env.VITE_*` convention
 * (authService.ts does the same thing for its base URL), and the page-view side
 * needs to coordinate with App.tsx's routing anyway — see below. Loading the
 * script from here keeps both halves in one place.
 */

/**
 * The property this page reports to.
 *
 * A GA4 measurement ID is not a secret: it is visible in the network tab of
 * every browser that loads the page, and it authorises nothing. The env var is
 * here to let a staging build point somewhere else, not to hide anything, and
 * the default is the real ID so a build with no environment configured still
 * measures rather than silently going dark.
 */
const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID ?? 'G-WLSFSXZLEK'

const TAG_SRC = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`

type GtagArgs = [command: string, ...rest: unknown[]]

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: GtagArgs) => void
  }
}

/**
 * Guards against a second initialisation.
 *
 * Module scope, not component state: this survives re-renders, StrictMode's
 * double-invoked effects in development, and any future second call site. A
 * second `gtag('config')` for the same property is not harmless — it re-arms
 * the tag and is the usual cause of doubled sessions.
 */
let initialised = false

/**
 * The last URL reported, so the same one is never reported twice in a row.
 *
 * This is load-bearing rather than defensive. On /terms the app mounts with
 * `route` at its initial 'home' and an effect immediately corrects it to
 * 'terms', so the route effect fires twice against one URL — see App.tsx, where
 * the initial state is deliberately 'home' on every path to keep the first
 * client render matching the prerendered HTML. Without this, every arrival on
 * /terms would be counted as two page views. It also absorbs StrictMode's
 * double-invoked effects in development.
 *
 * Two DIFFERENT URLs in sequence always report, so a reader moving between
 * pages is never under-counted; only an immediate repeat of the identical URL
 * is dropped.
 */
let lastTrackedUrl: string | undefined

/**
 * Queues one gtag command.
 *
 * `arguments`, not an array — and that is not a stylistic preference, it is the
 * whole contract. gtag.js treats a dataLayer entry as a COMMAND only when it is
 * an `arguments` object; everything else it takes for ordinary tag-manager data
 * and ignores. The check is `Hb()` in the tag itself:
 *
 *   Object.prototype.toString.call(a) === "[object Arguments]"
 *     || Object.prototype.hasOwnProperty.call(a, "callee")
 *
 * A rest parameter produces a real Array, which fails both branches. The
 * failure is silent and looks like success from every angle short of the
 * network: the script loads, `window.gtag` is a function, the queue fills with
 * correct-looking payloads — and gtag.js registers no destination and sends no
 * hit, because it never saw a `config`. That was live for one deploy.
 *
 * The cast is what lets the body use `arguments` while call sites stay typed:
 * a function that declares no parameters can reference `arguments` freely.
 */
const gtag = function (): void {
  window.dataLayer?.push(arguments)
} as (...args: GtagArgs) => void

/**
 * The URL to report, with the query string removed.
 *
 * Nothing on this site routes on a query parameter, so dropping the search
 * removes only noise — but it also means a link someone forwards with a
 * tracking or identifying parameter on it cannot carry that parameter into
 * analytics. The hash is kept: the footer links to /terms#privacy and friends,
 * and which section a reader opened is ordinary page-level information.
 */
function currentPage(): { path: string; location: string } {
  const { origin, pathname, hash } = window.location
  const path = `${pathname}${hash}`
  return { path, location: `${origin}${path}` }
}

/**
 * Loads gtag.js and configures the property. Safe to call more than once.
 *
 * `send_page_view: false` is the one departure from the stock snippet. By
 * default `config` fires a page view immediately, which would race the first
 * `trackPageView()` below and double-count every arrival. Suppressing it makes
 * this module the single source of page views — the initial one included —
 * which is what keeps the count honest across client-side navigation.
 */
export function initAnalytics(): void {
  if (initialised || typeof window === 'undefined') return
  initialised = true

  window.dataLayer = window.dataLayer ?? []
  window.gtag = gtag

  /*
   * `async`, so this never blocks parsing or the first paint. It is still a
   * third-party request competing for bandwidth with the hero, which is why it
   * is not `defer`red further: analytics that loads after the reader has left
   * measures nothing, and `async` is the balance the official tag strikes too.
   */
  const script = document.createElement('script')
  script.async = true
  script.src = TAG_SRC
  document.head.appendChild(script)

  gtag('js', new Date())
  gtag('config', MEASUREMENT_ID, {
    send_page_view: false,
    /*
     * DebugView, in local development only.
     *
     * GA4 shows an event in DebugView only when its hit carries `_dbg=1`, and
     * gtag adds that when the tag is configured with `debug_mode`. Without it a
     * localhost hit is accepted — 204, exactly as in production — and then goes
     * to the normal reporting pipeline, which is why the requests looked fine
     * and DebugView stayed empty.
     *
     * Set on the CONFIG rather than on each event, deliberately: it then
     * applies to every event this module sends, so no call site changes and no
     * event can be forgotten.
     *
     * `import.meta.env.DEV` is true under `vite dev` and false in every build —
     * the same switch authService.ts uses for its offline mock. Vite replaces it
     * with a literal at build time, so this is not a runtime check that could be
     * flipped: the whole key is eliminated from the production bundle, verified
     * below in the build output.
     */
    ...(import.meta.env.DEV ? { debug_mode: true } : {}),
  })
}

/**
 * Reports one page view for the URL currently in the address bar.
 *
 * Called from App.tsx whenever `route` changes, which covers both the initial
 * load and the client-side transitions that produce no new document — pressing
 * Back after following /terms is the common one, and gtag.js cannot see that on
 * its own because no navigation occurs.
 *
 * Only page-level fields are sent. No form values, no phone number, no session
 * or OTP state: nothing this function can reach contains any of them, and
 * nothing should be added here that does.
 */
export function trackPageView(): void {
  if (!initialised || typeof window === 'undefined') return

  const { path, location } = currentPage()
  if (location === lastTrackedUrl) return
  lastTrackedUrl = location

  // A new page view starts a new set of sections. Placed after the duplicate
  // guard above, so a suppressed repeat page view does not reopen them.
  reportedSections.clear()

  gtag('event', 'page_view', {
    page_path: path,
    page_location: location,
    page_title: document.title,
  })
}

/* ══════════════════════════════════════════════════════════════════════════
   Events
   ══════════════════════════════════════════════════════════════════════════

   Everything below sends behavioural events. Three rules hold for all of them:

   1. NO PERSONAL DATA. Not the phone number, masked or otherwise; not the
      attempt id; not the code; not the session. Every parameter here is a fixed
      string from a closed set defined in this file. If a value could vary with
      who the reader is, it does not belong in an event.

   2. SUCCESS ONLY. Funnel events fire after the server has confirmed, inside
      the `try`, never in a `catch` and never optimistically before the await.

   3. DEDUPLICATION LIVES HERE, AT MODULE SCOPE — not in component state.
      OtpModal returns `null` when closed rather than unmounting, so its state
      survives a close; StrictMode double-invokes effects in development; and
      React may re-render a handler's owner at any time. Module scope is the
      only place a guard survives all three. This is not hypothetical: a double
      `onSuccess` fire caused by exactly this shape was a real bug in this
      component.
*/

/** Where a signup journey was started from. A closed set, never free text. */
export type CtaLocation = 'hero' | 'navbar'

/** The homepage sections, keyed by the element ids already in the markup. */
const HOME_SECTIONS: Record<string, string> = {
  hero: 'hero',
  'the-gap': 'the_gap',
  capabilities: 'capabilities',
  agentic: 'agentic',
  footer: 'footer',
}

function trackEvent(name: string, params?: Record<string, string | number | boolean>): void {
  if (!initialised || typeof window === 'undefined') return
  gtag('event', name, params ?? {})
}

/*
 * One signup journey = one opening of the modal.
 *
 * `journeyOpen` gates the entry event so re-renders, StrictMode and a reopen
 * caused by React rather than by the reader cannot inflate it. The three step
 * flags gate the steps within that journey. All four reset together when a
 * journey ends, so a reader who genuinely starts again is counted again —
 * suppressing that would be as wrong as double-counting the first one.
 */
let journeyOpen = false
let otpRequestedFired = false
let otpVerifiedFired = false
let signupCompletedFired = false

/**
 * Homepage sections already reported for the CURRENT page view.
 *
 * Module scope so every observer shares it — including the second one
 * StrictMode briefly creates in development. Cleared by `trackPageView`, which
 * is the only thing that means "a new page view has begun", so returning to the
 * homepage reports its sections again while scrolling around within one visit
 * does not.
 */
const reportedSections = new Set<string>()

/** A meaningful call to action was clicked. */
export function trackCtaClick(ctaLocation: CtaLocation): void {
  trackEvent('cta_click', { cta_location: ctaLocation })
}

/**
 * The reader opened the waitlist modal — the first step of the funnel.
 *
 * Fires once per opening. A second call while the modal is already open is
 * dropped; a call after `endSignupJourney()` starts a fresh journey.
 */
export function trackSignupStarted(ctaLocation: CtaLocation): void {
  if (journeyOpen) return
  journeyOpen = true
  otpRequestedFired = false
  otpVerifiedFired = false
  signupCompletedFired = false
  trackEvent('signup_started', { cta_location: ctaLocation })
}

/**
 * Closes the current journey without reporting anything.
 *
 * Called when the modal closes, whether the reader finished or gave up. It
 * sends no event — an abandoned journey is measured by the ABSENCE of the later
 * steps, which is what makes the funnel's drop-off rates meaningful.
 */
export function endSignupJourney(): void {
  journeyOpen = false
}

/**
 * A code was successfully requested.
 *
 * Fires on the first successful send of a journey only. A resend hits the same
 * endpoint and also succeeds, but it is the same reader asking again for the
 * same step — counting it would make "requested a code" look busier than the
 * number of people who did it. Drop-off between this and `otp_verified` is what
 * exposes codes that never arrive.
 */
export function trackOtpRequested(): void {
  if (otpRequestedFired) return
  otpRequestedFired = true
  trackEvent('otp_requested')
}

/**
 * The server accepted the code.
 *
 * Fires for BOTH outcomes, because verification succeeded either way, and
 * carries which one so the two populations can be separated in reporting.
 * `signup_completed` is the narrower event — see below.
 */
export function trackOtpVerified(outcome: 'SIGNED_IN' | 'REGISTERED'): void {
  if (otpVerifiedFired) return
  otpVerifiedFired = true
  trackEvent('otp_verified', {
    outcome: outcome === 'REGISTERED' ? 'registered' : 'signed_in',
  })
}

/**
 * A NEW account was created. The conversion.
 *
 * `REGISTERED` only, and the distinction is the whole point: this flow has no
 * separate signup step — the account is created inside OTP verification, and
 * `SIGNED_IN` means an existing member came back. Firing on both would count
 * returning readers as new signups and bias every conversion rate downstream —
 * by source, by campaign, by device, by country — all in the same direction.
 */
export function trackSignupCompleted(outcome: 'SIGNED_IN' | 'REGISTERED'): void {
  if (outcome !== 'REGISTERED') return
  if (signupCompletedFired) return
  signupCompletedFired = true
  trackEvent('signup_completed')
}

/**
 * Reports each homepage section the first time it comes into view.
 *
 * Observes the section elements already in the markup by id, so no section
 * component is touched and no markup changes. One event per section per page
 * view: the observer stops watching an element once it has reported, so
 * scrolling back and forth cannot repeat it and nothing fires on a timer while
 * the reader sits still.
 *
 * Returns its own teardown. Call it when the homepage is shown and run the
 * teardown when it is not, so a return visit to `/` reports afresh.
 */
export function observeHomeSections(): () => void {
  if (!initialised || typeof window === 'undefined') return () => {}
  if (typeof IntersectionObserver !== 'function') return () => {}

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const name = HOME_SECTIONS[entry.target.id]
        if (!name) continue
        observer.unobserve(entry.target)
        /*
         * `unobserve` alone is not enough. One callback can be handed several
         * entries for the same target, and in development StrictMode sets up two
         * observers before tearing the first one down — measured: the hero
         * reported three times. The set is the guard that actually holds,
         * because every observer consults the same one.
         */
        if (reportedSections.has(name)) continue
        reportedSections.add(name)
        trackEvent('home_section_viewed', { section_name: name })
      }
    },
    /*
     * Threshold 0 with a bottom margin, NOT a percentage of the element.
     *
     * A ratio cannot work here: a section taller than the viewport can never
     * reach it. #footer is ~3045px, so on a 900px screen it tops out at 0.30
     * visible and on any phone shorter than ~760px it would never have crossed
     * a 0.25 threshold at all — the section would have been silently
     * unmeasurable on much of the mobile traffic. Pulling the root's bottom
     * edge up by a quarter instead means "the section's top reached the upper
     * three quarters of the screen", which behaves the same on every section
     * whatever its height.
     */
    { threshold: 0, rootMargin: '0px 0px -25% 0px' },
  )

  for (const id of Object.keys(HOME_SECTIONS)) {
    const el = document.getElementById(id)
    if (el) observer.observe(el)
  }

  return () => observer.disconnect()
}
