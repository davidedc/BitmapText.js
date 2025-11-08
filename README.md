# BitmapText.js

  A JavaScript library for rendering pixel-identical, consistent bitmap text across all browsers and devices, for both browser (HTML5 Canvas) and node (.png or .qoi image).
  
  See [demos and examples](./public/index.html)

  **Documentation Navigation:**
  - **System Architecture** → See docs/ARCHITECTURE.md for detailed design information
  - **Development with Claude** → See docs/CLAUDE.md for Claude-specific development guidance
  - **Automation Scripts** → See scripts/README.md for pipeline documentation

## Problem Statement

  Browser text rendering on Canvas is inconsistent - different browsers apply anti-aliasing differently, making pixel-identical text rendering impossible with standard
  Canvas APIs. This library solves that by pre-rendering glyphs as bitmaps.

## Features

  - ✅ Pixel-identical text rendering across all browsers (hash-verifiable)
  - ✅ Pre-rendered glyphs for consistent output
  - ✅ Kerning
  - ✅ Multiple pixel density support (retina displays)
  - ✅ Full textBaseline support (top, hanging, middle, alphabetic, ideographic, bottom)
  - ✅ Font builder tool for generating bitmap fonts
  - ✅ Dynamic atlas loading (Placeholder rectangle rendering when atlas is not loaded)
  - ✅ No dependencies

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

### Production Bundles (Recommended)

  For production deployments, use the pre-built minified bundles:

  **Browser (Single Script Tag):**
  ```html
  <!-- Single file: ~32KB minified + gzipped ~12KB -->
  <script src="dist/bitmaptext.min.js"></script>

  <script>
    const fontProps = new FontProperties(1, "Arial", "normal", "normal", 19);
    await BitmapText.loadFont(fontProps.idString);
    BitmapText.drawTextFromAtlas(ctx, "Hello World", 10, 50, fontProps);
  </script>
  ```

  **Node.js (With Your Canvas):**
  ```javascript
  import { createCanvas } from 'node-canvas';  // or 'skia-canvas'
  import './dist/bitmaptext-node.min.js';

  BitmapText.configure({
    fontDirectory: './font-assets/',
    canvasFactory: () => createCanvas()
  });

  await BitmapText.loadFont(fontProps.idString);
  BitmapText.drawTextFromAtlas(ctx, "Hello", 10, 50, fontProps);
  ```

  **Build from source:**
  ```bash
  ./scripts/build-runtime-bundle.sh --all
  # or
  npm run build-bundle-all
  ```

  **Benefits:**
  - ✅ Single file load (32-33KB) vs 17 separate files (149KB)
  - ✅ 79% size reduction through minification
  - ✅ Source maps included for debugging
  - ✅ Zero configuration in browser
  - ✅ Minimal configuration in Node.js

  **What's included:** StatusCode, FontProperties, TextProperties, BitmapText, FontLoader, Atlas/Metrics stores, MetricsExpander, TightAtlasReconstructor, and all supporting classes.

  **What's excluded (Node.js):** Canvas implementation (you provide), PNG encoder (image I/O not core library).

  See `dist/README.md` for complete bundle documentation.

## Quick Start

Get up and running with the production-ready bundles in seconds.

### Browser Usage

  ```html
  <!DOCTYPE html>
  <html>
  <head>
    <title>BitmapText Demo</title>
  </head>
  <body>
    <canvas id="myCanvas" width="400" height="100"></canvas>

    <!-- Single script tag - complete runtime (~32KB minified) -->
    <script src="dist/bitmaptext.min.js"></script>

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
        1,          // pixelDensity (1.0 = standard, 2.0 = Retina)
        "Arial",    // fontFamily
        "normal",   // fontStyle
        "normal",   // fontWeight
        19          // fontSize in CSS pixels
      );

      // Optional: Configure font directory if needed
      BitmapText.setFontDirectory('./font-assets/');

      // Load font and render
      BitmapText.loadFont(fontProperties.idString).then(() => {
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
      });
    </script>
  </body>
  </html>
  ```

