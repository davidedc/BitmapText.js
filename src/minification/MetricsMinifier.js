// Static utility class for minifying font metrics data (build-time only)
// Converts verbose object structures to compact format for smaller file sizes
class MetricsMinifier {
  // Private constructor - prevent instantiation following Effective Java patterns
  constructor() {
    throw new Error('MetricsMinifier cannot be instantiated - use static methods');
  }
  
  /**
   * Minifies font metrics data for smaller file size
   * @param {Object} metricsData - Full metrics object containing kerningTable, glyphsTextMetrics, etc.
   * @returns {Object} Minified metrics with shortened keys and compacted structure
   */
  static minify(metricsData) {
    return {
      k: this.#minifyKerningTable(metricsData.kerningTable),
      b: this.#extractBaseMetrics(metricsData.glyphsTextMetrics),
      g: this.#minifyGlyphMetrics(metricsData.glyphsTextMetrics),
      t: this.#minifyTightMetrics(metricsData.glyphSheetsMetrics),
      s: metricsData.spaceAdvancementOverrideForSmallSizesInPx
    };
  }
  
  /**
   * Extracts common base metrics shared across all glyphs
   * Uses first available character to determine base font properties
   * @private
   */
  static #extractBaseMetrics(glyphsTextMetrics) {
    const firstChar = Object.keys(glyphsTextMetrics)[0];
    const firstGlyph = glyphsTextMetrics[firstChar];
    
    return {
      fba: firstGlyph.fontBoundingBoxAscent,     // fontBoundingBoxAscent
      fbd: firstGlyph.fontBoundingBoxDescent,    // fontBoundingBoxDescent
      hb: firstGlyph.hangingBaseline,            // hangingBaseline
      ab: firstGlyph.alphabeticBaseline,         // alphabeticBaseline
      ib: firstGlyph.ideographicBaseline         // ideographicBaseline
    };
  }
  
  /**
   * Converts glyph metrics objects to compact arrays
   * Array format: [width, actualBoundingBoxLeft, actualBoundingBoxRight, actualBoundingBoxAscent, actualBoundingBoxDescent]
   * @private
   */
  static #minifyGlyphMetrics(glyphsTextMetrics) {
    const minified = {};
    Object.entries(glyphsTextMetrics).forEach(([char, glyph]) => {
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
  
  /**
   * Minifies tight metrics with shortened property names
   * @private
   */
  static #minifyTightMetrics(glyphSheetsMetrics) {
    return {
      w: glyphSheetsMetrics.tightWidth,          // tightWidth
      h: glyphSheetsMetrics.tightHeight,         // tightHeight
      dx: glyphSheetsMetrics.dx,                 // dx
      dy: glyphSheetsMetrics.dy,                 // dy
      x: glyphSheetsMetrics.xInGlyphSheet        // xInGlyphSheet
    };
  }
}