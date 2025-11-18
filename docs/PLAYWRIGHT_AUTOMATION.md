# Playwright Automation

This document describes automated browser-based workflows using Playwright for the BitmapText.js project. Playwright enables reliable, headless browser automation in all environments (local development, CI/CD pipelines, Docker containers, VMs, cloud environments).

## Overview

The project uses Playwright for four main automation workflows:

1. **📸 Screenshot Capture** - Automated visual verification of Canvas rendering
2. **🔠 Font Asset Generation** - Batch generation of bitmap fonts from JSON specifications
3. **🔐 Reference Hash Generation** - Automated generation of test fixtures for regression testing
4. **✅ Reference Hash Verification** - Automated verification of font hashes for CI/CD regression testing

All four systems share common infrastructure (HTTP server, headless browser, progress reporting) and can be used independently or as part of CI/CD pipelines.

---

## 1. Automated Screenshot Capture

### Status
✅ **FULLY WORKING & RECOMMENDED for Automation** ⭐

### Description
Automated browser screenshot using Playwright with Chromium headless browser. The script includes browser launch flags optimized for headless operation that work reliably in all environments.

### Implementation
**File**: `scripts/screenshot-with-playwright.js`

Features:
- Automated HTTP server startup
- Chromium headless browser with container-optimized flags
- Full page or canvas-only screenshots
- Configurable wait times and URLs
- Error handling and status reporting

### Usage

#### Basic Usage
```bash
# Screenshot the hello-world demo
node scripts/screenshot-with-playwright.js

# Output: screenshot-playwright.png
```

#### Advanced Options
```bash
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

#### Available Options
- `--url <url>` - URL to capture (default: `public/hello-world-demo.html`)
- `--output <file>` - Output filename (default: `screenshot-playwright.png`)
- `--canvas-only` - Screenshot only the canvas element (default: full page)
- `--wait <ms>` - Additional wait time in ms (default: 1000)
- `--port <port>` - HTTP server port (default: 8765)

### Technical Details

**Browser Launch Configuration:**
```javascript
const browser = await chromium.launch({
  headless: true,
  args: [
    '--no-sandbox',                    // Disable sandboxing (required for containers)
    '--disable-setuid-sandbox',        // Additional sandbox disabling
    '--disable-dev-shm-usage',         // Use /tmp instead of /dev/shm
    '--disable-accelerated-2d-canvas', // Disable GPU canvas acceleration
    '--no-first-run',                  // Skip first run tasks
    '--no-zygote',                     // Disable zygote process
    '--disable-gpu'                    // Disable GPU entirely
  ]
});
```

**Why These Flags?**
These flags ensure Chromium runs reliably in headless mode across all environments:
- **Local machines**: Work around GPU driver inconsistencies and ensure reproducible screenshots
- **Containers/VMs**: Essential where GPU drivers and sandboxing kernel features are unavailable
- **CI/CD pipelines**: Minimize system dependencies for faster, more reliable automation

The flags allow Chromium to run without hardware acceleration, sandboxing, or shared memory features that may not be available or consistent across environments.

**Workflow:**
1. Script starts embedded HTTP server on specified port
2. Launches Chromium with container-optimized flags
3. Navigates to specified URL
4. Waits for canvas element to appear
5. Waits additional time for rendering completion
6. Captures screenshot (full page or canvas only)
7. Saves to output file
8. Cleans up (closes browser and server)

### Example Output
```
🎭 Playwright Screenshot Capture
================================
URL: public/hello-world-demo.html
Output: screenshot-hello-world.png
Canvas only: false
Wait time: 1000ms

✅ HTTP server started on http://localhost:8765
🚀 Launching Chromium...
🌐 Navigating to: http://localhost:8765/public/hello-world-demo.html
⏳ Waiting for canvas...
⏳ Waiting 1000ms for rendering to complete...
📸 Capturing screenshot...

✅ Screenshot captured successfully!
📁 File: /path/to/BitmapText.js/screenshot-hello-world.png
📊 Size: 23 KB
🎨 Canvas: 300×100 (CSS: 300px×100px)

