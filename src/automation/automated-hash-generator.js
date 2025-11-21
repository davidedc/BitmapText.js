// Automated Hash Generator
// Generates reference hashes for all hash check types in font-assets-builder.html
// This script runs in a browser context with all necessary dependencies loaded

/**
 * Initialize specs from default-specs.js
 * @returns {Specs} Parsed specs object
 */
function initializeSpecs() {
  console.log('Initializing kerning specs...');
  const specsParser = new SpecsParser();
  const specs = specsParser.parseSpecsIfChanged(specsDefault);
  BitmapTextFAB.setSpecs(specs);
  console.log('✓ Specs initialized');
  return specs;
}

/**
 * Build font assets for a single font configuration
 * Creates glyphs and builds kerning table
 * @param {FontProperties} fontProperties - Font configuration
 */
async function buildFont(fontProperties) {
  // Create glyphs - includes both standard 204 chars + custom character set if defined
  // This ensures symbol fonts like BitmapTextSymbols have the actual symbols rendered
  createGlyphsAndAddToFullStore(fontProperties);

  // Build kerning table
  BitmapTextFAB.buildKerningTableIfDoesntExist(fontProperties);

  // Clean up DOM canvases to prevent WebKit memory exhaustion
  // Remove canvases from DOM but preserve data for hash calculations
  // Canvas data persists in GlyphFAB instances (this.tightCanvas, this.canvasCopy)
  const canvases = document.querySelectorAll('canvas');
  canvases.forEach(c => {
    c.remove();  // Remove from DOM but keep data intact
  });
}

/**
 * Create canvas and render test text for hash calculation
 * @param {number} testCopyNumber - Test copy choice (1, 2, 3, or 4)
 * @param {FontProperties} fontProperties - Font configuration
 * @param {TextProperties} textProperties - Text rendering properties
 * @returns {HTMLCanvasElement} Canvas with rendered text
 */
function renderTestCopyToCanvas(testCopyNumber, fontProperties, textProperties) {
  // Get test copy text based on number
  let testCopy;
  switch (testCopyNumber) {
    case 1:
      testCopy = testCopy1;
      break;
    case 2:
      testCopy = kernKingCopyPart1;
      break;
    case 3:
      testCopy = kernKingCopyPart2;
      break;
    case 4:
      testCopy = testCopy4;
      break;
    default:
      throw new Error(`Invalid testCopyNumber: ${testCopyNumber}`);
  }

  const testCopyLines = testCopy.split("\n");

  // Measure text to determine canvas size
  const fontMetrics = FontMetricsStore.getFontMetrics(fontProperties);
  if (!fontMetrics) {
    throw new Error(`No metrics found for ${fontProperties.idString}`);
  }

  // Copy metrics to BitmapText for measureText
  BitmapText.setFontMetrics(fontProperties, fontMetrics);

  // Measure each line
  let maxWidth = 0;
  let totalHeight = 0;

  for (const line of testCopyLines) {
    const measureResult = BitmapText.measureText(line, fontProperties, textProperties);
    const metrics = measureResult.metrics || measureResult;

    maxWidth = Math.max(maxWidth, metrics.width || 0);
    totalHeight += (metrics.fontBoundingBoxAscent || 0) + Math.abs(metrics.fontBoundingBoxDescent || 0);
  }

  // Create canvas
  const canvas = document.createElement('canvas');
  const pixelDensity = fontProperties.pixelDensity;
  canvas.width = Math.ceil(maxWidth * pixelDensity);
  canvas.height = Math.ceil(totalHeight * pixelDensity);

  const ctx = canvas.getContext('2d');

  // White background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw each line using BitmapText
  testCopyLines.forEach((line, i) => {
    const yPosition = Math.round((i + 1) * totalHeight / testCopyLines.length);
    BitmapText.drawTextFromAtlas(ctx, line, 0, yPosition, fontProperties, textProperties);
  });

  return canvas;
}

