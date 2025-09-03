  # BitmapText.js

  A JavaScript library for rendering pixel-identical, consistent bitmap text on HTML5 Canvas across all browsers and devices.

  **Documentation Navigation:**
  - **System Architecture** → See docs/ARCHITECTURE.md for detailed design information
  - **Development with Claude** → See docs/CLAUDE.md for Claude-specific development guidance

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
  - ✅ Placeholder rectangle rendering when glyphs not loaded (to support dynamic loading)
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

  ## Generating Your Own Bitmap Fonts

  ### Automated Pipeline (Recommended)
  ```bash
  npm run watch-fonts
  # or
  ./scripts/watch-glyph-sheets.sh
  ```
  Then use the font-builder.html - files will be processed automatically!

  ### Manual Process
  1. Open public/font-builder.html in a web browser
  2. Select font family, style, weight, and size range
  3. Click "Download Glyph Sheets" to generate QOI bitmap font data
  4. Manually process files (see scripts/README.md for details)
  5. Include generated files in your project

  For complete automation documentation, see `scripts/README.md`.

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
  - When glyph sheets are missing but metrics are available, renders black placeholder rectangles
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

  isValidGlyphSheet(glyphSheet)
  - Validates if a glyph sheet is properly loaded and usable
  - Returns true if sheet has valid dimensions, false otherwise
  - Parameters: glyphSheet object or canvas element

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
  http://localhost:8000/public/font-builder.html

  Building Font Data

  1. Configure specs in src/specs/default-specs.js or via UI
  2. Use Font Builder to generate glyph sheets
  3. Compressed data saved to data/

  Testing and Examples

  **Minimal Demo**
  Open public/hello-world-demo.html for a simple "Hello World" example showing basic usage.

  **Multi-Size Demo**
  Open public/hello-world-multi-size.html to see text rendered at multiple font sizes (18, 18.5, 19), demonstrating the complexity of loading multiple bitmap font configurations.

  **Node.js Usage**
  ```bash
  # Build the demo (automatically concatenates source files)
  ./scripts/build-node-demo.sh
  
  # Run the demo
  node examples/node/hello-world-node.js
  ```
  Renders "Hello World" using QOI glyph sheets and exports as uncompressed PNG. Self-contained script with no npm dependencies, built from modular source files.

  **Full Test Suite**  
  Open public/test-renderer.html to run visual tests and hash verification.

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
  - For file:// protocol: Convert PNGs to JS files using `node scripts/png-to-js-converter.js [directory]`

  **QOI Format Issues**
  - Browser exports QOI format, pipeline converts to PNG automatically
  - Use `node scripts/qoi-to-png-converter.js [directory]` to manually convert QOI files
  - QOI files preserved by default for future Node.js compatibility

  **Rendering Issues**
  - Ensure canvases are attached to DOM before rendering for crisp text
  - Check pixel density scaling is applied correctly
  - Verify font data is loaded before attempting to render
  - If you see black rectangles instead of text, glyph sheets are missing but metrics are loaded (placeholder mode)

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

  ## Project Structure

  ```
  /
  ├── src/               # Source code
  │   ├── core/          # Runtime library classes
  │   ├── editor/        # Font generation classes
  │   ├── utils/         # Utility functions
  │   ├── ui/            # UI components
  │   ├── specs/         # Font specifications
  │   └── compression/   # Data compression utilities
  ├── public/            # HTML entry points
  ├── data/              # Generated font data
  ├── test/              # Test utilities and data
  ├── tools/             # Development tools
  ├── lib/               # Third-party libraries
  ├── docs/              # Documentation
  └── scripts/           # Automation and build scripts
  ```

  ## Architecture

  See docs/ARCHITECTURE.md for detailed system design information.

  ## License

  See LICENSE file.