To view: open /path/to/BitmapText.js/screenshot-hello-world.png
🔒 Browser closed
🔒 HTTP server stopped
```

### Advantages
- ✅ Fully automated (no manual intervention)
- ✅ Real browser rendering (Chromium)
- ✅ Works in all environments (local, CI/CD, Docker, VMs, cloud)
- ✅ Perfect for CI/CD pipelines and automated testing
- ✅ Supports full page or element-specific screenshots
- ✅ Configurable and scriptable
- ✅ Fast execution (~3-5 seconds per screenshot)

### Limitations
- ⚠️ Requires Playwright installation (devDependency)
- ⚠️ Chromium browser download (~150MB, but already cached)
- ⚠️ Slightly slower than Node.js canvas rendering
- ⚠️ Requires HTTP server (starts automatically)

### Use Cases
- ✅ Automated visual regression testing
- ✅ CI/CD screenshot generation
- ✅ Batch screenshot capture of multiple pages
- ✅ Verifying rendering across different configurations
- ✅ Documentation screenshot generation

### CI/CD Integration
**Example GitHub Actions workflow:**
```yaml
steps:
  - name: Install dependencies
    run: npm install

  - name: Generate screenshots
    run: |
      node scripts/screenshot-with-playwright.js --url public/hello-world-demo.html --output hello-world.png
      node scripts/screenshot-with-playwright.js --url public/baseline-alignment-demo.html --output baseline.png

  - name: Upload artifacts
    uses: actions/upload-artifact@v3
    with:
      name: screenshots
      path: "*.png"
```

---

## 2. Automated Font Asset Generation

### Description
Batch generation of bitmap font assets from JSON specifications using Playwright and WebKit. The system generates all font configurations, builds kerning tables, and exports optimized font assets.

### Implementation
**File**: `scripts/automated-font-builder.js`

**Features:**
- Loads font set specifications from JSON (cross-product of font properties)
- Launches headless WebKit browser (uses Core Text on macOS for crisp rendering)
- Generates glyphs, metrics, kerning tables, and atlases
- Exports `fontAssets.zip` with QOI atlases and minified metrics
- Progress reporting with JSON events for CI/CD integration

### Usage

```bash
# Basic usage
node scripts/automated-font-builder.js --spec=specs/font-sets/test-font-spec.json

# Custom output directory
node scripts/automated-font-builder.js --spec=my-fonts.json --output=./output

# Include full (non-minified) metrics for debugging
node scripts/automated-font-builder.js --spec=my-fonts.json --include-full
```

**Options:**
- `--spec <file>` - Font set specification JSON file (required)
- `--output <dir>` - Output directory (default: `./automatically-generated-font-assets`)
- `--port <port>` - HTTP server port (default: 8765)
- `--include-full` - Include non-minified metrics files

### Font Set Specification
Define font configurations as cross-products in JSON:

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

See `docs/FONT_SET_FORMAT.md` for complete specification format.

### Output
- `fontAssets.zip` containing:
  - `atlas-*.qoi` - QOI atlas images
  - `metrics-*.js` - Minified metrics files
  - Optional: `metrics-*-full.js` (with `--include-full` flag)

### Use Cases
- Batch generation of multiple font configurations
- CI/CD font asset pipeline
- Systematic font size exploration
- Automated regression testing of font rendering

**For detailed documentation**, see `scripts/README.md` section 12.

---

## 3. Automated Reference Hash Generation

### Description
Automated generation of reference hashes for regression testing. The system builds fonts, generates atlases, renders test text, and calculates pixel hashes for all validation types used in `public/font-assets-builder.html`.

### Implementation
**File**: `scripts/generate-reference-hashes.js`

**Features:**
- Loads font set specifications from JSON
- Launches headless WebKit browser
- Generates all font configurations with full rendering pipeline
- Calculates ~12 hash types per font configuration:
  - Atlas source hash (variable-width cells)
  - Tight atlas hash (reconstructed)
  - Positioning metadata hash
  - Text rendering hashes (3 test copies × black text)
  - Blue text color hashes (3 test copies × 2 hashes each)
- Formats and saves to `test/data/reference-hashes.js`
- Supports merge mode for incremental updates

### Usage

```bash
# Generate hashes for a font set
node scripts/generate-reference-hashes.js --spec=specs/font-sets/test-font-spec.json

