# BitmapText.js

A zero-dependency JavaScript library that pre-renders fonts as bitmap atlases so HTML5 Canvas (browser) and `node-canvas`-style backends (Node) produce **pixel-identical, hash-verifiable** text across every browser and device.

The hard problem: each engine's text rasterizer (Skia, Core Text, etc.) anti-aliases differently, so `ctx.fillText` is *not* pixel-stable across machines. We bake glyph atlases offline and blit at runtime — same pixels everywhere.

## Stack

- Pure ES2017+ JavaScript. No runtime deps. Node ≥ 12.
- Browser bundle: `dist/bitmaptext.min.js` (~32 KB min, ~12 KB gz). Node bundle: `dist/bitmaptext-node.min.js`.
- Atlas formats on disk: authoring `.qoi` → delivery `.webp` → self-registering `.js` wrappers (so `file://` works).
- Metrics on disk: one `font-assets/metrics-bundle.js` (~1.1 MB) — base64 of a `deflate-raw` stream of JSON containing every (family, style, weight, size) record (density-agnostic). Decoded on first `loadFont` via `DecompressionStream` (browser, Node 18+) or `zlib.inflateRawSync` (Node ≤ 17). Replaced ~18 MB of per-file `metrics-density-*.js` files.
- Dev tooling: Playwright + Puppeteer for headless build/hash CI; Python `http.server` for local serving.

## Repo map

- `src/runtime/` — production runtime (static `BitmapText`, immutable domain objects, internal stores). Goes into every bundle.
- `src/builder/` — `*FAB.js` font-assets-builder classes. Extend runtime types; only loaded by the builder UI/automation.
- `src/platform/` — browser vs. Node `FontLoader{Browser,Node}.js` + `canvas-mock.js`; selected at bundle time.
- `src/specs/` + `font-sets/` — JSON font-set specifications (schema in `docs/FONT_SET_FORMAT.md`).
- `src/automation/`, `src/ui/` — browser-side orchestration for the builder/automation HTML pages.
- `src/node/` — Node demo entrypoints (also bundled into `examples/node/dist/`).
- `dist/` — checked-in browser + Node bundles. Rebuild via `npm run build`.
- `font-assets/` — generated atlas `.js` files (one per font/size/density variant) plus a single `metrics-bundle.js` holding every font's metrics. **Do not grep or enumerate** this directory; read individual atlas files by exact filename if needed. Metrics are not stored per-file — the bundle is the single source of truth.
- `lib/` — vendored third-party codecs (QOI, PNG, WebP, JSZip, FileSaver). Don't refactor.
- `public/` — browser-served HTML for the builder, demos, and `test-renderer.html` (hash verification page).
- `scripts/` — entire build/asset pipeline: font watch, optimize, qoi/png/webp conversion, bundling, hash gen/verify.
- `test/`, `perf/` — reference-hash database and perf harnesses.

## Universal invariants

1. **`BitmapText` is a static singleton.** Never instantiate it. The internal `AtlasDataStore` and `FontMetricsStore` are application-wide state; there is no per-instance variant.
2. **Glyph atlases are binary** — pixels are on or off. Anti-aliasing-related debugging heuristics do not apply. Enforced by `GlyphFAB.binarizeCanvas` (alpha ≥ 128 → opaque black, else fully transparent) which runs at the end of `renderCharacterToCanvas`. **Don't remove this step**: the platform Canvas text rasterizer (Skia / Core Text / Cairo) silently switches from binary to greyscale AA at physical pixel size ≥ 182 (see `docs/ARCHITECTURE.md` § *Glyph rasterization quirk*), so the FAB cannot trust `fillText` output to be on/off. Verify with `node scripts/check-atlas-binary.js`.
3. **9-physical-pixel rasterization floor.** Below ~9 phys-px the renderer falls back to placeholder rectangles; no atlas glyphs exist below that size.
4. **DPR is a hard partition.** Each app picks one `pixelDensity` at startup; assets, bundles, and in-memory stores never mix DPRs.
5. **Transforms are ignored.** `BitmapText.drawTextFromAtlas` resets the canvas matrix to identity (`src/runtime/BitmapText.js:697`); coordinates are absolute physical pixels. `ctx.translate(...)` before drawing has no effect — callers must compute absolute positions themselves.
6. **Position floats, draw integers.** Per-glyph position is accumulated as floats to avoid rounding drift; the final `drawImage` rounds to integers for crisp pixel-aligned output.
7. **Font assets self-register**: `metrics-bundle.js` calls `BitmapText.rBundle("<base64>")` (alias for `registerBundle`) once at load; the decoder populates `MetricsBundleStore` with density-agnostic records. Per-font atlas files call `BitmapText.a(...)` (alias for `registerAtlas`). Don't rename these aliases; the asset files depend on them. `FontMetricsStore.getFontMetrics(fontProperties)` lazily materialises a density-specific `FontMetrics` from the bundle on first lookup.
8. **Browser tests need real HTTP.** Asset loading breaks under `file://`; serve via `python -m http.server 8000` (or `npm run serve`).

## How to verify changes

There is no TS/lint/unit-test pipeline — verification is by running bundles and comparing rendered hashes against `test/data/reference-hashes.js`.

- **Build bundles**: `npm run build` (browser + Node, both minified). Single-target variants: `build-bundle`, `build-bundle-node`.
- **Node smoke (fast iteration)**: `npm run build-node-demos && npm run run-node-demos` — builds and runs all 6 Node demos, prints PASS/FAIL with hashes.
- **Full Node demo cycle**: `npm run demo` — clean rebuild + run (slow; only when you've touched the runtime + bundles together).
- **Browser smoke**: serve, then open `public/test-renderer.html`. Hashes should match the reference DB.
- **Headless hash verify (CI-style)**: `node scripts/verify-reference-hashes.js`. Details in `docs/PLAYWRIGHT_AUTOMATION.md`.

If the change touches glyph generation, atlas layout, or metrics, regenerate via `public/font-assets-builder.html` (interactive) or `scripts/automated-font-builder.js` (batch); pipeline details in `scripts/README.md`.

## Where to read more (only if relevant to the task)

- API surface, distribution options, full demo list, transform-behavior caveats → `README.md`
- Static-class rationale, FAB extension model, font-invariant auto-redirect, transform-reset design → `docs/ARCHITECTURE.md`
- JSON font-spec schema (for adding fonts/sizes/weights) → `docs/FONT_SET_FORMAT.md`
- Asset pipeline (qoi → png → webp → js, optimize, watch) and required Homebrew tools → `scripts/README.md`
- Playwright automation (builder, hashes, screenshots) → `docs/PLAYWRIGHT_AUTOMATION.md`
- Bundle layout and entry points → `dist/README.md`
- Performance harnesses, profiling workflow → `perf/README.md`, `perf/profiling/README.md`
