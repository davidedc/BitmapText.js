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
  - ✅ Full textBaseline support (top, hanging, middle, alphabetic, ideographic, bottom)
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
    fontDirectory: './font-assets/',
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

    // IMPORTANT - Pixel Density Configuration:
    // BitmapText requires explicit pixel density specification:
    // - Standard displays: Use 1.0
    // - HiDPI/Retina displays: Use window.devicePixelRatio (typically 2.0+)
    // - No automatic detection - you must provide this value
    // For detailed HiDPI setup, see "Understanding Coordinate Systems & Transforms" section below

    // Create font configuration
    const fontProperties = new FontProperties(
      window.devicePixelRatio || 1, // pixelDensity (1.0 = standard, 2.0 = Retina)
      "Arial",                      // fontFamily
      "normal",                     // fontStyle
      "normal",                     // fontWeight
      18                           // fontSize in CSS pixels
    );

    // Optional: Create text rendering configuration
    const textProperties = new TextProperties({
      isKerningEnabled: true,      // Enable kerning (default: true)
      textBaseline: 'bottom',      // Baseline positioning (default: 'bottom')
      textAlign: 'left',           // Alignment (default: 'left')
      textColor: '#000000'         // Color (default: '#000000')
    });

    // IMPORTANT: Do NOT call ctx.scale() - BitmapText handles scaling internally
    // IMPORTANT: Coordinates are ABSOLUTE from canvas origin, transforms are ignored

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
    fontDirectory: './font-assets/',
    canvasFactory: () => new Canvas()
  });

  // Create font configuration
  // Node.js pixel density: Use 1.0 for standard rendering, 2.0+ for HiDPI pre-rendering
  // See "Node.js Pixel Density" section below for details
  const fontProperties = new FontProperties(1.0, "Arial", "normal", "normal", 18);

  // Load font
  await BitmapText.loadFont(fontProperties.idString);

  // Create canvas and render
  const canvas = new Canvas(400, 100);
  const ctx = canvas.getContext('2d');

  // Coordinates are ABSOLUTE from canvas origin (0,0)
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

## Understanding Coordinate Systems & Transforms

### Transform Behavior - CRITICAL

**BitmapText IGNORES all context transforms.** Coordinates are always absolute from canvas origin (0,0).

```javascript
// Setup
const ctx = canvas.getContext('2d');
ctx.scale(2, 2);
ctx.translate(100, 50);
ctx.rotate(Math.PI / 4);

// BitmapText ignores ALL transforms above
const fontProps = new FontProperties(2.0, "Arial", "normal", "normal", 19);
BitmapText.drawTextFromAtlas(ctx, "Hello", 10, 50, fontProps);
// ✅ Text renders at exactly (10, 50) CSS pixels from origin
// ❌ NOT at (120, 80) which would be 10+100 translate, 50+50 translate
// ❌ NOT rotated 45 degrees
```

**Why:** BitmapText needs direct control over physical pixel positioning for pixel-perfect rendering. It temporarily resets the context transform to identity during drawing, then restores it.

### Coordinate System Overview

All BitmapText coordinates and measurements use **CSS pixels**:

| API | Input Units | Output Units |
|-----|-------------|--------------|
| `drawTextFromAtlas(ctx, text, x_CssPx, y_CssPx, ...)` | x_CssPx, y_CssPx = CSS pixels | rendered status |
| `measureText(text, ...)` | N/A | width, bounds = CSS pixels |
| `FontProperties(density, family, style, weight, size)` | size = CSS pixels | N/A |

**Internal conversion:** `physicalPixels = cssPixels × pixelDensity`

### Canvas Setup for HiDPI

#### Standard Display (pixelDensity = 1.0)
```javascript
const fontProps = new FontProperties(1.0, "Arial", "normal", "normal", 18);
const canvas = document.getElementById('myCanvas');
canvas.width = 400;   // 400 physical pixels
canvas.height = 100;  // 100 physical pixels
const ctx = canvas.getContext('2d');

// No special setup needed
BitmapText.drawTextFromAtlas(ctx, "Hello", 10, 50, fontProps);
```

