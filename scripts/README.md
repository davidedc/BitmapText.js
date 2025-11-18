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
brew install webp          # WebP conversion tools (cwebp)
npm install -g terser      # JavaScript minification

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
# Build all Node.js demos (RECOMMENDED)
npm run build-node-demos
# or
./scripts/build-all-node-demos.sh

# Individual standalone demos:
./scripts/build-node-demo.sh                # hello-world.bundle.js
./scripts/build-node-multi-size-demo.sh     # hello-world-multi-size.bundle.js
./scripts/build-node-small-sizes-demo.sh    # small-sizes.bundle.js

# All bundled versions (use runtime bundle):
./scripts/build-node-bundled-demos.sh       # Builds 3 bundled versions

# Build and run all demos:
npm run demo
```

**Single-size demo (`build-node-demo.sh`):**
- Concatenates existing source files into a single Node.js executable
- Includes Canvas mock, utilities, image libraries, and core classes
- Creates `examples/node/dist/hello-world.bundle.js` (~205KB) with proper permissions
- Uses `src/node/hello-world-main.js` - renders "Hello World" at size 19

**Multi-size demo (`build-node-multi-size-demo.sh`):**
- Same build process as single-size demo
- Creates `examples/node/dist/hello-world-multi-size.bundle.js` (~207KB)
- Uses `src/node/hello-world-multi-size-main.js` - renders at sizes 18, 18.5, 19
- Demonstrates placeholder rectangle fallback for missing atlases

**Small-sizes demo (`build-node-small-sizes-demo.sh`):**
- Same build process as above demos
- Creates `examples/node/dist/small-sizes.bundle.js` (~214KB)
- Uses `src/node/small-sizes-main.js` - tests sizes 0-8.5px
- Demonstrates automatic metric interpolation for sizes < 8.5px
- Two sections: visual rendering (placeholders) + measurements with boxes
- Shows only 8.5px metrics needed for all small sizes

**Bundled versions (`build-node-bundled-demos.sh`):**
- Builds 3 demos that use production runtime bundle (dist/bitmaptext-node.min.js)
- Creates `*-bundled.js` versions (~43-46KB each)
- Demonstrates production pattern: user provides Canvas/PNG, library provides rendering
- 78% smaller than standalone versions by sharing runtime bundle

**Common source files used:**
- `src/platform/canvas-mock.js` - Minimal Canvas implementation (includes strokeRect for measurement boxes)
- `src/runtime/BitmapText.js` - Core rendering class (includes CHARACTER_SET constant)
- `src/runtime/InterpolatedFontMetrics.js` - Automatic metric scaling for sizes < 8.5px
- `src/builder/MetricsExpander.js` - Font metrics expansion
- `lib/QOIDecode.js`, `lib/PngEncoder.js`, `lib/PngEncodingOptions.js` - Image libraries
- `src/runtime/FontLoaderBase.js` - Abstract base class for font loading (shared logic)
- `src/platform/FontLoader-node.js` - Node.js font loader implementation
- `src/runtime/AtlasDataStore.js`, `src/runtime/FontMetricsStore.js` - Storage classes

**Output:**
- Standalone executables: 3 `*.bundle.js` files (~205-214KB each)
- Bundled versions: 3 `*-bundled.js` files (~43-46KB each, require runtime bundle)
- No external dependencies required (but need font assets)
- See `examples/node/README.md` for usage details

### 4. Image to JS Converter Script
```bash
node scripts/image-to-js-converter.js [directory] [options]
```
**Options:**
- `--png`: Process PNG files only (generates *-png.js files)
- `--qoi`: Process QOI files only (generates *-qoi.js files)
- `--all`: Process both PNG and QOI files (default)

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

### 9. Metrics Minifier Build Script
```bash
./scripts/build-metrics-minifier.sh
```

**What it does:**
- Builds a standalone Node.js tool (tools/minify-metrics.js) by concatenating source files
- Re-uses the EXACT same code as font-assets-builder.html for minification
- Includes: StatusCode.js, BitmapText.js (with CHARACTER_SET), FontMetrics.js, MetricsMinifier.js, MetricsExpander.js, deep-equal.js
- No external dependencies (self-contained executable)

**Output:**
- Executable: `tools/minify-metrics.js` (~53KB)
- Can be run directly: `./tools/minify-metrics.js`

**When to use:**
- When testing different minification strategies in MetricsMinifier.js
- After modifying minification/expansion logic
- To rebuild the tool with updated source files

**Usage after building:**
```bash
# Show help and all options
./tools/minify-metrics.js --help