# Merge with existing reference hashes (incremental update)
node scripts/generate-reference-hashes.js --spec=my-fonts.json --merge

# Custom output location
node scripts/generate-reference-hashes.js --spec=my-fonts.json --output=./my-hashes.js
```

**Options:**
- `--spec <file>` - Font set specification JSON file (required)
- `--output <file>` - Output file (default: `test/data/reference-hashes.js`)
- `--port <port>` - HTTP server port (default: 8765)
- `--merge` - Merge with existing hashes instead of overwriting

### Hash Types Generated
For each font configuration, generates:
1. **Atlas source hash** - `"${idString} atlas"`
2. **Tight atlas hash** - `"${idString} tight atlas"`
3. **Positioning hash** - Stored as comment (metadata)
4-6. **Black text rendering** - `"${idString} atlas testCopyChoiceNumber X"` (X=1,2,3)
7-9. **Blue text color hash** - `"${idString} atlas testCopyChoiceNumber X-blue-color"`
10-12. **Blue text B&W validation** - Validates against black text hashes

**Total**: ~12 hashes per font configuration

### Use Cases
- Generating reference hashes after font changes
- Creating test fixtures for new font configurations
- Updating hash database incrementally (with `--merge`)
- CI/CD hash generation pipeline
- Validating font rendering consistency across environments

**For detailed documentation**, see `scripts/README.md` section 13.

---

## 4. Automated Hash Verification

### Description
Automated verification of font rendering hashes against reference hashes for regression testing. The system generates hashes for a font set and compares them against saved reference hashes to detect rendering changes.

### Implementation
**File**: `scripts/verify-reference-hashes.js`

**Features:**
- Loads font set specifications from JSON
- Launches headless WebKit browser
- Generates hashes for all font configurations
- Compares generated hashes against reference file
- Multiple output modes (default, verbose, CI, JSON)
- Detailed font-by-font comparison reporting
- Filter option to check specific hash types
- Proper exit codes for CI/CD integration (0=pass, 1=fail, 2=error)

### Usage

```bash
# Basic usage
node scripts/verify-reference-hashes.js --spec=specs/font-sets/test-font-spec.json

# CI mode (minimal output, exit code only)
node scripts/verify-reference-hashes.js --spec=my-fonts.json --ci

# Verbose mode (shows all fonts, not just mismatches)
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

**Options:**
- `--spec <file>` - Font set specification JSON file (required)
- `--hashes <file>` - Reference hash file (default: `test/data/reference-hashes.js`)
- `--port <port>` - HTTP server port (default: 8765)
- `--verbose` - Show all fonts, not just mismatches
- `--ci` - CI mode: minimal output, exit code only
- `--fail-fast` - Exit on first mismatch
- `--filter <types>` - Comma-separated hash types to check (e.g., "atlas,tight atlas")
- `--json` - Output results as JSON

### Exit Codes
- **0**: All hashes match (success)
- **1**: Hash mismatches found (failure)
- **2**: Errors during execution (error)

### Output Modes

#### Default Mode
Shows summary statistics and fonts with mismatches:
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

#### Verbose Mode
Shows all fonts including matches:
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

#### CI Mode
Minimal output suitable for CI/CD pipelines:
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

#### JSON Mode
Machine-readable output for programmatic parsing:
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

### Use Cases
- CI/CD regression testing pipelines
- Verifying font rendering after code changes
- Validating font asset generation consistency
- Automated quality assurance
- Cross-environment rendering verification

