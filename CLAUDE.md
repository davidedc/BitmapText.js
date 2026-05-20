# BitmapText.js

A zero-dependency JavaScript library that pre-renders fonts as bitmap atlases so HTML5 Canvas (browser) and `node-canvas`-style backends (Node) produce **pixel-identical, hash-verifiable** text across every browser and device.

The hard problem: each engine's text rasterizer (Skia, Core Text, etc.) anti-aliases differently, so `ctx.fillText` is *not* pixel-stable across machines. We bake glyph atlases offline and blit at runtime — same pixels everywhere.

## Stack

- Pure ES2017+ JavaScript. No runtime deps. Node ≥ 12.
- Two runtime bundles checked into `dist/`: `bitmaptext.min.js` (browser) and `bitmaptext-node.min.js` (Node). Rebuild via `npm run build`. Current sizes in `dist/README.md`.
- Atlas formats on disk: authoring `.qoi` → delivery `.webp` → self-registering `.js` wrappers (so `file://` works).
- One `font-assets/metrics-bundle.js` (~1.1 MB) carries every font's metrics — density-agnostic, deflate-raw + base64. Decoded on first `loadFont` via `DecompressionStream` (browser, Node ≥ 18) or `zlib.inflateRawSync` (Node ≤ 17). Replaced ~18 MB of per-file `metrics-density-*.js` files.
- Dev tooling: Playwright + Puppeteer for headless build/hash CI; Python `http.server` for local serving.
- Embedder integration surface: `BitmapText.configure({fontDirectory, canvasFactory, fontLoader, atlasFormat})` plus the symmetric setters (`setFontDirectory`, `setCanvasFactory`, `setFontLoader`, `setAtlasFormat`). Used by embedders (e.g. SWCanvas) and workers; standalone users never need to touch them — the platform loader self-registers automatically.

## Repo map