/**
 * Ensure BitmapTextSymbols font is loaded for symbol auto-redirect
 * Test copy 4 contains symbols that require BitmapTextSymbols font
 * @param {FontProperties} fontProperties - Current font being processed
 */
async function ensureSymbolFontLoaded(fontProperties) {
  // Skip if already processing BitmapTextSymbols
  if (fontProperties.fontFamily === 'BitmapTextSymbols') {
    return;
  }

  // Check if BitmapTextSymbols is already loaded at this size
  const symbolFontProps = new FontPropertiesFAB(
    fontProperties.pixelDensity,
    'BitmapTextSymbols',
    fontProperties.fontStyle,
    fontProperties.fontWeight,
    fontProperties.fontSize
  );

  // Check if already has atlas data
  const existingData = BitmapText.getAtlasData(symbolFontProps.idString);
  if (existingData) {
    return; // Already loaded
  }

  // Build BitmapTextSymbols font for symbol auto-redirect
  console.log(`  Loading BitmapTextSymbols (${fontProperties.fontSize}px) for test copy 4 symbol rendering...`);
  await buildFont(symbolFontProps);

  // Build and store atlas
  const atlasResult = AtlasDataStoreFAB.buildAtlas(symbolFontProps);
  const tightData = AtlasDataStoreFAB.reconstructTightAtlas(
    atlasResult.canvas,
    symbolFontProps
  );
  BitmapText.setAtlasData(symbolFontProps, tightData);
}

/**
 * Get test copy text by number
 * @param {number} testCopyNumber - Test copy choice (1, 2, 3, or 4)
 * @returns {string} Test copy text
 */
function getTestCopyText(testCopyNumber) {
  switch (testCopyNumber) {
    case 1:
      return testCopy1;
    case 2:
      return kernKingCopyPart1;
    case 3:
      return kernKingCopyPart2;
    case 4:
      return testCopy4;
    default:
      throw new Error(`Invalid testCopyNumber: ${testCopyNumber}`);
  }
}

/**
 * Check if a string contains only symbols (no regular text)
 * @param {string} str - String to check
 * @returns {boolean} True if string contains only symbols from BitmapText.SYMBOL_CHARACTERS_STRING
 */
function isOnlySymbols(str) {
  // Remove whitespace and newlines for checking
  const nonWhitespace = str.replace(/\s/g, '');
  if (nonWhitespace.length === 0) {
    return false; // Empty string or only whitespace
  }

  // Check if all non-whitespace characters are in the symbol set
  const symbolSet = new Set(BitmapText.SYMBOL_CHARACTERS_STRING);
  for (const char of nonWhitespace) {
    if (!symbolSet.has(char)) {
      return false; // Found a non-symbol character
    }
  }
  return true;
}

/**
 * Check if a test copy is compatible with a font family
 * Symbol fonts can only render symbol-only strings
 * Regular fonts can render all test copies (via symbol auto-redirect)
 * @param {number} testCopyNumber - Test copy choice (1, 2, 3, or 4)
 * @param {string} fontFamily - Font family name
 * @returns {boolean} True if the test copy can be rendered by this font
 */
function isTestCopyCompatibleWithFont(testCopyNumber, fontFamily) {
  // Regular fonts can render all test copies (including mixed text/symbols via auto-redirect)
  if (fontFamily !== 'BitmapTextSymbols') {
    return true;
  }

  // Symbol fonts can only render symbol-only strings
  const testCopyText = getTestCopyText(testCopyNumber);
  return isOnlySymbols(testCopyText);
}

/**
 * Generate all hash types for a single font configuration
 * @param {FontProperties} fontProperties - Font configuration
 * @returns {Object} Object with hash data and skip statistics
 */
