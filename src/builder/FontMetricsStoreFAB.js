// FontMetricsStoreFAB - Font Assets Building Static Class
//
// This static class extends FontMetricsStore to provide font assets building capabilities
// using FontMetricsFAB instances for building and generating font metrics data.
//
// DISTRIBUTION ROLE:
// - Part of "full toolkit" distribution for font assets building applications
// - Extends FontMetricsStore with building, validation, and optimization features
// - Works with FontMetricsFAB instances for complete font metrics building
//
// ARCHITECTURE:
// - Static class extending static FontMetricsStore
// - Inherits metrics storage functionality from parent
// - Works with FontMetricsFAB instances for building operations
// - Validates and optimizes font metrics during the building process
// - Focuses on metrics calculation and kerning table generation
//
// SEPARATION OF CONCERNS:
// - FontMetricsStoreFAB: Handles metrics calculation and positioning data
// - AtlasDataStoreFAB: Handles atlas image building from individual canvases
// - Both work together during font assets building but can be used independently
class FontMetricsStoreFAB extends FontMetricsStore {

  /**
   * Get or create FontMetricsFAB instance for a font configuration
   * @param {FontProperties} fontProperties - Font configuration
   * @returns {FontMetricsFAB} FontMetricsFAB instance (creates empty one if not exists)
   */
  static getFontMetricsFAB(fontProperties) {
    let fontMetrics = FontMetricsStore.getFontMetrics(fontProperties);

    if (!fontMetrics || !(fontMetrics instanceof FontMetricsFAB)) {
      // Create new empty FontMetricsFAB instance
      fontMetrics = new FontMetricsFAB();
      FontMetricsStore.setFontMetrics(fontProperties, fontMetrics);
    }

    return fontMetrics;
  }

  /**
   * Reset FontMetricsFAB instance for a font configuration to start fresh
   * @param {FontProperties} fontProperties - Font configuration
   */
  static resetFontMetricsFAB(fontProperties) {
    const fontMetrics = new FontMetricsFAB();
    FontMetricsStore.setFontMetrics(fontProperties, fontMetrics);
    return fontMetrics;
  }

  /**
   * Clear all kerning tables for regeneration
   */
  static clearKerningTables() {
    // Call parent method explicitly to avoid private field access issues
    for (const fontKey of FontMetricsStore.getAvailableFonts()) {
      const fontProperties = FontProperties.fromKey(fontKey);
      const metrics = FontMetricsStore.getFontMetrics(fontProperties);
      if (metrics instanceof FontMetricsFAB) {
        metrics.clearKerningTable();
      }
    }
  }

  /**
   * Check if kerning table exists for a font
   * @param {FontProperties} fontProperties - Font configuration
   * @returns {boolean} True if kerning table exists and has data
   */
  static kerningTableExists(fontProperties) {
    const fontMetrics = FontMetricsStore.getFontMetrics(fontProperties);
    return fontMetrics?.hasKerningTable?.();
  }

  /**
   * Set kerning table for a font (creates FontMetricsFAB if needed)
   * @param {FontProperties} fontProperties - Font configuration
   * @param {Object} kerningTable - Kerning data structure
   */
  static setKerningTable(fontProperties, kerningTable) {
    const fontMetricsFAB = FontMetricsStoreFAB.getFontMetricsFAB(fontProperties);
    fontMetricsFAB.setKerningTable(kerningTable);
  }



  /**
   * Set text metrics for a single glyph
   * @param {FontProperties} fontProperties - Font configuration
   * @param {string} char - Character (code point) to set metrics for
   * @param {Object} metrics - TextMetrics-compatible object
   */
  static setCharacterMetrics(fontProperties, char, metrics) {
    const fontMetricsFAB = FontMetricsStoreFAB.getFontMetricsFAB(fontProperties);
    fontMetricsFAB.setCharacterMetrics(char, metrics);
  }

  /**
   * Set text metrics for all glyphs from metrics object
   * @param {FontProperties} fontProperties - Font configuration
   * @param {Object} metrics - Object mapping characters to TextMetrics
   */
  static setGlyphsTextMetrics(fontProperties, metrics) {
    const fontMetricsFAB = FontMetricsStoreFAB.getFontMetricsFAB(fontProperties);
    fontMetricsFAB.setGlyphsTextMetrics(metrics);
  }

  /**
   * Set space advancement override for small font sizes
   * @param {FontProperties} fontProperties - Font configuration
   * @param {number} override - Override value in pixels
   */
  static setSpaceAdvancementOverrideForSmallSizesInPx(fontProperties, override) {
    const fontMetricsFAB = FontMetricsStoreFAB.getFontMetricsFAB(fontProperties);
    fontMetricsFAB.setSpaceAdvancementOverride(override);
  }

  /**
   * Validate that all required metrics are present for expected characters
   * @param {FontProperties} fontProperties - Font configuration
   * @param {string[]} expectedChars - Array of characters that should have metrics
   * @returns {string[]} Array of missing metrics (empty if all present)
   */
  static validateFontMetrics(fontProperties, expectedChars) {
    const fontMetrics = FontMetricsStore.getFontMetrics(fontProperties);
    if (fontMetrics?.validateFontMetrics) {
      return fontMetrics.validateFontMetrics(expectedChars);
    }
    return [];
  }
}