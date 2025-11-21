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
 *   --batch-size <n>     Max fonts per batch for memory management (default: 72)
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
const os = require('os');
const { execSync } = require('child_process');

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

// Check for help flag
const showHelp = hasFlag('help') || args.includes('-h');

if (showHelp) {
  console.log('Automated Font Asset Builder');
  console.log('');
  console.log('Automates font asset generation using Playwright and headless WebKit.');
  console.log('Loads font specifications from JSON and generates complete font atlases.');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/automated-font-builder.js --spec=<file> [options]');
  console.log('');
  console.log('Required:');
  console.log('  --spec <file>        Font set specification JSON file');
  console.log('                       (See docs/FONT_SET_FORMAT.md for format)');
  console.log('');
  console.log('Options:');
  console.log('  --output <dir>       Output directory');
  console.log('                       (default: ./automatically-generated-font-assets)');
  console.log('  --port <port>        HTTP server port (default: 8765)');
  console.log('  --include-full       Include non-minified metrics files');
  console.log('  --batch-size <n>     Max fonts per batch for memory management (default: 72)');
  console.log('  --help, -h           Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/automated-font-builder.js --spec=specs/font-sets/test-font-spec.json');
  console.log('  node scripts/automated-font-builder.js --spec=my-fonts.json --output=./fonts');
  console.log('  node scripts/automated-font-builder.js --spec=large-set.json --batch-size=50 --include-full');
  console.log('');
  console.log('Next Steps:');
  console.log('  After generation, process the output with:');
  console.log('    ./scripts/watch-font-assets.sh');
  console.log('  This converts QOI→PNG→WebP and creates optimized JS wrappers.');
  console.log('');
  console.log('Prerequisites:');
  console.log('  npm install                      # Install Playwright');
  console.log('  npx playwright install webkit    # Install WebKit browser');
  console.log('');
  process.exit(0);
}

const config = {
  specFile: getArg('spec', null),
  outputDir: getArg('output', './automatically-generated-font-assets'),
  port: parseInt(getArg('port', '8765')),
  includeFullMetrics: hasFlag('include-full'),
  batchSize: parseInt(getArg('batch-size', '72'))
};