### Node.js Usage

  ```javascript
  import { createCanvas } from 'node-canvas';  // or 'skia-canvas'
  import './dist/bitmaptext-node.min.js';

  // Configure with your Canvas implementation
  BitmapText.configure({
    fontDirectory: './font-assets/',
    canvasFactory: () => createCanvas()
  });

  // Create font configuration
  // Node.js pixel density: Use 1.0 for standard rendering, 2.0+ for HiDPI pre-rendering
  // See "Node.js Pixel Density" section below for details
  const fontProperties = new FontProperties(1, "Arial", "normal", "normal", 19);

  // Load font
  await BitmapText.loadFont(fontProperties.idString);

  // Create canvas and render
  const canvas = createCanvas(400, 100);
  const ctx = canvas.getContext('2d');

  // Coordinates are ABSOLUTE from canvas origin (0,0)
  BitmapText.drawTextFromAtlas(ctx, "Hello World", 10, 50, fontProperties);

  // Note: Image export requires separate PNG encoder (not included in bundle)
  // See dist/README.md for details
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

**See [dist/README.md](dist/README.md) for complete bundle documentation.**

**For development and debugging:** See the "Development & Debugging" section below for using individual source files.

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

See `public/baseline-alignment-demo.html` for a comprehensive visual demonstration of all baseline and alignment combinations.

### Baseline Coordinate System

- All baseline distances are measured relative to the **alphabetic baseline** (ab = 0)
- The y-coordinate increases **downward** (standard Canvas convention)
- Baseline data is captured from the browser during font generation and stored in metrics files
- Each font has consistent baseline values across all characters (stored once, expanded to all)

## Text Alignment

BitmapText supports three horizontal text alignment modes. The x-coordinate you provide serves as the alignment anchor point.

### Available Alignments

| Alignment | Description | Anchor Point |
|----------|-------------|--------------|
| `left` | Text starts at x | Leftmost point (BitmapText default) |
| `center` | Text is centered at x | Horizontal midpoint |
| `right` | Text ends at x | Rightmost point |

### Alignment Examples

**Left alignment (default):**
```javascript
const textProps = new TextProperties({ textAlign: 'left' });
// or simply omit textAlign to use default
BitmapText.drawTextFromAtlas(ctx, 'Left', 100, 50, fontProps, textProps);
// Text starts at x=100 and extends rightward
```

**Center alignment (horizontal centering):**
```javascript
const textProps = new TextProperties({ textAlign: 'center' });
BitmapText.drawTextFromAtlas(ctx, 'Center', 200, 50, fontProps, textProps);
// Text is centered at x=200, extending equally left and right
```

**Right alignment (right-justify):**
```javascript
const textProps = new TextProperties({ textAlign: 'right' });
BitmapText.drawTextFromAtlas(ctx, 'Right', 300, 50, fontProps, textProps);
// Text ends at x=300 and extends leftward
```

**Combining alignment and baseline:**
```javascript
// Center text both horizontally (textAlign) and vertically (textBaseline)
const textProps = new TextProperties({
  textAlign: 'center',
  textBaseline: 'middle'
});
BitmapText.drawTextFromAtlas(ctx, 'Centered', 200, 150, fontProps, textProps);
// Text is centered both horizontally and vertically at point (200, 150)
```

### Visual Demo

See `public/baseline-alignment-demo.html` for a comprehensive visual demonstration of all baseline and alignment combinations.

### How Alignment Works

- BitmapText measures text width using `measureText()` before rendering
- Alignment offset is calculated based on text width and desired alignment
- The offset is applied to the x-coordinate before rendering begins
- If text measurement fails (missing glyphs), alignment defaults to 'left' with a warning
- Alignment respects kerning settings (text width includes kerning when enabled)

## Development & Debugging

For development with maximum debugging flexibility, you can use individual source files instead of the production bundle.

### Using Individual Source Files (Browser)

  ```html
  <!-- Load core runtime classes (StatusCode must be loaded first) -->
  <script src="src/runtime/StatusCode.js"></script>
  <script src="src/runtime/FontProperties.js"></script>
  <script src="src/runtime/TextProperties.js"></script>
  <script src="src/runtime/FontMetrics.js"></script>
  <script src="src/runtime/AtlasImage.js"></script>
  <script src="src/runtime/AtlasPositioning.js"></script>
  <script src="src/runtime/AtlasData.js"></script>
  <script src="src/runtime/AtlasDataStore.js"></script>
  <script src="src/runtime/FontMetricsStore.js"></script>
  <script src="src/runtime/FontManifest.js"></script>
  <script src="src/runtime/TightAtlasReconstructor.js"></script>
  <script src="src/runtime/AtlasReconstructionUtils.js"></script>
  <script src="src/runtime/AtlasCellDimensions.js"></script>
  <script src="src/platform/FontLoader-browser.js"></script>
  <script src="src/runtime/FontLoaderBase.js"></script>
  <script src="src/builder/MetricsExpander.js"></script>
  <script src="src/runtime/BitmapText.js"></script>

  <!-- Load pre-generated font data (self-registers automatically) -->
  <script src="font-assets/metrics-density-1-0-Arial-style-normal-weight-normal-size-19-0.js"></script>
  <script src="font-assets/atlas-density-1-0-Arial-style-normal-weight-normal-size-19-0-webp.js"></script>

  <canvas id="myCanvas" width="400" height="100"></canvas>

  <script>
    const canvas = document.getElementById('myCanvas');
    const ctx = canvas.getContext('2d');

    const fontProperties = new FontProperties(1, "Arial", "normal", "normal", 19);
    const textProperties = new TextProperties();

    // Render text using static API
    BitmapText.drawTextFromAtlas(ctx, "Hello World", 10, 50, fontProperties, textProperties);
  </script>
  ```

**Benefits:**
- Set breakpoints in original source files
- See unminified, readable code
- Easier debugging during development
- Better error messages with full context

**Trade-offs:**
- 17 separate files (149KB total unminified)
- Not recommended for production
- Requires CORS-enabled server (use `python -m http.server` or `npx http-server`)

**Example:** See `public/hello-world-demo.html` for a complete unbundled example.

### Using Individual Source Files (Node.js)

  ```javascript
  import { BitmapText } from './src/runtime/BitmapText.js';
  import { FontProperties } from './src/runtime/FontProperties.js';
  import { TextProperties } from './src/runtime/TextProperties.js';
  import { Canvas } from './src/platform/canvas-mock.js';

  // Configure for Node.js
  BitmapText.configure({
    fontDirectory: './font-assets/',
    canvasFactory: () => new Canvas()
  });

  const fontProperties = new FontProperties(1, "Arial", "normal", "normal", 19);
  await BitmapText.loadFont(fontProperties.idString);

  const canvas = new Canvas(400, 100);
  const ctx = canvas.getContext('2d');

  BitmapText.drawTextFromAtlas(ctx, "Hello World", 10, 50, fontProperties);
  ```

### Using Unminified Bundle

For a middle ground between individual files and minified bundle, use the unminified bundle:

  ```html
  <!-- Easier to debug than minified, but still a single file -->
  <script src="dist/bitmaptext.js"></script>
  ```

**Benefits:**
- Single file (easier than 17 separate files)
- Readable code (not minified)
- No source map required

**Trade-offs:**
- Larger than minified (149KB vs 32KB)
- All code in one file (harder to navigate than separate files)

## Building from Source

### Quick Reference

  **Rebuild all bundles:**
  ```bash
  npm run build
  ```

  **Rebuild and test:**
  ```bash
  ./run-node-demos.sh  # Builds bundles + runs Node.js demos
  ```

### Build Commands

  | Command | What It Builds |
  |---------|---------------|
  | `npm run build` | Browser + Node.js bundles |
  | `npm run build-bundle` | Browser bundle only |
  | `npm run build-bundle-node` | Node.js bundle only |
  | `./scripts/build-runtime-bundle.sh --all` | Both bundles (explicit) |

### What Gets Built

  - **dist/bitmaptext.min.js** - Browser bundle (32KB)
  - **dist/bitmaptext-node.min.js** - Node.js bundle (33KB)
  - Source maps and unminified versions for debugging

  For detailed rebuild instructions, see **[dist/README.md](dist/README.md#-rebuilding)**.

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

  **loadFont(idString, options): Promise\<void\>**

  Loads a single font (metrics + atlas). Returns a Promise that resolves when the font is loaded, or rejects on error.

  ```javascript
  await BitmapText.loadFont('density-1-0-Arial-style-normal-weight-normal-size-18-0', {
    isFileProtocol: false,           // Optional: set true for file:// protocol
    onProgress: (loaded, total) => { // Optional: progress callback
      console.log(`${loaded}/${total} files loaded`);
    }
  });
  ```

  **loadFonts(idStrings, options): Promise\<void\>**

  Loads multiple fonts in parallel. Returns a Promise that resolves when all fonts are loaded, or rejects on error.

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
  - **x_CssPx**: Position in CSS pixels (absolute from canvas origin)
  - **y_CssPx**: Position in CSS pixels (absolute from canvas origin; represents position of the specified baseline - see textBaseline property)
  - **fontProperties**: FontProperties instance
  - **textProperties**: TextProperties instance (optional)

#### Query Methods

  **hasMetrics(idString: string): boolean** - Check if metrics are loaded for a specific font

  **hasAtlas(idString: string): boolean** - Check if atlas is loaded for a specific font

  **hasFont(idString: string): boolean** - Check if both metrics and atlas are loaded

  ```javascript
  const isLoaded = BitmapText.hasFont('density-1-0-Arial-style-normal-weight-normal-size-18-0');
  if (!isLoaded) {
    await BitmapText.loadFont('density-1-0-Arial-style-normal-weight-normal-size-18-0');
  }
  ```

#### Unloading Methods

  **unloadMetrics(idString: string): void** - Remove metrics from memory for a specific font

  **unloadAtlas(idString: string): void** - Remove atlas from memory for a specific font

  **unloadFont(idString: string): void** - Remove both metrics and atlas from memory

  **unloadFonts(idStrings: string[]): void** - Remove multiple fonts from memory

  **unloadAllFonts(): void** - Remove all fonts (metrics and atlases) from memory

  **unloadAllAtlases(): void** - Remove all atlases from memory (keeps metrics)

  ```javascript
  // Unload a specific font to free memory
  BitmapText.unloadFont('density-1-0-Arial-style-normal-weight-normal-size-18-0');

  // Unload all atlases (keeps metrics for measurement)
  BitmapText.unloadAllAtlases();
  ```

#### Registration Methods (Called by Font Assets)

  **registerMetrics(idString, compactedData)**: Register font metrics
  **registerAtlas(idString, base64Data)**: Register atlas image

  These are called automatically when font asset files are loaded.

### StatusCode Module

  The StatusCode module provides status codes and helper functions for handling rendering results.

  **Using Production Bundle (Recommended):**
  ```html
  <!-- StatusCode is included in the bundle, no special import needed -->
  <script src="dist/bitmaptext.min.js"></script>

  <script>
    // StatusCode is automatically available globally
    if (result.status.code === StatusCode.SUCCESS) {
      console.log('Rendering successful');
    }
  </script>
  ```

  **Using Individual Source Files (Development):**

  When loading individual source files in browsers with script tags, **StatusCode.js must be loaded before BitmapText.js** because BitmapText depends on the StatusCode constants.

  ```html
  <!-- Load StatusCode first -->
  <script src="src/runtime/StatusCode.js"></script>

  <!-- Then load other runtime classes -->
  <script src="src/runtime/FontProperties.js"></script>
  <script src="src/runtime/TextProperties.js"></script>
  <!-- ... other files ... -->
  <script src="src/runtime/BitmapText.js"></script>
  ```

  **Using ES Modules:**
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
- **textAlign**: String (default: "left") - Horizontal text alignment. Supported values:
  - `"left"`: Text starts at x-coordinate (leftmost alignment, BitmapText default)
  - `"center"`: Text is centered at x-coordinate (midpoint alignment)
  - `"right"`: Text ends at x-coordinate (rightmost alignment)
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

## Build Instructions

### Development Setup

  ```bash
  # Clone repository
  git clone [repository-url]

  # Serve locally (required for CORS)
  python -m http.server
  # or
  npx http-server

  # Open in browser
  http://localhost:8000/public/font-assets-builder.html
  ```

### Building Font Data

  1. Configure specs in src/specs/default-specs.js or via UI
  2. Use Font Builder to generate atlases
  3. Compressed data saved to font-assets/

## Testing and Examples

  **Minimal Demo**
  Open `public/hello-world-demo.html` for a simple "Hello World" example showing basic usage.

  **Multi-Size Demo**
  Open `public/hello-world-multi-size.html` to see text rendered at multiple font sizes (18, 18.5, 19), demonstrating the complexity of loading multiple bitmap font configurations.

  **Baseline & Alignment Demo**
  Open `public/baseline-alignment-demo.html` for an interactive demonstration of all baseline and alignment combinations, with side-by-side comparison of BitmapText vs native Canvas rendering. Includes controls for font selection, size, pixel density, and text samples.

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
  Open `public/test-renderer.html` to run visual tests and hash verification.

  Tests verify:
  - Pixel-identical rendering consistency
  - Kerning accuracy
  - Multi-line text layout
  - Cross-browser compatibility

  **Automated Browser Testing**
  Capture screenshots of browser rendering using Playwright:
  ```bash
  node scripts/screenshot-with-playwright.js
  node scripts/screenshot-with-playwright.js --url public/baseline-alignment-demo.html --output baseline.png
  ```

  See `docs/AUTOMATED_BROWSER_CANVAS_VERIFICATION_IN_CLAUDE_CODE_WEB.md` and `scripts/README.md` for details.

  **Performance Benchmarks**

  Comprehensive performance testing suite with two benchmark types:

  **1. Rendering Benchmarks** (drawTextFromAtlas performance)

  Browser tests use three-phase progressive FPS testing:
  - Open `perf/browser/rendering-benchmark.html` (unbundled) or `rendering-benchmark-bundled.html` (bundled)
  - Finds exact performance ceiling (±5 blocks accuracy) at 60fps
  - Compares BitmapText vs HTML5 Canvas (black/colored text)

  Node.js tests use adaptive timing:
  ```bash
  ./perf/node/run-rendering-benchmarks.sh
  ```
  - Tests bundled and unbundled versions
  - Measures render time across different block sizes and colors
  - Generates HTML reports and JSON data

  **2. Measurement Benchmarks** (measureText performance)

  Browser tests measure text dimension calculation speed:
  - Open `perf/browser/measurement-benchmark.html` (unbundled) or `measurement-benchmark-bundled.html` (bundled)
  - Tests text length scaling, kerning overhead, repeated measurements
  - Compares with Canvas.measureText()

  Node.js tests verify linear O(n) scaling:
  ```bash
  ./perf/node/run-measurement-benchmarks.sh
  ```
  - Tests 5-500 character strings
  - Quantifies kerning overhead (~50%)
  - Confirms sub-microsecond performance

  **What's Measured:**
  - Font loading performance
  - Rendering: Peak capacity at 60fps, render time per operation
  - Measurement: Text dimension calculation speed, kerning overhead
  - Fast path (black) vs slow path (colored text)
  - Bundled vs unbundled performance

  See `perf/README.md` for complete documentation, methodology, and interpretation guide.

## Troubleshooting

  **CORS Issues**
  - Always serve files via HTTP server, not file:// protocol
  - Use `python -m http.server` or `npx http-server` for local development
  - Required for loading PNG atlases and calculating hashes
  - For file:// protocol: Convert images to JS files using `node scripts/image-to-js-converter.js [directory] --all`

  **QOI Format and Pipeline**
  - Browser exports QOI format
  - Pipeline converts: QOI → PNG (intermediate) → WebP (final browser format)
  - Use `node scripts/qoi-to-png-converter.js [directory]` to manually convert QOI→PNG
  - Use `./scripts/convert-png-to-webp.sh [directory]` to convert PNG→WebP
  - QOI files preserved for Node.js usage
  - Automated pipeline: `./scripts/watch-font-assets.sh` handles all conversions

  **Rendering Issues**
  - Ensure canvases are attached to DOM before rendering for crisp text
  - Check pixel density scaling is applied correctly
  - Verify font data is loaded before attempting to render
  - If you see simplified black rectangles instead of text, atlases are missing but metrics are loaded (placeholder mode)

  **Node.js Issues**
  - Canvas factory configuration is required: `BitmapText.configure({ canvasFactory: () => new Canvas() })`
  - Must call `BitmapText.configure()` before loading fonts
  - Font directory may need configuration if running from non-standard location

  **Performance Issues**
  - Pre-load atlases during initialization
  - BitmapText is a static class (no instances created) - pre-load fonts and cache measurements for best performance
  - Consider caching frequently used text measurements

## Image Formats

  BitmapText.js uses different image formats optimized for each platform:

  **Browser (WebP):**
  - Lossless compression (pixel-identical to PNG)
  - 5-10% smaller than optimized PNG
  - Native browser support (Safari 14+, Chrome, Firefox, Edge)
  - Used for atlas loading via `<img>` or JS wrappers

  **Node.js (QOI):**
  - Lightweight decoder (~200 lines)
  - No external dependencies
  - Direct loading from font-assets/

  **Export (QOI):**
  - Simple browser export format
  - Pipeline converts: QOI → PNG (intermediate) → WebP (browser delivery)

## Browser Support

  Modern browsers with WebP (lossless) support:
  - Chrome/Edge 90+
  - Firefox 88+
  - Safari 14+ (September 2020)
  - Mobile browsers (iOS 14+, Android 5+)

  **Minimum requirement: Safari 14** for WebP support

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
  ├── examples/          # Example applications
  │   └── node/         # Node.js demo applications
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