// Shared automation helpers used by automated-builder.js and
// automated-hash-generator.js. Both files used to define identical copies of
// these — extracted here so future spec-init or build-phase tweaks happen in
// one place.

/**
 * Initialise specs from default-specs.js and register them with BitmapTextFAB.
 * Returns the parsed Specs instance.
 * @returns {Specs}
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
 * Build font assets for a single font configuration: render glyphs, build the
 * kerning table, and drop transient DOM canvases (WebKit memory pressure under
 * Playwright). Canvas pixel data persists in the GlyphFAB instances.
 *
 * @param {FontProperties} fontProperties - Font configuration
 */
async function buildFont(fontProperties) {
  const startTime = performance.now();

  console.log(`Building ${fontProperties.idString}...`);

  // 1. Create glyphs — standard chars + any custom set defined for this family.
  // Canvas rendering dominates the per-font wallclock time.
  createGlyphsAndAddToFullStore(fontProperties);

  // 2. Build kerning table if not already cached for this font.
  BitmapTextFAB.buildKerningTableIfDoesntExist(fontProperties);

  // 3. Detach canvases from the DOM to keep WebKit's tracked canvas count low.
  //    The glyph data (tightCanvas, canvasCopy) lives on GlyphFAB instances.
  const canvases = document.querySelectorAll('canvas');
  canvases.forEach(c => c.remove());

  const duration = (performance.now() - startTime).toFixed(0);
  console.log(`✓ Built ${fontProperties.idString} in ${duration}ms`);
}
