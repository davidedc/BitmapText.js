// FontMetricsStoreFAB - Font Assets Building Class
// 
// This class extends FontMetricsStore to provide font assets building capabilities
// using FontMetricsFAB instances for building and generating font metrics data.
//
// DISTRIBUTION ROLE:
// - Part of "full toolkit" distribution for font assets building applications
// - Extends FontMetricsStore with building, validation, and optimization features
// - Provides extraction methods to create clean runtime FontMetricsStore instances
//
// ARCHITECTURE:
// - Inherits FontMetricsStore repository functionality 
// - Works with FontMetricsFAB instances for building operations
// - Validates and optimizes font metrics during the building process
// - Extracts clean FontMetrics instances for runtime distribution
//
// KEY METHODS:
// - extractFontMetricsStoreInstance(): Creates clean runtime instance
// - Building-specific metrics calculation and validation methods
// - Integration with font assets building pipeline
class FontMetricsStoreFAB extends FontMetricsStore {
  constructor() {
    super();
  }
  
  /**
   * Extract a clean FontMetricsStore instance for runtime distribution
   * This removes FAB-specific functionality and provides only runtime data
   * @returns {FontMetricsStore} Clean runtime FontMetricsStore instance
   */
  extractFontMetricsStoreInstance() {
    const instance = new FontMetricsStore();
    
    // Extract clean FontMetrics instances from FontMetricsFAB instances
    for (const [fontKey, fontMetricsFAB] of this._fontMetrics.entries()) {
      if (fontMetricsFAB && fontMetricsFAB.extractFontMetricsInstance) {
        // Convert FontMetricsFAB to clean FontMetrics
        const cleanFontMetrics = fontMetricsFAB.extractFontMetricsInstance();
        instance._fontMetrics.set(fontKey, cleanFontMetrics);
      } else if (fontMetricsFAB) {
        // Already a clean FontMetrics instance
        instance._fontMetrics.set(fontKey, fontMetricsFAB);
      }
    }
    
    return instance;
  }
  
  /**
   * Get or create FontMetricsFAB instance for a font configuration
   * @param {FontProperties} fontProperties - Font configuration
   * @returns {FontMetricsFAB} FontMetricsFAB instance (creates empty one if not exists)
   */
  getFontMetricsFAB(fontProperties) {
    let fontMetrics = this.getFontMetrics(fontProperties);
    
    if (!fontMetrics || !(fontMetrics instanceof FontMetricsFAB)) {
      // Create new empty FontMetricsFAB instance
      fontMetrics = new FontMetricsFAB();
      this.setFontMetrics(fontProperties, fontMetrics);
    }
    
    return fontMetrics;
  }
  
  /**
   * Reset FontMetricsFAB instance for a font configuration to start fresh
   * @param {FontProperties} fontProperties - Font configuration
   */
  resetFontMetricsFAB(fontProperties) {
    const fontMetrics = new FontMetricsFAB();
    this.setFontMetrics(fontProperties, fontMetrics);
    return fontMetrics;
  }
  
  /**
   * Clear all kerning tables for regeneration
   */
  clearKerningTables() {
    for (const fontMetrics of this._fontMetrics.values()) {
      if (fontMetrics instanceof FontMetricsFAB) {
        fontMetrics.clearKerningTable();
      }
    }
  }
  
  /**
   * Check if kerning table exists for a font
   * @param {FontProperties} fontProperties - Font configuration
   * @returns {boolean} True if kerning table exists and has data
   */
  kerningTableExists(fontProperties) {
    const fontMetrics = this.getFontMetrics(fontProperties);
    return fontMetrics && fontMetrics.hasKerningTable && fontMetrics.hasKerningTable();
  }
  
  /**
   * Set kerning table for a font (creates FontMetricsFAB if needed)
   * @param {FontProperties} fontProperties - Font configuration
   * @param {Object} kerningTable - Kerning data structure
   */
  setKerningTable(fontProperties, kerningTable) {
    const fontMetricsFAB = this.getFontMetricsFAB(fontProperties);
    fontMetricsFAB.setKerningTable(kerningTable);
  }
  
  
  
  /**
   * Set text metrics for a single glyph
   * @param {FontProperties} fontProperties - Font configuration
   * @param {string} letter - Character to set metrics for
   * @param {Object} metrics - TextMetrics-compatible object
   */
  setCharacterMetrics(fontProperties, letter, metrics) {
    const fontMetricsFAB = this.getFontMetricsFAB(fontProperties);
    fontMetricsFAB.setCharacterMetrics(letter, metrics);
  }
  
  /**
   * Set text metrics for all glyphs from metrics object
   * @param {FontProperties} fontProperties - Font configuration
   * @param {Object} metrics - Object mapping characters to TextMetrics
   */
  setGlyphsTextMetrics(fontProperties, metrics) {
    const fontMetricsFAB = this.getFontMetricsFAB(fontProperties);
    fontMetricsFAB.setGlyphsTextMetrics(metrics);
  }
  
  /**
   * Set space advancement override for small font sizes
   * @param {FontProperties} fontProperties - Font configuration
   * @param {number} override - Override value in pixels
   */
  setSpaceAdvancementOverrideForSmallSizesInPx(fontProperties, override) {
    const fontMetricsFAB = this.getFontMetricsFAB(fontProperties);
    fontMetricsFAB.setSpaceAdvancementOverride(override);
  }
  
  /**
   * Validate that all required metrics are present for expected characters
   * @param {FontProperties} fontProperties - Font configuration
   * @param {string[]} expectedLetters - Array of characters that should have metrics
   * @returns {string[]} Array of missing metrics (empty if all present)
   */
  validateFontMetrics(fontProperties, expectedLetters) {
    const fontMetrics = this.getFontMetrics(fontProperties);
    if (fontMetrics && fontMetrics.validateFontMetrics) {
      return fontMetrics.validateFontMetrics(expectedLetters);
    }
    return [];
  }
}