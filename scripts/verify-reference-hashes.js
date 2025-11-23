#!/usr/bin/env node

/**
 * Reference Hash Verification Script
 *
 * Verifies that generated hashes match reference hashes for regression testing.
 * This script generates hashes for a font set and compares them against saved reference hashes.
 *
 * Usage:
 *   node scripts/verify-reference-hashes.js --spec=<spec.json> [options]
 *
 * Options:
 *   --spec <file>        Font set specification JSON file (required)
 *   --hashes <file>      Reference hash file (default: test/data/reference-hashes.js)
 *   --port <port>        HTTP server port (default: 8765)
 *   --verbose            Show all fonts, not just mismatches
 *   --ci                 CI mode: minimal output, exit code only
 *   --fail-fast          Exit on first mismatch
 *   --filter <types>     Comma-separated hash types to check (e.g., "atlas,tight atlas")
 *   --json               Output results as JSON
 *
 * Exit Codes:
 *   0 - All hashes match
 *   1 - Hash mismatches found
 *   2 - Errors during execution
 *
 * Examples:
 *   node scripts/verify-reference-hashes.js --spec=specs/font-sets/test-font-spec.json
 *   node scripts/verify-reference-hashes.js --spec=my-fonts.json --ci
 *   node scripts/verify-reference-hashes.js --spec=my-fonts.json --verbose --json > report.json
 */

const { webkit } = require('playwright');
const path = require('path');
const {
  parseArgs,
  startServer,
  loadFontSpec,
  parseReferenceHashFile,
  calculateFontCount
} = require('./hash-utils');

// Parse CLI arguments
const argParser = parseArgs(process.argv);

// Check for help flag (both --help and -h)
const showHelp = argParser.hasFlag('help') || process.argv.includes('-h');

if (showHelp) {
  console.log('Reference Hash Verification Script');
  console.log('');
  console.log('Verifies that generated hashes match reference hashes for regression testing.');
  console.log('Generates hashes for a font set and compares them against saved references.');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/verify-reference-hashes.js --spec=<file> [options]');
  console.log('');
  console.log('Required:');
  console.log('  --spec <file>        Font set specification JSON file');
  console.log('');
  console.log('Options:');
  console.log('  --hashes <file>      Reference hash file');
  console.log('                       (default: test/data/reference-hashes.js)');
  console.log('  --port <port>        HTTP server port (default: 8765)');
  console.log('  --verbose            Show all fonts, not just mismatches');
  console.log('  --ci                 CI mode: minimal output, exit code only');
  console.log('  --fail-fast          Exit on first mismatch');
  console.log('  --filter <types>     Comma-separated hash types to check');
  console.log('                       (e.g., "atlas,tight atlas")');
  console.log('  --json               Output results as JSON');
  console.log('  --help, -h           Show this help message');
  console.log('');
  console.log('Exit Codes:');
  console.log('  0 - All hashes match');
  console.log('  1 - Hash mismatches found');
  console.log('  2 - Errors during execution');
  console.log('');
  console.log('Examples:');
  console.log('  # Basic verification');
  console.log('  node scripts/verify-reference-hashes.js --spec=specs/font-sets/test-font-spec.json');
  console.log('');
  console.log('  # CI mode (minimal output)');
  console.log('  node scripts/verify-reference-hashes.js --spec=my-fonts.json --ci');
  console.log('');
  console.log('  # Verbose with JSON output');
  console.log('  node scripts/verify-reference-hashes.js --spec=my-fonts.json --verbose --json > report.json');
  console.log('');
  console.log('  # Filter specific hash types');
  console.log('  node scripts/verify-reference-hashes.js --spec=my-fonts.json --filter="atlas,tight atlas"');
  console.log('');
  process.exit(0);
}

const config = {
  specFile: argParser.getArg('spec', null),
  hashesFile: argParser.getArg('hashes', './test/data/reference-hashes.js'),
  port: parseInt(argParser.getArg('port', '8765')),
  verbose: argParser.hasFlag('verbose'),
  ci: argParser.hasFlag('ci'),
  failFast: argParser.hasFlag('fail-fast'),
  filter: argParser.getArg('filter', null),
  json: argParser.hasFlag('json')
};

