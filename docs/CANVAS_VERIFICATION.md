# Canvas Render Verification in Claude Code Web

This document describes methods for independently verifying text rendering in the browser environment within Claude Code Web (which runs in a virtual machine in the cloud).

## Overview

Four approaches are available for capturing and verifying canvas renders:

1. ✅ **Browser-Based Download** (toDataURL/toBlob) - **RECOMMENDED for Manual Testing**
2. ✅ **Playwright Screenshot** - **FULLY WORKING & RECOMMENDED for Automation** ⭐ **NEW!**
3. ❌ **Puppeteer Screenshot** - Not feasible (browser crashes)
4. ✅ **Node.js Canvas Rendering** - **FULLY WORKING**

---

## Approach 1: Browser-Based Download ✅ RECOMMENDED for Manual Testing

### Description
Enhanced HTML page with download buttons that convert canvas to downloadable PNG files using browser APIs.

### Implementation
**File**: `public/hello-world-with-download.html`

This demo provides:
- Real-time canvas rendering of BitmapText
- Two download methods:
  - **toDataURL**: Converts canvas to Base64-encoded PNG data URL
  - **toBlob**: Asynchronously creates binary PNG Blob (more memory efficient)
- Multiple text samples (black, blue, red with different alignments)
- Status logging and error handling

### Usage

#### Step 1: Start local HTTP server
```bash
cd /home/user/BitmapText.js
python -m http.server 8000
```

#### Step 2: Open in browser
Navigate to: `http://localhost:8000/public/hello-world-with-download.html`

#### Step 3: Download renders
- Click "Download PNG (toDataURL)" for immediate download
- Click "Download PNG (toBlob)" for efficient binary download
- Files saved as: `bitmaptext-render-[method]-[timestamp].png`

### Technical Details

**toDataURL Method:**
```javascript
const dataURL = canvas.toDataURL('image/png');
// Returns: "data:image/png;base64,iVBORw0KGgoAAAA..."
```
- **Pros**: Synchronous, simple API, immediate result
- **Cons**: Encodes to Base64 (~33% size increase), more memory usage
- **Best for**: Small canvases, quick downloads, inline embedding

**toBlob Method:**
```javascript
canvas.toBlob(function(blob) {
  const url = URL.createObjectURL(blob);
  // Download via created URL
}, 'image/png');
```
- **Pros**: Asynchronous, creates binary Blob, more memory efficient
- **Cons**: Requires callback, slightly more complex
- **Best for**: Large canvases, high-resolution renders, production use

### Advantages
- ✅ No additional dependencies
- ✅ Works in any modern browser
- ✅ Real-time verification of rendering
- ✅ User-controlled download (no automation needed)
- ✅ Supports high-DPI/Retina displays
- ✅ Can verify multiple render variations

