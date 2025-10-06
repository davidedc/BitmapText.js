// FontMetrics - Core Runtime Class
//
// This is a CORE RUNTIME class designed for minimal bundle size (~3-4KB).
// It encapsulates all metrics data for a single font configuration as an immutable domain object.
//
// DISTRIBUTION ROLE:
// - Part of "runtime-only" distribution for production applications
// - Extended by FontMetricsFAB for font assets building capabilities
// - Contains only essential metrics data and accessor methods
// - No font generation, validation, or optimization code
//
// ARCHITECTURE:
// - Immutable object representing all metrics for ONE font configuration
// - Pre-computed lookups for optimal performance during text rendering
// - Provides clean API without needing fontProperties passed to every method
// - Follows same immutable pattern as FontProperties
//
// SEPARATION RATIONALE:
// - Encapsulates related metrics data together
// - Eliminates repeated fontProperties parameter passing
// - Serves as domain object for font metrics
// - Enables cleaner, more object-oriented API
//
// For font assets building capabilities, use FontMetricsFAB which extends this class.
class FontMetrics {
  constructor(data, options = {}) {
    // Validate input data structure
    if (!data || typeof data !== 'object') {
      throw new Error('FontMetrics constructor requires data object');
    }
    
    // Kerning table: character pairs → adjustment values
    this._kerningTable = data.kerningTable || {};
    
    // Character metrics: character → TextMetrics-compatible object
    this._characterMetrics = data.characterMetrics || {};
    
    // Space advancement override for small font sizes
    this._spaceAdvancementOverride = data.spaceAdvancementOverrideForSmallSizesInPx || null;
    
    // Freeze for immutability (safe to use as value object)
    // Skip freezing if this is for font assets building (FAB)
    if (!options.mutable) {
      Object.freeze(this._kerningTable);
      Object.freeze(this._characterMetrics);
      Object.freeze(this);
    }
  }
  
  /**
   * Get text measurement metrics for a character
   * @param {string} char - Character (code point) to get metrics for
   * @returns {Object} TextMetrics-compatible object
   */
  getCharacterMetrics(char) {
    return this._characterMetrics[char];
  }
  
  /**
   * Get kerning adjustment between two characters
   * @param {string} leftChar - Left character in pair
   * @param {string} rightChar - Right character in pair  
   * @returns {number} Kerning adjustment value (0 if no adjustment)
   */
  getKerningAdjustment(leftChar, rightChar) {
    if (!leftChar || !rightChar) return 0;
    return this._kerningTable[leftChar]?.[rightChar] || 0;
  }
  
  /**
   * Check if glyph exists in this font
   * @param {string} char - Character (code point) to check
   * @returns {boolean} True if glyph has metrics
   */
  hasGlyph(char) {
    return char in this._characterMetrics;
  }
  
  /**
   * Get space advancement override for small font sizes
   * @returns {number|null} Override value in pixels, or null if no override
   */
  getSpaceAdvancementOverride() {
    return this._spaceAdvancementOverride;
  }
  
  /**
   * Get the complete kerning table (for compatibility/debugging)
   * @returns {Object} Complete kerning table
   */
  getKerningTable() {
    return this._kerningTable;
  }
  
  /**
   * Get all available characters in this font
   * @returns {string[]} Array of available characters
   */
  getAvailableCharacters() {
    return Object.keys(this._characterMetrics);
  }
  
}