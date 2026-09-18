import type { ReactNode } from 'react'
import FocusPull from './FocusPull'
import MediaBackdrop from './MediaBackdrop'
import { GUTTER_X, RAIL, SECTION_Y } from '../../lib/layout'
import type { ImageSources, VideoSources } from './MediaBackdrop'

/**
 * Section heights.
 *
 * `epic` is the full viewport at `md` and up, unchanged.
 *
 * `tall` is the full viewport too, but only up to a point: `min(100svh,900px)`
 * stops the minimum growing once the display is taller than 900px. The two are
 * still distinct names because they pick the type step below
 * (`step = scale ?? height`), and because unequal heights are the first thing to
 * reach for if the full-screen rhythm is relaxed.
 *
 * ── Why `tall` is capped ───────────────────────────────────────────────────
 *
 * The section is a flex column whose inner wrapper is `flex-1` under
 * `ANCHOR.center` (`md:justify-center`), so any height the copy does not use is
 * split evenly above and below it. Tied to `100svh` that surplus has no ceiling:
 * measured, the gap between this section's last line and the heading of the one
 * after it came to half the viewport height minus 138px — 312px on a 900px-tall
 * laptop and 662px at 1600px, growing forever with the display. Past roughly
 * 900px the extra space stops reading as composition and starts reading as the
 * page having ended. The cap holds every taller screen at the 900px result.
 *
 * It is the MINIMUM that is capped, not the height. Copy taller than 900px still
 * pushes the section open, which is what keeps this safe — see below.
 *
 * `min-h`, never a fixed height: the section carries `overflow-hidden` so the
 * scrim's overscan cannot escape, which means a hard height would silently clip
 * any section whose copy outgrew the frame. `svh` keeps mobile browser chrome
 * out of it. Below 768px `min-h-0` leaves every section content-sized, so none
 * of this — the viewport height or the cap — applies to a phone at all.
 */
const HEIGHT = {
  epic: 'min-h-0 md:min-h-svh',
  tall: 'min-h-0 md:min-h-[min(100svh,900px)]',
  mid: 'min-h-0 md:min-h-[65vh] py-8 md:py-12',
  short: 'min-h-0 md:min-h-[50vh] py-6 md:py-8',
} as const



/**
 * Copy is parked with percentage margins, not a grid column, so the asset can
 * be shot/rendered with its negative space exactly where the words land and the
 * two never fight. Sections alternate side to break the rhythm.
 */
const PLACE = {
  /*
   * Note the asymmetry: the percentage is always on the margin AWAY from the
   * copy, never on the side it starts from. How much frame the copy leaves for
   * the asset is genuinely a fraction of the frame; the edge it starts on has to
   * align with every other section's heading, and a percentage cannot hold that
   * — it changes with viewport width.
   */
  left: 'md:mr-[46%] md:items-start md:text-left',
  right: 'md:ml-[46%] md:items-start md:text-left',
  center: 'md:mx-auto md:items-center md:text-center',
} as const

/** The inner rail's `SECTION_Y` supplies the inset; these only pick the edge. */
const ANCHOR = {
  top: 'md:justify-start',
  center: 'md:justify-center',
  bottom: 'md:justify-end',
} as const

/**
 * Display steps for a full-bleed section, sharing one ladder with
 * `lib/layout.ts`. `tall` is identical to that file's `lead` on purpose — a
 * full-bleed section and a flat one must carry the same rank, or nothing on the
 * page reads as primary. `SCALE.hero` is the only step above these.
 *
 * Leading opens as size drops: type cut this tight needs air at 2.125rem that it
 * does not need at 4.5rem, where line length does the separating. Tracking and
 * the variable-axis coordinate come from `.display` — setting them per step
 * would fight the face.
 */