async function generateHashesForFont(fontProperties) {
  const idString = fontProperties.idString;
  const hashes = {};
  let skippedCount = 0;

  console.log(`Generating hashes for ${idString}...`);

  // Build the font first
  await buildFont(fontProperties);

  // 1. Build Atlas Source (variable-width cells)
  const atlasResult = AtlasDataStoreFAB.buildAtlas(fontProperties);
  const atlasSourceCtx = atlasResult.canvas.getContext('2d');
  hashes[`${idString} atlas`] = atlasSourceCtx.getHashString();

  // 2. Reconstruct Tight Atlas
  const tightData = AtlasDataStoreFAB.reconstructTightAtlas(
    atlasResult.canvas,
    fontProperties
  );

  // Store in BitmapText for rendering
  BitmapText.setAtlasData(fontProperties, tightData);

  const tightAtlasCtx = tightData.atlasImage.image.getContext('2d');
  hashes[`${idString} tight atlas`] = tightAtlasCtx.getHashString();

  // 3. Positioning Hash (stored as comment in output)
  const positioningHash = AtlasPositioningFAB.getHash(tightData.atlasPositioning);
  hashes[`${idString} positioning`] = positioningHash;

  // Ensure BitmapTextSymbols is loaded for test copy 4 (contains symbols)
  await ensureSymbolFontLoaded(fontProperties);

  // 4-7. Black text rendering for 4 test copies
  const blackTextProps = new TextProperties({ textColor: '#000000' });

  for (let testCopyNum = 1; testCopyNum <= 4; testCopyNum++) {
    // Skip test copies incompatible with this font
    if (!isTestCopyCompatibleWithFont(testCopyNum, fontProperties.fontFamily)) {
      console.log(`  Skipping test copy ${testCopyNum} for ${idString} (incompatible with font)`);
      skippedCount++;
      continue;
    }

    try {
      const canvas = renderTestCopyToCanvas(testCopyNum, fontProperties, blackTextProps);
      const ctx = canvas.getContext('2d');
      hashes[`${idString} atlas testCopyChoiceNumber ${testCopyNum}`] = ctx.getHashString();
    } catch (error) {
      console.warn(`Failed to render test copy ${testCopyNum} for ${idString}:`, error.message);
      // Continue with other test copies
    }
  }

  // 8-15. Blue text rendering (2 hashes per test copy: colored + black-and-white)
  const blueTextProps = new TextProperties({ textColor: '#0000FF' });

  for (let testCopyNum = 1; testCopyNum <= 4; testCopyNum++) {
    // Skip test copies incompatible with this font
    if (!isTestCopyCompatibleWithFont(testCopyNum, fontProperties.fontFamily)) {
      console.log(`  Skipping blue test copy ${testCopyNum} for ${idString} (incompatible with font)`);
      skippedCount++;
      continue;
    }

    try {
      const canvas = renderTestCopyToCanvas(testCopyNum, fontProperties, blueTextProps);
      const ctx = canvas.getContext('2d');

      // Blue color hash
      hashes[`${idString} atlas testCopyChoiceNumber ${testCopyNum}-blue-color`] = ctx.getHashString();

      // Black-and-white hash (verifies positioning independent of color)
      // NOTE: This uses the SAME key as black text, validating they match
      const bwHash = ctx.getBlackAndWhiteHashString();
      const blackTextHash = hashes[`${idString} atlas testCopyChoiceNumber ${testCopyNum}`];

      if (bwHash !== blackTextHash) {
        console.warn(`⚠️  Black-and-white hash mismatch for ${idString} test copy ${testCopyNum}`);
        console.warn(`   Black text: ${blackTextHash}`);
        console.warn(`   Blue B&W:   ${bwHash}`);
      }
    } catch (error) {
      console.warn(`Failed to render blue test copy ${testCopyNum} for ${idString}:`, error.message);
    }
  }

  const hashCount = Object.keys(hashes).length;
  if (skippedCount > 0) {
    console.log(`✓ Generated ${hashCount} hashes for ${idString} (skipped ${skippedCount} incompatible test copy hashes)`);
  } else {
    console.log(`✓ Generated ${hashCount} hashes for ${idString}`);
  }

  return { hashes, skippedCount };
}

