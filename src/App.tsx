import { useState, useEffect, lazy, Suspense } from 'react'
import { trackPageView } from './lib/analytics'
import Navbar from './components/sections/Navbar'
import Hero from './components/sections/Hero'
import TheGap from './components/sections/TheGap'
import AgenticHands from './components/sections/AgenticHands'
import Capabilities from './components/sections/Capabilities'
import Footer from './components/sections/Footer'
/*
 * Split out of the initial download.
 *
 * TermsPage is the largest single component on the page — 104 KB of source,
 * almost all of it the SEBI/CDSL disclosure copy — and none of it is reachable
 * from the homepage. Statically imported it sat in the entry chunk, where
 * Lighthouse measured 48% of that chunk as unused on first load: bytes the
 * reader downloads, parses and evaluates before the hero can hydrate, to render
 * a page they may never open.
 *
 * A dynamic import is safe here specifically because this route is NOT in the
 * prerendered HTML. `route` starts at 'home' and only becomes 'terms' inside an
 * effect, so the first client render still matches the markup on disk and
 * hydration is untouched. Lazy-loading anything the prerender DID emit would
 * mismatch and make React 19 discard the whole tree.
 */
const TermsPage = lazy(() => import('./components/pages/TermsPage'))

/**
 * Every path this app answers. Anything else is a typo, a stale link or a probe.
 *
 * The host cannot make this distinction for us. CloudFront answers 403 and 404
 * with index.html at status 200 (DEPLOY.md), which is what lets /terms work at
 * all — but it means EVERY path returns the app, so /qwerty loaded the homepage
 * and simply kept `/qwerty` in the address bar. This list is the only place that
 * knows which of those paths are real.
 */
const KNOWN_PATHS = new Set(['/', '/terms'])

export default function App() {
  const [route, setRoute] = useState('home')

  useEffect(() => {
    const handleLocationChange = () => {
      if (typeof window === 'undefined') return

      /*
       * An unknown path becomes the homepage, URL included.
       *
       * `replaceState` rather than `pushState`: pushing would leave the dead URL
       * one Back press away, and pressing Back would land the reader on it again
       * and redirect them forward — a trap they cannot escape with the Back
       * button. Replacing drops it from history entirely.
       *
       * It also fires no navigation event, so this cannot re-enter itself; and
       * it runs before the canonical and page-view effects below, which read the
       * location after this has corrected it.
       */
      if (!KNOWN_PATHS.has(window.location.pathname)) {
        window.history.replaceState(null, '', '/')
        setRoute('home')
        return
      }

      if (window.location.pathname === '/terms' || window.location.hash === '#terms') {
        setRoute('terms')
      } else {
        setRoute('home')
      }
    }

    handleLocationChange()
    window.addEventListener('popstate', handleLocationChange)
    window.addEventListener('hashchange', handleLocationChange)
    return () => {
      window.removeEventListener('popstate', handleLocationChange)
      window.removeEventListener('hashchange', handleLocationChange)
    }
  }, [])

  /*
   * Keeps <link rel="canonical"> pointing at the route actually being read.
   *
   * The host serves this SPA with `not_found_handling: single-page-application`
   * (wrangler.jsonc), so /terms is answered with index.html — the same file,
   * carrying the same canonical. Left alone, /terms would tell a crawler it is
   * a duplicate of the homepage, and a crawler that believes it drops /terms
   * from the index. That would make the sitemap entry for /terms
   * self-defeating: one file asking for it to be indexed, another saying it is
   * really some other page.
   *
   * This is a client-side correction, and it is worth being clear about what
   * that buys. Google renders JavaScript before settling a canonical, so it
   * sees this; a crawler that does not render JS sees the static homepage
   * canonical — which is exactly what it would have seen without this code. It
   * can only improve matters, never worsen them. The robust fix is prerendering
   * /terms to its own HTML file with its own canonical and title, which is a
   * build change rather than a tag change.
   */
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!link) return
    link.href = route === 'terms' ? 'https://thinq.co/terms' : 'https://thinq.co/'
  }, [route])

  /*
   * Reports the page view for whichever route is being read.
   *
   * It hangs off `route` rather than off a navigation event because this app has
   * no router to ask: the effect above resolves the path itself and holds the
   * answer in state, so a change to that state IS the page change. Following a
   * link to /terms loads a new document and gtag.js would see it unaided, but
   * pressing Back afterwards fires `popstate` and swaps the page with no
   * navigation at all — invisible to the tag, and the reason this exists.
   *
   * Arriving directly on /terms runs this twice against one URL, because `route`
   * starts at 'home' on every path to keep the first render matching the
   * prerendered markup. trackPageView drops the immediate repeat.
   */
  useEffect(() => {
    trackPageView()
  }, [route])

  if (route === 'terms') {
    /*
     * `null` rather than a spinner. The chunk is one request against a page
     * whose background is already painted by <body>, so the gap reads as the
     * page still being on its way rather than as a flash of loading UI — and a
     * spinner that appears for 20ms is worse than nothing appearing at all.
     */
    return (
      <Suspense fallback={null}>
        <TermsPage />
      </Suspense>
    )
  }

  return (
    <div className="grain relative min-h-screen overflow-x-clip bg-bg text-fg">
      <AmbientBackground />

      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-100 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:text-on-accent"
      >
        Skip to content
      </a>

      <Navbar />

      <main id="main" className="relative z-10">
        <Hero />
        <TheGap />
        <Capabilities />
        <AgenticHands />
      </main>

      <Footer />
    </div>
  )
}