// Validate required arguments
if (!config.specFile) {
  console.error('❌ Error: --spec argument is required');
  console.error('');
  console.error('Run \'node scripts/verify-reference-hashes.js --help\' for usage information');
  process.exit(2);
}

/**
 * Check if a test copy is compatible with a font family
 * Symbol fonts can only render symbol-only strings
 * Regular fonts can render all test copies (via symbol auto-redirect)
 * This must match the logic in automated-hash-generator.js
 * @param {number} testCopyNumber - Test copy number (1-4)
 * @param {string} fontFamily - Font family name
 * @returns {boolean} True if the test copy can be rendered by this font
 */
function isTestCopyCompatibleWithFont(testCopyNumber, fontFamily) {
  // Regular fonts can render all test copies
  if (fontFamily !== 'BitmapTextInvariant') {
    return true;
  }

  // Font-invariant fonts (BitmapTextInvariant) cannot render regular text
  // All current test copies (1-4) contain regular text or mixed content
  // testCopy1: Regular text
  // testCopy2-3: Kerning test text (regular)
  // testCopy4: Mixed text + font-invariant chars ("Hello ☺ World ✔")
  // None are font-invariant-only, so all are incompatible with BitmapTextInvariant
  return false;
}

/**
 * Extract font family from hash key
 * @param {string} hashKey - Hash key like "density-1-0-Arial-style-normal-weight-normal-size-18-0 atlas"
 * @returns {string|null} Font family name or null if not found
 */
function extractFontFamily(hashKey) {
  // Hash key format: density-{density}-{fontFamily}-style-{style}-weight-{weight}-size-{size} {hashType}
  // Example: "density-1-0-Arial-style-normal-weight-normal-size-18-0 atlas testCopyChoiceNumber 1"
  const match = hashKey.match(/^density-\d+-\d+-([^-]+)-style-/);
  return match ? match[1] : null;
}

/**
 * Extract test copy number from hash key
 * @param {string} hashKey - Hash key
 * @returns {number|null} Test copy number (1-4) or null if not a test copy hash
 */
function extractTestCopyNumber(hashKey) {
  const match = hashKey.match(/testCopyChoiceNumber (\d+)/);
  return match ? parseInt(match[1]) : null;
}

/**
 * Check if a hash key should be skipped due to incompatibility
 * @param {string} hashKey - Hash key to check
 * @returns {boolean} True if this hash should be skipped
 */
function shouldSkipHash(hashKey) {
  const testCopyNum = extractTestCopyNumber(hashKey);
  if (testCopyNum === null) {
    return false; // Not a test copy hash, don't skip
  }

  const fontFamily = extractFontFamily(hashKey);
  if (!fontFamily) {
    return false; // Can't determine font family, don't skip
  }

  return !isTestCopyCompatibleWithFont(testCopyNum, fontFamily);
}

/**
 * Compare generated hashes against reference hashes
 * @param {Object} generatedHashes - Newly generated hashes
 * @param {Object} referenceHashes - Reference hashes from file
 * @param {Object} options - Comparison options
 * @returns {Object} Comparison results
 */
