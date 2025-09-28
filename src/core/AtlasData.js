// AtlasData - Core Runtime Class
//
// This is a CORE RUNTIME class designed for minimal bundle size (~2-3KB).
// It encapsulates both atlas image and positioning data for a font configuration.
//
// DISTRIBUTION ROLE:
// - Part of "runtime-only" distribution for production applications
// - Combines atlas image with character positioning data
// - Provides unified interface for atlas image and positioning access
// - Replaces storing raw images in AtlasStore
//
// ARCHITECTURE:
// - Immutable object representing atlas image + positioning for ONE font configuration
// - Stores Canvas/Image element with character positioning maps
// - Provides clean API for accessing both image and positioning data
// - Validates atlas integrity for rendering safety
//
// SEPARATION RATIONALE:
// - Atlas positioning data moved from FontMetrics to be co-located with atlas images
// - Reduces metrics file sizes (positioning only loaded when atlas is loaded)
// - Better separation: metrics for measurement, atlas for rendering
//
class AtlasData {
  constructor(image, atlasPositioning) {
    // Validate inputs
    if (!image) {
      throw new Error('AtlasData constructor requires image');
    }

    // Store image (Canvas or Image element)
    this._image = image;

    // Store positioning data (AtlasPositioning instance or raw positioning object)
    this._atlasPositioning = atlasPositioning;

    // Freeze for immutability (safe to use as value object)
    Object.freeze(this);
  }

  /**
   * Get the atlas image
   * @returns {Canvas|Image} Atlas image element
   */
  get image() {
    return this._image;
  }

  /**
   * Get positioning data for a character
   * @param {string} letter - Character to get positioning for
   * @returns {Object|undefined} Object with xInAtlas, tightWidth, tightHeight, dx, dy
   */
  getPositioning(letter) {
    if (!this._atlasPositioning) return undefined;

    // Handle both AtlasPositioning instances and raw objects
    if (this._atlasPositioning.getPositioning) {
      return this._atlasPositioning.getPositioning(letter);
    }

    // Handle raw positioning object (fallback for simple cases)
    return {
      xInAtlas: this._atlasPositioning.xInAtlas?.[letter],
      tightWidth: this._atlasPositioning.tightWidth?.[letter],
      tightHeight: this._atlasPositioning.tightHeight?.[letter],
      dx: this._atlasPositioning.dx?.[letter],
      dy: this._atlasPositioning.dy?.[letter]
    };
  }

  /**
   * Check if positioning data exists for a character
   * @param {string} letter - Character to check
   * @returns {boolean} True if positioning data exists
   */
  hasPositioning(letter) {
    if (!this._atlasPositioning) return false;

    // Handle both AtlasPositioning instances and raw objects
    if (this._atlasPositioning.hasPositioning) {
      return this._atlasPositioning.hasPositioning(letter);
    }

    // Handle raw positioning object
    return this._atlasPositioning.xInAtlas?.[letter] !== undefined;
  }

  /**
   * Check if this atlas data is valid for rendering
   * @returns {boolean} True if atlas has valid image and dimensions
   */
  isValid() {
    return this._image &&
           typeof this._image === 'object' &&
           this._image.width > 0 &&
           this._image.height > 0;
  }

  /**
   * Get all available characters in this atlas
   * @returns {string[]} Array of available characters
   */
  getAvailableCharacters() {
    if (!this._atlasPositioning) return [];

    // Handle both AtlasPositioning instances and raw objects
    if (this._atlasPositioning.getAvailableCharacters) {
      return this._atlasPositioning.getAvailableCharacters();
    }

    // Handle raw positioning object
    return Object.keys(this._atlasPositioning.xInAtlas || {});
  }
}