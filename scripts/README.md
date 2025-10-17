# BitmapText.js Scripts Usage Guide

## 🚀 Quick Start

### Running the Automated Pipeline

1. **Start the monitoring script** (from project root):
   ```bash
   ./scripts/watch-font-assets.sh
   ```

2. **Build font assets** using the font assets builder:
   - Open `public/font-assets-builder.html` in your browser
   - Configure your font settings
   - Click "Download Font Assets"
   - The zip file will be automatically processed!

3. **Stop monitoring**: Press `Ctrl+C`

---

## 📋 Prerequisites

### Required Dependencies

Before running any scripts, make sure you have these installed:

```bash
# Install Homebrew (if not already installed)
# Visit: https://brew.sh/

# Install required tools
brew install fswatch        # File system monitoring
brew install node          # JavaScript runtime
brew install --cask imageoptim    # Image optimization app
brew install imageoptim-cli       # ImageOptim command line tool

# Optional but recommended
brew install trash         # Safe file deletion
```

**Important**: You need **BOTH** ImageOptim app and CLI tool for PNG optimization to work.

---

## 🔧 Individual Script Usage

### 1. Main Monitoring Script
```bash
./scripts/watch-font-assets.sh [options]
```

**Options:**
- `--preserve-originals` - Keep .orig.png backup files after optimization
- `--no-preserve-originals` - Remove .orig.png backup files (default)
- `--remove-qoi` - Remove QOI files after successful PNG conversion
- `--keep-positioning` - Preserve positioning JSON files during processing
- `--help` - Show help message

**Examples:**
```bash
./scripts/watch-font-assets.sh                    # Default: remove backups
./scripts/watch-font-assets.sh --preserve-originals    # Keep .orig.png files
./scripts/watch-font-assets.sh --no-preserve-originals # Explicitly remove backups
```

**What it does:**
- Monitors `~/Downloads/fontAssets.zip`
- Creates timestamped backups
- Extracts and processes fonts automatically
- Runs optimization and conversion
- Continues monitoring until stopped

### 2. PNG Optimization Script
```bash
./scripts/optimize-images.sh [options] [directory]
```

**Options:**
- `--preserve-originals` - Keep .orig.png backup files after optimization
- `--no-preserve-originals` - Remove .orig.png backup files (default)
- `--help` - Show help message

**Examples:**
```bash
./scripts/optimize-images.sh                           # Default: font-assets/, remove backups
./scripts/optimize-images.sh --preserve-originals      # font-assets/, keep .orig.png files
./scripts/optimize-images.sh --preserve-originals font-assets/ # Explicit directory, keep backups
./scripts/optimize-images.sh /path/to/pngs/            # Custom directory, remove backups
```

### 3. Node.js Demo Build Scripts
```bash
# Single-size demo
./scripts/build-node-demo.sh

# Multi-size demo
./scripts/build-node-multi-size-demo.sh
# or
npm run build-multi-size-demo
```

**Single-size demo (`build-node-demo.sh`):**
- Concatenates existing source files into a single Node.js executable
- Includes Canvas mock, utilities, image libraries, and core classes
- Creates `examples/node/dist/hello-world.bundle.js` with proper permissions
- Uses `src/node/hello-world-main.js` - renders "Hello World" at size 19

**Multi-size demo (`build-node-multi-size-demo.sh`):**
- Same build process as single-size demo
- Creates `examples/node/dist/hello-world-multi-size.bundle.js`
- Uses `src/node/hello-world-multi-size-main.js` - renders at sizes 18, 18.5, 19
- Demonstrates placeholder rectangle fallback for missing atlases

**Common source files used:**
- `src/platform/canvas-mock.js` - Minimal Canvas implementation
- `src/builder/MetricsExpander.js` - Font metrics expansion
- `lib/QOIDecode.js`, `lib/PngEncoder.js`, `lib/PngEncodingOptions.js` - Image libraries
- `src/runtime/FontLoaderBase.js` - Abstract base class for font loading (shared logic)
- `src/platform/FontLoader-node.js` - Node.js font loader implementation
- `src/runtime/AtlasDataStore.js`, `src/runtime/FontMetricsStore.js`, `src/runtime/BitmapText.js` - Core classes

**Output:**
- Self-contained executables: `examples/node/dist/hello-world.bundle.js`, `examples/node/dist/hello-world-multi-size.bundle.js`
- File size: ~52-58KB, ~1450-1600 lines each
- No external dependencies required

