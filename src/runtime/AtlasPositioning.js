// AtlasPositioning - Core Runtime Class
//
// Immutable value object holding atlas positioning data for ONE font configuration.
// Storage shape is a single `_placements` dict whose values are flat per-character
// objects { xInAtlas, yInAtlas, tightWidth, tightHeight, dx, dy }. One dict lookup
// per glyph in the hot path; V8 sees a stable hidden class for the placement
// objects (all fields written in the same order at construction in
// PositioningBundleStore.getPositioning) and inlines field reads as fixed offsets.
//
// DISTRIBUTION ROLE:
// - Part of "runtime-only" distribution for production applications
// - Extended by AtlasPositioningFAB for font assets building capabilities
//
// IMMUTABILITY:
// - Frozen by default. AtlasPositioningFAB passes { mutable: true } during build.
// - When non-mutable, both the dict and each placement object are frozen.
//
class AtlasPositioning {
  constructor(data, options = {}) {
    if (!data || typeof data !== 'object') {
      throw new Error('AtlasPositioning constructor requires data object');
    }

    // _placements[char] = { xInAtlas, yInAtlas, tightWidth, tightHeight, dx, dy }
    this._placements = data.placements || {};

    if (!options.mutable) {
      for (const char in this._placements) {
        Object.freeze(this._placements[char]);
      }
      Object.freeze(this._placements);
      Object.freeze(this);
    }
  }

  /**
   * Check if positioning data exists for a character.
   * @param {string} char
   * @returns {boolean}
   */
  hasPositioning(char) {
    return this._placements[char] !== undefined;
  }

  /**
   * Get all available characters in this atlas positioning.
   * @returns {string[]}
   */
  getAvailableCharacters() {
    return Object.keys(this._placements);
  }
}
