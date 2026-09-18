// Generates every favicon — .ico, PNGs and the SVG — from one source:
// scripts/assets/thinq-mark.svg.
//
// ── Ground: transparent in the tab, opaque on a home screen ────────────────
//
// The tab icons are the bare mark on transparency. Two problems followed from
// that, both now fixed, recorded so neither is reintroduced:
//
//   - The mark is a silver-to-white gradient. On a dark tab strip it reads
//     beautifully. On a LIGHT tab strip — the default in Chrome, Safari and
//     Firefox — only the #a0a0a5 and #b0b0b5 stops carried, so the ring read as
//     partial rather than solid.
//   - Safari composites favicon transparency onto WHITE rather than onto the
//     tab, so in Safari specifically the light-strip case above is the only
//     case: it is white ground there even in dark mode.
//
// This was previously an opaque #050505 tile for exactly those reasons. The
// plate around the mark was the more visible problem, so the ground went; the
// washout was then fixed the way the note here always said it should be — with
// a darker mark, not a plate behind it. See LIGHT_INK.
//
// ── Why there are two of every tab icon ────────────────────────────────────
//
// The first attempt at that gave the SVG an internal
// `@media (prefers-color-scheme: light)` rule and let it ink itself. It did not
// work: Chrome rasterises an SVG favicon in a context that reports the LIGHT
// scheme no matter what the system is set to, so the rule fired always and the
// mark was near-black in dark mode too — the icon looked black on a black tab
// strip. Firefox honours it; Chrome does not, and Chrome is most of the traffic.
//
// So the scheme is resolved OUTSIDE the file instead. Each icon is emitted
// twice — near-black for a light strip, the silver gradient for a dark one —
// and index.html gates the pair with `media` on the `<link rel="icon">`, which
// both engines do evaluate against the real system theme and re-evaluate when
// it changes. Neither file carries a media query of its own; a static file
// whose colour is chosen by the markup cannot be second-guessed by the renderer.
//
// The launcher icons stay OPAQUE #050505 (= `--color-bg` in src/index.css and
// the document's `theme-color`). iOS applies its own mask and composites
// transparency onto black, and Android launchers mask too, so a transparent
// icon there produces a black plate we did not choose instead of one we did.
//
// Run: npm run favicons
import sharp from 'sharp'
import { Buffer } from 'node:buffer'
import { readFile, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'

const PUBLIC = path.resolve(import.meta.dirname, '../public')

// The bare mark, at its drawn size on transparency. It lives OUTSIDE public/
// because it must never be served directly: it carries 1.85 units of dead space
// on every side of its viewBox, so a browser handed this file draws a mark two
// thirds the size of the one every other icon shows. The two public/*.svg are
// generated from it, cropped and scaled to match the PNGs.
const SOURCE = path.resolve(import.meta.dirname, 'assets/thinq-mark.svg')

/**
 * The official logo, and the source of truth for every RASTER icon.
 *
 * `thinq-mark.svg` above is the bare mark on transparency with a six-stop metal
 * ramp; this is the delivered brand file — 512x512, a full-bleed #000000 plate,
 * the mark drawn flat in #FDFDFD/#FCFCFC, and no gradient anywhere. Where the
 * two disagree the logo wins, and they do disagree slightly: the logo's ring
 * mid-radius is 5.47 against the mark's 5.8, and its outer dot sits at 20.47
 * rather than 21, both on the 24-unit grid.
 *
 * The split is deliberate rather than an oversight. The two public/*.svg keep
 * coming from the MARK, because those are what Chrome paints in a tab and they
 * answer `prefers-color-scheme` by being transparent and two-toned. The logo
 * carries its own plate, so it cannot do that — and it does not need to, because
 * the things it feeds (Google Search, Safari, iOS, Android, /favicon.ico) all
 * composite a raster onto a ground we do not choose.
 */
const LOGO_SOURCE = path.resolve(import.meta.dirname, 'assets/thinq-logo-512.svg')

/**
 * The one adjustment made to the official logo, and it is positioning only.
 *
 * Google Search draws favicons in a CIRCLE, and the logo as delivered does not
 * survive that crop: measured on the 512 canvas, the ring reaches 230.5px from
 * centre and the inner dot 156.4px — both inside the 256px inscribed circle —
 * but the outer dot reaches 281.0px and is sliced into a wedge. The mark loses
 * a third of its identity in every Google result.
 *
 * So the three mark elements are scaled and recentred AS A GROUP onto the
 * centre of their own minimum enclosing circle — 255.75px radius, sitting at
 * (273.77, 273.93) rather than at the canvas centre. The translate is derived
 * from the scale rather than fixed: `256 - centre x scale` on both axes, which
 * is what keeps the mark circle-centred at any scale instead of scaling about
 * the canvas origin and drifting.
 *
 * ── Why 0.90 and not tighter ───────────────────────────────────────────────
 *
 * Fitting the enclosing circle exactly to the crop leaves no air, and four
 * scales were rendered and measured at 96x96 before this one was chosen:
 *
 *   scale    clearance   ink fill   ring stroke @28px
 *   0.9697     1.33px      79.2%        2.47px
 *   0.92       4.02px      75.0%        2.35px
 *   0.90       4.84px      72.9%        2.30px   <- this one
 *   0.88       6.07px      70.8%        2.24px
 *
 * 0.9697 was the first fit and read as touching the border. 0.92 is the largest
 * that clears 4px, but only by 0.02px — no headroom once anti-aliasing rounds a
 * fraction differently at another size. 0.90 buys real margin for a quarter of
 * a pixel of ring at SERP size, which is not a visible trade.
 *
 * Being a uniform similarity transform, none of this alters the artwork: stroke
 * weight, both dot radii, their spacing and all colours come through unchanged.
 * The plate is NOT transformed — it stays full-bleed, which keeps the corners
 * black after the crop.
 */
const LOGO_FIT = { scale: 0.9, dx: 9.61, dy: 9.46 }

/** `--color-bg`. Must track src/index.css and the `theme-color` meta. */
const BRAND_GROUND = { r: 5, g: 5, b: 5, alpha: 1 }

/** No ground at all — the tab icons composite onto whatever the browser draws. */
const NO_GROUND = { r: 0, g: 0, b: 0, alpha: 0 }

/**
 * The mark's colour on a light tab strip.
 *
 * `--color-bg`, so the light-mode icon is the same near-black the site paints
 * itself, rather than a flat #000 that reads harsher than the brand.
 */
const LIGHT_INK = '#050505'

/**
 * favicon.ico is no longer dimmed, and the reason it once was is now moot.
 *
 * The .ico used to be packed from the bare mark on TRANSPARENCY, so one image
 * had to survive a dark tab strip, a light one and Safari's white at once.
 * Neither end of the palette managed it, and the compromise was to scale every
 * gradient stop to 0.62 — brushed metal turned down to a mid grey that measured
 * 6.01:1 on dark and 3.82:1 on light, and looked soft on both.
 *
 * The .ico is now packed from the official logo, which brings its own opaque
 * #000000 plate. There is no ground left to lose against, so the artwork ships
 * at full brightness: flat #FDFDFD on black, identical on every strip.
 */

/**
 * Repaints the mark a single flat colour.
 *
 * The mark is drawn with two `linearGradient`s referenced as `url(#r)` and
 * `url(#t)`. Swapping the references rather than editing the gradients keeps
 * one source of truth for the geometry: the shapes are untouched, only what
 * they are painted with changes.
 */
const inked = (svg, colour) => svg.toString().replace(/url\(#[rt]\)/g, colour)

/**
 * Fraction of the tile the mark occupies.
 *
 * Nearly all of it, and that took two corrections. The mark was drawn at 0.78
 * of the tile, but its own artwork carries padding too — the ring and both dots
 * occupy 1.85 to 22.25 inside a 0-24 viewBox — so the two margins compounded
 * and the ink ended up covering 12.5% of the icon inside a bounding box 66%
 * wide. At 16px on Safari's light tab strip that does not read as a logo, it
 * reads as a dark plate with something small floating in it, which is what a
 * reader described as a border around the icon.
 *
 * TIGHT_VIEWBOX crops the artwork's own padding first, so this figure is the
 * only margin that applies rather than the second of two.
 */
const MARK_SCALE = 0.92

/**
 * The mark's true content bounds inside its 0-24 viewBox.
 *
 * Ring: cx/cy 8.8, r 5.8, stroke 2.3 -> 1.85 to 15.75. Dots: 14.35 to 18.05 and
 * 19.75 to 22.25. So the content spans 1.85 to 22.25 on both axes, and the
 * viewBox has 1.85 units of dead space on every side. Rasterising the file as
 * drawn bakes that padding into every icon.
 */
const TIGHT_VIEWBOX = '1.85 1.85 20.4 20.4'

/**
 * PNG outputs. `ico` marks the sizes that also go into favicon.ico.
 *
 * The launcher icons keep the brand ground and stay square: iOS and Android
 * apply their own mask and their own composite, so an opaque square tile is
 * the input those platforms actually ask for. The tab icons have no ground —
 * see the note at the top of this file for what that costs on a light strip.
 */
/**
 * Rasters cut from the OFFICIAL LOGO.
 *
 * Everything that is handed to something which composites it onto a ground we
 * do not control: Google Search, Safari, iOS, Android, and /favicon.ico. They
 * all get the delivered brand file, plate included, at full brightness.
 *
 * 96 is here because Google asks for it. Its documented guidance is a square
 * raster "larger than 48x48px", and the largest this site declared was 32 — so
 * Google was upscaling a 32px source into a result card. It is in the .ico as
 * well, so the same pixels are reachable with or without the <link>.
 */
const LOGO_TARGETS = [
  { file: 'favicon-16x16.png', size: 16, ico: true },
  { file: 'favicon-32x32.png', size: 32, ico: true },
  { file: 'favicon-48x48.png', size: 48, ico: true },
  { file: 'favicon-96x96.png', size: 96, ico: true },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'android-chrome-192x192.png', size: 192 },
  { file: 'android-chrome-512x512.png', size: 512 },
]

/**
 * Rasters still cut from the MARK, and deliberately so.
 *
 * These are the dark-strip halves of the `media`-gated pairs in index.html.
 * Their light-strip partners are the unsuffixed files above, which now carry
 * the logo's own black plate and therefore need no inking — a plate reads on
 * either strip. Chrome takes the SVG and never fetches either of these
 * (measured: 18 runs, real Chrome, light and dark, only the SVG is requested),
 * so they exist for engines that ignore SVG favicons but do honour `media`.
 *
 * Left on the mark because this task was scoped to the raster icons Google and
 * friends consume; changing these would change a tab, which it was not.
 */
const MARK_TARGETS = [
  { file: 'favicon-16x16-dark.png', size: 16, ground: NO_GROUND },
  { file: 'favicon-32x32-dark.png', size: 32, ground: NO_GROUND },
  { file: 'favicon-48x48-dark.png', size: 48, ground: NO_GROUND },
]

/**
 * One tile: the mark, centred at MARK_SCALE, on the given ground.
 *
 * `ink` repaints the mark flat. A raster cannot answer `prefers-color-scheme` —
 * there is one file and the browser picks its own strip colour — so the tab
 * PNGs are painted for the light case rather than left to gamble. That is the
 * right constant because Safari, which is what actually draws these (Chrome and
 * Firefox take the SVG), composites favicon transparency onto WHITE regardless
 * of the system theme. Black-on-white reads in both of Safari's modes; the
 * silver gradient read in neither.
 *
 * The launcher icons pass no `ink` and keep the gradient: they sit on an opaque
 * #050505 plate, where a near-black mark would vanish.
 */
async function tile(svg, size, ground, ink) {
  const inner = Math.round(size * MARK_SCALE)
  // Rasterise from the SVG at the final size rather than downscaling one big
  // bitmap: at 16px the ring is barely two pixels thick and a resample turns it
  // to grey mush.
  const source = ink ? inked(svg, ink) : svg.toString()
  const cropped = Buffer.from(
    source.replace(/viewBox="[^"]*"/, `viewBox="${TIGHT_VIEWBOX}"`),
  )
  const mark = await sharp(cropped, { density: 384 })
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()

  return sharp({
    create: { width: size, height: size, channels: 4, background: ground },
  })
    .composite([{ input: mark, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toBuffer()
}


/**
 * Packs PNGs into an .ico.
 *
 * Written by hand because sharp cannot emit ICO and this needs no dependency:
 * the format is a 6-byte header, a 16-byte directory entry per image, then the
 * payloads. PNG payloads are valid in ICO and every browser that still asks for
 * favicon.ico understands them.
 */
function ico(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(images.length, 4)

  let offset = 6 + images.length * 16
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size >= 256 ? 0 : size, 0) // width, 0 means 256
    entry.writeUInt8(size >= 256 ? 0 : size, 1) // height
    entry.writeUInt8(0, 2) // palette size
    entry.writeUInt8(0, 3) // reserved
    entry.writeUInt16LE(1, 4) // colour planes
    entry.writeUInt16LE(32, 6) // bits per pixel
    entry.writeUInt32LE(data.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += data.length
    return entry
  })

  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)])
}

