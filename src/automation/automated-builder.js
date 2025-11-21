// Automated Font Builder
// Orchestrates font asset generation from FontSetGenerator specifications
// This script is designed to run in a browser context with all necessary dependencies loaded

/**
 * Initialize specs from default-specs.js
 * Parses the spec text and sets it on BitmapTextFAB
 * @returns {Specs} Parsed specs object
 */
function initializeSpecs() {
  console.log('Initializing kerning specs...');

  // Create SpecsParser instance and parse default specs
  // (loaded from src/specs/default-specs.js as specsDefault)
  const specsParser = new SpecsParser();
  const specs = specsParser.parseSpecsIfChanged(specsDefault);

  // Set specs on BitmapTextFAB for kerning calculations
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
  const startTime = performance.now();

  console.log(`Building ${fontProperties.idString}...`);

  // 1. Create glyphs - includes both standard 204 chars + custom character set if defined
  // This is the most time-consuming step (canvas rendering)
  createGlyphsAndAddToFullStore(fontProperties);

  // 2. Build kerning table if it doesn't exist
  // This calculates kerning adjustments for character pairs
  BitmapTextFAB.buildKerningTableIfDoesntExist(fontProperties);

  // 3. Clean up DOM canvases to prevent WebKit memory exhaustion
  // Remove canvases from DOM but preserve dimensions/data for later export
  // Canvas data persists in GlyphFAB instances (this.tightCanvas, this.canvasCopy)
  const canvases = document.querySelectorAll('canvas');
  canvases.forEach(c => {
    c.remove();  // Remove from DOM but keep data intact
  });

  const duration = (performance.now() - startTime).toFixed(0);
  console.log(`✓ Built ${fontProperties.idString} in ${duration}ms`);
}

/**
 * Process an entire font set specification
 * Uses FontSetGenerator to iterate through all configurations
 * @param {Object} fontSetSpec - Font set specification (JSON format)
 * @param {Function} progressCallback - Called with (current, total, idString) for each font
 */
async function processFontSet(fontSetSpec, progressCallback) {
  console.log('\n=== Processing Font Set ===');

  // Create generator from spec
  const generator = new FontSetGenerator(fontSetSpec);
  const total = generator.getCount();

  console.log(`Total font configurations: ${total}`);

  // Get set info for reporting
  const setsInfo = generator.getSetsInfo();
  setsInfo.forEach((setInfo, index) => {
    const name = setInfo.name || `Set ${index + 1}`;
    console.log(`  ${name}: ${setInfo.count} configurations`);
  });

  console.log('\nBuilding fonts...\n');

  // Iterate through all font configurations
  let current = 0;
  for (const fontProps of generator.iterator()) {
    current++;

    // Report progress
    if (progressCallback) {
      progressCallback(current, total, fontProps.idString);
    }

    // Build this font
    await buildFont(fontProps);

    // Allow browser to breathe (prevent UI freeze, though we have no UI)
    // This also helps with memory management
    if (current % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  console.log(`\n✓ Completed building ${total} font configurations`);
}

/**
 * Main entry point for automated font building
 * Builds all fonts in the specification and exports to .zip
 * @param {Object} fontSetSpec - Font set specification (JSON format, plain object)
 * @param {Object} exportOptions - Export options (passed to downloadFontAssets)
 * @returns {Promise} Resolves when export is complete
 */
async function buildAndExportFonts(fontSetSpec, exportOptions = {}) {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   AUTOMATED FONT ASSET BUILDER         ║');
  console.log('╔════════════════════════════════════════╗\n');

  const overallStartTime = performance.now();

  try {
    // 1. Initialize specs and set as global (required by GlyphFAB)
    window.specs = initializeSpecs();

    // 2. Reconstruct FontSetGenerator from the plain spec object
    // (necessary because spec comes from Playwright page.evaluate serialization)
    const reconstructedSpec = JSON.parse(JSON.stringify(fontSetSpec));

    // 3. Process all fonts in the set
    await processFontSet(reconstructedSpec, (current, total, idString) => {
      // Report progress as structured JSON for Playwright to parse
      const percent = (current / total * 100).toFixed(1);

      // Log JSON for Playwright
      console.log(JSON.stringify({
        type: 'progress',
        current,
        total,
        message: idString,
        percent: parseFloat(percent)
      }));

      // Also log human-readable version
      console.log(`[${current}/${total}] ${percent}% - ${idString}`);
    });

    // 4. Export all fonts to .zip
    console.log('\n=== Exporting Font Assets ===');
    console.log('Creating .zip file...');

    // downloadFontAssets will scan AtlasDataStoreFAB and FontMetricsStoreFAB
    // to find all built fonts and export them
    // We pass null/undefined for specific font parameters to export ALL fonts
    // Returns base64-encoded ZIP for Playwright to save
    const zipBase64 = await downloadFontAssets({
      pixelDensity: null,      // null = export all densities
      fontFamily: null,        // null = export all families
      fontStyle: null,         // null = export all styles
      fontWeight: null,        // null = export all weights
      includeNonMinifiedMetrics: exportOptions.includeNonMinifiedMetrics || false
    });

    const totalDuration = ((performance.now() - overallStartTime) / 1000).toFixed(1);

    console.log('\n✓ Export complete!');
    console.log(`Total time: ${totalDuration} seconds`);
    console.log('\n╚════════════════════════════════════════╝\n');

    // Return base64-encoded ZIP to Playwright for saving to disk
    return zipBase64;

  } catch (error) {
    console.error('\n✗ Error during font building:', error);
    console.error(error.stack);
    throw error;
  }
}

/**
 * Utility: Get summary of what would be built without actually building
 * Useful for validation before starting a long build
 * @param {Object} fontSetSpec - Font set specification
 * @returns {Object} Summary with count and set info
 */
function getFontSetSummary(fontSetSpec) {
  const generator = new FontSetGenerator(fontSetSpec);
  const total = generator.getCount();
  const setsInfo = generator.getSetsInfo();

  return {
    total,
    sets: setsInfo
  };
}

// Expose functions to window for Playwright access
window.buildAndExportFonts = buildAndExportFonts;
window.getFontSetSummary = getFontSetSummary;
window.initializeSpecs = initializeSpecs;
window.buildFont = buildFont;
window.processFontSet = processFontSet;

console.log('Automated Font Builder script loaded');
console.log('Available functions: buildAndExportFonts, getFontSetSummary');
