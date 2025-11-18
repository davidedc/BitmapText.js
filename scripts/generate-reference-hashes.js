#!/usr/bin/env node

/**
 * Automated Reference Hash Generator
 *
 * This script uses Playwright to automate hash generation for reference testing:
 * 1. Loads a font set specification from JSON
 * 2. Starts a local HTTP server
 * 3. Launches a headless browser
 * 4. Navigates to the automated hash generator page
 * 5. Passes the font specification to the page
 * 6. Monitors hash generation progress via console
 * 7. Receives generated hashes
 * 8. Formats and saves to reference-hashes.js
 *
 * Usage:
 *   node scripts/generate-reference-hashes.js --spec=<path-to-spec.json> [options]
 *
 * Options:
 *   --spec <file>        Font set specification JSON file (required)
 *   --output <file>      Output file (default: test/data/reference-hashes.js)
 *   --port <port>        HTTP server port (default: 8765)
 *   --merge              Merge with existing hashes instead of overwriting
 *
 * Examples:
 *   node scripts/generate-reference-hashes.js --spec=specs/font-sets/test-font-spec.json
 *   node scripts/generate-reference-hashes.js --spec=specs/font-sets/my-fonts.json --merge
 *   node scripts/generate-reference-hashes.js --spec=specs/font-sets/my-fonts.json --output=./my-hashes.js
 *
 * Font Set Specification:
 *   See docs/FONT_SET_FORMAT.md for complete format documentation and examples.
 */

const { webkit } = require('playwright');
const fs = require('fs');
const path = require('path');
const {
  parseArgs,
  startServer,
  loadFontSpec,
  parseReferenceHashFile,
  calculateFontCount
} = require('./hash-utils');

// Parse command line arguments
const argParser = parseArgs(process.argv);
const config = {
  specFile: argParser.getArg('spec', null),
  outputFile: argParser.getArg('output', './test/data/reference-hashes.js'),
  port: parseInt(argParser.getArg('port', '8765')),
  merge: argParser.hasFlag('merge')
};

// Validate required arguments
if (!config.specFile) {
  console.error('❌ Error: --spec argument is required');
  console.error('');
  console.error('Usage:');
  console.error('  node scripts/generate-reference-hashes.js --spec=<path-to-spec.json> [options]');
  console.error('');
  console.error('Example:');
  console.error('  node scripts/generate-reference-hashes.js --spec=specs/font-sets/test-font-spec.json');
  process.exit(1);
}

/**
 * Format hash object into JavaScript source code
 * @param {Object} hashes - Hash object
 * @param {Object} metadata - Metadata for comment header
 * @returns {string} Formatted JavaScript code
 */
function formatHashesForOutput(hashes, metadata) {
  const timestamp = new Date().toISOString();
  const hashCount = Object.keys(hashes).length;

  // Separate positioning hashes from pixel hashes
  const pixelHashes = {};
  const positioningHashes = {};

  for (const [key, value] of Object.entries(hashes)) {
    if (key.includes(' positioning')) {
      positioningHashes[key] = value;
    } else {
      pixelHashes[key] = value;
    }
  }

  // Sort pixel hash keys alphabetically
  const sortedKeys = Object.keys(pixelHashes).sort();

  // Build output
  let output = '';
  output += '// Auto-generated reference hashes for BitmapText.js\n';
  output += `// Generated: ${timestamp}\n`;
  output += `// Spec: ${metadata.specFile}\n`;
  output += `// Font configurations: ${metadata.fontCount}\n`;
  output += `// Total hashes: ${hashCount}\n`;
  output += '\n';

  // Add positioning hashes as comments if any exist
  if (Object.keys(positioningHashes).length > 0) {
    output += '// Positioning hashes (metadata, not pixel hashes):\n';
    for (const [key, value] of Object.entries(positioningHashes)) {
      output += `// ${key}: ${value}\n`;
    }
    output += '\n';
  }

  output += 'const storedReferenceCrispTextRendersHashes = {\n';

  // Add each hash entry
  sortedKeys.forEach((key, index) => {
    const value = pixelHashes[key];
    const isLast = index === sortedKeys.length - 1;
    output += ` "${key}":"${value}"${isLast ? '' : ','}\n`;
  });

  output += '};\n';
  output += '\n';
  output += 'const hashStore = new HashStore(storedReferenceCrispTextRendersHashes);\n';

  return output;
}

/**
 * Merge new hashes with existing hashes from file
 * @param {string} filePath - Path to existing hash file
 * @param {Object} newHashes - New hashes to merge
 * @returns {Object} Merged hash object
 */
