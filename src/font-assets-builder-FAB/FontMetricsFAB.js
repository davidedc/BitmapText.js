// FontMetricsFAB - Font Assets Building Class
//
// This class extends FontMetrics to provide font assets building capabilities
// for font metrics data including glyph measurements, kerning tables, and positioning.
//
// DISTRIBUTION ROLE:
// - Part of "full toolkit" distribution for font assets building applications
// - Extends FontMetrics with building, validation, and calculation features
// - Provides extraction methods to create clean runtime FontMetrics instances
//
// ARCHITECTURE:
// - Inherits all runtime functionality from FontMetrics
// - Uses mutable option to prevent freezing during building operations
// - Validates and optimizes font metrics during the building process
// - Generates and calculates metrics from glyph canvas data
//
// KEY CAPABILITIES:
// - Build metrics from rendered glyph data
// - Calculate positioning from canvas bounds
// - Validate metric completeness
// - Extract clean immutable FontMetrics instances
class FontMetricsFAB extends FontMetrics {
  constructor(data) {
    // Call super with mutable option to prevent freezing
    super(data || {}, { mutable: true });
  }
  
  /**
   * Extract a clean immutable FontMetrics instance for runtime use
   * This removes FAB-specific functionality and provides only runtime data
   * @returns {FontMetrics} Clean runtime FontMetrics instance
   */
  extractFontMetricsInstance() {
    return new FontMetrics({
      kerningTable: this._kerningTable,
      characterMetrics: this._characterMetrics,
      spaceAdvancementOverrideForSmallSizesInPx: this._spaceAdvancementOverride,
      atlasPositioning: {
        tightWidth: this._atlasPositioning.tightWidth,
        tightHeight: this._atlasPositioning.tightHeight,
        dx: this._atlasPositioning.dx,
        dy: this._atlasPositioning.dy,
        xInAtlas: this._atlasPositioning.xInAtlas
      }
    });
  }
  
  /**
   * Set kerning table for this font
   * @param {Object} kerningTable - Kerning data structure
   */
  setKerningTable(kerningTable) {
    this._kerningTable = { ...kerningTable };
  }
  
  /**
   * Clear all kerning data (used during regeneration)
   */
  clearKerningTable() {
    this._kerningTable = {};
  }
  
  /**
   * Check if kerning table exists and has data
   * @returns {boolean} True if kerning table has data
   */
  hasKerningTable() {
    return Object.keys(this._kerningTable).length > 0;
  }
  
  /**
   * Set text metrics for all glyphs from metrics object
   * @param {Object} metrics - Object mapping characters to TextMetrics
   */
  setGlyphsTextMetrics(metrics) {
    this._characterMetrics = { ...this._characterMetrics, ...metrics };
  }
  
  /**
   * Set text metrics for a single glyph
   * @param {string} letter - Character to set metrics for
   * @param {Object} metrics - TextMetrics-compatible object
   */
  setCharacterMetrics(letter, metrics) {
    this._characterMetrics[letter] = metrics;
  }
  
  /**
   * Set space advancement override for small font sizes
   * @param {number} override - Override value in pixels
   */
  setSpaceAdvancementOverride(override) {
    this._spaceAdvancementOverride = override;
  }
  