/**
 * Two teal glows bleeding in from the left, fixed behind the whole page so the
 * scroll moves over one continuous field rather than through a series of
 * separately-lit bands.
 *
 * ── Why there is no blur filter here ───────────────────────────────────────
 *
 * These carried `blur(130px)` and `blur(140px)`, and that was the cause of the
 * white screens and mid-scroll glitching on iOS.
 *
 * A `filter` puts an element on its own composited layer, and a Gaussian blur
 * expands that layer's backing store by roughly three times the radius on every
 * side so the falloff has somewhere to land. Measured on the reported devices:
 *
 *   390x844 @DPR3   332x1182 css  ->  3336 x 5886 device px   74.9 MB
 *   414x896 @DPR3   352x1254 css  ->  3396 x 6102 device px   79.0 MB
 *
 * Both dimensions run past 4096px, the maximum texture size on many iOS GPUs.
 * A filtered layer cannot be tiled the way a plain one can — the filter needs
 * its whole source — so past that limit WebKit cannot allocate the backing
 * store and drops the layer. These are `position: fixed`, which iOS
 * re-composites continuously while the page scrolls, so the failure surfaces
 * as scrolling rather than at load: a glitch, then blank or white content.
 *
 * It also explains why only SOME devices were affected. At 375x667 on DPR 2 the
 * same elements come out 2198x3428 — under the limit, and fine.
 *
 * The blur was doing almost nothing anyway. Its subject is a radial-gradient
 * that already fades to `transparent`, which is smooth by construction; blurring
 * it bought a slightly wider falloff at the price of a 75 MB layer. The stops
 * below carry that falloff directly, so the glow looks the same and no filter,
 * no extra layer and no texture limit are involved.
 */
function AmbientBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <div
        className="absolute -left-[20%] top-0 h-[140vh] w-[85vw] max-w-[1100px] opacity-45"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(8, 45, 54, 0.476) 0%, rgba(8, 45, 54, 0.286) 34%, rgba(8, 45, 54, 0.122) 62%, transparent 88%)',
        }}
      />
      <div
        className="absolute -left-[15%] top-[50%] h-[130vh] w-[75vw] max-w-[950px] opacity-35"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(8, 45, 54, 0.408) 0%, rgba(8, 45, 54, 0.231) 36%, rgba(8, 45, 54, 0.088) 66%, transparent 92%)',
        }}
      />
    </div>
  )
}
