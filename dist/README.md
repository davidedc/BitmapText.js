# BitmapText.js Runtime Bundles

Production-ready minified bundles for BitmapText.js bitmap text rendering library.

## 📦 Files

### Browser Bundle
- **`bitmaptext.js`** - Unminified runtime (149KB, for debugging)
- **`bitmaptext.min.js`** - Minified runtime (32KB, for production) ✨
- **`bitmaptext.min.js.map`** - Source map for debugging minified code

### Node.js Bundle
- **`bitmaptext-node.js`** - Unminified runtime (153KB, for debugging)
- **`bitmaptext-node.min.js`** - Minified runtime (33KB, for production) ✨
- **`bitmaptext-node.min.js.map`** - Source map for debugging minified code

---

## 🚀 Quick Start

### Browser Usage

```html
<!DOCTYPE html>
<html>
<head>
  <title>BitmapText Demo</title>
</head>
<body>
  <canvas id="myCanvas" width="400" height="100"></canvas>

  <!-- Single script tag - complete runtime -->
  <script src="dist/bitmaptext.min.js"></script>

  <script>
    // Create font configuration
    const fontProps = new FontProperties(
      1,          // pixelDensity (1.0 = standard, 2.0 = Retina)
      "Arial",    // fontFamily
      "normal",   // fontStyle
      "normal",   // fontWeight
      19          // fontSize in CSS pixels
    );

    // Optional: Configure font directory
    BitmapText.setFontDirectory('./font-assets/');

    // Load font and render
    const canvas = document.getElementById('myCanvas');
    const ctx = canvas.getContext('2d');

    BitmapText.loadFont(fontProps.idString).then(() => {
      BitmapText.drawTextFromAtlas(ctx, "Hello World", 10, 50, fontProps);
    });
  </script>
</body>
</html>
```

### Node.js Usage

The Node.js bundle excludes platform-specific dependencies. You must provide your own Canvas implementation.

```javascript
// Import Canvas implementation (user's choice)
import { createCanvas } from 'node-canvas';  // or 'skia-canvas', 'canvas', etc.

// Import BitmapText bundle
import './dist/bitmaptext-node.min.js';

// Configure with your Canvas
BitmapText.configure({
  fontDirectory: './font-assets/',
  canvasFactory: () => createCanvas()
});

// Create font configuration
const fontProps = new FontProperties(1, "Arial", "normal", "normal", 19);

// Load font and render
await BitmapText.loadFont(fontProps.idString);

const canvas = createCanvas(400, 100);
const ctx = canvas.getContext('2d');

BitmapText.drawTextFromAtlas(ctx, "Hello World", 10, 50, fontProps);

// Export canvas (requires separate PNG encoder)
import { PngEncoder } from './lib/PngEncoder.js';
import fs from 'fs';
fs.writeFileSync('output.png', PngEncoder.encode(canvas));
```

---

## 📚 What's Included

The bundles contain everything needed for rendering bitmap text:

### Core Runtime Classes
- **StatusCode** - Status reporting constants and helpers
- **FontProperties** - Immutable font configuration
- **TextProperties** - Text rendering properties (kerning, baseline, alignment, color)
- **FontMetrics** - Font metrics domain object
- **BitmapText** - Main static rendering class (includes CHARACTER_SET constant)

### Font Loading
- **FontLoader** - Platform-specific font loading (browser or Node.js)
- **FontLoaderBase** - Shared font loading logic
- **MetricsExpander** - Expands minified font metrics data

### Atlas Management
- **AtlasImage** - Atlas image domain object
- **AtlasPositioning** - Glyph positioning data
- **AtlasData** - Combined atlas image + positioning
- **TightAtlasReconstructor** - Runtime atlas reconstruction
- **AtlasReconstructionUtils** - Image data extraction utilities
- **AtlasCellDimensions** - Cell dimension calculations

### Data Storage
- **AtlasDataStore** - Atlas data storage (static class)
- **FontMetricsStore** - Font metrics storage (static class)
- **FontManifest** - Font registry management (for test-renderer)

### Node.js Specific (node bundle only)
- **QOIDecode** - QOI image decoder for loading font atlases

---

## ❌ What's NOT Included

### Browser Bundle
The browser bundle is complete for text rendering. No additional dependencies needed.

### Node.js Bundle
You must provide separately:

1. **Canvas Implementation** - User's choice of:
   - `node-canvas` - Native Canvas API for Node.js (most popular)
   - `skia-canvas` - Hardware-accelerated alternative
   - `canvas` - Pure JavaScript Canvas implementation
   - Or any custom Canvas-compatible implementation

2. **PNG Encoder (optional)** - For exporting images to filesystem:
   - `lib/PngEncoder.js` - Included in demo bundles but separate from library
   - Image I/O is not core rendering functionality

---

## 🎯 Bundle Sizes

| Bundle | Unminified | Minified | Reduction |
|--------|-----------|----------|-----------|
| Browser | 149KB | **32KB** | 79% |
| Node.js | 153KB | **33KB** | 79% |

**Note:** Font asset files are separate (metrics ~1-2KB each, atlases ~2-5KB each).

---

## 🔨 Rebuilding

To rebuild the bundles from source:

```bash
# Build browser bundle only (default)
./scripts/build-runtime-bundle.sh

# Build Node.js bundle only
./scripts/build-runtime-bundle.sh --node

# Build both bundles
./scripts/build-runtime-bundle.sh --all

# Using npm
npm run build-bundle        # Browser only
npm run build-bundle-all    # Both bundles
```

---

## 📖 Examples

See the bundled demo files for complete working examples:

- **`public/hello-world-demo-bundled.html`** - Basic single-size demo
- **`public/hello-world-multi-size-bundled.html`** - Multi-size font loading
- **`public/baseline-alignment-demo-bundled.html`** - Interactive baseline/alignment demo
- **`public/test-renderer-bundled.html`** - Full test suite with hash verification

---

## 🐛 Debugging

### Using Source Maps

The minified bundles include source maps for debugging:

```html
<!-- Browser DevTools will automatically load the source map -->
<script src="dist/bitmaptext.min.js"></script>
```

Set breakpoints in original source files, inspect variables, and see readable stack traces.

### Using Unminified Bundle

For development, use the unminified version:

```html
<!-- Easier to debug without source maps -->
<script src="dist/bitmaptext.js"></script>
```

### Using Individual Source Files

For maximum debugging flexibility, use the individual source files:

```html
<!-- Original demos load 17 separate files -->
<!-- See public/hello-world-demo.html for example -->
```

---

## 🔗 Additional Resources

- **Main README** - API documentation and usage guide
- **Architecture docs** - System design (docs/ARCHITECTURE.md)
- **Build scripts** - Automation documentation (scripts/README.md)
- **Font generation** - Font assets builder (public/font-assets-builder.html)

---

## 📝 License

SEE LICENSE IN LICENSE