# Test minification (default: no comparison with production files)
./tools/minify-metrics.js

# Validate tool output matches production exactly (for tool validation only)
./tools/minify-metrics.js --verify-exact
```

**What the generated tool does:**
1. Finds all `*-full.js` files in font-assets/
2. Extracts full metricsData from each file
3. Runs `MetricsMinifier.minifyWithVerification()`:
   - Minifies data (Tier 1-7 optimizations)
   - Expands back using MetricsExpander
   - Compares with original (roundtrip verification)
   - Throws error if mismatch detected
4. Outputs minified `.js` files (EXACT production format)
5. Reports statistics and verification results

**Example output:**
```bash
$ ./tools/minify-metrics.js

🔬 Metrics Minification & Verification
════════════════════════════════════════════════════════════
Found 3 full metrics file(s) to process

✅ metrics-density-1-0-Arial-style-normal-weight-normal-size-19-0-full.js
   → metrics-density-1-0-Arial-style-normal-weight-normal-size-19-0-full-minified.js
   ID: density-1-0-Arial-style-normal-weight-normal-size-19-0
   Original: 77,074 chars
   Minified: 3,123 chars
   Saved: 73,951 chars (95.9% reduction)
   ✓ Roundtrip verification passed
```

**Prerequisites:**
To get `*-full.js` files:
1. Open `public/font-assets-builder.html` in browser
2. Configure font settings
3. Check "Include non-minified metrics files"
4. Click "Download font assets"
5. Extract `fontAssets.zip` to font-assets/

**Development workflow:**
```bash
# 1. Modify minification strategy in src/builder/MetricsMinifier.js
# 2. Rebuild the tool
./scripts/build-metrics-minifier.sh

# 3. Test on real font data (default: no comparison, just minify + roundtrip verify)
./tools/minify-metrics.js

# 4. Examine output files
cat font-assets/metrics-*-full-minified.js

