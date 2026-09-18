/**
 * "How many posts have gone up since this browser last opened the Blog?"
 *
 * One number, on one link, backed by one localStorage key. No account, no
 * cookie, no backend, no cross-device sync — a reader on Chrome and the same
 * reader on Safari keep separate baselines, and that is the intended behaviour
 * rather than a limitation to engineer around.
 *
 * ── Why the sitemap ────────────────────────────────────────────────────────
 *
 * The blog is a separately maintained property in its own S3 bucket, and
 * `/blog/sitemap.xml` is the only machine-readable list it publishes. There is
 * no feed: /blog/rss.xml, /blog/feed.xml, /blog/atom.xml, /blog/index.xml and
 * /blog/feed.json all answer 200 with `text/html` — the SPA shell CloudFront
 * returns for any missing /blog path. That fallback is the single most
 * important fact in this file: a MISSING SITEMAP DOES NOT 404. It answers 200
 * with a page of HTML, so `response.ok` proves nothing and every guard below
 * checks the shape of what came back rather than the status line.
 *
 * Same-origin, so no CORS is involved at all: the page is served from
 * https://thinq.co and so is the sitemap. The URL below is deliberately
 * relative — an absolute https://thinq.co/... would turn every local dev load
 * into a cross-origin request that is refused, and hard-code the host besides.
 *
 * Caching is not a problem here. The file ships `cache-control: public,
 * max-age=0, must-revalidate` and CloudFront answers it with RefreshHit rather
 * than serving it blind, so a new post is visible on the next load. `no-cache`
 * below asks the browser to revalidate too. Note what is NOT done: no
 * cache-busting query string, because this distribution does not include query
 * strings in the cache key — `?t=…` would not bypass the edge and would only
 * add misses.
 */

/** Namespaced so it cannot collide with anything else on the origin. */
const STORAGE_KEY = 'thinq_blog_seen_posts'

/** Relative on purpose — see the note above. */
const SITEMAP_URL = '/blog/sitemap.xml'

/**
 * Bumped only if the stored shape changes. A record at any other version is
 * discarded and re-seeded rather than guessed at, so a format change can never
 * surface as a wrong number.
 */
const SCHEMA_VERSION = 1

/**
 * Past this the badge is not worth a hanging request. The whole feature is
 * decorative: failing fast and showing nothing beats holding a promise open.
 */
const FETCH_TIMEOUT_MS = 5000

/** Everything strictly below this path is an article. The path itself is not. */
const BLOG_PREFIX = '/blog/'

interface SeenRecord {
  v: number
  urls: string[]
}

export interface BlogSnapshot {
  /**
   * The canonical article URLs currently published, or `null` when that could
   * not be established. `null` is not "no posts" — it is "unknown", and it is
   * what stops a failed fetch from being written over a good baseline.
   */
  urls: string[] | null
  /** Unacknowledged posts. Always 0 when `urls` is null. */
  newCount: number
}

