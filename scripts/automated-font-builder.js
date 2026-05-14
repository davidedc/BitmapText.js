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
 *   node scripts/automated-font-builder.js --spec=font-sets/test-font-spec.json
 *   node scripts/automated-font-builder.js --spec=font-sets/my-fonts.json --output=./output
 *
 * Font Set Specification:
 *   See docs/FONT_SET_FORMAT.md for complete format documentation and examples.
 *   Example specification available at: font-sets/test-font-spec.json
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
  console.log('  node scripts/automated-font-builder.js --spec=font-sets/test-font-spec.json');
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
 * Decode a bundle .js wrapper into its envelope object.
 * Bundles are wrapped as `BitmapText.rBundle('<base64>')` (metrics) or
 * `BitmapText.pBundle(<density>,'<base64>')` (positioning), where the base64
 * decodes via deflate-raw to JSON.
 */
function decodeBundleFile(filePath) {
  const zlib = require('zlib');
  const code = fs.readFileSync(filePath, 'utf8');
  const m = code.match(/'([^']+)'/);
  if (!m) throw new Error(`Could not parse base64 from ${filePath}`);
  const buf = Buffer.from(m[1], 'base64');
  const json = zlib.inflateRawSync(buf).toString('utf8');
  return JSON.parse(json);
}

function encodeBundleFile(filePath, envelope, wrapPrefix) {
  const zlib = require('zlib');
  const json = JSON.stringify(envelope);
  const compressed = zlib.deflateRawSync(Buffer.from(json, 'utf8'), { level: 9 });
  const b64 = compressed.toString('base64');
  fs.writeFileSync(filePath, `${wrapPrefix}'${b64}');\n`, 'utf8');
}

const _bundleSort = (a, b) => {
  if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
  if (a[1] !== b[1]) return a[1] - b[1];
  const aw = typeof a[2] === 'number' ? a[2] : 0;
  const bw = typeof b[2] === 'number' ? b[2] : 0;
  if (aw !== bw) return aw - bw;
  return a[3] - b[3];
};

/**
 * Merge multiple ZIP files into one. Atlases (uniquely named per font config)
 * concatenate trivially via overwrite-on-extract. Bundle files (metrics,
 * positioning) recur in every batch with non-overlapping records — they need
 * a record-level merge, otherwise the last batch's bundle silently wins and
 * the final zip carries only that slice's records.
 *
 * @param {string[]} batchPaths - Array of batch ZIP file paths
 * @param {string} outputPath - Final merged ZIP output path
 */