### 4. Image to JS Converter Script
```bash
node scripts/image-to-js-converter.js [directory] [options]
```
**Options:**
- `--png`: Process PNG files only (generates *-png.js files)
- `--qoi`: Process QOI files only (generates *-qoi.js files)
- `--all`: Process both PNG and QOI files (default)
- `--keep-positioning`: Preserve positioning JSON files during processing

**Examples:**
```bash
node scripts/image-to-js-converter.js --all           # Process all images in font-assets/
node scripts/image-to-js-converter.js font-assets --png    # Process PNG files only
node scripts/image-to-js-converter.js /path/to/images --qoi # Process QOI files only
```

### 5. PNG to WebP Converter Script
```bash
./scripts/convert-png-to-webp.sh [directory]
```

**Prerequisites:**
```bash
# macOS
brew install webp

# Ubuntu/Debian
sudo apt-get install webp

# RHEL/CentOS
sudo yum install libwebp-tools
```

**What it does:**
- Converts optimized PNG files to lossless WebP format
- Uses optimal compression: `cwebp -lossless -z 9 -m 6 -mt`
- **Deletes source PNG files after successful conversion**
- Checks for cwebp command existence with installation instructions
- Reports file sizes and compression ratios

**Compression details:**
- `-lossless`: Pixel-identical compression (no quality loss)
- `-z 9`: Maximum compression effort (0-9 scale)
- `-m 6`: Best compression method (0-6 scale)
- `-mt`: Multi-threading for faster processing

**Examples:**
```bash
./scripts/convert-png-to-webp.sh                    # Process files in font-assets/
./scripts/convert-png-to-webp.sh /path/to/pngs/    # Custom directory
```

**When to use:**
- Automatically called during watch-font-assets.sh pipeline
- Can be run manually after PNG optimization
- Typically achieves 5-10% additional size reduction over PNG

**File size savings:**
- ~5-10% reduction compared to ImageOptim-optimized PNG
- Example: 2646 bytes (PNG) → 2430 bytes (WebP) = 8% savings
- Scales with number of font configurations
- Modern browser requirement: Safari 14+ (September 2020)

### 6. QOI to PNG Converter Script
```bash
node scripts/qoi-to-png-converter.js [directory] [options]
```

**Options:**
- `--remove-qoi` - Remove QOI files after successful conversion
- `--help, -h` - Show help message

**Examples:**
```bash
node scripts/qoi-to-png-converter.js                    # Convert QOI files in font-assets/
node scripts/qoi-to-png-converter.js data/              # Convert QOI files in data/ directory
node scripts/qoi-to-png-converter.js --remove-qoi       # Convert and remove QOI files
node scripts/qoi-to-png-converter.js data/ --remove-qoi # Custom directory, remove QOI files
```

**What it does:**
- Converts QOI image files to uncompressed PNG format
- Uses the project's built-in QOI decoder and PNG encoder libraries
- Processes all .qoi files in the specified directory
- Optionally removes source QOI files after successful conversion
- Provides detailed feedback on conversion progress and results
- Reports file sizes and conversion statistics

**When to use:**
- After extracting font assets that include QOI files
- When you need PNG versions for compatibility or debugging
- As part of the automated pipeline for font asset processing
- When transitioning from QOI to PNG format for specific workflows

### 7. QOI Memory Calculator Script
```bash
node scripts/qoi-memory-calculator.js [directory]
# or
npm run qoi-memory
```

**Options:**
- `--help, -h` - Show help message

**Examples:**
```bash
node scripts/qoi-memory-calculator.js                    # Default: font-assets/ directory
node scripts/qoi-memory-calculator.js font-assets/              # Explicitly specify font-assets/
node scripts/qoi-memory-calculator.js /path/to/qoi/      # Custom directory
npm run qoi-memory                                       # Using npm script
```

**What it does:**
- Analyzes all QOI files in the specified directory
- Extracts dimensions from QOI headers without full decoding
- Calculates uncompressed memory: width × height × 4 bytes (RGBA)
- Shows per-file statistics and total memory usage
- Displays compression ratios and memory savings
- Identifies largest files by uncompressed size

### 8. Font Registry Generator Script
```bash
node scripts/generate-font-registry.js [options]
# or
npm run generate-registry
```

**Options:**
- `--help, -h` - Show help message
- `--verbose, -v` - Show verbose output

**Examples:**
```bash
node scripts/generate-font-registry.js                    # Generate registry from font-assets/
node scripts/generate-font-registry.js --verbose          # Show detailed processing information
npm run generate-registry                                 # Using npm script
```