function canUseDom(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

/**
 * The reader's acknowledged set, or `null` when there isn't a usable one.
 *
 * `null` covers every unusable case identically — key absent, storage disabled,
 * unparseable JSON, wrong shape, wrong version — because the caller's response
 * to all of them is the same: treat this as a first visit and re-seed. That is
 * what keeps a corrupted record from ever being read as "you have seen
 * nothing", which would announce the entire back catalogue as new.
 *
 * An EMPTY set is a different thing from `null` and is returned as-is: a
 * browser that acknowledged the Blog while nothing was published has genuinely
 * seen zero posts, and should be told about all of them later.
 */
function readBaseline(): Set<string> | null {
  if (!canUseDom()) return null

  let raw: string | null
  try {
    raw = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null // Storage disabled (Safari private mode, blocked cookies).
  }
  if (!raw) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null

  const record = parsed as Partial<SeenRecord>
  if (record.v !== SCHEMA_VERSION) return null
  if (!Array.isArray(record.urls)) return null

  /*
   * EVERY entry must be a string, and a single bad one discards the record.
   *
   * Filtering the bad entries out instead looks more forgiving and is worse:
   * `{"v":1,"urls":[1,2,null]}` would filter down to an empty set, which is a
   * VALID baseline meaning "this reader has acknowledged nothing" — so a
   * mangled record would be read as an empty one and the reader would be shown
   * the entire back catalogue as new. Only this module writes this key and it
   * only ever writes strings, so a non-string entry means the record did not
   * come from here. Distrust it whole and re-seed.
   *
   * An empty array is a different matter and stays valid: `every` is true for
   * it, and a browser that acknowledged the Blog while nothing was published
   * really has seen zero posts.
   */
  if (!record.urls.every((url) => typeof url === 'string')) return null

  return new Set(record.urls as string[])
}

/**
 * Records the acknowledged set. Silent on failure — a full quota or disabled
 * storage means the badge reappears next load, which is a far better outcome
 * than an exception thrown out of a click handler on a navigation link.
 */
function writeBaseline(urls: string[]): void {
  if (!canUseDom()) return
  try {
    const record: SeenRecord = { v: SCHEMA_VERSION, urls }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  } catch {
    /* Nothing to do and nothing worth breaking a link over. */
  }
}

/**
 * One `<loc>` to one canonical article URL, or `null` if it is not an article.
 *
 * Two jobs. It EXCLUDES the blog index — the sitemap lists
 * `https://thinq.co/blog` alongside the posts, and counting it would put a
 * permanent +1 on the badge. And it NORMALISES, so `/blog/x` and `/blog/x/`
 * cannot be stored as two different posts and report a republished article as
 * a new one. Query strings and fragments are dropped for the same reason.
 */
function toArticleUrl(raw: string): string | null {
  let url: URL
  try {
    url = new URL(raw.trim(), window.location.origin)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null

  const path = url.pathname.length > 1 && url.pathname.endsWith('/')
    ? url.pathname.slice(0, -1)
    : url.pathname

  // `/blog` and `/blog/` both fail this: after the trailing slash is stripped
  // they are `/blog`, which does not start with `/blog/`.
  if (!path.startsWith(BLOG_PREFIX)) return null
  if (path.length <= BLOG_PREFIX.length) return null

  return `${url.origin}${path}`
}

/**
 * The published article list, or `null` if it could not be trusted.
 *
 * Every rejection returns `null` rather than an empty array, and the difference
 * matters: an empty array would be written to the baseline as "there are no
 * posts", so a broken deploy or an outage would silently erase what the reader
 * had acknowledged. `null` means unknown, and unknown changes nothing.
 */
async function fetchArticleUrls(): Promise<string[] | null> {
  if (!canUseDom() || typeof fetch !== 'function') return null

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(SITEMAP_URL, {
      signal: controller.signal,
      cache: 'no-cache',
      credentials: 'omit',
    })
    if (!response.ok) return null

    const text = await response.text()
    const doc = new DOMParser().parseFromString(text, 'application/xml')

    // The SPA-shell guard, in two layers. Malformed input (which the shell's
    // HTML is, as XML) leaves a parsererror node; anything that does parse must
    // still be rooted in <urlset> before a single <loc> is believed.
    if (doc.getElementsByTagName('parsererror').length > 0) return null
    if (doc.documentElement?.localName !== 'urlset') return null

    // Namespace-agnostic: the sitemap declares a default namespace, and a
    // plain getElementsByTagName would be at the mercy of that declaration.
    const locs = doc.getElementsByTagNameNS('*', 'loc')

    const articles = new Set<string>()
    for (const loc of Array.from(locs)) {
      const article = toArticleUrl(loc.textContent ?? '')
      if (article) articles.add(article)
    }

    // A urlset carrying no articles is treated as a failure, not as a blog
    // that has been emptied. Same reasoning as above: it must not be able to
    // overwrite the baseline.
    if (articles.size === 0) return null

    // Sorted so the stored record is stable regardless of sitemap ordering.
    return Array.from(articles).sort()
  } catch {
    return null // Network, CORS, abort/timeout, bad body — all the same answer.
  } finally {
    window.clearTimeout(timer)
  }
}

/**
 * Resolves what the badge should show.
 *
 * On a browser with no baseline this SEEDS one from whatever is published and
 * reports 0. A first-time reader is not shown a pile of twenty posts they have
 * never had the chance to read — the count only ever describes what appeared
 * after they arrived. The seed is written only on a successful fetch, so a
 * first visit during an outage stays a first visit rather than committing an
 * empty baseline and announcing the whole catalogue on the next load.
 */
export async function checkForNewBlogPosts(): Promise<BlogSnapshot> {
  const urls = await fetchArticleUrls()
  if (!urls) return { urls: null, newCount: 0 }

  const baseline = readBaseline()
  if (!baseline) {
    writeBaseline(urls)
    return { urls, newCount: 0 }
  }

  let newCount = 0
  for (const url of urls) if (!baseline.has(url)) newCount += 1
  return { urls, newCount }
}

/**
 * Marks everything currently published as seen.
 *
 * Opening the Blog acknowledges the whole list at once — this is a "something
 * is new over there" signal, not per-article read tracking, and nothing here
 * records which posts were opened or when.
 *
 * `null` is a no-op by design. It means the fetch failed or has not landed yet,
 * and writing an unknown list would either wipe the baseline or freeze it at a
 * stale one. Doing nothing leaves the count to be recalculated on the next
 * load, which is correct in both cases.
 */
export function acknowledgeBlogPosts(urls: string[] | null): void {
  if (!urls || urls.length === 0) return
  writeBaseline(urls)
}