- `src/runtime/` — production runtime (static `BitmapText`, immutable domain objects, internal stores). Ships in every bundle.
- `src/builder/` — `*FAB.js` font-assets-builder classes. Extend runtime types with mutability. Builder-only EXCEPT `MetricsExpander.js`, which also ships in the runtime bundle. The canonical list of files in the runtime bundle is `COMMON_FILES` in `scripts/build-runtime-bundle.sh` — consult it before claiming a file is or isn't in the runtime.
- `src/platform/` — browser vs. Node `FontLoader*.js` (declaring `BitmapTextFontLoaderBrowser` / `BitmapTextFontLoaderNode` respectively) + `canvas-mock.js`; chosen at bundle time. Each platform file self-registers via `BitmapText.setFontLoader(...)` in a footer that runs only when the environment matches (`typeof document !== 'undefined'` for Browser; `typeof document === 'undefined' && typeof require === 'function'` for Node). Workers fall through to neither — embedders in workers must call `setFontLoader` explicitly.
- `src/specs/` + `font-sets/` — JSON font-set specifications (schema in `docs/FONT_SET_FORMAT.md`).
- `src/automation/`, `src/ui/`, `src/node/` — browser-side builder/automation orchestration, builder UI, Node demo entrypoints.
- `dist/` — checked-in browser + Node bundles.
- `font-assets/` — generated atlas `.js` files (one per font/size/density) plus the single `metrics-bundle.js`. **Don't grep or enumerate this directory.** Read individual atlases by exact filename only. Metrics are not stored per-file — the bundle is the single source of truth.
- `lib/` — vendored third-party codecs (QOI, PNG, WebP, JSZip, FileSaver). **Don't refactor.**
- `public/` — browser-served HTML for the builder, demos, and `test-renderer.html` (hash verification page).
- `src/utils/` — utilities NOT in the runtime bundle. Only `AtlasCellDimensions.js` ships in the bundle (it's listed in `COMMON_FILES`); the rest are importable embedder utilities exposed via `package.json:exports` (`./utils/*` wildcard). Includes `AtlasLRU.js`, the bounded-size atlas-cache wrapper the LRU demo uses — embedders/apps wanting a similar cache should import that, not re-implement.
- `scripts/` — build/asset pipeline. `scripts/common.sh` is the shared bash helper library (`verify_files`, `section`, `$PROJECT_ROOT`, …); source it from new scripts instead of redefining helpers.
- `test/`, `perf/` — reference-hash DB and perf harnesses.

## Universal invariants

1. **`BitmapText` is a static singleton.** Never instantiate it. The internal stores (`AtlasDataStore`, `FontMetricsStore`, `MetricsBundleStore`, `PositioningBundleStore`) are application-wide state; there is no per-instance variant.
2. **Glyph atlases are binary** — pixels are on or off. AA-related debugging heuristics do not apply. Enforced by `GlyphFAB.binarizeCanvas` (alpha ≥ 128 → opaque black, else fully transparent) at the end of `renderCharacterToCanvas`. **Don't remove this step**: the platform Canvas text rasterizer (Skia / Core Text / Cairo) silently switches from binary to greyscale AA at physical pixel size ≥ 182 (see `docs/ARCHITECTURE.md` § *Glyph rasterization quirk*), so the FAB cannot trust `fillText` output to be on/off. Verify with `node scripts/check-atlas-binary.js`.
3. **9-physical-pixel rasterization floor.** Below ~9 phys-px the renderer falls back to placeholder rectangles; no atlas glyphs exist below that size.
4. **DPR is a hard partition.** Each app picks one `pixelDensity` at startup; assets, bundles, and in-memory stores never mix DPRs.
5. **Transforms are ignored.** `BitmapText.drawTextFromAtlas` resets the canvas matrix to identity (`src/runtime/BitmapText.js:541`); coordinates are absolute physical pixels. `ctx.translate(...)` before drawing has no effect — callers must compute absolute positions themselves.
6. **Position floats, draw integers.** Per-glyph position is accumulated as float to avoid rounding drift; the final `drawImage` rounds to integer for crisp pixel-aligned output.
7. **Font assets self-register.** `metrics-bundle.js` calls `BitmapText.rBundle("<base64>")` once at load (alias for `registerBundle`); per-font atlas `.js` files call `BitmapText.a(...)` (alias for `registerAtlas`); positioning bundles call `BitmapText.pBundle(...)` (alias for `registerPositioningBundle`). **Never rename these aliases** — the generated `font-assets/*.js` files depend on them. `FontMetricsStore.getFontMetrics(fontProperties)` lazily materialises a density-specific `FontMetrics` from the bundle on first lookup.
8. **Browser tests need real HTTP.** Asset loading breaks under `file://`; serve via `python -m http.server 8000` (or `npm run serve`).

## Hot path

The per-glyph loops inside `BitmapText.drawTextFromAtlas`, `BitmapText.measureText`, and `BitmapText.#drawColoredTextBatched` are the dominant runtime cost. When editing them:

- Keep call sites **monomorphic** (same hidden class for receiver + args).
- **No allocations in the inner loop** — no `new`, no object literals, no closures, no string concat. The only allowed allocation is the boxed `Math.round` result, which V8 keeps unboxed.
- **Hoist invariants**: per-render-constant checks (text color, alignment, `isInterpolatedMetrics`, hasInvariantFont, `_isValidAtlas`) belong outside the loop. Look at the existing prologue around `BitmapText.js:540-606` for examples.
- **Don't crack the 200-line bodies into a pipeline of named helpers.** They are intentionally long; they inline as one unit. Lifting shared SETUP into a prologue is fine; splitting the body is not.
- Per-glyph placement reads from a single flat object: `atlasPositioning._placements[char]` returns `{xInAtlas, yInAtlas, tightWidth, tightHeight, dx, dy}`. **Don't reintroduce parallel char-keyed dicts** — that's what was collapsed in prior refactors.
- **`Object` beats `Map`** for fixed-shape char-keyed dicts in this codebase; don't substitute.
- Atlas storage format (`'imageElement'` vs `'imageData'`) is set once at startup via `BitmapText.setAtlasFormat(...)` and never per-glyph. Each deployed app sees one stable shape in `atlasImage.image`; V8 hidden-class stability holds per deploy. Setting the format after `loadFont` is undefined behaviour — see JSDoc on `setAtlasFormat`.

Anything that conflicts with these rules is a perf regression even if it reads cleaner.

## How to verify changes

There is no TS/lint/unit-test pipeline. Verification is by running bundles and comparing rendered hashes.

- **Build bundles**: `npm run build` (browser + Node, both minified). Single targets: `build-bundle`, `build-bundle-node`.
- **Node smoke (fast iteration)**: `npm run build-node-demos && npm run run-node-demos` — builds and runs 6 Node demos, prints PASS/FAIL with hashes.
- **Full Node demo cycle**: `npm run demo` — clean rebuild + run (slow; use only when you've touched the runtime + bundles together).
- **Browser smoke**: serve, then open `public/test-renderer.html`. Hashes should match the reference DB.

### Three gates for refactors (cheap, fast, authoritative)

The reference-hash DB at `test/data/reference-hashes.js` is usually stale — `scripts/verify-reference-hashes.js` typically reports hundreds of mismatches unrelated to the change under review and is **not** useful as a sanity gate. Use these instead:

- **Gate 1** — non-runtime refactors must keep bundles byte-identical:
  `shasum -a 256 dist/bitmaptext.min.js dist/bitmaptext-node.min.js`
  If the hash changes after a builder/automation/scripts-only refactor, something leaked into the runtime — STOP and investigate.
- **Gate 2** — any change must keep Node demo PNGs byte-identical. After running `npm run run-node-demos`:
  `shasum -a 256 *.png | sort`
  Three distinct hashes (one per demo; bundled and standalone variants agree). This is the project's de-facto rendering signature.
- **Gate 3** — builder/automation refactors must keep zip entries byte-identical:
  ```
  node scripts/automated-font-builder.js --spec=font-sets/test-font-spec.json --output /tmp/foo
  cd /tmp/foo && unzip -q fontAssets.zip -d extracted
  find extracted -type f -exec shasum -a 256 {} \; | sort
  ```
  The outer `fontAssets.zip` SHA varies run-to-run (timestamps); the entries inside do not.

If a change touches glyph generation, atlas layout, or metrics, regenerate via `public/font-assets-builder.html` (interactive) or `scripts/automated-font-builder.js` (batch); pipeline details in `scripts/README.md`.

## Where to read more (only if relevant to the task)

- API surface, distribution options, full demo list, transform-behavior caveats → `README.md`
- Static-class rationale, FAB extension model, font-invariant auto-redirect, transform-reset design → `docs/ARCHITECTURE.md`
- JSON font-spec schema (for adding fonts/sizes/weights) → `docs/FONT_SET_FORMAT.md`
- Asset pipeline (qoi → png → webp → js, optimize, watch) and required Homebrew tools → `scripts/README.md`
- Playwright automation (builder, hashes, screenshots) → `docs/PLAYWRIGHT_AUTOMATION.md`
- Bundle layout and entry points → `dist/README.md`
- Performance harnesses, profiling workflow → `perf/README.md`, `perf/profiling/README.md`