**What it does:**
- Scans font-assets/ directory for metrics-*.js files
- Extracts font IDs from filenames (e.g., metrics-{ID}.js → {ID})
- Generates font-registry.js with FontManifest.addFontIDs() call
- Saves to font-assets/font-registry.js for use by test-renderer.html
- Provides detailed feedback and error handling

**When to use:**
- After extracting font assets from fontAssets.zip
- When you want to run test-renderer.html to view all available fonts
- After manually adding/removing font assets
- When font-registry.js is missing or outdated

---

## 📁 File Structure

```
scripts/
├── watch-font-assets.sh          # Main monitoring script
├── optimize-images.sh            # PNG compression (intermediate format)
├── convert-png-to-webp.sh        # PNG → WebP conversion (browser delivery)
├── qoi-to-png-converter.js       # QOI → PNG conversion (intermediate step)
├── image-to-js-converter.js      # Image → JS wrapper conversion (WebP/QOI)
├── qoi-memory-calculator.js      # QOI memory usage analyzer
├── generate-font-registry.js     # Font registry generator
├── test-pipeline.sh              # One-time pipeline test
└── README.md                     # This file

font-assets/
├── *.webp                    # WebP atlas images (browser delivery)
├── *.qoi                     # QOI atlas images (Node.js usage)
├── *.js                      # Glyph data and metrics
├── *-webp.js                 # JS-wrapped WebP images (for file:// protocol)
├── *-qoi.js                  # JS-wrapped QOI images (for file:// protocol)
├── font-registry.js          # Auto-generated font registry
└── font-assets-backup-*.zip  # Automatic backups
```

---

## 🔄 Pipeline Workflow

When you drop `fontAssets.zip` in `~/Downloads/`:

1. **🔍 Detection**: `fswatch` detects the new file
2. **📦 Backup**: Current `font-assets/` → `font-assets-backup-YYYY-MM-DD-HHMMSS.zip`
3. **🧹 Clear**: Empty `font-assets/` directory (keeping backups)
4. **📂 Extract**: Unzip contents to `font-assets/`
5. **🎨 Convert QOI**: Convert QOI files to PNG format (optional --remove-qoi)
6. **🖼️ Optimize PNG**: Compress PNGs with ImageOptim (intermediate format)
7. **🌐 Convert to WebP**: Convert PNG→WebP with cwebp, delete source PNGs (browser delivery)
8. **🔧 Convert to JS**: Create JS wrappers from WebP and QOI for CORS-free loading
9. **📋 Generate Registry**: Generate font registry from metrics files
10. **🗑️ Cleanup**: Move processed zip to trash
11. **🔄 Continue**: Return to monitoring

---

## ❗ Troubleshooting

### Common Issues

**"fswatch: command not found"**
```bash
brew install fswatch
```

**"imageoptim: command not found"**
```bash
brew install --cask imageoptim
brew install imageoptim-cli
```

**"node: command not found"**
```bash
brew install node
```

**Files not in expected location**
- Check that extraction worked correctly
- Look for `fontAssets/` subdirectory in `font-assets/`
- Script should automatically move files to root

**Script keeps running/won't stop**
```bash
# Kill all related processes
pkill -f "watch-font-assets"
pkill -f "fswatch"
```

**Permission denied**
```bash
chmod +x scripts/*.sh
```

### Debug Mode

All scripts include detailed logging with timestamps. Look for:
- `[INFO]` - Normal operation
- `[SUCCESS]` - Completed successfully  
- `[WARNING]` - Non-fatal issues
- `[ERROR]` - Fatal problems

### Manual Testing

Test the pipeline without monitoring:
```bash
./scripts/test-pipeline.sh
```

---

## 🎯 Tips & Best Practices

1. **Always run from project root**: `./scripts/watch-font-assets.sh`
2. **Check logs**: Scripts provide detailed feedback
3. **Backup safety**: Automatic backups are created before processing
4. **Browser compatibility**: JS wrappers solve CORS issues for file:// protocol
5. **Performance**: ImageOptim provides significant size savings
6. **Original preservation**: Use `--preserve-originals` to keep unoptimized backups for comparison
7. **Storage optimization**: Use default behavior to save disk space by removing .orig.png files

---

## 🛠️ Development Notes

- Scripts are designed to be run independently or as part of the pipeline
- All scripts support directory parameters for flexibility
- Comprehensive error checking and dependency validation
- Cross-compatible with different project structures