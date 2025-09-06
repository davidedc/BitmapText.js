# BitmapText.js Scripts Usage Guide

## 🚀 Quick Start

### Running the Automated Pipeline

1. **Start the monitoring script** (from project root):
   ```bash
   ./scripts/watch-glyph-sheets.sh
   ```

2. **Generate fonts** using the font-builder:
   - Open `public/font-builder.html` in your browser
   - Configure your font settings
   - Click "Download Glyph Sheets"
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
./scripts/watch-glyph-sheets.sh [options]
```

**Options:**
- `--preserve-originals` - Keep .orig.png backup files after optimization
- `--no-preserve-originals` - Remove .orig.png backup files (default)
- `--help` - Show help message

**Examples:**
```bash
./scripts/watch-glyph-sheets.sh                    # Default: remove backups
./scripts/watch-glyph-sheets.sh --preserve-originals    # Keep .orig.png files
./scripts/watch-glyph-sheets.sh --no-preserve-originals # Explicitly remove backups
```

**What it does:**
- Monitors `~/Downloads/glyphSheets.zip`
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

### 3. Node.js Demo Build Script
```bash
./scripts/build-node-demo.sh
```

**What it does:**
- Concatenates existing source files into a single Node.js executable
- Includes Canvas mock, utilities, image libraries, and core classes
- Creates `examples/node/hello-world-node.js` with proper permissions
- Maintains single source of truth for all components

**Source files used:**
- `src/node/canvas-mock.js` - Minimal Canvas implementation
- `src/utils/nested-properties.js` - Nested object utilities
- `src/minification/MetricsExpander.js` - Font metrics expansion
- `lib/QOIDecode.js`, `lib/PngEncoder.js`, `lib/PngEncodingOptions.js` - Image libraries
- `src/core/BitmapGlyphStore.js`, `src/core/BitmapText.js` - Core classes
- `src/node/hello-world-main.js` - Main execution code

**Output:**
- Self-contained executable: `examples/node/hello-world-node.js`
- File size: ~52KB, ~1450 lines
- No external dependencies required

### 4. PNG to JS Converter Script
```bash
node scripts/png-to-js-converter.js [directory]
```
**Examples:**
```bash
node scripts/png-to-js-converter.js           # Uses font-assets/ directory
node scripts/png-to-js-converter.js font-assets/     # Explicitly specify font-assets/
node scripts/png-to-js-converter.js /path/to/pngs/  # Use custom directory
```

### 5. QOI Memory Calculator Script
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

---

## 📁 File Structure

```
scripts/
├── watch-glyph-sheets.sh     # Main monitoring script
├── optimize-images.sh        # PNG compression
├── png-to-js-converter.js    # PNG → JS wrapper conversion
├── qoi-memory-calculator.js  # QOI memory usage analyzer
├── test-pipeline.sh          # One-time pipeline test
└── README.md                 # This file

font-assets/
├── *.png                     # Optimized glyph sheet images
├── *.orig.png                # Original glyph sheets (if --preserve-originals used)
├── *.js                      # Glyph data and metrics
├── image-*.js                # JS-wrapped images (for CORS-free loading)
├── manifest.js               # Font manifest
└── data-backup-*.zip         # Automatic backups
```

---

## 🔄 Pipeline Workflow

When you drop `glyphSheets.zip` in `~/Downloads/`:

1. **🔍 Detection**: `fswatch` detects the new file
2. **📦 Backup**: Current `font-assets/` → `data-backup-YYYY-MM-DD-HHMMSS.zip`
3. **🧹 Clear**: Empty `font-assets/` directory (keeping backups)
4. **📂 Extract**: Unzip contents to `font-assets/`
5. **🖼️ Optimize**: Compress PNGs with ImageOptim (optionally preserve originals)
6. **🔧 Convert**: Create JS wrappers for CORS-free loading
7. **🗑️ Cleanup**: Move processed zip to trash
8. **🔄 Continue**: Return to monitoring

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
- Look for `glyphSheets/` subdirectory in `font-assets/`
- Script should automatically move files to root

**Script keeps running/won't stop**
```bash
# Kill all related processes
pkill -f "watch-glyph-sheets"
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

1. **Always run from project root**: `./scripts/watch-glyph-sheets.sh`
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