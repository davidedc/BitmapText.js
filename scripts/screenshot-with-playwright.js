#!/usr/bin/env node

/**
 * Screenshot Capture Script using Playwright
 *
 * This script uses Playwright to:
 * 1. Start a local HTTP server
 * 2. Navigate to an HTML page with BitmapText rendering
 * 3. Wait for rendering to complete
 * 4. Capture screenshot(s)
 * 5. Save to specified output file(s)
 *
 * Usage:
 *   node scripts/screenshot-with-playwright.js [options]
 *
 * Options:
 *   --url <url>          URL to capture (default: hello-world-demo.html)
 *   --output <file>      Output filename (default: screenshot-playwright.png)
 *   --canvas-only        Screenshot only the canvas element (default: full page)
 *   --wait <ms>          Additional wait time in ms (default: 1000)
 *   --port <port>        HTTP server port (default: 8765)
 *
 * Examples:
 *   node scripts/screenshot-with-playwright.js
 *   node scripts/screenshot-with-playwright.js --canvas-only --output canvas.png
 *   node scripts/screenshot-with-playwright.js --url baseline-alignment-demo.html
 */

const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
function getArg(name, defaultValue) {
  const index = args.indexOf(`--${name}`);
  return index !== -1 && args[index + 1] ? args[index + 1] : defaultValue;
}
function hasFlag(name) {
  return args.includes(`--${name}`);
}

// Check for help flag
const showHelp = hasFlag('help') || args.includes('-h');

if (showHelp) {
  console.log('Screenshot Capture Script using Playwright');
  console.log('');
  console.log('Uses Playwright to start a local HTTP server, navigate to an HTML page');
  console.log('with BitmapText rendering, and capture screenshot(s).');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/screenshot-with-playwright.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --url <url>          URL to capture');
  console.log('                       (default: public/hello-world-demo.html)');
  console.log('  --output <file>      Output filename (default: screenshot-playwright.png)');
  console.log('  --canvas-only        Screenshot only canvas element (default: full page)');
  console.log('  --wait <ms>          Additional wait time in ms (default: 1000)');
  console.log('  --port <port>        HTTP server port (default: 8765)');
  console.log('  --help, -h           Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  # Capture full page');
  console.log('  node scripts/screenshot-with-playwright.js');
  console.log('');
  console.log('  # Capture only canvas element');
  console.log('  node scripts/screenshot-with-playwright.js --canvas-only --output canvas.png');
  console.log('');
  console.log('  # Capture specific page');
  console.log('  node scripts/screenshot-with-playwright.js --url public/baseline-alignment-demo.html');
  console.log('');
  process.exit(0);
}

const config = {
  url: getArg('url', 'public/hello-world-demo.html'),
  output: getArg('output', 'screenshot-playwright.png'),
  canvasOnly: hasFlag('canvas-only'),
  waitTime: parseInt(getArg('wait', '1000')),
  port: parseInt(getArg('port', '8765'))
};

// Simple HTTP server
function startServer(port, rootDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      // Parse URL and handle query strings
      const url = new URL(req.url, `http://localhost:${port}`);
      let filePath = path.join(rootDir, url.pathname);

      // Default to index.html for directories
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }

      // Read and serve file
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not found: ' + url.pathname);
          return;
        }

        // Set content type based on file extension
        const ext = path.extname(filePath);
        const contentTypes = {
          '.html': 'text/html',
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.webp': 'image/webp',
          '.qoi': 'application/octet-stream'
        };
        const contentType = contentTypes[ext] || 'application/octet-stream';

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      });
    });

    server.listen(port, () => {
      console.log(`✅ HTTP server started on http://localhost:${port}`);
      resolve(server);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`⚠️  Port ${port} is already in use, assuming server is running...`);
        resolve(null); // Server already running, continue anyway
      } else {
        reject(err);
      }
    });
  });
}

async function captureScreenshot() {
  const projectRoot = path.resolve(__dirname, '..');
  let server = null;
  let browser = null;

  try {
    console.log('🎭 Playwright Screenshot Capture');
    console.log('================================');
    console.log(`URL: ${config.url}`);
    console.log(`Output: ${config.output}`);
    console.log(`Canvas only: ${config.canvasOnly}`);
    console.log(`Wait time: ${config.waitTime}ms`);
    console.log('');

    // Start HTTP server
    server = await startServer(config.port, projectRoot);

    // Launch browser
    console.log('🚀 Launching Chromium...');
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });

    const page = await context.newPage();

    // Navigate to page
    const fullUrl = `http://localhost:${config.port}/${config.url}`;
    console.log(`🌐 Navigating to: ${fullUrl}`);

    await page.goto(fullUrl, {
      waitUntil: 'networkidle'
    });

    // Wait for canvas element
    console.log('⏳ Waiting for canvas...');
    await page.waitForSelector('canvas', { timeout: 10000 });

    // Additional wait for rendering
    console.log(`⏳ Waiting ${config.waitTime}ms for rendering to complete...`);
    await page.waitForTimeout(config.waitTime);

    // Check if rendering was successful by looking for status messages
    const hasError = await page.evaluate(() => {
      const statusElements = document.querySelectorAll('.status.error');
      return statusElements.length > 0;
    });

    if (hasError) {
      console.warn('⚠️  Warning: Error status detected on page');
    }

    // Take screenshot
    console.log('📸 Capturing screenshot...');

    const outputPath = path.resolve(projectRoot, config.output);

    if (config.canvasOnly) {
      // Screenshot just the canvas element
      const canvas = await page.$('canvas');
      if (!canvas) {
        throw new Error('Canvas element not found');
      }
      await canvas.screenshot({ path: outputPath });
    } else {
      // Screenshot full page
      await page.screenshot({
        path: outputPath,
        fullPage: true
      });
    }

    // Get file info
    const stats = fs.statSync(outputPath);

    console.log('');
    console.log('✅ Screenshot captured successfully!');
    console.log(`📁 File: ${outputPath}`);
    console.log(`📊 Size: ${Math.round(stats.size / 1024)} KB`);

    // Optionally get canvas dimensions
    const canvasInfo = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return null;
      return {
        width: canvas.width,
        height: canvas.height,
        cssWidth: canvas.style.width || canvas.width + 'px',
        cssHeight: canvas.style.height || canvas.height + 'px'
      };
    });

    if (canvasInfo) {
      console.log(`🎨 Canvas: ${canvasInfo.width}×${canvasInfo.height} (CSS: ${canvasInfo.cssWidth}×${canvasInfo.cssHeight})`);
    }

    console.log('');
    console.log('To view: open ' + outputPath);

  } catch (error) {
    console.error('');
    console.error('❌ Error:', error.message);
    console.error('');
    console.error('Troubleshooting:');
    console.error('1. Ensure font assets exist in font-assets/ directory');
    console.error('2. Check that the HTML file exists at the specified path');
    console.error('3. Try increasing --wait time if rendering is slow');
    console.error('4. Check browser console for errors (run without --headless)');
    process.exit(1);

  } finally {
    // Cleanup
    if (browser) {
      await browser.close();
      console.log('🔒 Browser closed');
    }

    if (server) {
      server.close();
      console.log('🔒 HTTP server stopped');
    }
  }
}

// Run
if (require.main === module) {
  captureScreenshot();
}
