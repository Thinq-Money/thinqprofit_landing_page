import { useEffect, useState } from 'react'
import Button from '../ui/Button'
import Container from '../ui/Container'
import ThinqMark from '../ui/ThinqMark'
import { RAIL } from '../../lib/layout'
import { signupLabel, wordmark, wordmarkAlt } from '../../data/nav'

/**
 * Bar height. Taller from `xl` up: at a 1344–1664px content width a 64px bar
 * reads thin.
 */
const BAR_HEIGHT = 'h-16 xl:h-20'

/**
 * Copy deck §2. Sticky nav in normal flow, so no content hides behind a fixed
 * element.
 *
 * ── There is no menu here, and that is the whole design ────────────────────
 *
 * This file carried two mega-menus, a mobile sheet with its own focus trap and
 * scroll lock, roving-tabindex keyboard handlers for both, and a 27-icon lucide
 * map — around 750 lines. Every one of them read from `megaMenus`,
 * `directLinks` or `mobileOrder` in src/data/nav.ts, and all three have been
 * empty arrays since the page became a waitlist. The sheet was further gone
 * than that: no trigger was ever rendered for it, so `setMobileOpen(true)` had
 * no call site and the dialog could not open at any viewport.
 *
 * Navigation exists to help a reader choose between destinations. There are no
 * destinations — one scroll, four sections, ending at the form it started
 * with — so what the bar owes the reader is the mark and the action, and the
 * action only once the hero's copy of it has scrolled away.
 *
 * If a second destination ever arrives, the menu is in this file's history, not
 * in its source. A component that renders nothing is not a feature in waiting.
 */
export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [pastHero, setPastHero] = useState(false)

  /* Border + blur once the page moves (~12px), and track when the reader has
     scrolled past the hero — which is what un-hides the action below. */
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 12)
      const hero = document.getElementById('hero')
      const heroThreshold = hero ? hero.offsetHeight - 140 : 350
      setPastHero(window.scrollY > heroThreshold)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    /* transition-colors does not cover backdrop-filter, so the blur popped in
       while the background and border cross-faded. Name the properties. */
    <header
      className={`sticky z-40 transition-all duration-200 border-b top-0 ${
        scrolled
          ? 'border-white/15 bg-bg/40 backdrop-blur-2xl shadow-xl shadow-black/40'
          : 'border-white/10 bg-bg/30 backdrop-blur-xl'
      }`}
    >
      <Container>
        {/* The nav sits on `layout.ts`'s rail, not on Container's full
            1760px. Once the sections centre at 84rem, a nav that keeps running
            to the Container edge puts the wordmark ~200px left of every heading
            beneath it on a wide display — the page would have two left edges and
            two centres. The rail is what makes the wordmark, every section title
            and the footer share one axis. */}
        <div className={`relative ${RAIL}`}>
          <div className={`flex ${BAR_HEIGHT} items-center justify-between gap-2`}>
            {/* §2.1 wordmark — mark to the left of the text lockup */}
            <a
              /*
               * The site root, not the `#main` anchor this used to carry.
               *
               * The lockup is labelled "Thinq home" and is read as the way back
               * to the homepage, but `#main` made it an in-page jump: it left
               * `/#main` in the address bar and, from anywhere other than the
               * top, behaved like a second skip link. The real skip link is the
               * one in App.tsx, which still points at `#main` and still needs
               * the `<main id="main">` target — neither is touched.
               */
              href="/"
              aria-label={wordmarkAlt}
              /* `lockup` is the hover target for the mark's thinking animation —
                 see index.css. It sits on the anchor rather than on the mark so
                 the pointer triggers it from anywhere on the link, including the
                 word: mark and name are one thing to click, and a mark that only
                 answers a pointer that finds a 24px circle reads as broken
                 rather than as restrained. */
              className="lockup flex shrink-0 items-center gap-2.5 rounded-full py-2 pr-2 transition-opacity duration-200 hover:opacity-90"
            >
              {/* The mark is `chrome`, not `accent`, and the reason is chroma
                  rather than luminance. Measured, accent #FF9E7A has relative
                  luminance 0.4712 and chrome #AEAEB2 has 0.4249 — 1.0976:1 taken
                  as a contrast pair, so there is no brightness step between them.
                  What separates them is OKLCH chroma 0.1263 against 0.0057, a gap
                  of 22.16x, plus 245.23 deg of hue. The rule the page enforces is
                  "only the action is saturated copper", so a mark beside a live
                  control is neutral steel — DESIGN.md §4. §23 splits it by
                  context and sends this case to chrome; the footer wordmark is
                  the other case, and that one IS copper.

                  What sat here before was a `chrome` tile containing lucide's
                  `TrendingUp`. A rising arrow is a returns claim, forbidden in as
                  many words by the spec's product constraints — and this page
                  carries a SEBI market-risk disclosure one scroll below. The real
                  mark needs no tile: a ring with a trail is already a shape.

                  36 in a 64px bar and 40 in an 80px one, i.e. 0.4375 and 0.425 of
                  the bar — the spec's own proportion rather than an eyeballed
                  size. It matters more here than it would for a filled glyph:
                  this mark is an outline ring plus two dots, so it carries far
                  less ink per unit area, and under-sized it reads optically
                  lighter than the wordmark it is supposed to lead. `small`
                  thickens the ring from 2 to 2.3 units, which is what holds its
                  weight against the word. */}
              <ThinqMark
                size={36}
                tone="steel"
                small
                className="shrink-0 h-[34px] w-[34px] xl:h-[40px] xl:w-[40px]"
              />
              <span className="text-lg font-bold tracking-tight text-fg lg:text-xl xl:text-2xl">
                {wordmark}
              </span>
            </a>

            {/* The action, revealed only once the hero's own copy of it has
                scrolled away — two live "Join the waitlist" controls on screen at
                once is one ask presented as two. */}
            <div
              className={`flex shrink-0 items-center gap-2 transition-all duration-300 ease-[var(--ease-out-soft)] ${
                pastHero
                  ? 'opacity-100 translate-y-0 pointer-events-auto'
                  : 'opacity-0 -translate-y-1 pointer-events-none'
              }`}
            >
              <Button
                type="button"
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                  window.dispatchEvent(new CustomEvent('open-waitlist-modal'))
                }}
                variant="primary"
                size="sm"
              >
                {signupLabel}
              </Button>
            </div>
          </div>
        </div>
      </Container>
    </header>
  )
}
