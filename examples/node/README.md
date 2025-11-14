# BitmapText.js Node.js Examples

## ⚠️ Important: These are BUILT/BUNDLED Files

The files in this directory are **generated/bundled executables**, not source code examples. They are created by concatenating multiple source files into standalone Node.js scripts with no external dependencies.

## Directory Structure

```
examples/node/
├── README.md                              # This file
├── dist/                                 # Built/bundled demo files
│   ├── hello-world.bundle.js             # Single-size demo (~205KB)
│   ├── hello-world-multi-size.bundle.js  # Multi-size demo (~207KB)
│   ├── small-sizes.bundle.js             # Small sizes interpolation demo (~214KB)
│   ├── hello-world-bundled.js            # Single-size with runtime bundle (~43KB)
│   ├── hello-world-multi-size-bundled.js # Multi-size with runtime bundle (~45KB)
│   ├── small-sizes-bundled.js            # Small sizes with runtime bundle (~46KB)
│   └── font-assets/                      # Font data files (copied from root)
└── [source examples would go here]       # Future: Simple source examples
```

## Built Demos

### `dist/hello-world.bundle.js`
- **Purpose**: Demonstrates basic bitmap text rendering at font size 19
- **Output**: Creates `hello-world-output.png` (300×120) in current directory
- **Features**:
  - Renders "Hello World" in black (fast path) and blue (colored slow path)
  - QOI atlas loading for Node.js environment
  - Uses BitmapText static API for unified font loading
  - Demonstrates performance difference between black and colored text rendering
- **Source**: Built from `src/node/hello-world-main.js` + core library files
- **Usage**: `node examples/node/dist/hello-world.bundle.js`
- **Size**: ~196KB standalone executable

### `dist/hello-world-multi-size.bundle.js`
- **Purpose**: Demonstrates multi-size font rendering (18, 18.5, 19)
- **Output**: Creates `hello-world-multi-size-output.png` (700×200) in current directory
- **Features**:
  - Renders text in two columns: black (fast path) and blue (colored slow path)
  - Multi-size font loading using BitmapText.loadFonts() batch API
  - Placeholder rectangle fallback for missing atlases
  - Demonstrates graceful degradation and performance differences
- **Source**: Built from `src/node/hello-world-multi-size-main.js` + core library files
- **Usage**: `node examples/node/dist/hello-world-multi-size.bundle.js`
- **Size**: ~207KB standalone executable

### `dist/small-sizes.bundle.js`
- **Purpose**: Demonstrates small font size interpolation (sizes 0-8.5px)
- **Output**: Creates `small-sizes-output.png` (800×1100) in current directory
- **Features**:
  - Loads only 8.5px metrics - all smaller sizes interpolate automatically
  - Two sections: visual rendering (placeholder rectangles) and measurements with boxes
  - Shows accurate text measurements work with interpolated metrics
  - Console output provides detailed size labels, status, and measurements
  - Demonstrates that no atlas/metrics needed for sizes < 8.5px
- **Source**: Built from `src/node/small-sizes-main.js` + core library files
- **Usage**: `node examples/node/dist/small-sizes.bundle.js`
- **Size**: ~214KB standalone executable

### Runtime-Bundle Versions

The `*-bundled.js` versions use the production runtime bundle (`dist/bitmaptext-node.min.js`) instead of concatenating all source files. They demonstrate the production pattern where users provide Canvas/PNG encoder and the library provides rendering.

- **`hello-world-bundled.js`**: Single-size demo with runtime bundle (~43KB)
- **`hello-world-multi-size-bundled.js`**: Multi-size demo with runtime bundle (~45KB)
- **`small-sizes-bundled.js`**: Small sizes demo with runtime bundle (~46KB)

Each bundled version has identical functionality to its standalone counterpart but with smaller file size (~78% reduction) by sharing the common runtime bundle.

## How to Run

```bash
# From project root directory
cd /path/to/BitmapText.js

# Build everything and run all demos (RECOMMENDED)
npm run demo
# This runs: npm run build && npm run build-node-demos && npm run run-node-demos

# Or step-by-step:
npm run build              # Build runtime bundles
npm run build-node-demos   # Build all Node.js demos (standalone + bundled)
npm run run-node-demos     # Run all 6 demos with summary

# Or run individual demos manually (after building):
node examples/node/dist/hello-world.bundle.js
node examples/node/dist/hello-world-multi-size.bundle.js
node examples/node/dist/small-sizes.bundle.js
node examples/node/dist/hello-world-bundled.js
node examples/node/dist/hello-world-multi-size-bundled.js
node examples/node/dist/small-sizes-bundled.js
```

### Font Asset Setup