  /**
   * Calculate and set font positioning metrics from glyph data
   * This method is called during atlas building to extract positioning data
   * @param {Object} glyphs - Object mapping characters to glyph data
   * @param {FontProperties} fontProperties - Font configuration for positioning calculations
   */
  calculateAndSetFontMetrics(glyphs, fontProperties) {
    for (let letter in glyphs) {
      let glyph = glyphs[letter];
      let characterMetrics = this.getCharacterMetrics(letter);
      
      // Skip glyphs without valid tight canvas box, but set default metrics
      if (!glyph.tightCanvasBox?.bottomRightCorner || !glyph.tightCanvasBox?.topLeftCorner) {
        // Set minimal default metrics for glyphs without visible pixels
        this._atlasPositioning.tightWidth[letter] = 1;
        this._atlasPositioning.tightHeight[letter] = 1;
        this._atlasPositioning.dx[letter] = 0;
        this._atlasPositioning.dy[letter] = 0;
        continue;
      }
      
      // Calculate tight dimensions from glyph bounds
      const tightWidth =
        glyph.tightCanvasBox.bottomRightCorner.x -
        glyph.tightCanvasBox.topLeftCorner.x +
        1;
      const tightHeight =
        glyph.tightCanvasBox.bottomRightCorner.y -
        glyph.tightCanvasBox.topLeftCorner.y +
        1;
      
      // Calculate positioning offsets for atlas rendering
      const dx = - Math.round(characterMetrics.actualBoundingBoxLeft) * fontProperties.pixelDensity + glyph.tightCanvasBox.topLeftCorner.x;
      const dy = - tightHeight - glyph.tightCanvas.distanceBetweenBottomAndBottomOfCanvas + 1 * fontProperties.pixelDensity;
      
      // Set the calculated metrics
      this._atlasPositioning.tightWidth[letter] = tightWidth;
      this._atlasPositioning.tightHeight[letter] = tightHeight;
      this._atlasPositioning.dx[letter] = dx;
      this._atlasPositioning.dy[letter] = dy;
    }
  }
  
  /**
   * Set glyph position in atlas after atlas is built
   * @param {string} letter - Character to set position for
   * @param {number} xPosition - X position in atlas
   */
  setGlyphPositionInAtlas(letter, xPosition) {
    this._atlasPositioning.xInAtlas[letter] = xPosition;
  }
  
  /**
   * Set font positioning metrics from external data
   * @param {Object} metrics - Object containing positioning metrics
   */
  setFontMetrics(metrics) {
    // Set metrics for each letter in the font
    for (const metricKey in metrics) {
      if (this._atlasPositioning[metricKey]) {
        const letterMetrics = metrics[metricKey];
        for (const letter in letterMetrics) {
          this._atlasPositioning[metricKey][letter] = letterMetrics[letter];
        }
      }
    }
  }
  
  /**
   * Validate that all required metrics are present for expected characters
   * @param {string[]} expectedLetters - Array of characters that should have metrics
   * @returns {string[]} Array of missing metrics (empty if all present)
   */
  validateFontMetrics(expectedLetters) {
    const missingMetrics = [];
    
    for (const letter of expectedLetters) {
      const requiredMetrics = ['tightWidth', 'tightHeight', 'dx', 'dy', 'xInAtlas'];
      
      // Check positioning metrics
      for (const metricType of requiredMetrics) {
        if (this._atlasPositioning[metricType][letter] === undefined) {
          missingMetrics.push(`${letter}:${metricType}`);
        }
      }
      
      // Check text metrics
      if (!this._characterMetrics[letter]) {
        missingMetrics.push(`${letter}:characterMetrics`);
      }
    }
    
    return missingMetrics;
  }
  
  /**
   * Get statistics about this font metrics instance
   * @returns {Object} Statistics object with counts and info
   */
  getStatistics() {
    const glyphCount = Object.keys(this._characterMetrics).length;
    const kerningPairs = Object.values(this._kerningTable)
      .reduce((total, pairs) => total + Object.keys(pairs).length, 0);
    
    return {
      glyphCount,
      kerningPairs,
      hasSpaceOverride: this._spaceAdvancementOverride !== null,
      atlasGlyphs: Object.keys(this._atlasPositioning.xInAtlas).length,
      positioningGlyphs: Object.keys(this._atlasPositioning.tightWidth).length
    };
  }
  
  /**
   * Optimize the kerning table by removing zero-value entries
   * This reduces the size of the final data
   */
  optimizeKerningTable() {
    for (const leftChar in this._kerningTable) {
      const pairs = this._kerningTable[leftChar];
      
      // Remove zero-value kerning pairs
      for (const rightChar in pairs) {
        if (pairs[rightChar] === 0) {
          delete pairs[rightChar];
        }
      }
      
      // Remove empty left character entries
      if (Object.keys(pairs).length === 0) {
        delete this._kerningTable[leftChar];
      }
    }
  }
}