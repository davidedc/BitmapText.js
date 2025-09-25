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
      spaceAdvancementOverrideForSmallSizesInPx: minified.s,
      atlasPositioning: this.#expandTightMetrics(minified.t)
    };
    
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
  static #expandCharacterMetrics(minifiedGlyphs, baseMetrics) {
    const expanded = {};
    Object.entries(minifiedGlyphs).forEach(([char, metrics]) => {
      expanded[char] = {
        // Glyph-specific metrics from the array
        width: metrics[0],
        actualBoundingBoxLeft: metrics[1],
        actualBoundingBoxRight: metrics[2],
        actualBoundingBoxAscent: metrics[3],
        actualBoundingBoxDescent: metrics[4],
        
        // Common metrics restored from base metrics
        fontBoundingBoxAscent: baseMetrics.fba,
        fontBoundingBoxDescent: baseMetrics.fbd,
        emHeightAscent: baseMetrics.fba,          // Same as fontBoundingBoxAscent
        emHeightDescent: baseMetrics.fbd,         // Same as fontBoundingBoxDescent
        hangingBaseline: baseMetrics.hb,
        alphabeticBaseline: baseMetrics.ab,
        ideographicBaseline: baseMetrics.ib
      };
    });
    return expanded;
  }
  
  /**
   * Expands tight metrics from shortened property names
   * @private
   */
  static #expandTightMetrics(minified) {
    return {
      tightWidth: minified.w,           // w -> tightWidth
      tightHeight: minified.h,          // h -> tightHeight
      dx: minified.dx,                  // dx unchanged
      dy: minified.dy,                  // dy unchanged
      xInAtlas: minified.x         // x -> xInAtlas
    };
  }
}