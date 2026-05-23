# font-assets/

Pre-rendered bitmap-font assets that the BitmapText runtime loads. The
files are content-addressed by font properties — a filename uniquely
identifies what it contains.

The asset bytes are NOT committed to the BitmapText.js repo (full set is
~800 MB; minimum set ~72 MB). They're published as releases on the
project. Only this README and a `.gitkeep` are tracked, so the directory
exists after a fresh clone.

## File layout

**Bundles** (single files, cover all fonts):

- `metrics-bundle.js` — per-glyph metrics (advances, bounding boxes,
  kerning) for every font. Deflate-raw + base64. Density-agnostic.
- `positioning-bundle-density-{N}.js` — pre-computed per-glyph
  positioning records for density N. One file per density (currently
  `1`, `2`). Required at runtime — atlas loads fail without the matching
  positioning bundle.

**Atlases** (one per font + density + size):

- `atlas-{idString}-qoi.js` — Node-loadable QOI wrapper (self-registers
  via `BitmapText.a(...)`). Used by Node and by `file://` browsers.
- `atlas-{idString}-webp.js` — browser `<script>`-loadable WebP wrapper.
  Used by HTTP-served browsers.
- `atlas-{idString}.qoi` / `.webp` — raw source files for the wrappers
  above; not loaded directly by the runtime.

## idString format

```
density-{D}-{Dfrac}-{family}-style-{normal|italic|oblique}-weight-{normal|bold|N}-size-{S}-{Sfrac}
```

Density and size use a dash instead of a decimal point: `1` → `1-0`,
`1.5` → `1-5`. Examples:

- `density-1-0-Arial-style-normal-weight-normal-size-16-0`
- `density-2-0-Courier New-style-italic-weight-bold-size-18-5`

Reverse-engineered from a filename, an embedder knows exactly which
font's data it holds.

## How a glyph loads

1. Embedder calls `BitmapText.loadFont(idString)` (or `loadFonts([...])`).
2. Runtime reads `atlas-{idString}-qoi.js` (Node) or `atlas-{idString}-webp.js`
   (browser). The file self-registers via `BitmapText.a(...)` with its
   base64-encoded image payload.
3. Runtime resolves metrics from `metrics-bundle.js` and positioning
   from the matching `positioning-bundle-density-{N}.js` (both lazily
   decoded on first lookup).
4. Each `drawTextFromAtlas` call blits via
   `ctx.drawImage(atlas, srcRect, dstRect)` — one drawImage per glyph
   for black text, batched through a scratch canvas for colored text.

## Where these files come from

Published as releases on the BitmapText.js project:
https://github.com/davidedc/BitmapText.js/releases

Each release ships two assets:

- `font-assets-min.zip` — full set (~60 MB compressed). Requires a
  local rebuild step to derive QOI atlases + JS wrappers from the
  shipped WebP sources.
- `font-assets-smoke-set.zip` — 3-font fixture for embedder Node-side
  tests (~10 KB; self-describing via included `smoke-set.json`).

For BitmapText maintainers: the download / rebuild / publish workflow
is documented in `scripts/README.md` § 9 of the BitmapText.js repo.
Embedders that vendor BitmapText typically only need the smoke-set
fixture and ignore the full set entirely.