### Limitations
- ⚠️ Requires manual browser interaction
- ⚠️ Not suitable for automated testing
- ⚠️ Requires HTTP server (not file://)

---

## Approach 2: Playwright Screenshot ✅ FULLY WORKING ⭐ **NEW!**

### Status
**Successfully working in Claude Code Web!** This is the recommended approach for automated screenshot capture.

### Description
Automated browser screenshot using Playwright with Chromium headless browser. Playwright is installed and configured with the necessary flags to work in containerized environments.

### Implementation
**File**: `scripts/screenshot-with-playwright.js`

Features:
- Automated HTTP server startup
- Chromium headless browser with container-optimized flags
- Full page or canvas-only screenshots
- Configurable wait times and URLs
- Error handling and status reporting

### Installation

Playwright is already installed with the following configuration:

```bash
# Playwright (already in package.json as devDependency)
npm install

# Chromium is pre-installed at:
# /root/.cache/ms-playwright/chromium-1194/
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
- Container environments often lack GPU drivers
- Sandboxing requires kernel features not always available in Docker/VMs
- These flags allow Chromium to run in headless mode without system dependencies

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
📁 File: /home/user/BitmapText.js/screenshot-hello-world.png
📊 Size: 23 KB
🎨 Canvas: 300×100 (CSS: 300px×100px)

To view: open /home/user/BitmapText.js/screenshot-hello-world.png
🔒 Browser closed
🔒 HTTP server stopped
```

### Advantages
- ✅ Fully automated (no manual intervention)
- ✅ Real browser rendering (Chromium)
- ✅ Works in containerized/VM environments
- ✅ Perfect for CI/CD pipelines
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

## Approach 3: Puppeteer Screenshot ❌ NOT FEASIBLE

### Status
**Not working in Claude Code Web environment** - Chromium crashes with Puppeteer.

### What We Tried
```bash
# Attempted installation
npm install --save-dev puppeteer
# Result: Network restrictions prevented browser download

# Attempted with skip download
PUPPETEER_SKIP_DOWNLOAD=true npm install --save-dev puppeteer
# Result: Installed, but browser crashes when launched
```

### Why It Doesn't Work
While Puppeteer installed successfully, the bundled Chromium crashes when trying to render pages. This appears to be due to different default launch configurations between Puppeteer and Playwright.

### Alternative Solution
**Use Playwright instead (Approach 2)** - Playwright is essentially Puppeteer's successor with better container support and multi-browser capabilities. The API is very similar, and Playwright works perfectly in this environment.

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

## Approach 4: Node.js Canvas Rendering ✅ FULLY WORKING

### Description
Server-side rendering using Node.js canvas implementation that generates PNG files directly without a browser.

### Implementation
**Already exists and fully tested!**

**Source files:**
- `src/node/hello-world-main.js` - Main demo logic
- `src/platform/canvas-mock.js` - Node.js canvas implementation
- `examples/node/dist/hello-world.bundle.js` - Built executable bundle

### Usage

#### Quick Start (Recommended)
```bash
cd /home/user/BitmapText.js
./run-node-demos.sh
```

This script will:
1. Build runtime bundles
2. Build Node.js demo bundles
3. Set up font assets
4. Run both demos
5. Generate PNG outputs

#### Manual Usage
```bash
# Build the demo (if not already built)
./scripts/build-node-demo.sh

# Run the demo
node examples/node/dist/hello-world.bundle.js

# Output created at:
# ./hello-world-output.png
```

### Output Example
```
BitmapText.js Node.js Demo - Loading font data...
Configuring BitmapText for Node.js...
Loading font: density-1-0-Arial-style-normal-weight-normal-size-19-0...
Font loaded successfully
Creating canvas and rendering...
✅ Text rendered successfully with actual glyphs!
✅ Blue text rendered successfully!
Encoding PNG...

Success! 🎉
Generated: /home/user/BitmapText.js/hello-world-output.png
Canvas size: 300x120
File size: 144198 bytes

The PNG contains "Hello World" rendered twice:
  - Black text (fast path): y=50
  - Blue text (colored slow path): y=80
```

### Technical Details

**How it works:**
1. **Canvas Mock**: `src/platform/canvas-mock.js` provides Canvas API implementation
2. **QOI Loading**: Loads `.qoi` font atlases (native Node.js format)
3. **BitmapText Rendering**: Same API as browser (unified interface)
4. **PNG Encoding**: Uses `lib/PngEncoder.js` to encode canvas to PNG
5. **File Output**: Writes PNG to current directory

**Architecture:**
```javascript
// Configure for Node.js
BitmapText.configure({
  fontDirectory: './font-assets/',
  canvasFactory: () => new Canvas()
});

// Load font
await BitmapText.loadFont(fontProperties.idString);

// Create canvas
const canvas = new Canvas();
canvas.width = 300;
canvas.height = 120;
const ctx = canvas.getContext('2d');

// Render text (same API as browser!)
BitmapText.drawTextFromAtlas(ctx, "Hello World", 10, 50, fontProperties);

// Export PNG
const pngBuffer = PngEncoder.encode(canvas);
fs.writeFileSync('output.png', Buffer.from(pngBuffer));
```

### Advantages
- ✅ Fully automated (no browser needed)
- ✅ Perfect for CI/CD pipelines
- ✅ Identical rendering to browser (same code paths)
- ✅ Self-contained (no external dependencies)
- ✅ Generates PNG files directly
- ✅ Can verify both fast path (black) and slow path (colored) rendering
- ✅ Supports multiple font sizes and variations
- ✅ Fastest option (no browser overhead)

### Limitations
- ⚠️ Requires build step (`./scripts/build-node-demo.sh`)
- ⚠️ Font assets must be present in `font-assets/` directory
- ⚠️ Canvas mock may not support all Canvas API features (but sufficient for BitmapText)
- ⚠️ Not a "real browser" render (though code paths are identical)

### Multi-Size Demo
For testing multiple font sizes:

```bash
# Build multi-size demo
npm run build-multi-size-demo

# Run it
node examples/node/dist/hello-world-multi-size.bundle.js

# Output: hello-world-multi-size-output.png (700×200)
```

This demo tests:
- Font sizes: 18, 18.5, 19
- Both black (fast path) and colored (slow path) rendering
- Placeholder rectangle fallback (if atlases missing)

---

## Comparison Matrix

| Feature | Browser Download | Playwright | Puppeteer | Node.js Canvas |
|---------|-----------------|------------|-----------|----------------|
| **Status** | ✅ Working | ✅ Working | ❌ Not available | ✅ Working |
| **Setup** | HTTP server only | npm install | Crashes | Build script |
| **Automation** | Manual | Full | N/A | Full |
| **Browser Needed** | Yes | Yes (headless) | Yes (crashes) | No |
| **Dependencies** | None | playwright | puppeteer | Built-in |
| **CI/CD Friendly** | No | Yes | No | Yes |
| **Real Browser Render** | Yes | Yes | N/A | No (canvas mock) |
| **Output Format** | PNG | PNG/JPEG/WebP | N/A | PNG |
| **HiDPI Support** | Yes | Yes | N/A | Yes (configurable) |
| **Speed** | N/A (manual) | ~3-5s | N/A | ~1-2s |
| **Best For** | Manual verification | Automated browser testing | - | Automated server-side |

---

## Recommendations

### For Manual Verification in Claude Code Web
**Use Approach 1: Browser-Based Download**

1. Start server: `python -m http.server 8000`
2. Open: `http://localhost:8000/public/hello-world-with-download.html`
3. Click download button
4. Verify PNG file

**Why:** Simplest setup, no build required, visual confirmation before download.

### For Automated Verification (Browser Required)
**Use Approach 2: Playwright Screenshot** ⭐ **RECOMMENDED**

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
**Use Approach 2 (Playwright) or Approach 4 (Node.js)** depending on requirements:

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

**Node.js Canvas (if browser not required):**
```yaml
# Example CI config
steps:
  - name: Build demo
    run: ./scripts/build-node-demo.sh

  - name: Generate render
    run: node examples/node/dist/hello-world.bundle.js

  - name: Upload artifact
    uses: actions/upload-artifact@v3
    with:
      name: render-output
      path: hello-world-output.png
```

---

## Testing Checklist

To verify text rendering independently:

- [ ] **Black text (fast path)**: Renders glyphs directly from atlas
- [ ] **Colored text (slow path)**: Uses composite operations for coloring
- [ ] **Kerning**: Character spacing looks correct
- [ ] **Baselines**: Text positioning relative to y-coordinate
- [ ] **Alignment**: left/center/right text alignment
- [ ] **Multiple sizes**: Different font sizes render correctly
- [ ] **Pixel-perfect**: Output matches expected hash (see test-renderer.html)

---

## Troubleshooting

### Browser Download Issues

**Problem:** Downloads not working in file:// protocol
```
Solution: Use HTTP server instead:
python -m http.server 8000
```

**Problem:** Canvas is blank/white
```
Solution: Check font loading in browser console
- Ensure font-assets directory is accessible
- Check for CORS errors
```

### Playwright Issues

**Problem:** Browser crashes or fails to launch
```
Solution: Browser launch flags are already configured for containers
- Flags include: --no-sandbox, --disable-gpu, --disable-dev-shm-usage
- These should work in most containerized environments
```

**Problem:** Page doesn't load or times out
```
Solution: Increase wait time or check HTTP server
- Use --wait 2000 or higher
- Ensure font assets are available
- Check HTTP server is responding (test with curl)
```

**Problem:** Screenshot is blank or incomplete
```
Solution: Wait longer for rendering
- Use --wait 2000 or higher
- Check browser console for errors (not available in headless)
- Try the non-bundled HTML version
```

### Node.js Rendering Issues

**Problem:** "Cannot find module" errors
```
Solution: Rebuild the bundle:
./scripts/build-node-demo.sh
```

**Problem:** "Font data not found"
```
Solution: Ensure font-assets directory exists with required files:
- font-assets/metrics-*.js
- font-assets/atlas-*-qoi.js
```

**Problem:** PNG output is corrupt
```
Solution: Check canvas dimensions are valid:
canvas.width > 0 && canvas.height > 0
```

---

## File Reference

### Created Files
- `public/hello-world-with-download.html` - Browser download demo
- `scripts/screenshot-with-playwright.js` - Playwright screenshot script
- `docs/CANVAS_VERIFICATION.md` - This document

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

---

## Conclusion

In Claude Code Web environment:

✅ **Browser-Based Download (Approach 1)** - Works perfectly, great for manual verification

✅ **Playwright Screenshot (Approach 2)** - Works perfectly, **BEST for automation** ⭐

❌ **Puppeteer Screenshot (Approach 3)** - Not available (browser crashes)

✅ **Node.js Canvas Rendering (Approach 4)** - Works perfectly, ideal for server-side/fastest

**Recommended Workflows:**

- **Manual Testing**: Approach 1 (Browser Download)
- **Automated Browser Testing**: Approach 2 (Playwright) ⭐ **NEW & RECOMMENDED**
- **Automated Server-Side**: Approach 4 (Node.js Canvas)
- **CI/CD**: Approach 2 (Playwright) or Approach 4 (Node.js) depending on requirements

All working approaches provide full verification capabilities for independent testing of text rendering in the browser environment.
