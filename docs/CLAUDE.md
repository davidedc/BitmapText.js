  # Claude Development Guide for BitmapText.js

  **Documentation Navigation:**
  - **API Usage Examples** → See README.md
  - **System Architecture** → See ARCHITECTURE.md

  ## Quick Context

  You're working on BitmapText.js, a library that pre-renders fonts as bitmaps to achieve pixel-identical text rendering on Canvas. The key challenge it solves: browsers
  render text inconsistently with different anti-aliasing.

  ## Project Structure at a Glance

  - **Core runtime**: src/core/BitmapText.js, src/core/BitmapGlyphStore.js
  - **Generation tools**: src/editor/*Editor.js files
  - **Font data**: data/
  - **Automation scripts**: scripts/ (watch-glyph-sheets.sh, optimize-images.sh, png-to-js-converter.js)
  - **Entry points**: public/font-builder.html (generation), public/test-renderer.html (testing)
  - **Examples**: examples/node/ (Node.js demos showing library usage outside browser)

  ## Key Development Workflows

  ### Adding New Font Support
  1. Modify specs in src/specs/default-specs.js for kerning rules
  2. Use public/font-builder.html to generate sheets
  3. Use automated pipeline: `./scripts/watch-glyph-sheets.sh` for processing
  4. Test with public/test-renderer.html

  ### Debugging Rendering Issues
  - Check hash mismatches in src/utils/HashStore
  - Use src/utils/canvas-extensions.js debugging methods
  - Compare with browser's native rendering

  ### Performance Testing
  Look for src/utils/timing.js calls throughout - they measure:
  - Glyph generation time
  - Sheet building time
  - Runtime rendering speed

  ## Common Pitfalls to Avoid

  1. **CORS Issues**: Always serve via HTTP server, not file://
  2. **Pixel Density**: Remember to scale coordinates by pixelDensity
  3. **Anti-aliasing**: Canvases must be attached to DOM before rendering for crisp text

  ## Testing
  
  See README.md for testing approach and instructions. Node.js example (examples/node/hello-world-node.js) demonstrates library functionality outside browser environment using QOI format and PNG export.

  ## Key Invariants

  1. Glyph positions must be integer values (pixel-aligned)
  2. Temporary canvases must be cleared between operations
  3. Kerning values are in 1/1000 em units

  ## Where to Find Things

  - **Kerning logic**: src/core/BitmapText.calculateAdvancement_CSS_Px:78
  - **Glyph rendering**: src/core/BitmapText.drawLetter:158
  - **Hash verification**: src/utils/canvas-extensions.getHash:1
  - **Specs parsing**: src/specs/SpecsParser.parseSubSpec:98

  ## Development Tips

  - The "kern king" test text contains challenging character pairs
  - Use drawCheckeredBackgrounds flag for transparency testing
  - Browser DevTools may show anti-aliased text - trust the hashes
  - QOI format: Browser exports QOI, pipeline auto-converts to PNG for processing
  - QOI conversion: Use `node scripts/qoi-to-png-converter.js [directory]` to manually convert QOI files
  - PNG to JS conversion: Use `node scripts/png-to-js-converter.js [directory]` for file:// protocol compatibility
  - Node.js demo build: Use `./scripts/build-node-demo.sh` to rebuild concatenated Node.js executable
  - Automated pipeline available: See `scripts/README.md` for complete automation guide
  - Use `--preserve-originals` flag to keep unoptimized PNGs for comparison during development
  - Use `--remove-qoi` flag to cleanup QOI files if disk space is limited

  See README.md for API usage, ARCHITECTURE.md for system design.