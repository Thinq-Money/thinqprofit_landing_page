/**
 * The blog's content store. Empty on purpose.
 *
 * Articles live here rather than in a CMS for the same reason every other
 * section's copy does — see hero.ts, capabilities.ts, footer.ts. A build is the
 * publish step.
 *
 * ── Publishing an article: what is and is not already wired ────────────────
 *
 * Adding an entry to `blogArticles` below makes it appear on /blog/ straight
 * away. It does NOT give it a page of its own, and that is deliberate: the
 * route table in App.tsx admits exactly the paths that exist, so /blog/<slug>
 * currently falls through to the undefined-route fallback and redirects to the
 * homepage. Publishing a readable article therefore needs three things:
 *
 *   1. an entry here,
 *   2. its slug registered as a real route in App.tsx's KNOWN_PATHS,
 *   3. a page that renders `content` — there is no article template yet.
 *
 * Until step 3 exists the list on /blog/ is deliberately not linked, because a
 * link to a route that redirects home is worse than no link at all.
 */

export interface BlogArticle {
  /** Headline, as it appears on the article and in the list. */
  title: string
  /** URL segment: lowercase, hyphenated, no slashes — becomes /blog/<slug>. */
  slug: string
  author: string
  /** ISO 8601 date, e.g. '2026-09-07'. Used for <time dateTime>. */
  publishedAt: string
  /** Path under /images, hashed at build time by scripts/hash-media.mjs. */
  coverImage?: string
  /** One or two sentences for the list. Not the first line of the body. */
  excerpt: string
  /** The article body. */
  content: string
  /** Overrides <title> when an article template exists. Falls back to `title`. */
  seoTitle?: string
  /** Meta description. Falls back to `excerpt`. */
  seoDescription?: string
}

/**
 * No articles yet.
 *
 * Nothing is seeded here — not a sample, not a draft, not a placeholder. A
 * fabricated article on a SEBI-registered broker's site is a compliance problem
 * before it is a content problem, and a "coming soon" card is a promise the
 * repository cannot keep.
 */
export const blogArticles: BlogArticle[] = []
