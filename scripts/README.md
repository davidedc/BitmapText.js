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
- Uses `src/node/small-sizes-main.js` - tests sizes 0-9px
- Demonstrates automatic metric interpolation for sizes < 9px
- Two sections: visual rendering (placeholders) + measurements with boxes
- Shows only 9px metrics needed for all small sizes

**Bundled versions (`build-node-bundled-demos.sh`):**
- Builds 3 demos that use production runtime bundle (dist/bitmaptext-node.min.js)
- Creates `*-bundled.js` versions (~43-46KB each)
- Demonstrates production pattern: user provides Canvas/PNG, library provides rendering
- 78% smaller than standalone versions by sharing runtime bundle

**Common source files used:**
- `src/platform/canvas-mock.js` - Minimal Canvas implementation (includes strokeRect for measurement boxes)
- `src/runtime/CharacterSets.js` - Character set configuration (FONT_SPECIFIC_CHARS, FONT_INVARIANT_CHARS)
- `src/runtime/BitmapText.js` - Core rendering class
- `src/runtime/InterpolatedFontMetrics.js` - Automatic metric scaling for sizes < 9px
- `src/builder/MetricsExpander.js` - Font metrics expansion
- `lib/QOIDecode.js`, `lib/PngEncoder.js`, `lib/PngEncodingOptions.js` - Image libraries
- `src/runtime/FontLoaderBase.js` - Abstract base class for font loading (shared logic)
- `src/platform/FontLoaderNode.js` - Node.js font loader implementation
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

### 8. Metrics Bundle Builder
```bash
node scripts/build-metrics-bundle.js
# or
npm run build-metrics-bundle
```

**What it does:**
- Reads any per-file `metrics-density-*.js` left in `font-assets/`. Note: the active build path (browser font-assets-builder via `src/automation/export-font-data.js`) emits `metrics-bundle.js` directly into its zip output, so this Node-side aggregator is a legacy alt-path retained for historical workflows.
- Strips `pixelDensity` from `baseline[5]` (the bundle is density-agnostic — runtime injects density at expansion time)
- Deduplicates density-1/density-2 pairs
- Frames as JSON, deflate-raw compresses, base64-wraps in `BitmapText.rBundle("...")`
- Writes `font-assets/metrics-bundle.js`

**When to use:**
- Mostly historical. Normal flow: drop `fontAssets.zip` from the builder into `~/Downloads/`, the watcher extracts the prebuilt bundle directly into `font-assets/`.

### 9. Distribution / Minimum-Set Workflow