function mergeZips(batchPaths, outputPath) {
  const mergeTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'font-merge-'));

  try {
    console.log(`\n📦 Merging ${batchPaths.length} batch ZIP(s)...`);

    // Pass 1: collect bundle records across all batches BEFORE the overwrite-merge.
    const metricsRecords = new Map();              // key → record
    const positioningByDensity = new Map();        // density → (key → record)
    let metricsFormatVersion = null;
    let positioningFormatVersion = null;

    for (let i = 0; i < batchPaths.length; i++) {
      const batchPath = batchPaths[i];
      const perBatchDir = path.join(mergeTempDir, `batch-${i + 1}`);
      fs.mkdirSync(perBatchDir, { recursive: true });
      execSync(`unzip -oq "${batchPath}" -d "${perBatchDir}"`, { stdio: 'pipe' });

      // Bundle files live under fontAssets/ inside the zip.
      const folder = path.join(perBatchDir, 'fontAssets');
      if (!fs.existsSync(folder)) continue;

      const metricsPath = path.join(folder, 'metrics-bundle.js');
      if (fs.existsSync(metricsPath)) {
        const env = decodeBundleFile(metricsPath);
        if (metricsFormatVersion === null) metricsFormatVersion = env.formatVersion;
        for (const r of env.records || []) {
          const key = `${r[0]}|${r[1]}|${r[2]}|${r[3]}`;
          if (!metricsRecords.has(key)) metricsRecords.set(key, r);
        }
      }

      for (const f of fs.readdirSync(folder)) {
        const m = f.match(/^positioning-bundle-density-(.+)\.js$/);
        if (!m) continue;
        const density = parseFloat(m[1]);
        const env = decodeBundleFile(path.join(folder, f));
        if (positioningFormatVersion === null) positioningFormatVersion = env.formatVersion;
        if (!positioningByDensity.has(density)) positioningByDensity.set(density, new Map());
        const map = positioningByDensity.get(density);
        for (const r of env.records || []) {
          const key = `${r[0]}|${r[1]}|${r[2]}|${r[3]}`;
          if (!map.has(key)) map.set(key, r);
        }
      }
    }

    // Pass 2: extract all batches into the staging dir (last-wins overwrite is
    // fine for atlases; bundle files get rewritten with merged content below).
    const stagingDir = path.join(mergeTempDir, '_final');
    fs.mkdirSync(stagingDir, { recursive: true });
    for (let i = 0; i < batchPaths.length; i++) {
      console.log(`   Extracting batch ${i + 1}/${batchPaths.length}...`);
      execSync(`unzip -oq "${batchPaths[i]}" -d "${stagingDir}"`, { stdio: 'pipe' });
    }

    const stagingFolder = path.join(stagingDir, 'fontAssets');

    // Rewrite the merged metrics bundle.
    if (metricsRecords.size > 0) {
      const records = Array.from(metricsRecords.values()).sort(_bundleSort);
      const envelope = { formatVersion: metricsFormatVersion, records };
      encodeBundleFile(
        path.join(stagingFolder, 'metrics-bundle.js'),
        envelope,
        'BitmapText.rBundle('
      );
      console.log(`   Merged metrics bundle: ${records.length} records`);
    }

    // Rewrite each per-density positioning bundle.
    for (const [density, map] of positioningByDensity.entries()) {
      const records = Array.from(map.values()).sort(_bundleSort);
      const envelope = { formatVersion: positioningFormatVersion, density, records };
      encodeBundleFile(
        path.join(stagingFolder, `positioning-bundle-density-${density}.js`),
        envelope,
        `BitmapText.pBundle(${density},`
      );
      console.log(`   Merged positioning bundle (density ${density}): ${records.length} records`);
    }

    // Final zip from the merged staging dir.
    console.log(`   Creating merged ZIP...`);
    const absoluteOutputPath = path.resolve(outputPath);
    execSync(`cd "${stagingDir}" && zip -q -r "${absoluteOutputPath}" .`, { stdio: 'pipe' });

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

    // Verify BitmapText and CharacterSets are fully initialized
    // This ensures static fields (FONT_SPECIFIC_CHARS, FONT_INVARIANT_CHARS) are ready
    const isReady = await page.evaluate(() => ({
      bitmapTextReady: window.bitmapTextReady,
      hasBitmapText: typeof window.BitmapText !== 'undefined',
      hasCharacterSets: typeof window.CharacterSets !== 'undefined',
      hasFontSpecificChars: !!window.CharacterSets?.FONT_SPECIFIC_CHARS,
      hasFontInvariantChars: !!window.CharacterSets?.FONT_INVARIANT_CHARS,
      characterSetLength: window.CharacterSets?.FONT_SPECIFIC_CHARS?.length
    }));

    if (!isReady.bitmapTextReady) {
      console.error('❌ Ready flag not set:', isReady);
      throw new Error('BitmapText readiness flag not set');
    }

    if (!isReady.hasBitmapText) {
      console.error('❌ BitmapText class not on window:', isReady);
      throw new Error('BitmapText class not accessible on window object');
    }

    if (!isReady.hasCharacterSets) {
      console.error('❌ CharacterSets class not on window:', isReady);
      throw new Error('CharacterSets class not accessible on window object');
    }

    if (!isReady.hasFontSpecificChars || !isReady.hasFontInvariantChars) {
      console.error('❌ CharacterSets static fields not initialized:', isReady);
      throw new Error(`CharacterSets static fields missing. FONT_SPECIFIC_CHARS: ${isReady.hasFontSpecificChars}, FONT_INVARIANT_CHARS: ${isReady.hasFontInvariantChars}`);
    }

    console.log('✅ Page loaded with BitmapText and CharacterSets initialized, calculating font counts...');
    console.log(`   FONT_SPECIFIC_CHARS length: ${isReady.characterSetLength}`);
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

    // Step 2: Partition fontSets into batches based on font counts.
    // FontSets that fit within batchSize are grouped together. Oversized fontSets
    // are auto-chunked into multiple single-set batches with skip/take subranges,
    // so that a page reload happens between sub-ranges to relieve WebKit's
    // per-process 2D-canvas backing-store pressure.
    const batches = [];
    let currentBatch = { fontSets: [], totalCount: 0, setIndices: [] };

    const flushCurrentBatch = () => {
      if (currentBatch.fontSets.length > 0) {
        batches.push(currentBatch);
        currentBatch = { fontSets: [], totalCount: 0, setIndices: [] };
      }
    };

    for (const sc of setCounts) {
      // Oversized single fontSet: flush current batch, then emit one batch per chunk
      if (sc.count > config.batchSize) {
        flushCurrentBatch();

        const numChunks = Math.ceil(sc.count / config.batchSize);
        for (let chunkIdx = 0; chunkIdx < numChunks; chunkIdx++) {
          const skip = chunkIdx * config.batchSize;
          const take = Math.min(config.batchSize, sc.count - skip);
          batches.push({
            fontSets: [fontSpec.fontSets[sc.index]],
            totalCount: take,
            setIndices: [sc.index],
            skip,
            take,
            chunkLabel: `${sc.name} (chunk ${chunkIdx + 1}/${numChunks}, fonts ${skip + 1}-${skip + take})`
          });
        }
        continue;
      }

      // Normal-sized set: pack into current batch (flush if it would overflow)
      if (currentBatch.totalCount + sc.count > config.batchSize && currentBatch.fontSets.length > 0) {
        flushCurrentBatch();
      }

      currentBatch.fontSets.push(fontSpec.fontSets[sc.index]);
      currentBatch.totalCount += sc.count;
      currentBatch.setIndices.push(sc.index);
    }
    flushCurrentBatch();

    console.log(`📦 Split into ${batches.length} batch(es):`);
    batches.forEach((batch, idx) => {
      const label = batch.chunkLabel
        || `sets: ${batch.setIndices.map(i => setCounts[i].name).join(', ')}`;
      console.log(`   Batch ${idx + 1}: ${batch.totalCount} fonts (${label})`);
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

        // Generate fonts for this batch (with optional skip/take for chunked oversized sets)
        const batchSpec = { fontSets: batch.fontSets };
        const zipBase64 = await page.evaluate(async ({ spec, includeFullMetrics, skip, take }) => {
          return await window.buildAndExportFonts(spec, {
            includeNonMinifiedMetrics: includeFullMetrics,
            skip,
            take
          });
        }, {
          spec: batchSpec,
          includeFullMetrics: config.includeFullMetrics,
          skip: batch.skip,
          take: batch.take
        });

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
          // This ensures CharacterSets static fields (FONT_SPECIFIC_CHARS, FONT_INVARIANT_CHARS) are ready
          const isReady = await page.evaluate(() => ({
            bitmapTextReady: window.bitmapTextReady,
            hasBitmapText: typeof window.BitmapText !== 'undefined',
            hasCharacterSets: typeof window.CharacterSets !== 'undefined',
            hasFontSpecificChars: !!window.CharacterSets?.FONT_SPECIFIC_CHARS,
            hasFontInvariantChars: !!window.CharacterSets?.FONT_INVARIANT_CHARS
          }));

          if (!isReady.bitmapTextReady || !isReady.hasBitmapText || !isReady.hasCharacterSets || !isReady.hasFontSpecificChars || !isReady.hasFontInvariantChars) {
            console.error('❌ BitmapText not ready after reload:', isReady);
            throw new Error(`BitmapText initialization failed after reload. Ready: ${isReady.bitmapTextReady}, BitmapText: ${isReady.hasBitmapText}, CharacterSets: ${isReady.hasCharacterSets}, FONT_SPECIFIC_CHARS: ${isReady.hasFontSpecificChars}, FONT_INVARIANT_CHARS: ${isReady.hasFontInvariantChars}`);
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