#### HiDPI Display (Retina, 2× or higher)
```javascript
const dpr = window.devicePixelRatio;  // e.g., 2.0 for Retina
const fontProps = new FontProperties(dpr, "Arial", "normal", "normal", 18);

const canvas = document.getElementById('myCanvas');
const cssWidth = 400;
const cssHeight = 100;

// Set physical dimensions
canvas.width = cssWidth * dpr;    // e.g., 800 physical pixels
canvas.height = cssHeight * dpr;  // e.g., 200 physical pixels

// Set CSS dimensions for proper display size
canvas.style.width = cssWidth + 'px';
canvas.style.height = cssHeight + 'px';

const ctx = canvas.getContext('2d');

// ⚠️ IMPORTANT: Do NOT call ctx.scale(dpr, dpr)
// BitmapText handles density scaling internally!

// Draw with CSS pixel coordinates
BitmapText.drawTextFromAtlas(ctx, "Hello", 10, 50, fontProps);
// Internally converts to physical (20, 100) for pixel-perfect rendering
```

### Comparison with HTML5 Canvas

BitmapText uses a **different pattern** than standard HTML5 Canvas:

**HTML5 Canvas (Standard HiDPI):**
```javascript
ctx.scale(dpr, dpr);  // Scale context
ctx.font = '19px Arial';
ctx.fillText('Hello', 10, 50);  // Transform applied automatically
```

**BitmapText:**
```javascript
// NO ctx.scale() - BitmapText handles scaling internally
const fontProps = new FontProperties(dpr, 'Arial', 'normal', 'normal', 19);
BitmapText.drawTextFromAtlas(ctx, 'Hello', 10, 50, fontProps);
```

**Key Differences:**

| Aspect | HTML5 Canvas | BitmapText |
|--------|--------------|------------|
| Context scaling | `ctx.scale(dpr, dpr)` | NO scaling |
| Transform handling | Respects transforms | IGNORES transforms |
| Coordinate system | Relative to transform | Absolute from origin |
| Font size | String `'19px'` | Number `19` |
| Pixel density | Implicit in scale | Explicit in FontProperties |

### Node.js Pixel Density

Node.js has no `window.devicePixelRatio`. Choose based on your use case:

**Standard Server-Side Rendering:**
```javascript
const fontProps = new FontProperties(1.0, "Arial", "normal", "normal", 18);
const canvas = new Canvas(400, 100);  // Output is 400×100 pixels
```

**Pre-rendering for HiDPI Displays:**
```javascript
const targetDensity = 2.0;  // Target display is 2× (Retina)
const fontProps = new FontProperties(targetDensity, "Arial", "normal", "normal", 18);

// Output will be 2× larger
const cssWidth = 400;
const cssHeight = 100;
const canvas = new Canvas(
  cssWidth * targetDensity,   // 800 physical pixels
  cssHeight * targetDensity   // 200 physical pixels
);
```

### Common Pitfalls

❌ **DON'T scale the context when using BitmapText:**
```javascript
ctx.scale(dpr, dpr);  // ❌ This will be IGNORED
BitmapText.drawTextFromAtlas(ctx, text, 10, 50, fontProps);
// Works, but the scale is wasted (reset then restored)
```

❌ **DON'T expect transforms to work:**
```javascript
ctx.translate(100, 50);  // ❌ This will be IGNORED
BitmapText.drawTextFromAtlas(ctx, text, 10, 50, fontProps);
// Text renders at (10, 50), NOT (110, 100)
```

❌ **DON'T mix density values:**
```javascript
const fontProps = new FontProperties(2.0, ...);  // Font at 2×
canvas.width = 400;  // ❌ Canvas at 1× - glyphs will be too large!
```

✅ **DO keep density consistent:**
```javascript
const density = window.devicePixelRatio;
const fontProps = new FontProperties(density, ...);
canvas.width = 400 * density;  // ✅ Matching density
```

✅ **DO use absolute positioning:**
```javascript
// Calculate exact position you want
const x = 10;  // Absolute CSS pixels from origin
const y = 50;  // Absolute CSS pixels from origin
BitmapText.drawTextFromAtlas(ctx, text, x, y, fontProps);
```

## Text Baseline Positioning

BitmapText supports all six HTML5 Canvas textBaseline values. The y-coordinate you provide corresponds to the position of the chosen baseline.

### Available Baselines

| Baseline | Description | Use Case |
|----------|-------------|----------|
| `top` | Top of em square | Aligning text to top edge |
| `hanging` | Hanging baseline | Tibetan, Devanagari scripts |
| `middle` | Middle of em square | Vertically centering text |
| `alphabetic` | Alphabetic baseline | Standard Latin text (HTML5 default) |
| `ideographic` | Ideographic baseline | CJK characters |
| `bottom` | Bottom of em square | Aligning to bottom edge (BitmapText default) |