function compareHashes(generatedHashes, referenceHashes, options = {}) {
  const { filter } = options;

  const results = {
    totalFonts: new Set(),
    totalHashes: 0,
    matches: 0,
    mismatches: 0,
    missingInReference: 0,
    missingInGenerated: 0,
    skippedIncompatible: 0,
    details: {}
  };

  // Parse filter if provided
  const filterTypes = filter ? filter.split(',').map(t => t.trim()) : null;

  // Group hashes by font ID
  const fontGroups = {};

  for (const [key, value] of Object.entries(generatedHashes)) {
    // Extract font ID (everything before the hash type)
    // Example: "density-1-0-Arial-normal-normal-18 atlas" -> "density-1-0-Arial-normal-normal-18"
    const match = key.match(/^(.+?)\s+(atlas|tight atlas|positioning|testCopyChoiceNumber)/);

    if (!match) continue;

    const fontId = match[1];
    const hashType = key.substring(fontId.length + 1); // Everything after font ID

    // Apply filter if specified
    if (filterTypes) {
      const shouldInclude = filterTypes.some(type => hashType.includes(type));
      if (!shouldInclude) continue;
    }

    results.totalFonts.add(fontId);
    results.totalHashes++;

    if (!fontGroups[fontId]) {
      fontGroups[fontId] = {
        fontId,
        matches: [],
        mismatches: [],
        missingInReference: [],
        missingInGenerated: []
      };
    }

    // Compare hash
    if (!(key in referenceHashes)) {
      results.missingInReference++;
      fontGroups[fontId].missingInReference.push({
        type: hashType,
        generated: value
      });
    } else if (referenceHashes[key] !== value) {
      results.mismatches++;
      fontGroups[fontId].mismatches.push({
        type: hashType,
        expected: referenceHashes[key],
        actual: value
      });
    } else {
      results.matches++;
      fontGroups[fontId].matches.push({
        type: hashType,
        value: value
      });
    }
  }

  // Check for hashes in reference that weren't generated
  for (const key of Object.keys(referenceHashes)) {
    if (!(key in generatedHashes)) {
      // Skip incompatible test copy/font combinations
      // These are intentionally not generated (e.g., BitmapTextInvariant with regular text test copies)
      if (shouldSkipHash(key)) {
        results.skippedIncompatible++;
        continue;
      }

      const match = key.match(/^(.+?)\s+(atlas|tight atlas|positioning|testCopyChoiceNumber)/);
      if (match) {
        const fontId = match[1];
        const hashType = key.substring(fontId.length + 1);

        // Apply filter
        if (filterTypes) {
          const shouldInclude = filterTypes.some(type => hashType.includes(type));
          if (!shouldInclude) continue;
        }

        if (!fontGroups[fontId]) {
          fontGroups[fontId] = {
            fontId,
            matches: [],
            mismatches: [],
            missingInReference: [],
            missingInGenerated: []
          };
        }

        results.missingInGenerated++;
        fontGroups[fontId].missingInGenerated.push({
          type: hashType,
          expected: referenceHashes[key]
        });
      }
    }
  }

  results.totalFonts = results.totalFonts.size;
  results.details = fontGroups;

  return results;
}

/**
 * Format and display verification results
 */
