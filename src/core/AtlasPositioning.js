// AtlasPositioning - Core Runtime Class
//
// This is a CORE RUNTIME class designed for minimal bundle size (~2-3KB).
// It encapsulates atlas positioning data for a single font configuration as an immutable domain object.
//
// DISTRIBUTION ROLE:
// - Part of "runtime-only" distribution for production applications
// - Extended by AtlasPositioningFAB for font assets building capabilities (if needed)
// - Contains only essential positioning data and accessor methods
// - No font generation, validation, or optimization code
//
// ARCHITECTURE:
// - Immutable object representing atlas positioning for ONE font configuration
// - Pre-computed lookups for optimal performance during glyph rendering
// - Provides clean API for accessing glyph positioning within atlas
// - Follows same immutable pattern as FontProperties and FontMetrics
//
// SEPARATION RATIONALE:
// - Encapsulates related atlas positioning data together
// - Eliminates repeated parameter passing for positioning lookups
// - Serves as domain object for atlas positioning
// - Enables cleaner, more object-oriented API
//
class AtlasPositioning {
  constructor(data, options = {}) {
    // Validate input data structure
    if (!data || typeof data !== 'object') {
      throw new Error('AtlasPositioning constructor requires data object');
    }

    // Atlas positioning metrics for glyph rendering
    this._tightWidth = data.tightWidth || {};
    this._tightHeight = data.tightHeight || {};
    this._dx = data.dx || {};
    this._dy = data.dy || {};
    this._xInAtlas = data.xInAtlas || {};

    // Freeze for immutability (safe to use as value object)
    // Skip freezing if this is for font assets building (FAB)
    if (!options.mutable) {
      Object.freeze(this._tightWidth);
      Object.freeze(this._tightHeight);
      Object.freeze(this._dx);
      Object.freeze(this._dy);
      Object.freeze(this._xInAtlas);
      Object.freeze(this);
    }
  }

  /**
   * Get positioning metrics for glyph rendering from atlas
   * @param {string} letter - Character to get positioning for
   * @returns {Object} Object with xInAtlas, tightWidth, tightHeight, dx, dy
   */
  getPositioning(letter) {
    return {
      xInAtlas: this._xInAtlas[letter],
      tightWidth: this._tightWidth[letter],
      tightHeight: this._tightHeight[letter],
      dx: this._dx[letter],
      dy: this._dy[letter]
    };
  }

  /**
   * Check if positioning data exists for a character
   * @param {string} letter - Character to check
   * @returns {boolean} True if positioning data exists
   */
  hasPositioning(letter) {
    return this._xInAtlas[letter] !== undefined &&
           this._tightWidth[letter] !== undefined &&
           this._tightHeight[letter] !== undefined;
  }

  /**
   * Check if atlas position (xInAtlas) exists for a character
   * @param {string} letter - Character to check
   * @returns {boolean} True if atlas position exists
   */
  hasAtlasPosition(letter) {
    return this._xInAtlas[letter] !== undefined;
  }

  /**
   * Get all available characters in this atlas positioning
   * @returns {string[]} Array of available characters
   */
  getAvailableCharacters() {
    return Object.keys(this._xInAtlas);
  }

  /**
   * Get tight width for a character
   * @param {string} letter - Character to get width for
   * @returns {number|undefined} Tight width or undefined if not found
   */
  getTightWidth(letter) {
    return this._tightWidth[letter];
  }

  /**
   * Get tight height for a character
   * @param {string} letter - Character to get height for
   * @returns {number|undefined} Tight height or undefined if not found
   */
  getTightHeight(letter) {
    return this._tightHeight[letter];
  }

  /**
   * Get X position in atlas for a character
   * @param {string} letter - Character to get X position for
   * @returns {number|undefined} X position in atlas or undefined if not found
   */
  getXInAtlas(letter) {
    return this._xInAtlas[letter];
  }

  /**
   * Get dx offset for a character
   * @param {string} letter - Character to get dx for
   * @returns {number|undefined} dx offset or undefined if not found
   */
  getDx(letter) {
    return this._dx[letter];
  }

  /**
   * Get dy offset for a character
   * @param {string} letter - Character to get dy for
   * @returns {number|undefined} dy offset or undefined if not found
   */
  getDy(letter) {
    return this._dy[letter];
  }

  /**
   * Get raw positioning maps (for compatibility/debugging)
   * @returns {Object} Raw positioning data
   */
  getRawData() {
    return {
      tightWidth: this._tightWidth,
      tightHeight: this._tightHeight,
      dx: this._dx,
      dy: this._dy,
      xInAtlas: this._xInAtlas
    };
  }
}