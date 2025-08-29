  # BitmapText.js

  A JavaScript library for rendering pixel-identical, consistent bitmap text on HTML5 Canvas across all browsers and devices.

  **Documentation Navigation:**
  - **System Architecture** → See ARCHITECTURE.md for detailed design information
  - **Development with Claude** → See CLAUDE.md for Claude-specific development guidance

  ## Problem Statement

  Browser text rendering on Canvas is inconsistent - different browsers apply anti-aliasing differently, making pixel-identical text rendering impossible with standard
  Canvas APIs. This library solves that by pre-rendering glyphs as bitmaps.

  ## Features

  - ✅ Pixel-identical text rendering across all browsers
  - ✅ Pre-rendered glyph sheets for consistent output
  - ✅ Advanced kerning with fine-grained control
  - ✅ Multiple pixel density support (retina displays)
  - ✅ Hash-based verification for consistency
  - ✅ Font builder tool for generating bitmap fonts
  - ✅ Minimal runtime dependencies

  ## Quick Start

  ### Using Pre-built Fonts

  ```javascript
  // Load the library and font data
  const bitmapGlyphStore = new BitmapGlyphStore();
  const bitmapText = new BitmapText(bitmapGlyphStore);

  // Load font data (from pre-generated sheets)
  // This happens automatically when you include the manifest

  // Render text
  const canvas = document.getElementById('myCanvas');
  const ctx = canvas.getContext('2d');

  const fontProperties = {
    fontSize: 18,
    fontFamily: "Arial",
    fontStyle: "normal",
    fontWeight: "normal",
    pixelDensity: window.devicePixelRatio || 1
  };

  // Measure text
  const metrics = bitmapText.measureText("Hello World", fontProperties);

  // Draw text at position (x, y)
  bitmapText.drawTextFromGlyphSheet(ctx, "Hello World", 10, 50, fontProperties, '#000000');
  ```

  Generating Your Own Bitmap Fonts

  1. Open font-builder.html in a web browser
  2. Select font family, style, weight, and size range
  3. Click "Download Glyph Sheets" to generate bitmap font data
  4. Include generated files in your project

  API Reference

  BitmapText Class

  Constructor

  new BitmapText(glyphStore)

  Methods

  measureText(text, fontProperties)
  - Returns TextMetrics-compatible object with width, bounding box info
  - Parameters:
    - text: String to measure
    - fontProperties: Object with fontSize, fontFamily, fontStyle, fontWeight, pixelDensity

  drawTextFromGlyphSheet(ctx, text, x, y, fontProperties, textColor)
  - Draws text using pre-rendered glyphs
  - Parameters:
    - ctx: Canvas 2D rendering context
    - text: String to render
    - x, y: Position in CSS pixels
    - fontProperties: Font configuration object
    - textColor: CSS color string (optional, default: 'black')

  BitmapGlyphStore Class

  Manages glyph sheets and metrics. Usually populated automatically from manifest.

  Constructor
  
  new BitmapGlyphStore()

  Methods

  getKerningTable(fontProperties)
  - Returns kerning table for the specified font properties
  - Parameters: fontProperties object with fontSize, fontFamily, fontStyle, fontWeight, pixelDensity

  setKerningTable(fontProperties, kerningTable)
  - Sets kerning table for the specified font properties
  - Parameters:
    - fontProperties: Font configuration object
    - kerningTable: Kerning data structure

  getGlyphSheet(fontProperties)
  - Returns glyph sheet canvas/image for the specified font properties
  - Parameters: fontProperties object

  setGlyphSheet(fontProperties, glyphSheet)
  - Sets glyph sheet for the specified font properties
  - Parameters:
    - fontProperties: Font configuration object
    - glyphSheet: Canvas or Image element

  getGlyphSheetMetrics(fontProperties, letter)
  - Returns metrics for a specific glyph including position in sheet and dimensions
  - Returns object with: xInGlyphSheet, tightWidth, tightHeight, dx, dy
  - Parameters:
    - fontProperties: Font configuration object
    - letter: Character to get metrics for

  setGlyphSheetMetrics(fontProperties, metrics)
  - Sets glyph sheet metrics for the specified font properties
  - Parameters:
    - fontProperties: Font configuration object
    - metrics: Metrics data structure

  getGlyphsTextMetrics(fontProperties, letter)
  - Returns TextMetrics-compatible object for a specific glyph
  - Parameters:
    - fontProperties: Font configuration object
    - letter: Character to get metrics for

  setGlyphsTextMetrics(fontProperties, metrics)
  - Sets text metrics for glyphs
  - Parameters:
    - fontProperties: Font configuration object
    - metrics: Text metrics data structure

  Build Instructions

  Development Setup

  # Clone repository
  git clone [repository-url]

  # Serve locally (required for CORS)
  python -m http.server
  # or
  npx http-server

  # Open in browser
  http://localhost:8000/font-builder.html

  Building Font Data

  1. Configure specs in specs-default.js or via UI
  2. Use Font Builder to generate glyph sheets
  3. Compressed data saved to bitmap-fonts-data/

  Testing

  Open text-render-tests.html to run visual tests and hash verification.

  Tests verify:
  - Pixel-identical rendering consistency
  - Kerning accuracy
  - Multi-line text layout
  - Cross-browser compatibility

  ## Troubleshooting

  **CORS Issues**
  - Always serve files via HTTP server, not file:// protocol
  - Use `python -m http.server` or `npx http-server` for local development
  - Required for loading PNG glyph sheets and calculating hashes

  **Rendering Issues**
  - Ensure canvases are attached to DOM before rendering for crisp text
  - Check pixel density scaling is applied correctly
  - Verify font data is loaded before attempting to render

  **Performance Issues**
  - Pre-load glyph sheets during initialization
  - Reuse BitmapText instances rather than creating new ones
  - Consider caching frequently used text measurements

  ## Browser Support

  Works on all modern browsers supporting Canvas API:
  - Chrome/Edge 90+
  - Firefox 88+
  - Safari 14+
  - Mobile browsers

  ## Architecture

  See ARCHITECTURE.md for detailed system design information.

  ## License

  See LICENSE file.