const svg = await readFile(SOURCE)

/**
 * The shipped SVG: the same composition as the raster tab icons, as a vector.
 *
 * Chrome and Firefox prefer `type="image/svg+xml"` when it is offered, so this
 * is what those two actually draw, and it has to match favicon-32x32.png
 * exactly or the icon changes identity between browsers. No ground rect: the
 * mark is scaled to MARK_SCALE inside a transparent 24x24 box, which is what
 * `tile()` now builds for 16/32/48.
 *
 * Emitted twice, statically inked, exactly like the raster pair — see the note
 * at the top of this file. This file used to carry its own
 * `@media (prefers-color-scheme: light)` rule and ink itself; Chrome rasterises
 * a favicon in a context that always reports the light scheme, so that rule
 * fired in dark mode too and the mark came out near-black on a black tab strip.
 * The scheme belongs in index.html's `media` attribute, where it is evaluated
 * against the real system theme.
 *
 * `ink` repaints the mark flat by swapping the two gradient references rather
 * than editing the gradients, so the geometry has one source of truth. Passing
 * no `ink` leaves the silver gradient — the dark-strip copy.
 */
function tileSvg(markSvg, ink) {
  const inner = (ink ? inked(markSvg, ink) : markSvg.toString())
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .trim()
  // Same two corrections as the rasters: crop to the artwork's own bounds, then
  // scale that to MARK_SCALE of the tile — so the vector and the PNGs agree.
  const [vx, vy, vw] = TIGHT_VIEWBOX.split(' ').map(Number)
  const scale = (MARK_SCALE * 24) / vw
  const pad = (24 - vw * scale) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="512" height="512">
  <g transform="translate(${(pad - vx * scale).toFixed(3)} ${(pad - vy * scale).toFixed(3)}) scale(${scale.toFixed(4)})">
${inner
  .split('\n')
  .map((line) => (line.trim() ? '    ' + line.trim() : line))
  .join('\n')}
  </g>
</svg>
`
}

/**
 * The official logo, positioned for the circular crop, rasterised once.
 *
 * ONE master render at 2048 feeds every size. Rasterising the vector separately
 * per size would let each one land on the pixel grid differently, and the .ico
 * entries would then not be the same image as the standalone PNGs — which is
 * exactly the thing that has to stay provable here.
 */
const logo = await readFile(LOGO_SOURCE)
const positioned = logo
  .toString()
  // The plate is the first <path>; the three mark elements follow it and are
  // the only things transformed.
  .replace(
    /(<path[^>]*fill="#000000"[^>]*transform="translate\(0,0\)"[^>]*\/>)/,
    `$1<g transform="translate(${LOGO_FIT.dx},${LOGO_FIT.dy}) scale(${LOGO_FIT.scale})">`,
  )
  .replace('</svg>', '</g></svg>')

const logoMaster = await sharp(Buffer.from(positioned), { density: 288 })
  .resize(2048, 2048)
  .png()
  .toBuffer()

/** One size off the master. Flattened: these grounds are never transparent. */
const logoTile = (size) =>
  sharp(logoMaster)
    .resize(size, size, { kernel: 'lanczos3' })
    .flatten({ background: '#000000' })
    .png({ compressionLevel: 9 })
    .toBuffer()

const forIco = []

for (const target of LOGO_TARGETS) {
  const data = await logoTile(target.size)
  await writeFile(path.join(PUBLIC, target.file), data)
  // The .ico entry is the SAME buffer the standalone PNG was written from, not
  // a second render of it. That is what makes "the .ico carries no different
  // logo" a fact about the bytes rather than a claim about the process.
  if (target.ico) forIco.push({ size: target.size, data })
  console.log(`favicons: ${target.file.padEnd(28)} ${String(data.length).padStart(6)} bytes  (official logo)`)
}

for (const target of MARK_TARGETS) {
  const data = await tile(svg, target.size, target.ground, target.ink)
  await writeFile(path.join(PUBLIC, target.file), data)
  console.log(`favicons: ${target.file.padEnd(28)} ${String(data.length).padStart(6)} bytes  (mark)`)
}

await writeFile(path.join(PUBLIC, 'favicon.ico'), ico(forIco))
console.log(`favicons: favicon.ico                  ${ico(forIco).length} bytes (16/32/48/96, official logo)`)

// The generator dumped its whole output directory into public/ as well. Every
// file in it is a byte-identical duplicate of one at the root, and public/ ships
// verbatim, so it was a second copy of the icon set on the CDN.
await rm(path.join(PUBLIC, 'favicon_io-2'), { recursive: true, force: true })

await writeFile(path.join(PUBLIC, 'favicon-light.svg'), tileSvg(svg, LIGHT_INK))
await writeFile(path.join(PUBLIC, 'favicon-dark.svg'), tileSvg(svg))
console.log(`favicons: favicon-light.svg            (vector, ${LIGHT_INK})`)
console.log('favicons: favicon-dark.svg             (vector, silver gradient)')

// The single self-inking SVG these two replace. It is still linked from any
// cached copy of the old index.html, so leaving it would serve a black mark in
// dark mode to exactly the readers whose cache is the reason they saw one.
await rm(path.join(PUBLIC, 'favicon.svg'), { force: true })