# Optional: Validate tool produces identical output to browser (one-time check)
./tools/minify-metrics.js --verify-exact
```

**Note:** Default behavior does NOT compare with production files, allowing you to freely test new minification strategies. Use `--verify-exact` only when validating the tool itself produces identical output to the browser font-assets-builder.

### 10. Runtime Bundle Build Script
```bash
./scripts/build-runtime-bundle.sh [--browser] [--node] [--all]
```

**Options:**
- `--browser` - Build browser bundle only (default)
- `--node` - Build Node.js bundle only
- `--all` - Build both bundles

**Examples:**
```bash
./scripts/build-runtime-bundle.sh                    # Browser bundle only
./scripts/build-runtime-bundle.sh --node            # Node.js bundle only
./scripts/build-runtime-bundle.sh --all             # Both bundles
npm run build-bundle                                 # Browser (via npm)
npm run build-bundle-all                            # Both (via npm)
```

**What it does:**
- Concatenates runtime source files in dependency order
- Generates unminified bundles for debugging (dist/bitmaptext.js, dist/bitmaptext-node.js)
- Minifies with terser (dist/bitmaptext.min.js, dist/bitmaptext-node.min.js)
- Creates source maps for debugging minified code
- Reports file sizes and compression ratios

**Output:**
- **Browser bundle:** dist/bitmaptext.js + dist/bitmaptext.min.js (32KB) + source map
- **Node.js bundle:** dist/bitmaptext-node.js + dist/bitmaptext-node.min.js (33KB) + source map
- **Compression:** 79% size reduction (149KB → 32KB browser, 153KB → 33KB node)

**Browser bundle includes** (17 files):
StatusCode, FontProperties, TextProperties, FontMetrics, BitmapText (with CHARACTER_SET), MetricsExpander, AtlasPositioning, AtlasImage, AtlasData, AtlasReconstructionUtils, AtlasCellDimensions, TightAtlasReconstructor, AtlasDataStore, FontMetricsStore, FontManifest, FontLoaderBase, FontLoader-browser

**Node.js bundle includes** (19 files):
All browser bundle files + QOIDecode + FontLoader-node (replaces FontLoader-browser)

**Node.js bundle excludes** (user provides):
- Canvas implementation (node-canvas, skia-canvas, etc.)
- PNG encoder/options (image I/O not core library)

**When to use:**
- Before deploying to production (use minified bundles)
- After modifying any runtime source files
- When creating production-ready distribution

**Usage examples:**
See `public/*-bundled.html` demos for browser usage examples.
See `dist/README.md` for complete bundle documentation.

### 11. Playwright Screenshot Script
```bash
node scripts/screenshot-with-playwright.js [options]
```

**Options:**
- `--url <url>` - URL to capture (default: `public/hello-world-demo.html`)
- `--output <file>` - Output filename (default: `screenshot-playwright.png`)
- `--canvas-only` - Screenshot only the canvas element (default: full page)
- `--wait <ms>` - Additional wait time in ms (default: 1000)
- `--port <port>` - HTTP server port (default: 8765)

**Examples:**
```bash
# Basic screenshot of hello-world demo
node scripts/screenshot-with-playwright.js

# Screenshot a specific page
node scripts/screenshot-with-playwright.js \
  --url public/baseline-alignment-demo.html \
  --output baseline-demo.png

# Canvas-only screenshot
node scripts/screenshot-with-playwright.js \
  --canvas-only \
  --output canvas-only.png

# Custom wait time and port
node scripts/screenshot-with-playwright.js \
  --wait 2000 \
  --port 9000 \
  --output custom.png
```

**What it does:**
- Launches Chromium headless browser with container-optimized flags
- Starts embedded HTTP server automatically
- Navigates to specified page and waits for canvas rendering
- Captures screenshot (full page or canvas-only)
- Cleans up server and browser automatically

**Prerequisites:**
```bash
npm install  # Installs Playwright from package.json devDependencies
```

**When to use:**
- Automated visual regression testing
- CI/CD screenshot generation
- Batch screenshot capture of multiple pages
- Verifying rendering across different configurations
- Documentation screenshot generation

**Output example:**
```
✅ Screenshot captured successfully!
📁 File: /path/to/screenshot-hello-world.png
📊 Size: 23 KB
🎨 Canvas: 300×100 (CSS: 300px×100px)
```

**See also:** `docs/PLAYWRIGHT_AUTOMATION.md` for detailed documentation on Playwright automation (screenshots, font generation, hash generation, hash verification).

### 12. Automated Font Builder Script
```bash
node scripts/automated-font-builder.js --spec=<path-to-spec.json> [options]
```

**Options:**
- `--spec <file>` - Font set specification JSON file (required)
- `--output <dir>` - Output directory (default: `./automatically-generated-font-assets`)
- `--port <port>` - HTTP server port (default: 8765)
- `--include-full` - Include non-minified metrics files

**Examples:**
```bash
# Basic usage
node scripts/automated-font-builder.js --spec=specs/font-sets/test-font-spec.json

# Custom output directory
node scripts/automated-font-builder.js --spec=specs/font-sets/my-fonts.json --output=./output

# Include full metrics for debugging
node scripts/automated-font-builder.js --spec=specs/font-sets/test-font-spec.json --include-full
```

**What it does:**
- Loads font set specification from JSON (see `docs/FONT_SET_FORMAT.md`)
- Launches headless WebKit browser (uses Core Text on macOS)
- Navigates to `public/automated-font-builder.html`
- Generates all font configurations from specification
- Creates kerning tables for all fonts
- Exports fontAssets.zip with QOI atlases and minified metrics
- Saves to output directory automatically

**Prerequisites:**
```bash
npm install  # Installs Playwright from package.json devDependencies
npx playwright install webkit  # Install WebKit browser binaries
```

**Important - Browser Selection (macOS):**
This script uses **WebKit** (not Chromium) because WebKit on macOS uses **Core Text** and produces good crisp, aliased text rendering at small sizes with no artifacts.

Chromium uses its own Skia renderer which produces inferior results with rendering artifacts at small font sizes (inconsistent stroke widths, antialiasing issues).

**Font Set Specification:**
Create a JSON file defining font configurations (see `docs/FONT_SET_FORMAT.md` for complete format):
```json
{
  "fontSets": [{
    "name": "Arial Standard",
    "density": [1.0, 2.0],
    "families": ["Arial"],
    "styles": ["normal", "italic"],
    "weights": ["normal", "bold"],
    "sizes": [[12, 24, 0.5]]
  }]
}
```

**Output:**
- `fontAssets.zip` containing:
  - `atlas-*.qoi` - QOI atlas images
  - `metrics-*.js` - Minified metrics files
  - Optional: `metrics-*-full.js` (with `--include-full` flag)

**Post-processing:**
Process the generated ZIP with the automated pipeline:
```bash
# Extract ZIP to automatically-generated-font-assets/
# Then run the optimization pipeline:
./scripts/watch-font-assets.sh
# Or process manually:
cd automatically-generated-font-assets/fontAssets
node ../../scripts/qoi-to-png-converter.js .
../../scripts/optimize-images.sh .
../../scripts/convert-png-to-webp.sh .
node ../../scripts/image-to-js-converter.js . --all
```

**When to use:**
- Batch generation of multiple font configurations
- CI/CD font asset pipeline
- Systematic font size exploration
- Automated regression testing of font rendering

**Related files:**
- `public/automated-font-builder.html` - Stripped-down builder page (no UI)
- `src/automation/automated-builder.js` - Browser-side orchestration
- `specs/font-sets/test-font-spec.json` - Example specification (Arial 18, 18.5, 19)

### 13. Reference Hash Generator Script
```bash
node scripts/generate-reference-hashes.js --spec=<path-to-spec.json> [options]
```

**Options:**
- `--spec <file>` - Font set specification JSON file (required)
- `--output <file>` - Output file (default: `test/data/reference-hashes.js`)
- `--port <port>` - HTTP server port (default: 8765)
- `--merge` - Merge with existing hashes instead of overwriting

**Examples:**
```bash
# Generate hashes for a font set
node scripts/generate-reference-hashes.js --spec=specs/font-sets/test-font-spec.json

# Merge with existing reference hashes
node scripts/generate-reference-hashes.js --spec=specs/font-sets/my-fonts.json --merge

# Custom output location
node scripts/generate-reference-hashes.js --spec=my-fonts.json --output=./my-hashes.js
```

**What it does:**
- Loads font set specification from JSON (see `docs/FONT_SET_FORMAT.md`)
- Launches headless WebKit browser (uses Core Text on macOS)
- Navigates to `public/automated-hash-generator.html`
- Generates all font configurations from specification
- Builds atlases and renders test text for hash calculation
- Calculates reference hashes for all hash check types:
  - Atlas source hash (variable-width cells)
  - Tight atlas hash (reconstructed)
  - Positioning metadata hash
  - Text rendering hashes (3 test copies)
  - Blue text color hashes (2 per test copy: colored + black-and-white)
- Formats and saves to `test/data/reference-hashes.js`

**Prerequisites:**
```bash
npm install  # Installs Playwright from package.json devDependencies
npx playwright install webkit  # Install WebKit browser binaries
```

**Hash Types Generated (per font):**
For each font configuration, generates ~12 hashes:
1. Atlas source (variable-width cells) - `"${idString} atlas"`
2. Tight atlas (reconstructed) - `"${idString} tight atlas"`
3. Positioning hash - stored as comment (metadata)
4-6. Black text rendering - `"${idString} atlas testCopyChoiceNumber X"` (X=1,2,3)
7-9. Blue text color hash - `"${idString} atlas testCopyChoiceNumber X-blue-color"`
10-12. Blue text B&W validation - validates against black text hashes

**Output Format:**
```javascript
// Auto-generated reference hashes for BitmapText.js
// Generated: 2025-11-17T10:40:29.092Z
// Spec: specs/font-sets/test-font-spec.json

// Positioning hashes (metadata, not pixel hashes):
// density-1-0-Arial-style-normal-weight-normal-size-18-0 positioning: 632fe3

const storedReferenceCrispTextRendersHashes = {
 "density-1-0-Arial-style-normal-weight-normal-size-18-0 atlas":"f1df9bd",
 "density-1-0-Arial-style-normal-weight-normal-size-18-0 atlas testCopyChoiceNumber 1":"60233af",
 // ... more hashes
};

const hashStore = new HashStore(storedReferenceCrispTextRendersHashes);
```

**When to use:**
- Generating reference hashes after font changes
- Creating test fixtures for new font configurations
- Updating hash database incrementally (with `--merge`)
- CI/CD hash generation pipeline
- Validating font rendering consistency

**Merge mode:**
When `--merge` flag is used:
- Reads existing `test/data/reference-hashes.js`
- Merges new hashes with existing ones (new hashes override)
- Useful for incremental hash updates without regenerating everything

**Related files:**
- `public/automated-hash-generator.html` - Hash generation page (no UI)
- `src/automation/automated-hash-generator.js` - Browser-side orchestration
- `scripts/hash-utils.js` - Shared utilities (HTTP server, spec loading, hash parsing)
- `test/data/reference-hashes.js` - Reference hash database
- `test/utils/test-copy.js` - Test text definitions (3 variants)

---

### 14. Reference Hash Verification Script
```bash
node scripts/verify-reference-hashes.js --spec=<path-to-spec.json> [options]
```

**Options:**
- `--spec <file>` - Font set specification JSON file (required)
- `--hashes <file>` - Reference hash file (default: `test/data/reference-hashes.js`)
- `--port <port>` - HTTP server port (default: 8765)
- `--verbose` - Show all fonts, not just mismatches
- `--ci` - CI mode: minimal output, exit code only
- `--fail-fast` - Exit on first mismatch
- `--filter <types>` - Comma-separated hash types to check (e.g., "atlas,tight atlas")
- `--json` - Output results as JSON

**Examples:**
```bash
# Basic verification
node scripts/verify-reference-hashes.js --spec=specs/font-sets/test-font-spec.json

# CI mode (minimal output, proper exit codes)
node scripts/verify-reference-hashes.js --spec=my-fonts.json --ci

# Verbose mode (show all fonts, not just failures)
node scripts/verify-reference-hashes.js --spec=my-fonts.json --verbose

# JSON output for programmatic parsing
node scripts/verify-reference-hashes.js --spec=my-fonts.json --json > report.json

# Custom reference hash file
node scripts/verify-reference-hashes.js --spec=my-fonts.json --hashes=./my-hashes.js

# Filter specific hash types
node scripts/verify-reference-hashes.js --spec=my-fonts.json --filter="atlas,tight atlas"

# Fail fast on first mismatch
node scripts/verify-reference-hashes.js --spec=my-fonts.json --fail-fast
```

**What it does:**
- Loads font set specification from JSON
- Launches headless WebKit browser
- Generates hashes for all font configurations
- Compares generated hashes against reference file (`test/data/reference-hashes.js`)
- Reports matches, mismatches, and missing hashes
- Exits with appropriate code (0=pass, 1=fail, 2=error)

**Prerequisites:**
```bash
npm install  # Installs Playwright from package.json devDependencies
npx playwright install webkit  # Install WebKit browser binaries
```

**Exit Codes:**
- **0**: All hashes match (success)
- **1**: Hash mismatches found (failure)
- **2**: Errors during execution (error)

**Output Modes:**

**Default Mode** - Shows summary and fonts with mismatches:
```
HASH VERIFICATION RESULTS
────────────────────────────────────────────────────────────────────────────────

Summary:
  Total fonts checked: 4
  Total hashes: 36
  Matches: 36 (100.0%)

────────────────────────────────────────────────────────────────────────────────
✅ SUCCESS: All hashes match!
────────────────────────────────────────────────────────────────────────────────
```

**Verbose Mode** (`--verbose`) - Shows all fonts including matches:
```
✅ PASS density-1-0-Arial-style-normal-weight-normal-size-18-0 (9 hashes)
  ✓ Matches: 9

❌ FAIL density-1-0-Arial-style-normal-weight-normal-size-20-0 (9 hashes)
  ✗ Mismatches: 2
    - atlas
      Expected: 4dbd881
      Actual:   5ecc992
    - tight atlas
      Expected: a801187
      Actual:   b912298
```

**CI Mode** (`--ci`) - Minimal output for CI/CD pipelines:
```
============================================================
HASH VERIFICATION RESULT
============================================================
Total fonts: 4
Total hashes: 36
Matches: 36
Mismatches: 0
============================================================
✅ PASS: All hashes match
```

**JSON Mode** (`--json`) - Machine-readable output:
```json
{
  "totalFonts": 4,
  "totalHashes": 36,
  "matches": 36,
  "mismatches": 0,
  "missingInReference": 0,
  "missingInGenerated": 0,
  "details": { ... }
}
```

**When to use:**
- CI/CD regression testing pipelines
- Verifying font rendering after code changes
- Validating font asset generation consistency
- Automated quality assurance
- Cross-environment rendering verification

**Use Cases:**

**1. CI/CD Integration**
```yaml
# GitHub Actions example
steps:
  - name: Install dependencies
    run: npm install

  - name: Install Playwright
    run: npx playwright install webkit

  - name: Verify font hashes
    run: node scripts/verify-reference-hashes.js --spec=specs/font-sets/production-fonts.json --ci

  - name: Upload report on failure
    if: failure()
    run: node scripts/verify-reference-hashes.js --spec=specs/font-sets/production-fonts.json --json > hash-report.json

  - uses: actions/upload-artifact@v3
    if: failure()
    with:
      name: hash-verification-report
      path: hash-report.json
```

**2. Development Workflow**
```bash
# After making font rendering changes, verify no regressions:
node scripts/verify-reference-hashes.js --spec=specs/font-sets/test-font-spec.json --verbose

# If intentional changes detected, regenerate reference hashes:
node scripts/generate-reference-hashes.js --spec=specs/font-sets/test-font-spec.json
```

**3. Subset Verification**
```bash
# Verify only atlas hashes (skip text rendering)
node scripts/verify-reference-hashes.js \
  --spec=my-fonts.json \
  --filter="atlas,tight atlas" \
  --verbose
```

**Comparison Results:**
- **Matches**: Generated hash equals reference hash (expected)
- **Mismatches**: Generated hash differs from reference (regression detected)
- **Missing in reference**: Hash exists in generated but not in reference file (new font)
- **Missing in generated**: Hash exists in reference but not in generated (font removed)

**Related files:**
- `scripts/hash-utils.js` - Shared utilities (HTTP server, spec loading, hash parsing)
- `public/automated-hash-generator.html` - Hash generation page (no UI)
- `src/automation/automated-hash-generator.js` - Browser-side orchestration
- `test/data/reference-hashes.js` - Reference hash database
- `test/utils/test-copy.js` - Test text definitions (3 variants)

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
├── build-metrics-minifier.sh     # Builds tools/minify-metrics.js
├── build-runtime-bundle.sh       # Builds production bundles
├── build-node-demo.sh            # Builds hello-world.bundle.js
├── build-node-multi-size-demo.sh # Builds hello-world-multi-size.bundle.js
├── build-node-small-sizes-demo.sh# Builds small-sizes.bundle.js
├── build-node-bundled-demos.sh   # Builds all 3 bundled demos (*-bundled.js)
├── build-all-node-demos.sh       # Builds all 6 Node.js demos
├── run-all-node-demos.sh         # Runs all 6 Node.js demos with summary
├── screenshot-with-playwright.js # Automated browser screenshot capture
├── automated-font-builder.js     # Automated font generation from JSON specs
├── generate-reference-hashes.js  # Automated reference hash generation
├── verify-reference-hashes.js    # Automated reference hash verification
├── hash-utils.js                 # Shared utilities for hash scripts
├── test-pipeline.sh              # One-time pipeline test
└── README.md                     # This file

tools/
└── minify-metrics.js             # Generated tool for testing minification (run after build)

dist/
├── bitmaptext.js                 # Unminified browser bundle (149KB)
├── bitmaptext.min.js             # Minified browser bundle (32KB)
├── bitmaptext.min.js.map         # Source map for browser bundle
├── bitmaptext-node.js            # Unminified Node.js bundle (153KB)
├── bitmaptext-node.min.js        # Minified Node.js bundle (33KB)
├── bitmaptext-node.min.js.map    # Source map for Node.js bundle
└── README.md                     # Bundle documentation

font-assets/
├── *.webp                    # WebP atlas images (browser delivery)
├── *.qoi                     # QOI atlas images (Node.js usage)
├── *.js                      # Glyph data and metrics
├── *-full.js                 # Non-minified metrics (optional, from builder checkbox)
├── *-full-minified.js        # Re-minified output (generated by tools/minify-metrics.js)
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
9. **⚡ Minify Metrics**: Minify production metrics files with terser (saves ~2-3% file size)
10. **📋 Generate Registry**: Generate font registry from metrics files
11. **🗑️ Cleanup**: Move processed zip to trash
12. **🔄 Continue**: Return to monitoring

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

**"terser: command not found"**
```bash
npm install -g terser
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

## Cross-References

For related information, see:
- **API usage and examples** → README.md
- **System architecture and design** → docs/ARCHITECTURE.md
- **Claude development workflow tips** → docs/CLAUDE.md
- **Font assets building process** → README.md (Font Assets Building section)