const SCALE = {
  epic: 'text-[clamp(2.75rem,5.2vw,4.5rem)] leading-[1.06]',
  tall: 'text-[clamp(2.5rem,4.6vw,4rem)] leading-[1.08]',
  mid: 'text-[clamp(2.25rem,4.1vw,3.5rem)] leading-[1.12]',
  short: 'text-[clamp(2.125rem,3.9vw,3.25rem)] leading-[1.14]',
} as const

interface MediaSectionProps {
  id: string
  height?: keyof typeof HEIGHT
  place?: keyof typeof PLACE
  anchor?: keyof typeof ANCHOR
  /** Type step. Defaults to matching the height. */
  scale?: keyof typeof SCALE
  /**
   * Scrim strength, 0–1, tuned per asset. Set 0 when the plate is already dark
   * enough — a blanket `bg-black/50` over every section is the tell we are
   * removing, not a default to reach for.
   */
  scrim?: number
  /** Where the scrim's dense core sits. Put it under the copy, not the middle. */
  scrimAt?: string
  /** `\n` is an art-directed line break, honoured at ≥768px only. */
  headline: string
  /**
   * Which voice the headline is set in. `quiet` is reserved for a single
   * editorial moment on the page — used once it is a change of register, used
   * three times it is just a second default.
   */
  voice?: 'display' | 'quiet'
  /**
   * Measure in `em`, not `px` or `ch`, so the headline breaks in the same place
   * at every breakpoint instead of re-ragging as the clamp resizes it.
   */
  measure?: string
  body?: ReactNode
  actions?: ReactNode
  /**
   * Fills the 46% of the frame that `place` reserves for the asset — useful when
   * the backdrop alone would leave that half as dead space. A slot, not a second
   * copy column: it takes the reserved area from `md` up and stacks under the
   * copy on a phone.
   *
   * Absolutely positioned rather than a grid column on purpose. The copy block
   * sets the section's height, and a grid would let a tall aside push the
   * section past what its own headline needs.
   */
  aside?: ReactNode
  /** Disclosures live inside the section, under the CTA — never in a legal ghetto. */
  finePrint?: ReactNode
  /** Extra content below the CTA, still inside the overlay. */
  children?: ReactNode
  media: {
    alt: string
    image?: ImageSources | string
    video?: VideoSources | string
    poster?: string
    tone?: string
    blur?: boolean
  }
  /** Optional top-level background ambient layer (full bleed) */
  bgAmbient?: ReactNode
  className?: string
}


/**
 * Full-bleed section: media pinned behind, copy overlaid on it.
 *
 * Stacking is flat by design — the backdrop sits at `z-index: -999` and the
 * scrim at `-1`, both inside this section's stacking context, so the copy stays
 * in normal document flow and needs no z-index. Nothing is layered *over* the
 * text, which is what keeps live disclosure text selectable and contrast-safe.
 *
 * This lives outside `Container` on purpose: Container caps at 1760px, and a
 * bleed section must reach the viewport edge. The inner rail re-imposes that cap
 * on the copy alone so percentage margins stay sane on an ultrawide display.
 */
