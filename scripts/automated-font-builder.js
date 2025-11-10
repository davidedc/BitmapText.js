#!/usr/bin/env node

/**
 * Automated Font Asset Builder
 *
 * This script uses Playwright to automate font asset generation:
 * 1. Loads a font set specification from JSON
 * 2. Starts a local HTTP server
 * 3. Launches a headless browser
 * 4. Navigates to the automated font builder page
 * 5. Passes the font specification to the page
 * 6. Monitors build progress via console
 * 7. Captures the generated .zip download
 * 8. Saves to output directory
 *
 * Usage:
 *   node scripts/automated-font-builder.js --spec=<path-to-spec.json> [options]
 *
 * Options:
 *   --spec <file>        Font set specification JSON file (required)
 *   --output <dir>       Output directory (default: ./font-assets-output)
 *   --port <port>        HTTP server port (default: 8765)
 *   --include-full       Include non-minified metrics (default: false)
 *
 * Examples:
 *   node scripts/automated-font-builder.js --spec=specs/font-sets/test-font-spec.json
 *   node scripts/automated-font-builder.js --spec=specs/font-sets/my-fonts.json --output=./output
 *
 * Font Set Specification:
 *   See docs/FONT_SET_FORMAT.md for complete format documentation and examples.
 *   Example specification available at: specs/font-sets/test-font-spec.json
 */

const { webkit } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
function getArg(name, defaultValue) {
  const index = args.indexOf(`--${name}`);
  if (index !== -1 && args[index + 1]) {
    return args[index + 1];
  }

  // Also check --name=value format
  const prefixArg = args.find(arg => arg.startsWith(`--${name}=`));
  if (prefixArg) {
    return prefixArg.split('=')[1];
  }

  return defaultValue;
}
function hasFlag(name) {
  return args.includes(`--${name}`);
}

const config = {
  specFile: getArg('spec', null),
  outputDir: getArg('output', './automatically-generated-font-assets'),
  port: parseInt(getArg('port', '8765')),
  includeFullMetrics: hasFlag('include-full')
};

// Validate required arguments
if (!config.specFile) {
  console.error('❌ Error: --spec argument is required');
  console.error('');
  console.error('Usage:');
  console.error('  node scripts/automated-font-builder.js --spec=<path-to-spec.json> [options]');
  console.error('');
  console.error('Example:');
  console.error('  node scripts/automated-font-builder.js --spec=test-font-spec.json');
  process.exit(1);
}

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

