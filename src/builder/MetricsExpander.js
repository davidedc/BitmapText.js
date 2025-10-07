// Static utility class for expanding minified font metrics data (runtime only)
// Converts compact format back to FontMetrics instances for use by the rendering engine

class MetricsExpander {
  // Private constructor - prevent instantiation following Effective Java patterns
  constructor() {
    throw new Error('MetricsExpander cannot be instantiated - use static methods');
  }
  
  /**
   * Expands minified metrics back to FontMetrics instance for runtime use
   * @param {Object} minified - Minified metrics object with shortened keys
   * @returns {FontMetrics} FontMetrics instance with expanded data
   */
  static expand(minified) {
    // Check if FontMetrics class is available (for cases where loaded as standalone)
    if (typeof FontMetrics === 'undefined') {
      throw new Error('FontMetrics class not found. Please ensure FontMetrics.js is loaded before MetricsExpander.js');
    }

    const expandedData = {
      kerningTable: this.#expandKerningTable(minified.k),
      characterMetrics: this.#expandCharacterMetrics(minified.g, minified.b),
      spaceAdvancementOverrideForSmallSizesInPx: minified.s
    };

    // Verify pixelDensity was preserved
    const firstChar = Object.keys(expandedData.characterMetrics)[0];
    const pixelDensity = expandedData.characterMetrics[firstChar]?.pixelDensity;
    console.debug(`🔍 MetricsExpander: Restored pixelDensity=${pixelDensity} for ${Object.keys(expandedData.characterMetrics).length} characters`);

    return new FontMetrics(expandedData);
  }
  
  /**
   * Expands kerning table (currently a direct copy, but kept for consistency)
   * @private
   */
  static #expandKerningTable(minified) {
    return { ...minified };
  }
  
  /**
   * Expands glyph metrics from arrays back to full objects
   * Reconstructs full TextMetrics-compatible objects from compact arrays
   * @private
   */
  static #expandCharacterMetrics(minifiedGlyphs, metricsCommonToAllCharacters) {
    const expanded = {};
    Object.entries(minifiedGlyphs).forEach(([char, metrics]) => {
      expanded[char] = {
        // Glyph-specific metrics from the array
        width: metrics[0],
        actualBoundingBoxLeft: metrics[1],
        actualBoundingBoxRight: metrics[2],
        actualBoundingBoxAscent: metrics[3],
        actualBoundingBoxDescent: metrics[4],

        // Copy over the metrics common to all characters.
        // This is a bit of a waste of memory, however this object needs to
        // look as much as possible like a TextMetrics object, and this
        // is what it looks like.
        fontBoundingBoxAscent: metricsCommonToAllCharacters.fba,
        fontBoundingBoxDescent: metricsCommonToAllCharacters.fbd,
        emHeightAscent: metricsCommonToAllCharacters.fba,          // Same as fontBoundingBoxAscent
        emHeightDescent: metricsCommonToAllCharacters.fbd,         // Same as fontBoundingBoxDescent
        hangingBaseline: metricsCommonToAllCharacters.hb,
        alphabeticBaseline: metricsCommonToAllCharacters.ab,
        ideographicBaseline: metricsCommonToAllCharacters.ib,
        pixelDensity: metricsCommonToAllCharacters.pd              // pixelDensity (CRITICAL for atlas reconstruction)
      };
    });
    return expanded;
  }
  
}