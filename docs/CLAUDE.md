  # Claude Development Guide for BitmapText.js

  **Documentation Navigation:**
  - **API Usage Examples** → See README.md
  - **System Architecture** → See ARCHITECTURE.md

  ## Quick Context

  You're working on BitmapText.js, a library that pre-renders fonts as bitmaps to achieve pixel-identical text rendering on Canvas. The key challenge it solves: browsers
  render text inconsistently with different anti-aliasing.

  ## Project Structure at a Glance

  - **Core runtime**: src/core/BitmapText.js, src/core/AtlasDataStore.js, src/core/FontMetricsStore.js, src/core/FontProperties.js
  - **Font assets building tools**: src/font-assets-builder-FAB/*FAB.js files (includes FontPropertiesFAB.js)
  - **Font utilities**: src/core/FontLoader.js, src/core/FontLoaderConfig.js
  - **Font data**: font-assets/
  - **Automation scripts**: scripts/ (watch-font-assets.sh, optimize-images.sh, png-to-js-converter.js)
  - **Entry points**: public/font-assets-builder.html (font assets building), public/test-renderer.html (testing)
  - **Examples**: examples/node/dist/ (Built Node.js demo bundles), src/node/ (demo source code)

  ## Key Development Workflows

  ### Adding New Font Support
  1. Modify specs in src/specs/default-specs.js for kerning rules
  2. Use public/font-assets-builder.html to generate atlases
  3. Use automated pipeline: `./scripts/watch-font-assets.sh` for processing
  4. Test with public/test-renderer.html

  ### Debugging Rendering Issues
  - Check hash mismatches in src/utils/HashStore
  - Use src/utils/canvas-extensions.js debugging methods
  - Compare with browser's native rendering
  - Black rectangles indicate placeholder mode (metrics loaded but missing atlases)

  ### Performance Testing
  Look for src/utils/timing.js calls throughout - they measure:
  - Font assets building time
  - Atlas building time
  - Runtime rendering speed

  ## Common Pitfalls to Avoid

  1. **CORS Issues**: Always serve via HTTP server, not file://
  2. **Pixel Density**: Remember to scale coordinates by pixelDensity
  3. **Anti-aliasing**: Canvases must be attached to DOM before rendering for crisp text

  ## Testing
  
  See README.md for testing approach and instructions. Node.js example (examples/node/dist/hello-world.bundle.js) demonstrates library functionality outside browser environment using QOI format and PNG export.

  ## Key Invariants

  1. Glyph positions must be integer values (pixel-aligned)
  2. Temporary canvases must be cleared between operations
  3. Kerning values are in 1/1000 em units

  ## Where to Find Things

  - **Font configuration**: src/core/FontProperties.js (immutable font config class)
  - **Text rendering configuration**: src/core/TextProperties.js (immutable text config class - kerning, color, alignment)
  - **Font assets building utilities**: src/font-assets-builder-FAB/FontPropertiesFAB.js (extends FontProperties)
  - **Atlas image management**: src/core/AtlasImage.js (immutable atlas image domain object)
  - **Atlas image building**: src/font-assets-builder-FAB/AtlasImageFAB.js (extends AtlasImage with building capabilities)
  - **Atlas positioning data**: src/core/AtlasPositioning.js (immutable positioning domain object)
  - **Atlas data combination**: src/core/AtlasData.js (combines AtlasImage + AtlasPositioning)
  - **Kerning logic**: src/core/BitmapText.calculateAdvancement_CSS_Px:78
  - **Glyph rendering**: src/core/BitmapText.drawLetter:158
  - **Placeholder rectangles**: src/core/BitmapText.drawPlaceholderRectangle:1
  - **Atlas validation**: src/core/AtlasDataStore.isValidAtlas:1
  - **Font loading utilities**: src/core/FontLoader.js
  - **Loading configuration**: src/core/FontLoaderConfig.js
  - **Font registry management**: src/core/FontManifest.js (replaces global bitmapTextManifest)
  - **Hash verification**: src/utils/canvas-extensions.getHash:1
  - **Specs parsing**: src/specs/SpecsParser.parseSubSpec:98

  ## Development Tips

  - The "kern king" test text contains challenging character pairs
  - Use drawCheckeredBackgrounds flag for transparency testing
  - Browser DevTools may show anti-aliased text - trust the hashes
  - QOI format: Browser exports QOI, pipeline auto-converts to PNG for processing
  - QOI conversion: Use `node scripts/qoi-to-png-converter.js [directory]` to manually convert QOI files
  - Image to JS conversion: Use `node scripts/image-to-js-converter.js [directory] --all` to generate JS files from PNG and QOI images for file:// protocol compatibility
  - Node.js demo build: Use `./scripts/build-node-demo.sh` or `./run-node-demos.sh` (includes font asset setup)
  - Automated pipeline available: See `scripts/README.md` for complete automation guide
  - Use `--preserve-originals` flag to keep unoptimized PNGs for comparison during development
  - Use `--remove-qoi` flag to cleanup QOI files if disk space is limited
  - QOI memory analysis: Use `npm run qoi-memory` or `node scripts/qoi-memory-calculator.js [directory]` to analyze uncompressed memory usage of bitmap fonts

  See README.md for API usage, ARCHITECTURE.md for system design.