### Baseline Examples

**Standard alphabetic baseline (HTML5 Canvas default):**
```javascript
const textProps = new TextProperties({ textBaseline: 'alphabetic' });
BitmapText.drawTextFromAtlas(ctx, 'Hello', 10, 50, fontProps, textProps);
// y=50 is at the alphabetic baseline (bottom of most letters, excluding descenders)
```

**Middle baseline (vertical centering):**
```javascript
const textProps = new TextProperties({ textBaseline: 'middle' });
BitmapText.drawTextFromAtlas(ctx, 'World', 10, 75, fontProps, textProps);
// y=75 is at the vertical center of the em square
```

**Top baseline (hanging down):**
```javascript
const textProps = new TextProperties({ textBaseline: 'top' });
BitmapText.drawTextFromAtlas(ctx, 'Top', 10, 100, fontProps, textProps);
// y=100 is at the top of the em square, text hangs down from this point
```

**Bottom baseline (BitmapText default):**
```javascript
const textProps = new TextProperties({ textBaseline: 'bottom' });
// or simply omit textBaseline to use default
BitmapText.drawTextFromAtlas(ctx, 'Bottom', 10, 125, fontProps, textProps);
// y=125 is at the bottom of the em square
```

### Visual Demo

See `public/baseline-demo.html` for a comprehensive visual demonstration of all six baseline values with "Hello World" rendered at each baseline.

### Baseline Coordinate System

- All baseline distances are measured relative to the **alphabetic baseline** (ab = 0)
- The y-coordinate increases **downward** (standard Canvas convention)
- Baseline data is captured from the browser during font generation and stored in metrics files
- Each font has consistent baseline values across all characters (stored once, expanded to all)

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

  #### Configuration (Optional)

  ```javascript
  BitmapText.configure({
    fontDirectory: './font-assets/',   // Directory containing font assets
    canvasFactory: () => new Canvas()  // Factory function (Node.js only)
  })
  ```

  **fontDirectory**:
  - Browser: May need configuration if HTML files are in subdirectories (e.g., `public/`)
  - Node.js: May need configuration if running from different directory than project root

  **canvasFactory** (Node.js only):
  - Required because HTMLCanvasElement is not constructible (`new HTMLCanvasElement()` throws error)
  - Must be a factory function that creates Canvas instances
  - Browser: uses `document.createElement('canvas')`
  - Node.js: Must provide `() => new Canvas()` from canvas-mock

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
    metrics: {
      width: number,                      // CSS pixels - total text width
      actualBoundingBoxLeft: number,      // CSS pixels - left extent from text position
      actualBoundingBoxRight: number,     // CSS pixels - right extent from text position
      actualBoundingBoxAscent: number,    // CSS pixels - ascent above baseline
      actualBoundingBoxDescent: number,   // CSS pixels - descent below baseline (negative)
      fontBoundingBoxAscent: number,      // CSS pixels - font ascent
      fontBoundingBoxDescent: number      // CSS pixels - font descent (negative)
    } | null,  // null if font metrics not available
    status: {
      code: StatusCode,           // 0=SUCCESS, 1=NO_METRICS, 2=PARTIAL_METRICS
      missingChars?: Set          // Missing characters (PARTIAL_METRICS only)
    }
  }
  ```

  **Note**: All measurements are in CSS pixels. To convert to physical pixels: `physicalPixels = cssPixels × fontProperties.pixelDensity`

  **drawTextFromAtlas(ctx, text, x_CssPx, y_CssPx, fontProperties, textProperties)**

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
  - **x_CssPx, y_CssPx**: Position in CSS pixels (absolute from canvas origin; y_CssPx is bottom of text bounding box)
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
- **textBaseline**: String (default: "bottom") - Text baseline positioning. Supported values:
  - `"top"`: Top of em square (text hangs down from this point)
  - `"hanging"`: Hanging baseline (Tibetan, Devanagari scripts)
  - `"middle"`: Middle of em square (text is vertically centered)
  - `"alphabetic"`: Alphabetic baseline (HTML5 Canvas default, standard for Latin)
  - `"ideographic"`: Ideographic baseline (Chinese, Japanese, Korean scripts)
  - `"bottom"`: Bottom of em square (BitmapText default)
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

  **Baseline Demo**
  Open public/baseline-demo.html for an interactive demonstration of all six textBaseline values, with side-by-side comparison of BitmapText vs native Canvas rendering. Includes controls for font selection, size, pixel density, and text samples.

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