async function buildFonts() {
  const projectRoot = path.resolve(__dirname, '..');
  let server = null;
  let browser = null;

  try {
    console.log('');
    console.log('╔════════════════════════════════════════╗');
    console.log('║   AUTOMATED FONT ASSET BUILDER         ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('');

    // Load and validate font spec
    console.log('📄 Loading font specification...');
    const specPath = path.resolve(config.specFile);
    if (!fs.existsSync(specPath)) {
      throw new Error(`Font specification file not found: ${specPath}`);
    }

    const specContent = fs.readFileSync(specPath, 'utf8');
    let fontSpec;
    try {
      fontSpec = JSON.parse(specContent);
    } catch (e) {
      throw new Error(`Invalid JSON in font specification: ${e.message}`);
    }

    if (!fontSpec.fontSets || !Array.isArray(fontSpec.fontSets)) {
      throw new Error('Font specification must contain a "fontSets" array');
    }

    console.log(`✅ Loaded specification from: ${specPath}`);
    console.log(`   Sets: ${fontSpec.fontSets.length}`);
    console.log('');

    // Ensure output directory exists
    const outputDir = path.resolve(config.outputDir);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`✅ Created output directory: ${outputDir}`);
    } else {
      console.log(`✅ Output directory: ${outputDir}`);
    }
    console.log('');

    // Start HTTP server
    server = await startServer(config.port, projectRoot);

    // Launch WebKit browser (uses Core Text on macOS for native font rendering)
    console.log('🚀 Launching headless WebKit...');
    browser = await webkit.launch({
      headless: true
      // WebKit on macOS uses native Core Text rendering - no special flags needed
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });

    const page = await context.newPage();

    // Monitor console output for progress
    console.log('');
    console.log('📊 Build Progress:');
    console.log('─'.repeat(60));

    page.on('console', msg => {
      const text = msg.text();

      // Try to parse as JSON (progress events)
      try {
        const data = JSON.parse(text);
        if (data.type === 'progress') {
          // Display progress bar
          const percent = data.percent.toFixed(1).padStart(5);
          const current = String(data.current).padStart(3);
          const total = String(data.total).padStart(3);
          console.log(`[${current}/${total}] ${percent}% │ ${data.message}`);
          return;
        }
      } catch (e) {
        // Not JSON, treat as regular log
      }

      // Display regular console messages
      const type = msg.type();
      if (type === 'error') {
        console.error(`[BROWSER ERROR]:`, text);
      } else if (type === 'warning') {
        console.warn(`[BROWSER WARN]:`, text);
      } else {
        // Filter out some verbose messages
        if (!text.includes('getHashString') &&
            !text.includes('Canvas prototype') &&
            text.trim().length > 0) {
          console.log(`[BROWSER]:`, text);
        }
      }
    });

    // Navigate to automated builder page
    const pageUrl = `http://localhost:${config.port}/public/automated-font-builder.html`;
    console.log(`🌐 Loading: ${pageUrl}`);
    console.log('');

    await page.goto(pageUrl, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for page to be ready
    await page.waitForTimeout(500);

    console.log('✅ Page loaded, starting font generation...');
    console.log('');

    // Pass font spec to page, build fonts, and get base64 ZIP
    console.log('⏳ Generating ZIP file...');

    const zipBase64 = await page.evaluate(async ({ spec, includeFullMetrics }) => {
      // Call the automation function and return base64 ZIP
      return await window.buildAndExportFonts(spec, {
        includeNonMinifiedMetrics: includeFullMetrics
      });
    }, { spec: fontSpec, includeFullMetrics: config.includeFullMetrics });

    // Validate received data
    if (!zipBase64 || typeof zipBase64 !== 'string') {
      throw new Error('Failed to receive ZIP data from browser');
    }

    console.log('');
    console.log('✅ ZIP received from browser');
    console.log(`📦 Estimated size: ${Math.round(zipBase64.length * 0.75 / 1024)} KB`);
    console.log('💾 Saving to disk...');

    // Decode base64 to buffer and save
    const filename = 'fontAssets.zip';
    const destPath = path.join(outputDir, filename);

    try {
      const zipBuffer = Buffer.from(zipBase64, 'base64');
      fs.writeFileSync(destPath, zipBuffer);
    } catch (err) {
      throw new Error(`Failed to decode or save ZIP data: ${err.message}`);
    }

    // Get file stats
    const stats = fs.statSync(destPath);
    const sizeKB = Math.round(stats.size / 1024);

    console.log('');
    console.log('─'.repeat(60));
    console.log('✅ Font assets generated successfully!');
    console.log('');
    console.log(`📁 Output: ${destPath}`);
    console.log(`📊 Size: ${sizeKB} KB`);
    console.log('');
    console.log('Next steps:');
    console.log('  1. Extract the ZIP file');
    console.log('  2. Process with: ./scripts/watch-font-assets.sh');
    console.log('     (converts QOI→PNG→WebP, optimizes, creates JS wrappers)');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Error:', error.message);
    console.error('');
    if (error.stack) {
      console.error('Stack trace:');
      console.error(error.stack);
      console.error('');
    }
    console.error('Troubleshooting:');
    console.error('1. Ensure the font specification JSON is valid');
    console.error('2. Check that fonts specified are installed on the system');
    console.error('3. Verify all dependencies are loaded in automated-font-builder.html');
    console.error('4. Check browser console output above for specific errors');
    console.error('');
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
    console.log('');
  }
}

// Run
if (require.main === module) {
  buildFonts();
}
