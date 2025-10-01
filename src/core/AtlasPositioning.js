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
// - xInAtlas values are reconstructed from tightWidth during deserialization (not serialized)
// - Reconstruction happens once at load time, not per-character at render time
// - All positioning data stored in memory for O(1) access during rendering
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

    // Atlas positioning data for glyph rendering
    this._tightWidth = data.tightWidth || {};
    this._tightHeight = data.tightHeight || {};
    this._dx = data.dx || {};
    this._dy = data.dy || {};
    // NOTE: xInAtlas is reconstructed from tightWidth during deserialization (not serialized to reduce file size)
    // At build time: populated by AtlasPositioningFAB during atlas packing
    // At runtime: reconstructed by AtlasDataExpander during atlas loading
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
   * @param {string} char - Character (code point) to get positioning for
   * @returns {Object} Object with xInAtlas, tightWidth, tightHeight, dx, dy
   */
  getPositioning(char) {
    return {
      xInAtlas: this._xInAtlas[char],
      tightWidth: this._tightWidth[char],
      tightHeight: this._tightHeight[char],
      dx: this._dx[char],
      dy: this._dy[char]
    };
  }

  /**
   * Check if positioning data exists for a character
   * @param {string} char - Character (code point) to check
   * @returns {boolean} True if positioning data exists
   */
  hasPositioning(char) {
    return this._xInAtlas[char] !== undefined &&
           this._tightWidth[char] !== undefined &&
           this._tightHeight[char] !== undefined;
  }

  /**
   * Check if atlas position (xInAtlas) exists for a character
   * @param {string} char - Character (code point) to check
   * @returns {boolean} True if atlas position exists
   */
  hasAtlasPosition(char) {
    return this._xInAtlas[char] !== undefined;
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
   * @param {string} char - Character (code point) to get width for
   * @returns {number|undefined} Tight width or undefined if not found
   */
  getTightWidth(char) {
    return this._tightWidth[char];
  }

  /**
   * Get tight height for a character
   * @param {string} char - Character (code point) to get height for
   * @returns {number|undefined} Tight height or undefined if not found
   */
  getTightHeight(char) {
    return this._tightHeight[char];
  }

  /**
   * Get X position in atlas for a character
   * @param {string} char - Character (code point) to get X position for
   * @returns {number|undefined} X position in atlas or undefined if not found
   */
  getXInAtlas(char) {
    return this._xInAtlas[char];
  }

  /**
   * Get dx offset for a character
   * @param {string} char - Character (code point) to get dx for
   * @returns {number|undefined} dx offset or undefined if not found
   */
  getDx(char) {
    return this._dx[char];
  }

  /**
   * Get dy offset for a character
   * @param {string} char - Character (code point) to get dy for
   * @returns {number|undefined} dy offset or undefined if not found
   */
  getDy(char) {
    return this._dy[char];
  }

}