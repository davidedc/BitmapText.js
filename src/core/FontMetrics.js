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
    
    // Atlas positioning metrics for glyph rendering
    this._atlasPositioning = {
      tightWidth: data.atlasPositioning?.tightWidth || {},
      tightHeight: data.atlasPositioning?.tightHeight || {},
      dx: data.atlasPositioning?.dx || {},
      dy: data.atlasPositioning?.dy || {},
      xInAtlas: data.atlasPositioning?.xInAtlas || {}
    };
    
    // Freeze for immutability (safe to use as value object)
    // Skip freezing if this is for font assets building (FAB)
    if (!options.mutable) {
      Object.freeze(this._kerningTable);
      Object.freeze(this._characterMetrics);
      Object.freeze(this._atlasPositioning);
      Object.freeze(this);
    }
  }
  
  /**
   * Get positioning metrics for glyph rendering from atlas
   * @param {string} letter - Character to get metrics for
   * @returns {Object} Object with xInAtlas, tightWidth, tightHeight, dx, dy
   */
  getAtlasPositioning(letter) {
    return {
      xInAtlas: this._atlasPositioning.xInAtlas[letter],
      tightWidth: this._atlasPositioning.tightWidth[letter],
      tightHeight: this._atlasPositioning.tightHeight[letter],
      dx: this._atlasPositioning.dx[letter],
      dy: this._atlasPositioning.dy[letter]
    };
  }
  
  /**
   * Get text measurement metrics for a character
   * @param {string} letter - Character to get metrics for
   * @returns {Object} TextMetrics-compatible object
   */
  getCharacterMetrics(letter) {
    return this._characterMetrics[letter];
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
   * @param {string} letter - Character to check
   * @returns {boolean} True if glyph has metrics
   */
  hasGlyph(letter) {
    return letter in this._characterMetrics;
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
  
  /**
   * Check if this font has positioning data (atlas metrics)
   * @param {string} letter - Character to check
   * @returns {boolean} True if glyph has positioning data
   */
  hasPositioningData(letter) {
    return this._atlasPositioning.tightWidth[letter] !== undefined &&
           this._atlasPositioning.tightHeight[letter] !== undefined;
  }
  
  /**
   * Check if this font has atlas data (xInAtlas positioning)
   * @param {string} letter - Character to check  
   * @returns {boolean} True if glyph has atlas positioning
   */
  hasAtlasData(letter) {
    return this._atlasPositioning.xInAtlas[letter] !== undefined;
  }
}