// Validate required arguments
if (!config.specFile) {
  console.error('❌ Error: --spec argument is required');
  console.error('');
  console.error('Run \'node scripts/automated-font-builder.js --help\' for usage information');
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

/**
 * Merge multiple ZIP files into one using native zip/unzip commands
 * @param {string[]} batchPaths - Array of batch ZIP file paths
 * @param {string} outputPath - Final merged ZIP output path
 */
function mergeZips(batchPaths, outputPath) {
  const mergeTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'font-merge-'));

  try {
    console.log(`\n📦 Merging ${batchPaths.length} batch ZIP(s)...`);

    // Extract all batch ZIPs to temp directory
    for (let i = 0; i < batchPaths.length; i++) {
      const batchPath = batchPaths[i];
      console.log(`   Extracting batch ${i + 1}/${batchPaths.length}...`);
      execSync(`unzip -q "${batchPath}" -d "${mergeTempDir}"`, {
        stdio: 'pipe'
      });
    }

    // Create final merged ZIP
    console.log(`   Creating merged ZIP...`);
    const absoluteOutputPath = path.resolve(outputPath);
    execSync(`cd "${mergeTempDir}" && zip -q -r "${absoluteOutputPath}" .`, {
      stdio: 'pipe'
    });

    console.log(`✅ Merged ZIP created: ${outputPath}`);

  } catch (error) {
    throw new Error(`Failed to merge ZIPs: ${error.message}`);
  } finally {
    // Clean up merge temp directory
    fs.rmSync(mergeTempDir, { recursive: true, force: true });
  }
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

    // Verify BitmapText is fully initialized
    // This ensures static fields (CHARACTER_SET, SYMBOL_CHARACTERS_STRING) are ready
    const isReady = await page.evaluate(() => ({
      bitmapTextReady: window.bitmapTextReady,
      hasBitmapText: typeof window.BitmapText !== 'undefined',
      hasCharacterSet: !!window.BitmapText?.CHARACTER_SET,
      hasSymbolString: !!window.BitmapText?.SYMBOL_CHARACTERS_STRING,
      characterSetLength: window.BitmapText?.CHARACTER_SET?.length
    }));

    if (!isReady.bitmapTextReady) {
      console.error('❌ Ready flag not set:', isReady);
      throw new Error('BitmapText readiness flag not set');
    }

    if (!isReady.hasBitmapText) {
      console.error('❌ BitmapText class not on window:', isReady);
      throw new Error('BitmapText class not accessible on window object');
    }

    if (!isReady.hasCharacterSet || !isReady.hasSymbolString) {
      console.error('❌ BitmapText static fields not initialized:', isReady);
      throw new Error(`BitmapText static fields missing. CHARACTER_SET: ${isReady.hasCharacterSet}, SYMBOL_CHARACTERS_STRING: ${isReady.hasSymbolString}`);
    }

    console.log('✅ Page loaded with BitmapText initialized, calculating font counts...');
    console.log(`   CHARACTER_SET length: ${isReady.characterSetLength}`);
    console.log('');

    // Step 1: Get font counts for each set from browser
    const setCounts = await page.evaluate(async ({ spec }) => {
      // Use FontSetGenerator to calculate counts (available in browser context)
      const counts = [];
      for (let i = 0; i < spec.fontSets.length; i++) {
        const set = spec.fontSets[i];
        const generator = new FontSetGenerator({ fontSets: [set] });
        counts.push({
          index: i,
          name: set.name || `Set ${i + 1}`,
          count: generator.getCount()
        });
      }
      return counts;
    }, { spec: fontSpec });

    // Calculate total fonts
    const totalFonts = setCounts.reduce((sum, sc) => sum + sc.count, 0);
    console.log(`📊 Total fonts to generate: ${totalFonts}`);
    console.log(`📦 Batch size: ${config.batchSize} fonts`);
    console.log('');

    // Display set breakdown
    console.log('Font sets:');
    setCounts.forEach(sc => {
      console.log(`   ${sc.name}: ${sc.count} fonts`);
    });
    console.log('');

    // Step 2: Partition fontSets into batches based on font counts
    const batches = [];
    let currentBatch = { fontSets: [], totalCount: 0, setIndices: [] };

    for (const sc of setCounts) {
      // Check if adding this set would exceed limit
      if (currentBatch.totalCount + sc.count > config.batchSize && currentBatch.fontSets.length > 0) {
        batches.push(currentBatch);
        currentBatch = { fontSets: [], totalCount: 0, setIndices: [] };
      }

      // Check if single set exceeds limit (error case)
      if (sc.count > config.batchSize) {
        throw new Error(
          `FontSet "${sc.name}" generates ${sc.count} fonts, ` +
          `which exceeds batch limit of ${config.batchSize}. ` +
          `Please split this fontSet into smaller sets or increase --batch-size.`
        );
      }

      currentBatch.fontSets.push(fontSpec.fontSets[sc.index]);
      currentBatch.totalCount += sc.count;
      currentBatch.setIndices.push(sc.index);
    }

    // Add final batch
    if (currentBatch.fontSets.length > 0) {
      batches.push(currentBatch);
    }

    console.log(`📦 Split into ${batches.length} batch(es):`);
    batches.forEach((batch, idx) => {
      console.log(`   Batch ${idx + 1}: ${batch.totalCount} fonts (sets: ${batch.setIndices.map(i => setCounts[i].name).join(', ')})`);
    });
    console.log('');

    // Step 3: Process each batch
    const tempDir = path.join(os.tmpdir(), `font-batches-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    console.log(`📁 Temp directory: ${tempDir}`);
    console.log('');

    const batchZipPaths = [];

    try {
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchNum = i + 1;

        console.log(`⏳ Processing batch ${batchNum}/${batches.length} (${batch.totalCount} fonts)...`);
        console.log('─'.repeat(60));

        // Generate fonts for this batch
        const batchSpec = { fontSets: batch.fontSets };
        const zipBase64 = await page.evaluate(async ({ spec, includeFullMetrics }) => {
          return await window.buildAndExportFonts(spec, {
            includeNonMinifiedMetrics: includeFullMetrics
          });
        }, { spec: batchSpec, includeFullMetrics: config.includeFullMetrics });

        // Validate received data
        if (!zipBase64 || typeof zipBase64 !== 'string') {
          throw new Error(`Batch ${batchNum} failed: No ZIP data received from browser`);
        }

        // Save batch ZIP to temp
        const batchPath = path.join(tempDir, `batch-${batchNum}.zip`);
        const zipBuffer = Buffer.from(zipBase64, 'base64');
        fs.writeFileSync(batchPath, zipBuffer);
        batchZipPaths.push(batchPath);

        const batchSizeKB = (zipBuffer.length / 1024).toFixed(1);
        console.log('');
        console.log(`✅ Batch ${batchNum} saved: ${batchSizeKB} KB`);

        // Reload page for memory cleanup (unless last batch)
        if (i < batches.length - 1) {
          console.log(`🔄 Reloading page for memory cleanup...`);
          await page.reload({ waitUntil: 'networkidle', timeout: 30000 });

          // Verify BitmapText is fully initialized after reload
          // This ensures static fields (CHARACTER_SET, SYMBOL_CHARACTERS_STRING) are ready
          const isReady = await page.evaluate(() => ({
            bitmapTextReady: window.bitmapTextReady,
            hasBitmapText: typeof window.BitmapText !== 'undefined',
            hasCharacterSet: !!window.BitmapText?.CHARACTER_SET,
            hasSymbolString: !!window.BitmapText?.SYMBOL_CHARACTERS_STRING
          }));

          if (!isReady.bitmapTextReady || !isReady.hasBitmapText || !isReady.hasCharacterSet || !isReady.hasSymbolString) {
            console.error('❌ BitmapText not ready after reload:', isReady);
            throw new Error(`BitmapText initialization failed after reload. Ready: ${isReady.bitmapTextReady}, Class on window: ${isReady.hasBitmapText}, CHARACTER_SET: ${isReady.hasCharacterSet}, SYMBOL_CHARACTERS_STRING: ${isReady.hasSymbolString}`);
          }

          console.log('✅ Page ready with BitmapText initialized');
          console.log('');
        }
      }

      console.log('');
      console.log('─'.repeat(60));

      // Step 4: Merge all batch ZIPs into final fontAssets.zip
      const filename = 'fontAssets.zip';
      const destPath = path.join(outputDir, filename);

      if (batchZipPaths.length === 1) {
        // Single batch - just copy it
        console.log('📦 Single batch - copying to output...');
        fs.copyFileSync(batchZipPaths[0], destPath);
      } else {
        // Multiple batches - merge them
        mergeZips(batchZipPaths, destPath);
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
      console.log(`📦 Total fonts: ${totalFonts}`);
      console.log(`📋 Batches processed: ${batches.length}`);
      console.log('');
      console.log('Next steps:');
      console.log('  1. Extract the ZIP file');
      console.log('  2. Process with: ./scripts/watch-font-assets.sh');
      console.log('     (converts QOI→PNG→WebP, optimizes, creates JS wrappers)');
      console.log('');

    } finally {
      // Clean up temp directory
      if (fs.existsSync(tempDir)) {
        console.log('🧹 Cleaning up temporary files...');
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }

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