The bundled demos expect font assets in `examples/node/dist/font-assets/`. The `./run-node-demos.sh` script handles this automatically, or you can set it up manually:

```bash
# Manual setup (if not using run-node-demos.sh)
mkdir -p examples/node/dist/font-assets
cp font-assets/*-qoi.js examples/node/dist/font-assets/
cp font-assets/metrics-*.js examples/node/dist/font-assets/
```

## Source Code Locations

**DO NOT edit the bundled files directly.** To modify these demos:

### For the single-size demo:
1. **Main logic**: `src/node/hello-world-main.js`
2. **Platform-specific font loading**: `src/platform/FontLoader-node.js` (Node.js implementation, used internally by BitmapText, class name: `FontLoader`)
3. **Font loading base**: `src/runtime/FontLoaderBase.js` (shared logic for both platforms)
4. **Core rendering**: `src/runtime/BitmapText.js` (delegates to stores)
5. **Storage**: `src/runtime/AtlasDataStore.js`, `src/runtime/FontMetricsStore.js` (single source of truth)
6. **Canvas implementation**: `src/platform/canvas-mock.js`
7. **Image libraries**: `lib/QOIDecode.js`, `lib/PngEncoder.js`

### For the multi-size demo:
1. **Main logic**: `src/node/hello-world-multi-size-main.js`
2. **Platform-specific font loading**: `src/platform/FontLoader-node.js` (used internally by BitmapText, unified API, works same as browser)
3. **Core rendering**: Same as above
4. **Other components**: Same as above

### For the small-sizes demo:
1. **Main logic**: `src/node/small-sizes-main.js` (standalone), `src/node/small-sizes-bundled-main.js` (bundled)
2. **Font interpolation**: `src/runtime/InterpolatedFontMetrics.js` (automatically interpolates metrics for sizes < 8.5px)
3. **Canvas mock**: `src/platform/canvas-mock.js` (includes `strokeRect()` for measurement boxes)
4. **Other components**: Same as above

## How to Rebuild

```bash
# Build all Node.js demos (RECOMMENDED)
npm run build-node-demos
# or
./scripts/build-all-node-demos.sh

# Build individual standalone demos:
./scripts/build-node-demo.sh                # hello-world.bundle.js
./scripts/build-node-multi-size-demo.sh     # hello-world-multi-size.bundle.js
./scripts/build-node-small-sizes-demo.sh    # small-sizes.bundle.js

# Build all bundled versions:
./scripts/build-node-bundled-demos.sh       # Builds all 3 bundled versions

# Build and run everything:
npm run demo
```

## Bundle Characteristics

- **Self-contained**: No external dependencies required (but needs font assets)
- **Standalone**: Each file contains all necessary code
- **Executable**: Can be run directly with `node filename.bundle.js`
- **Size**: ~196-199KB each
- **Lines**: ~5,250-5,315 lines each
- **Format**: Concatenated JavaScript with proper module boundaries
- **Font assets**: Expects `font-assets/` directory in same location as bundle

## Understanding the Code Structure

Each bundled file contains these sections in order:
1. **Header**: Usage instructions and warnings
2. **Canvas Mock**: Minimal Canvas API implementation for Node.js
3. **Status Code**: StatusCode constants and helper functions
4. **Configuration Classes**: FontProperties, TextProperties
5. **Font Metrics**: FontMetrics class
6. **Character Set**: CHARACTER_SET constant (204 characters)
7. **Utility Functions**: MetricsExpander for font data expansion
8. **Atlas Classes**: AtlasPositioning, AtlasImage, AtlasData
9. **Reconstruction Utilities**: AtlasReconstructionUtils, TightAtlasReconstructor
10. **Image Libraries**: QOI decoder, PNG encoder
11. **Storage Classes**: AtlasDataStore, FontMetricsStore (single source of truth)
12. **Font Loading**: FontLoaderBase, FontLoader (platform-specific, from src/platform/FontLoader-node.js)
13. **Core Rendering**: BitmapText (delegates to stores)
14. **Demo Logic**: The actual demo code from src/node/
15. **Font Assets**: External font-assets/ directory (not inlined)

## Why Bundled Files?

These demos are bundled for several reasons:
1. **Easy testing**: Single file execution with no setup
2. **No dependencies**: Self-contained Node.js scripts  
3. **Portability**: Can be copied and run anywhere Node.js is installed
4. **Demonstration**: Shows the library can work in Node.js environment
5. **CI/CD friendly**: Simple to run in automated environments

## Need Simple Examples?

If you're looking for simple, readable code examples to understand the API:
- Check `src/node/hello-world-main.js` for basic usage
- Check `src/node/hello-world-multi-size-main.js` for advanced features
- See the browser examples in `public/` directory
- Review the main README.md for API documentation