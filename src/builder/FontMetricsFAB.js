// FontMetricsFAB - Font Assets Building Class
//
// This class extends FontMetrics to provide font assets building capabilities
// for font metrics data including glyph measurements and kerning tables.
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
// - Handles ONLY font metrics, kerning, and character measurements
//
// SEPARATION OF CONCERNS:
// - FontMetricsFAB: Handles ONLY font metrics, kerning, character measurements
// - AtlasPositioningFAB: Handles ONLY atlas positioning data (separate class)
// - Clean separation eliminates mixed responsibilities
//
// KEY CAPABILITIES:
// - Build metrics from rendered glyph data
// - Calculate kerning tables
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
      spaceAdvancementOverrideForSmallSizesInPx: this._spaceAdvancementOverride
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
   * @param {string} char - Character (code point) to set metrics for
   * @param {Object} metrics - TextMetrics-compatible object
   */
  setCharacterMetrics(char, metrics) {
    this._characterMetrics[char] = metrics;
  }
  
  /**
   * Set space advancement override for small font sizes
   * @param {number} override - Override value in pixels
   */
  setSpaceAdvancementOverride(override) {
    this._spaceAdvancementOverride = override;
  }
  
  
  
  
  /**
   * Validate that all required font metrics are present for expected characters
   * @param {string[]} expectedChars - Array of characters that should have metrics
   * @returns {string[]} Array of missing metrics (empty if all present)
   */
  validateFontMetrics(expectedChars) {
    const missingMetrics = [];

    for (const char of expectedChars) {
      // Check text metrics
      if (!this._characterMetrics[char]) {
        missingMetrics.push(`${char}:characterMetrics`);
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
      hasSpaceOverride: this._spaceAdvancementOverride !== null
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