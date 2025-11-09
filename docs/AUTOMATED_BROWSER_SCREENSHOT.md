# Automated Browser Screenshot Capture

This document describes methods for automatically capturing browser screenshots for verifying Canvas rendering in any environment (local development, CI/CD pipelines, Docker containers, VMs, cloud environments).

## Overview

1. ✅ **Playwright Screenshot** - **FULLY WORKING & RECOMMENDED for Automation** ⭐ **NEW!**
2. ❌ **Puppeteer Screenshot** - Not feasible (browser crashes)

---


## Approach 1: Playwright Screenshot ✅ FULLY WORKING

### Status
**Successfully tested and working!** This is the recommended approach for automated screenshot capture in all environments.

### Description
Automated browser screenshot using Playwright with Chromium headless browser. The script includes browser launch flags optimized for headless operation that work reliably in all environments (local machines, CI/CD, Docker, VMs).

### Implementation
**File**: `scripts/screenshot-with-playwright.js`

Features:
- Automated HTTP server startup
- Chromium headless browser with container-optimized flags
- Full page or canvas-only screenshots
- Configurable wait times and URLs
- Error handling and status reporting

### Installation

Playwright is included as a devDependency. Install it along with Chromium:

```bash
# Install Playwright (already in package.json as devDependency)
npm install

# Install Chromium browser
npx playwright install chromium

# Chromium will be cached at:
# macOS: ~/Library/Caches/ms-playwright/
# Linux: ~/.cache/ms-playwright/
# Windows: %USERPROFILE%\AppData\Local\ms-playwright\
```

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

---

## Approach 2: Puppeteer Screenshot ❌ NOT RECOMMENDED

### Status
**Not recommended** - Puppeteer requires additional configuration for headless environments and may crash without proper flags.

### Why Not Puppeteer?
Puppeteer can work but requires more manual configuration:
- Different default launch flags than Playwright
- Less optimized for headless/containerized environments out of the box
- Requires manually specifying the same flags that Playwright includes by default
- Higher chance of compatibility issues across different environments

### Recommended Alternative
**Use Playwright instead (Approach 1)** - Playwright is the modern successor to Puppeteer with:
- Better cross-environment compatibility (local, containers, CI/CD)
- Optimized default configurations for headless operation
- Multi-browser support (Chromium, Firefox, WebKit)
- Very similar API to Puppeteer, making migration straightforward

### Recommendation
Migrate any Puppeteer-based workflows to Playwright. The migration is straightforward:

**Puppeteer:**
```javascript
const puppeteer = require('puppeteer');
const browser = await puppeteer.launch();
const page = await browser.newPage();
```

**Playwright:**
```javascript
const { chromium } = require('playwright');
const browser = await chromium.launch();
const page = await browser.newPage();
```

---


### For Automated Verification (Browser Required)
**Use Approach 1: Playwright Screenshot** ⭐ **RECOMMENDED**

```bash
# Single screenshot
node scripts/screenshot-with-playwright.js

# Multiple pages
node scripts/screenshot-with-playwright.js --url public/baseline-alignment-demo.html --output baseline.png
node scripts/screenshot-with-playwright.js --url public/hello-world-multi-size.html --output multi-size.png
```

**Why:** Fully automated, real browser rendering, perfect for CI/CD, works in containers.

### For Automated Verification (No Browser)
**Use Approach 4: Node.js Canvas Rendering**

```bash
# Build and run
./scripts/build-node-demo.sh
node examples/node/dist/hello-world.bundle.js
# Check output: hello-world-output.png
```

**Why:** Fastest, no browser overhead, same rendering code paths as browser.

### For CI/CD Pipelines
**Playwright (if you need real browser rendering):**
```yaml
# Example CI config
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

## File Reference

### Created Files
- `scripts/screenshot-with-playwright.js` - Playwright screenshot script
- `docs/AUTOMATED_BROWSER_SCREENSHOT.md` - This document

### Existing Files
- `src/node/hello-world-main.js` - Node.js demo source
- `examples/node/dist/hello-world.bundle.js` - Built Node.js demo
- `scripts/build-node-demo.sh` - Build script
- `run-node-demos.sh` - Convenience runner

### Generated Outputs
- `bitmaptext-render-dataurl-[timestamp].png` - Browser toDataURL output
- `bitmaptext-render-blob-[timestamp].png` - Browser toBlob output
- `screenshot-playwright.png` - Playwright screenshot output (default)
- `hello-world-output.png` - Node.js rendering output

---

## Additional Resources

- **BitmapText.js README**: Main project documentation
- **Architecture Guide**: `docs/ARCHITECTURE.md`
- **Browser Examples**: `public/` directory
- **Test Renderer**: `public/test-renderer.html` - Hash verification
- **Performance Benchmarks**: `perf/` directory
