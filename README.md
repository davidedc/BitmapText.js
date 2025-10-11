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
  - ✅ Pre-rendered glyphs for consistent output
  - ✅ Advanced kerning with fine-grained control
  - ✅ Multiple pixel density support (retina displays)
  - ✅ Hash-based verification for consistency
  - ✅ Font builder tool for generating bitmap fonts
  - ✅ Placeholder rectangle rendering when glyphs not loaded (to support dynamic loading)
  - ✅ Minimal runtime dependencies

  ## Limitations

  **Compound Emoji Support**: The library operates on Unicode code points, not grapheme clusters. Basic emojis work ('😀'), but compound emojis don't ('👨‍👩‍👧' family emoji, '🏳️‍🌈' rainbow flag). See docs/ARCHITECTURE.md for details.

  ## Distribution & Usage Options

  BitmapText.js uses a **static class architecture** with zero configuration needed for most use cases:

  ### Runtime-Only Distribution (Recommended for Production)

  For applications that consume pre-built bitmap fonts, simply include the static BitmapText class:

  ```javascript
  // Import only the static BitmapText class (~15-18KB)
  import { BitmapText } from './src/runtime/BitmapText.js';

  // Optional: Import helper classes for type safety and advanced usage
  import { FontProperties } from './src/runtime/FontProperties.js';
  import { TextProperties } from './src/runtime/TextProperties.js';

  // Font data self-registers when loaded
  // No configuration needed in browser environments
  ```

  **Best for:** Production web apps, mobile apps, games where bundle size matters

  ### Node.js Distribution

  For Node.js environments, minimal configuration is required:

  ```javascript
  // Import static BitmapText class
  import { BitmapText } from './src/runtime/BitmapText.js';
  import { Canvas } from './src/platform/canvas-mock.js';

  // Configure for Node.js environment
  BitmapText.configure({
    dataDir: './font-assets/',
    canvasFactory: () => new Canvas()
  });
  ```

  **Best for:** Server-side rendering, CLI tools, automated image generation

  ### Font Assets Building Distribution

  For applications that need to generate bitmap fonts at runtime:

  ```javascript
  // Import full toolkit including font assets building tools (~55KB+)
  import { BitmapText } from './src/runtime/BitmapText.js';
  import { AtlasDataStore } from './src/runtime/AtlasDataStore.js';
  import { FontMetricsStore } from './src/runtime/FontMetricsStore.js';
  import { BitmapTextFAB } from './src/builder/BitmapTextFAB.js';
  import { AtlasDataStoreFAB } from './src/builder/AtlasDataStoreFAB.js';
  import { FontMetricsStoreFAB } from './src/builder/FontMetricsStoreFAB.js';
  import { FontPropertiesFAB } from './src/builder/FontPropertiesFAB.js';
  ```

  **Best for:** Font building tools, development environments, CI/CD pipelines

  ### Bundle Size Comparison

  | Distribution Type | Bundle Size | Use Case |
  |------------------|-------------|----------|
  | **Static Runtime** | ~15-18KB | Production apps (browser & Node.js) |
  | **Full Toolkit** | ~50KB+ | Development tools generating fonts |

  **Recommendation:** Use static runtime in production and build font assets during your build process using the full toolkit.

  ## Quick Start

  ### Browser (Zero Configuration)

  ```html
  <!-- Load core runtime classes (StatusCode must be loaded first) -->
  <script src="src/runtime/StatusCode.js"></script>
  <script src="src/runtime/FontProperties.js"></script>
  <script src="src/runtime/TextProperties.js"></script>
  <script src="src/runtime/AtlasDataStore.js"></script>
  <script src="src/runtime/FontMetricsStore.js"></script>
  <script src="src/runtime/BitmapText.js"></script>

  <!-- Load pre-generated font data (self-registers automatically) -->
  <script src="font-assets/metrics-density-1-0-Arial-style-normal-weight-normal-size-18-0.js"></script>
  <script src="font-assets/atlas-density-1-0-Arial-style-normal-weight-normal-size-18-0-qoi.js"></script>

  <canvas id="myCanvas" width="400" height="100"></canvas>

  <script>
    const canvas = document.getElementById('myCanvas');
    const ctx = canvas.getContext('2d');

    // Create font configuration
    const fontProperties = new FontProperties(
      window.devicePixelRatio || 1, // pixelDensity
      "Arial",                      // fontFamily
      "normal",                     // fontStyle
      "normal",                     // fontWeight
      18                           // fontSize
    );

    // Optional: Create text rendering configuration
    const textProperties = new TextProperties({
      isKerningEnabled: true,      // Enable kerning (default: true)
      textBaseline: 'bottom',      // Baseline positioning (default: 'bottom')
      textAlign: 'left',           // Alignment (default: 'left')
      textColor: '#000000'         // Color (default: '#000000')
    });

    // Render text using static API
    BitmapText.drawTextFromAtlas(ctx, "Hello World", 10, 50, fontProperties, textProperties);
  </script>
  ```

  ### Node.js

  ```javascript
  import { BitmapText } from './src/runtime/BitmapText.js';
  import { FontProperties } from './src/runtime/FontProperties.js';
  import { Canvas } from './src/platform/canvas-mock.js';
  import fs from 'fs';

  // Configure for Node.js
  BitmapText.configure({
    dataDir: './font-assets/',
    canvasFactory: () => new Canvas()
  });

  // Create font configuration
  const fontProperties = new FontProperties(1.0, "Arial", "normal", "normal", 18);

  // Load font
  await BitmapText.loadFont(fontProperties.idString);

  // Create canvas and render
  const canvas = new Canvas(400, 100);
  const ctx = canvas.getContext('2d');

  BitmapText.drawTextFromAtlas(ctx, "Hello World", 10, 50, fontProperties);

  // Export as PNG
  fs.writeFileSync('output.png', canvas.toPNG());
  ```

  ### With Status Checking

  ```javascript
  // Measure text - returns { metrics, status }
  const { metrics, status } = BitmapText.measureText("Hello World", fontProperties, textProperties);

  if (status.code !== StatusCode.SUCCESS) {
    console.warn('Measurement issues:', getStatusDescription(status));
  }

  // Draw text - returns { rendered, status }
  const result = BitmapText.drawTextFromAtlas(ctx, "Hello World", 10, 50, fontProperties, textProperties);

  if (result.status.code !== StatusCode.SUCCESS) {
    console.warn('Rendering issues:', getStatusDescription(result.status));
    if (result.status.placeholdersUsed) {
      console.info('Some glyphs rendered as placeholder rectangles');
    }
  }
  ```

  ## Generating Your Own Bitmap Fonts

  ### Automated Pipeline (Recommended)
  ```bash
  npm run watch-fonts
  # or
  ./scripts/watch-font-assets.sh
  ```
  Then use the font-assets-builder.html - files will be processed automatically!

  ### Manual Process
  1. Open public/font-assets-builder.html in a web browser
  2. Select font family, style, weight, and size range
  3. Click "Download Font Assets" to generate QOI bitmap font atlas
  4. Manually process files (see scripts/README.md for details)
  5. Include generated files in your project

  For complete automation documentation, see `scripts/README.md`.

  ## API Reference

  ### BitmapText Static Class

  All methods are static - no instantiation required.

  #### Configuration (Node.js only)

  ```javascript
  BitmapText.configure({
    dataDir: './font-assets/',        // Directory containing font assets
    canvasFactory: () => new Canvas()  // Canvas creation function
  })
  ```

  **Browser**: No configuration needed - auto-detects environment

  #### Loading Methods

  **loadFont(idString, options)**

  Loads a single font (metrics + atlas):

  ```javascript
  await BitmapText.loadFont('density-1-0-Arial-style-normal-weight-normal-size-18-0', {
    isFileProtocol: false,           // Optional: set true for file:// protocol
    onProgress: (loaded, total) => { // Optional: progress callback
      console.log(`${loaded}/${total} files loaded`);
    }
  });
  ```

  **loadFonts(idStrings, options)**

  Loads multiple fonts in parallel:

  ```javascript
  await BitmapText.loadFonts([
    'density-1-0-Arial-style-normal-weight-normal-size-18-0',
    'density-1-0-Arial-style-normal-weight-normal-size-19-0'
  ], { onProgress: callback });
  ```

  #### Rendering Methods

  **measureText(text, fontProperties, textProperties)**

  Returns measurement data:

  ```javascript
  {
    metrics: TextMetrics | null,  // TextMetrics-compatible object or null if failed
    status: {
      code: StatusCode,           // 0=SUCCESS, 1=NO_METRICS, 2=PARTIAL_METRICS
      missingChars?: Set          // Missing characters (PARTIAL_METRICS only)
    }
  }
  ```

  **drawTextFromAtlas(ctx, text, x, y, fontProperties, textProperties)**

  Renders text and returns status:

  ```javascript
  {
    rendered: boolean,            // Whether rendering occurred
    status: {
      code: StatusCode,           // 0=SUCCESS, 1=NO_METRICS, 2=PARTIAL_METRICS, 3=NO_ATLAS, 4=PARTIAL_ATLAS
      missingChars?: Set,         // Missing metric characters (PARTIAL_METRICS)
      missingAtlasChars?: Set,    // Missing atlas characters (PARTIAL_ATLAS)
      placeholdersUsed?: boolean  // Whether placeholders were used
    }
  }
  ```

  Parameters:
  - **ctx**: Canvas 2D rendering context
  - **text**: String to render
  - **x, y**: Position in CSS pixels (y is bottom of text bounding box)
  - **fontProperties**: FontProperties instance
  - **textProperties**: TextProperties instance (optional)

  #### Query Methods

  **hasMetrics(idString)**: Check if metrics are loaded
  **hasAtlas(idString)**: Check if atlas is loaded
  **unloadMetrics(idString)**: Remove metrics from memory
  **unloadAtlas(idString)**: Remove atlas from memory

  #### Registration Methods (Called by Font Assets)

  **registerMetrics(idString, compactedData)**: Register font metrics
  **registerAtlas(idString, base64Data)**: Register atlas image

  These are called automatically when font asset files are loaded.

  ### StatusCode Module

  The StatusCode module provides status codes and helper functions for handling rendering results. When using BitmapText in browsers with script tags, **StatusCode.js must be loaded before BitmapText.js** because BitmapText depends on the StatusCode constants.

  **Import Order (Browser):**
  ```html
  <!-- Load StatusCode first -->
  <script src="src/runtime/StatusCode.js"></script>

  <!-- Then load other runtime classes -->
  <script src="src/runtime/FontProperties.js"></script>
  <script src="src/runtime/TextProperties.js"></script>
  <script src="src/runtime/AtlasDataStore.js"></script>
  <script src="src/runtime/FontMetricsStore.js"></script>
  <script src="src/runtime/BitmapText.js"></script>
  ```

  **Import Order (ES Modules):**
  ```javascript
  // In ES modules, imports are automatically hoisted
  import { StatusCode, isSuccess, getStatusDescription } from './src/runtime/StatusCode.js';
  import { BitmapText } from './src/runtime/BitmapText.js';
  ```

  ### StatusCode Constants

  ```javascript
  StatusCode.SUCCESS = 0        // Everything worked perfectly
  StatusCode.NO_METRICS = 1     // No font metrics available
  StatusCode.PARTIAL_METRICS = 2 // Some characters missing metrics
  StatusCode.NO_ATLAS = 3       // No atlas available (using placeholders)
  StatusCode.PARTIAL_ATLAS = 4  // Some characters missing from atlas
  ```

  ### Helper Functions

  ```javascript
  isSuccess(status)             // Returns true if status indicates success
  isCompleteFailure(status)     // Returns true if rendering completely failed
  isPartialSuccess(status)      // Returns true if partial rendering occurred
  getStatusDescription(status)  // Returns human-readable status description
  ```

  ### Usage Examples

  **Basic Usage (ignoring status):**
  ```javascript
  const { metrics } = BitmapText.measureText(text, fontProps);
  const { rendered } = BitmapText.drawTextFromAtlas(ctx, text, x, y, fontProps);
  ```

  **With Status Checking:**
  ```javascript
  const result = BitmapText.measureText(text, fontProps);
  if (result.status.code === StatusCode.SUCCESS) {
    console.log('Width:', result.metrics.width);
  } else if (result.status.code === StatusCode.PARTIAL_METRICS) {
    console.warn('Missing characters:', [...result.status.missingChars]);
  }

  const drawResult = BitmapText.drawTextFromAtlas(ctx, text, x, y, fontProps);
  if (drawResult.status.code === StatusCode.PARTIAL_ATLAS) {
    console.warn('Using placeholders for:', [...drawResult.status.missingAtlasChars]);
  }
  ```

  ## FontProperties Class

  Immutable font configuration class with pre-computed keys for performance.

  ### Constructor
  ```javascript
  new FontProperties(pixelDensity, fontFamily, fontStyle, fontWeight, fontSize)
  ```

  ### Parameters
  - **pixelDensity**: Number (can be non-integer, e.g., 1.5 for some displays)
  - **fontFamily**: String (e.g., "Arial", "Helvetica")
  - **fontStyle**: String ("normal", "italic", "oblique")
  - **fontWeight**: String ("normal", "bold", "100"-"900")
  - **fontSize**: Number (can be non-integer, e.g., 18.5)

  ### Properties
  - **key**: String - Pre-computed key for fast Map lookups
  - **idString**: String - Pre-computed ID string for asset file naming

