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
    // NOTE: xInAtlas and yInAtlas are reconstructed from tightWidth during deserialization (not serialized to reduce file size)
    // At build time: populated by AtlasPositioningFAB during atlas packing
    // At runtime: reconstructed by TightAtlasReconstructor during atlas loading
    this._xInAtlas = data.xInAtlas || {};
    this._yInAtlas = data.yInAtlas || {};

    // Freeze for immutability (safe to use as value object)
    // Skip freezing if this is for font assets building (FAB)
    if (!options.mutable) {
      Object.freeze(this._tightWidth);
      Object.freeze(this._tightHeight);
      Object.freeze(this._dx);
      Object.freeze(this._dy);
      Object.freeze(this._xInAtlas);
      Object.freeze(this._yInAtlas);
      Object.freeze(this);
    }
  }

  /**
   * Get positioning metrics for glyph rendering from atlas
   * @param {string} char - Character (code point) to get positioning for
   * @returns {Object} Object with xInAtlas, yInAtlas, tightWidth, tightHeight, dx, dy
   */
  getPositioning(char) {
    return {
      xInAtlas: this._xInAtlas[char],
      yInAtlas: this._yInAtlas[char],
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
           this._yInAtlas[char] !== undefined &&
           this._tightWidth[char] !== undefined &&
           this._tightHeight[char] !== undefined;
  }

  /**
   * Check if atlas position (xInAtlas, yInAtlas) exists for a character
   * @param {string} char - Character (code point) to check
   * @returns {boolean} True if atlas position exists
   */
  hasAtlasPosition(char) {
    return this._xInAtlas[char] !== undefined &&
           this._yInAtlas[char] !== undefined;
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
   * Get Y position in atlas for a character
   * @param {string} char - Character (code point) to get Y position for
   * @returns {number|undefined} Y position in atlas or undefined if not found
   */
  getYInAtlas(char) {
    return this._yInAtlas[char];
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

  /**
   * Generate a deterministic hash of the positioning data
   * Uses a simple but stable algorithm that works cross-browser/cross-platform
   * @returns {string} 6-character hex hash
   */
  getHash() {
    // Get sorted characters for deterministic ordering
    const chars = this.getAvailableCharacters().sort();

    // Build deterministic string representation
    const parts = [];
    for (const char of chars) {
      const pos = this.getPositioning(char);
      // Use fixed-precision to avoid floating point variations
      parts.push(
        `${char}:` +
        `w${pos.tightWidth}` +
        `h${pos.tightHeight}` +
        `x${pos.dx}` +
        `y${pos.dy}` +
        `ax${pos.xInAtlas}` +
        `ay${pos.yInAtlas}`
      );
    }

    // Simple hash function (FNV-1a variant)
    const str = parts.join('|');
    let hash = 2166136261; // FNV offset basis
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }

    // Return as 6-character hex (24 bits)
    return (hash >>> 0).toString(16).substring(0, 6).padStart(6, '0');
  }

}