### CI/CD Integration
**Example GitHub Actions workflow:**
```yaml
steps:
  - name: Install dependencies
    run: npm install

  - name: Install Playwright browsers
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

**For detailed documentation**, see `scripts/README.md` section 14.

---

## Common Setup

### Installation

Playwright is included as a devDependency. Install it along with browser binaries:

```bash
# Install Playwright (already in package.json as devDependency)
npm install

# Install browser binaries
npx playwright install chromium  # For screenshot capture
npx playwright install webkit    # For font generation and hash generation

# Browser binaries will be cached at:
# macOS: ~/Library/Caches/ms-playwright/
# Linux: ~/.cache/ms-playwright/
# Windows: %USERPROFILE%\AppData\Local\ms-playwright\
```

### Browser Selection: WebKit vs Chromium

**Important**: The project uses different browsers for different tasks:

#### WebKit (Font Generation & Hash Generation)
**Used for**: `automated-font-builder.js`, `generate-reference-hashes.js`

**Rationale**: WebKit on macOS uses **Core Text**, Apple's native font rendering engine, which produces:
- Crisp, aliased text at small sizes
- Consistent stroke widths
- No rendering artifacts
- Pixel-perfect results needed for bitmap font generation

#### Chromium (Screenshot Capture)
**Used for**: `screenshot-with-playwright.js`

**Rationale**: Chromium with container-optimized flags is:
- More widely available in CI/CD environments
- Well-tested for screenshot capture
- Configurable for headless operation
- Suitable for visual verification (not font generation)

**Why not Chromium for font generation?**
Chromium uses the Skia rendering engine, which produces inferior results at small font sizes:
- Inconsistent stroke widths
- Antialiasing artifacts
- Non-crisp rendering even with antialiasing disabled

For font asset generation, **WebKit with Core Text is mandatory** on macOS to ensure high-quality bitmap fonts.

---

## Why Playwright (Not Puppeteer)?

Playwright is the modern successor to Puppeteer with:
- Better cross-environment compatibility (local, containers, CI/CD)
- Optimized default configurations for headless operation
- Multi-browser support (Chromium, Firefox, WebKit)
- Very similar API to Puppeteer, making migration straightforward

**Migration from Puppeteer:**
```javascript
// Puppeteer
const puppeteer = require('puppeteer');
const browser = await puppeteer.launch();
const page = await browser.newPage();

// Playwright (nearly identical API)
const { chromium } = require('playwright');
const browser = await chromium.launch();
const page = await browser.newPage();
```

---

## File Reference

### Playwright Automation Scripts
- `scripts/screenshot-with-playwright.js` - Screenshot capture
- `scripts/automated-font-builder.js` - Font asset generation
- `scripts/generate-reference-hashes.js` - Reference hash generation
- `scripts/verify-reference-hashes.js` - Reference hash verification
- `scripts/hash-utils.js` - Shared utilities for hash scripts

### Automation Pages (Headless)
- `public/automated-font-builder.html` - Font generation page (no UI)
- `public/automated-hash-generator.html` - Hash generation page (no UI)

### Browser-Side Orchestration
- `src/automation/automated-builder.js` - Font generation orchestration
- `src/automation/automated-hash-generator.js` - Hash generation orchestration

### Test Data
- `test/data/reference-hashes.js` - Auto-generated reference hash database
- `test/utils/test-copy.js` - Test text definitions (3 variants)

### Generated Outputs
- `screenshot-playwright.png` - Screenshot output (default filename)
- `fontAssets.zip` - Font asset bundle (from automated-font-builder)
- `test/data/reference-hashes.js` - Reference hash database (from generate-reference-hashes)
- `automatically-generated-font-assets/` - Default font output directory

---

## Additional Resources

- **BitmapText.js README**: Main project documentation
- **Architecture Guide**: `docs/ARCHITECTURE.md`
- **Font Set Format**: `docs/FONT_SET_FORMAT.md` - JSON specification format
- **Scripts Documentation**: `scripts/README.md` - Complete automation guide
- **Browser Examples**: `public/` directory
- **Test Renderer**: `public/test-renderer.html` - Hash verification UI
- **Performance Benchmarks**: `perf/` directory