export default function MediaSection({
  id,
  height = 'tall',
  place = 'left',
  anchor = 'center',
  scale,
  scrim = 0.82,
  scrimAt = '32% 50%',
  headline,
  voice = 'display',
  measure = '11em',
  body,
  actions,
  aside,
  finePrint,
  children,
  media,
  bgAmbient,
  className = '',
}: MediaSectionProps) {
  const step = scale ?? height

  /*
   * The aside takes the margin the copy gives up, mirrored off `place` so the
   * two can never end up on the same side. `left` copy runs to 54% and the
   * aside starts at 58%, which leaves a 4% channel between them — enough that
   * the two blocks read as adjacent rather than as one wrapped column, and not
   * so much that the aside is pushed into the gutter.
   */
  const ASIDE_PLACE = {
    left: 'md:left-[48%] md:right-0',
    right: 'md:left-0 md:right-[48%]',
    center: 'md:inset-x-0',
  } as const

  /*
   * `isolate` is load-bearing, not decoration. `relative` alone does not open a
   * stacking context, so the backdrop at z-index:-999 and the scrim at -1 would
   * resolve against the root and paint *behind* App's opaque `bg-bg` wrapper —
   * the media would render, invisibly, under the page.
   */
  return (
    <section
      id={id}
      className={`relative isolate flex w-full scroll-mt-24 flex-col overflow-hidden ${HEIGHT[height]} ${className}`}
    >
      {bgAmbient}


      {/*
        The plate is lit on the side the copy is NOT on. `place` already encodes
        that, so the caller never has to state it twice and the two cannot drift
        apart — which they would the moment this was a separate prop.

        Only reaches the no-asset plate; a real image or video ignores it.
      */}
      <MediaBackdrop
        focus={place === 'right' ? 'left' : place === 'center' ? 'center' : 'right'}
        {...media}
      />

      {/* `Container` + `RAIL`, reproduced exactly — 1760px cap and gutter
          ladder on the outside, 84rem rail within it. Both layers are needed:
          the outer one is Container, the inner one is what every `SectionShell`
          puts inside Container, and skipping the inner one is what left this
          section's copy starting at 128px on a 1920px display while every flat
          section above and below it started at 288px.

          The section itself still bleeds to the viewport edge — only the copy is
          railed. That is the whole point of the split. */}
      <div className={`mx-auto flex w-full max-w-[1760px] flex-1 flex-col ${GUTTER_X} ${SECTION_Y}`}>
        <div className={`relative flex flex-1 flex-col ${RAIL} ${ANCHOR[anchor]}`}>
          {/* Scrim overscans the section so its soft edge never lands inside the
              frame.

              The ink is `--color-bg` mixed toward transparent, not a literal
              triple. It was `rgba(5,5,5,a)`, which was the ground when it was
              written and is now 1.0522:1 below it — so every full-bleed section
              on the page was being darkened toward a value that is not the page,
              at chroma 0.0000 against the ground's 0.0038. On a copper-lit plate
              that is the one place a cool cast shows: the scrim's falloff runs
              straight into the warm crest it is supposed to sit under. Mixing
              the token cannot drift from it. Alpha stops are unchanged (`scrim`,
              `scrim × 0.72`, 0), so the falloff is identical and only its hue
              moves. `Platform` transcribes this geometry and already made the
              same move. */}
          {scrim > 0 && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-x-[20%] -bottom-[20%] -top-[25%]"
              style={{
                zIndex: -1,
                backgroundImage: `radial-gradient(58% 62% at ${scrimAt}, color-mix(in oklab, var(--color-bg) ${(scrim * 100).toFixed(1)}%, transparent) 0%, color-mix(in oklab, var(--color-bg) ${(scrim * 72).toFixed(1)}%, transparent) 44%, transparent 100%)`,
              }}
            />
          )}

          <div className={`flex flex-col items-start text-left ${PLACE[place]}`}>
            {/*
              The headline comes into focus against its plate, matching the
              treatment every `SectionShell` heading gets — so a full-bleed
              section and a flat one share one gesture instead of reading as two
              systems.

              Only the headline. The body, the CTA and `finePrint` are left
              untouched on purpose: `finePrint` is where disclosures live, and a
              disclosure inside an entrance that starts at zero opacity is
              illegible to anyone who stops scrolling mid-tween.
            */}
            <FocusPull
              as="h2"
              className={`m-0 whitespace-normal text-fg md:whitespace-pre-line ${
                /* The optical ladder, picked off the step rather than the
                   section: `epic` and `tall` render 40–72px, which is where
                   `.display-lead`'s lighter weight and tighter track are solved
                   for; `mid` and `short` render 34–56px and take `.display`. The
                   quiet voice opts out of both — it declares its own axis
                   coordinate, which is the whole point of it. */
                voice === 'quiet'
                  ? 'display-quiet'
                  : step === 'epic' || step === 'tall'
                    ? 'display-lead'
                    : 'display'
              } ${SCALE[step]}`}
            >
              <span className="block" style={{ maxWidth: measure }}>
                {headline}
              </span>
            </FocusPull>

            {/* Same deck step as `SectionShell` — 17px in a 30em measure. A
                full-bleed section's standfirst and a flat one's have to match, or
                the page has two ideas about what a subtitle is. */}
            {body && (
              <div className="mt-5 max-w-[30em] text-[1.0625rem] leading-[1.6] text-fg-muted lg:mt-6">
                {body}
              </div>
            )}

            {actions && <div className="mt-8 flex flex-wrap items-center gap-3">{actions}</div>}

            {children}

            {/*
              `fg-subtle`, not `text-white/55`, and this is a live text slot —
              `Terminal` passes plain strings through it, so the colour declared
              here is the colour those sentences render in. (`FinalCta` passes a
              `Disclosure`, which sets its own and overrides this by
              inheritance.)

              White at 55% composites to #919090 over the new ground: 6.275:1,
              chroma 0.0012. `fg-subtle` is 5.3087:1 on bg and 4.7179:1 on the
              raised surface — a real drop, and it is the right trade twice over.
              First, this text is read directly beside body copy set in `fg-muted`
              at chroma 0.0078, and a dead-neutral grey next to a warm one is the
              cool-patch defect the whole palette moved to avoid. Second, an
              alpha's contrast is a property of whatever it lands on, and this
              slot always lands on a media plate under a scrim — so the 6.275:1
              was never the number that rendered.

              THE HALF OF THAT ARGUMENT THAT WAS WRONG, corrected rather than
              trimmed, because it pointed the wrong way. It said "5.3087:1 is a
              floor the token guarantees". It is not a floor, it is a CEILING:
              5.3087:1 is the value on `bg`, and every surface this slot can
              actually sit on is lighter than `bg`, so the token can only go
              down from there — 5.0620:1 on `surface`, 4.7179:1 on
              `surface-raised`, and on a lit plate it goes under 4.5:1. Swapping
              an alpha for a token buys a number that is COMPUTABLE, not one
              that is guaranteed.

              So here is the constraint with its number, which is what the claim
              should have been. `fg-subtle` holds 4.5:1 only while the pixel
              behind it stays below relative luminance Y 0.0120 — about neutral
              #1D1D1D. Measured on the rendered page at 1920/1440/1024/768/390,
              the brightest pixel under any glyph in this slot is #0A0909 and the
              worst ratio is 5.2846:1, so it holds today with ~11% of headroom in
              contrast terms; `PendingField`'s own lit face #251E1B would put it
              at 4.3588:1, which is the margin this slot is working inside.
              `FinalCta` states the same constraint from the plate's side (its
              scrim puts the ceiling at plate grey 89, 4.5071:1) and that is the
              form to copy: the plate is the variable, the token is not.

              It clears 4.5:1 at this 13px size on every surface it renders on.
              `Platform` made this exact move for its deck and states the same
              second reason.
            */}
            {finePrint && (
              <div className="mt-8 max-w-[46em] text-[0.8125rem] leading-relaxed text-fg-subtle">
                {finePrint}
              </div>
            )}

            {/*
              The aside, on a phone. It follows the copy in the DOM at every
              width, so the reading order and the focus order are the same order
              at both — the desktop version only moves where it PAINTS, via
              absolute positioning, and never where it sits in the document.

              That is the whole reason this is one element with a responsive
              position rather than two elements with a `hidden md:block` pair:
              duplicating it would put the same content in the accessibility
              tree twice, and hiding one copy per breakpoint is how a screen
              reader ends up reading a section that is not on the screen.
            */}
            {aside && (
              <div
                className={`mt-4 w-full md:absolute md:top-1/2 md:mt-0 md:w-auto md:-translate-y-1/2 ${ASIDE_PLACE[place]}`}
              >
                {aside}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
