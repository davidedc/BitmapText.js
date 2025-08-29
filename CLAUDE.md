  # Claude Development Guide for BitmapText.js

  **Documentation Navigation:**
  - **API Usage Examples** → See README.md
  - **System Architecture** → See ARCHITECTURE.md

  ## Quick Context

  You're working on BitmapText.js, a library that pre-renders fonts as bitmaps to achieve pixel-identical text rendering on Canvas. The key challenge it solves: browsers
  render text inconsistently with different anti-aliasing.

  ## Project Structure at a Glance

  - **Core runtime**: BitmapText.js, BitmapGlyphStore.js
  - **Generation tools**: *_Editor.js files
  - **Font data**: bitmap-fonts-data/
  - **Entry points**: font-builder.html (generation), text-render-tests.html (testing)

  ## Key Development Workflows

  ### Adding New Font Support
  1. Modify specs in specs-default.js for kerning rules
  2. Use font-builder.html to generate sheets
  3. Test with text-render-tests.html

  ### Debugging Rendering Issues
  - Check hash mismatches in HashStore
  - Use canvas-extensions.js debugging methods
  - Compare with browser's native rendering

  ### Performance Testing
  Look for timing.js calls throughout - they measure:
  - Glyph generation time
  - Sheet building time
  - Runtime rendering speed

  ## Common Pitfalls to Avoid

  1. **CORS Issues**: Always serve via HTTP server, not file://
  2. **Pixel Density**: Remember to scale coordinates by pixelDensity
  3. **Anti-aliasing**: Canvases must be attached to DOM before rendering for crisp text

  ## Testing
  
  See README.md for testing approach and instructions.

  ## Key Invariants

  1. Glyph positions must be integer values (pixel-aligned)
  2. Temporary canvases must be cleared between operations
  3. Kerning values are in 1/1000 em units

  ## Where to Find Things

  - **Kerning logic**: BitmapText.calculateAdvancement_CSS_Px:78
  - **Glyph rendering**: BitmapText.drawLetter:158
  - **Hash verification**: canvas-extensions.getHash:1
  - **Specs parsing**: SpecsParser.parseSubSpec:98

  ## Development Tips

  - The "kern king" test text contains challenging character pairs
  - Use drawCheckeredBackgrounds flag for transparency testing
  - Browser DevTools may show anti-aliased text - trust the hashes

  See README.md for API usage, ARCHITECTURE.md for system design.