/**
 * Process an entire font set specification and generate all hashes
 * @param {Object} fontSetSpec - Font set specification (JSON format)
 * @param {Function} progressCallback - Called with (current, total, idString) for each font
 * @returns {Object} Object with hashes and skip statistics
 */
async function processFontSet(fontSetSpec, progressCallback) {
  console.log('\n=== Processing Font Set for Hash Generation ===');

  const generator = new FontSetGenerator(fontSetSpec);
  const total = generator.getCount();

  console.log(`Total font configurations: ${total}`);

  const setsInfo = generator.getSetsInfo();
  setsInfo.forEach((setInfo, index) => {
    const name = setInfo.name || `Set ${index + 1}`;
    console.log(`  ${name}: ${setInfo.count} configurations`);
  });

  console.log('\nGenerating hashes...\n');

  const allHashes = {};
  let current = 0;
  let totalSkipped = 0;

  for (const fontProps of generator.iterator()) {
    current++;

    if (progressCallback) {
      progressCallback(current, total, fontProps.idString);
    }

    try {
      const result = await generateHashesForFont(fontProps);
      Object.assign(allHashes, result.hashes);
      totalSkipped += result.skippedCount;
    } catch (error) {
      console.error(`❌ Failed to generate hashes for ${fontProps.idString}:`, error.message);
      console.error(error.stack);
      // Continue with next font
    }

    // Allow browser to breathe
    if (current % 5 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    // Clear font data to free memory
    FontMetricsStoreFAB.resetFontMetricsFAB(fontProps);
    AtlasDataStoreFAB.clearGlyphsForFont(fontProps);
    BitmapText.deleteAtlas(fontProps.idString);
  }

  console.log(`\n✓ Completed hash generation for ${total} font configurations`);
  console.log(`✓ Generated ${Object.keys(allHashes).length} total hashes`);
  if (totalSkipped > 0) {
    console.log(`ℹ️  Skipped ${totalSkipped} incompatible test copy hashes (BitmapTextSymbols with non-symbol test copies)`);
  }

  return { hashes: allHashes, skippedCount: totalSkipped };
}

/**
 * Main entry point for automated hash generation
 * Generates all hashes for fonts in the specification
 * @param {Object} fontSetSpec - Font set specification (JSON format, plain object)
 * @returns {Promise<Object>} Hash object ready for reference-hashes.js
 */
async function generateAndExportHashes(fontSetSpec) {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   AUTOMATED HASH GENERATOR             ║');
  console.log('╚════════════════════════════════════════╝\n');

  const overallStartTime = performance.now();

  try {
    // 1. Initialize specs
    window.specs = initializeSpecs();

    // 2. Reconstruct FontSetGenerator from plain spec object
    const reconstructedSpec = JSON.parse(JSON.stringify(fontSetSpec));

    // 3. Process all fonts and generate hashes
    const result = await processFontSet(reconstructedSpec, (current, total, idString) => {
      const percent = (current / total * 100).toFixed(1);

      // Log JSON for Playwright
      console.log(JSON.stringify({
        type: 'progress',
        current,
        total,
        message: idString,
        percent: parseFloat(percent)
      }));
    });

    const totalDuration = ((performance.now() - overallStartTime) / 1000).toFixed(1);

    console.log('\n✓ Hash generation complete!');
    console.log(`Total time: ${totalDuration} seconds`);
    console.log('\n╚════════════════════════════════════════╝\n');

    // Return hash object with statistics
    return {
      hashes: result.hashes,
      skippedCount: result.skippedCount
    };

  } catch (error) {
    console.error('\n✗ Error during hash generation:', error);
    console.error(error.stack);
    throw error;
  }
}

// Expose functions to window for Playwright access
window.generateAndExportHashes = generateAndExportHashes;
window.generateHashesForFont = generateHashesForFont;
window.processFontSet = processFontSet;
window.initializeSpecs = initializeSpecs;

console.log('Automated Hash Generator script loaded');
console.log('Available functions: generateAndExportHashes, generateHashesForFont');
