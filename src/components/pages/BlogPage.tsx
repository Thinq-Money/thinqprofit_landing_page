import { ArrowLeft } from 'lucide-react'
import ThinqMark from '../ui/ThinqMark'
import Container from '../ui/Container'
import { RAIL, SCALE, SECTION_Y } from '../../lib/layout'
import { blogArticles } from '../../data/blog'

/**
 * The blog index. Currently empty, and structured so that it stops being empty
 * the moment an article is added to src/data/blog.ts.
 *
 * The shell — ground colour, ambient glow, sticky header, back link — is lifted
 * from TermsPage rather than reinvented, because this is the second standalone
 * page on the site and both should read as the same product. The layout below
 * it uses the shared rail and heading scale from lib/layout.ts, so nothing here
 * introduces a new spacing or type decision.
 */
export default function BlogPage() {
  /*
   * Same handler as TermsPage: prefer stepping back through history over a new
   * navigation, so returning to the homepage restores the reader's scroll
   * position instead of dropping them at the top of a freshly loaded page.
   */
  const handleBackToHome = (e: React.MouseEvent) => {
    e.preventDefault()
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back()
    } else {
      window.location.href = '/'
    }
  }

  return (
    <div className="min-h-screen bg-[#040405] text-fg font-sans selection:bg-white/20 selection:text-white isolate">
      {/* Signature Thinq ambient teal glow — matches TermsPage exactly. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 h-[520px] z-0 overflow-hidden"
      >
        <div
          /* No blur filter — see AmbientBackground in App.tsx. At blur(140px) this
             fixed layer measured ~5820x4080 device px at DPR 3, past the 4096px
             iOS texture limit. The gradient carries the falloff instead. */
          className="mx-auto h-full w-[90vw] max-w-[1100px] opacity-60"
          style={{
            background:
              'radial-gradient(ellipse at 50% 0%, rgba(8, 45, 54, 0.44) 0%, rgba(8, 45, 54, 0.30) 34%, rgba(8, 45, 54, 0.15) 62%, transparent 90%)',
          }}
        />
      </div>

      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#040405]/80 backdrop-blur-2xl">
        <Container>
          <div className="flex h-16 sm:h-20 items-center justify-between">
            <a href="/" onClick={handleBackToHome} className="flex items-center gap-3 group">
              <ThinqMark size={32} tone="steel" />
              <span className="font-display font-bold text-xl sm:text-2xl tracking-tight text-white group-hover:text-white/80 transition-colors">
                Thinq
              </span>
            </a>

            <a
              href="/"
              onClick={handleBackToHome}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4.5 py-2 text-xs font-semibold text-white/90 hover:border-white/35 hover:bg-white/10 transition-all shadow-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </a>
          </div>
        </Container>
      </header>

      <main id="main" className="relative z-10">
        <Container>
          <div className={`${RAIL} ${SECTION_Y}`}>
            <h1 className={`${SCALE.standard} font-display font-bold tracking-tight text-fg`}>
              Blog
            </h1>

            <div className="mt-10 sm:mt-12 border-t border-border-soft pt-10 sm:pt-12">
              {blogArticles.length === 0 ? (
                /*
                 * The empty state. It states the fact and nothing more — no
                 * launch date, no newsletter capture, no "coming soon". The
                 * page is genuinely empty and says so.
                 */
                <p className="text-sm text-fg-muted">No articles have been published yet.</p>
              ) : (
                /*
                 * Deliberately unlinked. /blog/<slug> is not a registered route
                 * yet, so a heading wrapped in an anchor would send the reader
                 * to the undefined-route fallback and back to the homepage.
                 * Wrap the title in an <a href={`/blog/${article.slug}`}> once
                 * article routes and a template exist — see src/data/blog.ts.
                 */
                <ul className="space-y-10">
                  {blogArticles.map((article) => (
                    <li key={article.slug} className="space-y-2">
                      <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-fg">
                        {article.title}
                      </h2>
                      <p className="text-sm text-fg-muted leading-relaxed">{article.excerpt}</p>
                      <p className="text-xs text-fg-subtle">
                        <time dateTime={article.publishedAt}>{article.publishedAt}</time>
                        {' · '}
                        {article.author}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Container>
      </main>
    </div>
  )
}
