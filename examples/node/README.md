# BitmapText.js Node.js Examples

## ⚠️ Important: These are BUILT/BUNDLED Files

The files in this directory are **generated/bundled executables**, not source code examples. They are created by concatenating multiple source files into standalone Node.js scripts with no external dependencies.

## Directory Structure

```
examples/node/
├── README.md                           # This file
├── dist/                              # Built/bundled demo files
│   ├── hello-world.bundle.js          # Single-size demo (~54KB)
│   └── hello-world-multi-size.bundle.js  # Multi-size demo (~58KB)
└── [source examples would go here]    # Future: Simple source examples
```

## Built Demos

### `dist/hello-world.bundle.js`
- **Purpose**: Demonstrates basic bitmap text rendering at font size 19
- **Output**: Creates `hello-world-output.png` in current directory
- **Features**: Basic "Hello World" rendering with QOI glyph sheet loading
- **Source**: Built from `src/node/hello-world-main.js` + core library files
- **Usage**: `node examples/node/dist/hello-world.bundle.js`

### `dist/hello-world-multi-size.bundle.js`
- **Purpose**: Demonstrates multi-size font rendering (18, 18.5, 19)
- **Output**: Creates `hello-world-multi-size-output.png` in current directory  
- **Features**: 
  - Multi-size font loading
  - Placeholder rectangle fallback for missing glyph sheets
  - Demonstrates graceful degradation
- **Source**: Built from `src/node/hello-world-multi-size-main.js` + core library files
- **Usage**: `node examples/node/dist/hello-world-multi-size.bundle.js`

## How to Run

```bash
# From project root directory
cd /path/to/BitmapText.js

# Build, set up font assets, and run both demos automatically (RECOMMENDED)
./run-node-demos.sh

# Or run manually (after setting up font assets):
node examples/node/dist/hello-world.bundle.js
node examples/node/dist/hello-world-multi-size.bundle.js
```

### Font Asset Setup

The bundled demos expect font assets in `examples/node/dist/font-assets/`. The `./run-node-demos.sh` script handles this automatically, or you can set it up manually:

```bash
# Manual setup (if not using run-node-demos.sh)
mkdir -p examples/node/dist/font-assets
cp font-assets/*.js examples/node/dist/font-assets/
cp font-assets/*.qoi examples/node/dist/font-assets/
```

## Source Code Locations

**DO NOT edit the bundled files directly.** To modify these demos:

### For the single-size demo:
1. **Main logic**: `src/node/hello-world-main.js`
2. **Core rendering**: `src/core/BitmapText.js`, `src/core/BitmapGlyphStore.js`
3. **Canvas implementation**: `src/node/canvas-mock.js`
4. **Image libraries**: `lib/QOIDecode.js`, `lib/PngEncoder.js`

### For the multi-size demo:
1. **Main logic**: `src/node/hello-world-multi-size-main.js`
2. **Core rendering**: Same as above
3. **Other components**: Same as above

## How to Rebuild

```bash
# Rebuild single-size demo
./scripts/build-node-demo.sh

# Rebuild multi-size demo
./scripts/build-node-multi-size-demo.sh
# or
npm run build-multi-size-demo

# Build both at once
./run-node-demos.sh
```

## Bundle Characteristics

- **Self-contained**: No external dependencies required (but needs font assets)
- **Standalone**: Each file contains all necessary code
- **Executable**: Can be run directly with `node filename.bundle.js`
- **Size**: ~55-58KB each
- **Lines**: ~1540-1608 lines each
- **Format**: Concatenated JavaScript with proper module boundaries
- **Font assets**: Expects `font-assets/` directory in same location as bundle

## Understanding the Code Structure

Each bundled file contains these sections in order:
1. **Header**: Usage instructions and warnings
2. **Canvas Mock**: Minimal Canvas API implementation for Node.js
3. **Utility Functions**: Nested property helpers, metrics expansion
4. **Image Libraries**: QOI decoder, PNG encoder
5. **Core Classes**: BitmapGlyphStore, BitmapText
6. **Demo Logic**: The actual demo code from src/node/
7. **Font Assets**: Inlined font data and metrics

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