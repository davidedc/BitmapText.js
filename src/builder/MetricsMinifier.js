// Static utility class for minifying font metrics data (build-time only)
// Converts verbose object structures to compact format for smaller file sizes
class MetricsMinifier {
  // Private constructor - prevent instantiation following Effective Java patterns
  constructor() {
    throw new Error('MetricsMinifier cannot be instantiated - use static methods');
  }
  
  /**
   * Minifies font metrics data for smaller file size
   * @param {Object} metricsData - Full metrics object containing kerningTable, characterMetrics, etc.
   * @returns {Object} Minified metrics with shortened keys and compacted structure
   */
  static minify(metricsData) {
    return {
      k: this.#minifyKerningTable(metricsData.kerningTable),
      b: this.#extractMetricsCommonToAllCharacters(metricsData.characterMetrics),
      g: this.#minifyCharacterMetrics(metricsData.characterMetrics),
      s: metricsData.spaceAdvancementOverrideForSmallSizesInPx
    };
  }
  
  /**
   * Extracts common metrics shared across all characters
   * so that we don't need to repeat these in the serialised file.
   * Extract these from the first available character
   * @private
   */
  static #extractMetricsCommonToAllCharacters(characterMetrics) {
    const firstChar = Object.keys(characterMetrics)[0];
    const firstGlyph = characterMetrics[firstChar];

    return {
      fba: firstGlyph.fontBoundingBoxAscent,     // fontBoundingBoxAscent
      fbd: firstGlyph.fontBoundingBoxDescent,    // fontBoundingBoxDescent
      hb: firstGlyph.hangingBaseline,            // hangingBaseline
      ab: firstGlyph.alphabeticBaseline,         // alphabeticBaseline
      ib: firstGlyph.ideographicBaseline,        // ideographicBaseline
      pd: firstGlyph.pixelDensity                // pixelDensity (CRITICAL for atlas reconstruction)
    };
  }
  
  /**
   * Converts glyph metrics objects to compact arrays
   * Array format: [width, actualBoundingBoxLeft, actualBoundingBoxRight, actualBoundingBoxAscent, actualBoundingBoxDescent]
   * @private
   */
  static #minifyCharacterMetrics(characterMetrics) {
    const minified = {};
    Object.entries(characterMetrics).forEach(([char, glyph]) => {
      minified[char] = [
        glyph.width,
        glyph.actualBoundingBoxLeft,
        glyph.actualBoundingBoxRight,
        glyph.actualBoundingBoxAscent,
        glyph.actualBoundingBoxDescent
      ];
    });
    return minified;
  }
  
  /**
   * Minifies kerning table (currently a direct copy, but kept for consistency)
   * @private
   */
  static #minifyKerningTable(kerningTable) {
    return { ...kerningTable };
  }
  
}