function mergeWithExistingHashes(filePath, newHashes) {
  if (!fs.existsSync(filePath)) {
    console.log('⚠️  No existing hash file found, creating new file');
    return newHashes;
  }

  console.log('📖 Reading existing hashes...');

  try {
    // Use shared utility to parse hash file
    const existingHashes = parseReferenceHashFile(filePath);

    console.log(`✅ Loaded ${Object.keys(existingHashes).length} existing hashes`);

    // Merge: new hashes override existing ones
    const merged = { ...existingHashes, ...newHashes };
    const addedCount = Object.keys(newHashes).length;
    const updatedCount = Object.keys(newHashes).filter(k => k in existingHashes).length;
    const newCount = addedCount - updatedCount;

    console.log(`📊 Merge summary:`);
    console.log(`   - Existing: ${Object.keys(existingHashes).length}`);
    console.log(`   - New: ${newCount}`);
    console.log(`   - Updated: ${updatedCount}`);
    console.log(`   - Total: ${Object.keys(merged).length}`);

    return merged;

  } catch (error) {
    console.error(`❌ Error reading existing hash file: ${error.message}`);
    console.log('⚠️  Falling back to new hashes only');
    return newHashes;
  }
}

async function generateHashes() {
  const projectRoot = path.resolve(__dirname, '..');
  let server = null;
  let browser = null;

  try {
    console.log('');
    console.log('╔════════════════════════════════════════╗');
    console.log('║   AUTOMATED HASH GENERATOR             ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('');

    // Load and validate font spec
    console.log('📄 Loading font specification...');
    const fontSpec = loadFontSpec(config.specFile);
    const fontCount = calculateFontCount(fontSpec);

    console.log(`✅ Loaded specification from: ${config.specFile}`);
    console.log(`   Sets: ${fontSpec.fontSets.length}`);
    console.log(`   Font configurations: ${fontCount}`);
    console.log('');

    // Determine output file path
    const outputPath = path.resolve(config.outputFile);
    console.log(`📁 Output file: ${outputPath}`);

    if (config.merge) {
      console.log('🔀 Merge mode enabled');
    }
    console.log('');

    // Start HTTP server
    server = await startServer(config.port, projectRoot);

    // Launch WebKit browser (uses Core Text on macOS for native font rendering)
    console.log('🚀 Launching headless WebKit...');
    browser = await webkit.launch({
      headless: true
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });

    const page = await context.newPage();

    // Monitor console output for progress
    console.log('');
    console.log('📊 Hash Generation Progress:');
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

    // Navigate to automated hash generator page
    const pageUrl = `http://localhost:${config.port}/public/automated-hash-generator.html`;
    console.log(`🌐 Loading: ${pageUrl}`);
    console.log('');

    await page.goto(pageUrl, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for page to be ready
    await page.waitForTimeout(500);

    console.log('✅ Page loaded, starting hash generation...');
    console.log('');

    // Pass font spec to page and generate hashes
    console.log('⏳ Generating hashes...');

    const hashes = await page.evaluate(async (spec) => {
      // Call the hash generation function and return hash object
      return await window.generateAndExportHashes(spec);
    }, fontSpec);

    // Validate received data
    if (!hashes || typeof hashes !== 'object') {
      throw new Error('Failed to receive hash data from browser');
    }

    console.log('');
    console.log('✅ Hashes received from browser');
    console.log(`📊 Total hashes: ${Object.keys(hashes).length}`);

    // Merge with existing if requested
    let finalHashes = hashes;
    if (config.merge) {
      console.log('');
      finalHashes = mergeWithExistingHashes(outputPath, hashes);
    }

    console.log('');
    console.log('💾 Formatting and saving...');

    // Format as JavaScript (using fontCount calculated earlier)
    const output = formatHashesForOutput(finalHashes, {
      specFile: config.specFile,
      fontCount: fontCount
    });

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write to file
    fs.writeFileSync(outputPath, output, 'utf8');

    const stats = fs.statSync(outputPath);
    const sizeKB = Math.round(stats.size / 1024);

    console.log('');
    console.log('─'.repeat(60));
    console.log('✅ Hash generation complete!');
    console.log('');
    console.log(`📁 Output: ${outputPath}`);
    console.log(`📊 Size: ${sizeKB} KB`);
    console.log(`📊 Hash count: ${Object.keys(finalHashes).length}`);
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
    console.error('3. Verify all dependencies are loaded in automated-hash-generator.html');
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
  generateHashes();
}
