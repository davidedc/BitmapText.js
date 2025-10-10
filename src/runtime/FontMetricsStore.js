// FontMetricsStore - Core Runtime Static Class
//
// This is a CORE RUNTIME static class designed for minimal bundle size (~2-3KB).
// It provides essential font metrics storage and retrieval as a repository of FontMetrics instances.
//
// DISTRIBUTION ROLE:
// - Part of "runtime-only" distribution for production applications
// - Extended by FontMetricsStoreFAB for font assets building and generation
// - Contains only FontMetrics instance storage and retrieval
// - No font generation, validation, or optimization code
//
// ARCHITECTURE:
// - Static class with private storage for FontMetrics instances
// - Stores FontMetrics instances for fast O(1) lookup by font properties
// - Simple repository pattern with get/set/has operations
// - FontMetrics instances encapsulate all metrics data and behavior
// - Separate from AtlasDataStore to enable independent loading strategies
//
// SEPARATION RATIONALE:
// - Font metrics are small data loaded from metrics-*.js files
// - Can be loaded upfront for immediate text measurement capabilities
// - Independent of atlas images which are larger and can be lazy-loaded
// - FontMetrics instances provide clean API without fontProperties parameter passing
//
// For font assets building and generation capabilities, use FontMetricsStoreFAB.
class FontMetricsStore {
  // Private static storage
  // Keys are FontProperties.key strings for O(1) FontMetrics instance lookup
  static #fontMetrics = new Map(); // fontProperties.key → FontMetrics instance

  /**
   * Get FontMetrics instance for a font configuration
   * @param {FontProperties} fontProperties - Font configuration
   * @returns {FontMetrics|undefined} FontMetrics instance or undefined if not found
   */
  static getFontMetrics(fontProperties) {
    return FontMetricsStore.#fontMetrics.get(fontProperties.key);
  }

  /**
   * Set FontMetrics instance for a font configuration
   * @param {FontProperties} fontProperties - Font configuration
   * @param {FontMetrics} fontMetrics - FontMetrics instance to store
   */
  static setFontMetrics(fontProperties, fontMetrics) {
    FontMetricsStore.#fontMetrics.set(fontProperties.key, fontMetrics);
  }

  /**
   * Check if FontMetrics exists for a font configuration
   * @param {FontProperties} fontProperties - Font configuration
   * @returns {boolean} True if FontMetrics instance exists
   */
  static hasFontMetrics(fontProperties) {
    return FontMetricsStore.#fontMetrics.has(fontProperties.key);
  }

  /**
   * Remove FontMetrics for a font configuration
   * @param {FontProperties} fontProperties - Font configuration
   * @returns {boolean} True if FontMetrics was removed
   */
  static deleteFontMetrics(fontProperties) {
    return FontMetricsStore.#fontMetrics.delete(fontProperties.key);
  }

  /**
   * Get all available font configurations
   * @returns {string[]} Array of fontProperties.key strings
   */
  static getAvailableFonts() {
    return Array.from(FontMetricsStore.#fontMetrics.keys());
  }

  /**
   * Clear all stored FontMetrics instances
   */
  static clear() {
    FontMetricsStore.#fontMetrics.clear();
  }

  /**
   * Get count of stored FontMetrics instances
   * @returns {number} Number of stored font configurations
   */
  static size() {
    return FontMetricsStore.#fontMetrics.size;
  }
}