`font-assets/` is too large to commit (~800 MB full, ~72 MB minimum set). It is **not in the repo** — only `font-assets/.gitkeep` and `font-assets/README.md` are tracked. The asset bytes live in [GitHub Releases](https://github.com/davidedc/BitmapText.js/releases). Tag convention: `font-assets-YYYY-MM-DD`. Each release ships two assets — `font-assets-min.zip` and a matching `font-assets-min.zip.sha256` sidecar — so consumers can verify integrity without a separate hash transcription.

**Minimum-set contents** (every release):
- `metrics-bundle.js` — density-agnostic metrics (single file).
- `positioning-bundle-density-*.js` — pre-computed per-glyph positioning, one file per density (currently 1 and 2). Required at runtime by `_loadAtlasFromPackage`; atlas loads throw without them. The rebuild step never regenerates these — they ship as-is.
- `atlas-*.webp` — lossless WebP atlas images, one per (density, family, style, weight, size).

The workflow has three scripts: one for consumers, one for maintainers, and the existing rebuilder used by both.

#### 9.a Consume — `scripts/download-font-assets.sh`

```bash
./scripts/download-font-assets.sh                       # latest release
./scripts/download-font-assets.sh --tag font-assets-2026-05-05
./scripts/download-font-assets.sh --no-rebuild          # fetch+verify only
./scripts/download-font-assets.sh --force               # overwrite existing
```

**What it does:**
1. Refuses to clobber a populated `font-assets/` unless `--force` is given.
2. `curl`s `font-assets-min.zip` from GitHub's stable `releases/latest/download/...` URL (or the specific tag URL if `--tag` is passed).
3. `curl`s the matching `.sha256` sidecar and runs `shasum -a 256 -c` to verify. (Older releases without a sidecar emit a warning and continue.)
4. `unzip`s into the repo root, populating `font-assets/`.
5. Unless `--no-rebuild`, chains into `./scripts/rebuild-from-minimal.sh`.

Total time end-to-end: ~10 min on a typical machine. Uses only `curl`, `unzip`, `shasum`, `find` — no `gh`, no `jq`, no `node` needed for the download.

#### 9.b Publish — `scripts/publish-font-assets.sh`

```bash
./scripts/publish-font-assets.sh --dry-run              # stage, don't push
./scripts/publish-font-assets.sh                        # tag = font-assets-$(date +%F)
./scripts/publish-font-assets.sh --tag font-assets-2026-05-06
```

**What it does:**
1. Pre-flight: confirms `metrics-bundle.js`, at least one `positioning-bundle-density-*.js`, and at least one `atlas-*.webp`; warns if `scripts/` or `src/` is dirty; checks that `gh` is installed and authed (skipped under `--dry-run`).
2. Defensive cleanup: deletes any stale `atlas-*.png` intermediates so they can't sneak into the zip.
3. Auto-tag `font-assets-$(date +%Y-%m-%d)` (or `--tag` override). If the tag already has a release, prompts for overwrite confirmation.
4. Builds `font-assets-min.zip` via `find … -print | zip -@` (newline-safe; atlas filenames have spaces but never newlines). Includes `metrics-bundle.js`, every `positioning-bundle-density-*.js`, and every `atlas-*.webp`.
5. Computes the SHA-256 sidecar from inside the staging dir so the file references just the basename (so `shasum -c` works for consumers).
6. Generates release notes from a template parameterised with the tag, file count, and hash.
7. Confirms with the user, then `git tag` + `git push origin <tag>` + `gh release create <tag> <zip> <sha256> --title … --notes-file …`.
8. Prints both canonical URLs (specific-tag + `releases/latest/...`) on success.

**Requires:** `gh` (`brew install gh && gh auth login`), `zip`, `shasum`, `git`. Use `--dry-run` to inspect the staged artifacts and notes without pushing or uploading — that path doesn't need `gh`.

#### 9.c Re-derive — `scripts/rebuild-from-minimal.sh`

Used by `download-font-assets.sh` after unzipping. Can also be run directly when you already have the minimum set in place. Note: this script does NOT process `metrics-bundle.js` or `positioning-bundle-density-*.js` — those are shipped as-is in the zip and only need unzipping. It derives the per-atlas QOI + JS wrappers from the WebPs.

```bash
./scripts/rebuild-from-minimal.sh
```

**What it does:**
1. Sanity-checks `metrics-bundle.js` and counts `atlas-*.webp` (must be > 0).
2. Deletes any stale `atlas-*.png` intermediates.
3. Runs `scripts/webp-to-qoi-converter.js`: `dwebp -pam` decodes each WebP to raw RGBA, then `lib/QOIEncode.js` encodes to QOI.
4. Runs `scripts/image-to-js-converter.js font-assets --all` to wrap both formats as `BitmapText.a(...)` JS files.
5. Minifies the new `atlas-*-{webp,qoi}.js` files in place with `terser` (NUL-delimited loop — family names contain spaces).
6. Reports final counts; expects four kinds × WEBP_COUNT each (e.g. 4,550 each for the full corpus).

**Runtime:** ~10 min for 4,550 fonts on a typical machine.

**Verification (bit-exact round-trip):**
```bash
# After a forward build, snapshot canonical hashes:
(cd font-assets && shasum -a 256 atlas-*.qoi atlas-*-webp.js atlas-*-qoi.js | sort) > /tmp/baseline.sha256

# Strip derived files, then rebuild:
mv font-assets/atlas-*.qoi font-assets/atlas-*-webp.js font-assets/atlas-*-qoi.js /tmp/aside/
./scripts/rebuild-from-minimal.sh

# Compare — must be empty:
(cd font-assets && shasum -a 256 atlas-*.qoi atlas-*-webp.js atlas-*-qoi.js | sort) > /tmp/rebuilt.sha256
diff /tmp/baseline.sha256 /tmp/rebuilt.sha256
```

Determinism rationale: lossless WebP round-trips RGBA byte-for-byte through `dwebp -pam`; QOI is deterministic for fixed RGBA + descriptor; the JS wrapper is deterministic. `metrics-bundle.js` is shipped as-is and never touched by the rebuild. (Terser output may differ across versions — the JS wrappers are functionally equivalent but bytes can vary.)

**Requires:** `dwebp` (`brew install webp`), `terser` (`npm i -g terser`), Node.

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
StatusCode, FontProperties, TextProperties, FontMetrics, InterpolatedFontMetrics, CharacterSets, BitmapText, MetricsExpander, AtlasPositioning, AtlasImage, AtlasData, AtlasCellDimensions, AtlasDataStore, MetricsBundleStore, BundleCodec, PositioningBundleStore, FontMetricsStore, FontManifest, FontLoaderBase, FontLoaderBrowser

**Node.js bundle includes**: All browser bundle files + QOIDecode + FontLoaderNode (replaces FontLoaderBrowser)

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
node scripts/automated-font-builder.js --spec=font-sets/test-font-spec.json

# Custom output directory
node scripts/automated-font-builder.js --spec=font-sets/my-fonts.json --output=./output

# Include full metrics for debugging
node scripts/automated-font-builder.js --spec=font-sets/test-font-spec.json --include-full
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
- `font-sets/test-font-spec.json` - Example specification (Arial 18, 18.5, 19)

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
node scripts/generate-reference-hashes.js --spec=font-sets/test-font-spec.json

# Merge with existing reference hashes
node scripts/generate-reference-hashes.js --spec=font-sets/my-fonts.json --merge

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
// Spec: font-sets/test-font-spec.json

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
node scripts/verify-reference-hashes.js --spec=font-sets/test-font-spec.json

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
    run: node scripts/verify-reference-hashes.js --spec=font-sets/production-fonts.json --ci

  - name: Upload report on failure
    if: failure()
    run: node scripts/verify-reference-hashes.js --spec=font-sets/production-fonts.json --json > hash-report.json

  - uses: actions/upload-artifact@v3
    if: failure()
    with:
      name: hash-verification-report
      path: hash-report.json
```

**2. Development Workflow**
```bash
# After making font rendering changes, verify no regressions:
node scripts/verify-reference-hashes.js --spec=font-sets/test-font-spec.json --verbose

# If intentional changes detected, regenerate reference hashes:
node scripts/generate-reference-hashes.js --spec=font-sets/test-font-spec.json
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

### 15. Browser Smoke Loop (Playwright)

**File**: `scripts/playwright-smoke-loop.js`

Headless multi-page sweep that loads every demo under `public/` against **both** `http://` and `file://`, captures `console.error` and uncaught `pageerror`, and exits non-zero with a per-page breakdown if anything fails.

```bash
node scripts/playwright-smoke-loop.js
```

Recommended as the third step of the standard verification sequence:

```bash
# 1. hashes — does rendered output still match the reference DB?
node scripts/verify-reference-hashes.js --spec=font-sets/test-font-spec.json --ci

# 2. node demos — does the Node-side rendering path still work?
./run-node-demos.sh

# 3. browser — do all demos load without console errors under both protocols?
node scripts/playwright-smoke-loop.js
```

Use cases:
- Catches asset-pipeline regressions in the browser (e.g. missing/stale bundle, file:// vs http:// divergence) that hash-verify and Node demos won't surface.
- Cheap (a few seconds), deterministic, and exits 0 on pass — drop straight into CI.

For the full reference (page list, output format, when to run, limitations, CI use), see [`docs/PLAYWRIGHT_AUTOMATION.md`](../docs/PLAYWRIGHT_AUTOMATION.md) section 5.

### 16. Atlas binarity inspector

**File**: `scripts/check-atlas-binary.js`

Scans every QOI / PNG / WebP under a directory (default `font-assets/`) and flags any pixel whose R, G, B or A channel is neither 0 nor 255. CLAUDE.md universal invariant 2 requires glyph atlases to be **binary** (pixels on or off); this tool catches regressions where Canvas's `fillText` rasterizer produced grey AA pixels and the FAB's binarisation step (`GlyphFAB.binarizeCanvas`) didn't catch them — see `docs/ARCHITECTURE.md` § *Glyph rasterization quirk* for the underlying ≥182-physical-pixel cutoff.

```bash
node scripts/check-atlas-binary.js                  # full scan, human-readable report
node scripts/check-atlas-binary.js --json           # machine-readable (full lists)
node scripts/check-atlas-binary.js --limit=10       # smoke test on first N per format
node scripts/check-atlas-binary.js --concurrency=8  # tune dwebp parallelism (default = cpu cores)
node scripts/check-atlas-binary.js path/to/dir      # scan a different directory
```

A clean run prints `0 / N` for every format. The report also SHA-1-fingerprints every decode so the QOI / PNG / WebP triples for the same atlas can be cross-checked: any divergence indicates a lossy step in the qoi → png → webp pipeline.

Decoders: QOI in-process via `lib/QOIDecode.js`, PNG via an inline zlib decoder (handles all colour types at bit depth 8, all 5 PNG filters), WebP via parallel `dwebp -pam` subprocesses (requires `brew install webp`). Full-directory scan ≈ 3 minutes on Apple Silicon.

Run after any change to glyph rasterization or after regenerating atlases — the inspector is the cheapest way to confirm CLAUDE.md invariant 2 still holds.

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
├── build-metrics-bundle.js       # Builds font-assets/metrics-bundle.js from per-file metrics
├── build-runtime-bundle.sh       # Builds production bundles
├── build-node-demo.sh            # Builds hello-world.bundle.js
├── build-node-multi-size-demo.sh # Builds hello-world-multi-size.bundle.js
├── build-node-small-sizes-demo.sh# Builds small-sizes.bundle.js
├── build-node-bundled-demos.sh   # Builds all 3 bundled demos (*-bundled.js)
├── build-all-node-demos.sh       # Builds all 6 Node.js demos
├── run-all-node-demos.sh         # Runs all 6 Node.js demos with summary
├── screenshot-with-playwright.js # Automated browser screenshot capture
├── playwright-smoke-loop.js      # Multi-page console-error sweep (file:// + http://)
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
├── metrics-bundle.js         # All metrics in one deflate-compressed bundle (density-agnostic)
├── *-webp.js                 # JS-wrapped WebP atlas images (for file:// protocol)
├── *-qoi.js                  # JS-wrapped QOI atlas images (for file:// protocol)
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