## TextProperties Class

Immutable text rendering configuration class with pre-computed keys for performance.

### Constructor
```javascript
new TextProperties(options = {})
```

### Parameters (all optional with defaults)
- **isKerningEnabled**: Boolean (default: true) - Enable kerning for better text rendering
- **textBaseline**: String (default: "bottom") - TextProperties uses 'bottom' as default (differs from HTML5 Canvas default of 'alphabetic')
- **textAlign**: String (default: "left") - Text alignment
- **textColor**: String (default: "#000000") - CSS color string

### Properties
- **key**: String - Pre-computed key for fast Map lookups
- All constructor options as read-only properties

### Factory Methods
- **TextProperties.withKerning(isKerningEnabled, options)**: Create with specific kerning setting
- **TextProperties.withColor(textColor, options)**: Create with specific color
- **TextProperties.forBitmapText(options)**: Create with textBaseline='bottom' for BitmapText

### Instance Methods
- **withKerningEnabled(boolean)**: Create new instance with modified kerning
- **withTextColor(string)**: Create new instance with modified color
- **equals(other)**: Equality comparison
- **toObject()**: Returns plain object representation

  ## Internal Store Classes

  These classes are used internally by BitmapText and also available for font-assets-builder:

  ### AtlasDataStore

  Manages atlas images - used by font-assets-builder, internal to BitmapText static class.

  ### FontMetricsStore

  Manages font metrics - used by font-assets-builder, internal to BitmapText static class.

  **Note**: End users of the static BitmapText API don't need to interact with these classes directly.

  Build Instructions

  Development Setup

  # Clone repository
  git clone [repository-url]

  # Serve locally (required for CORS)
  python -m http.server
  # or
  npx http-server

  # Open in browser
  http://localhost:8000/public/font-assets-builder.html

  Building Font Data

  1. Configure specs in src/specs/default-specs.js or via UI
  2. Use Font Builder to generate atlases
  3. Compressed data saved to font-assets/

  Testing and Examples

  **Minimal Demo**
  Open public/hello-world-demo.html for a simple "Hello World" example showing basic usage.

  **Multi-Size Demo**
  Open public/hello-world-multi-size.html to see text rendered at multiple font sizes (18, 18.5, 19), demonstrating the complexity of loading multiple bitmap font configurations.

  **Node.js Usage**
  ```bash
  # Build and run single-size demo
  ./scripts/build-node-demo.sh
  node examples/node/dist/hello-world.bundle.js
  
  # Build and run multi-size demo (demonstrates placeholder rectangles for missing atlases)
  npm run build-multi-size-demo
  node examples/node/dist/hello-world-multi-size.bundle.js
  
  # Or build and run both demos at once
  ./run-node-demos.sh
  ```
  
  **Single-size demo**: Renders "Hello World" at size 19 using QOI atlases and exports as PNG.
  
  **Multi-size demo**: Renders "Hello World" at sizes 18, 18.5, and 19. Demonstrates multi-size font loading and placeholder rectangle fallback for missing atlases. Self-contained scripts with no npm dependencies, built from modular source files.

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
  - Required for loading PNG atlases and calculating hashes
  - For file:// protocol: Convert images to JS files using `node scripts/image-to-js-converter.js [directory] --all`

  **QOI Format Issues**
  - Browser exports QOI format, pipeline converts to PNG automatically
  - Use `node scripts/qoi-to-png-converter.js [directory]` to manually convert QOI files
  - QOI files preserved by default for future Node.js compatibility

  **Rendering Issues**
  - Ensure canvases are attached to DOM before rendering for crisp text
  - Check pixel density scaling is applied correctly
  - Verify font data is loaded before attempting to render
  - If you see simplified black rectangles instead of text, atlases are missing but metrics are loaded (placeholder mode)

  **Performance Issues**
  - Pre-load atlases during initialization
  - BitmapText is a static class (no instances created) - pre-load fonts and cache measurements for best performance
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
  │   ├── runtime/       # Runtime library classes
  │   ├── builder/       # Font assets building classes
  │   ├── platform/      # Platform-specific loaders
  │   ├── node/          # Node.js demo source code
  │   ├── utils/         # Utility functions
  │   ├── ui/            # UI components
  │   └── specs/         # Font specifications
  ├── public/            # HTML entry points
  ├── font-assets/       # Generated font assets
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