function displayResults(results, options = {}) {
  const { verbose, ci, json } = options;

  if (json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  if (ci) {
    // Minimal CI output
    console.log('');
    console.log('='.repeat(60));
    console.log('HASH VERIFICATION RESULT');
    console.log('='.repeat(60));
    console.log(`Total fonts: ${results.totalFonts}`);
    console.log(`Total hashes: ${results.totalHashes}`);
    console.log(`Matches: ${results.matches}`);
    console.log(`Mismatches: ${results.mismatches}`);

    if (results.missingInReference > 0) {
      console.log(`Missing in reference: ${results.missingInReference}`);
    }
    if (results.missingInGenerated > 0) {
      console.log(`Missing in generated: ${results.missingInGenerated}`);
    }
    if (results.skippedIncompatible > 0) {
      console.log(`Skipped (incompatible): ${results.skippedIncompatible}`);
    }

    console.log('='.repeat(60));

    if (results.mismatches === 0 && results.missingInReference === 0 && results.missingInGenerated === 0) {
      console.log('✅ PASS: All hashes match');
      if (results.skippedIncompatible > 0) {
        console.log(`ℹ️  Note: ${results.skippedIncompatible} incompatible hashes skipped (BitmapTextInvariant + non-font-invariant test copies)`);
      }
    } else {
      console.log('❌ FAIL: Hash verification failed');
    }
    console.log('');
    return;
  }

  // Detailed output
  console.log('');
  console.log('─'.repeat(80));
  console.log('HASH VERIFICATION RESULTS');
  console.log('─'.repeat(80));
  console.log('');

  // Summary statistics
  console.log('Summary:');
  console.log(`  Total fonts checked: ${results.totalFonts}`);
  console.log(`  Total hashes: ${results.totalHashes}`);
  console.log(`  Matches: ${results.matches} (${(results.matches / results.totalHashes * 100).toFixed(1)}%)`);

  if (results.mismatches > 0) {
    console.log(`  Mismatches: ${results.mismatches} (${(results.mismatches / results.totalHashes * 100).toFixed(1)}%)`);
  }
  if (results.missingInReference > 0) {
    console.log(`  Missing in reference: ${results.missingInReference}`);
  }
  if (results.missingInGenerated > 0) {
    console.log(`  Missing in generated: ${results.missingInGenerated}`);
  }
  if (results.skippedIncompatible > 0) {
    console.log(`  Skipped (incompatible): ${results.skippedIncompatible}`);
  }

  console.log('');

  // Detailed font-by-font results
  const fontIds = Object.keys(results.details).sort();

  let fontsWithIssues = 0;
  let fontsWithMatches = 0;

  for (const fontId of fontIds) {
    const font = results.details[fontId];
    const hasIssues = font.mismatches.length > 0 ||
                      font.missingInReference.length > 0 ||
                      font.missingInGenerated.length > 0;

    if (hasIssues) {
      fontsWithIssues++;
    } else {
      fontsWithMatches++;
    }

    // Show all fonts in verbose mode, or only fonts with issues
    if (verbose || hasIssues) {
      const status = hasIssues ? '❌ FAIL' : '✅ PASS';
      const totalForFont = font.matches.length + font.mismatches.length +
                          font.missingInReference.length + font.missingInGenerated.length;

      console.log(`${status} ${fontId} (${totalForFont} hashes)`);

      // Show matches in verbose mode
      if (verbose && font.matches.length > 0) {
        console.log(`  ✓ Matches: ${font.matches.length}`);
      }

      // Show mismatches
      if (font.mismatches.length > 0) {
        console.log(`  ✗ Mismatches: ${font.mismatches.length}`);
        font.mismatches.forEach(m => {
          console.log(`    - ${m.type}`);
          console.log(`      Expected: ${m.expected}`);
          console.log(`      Actual:   ${m.actual}`);
        });
      }

      // Show missing hashes
      if (font.missingInReference.length > 0) {
        console.log(`  ⚠ New hashes (not in reference): ${font.missingInReference.length}`);
        font.missingInReference.forEach(m => {
          console.log(`    - ${m.type}: ${m.generated}`);
        });
      }

      if (font.missingInGenerated.length > 0) {
        console.log(`  ⚠ Missing hashes (in reference but not generated): ${font.missingInGenerated.length}`);
        font.missingInGenerated.forEach(m => {
          console.log(`    - ${m.type}: ${m.expected}`);
        });
      }

      console.log('');
    }
  }

  // Summary
  console.log('─'.repeat(80));
  if (fontsWithIssues === 0) {
    console.log('✅ SUCCESS: All hashes match!');
    if (results.skippedIncompatible > 0) {
      console.log('');
      console.log(`ℹ️  Note: ${results.skippedIncompatible} incompatible hashes were skipped during verification`);
      console.log(`   Reason: BitmapTextInvariant font is font-invariant-only, cannot render regular text`);
      console.log(`   Skipped: Test copies 1-4 (all contain regular text or mixed content)`);
    } else {
      // Show informational note even when skip count is 0
      console.log('');
      console.log('ℹ️  Note: BitmapTextInvariant fonts have fewer test copy hashes than regular fonts');
      console.log('   Reason: Font-invariant fonts can only render font-invariant-only strings');
      console.log('   Impact: Test copies 1-4 are not generated for BitmapTextInvariant (32 hashes total)');
    }
  } else {
    console.log(`❌ FAILURE: ${fontsWithIssues} font(s) have hash mismatches`);
    console.log(`           ${fontsWithMatches} font(s) passed verification`);
  }
  console.log('─'.repeat(80));
  console.log('');
}

/**
 * Main verification function
 */
async function verifyHashes() {
  const projectRoot = path.resolve(__dirname, '..');
  let server = null;
  let browser = null;

  try {
    if (!config.ci) {
      console.log('');
      console.log('╔════════════════════════════════════════╗');
      console.log('║   HASH VERIFICATION                    ║');
      console.log('╚════════════════════════════════════════╝');
      console.log('');
    }

    // 1. Load font specification
    if (!config.ci) {
      console.log('📄 Loading font specification...');
    }
    const fontSpec = loadFontSpec(config.specFile);
    const fontCount = calculateFontCount(fontSpec);

    if (!config.ci) {
      console.log(`  Spec: ${config.specFile}`);
      console.log(`  Font configurations: ${fontCount}`);
      console.log('');
    }

    // 2. Load reference hashes
    if (!config.ci) {
      console.log('📖 Loading reference hashes...');
    }
    const hashesPath = path.resolve(config.hashesFile);
    const referenceHashes = parseReferenceHashFile(hashesPath);

    if (!config.ci) {
      console.log(`  File: ${hashesPath}`);
      console.log(`  Reference hashes: ${Object.keys(referenceHashes).length}`);
      console.log('');
    }

    // 3. Start HTTP server
    server = await startServer(config.port, projectRoot);

    // 4. Launch browser
    if (!config.ci) {
      console.log('🚀 Launching headless WebKit...');
    }
    browser = await webkit.launch({ headless: true });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });

    const page = await context.newPage();

    // 5. Monitor progress
    if (!config.ci) {
      console.log('');
      console.log('📊 Hash Generation Progress:');
      console.log('─'.repeat(60));
    }

    page.on('console', msg => {
      const text = msg.text();

      try {
        const data = JSON.parse(text);
        if (data.type === 'progress' && !config.ci) {
          const percent = data.percent.toFixed(1).padStart(5);
          const current = String(data.current).padStart(3);
          const total = String(data.total).padStart(3);
          console.log(`[${current}/${total}] ${percent}% │ ${data.message}`);
        }
      } catch (e) {
        // Not JSON, ignore unless error
        const type = msg.type();
        if (type === 'error') {
          console.error(`[BROWSER ERROR]:`, text);
        }
      }
    });

    // 6. Navigate and generate hashes
    const pageUrl = `http://localhost:${config.port}/public/automated-hash-generator.html`;
    await page.goto(pageUrl, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    await page.waitForTimeout(500);

    if (!config.ci) {
      console.log('');
      console.log('⏳ Generating hashes for verification...');
      console.log('');
    }

    const result = await page.evaluate(async (spec) => {
      return await window.generateAndExportHashes(spec);
    }, fontSpec);

    if (!result || typeof result !== 'object' || !result.hashes) {
      throw new Error('Failed to receive hash data from browser');
    }

    const generatedHashes = result.hashes;

    if (!config.ci) {
      console.log('');
      console.log(`✅ Generated ${Object.keys(generatedHashes).length} hashes`);
      console.log('');
    }

    // 7. Compare hashes
    const results = compareHashes(generatedHashes, referenceHashes, {
      filter: config.filter
    });

    // 8. Display results
    displayResults(results, {
      verbose: config.verbose,
      ci: config.ci,
      json: config.json
    });

    // 9. Exit with appropriate code
    const hasFailures = results.mismatches > 0 ||
                       results.missingInReference > 0 ||
                       results.missingInGenerated > 0;

    process.exit(hasFailures ? 1 : 0);

  } catch (error) {
    console.error('');
    console.error('❌ Error:', error.message);
    if (!config.ci) {
      console.error('');
      console.error('Stack trace:');
      console.error(error.stack);
      console.error('');
      console.error('Troubleshooting:');
      console.error('1. Ensure the font specification JSON is valid');
      console.error('2. Ensure reference hash file exists and is valid');
      console.error('3. Check that fonts specified are installed on the system');
      console.error('4. Verify all dependencies are loaded in automated-hash-generator.html');
    }
    console.error('');
    process.exit(2);

  } finally {
    if (browser) {
      await browser.close();
      if (!config.ci && !config.json) {
        console.log('🔒 Browser closed');
      }
    }

    if (server) {
      server.close();
      if (!config.ci && !config.json) {
        console.log('🔒 HTTP server stopped');
        console.log('');
      }
    }
  }
}

// Run
if (require.main === module) {
  verifyHashes();
}

module.exports = { verifyHashes, compareHashes };
