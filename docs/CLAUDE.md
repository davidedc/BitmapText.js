  # Claude Development Guide for BitmapText.js

  **Documentation Navigation:**
  - **API Usage Examples** → See README.md
  - **System Architecture** → See ARCHITECTURE.md
  - **Script Automation** → See scripts/README.md

  ## Quick Context

  You're working on BitmapText.js, a library that pre-renders fonts as bitmaps to achieve pixel-identical text rendering on Canvas. The key challenge it solves: browsers
  render text inconsistently with different anti-aliasing.

  ## Project Structure at a Glance

  - **Static runtime**: src/runtime/BitmapText.js (static class with zero-config API, delegates to stores)
  - **Store classes**: src/runtime/AtlasDataStore.js, src/runtime/FontMetricsStore.js (single source of truth for storage, used by BitmapText and FAB)
  - **Platform-specific loaders**: src/platform/FontLoader-browser.js, src/platform/FontLoader-node.js (unified class name, selected at build time)
  - **Configuration classes**: src/runtime/FontProperties.js, src/runtime/TextProperties.js
  - **Font assets building tools**: src/builder/*FAB.js files (extend runtime classes with building capabilities)
  - **Font data**: font-assets/ (self-registering files that call BitmapText.registerMetrics/Atlas → delegates to stores)
  - **Automation scripts**: scripts/ (watch-font-assets.sh, optimize-images.sh, image-to-js-converter.js)
  - **Entry points**: public/font-assets-builder.html (font assets building), public/test-renderer.html (testing)
  - **Examples**: examples/node/dist/ (Built Node.js demo bundles), src/node/ (demo source code)

  ## Key Development Workflows

  ### Adding New Font Support
  1. Modify specs in src/specs/default-specs.js for kerning rules
  2. Use public/font-assets-builder.html to generate atlases
  3. Use automated pipeline: `./scripts/watch-font-assets.sh` for processing
  4. Test with public/test-renderer.html

  ### Testing Minification Strategies
  1. Generate full metrics with font-assets-builder.html (enable "Include non-minified metrics files" checkbox)
  2. Modify src/builder/MetricsMinifier.js with new strategy
  3. Rebuild tool: `./scripts/build-metrics-minifier.sh`
  4. Test: `./tools/minify-metrics.js` (performs automatic roundtrip verification)
  5. See scripts/README.md for detailed workflow

  ### Debugging Rendering Issues
  - Check hash mismatches in src/utils/HashStore
  - Use src/utils/canvas-extensions.js debugging methods
  - Compare with browser's native rendering
  - Black rectangles indicate placeholder mode (metrics loaded but missing atlases)
  - Browser console: Check for BitmapText registration calls when loading font assets
  - Node.js: Verify BitmapText.configure() called before loading fonts

  ### Performance Testing
  Look for src/utils/timing.js calls throughout - they measure:
  - Font assets building time
  - Atlas building time
  - Runtime rendering speed

  ## Common Pitfalls to Avoid

  1. **CORS Issues**: Always serve via HTTP server, not file://
  2. **Pixel Density**: Remember to scale coordinates by pixelDensity
  3. **Anti-aliasing**: Canvases must be attached to DOM before rendering for crisp text
  4. **StatusCode Loading**: In browser script tags, StatusCode.js MUST load before BitmapText.js (dependency requirement)
  5. **Transform Behavior**: BitmapText IGNORES all canvas transforms - coordinates are ABSOLUTE from canvas origin (see README.md "Transform Behavior - CRITICAL")

  ## Testing

  See README.md for testing approach and instructions.

  ## Key Invariants

  1. Position tracking uses floats (avoids rounding error accumulation), but final draw coordinates are integers (crisp, pixel-aligned rendering)
  2. Temporary canvases must be cleared between operations
  3. Kerning values are in 1/1000 em units

  ## Where to Find Things

  - **Static runtime API**: src/runtime/BitmapText.js (static class - all methods, internal stores)
  - **Font configuration**: src/runtime/FontProperties.js (immutable font config class)
  - **Text rendering configuration**: src/runtime/TextProperties.js (immutable text config class - kerning, color, baseline, alignment)
  - **Font assets building utilities**: src/builder/FontPropertiesFAB.js (extends FontProperties)
  - **Atlas image management**: src/runtime/AtlasImage.js (immutable atlas image domain object)
  - **Atlas image building**: src/builder/AtlasImageFAB.js (extends AtlasImage with building capabilities)
  - **Atlas positioning data**: src/runtime/AtlasPositioning.js (immutable positioning domain object)
  - **Atlas positioning building**: src/builder/AtlasPositioningFAB.js (extends AtlasPositioning with building capabilities)
  - **Atlas data combination**: src/runtime/AtlasData.js (combines AtlasImage + AtlasPositioning)
  - **Atlas store**: src/runtime/AtlasDataStore.js (single source of truth for atlas storage, used by BitmapText via delegation and by FAB)
  - **Metrics store**: src/runtime/FontMetricsStore.js (single source of truth for metrics storage, used by BitmapText via delegation and by FAB)
  - **Platform-specific font loading**: src/platform/FontLoader-browser.js (browser), src/platform/FontLoader-node.js (Node.js) - unified class name, selected at build time
  - **Font loading base class**: src/runtime/FontLoaderBase.js (shared logic for both platforms, stores data directly in AtlasDataStore/FontMetricsStore)
  - **Atlas reconstruction utilities**: src/builder/AtlasReconstructionUtils.js (image data extraction for TightAtlasReconstructor)
  - **Atlas building**: src/builder/AtlasBuilder.js (builds Atlas format with variable-width cells - used in export)
  - **Tight atlas reconstruction**: src/runtime/TightAtlasReconstructor.js (runtime class - reconstructs tight atlases from Atlas format via pixel scanning)
  - **Character set constant**: src/runtime/CHARACTER_SET.js (204 characters - ASCII, CP-1252 subset, Latin-1 Supplement; used by both build-time and runtime)
  - **Glyph creation utilities**: src/builder/create-glyphs.js (creates glyphs for all characters in character set)
  - **Glyph rendering**: src/builder/GlyphFAB.js (6-step pipeline: canvas setup, measurement, corrections, dimensions, rendering, preservation)
  - **Kerning calculation**: src/builder/KerningCalculator.js (service class for kerning table generation and pair calculations)
  - **Font loading API**: src/runtime/BitmapText.js (static methods: loadFont, loadFonts - delegates to platform-specific FontLoader; registerMetrics, registerAtlas - delegates to stores)
  - **Font registry management**: src/runtime/FontManifest.js (replaces global bitmapTextManifest)
  - **Hash verification**: src/utils/canvas-extensions.js (getHash method for canvas pixel hash), src/runtime/AtlasPositioning.js (getHash method for positioning data hash)
  - **Specs parsing**: src/specs/SpecsParser.js:104 (parseSubSpec method)
  - **Atlas generation & reconstruction**: public/font-assets-builder.html (displays Atlas source and reconstructed tight atlas side-by-side)

  ## Development Tips

  - The "kern king" test text contains challenging character pairs (see "Kern King Part 1" and "Kern King Part 2" in font-assets-builder.html)
  - Use drawCheckeredBackgrounds flag for transparency testing
  - Browser DevTools may show anti-aliased text - trust the hashes
  - Image formats: Browser exports QOI, pipeline converts QOI → PNG → WebP for browser delivery
  - QOI to PNG conversion: Use `node scripts/qoi-to-png-converter.js [directory]` to manually convert QOI→PNG (intermediate step)
  - PNG to WebP conversion: Use `./scripts/convert-png-to-webp.sh [directory]` to convert PNG→WebP (deletes source PNGs)
  - Image to JS conversion: Use `node scripts/image-to-js-converter.js [directory] --all` to generate JS files from WebP and QOI images for file:// protocol compatibility
  - WebP benefits: Lossless compression, 5-10% smaller than PNG, Safari 14+ required
  - Automated pipeline available: See `scripts/README.md` for complete automation guide
  - Use `--preserve-originals` flag to keep unoptimized PNGs for comparison during development
  - Use `--remove-qoi` flag to cleanup QOI files if disk space is limited
  - Test baseline and alignment: public/baseline-alignment-demo.html shows all combinations side-by-side
  - Automated image pipeline: See scripts/README.md for QOI/PNG/WebP conversion workflow and command details
  - Node.js demos: See README.md for build and run instructions
  - QOI memory analysis: Use `npm run qoi-memory` to analyze uncompressed memory usage of bitmap fonts

  See README.md for API usage, ARCHITECTURE.md for system design.