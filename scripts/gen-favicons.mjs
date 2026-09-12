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
 * How far favicon.ico's gradient is turned down. Ground stays transparent.
 *
 * The .ico is the fallback for every context that parses no HTML — a raw
 * /sitemap.xml, /robots.txt, legacy clients — so `media` on the <link> tags
 * never reaches it and ONE image has to survive every ground at once. Neither
 * end of the palette does, measured against the three that actually occur:
 *
 *   ink       Chrome dark strip   Chrome light strip   Safari white
 *   #050505          1.27:1              15.55:1          20.38:1
 *   #e4e4e7         12.69:1               1.03:1           1.27:1
 *
 * LIGHT_INK vanished on a dark strip — that is why /sitemap.xml showed a black
 * mark on black — and the silver gradient vanishes on a light one.
 *
 * Rather than ink the mark flat, every gradient STOP is scaled by this factor.
 * The gradient keeps its shape, so the mark still reads as brushed metal with
 * light running across it; only its range moves, from #a0a0a5..#ffffff down to
 * #636366..#9e9e9e. Measured at 0.62: 6.01:1 dark, 3.82:1 light, 5.01:1 white.
 *
 * Higher is brighter on a dark strip and worse on a light one — 0.74 drops the
 * light strip to 2.84:1, which is the point it stops being readable. Lower is
 * flatter and loses the metal. 0.62 is the widest margin on the worst ground.
 */
const ICO_DIM = 0.62

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
const TARGETS = [
  // Light strip: the mark inked near-black. These keep the unsuffixed names
  // because favicon.ico is packed from them, and the .ico is the unconditional
  // fallback for anything that ignores `media` — Safari included, whose ground
  // is white in both of its modes.
  { file: 'favicon-16x16.png', size: 16, ico: true, ground: NO_GROUND, ink: LIGHT_INK },
  { file: 'favicon-32x32.png', size: 32, ico: true, ground: NO_GROUND, ink: LIGHT_INK },
  { file: 'favicon-48x48.png', size: 48, ico: true, ground: NO_GROUND, ink: LIGHT_INK },
  // Dark strip: the mark's own silver-to-white gradient, which is what reads as
  // the white logo. No `ink`, so the artwork is rasterised as drawn.
  { file: 'favicon-16x16-dark.png', size: 16, ground: NO_GROUND },
  { file: 'favicon-32x32-dark.png', size: 32, ground: NO_GROUND },
  { file: 'favicon-48x48-dark.png', size: 48, ground: NO_GROUND },
  { file: 'apple-touch-icon.png', size: 180, ground: BRAND_GROUND },
  { file: 'android-chrome-192x192.png', size: 192, ground: BRAND_GROUND },
  { file: 'android-chrome-512x512.png', size: 512, ground: BRAND_GROUND },
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
 * The same artwork with every gradient stop scaled toward black.
 *
 * A sibling of `inked` above, and the reason it is not `inked` itself: inking
 * replaces the gradient references with one flat colour, which would throw away
 * the metal. This rewrites the stops instead, so the gradient survives with its
 * relative light and shade intact and only its overall range moves. See ICO_DIM.
 */
function dimmed(svg, factor) {
  return svg.toString().replace(/stop-color="#([0-9a-fA-F]{6})"/g, (_, hex) => {
    const channels = [0, 2, 4].map((i) =>
      Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * factor))),
    )
    return `stop-color="#${channels.map((v) => v.toString(16).padStart(2, '0')).join('')}"`
  })
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

const forIco = []

for (const target of TARGETS) {
  const data = await tile(svg, target.size, target.ground, target.ink)
  await writeFile(path.join(PUBLIC, target.file), data)
  // The .ico gets the dimmed gradient on the same transparent ground, so `data`
  // above — the PNG that ships and that index.html links for a light strip — is
  // written unchanged. Same `tile`, same scale; only the artwork differs.
  if (target.ico) {
    forIco.push({ size: target.size, data: await tile(dimmed(svg, ICO_DIM), target.size, NO_GROUND) })
  }
  console.log(`favicons: ${target.file.padEnd(28)} ${String(data.length).padStart(6)} bytes`)
}

await writeFile(path.join(PUBLIC, 'favicon.ico'), ico(forIco))
console.log(`favicons: favicon.ico                  ${ico(forIco).length} bytes (16/32/48)`)

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
