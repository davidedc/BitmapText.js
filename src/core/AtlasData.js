// AtlasData - Core Runtime Class
//
// This is a CORE RUNTIME class designed for minimal bundle size (~2-3KB).
// It encapsulates both atlas image and positioning data for a font configuration.
//
// DISTRIBUTION ROLE:
// - Part of "runtime-only" distribution for production applications
// - Combines AtlasImage with AtlasPositioning data
// - Provides unified interface for atlas image and positioning access
// - Establishes architectural symmetry: AtlasImage + AtlasPositioning = AtlasData
//
// ARCHITECTURE:
// - Immutable object representing atlas image + positioning for ONE font configuration
// - Stores AtlasImage instance with AtlasPositioning instance
// - Provides clean API for accessing both image and positioning data
// - Validates atlas integrity for rendering safety
//
// SEPARATION RATIONALE:
// - Atlas positioning data moved from FontMetrics to be co-located with atlas images
// - Reduces metrics file sizes (positioning only loaded when atlas is loaded)
// - Better separation: metrics for measurement, atlas for rendering
// - Perfect symmetry: both image and positioning are encapsulated in domain objects
//
class AtlasData {
  constructor(atlasImage, atlasPositioning) {
    // Validate AtlasImage instance
    if (!(atlasImage instanceof AtlasImage)) {
      throw new Error('AtlasData constructor requires AtlasImage instance (not raw Canvas/Image)');
    }

    // Validate AtlasPositioning instance (optional but recommended)
    if (atlasPositioning && !(atlasPositioning instanceof AtlasPositioning)) {
      throw new Error('AtlasData constructor requires AtlasPositioning instance (not raw positioning object)');
    }

    // Store AtlasImage instance
    this._atlasImage = atlasImage;

    // Store AtlasPositioning instance
    this._atlasPositioning = atlasPositioning;

    // Freeze for immutability (safe to use as value object)
    Object.freeze(this);
  }

  /**
   * Get the AtlasImage instance
   * @returns {AtlasImage} AtlasImage instance
   */
  get atlasImage() {
    return this._atlasImage;
  }

  /**
   * Get positioning data for a character
   * @param {string} letter - Character to get positioning for
   * @returns {Object|undefined} Object with xInAtlas, tightWidth, tightHeight, dx, dy
   */
  getPositioning(letter) {
    if (!this._atlasPositioning) return undefined;

    // Delegate to AtlasPositioning instance
    return this._atlasPositioning.getPositioning(letter);
  }

  /**
   * Check if positioning data exists for a character
   * @param {string} letter - Character to check
   * @returns {boolean} True if positioning data exists
   */
  hasPositioning(letter) {
    if (!this._atlasPositioning) return false;

    // Delegate to AtlasPositioning instance
    return this._atlasPositioning.hasPositioning(letter);
  }

  /**
   * Check if this atlas data is valid for rendering
   * @returns {boolean} True if atlas has valid image and dimensions
   */
  isValid() {
    return this._atlasImage && this._atlasImage.isValid();
  }

  /**
   * Get all available characters in this atlas
   * @returns {string[]} Array of available characters
   */
  getAvailableCharacters() {
    if (!this._atlasPositioning) return [];

    // Delegate to AtlasPositioning instance
    return this._atlasPositioning.getAvailableCharacters();
  }

  /**
   * Get the width of the atlas image
   * @returns {number} Width in pixels
   */
  get width() {
    return this._atlasImage.width;
  }

  /**
   * Get the height of the atlas image
   * @returns {number} Height in pixels
   */
  get height() {
    return this._atlasImage.height;
  }

  /**
   * Check if the atlas can be rendered
   * @returns {boolean} True if atlas is ready for rendering operations
   */
  canRender() {
    return this._atlasImage && this._atlasImage.canRender();
  }

  /**
   * Get the AtlasPositioning instance
   * @returns {AtlasPositioning|null} AtlasPositioning instance or null
   */
  get atlasPositioning() {
    return this._atlasPositioning;
  }

  /**
   * Check if this atlas data equals another atlas data
   * @param {AtlasData} other - Another AtlasData instance
   * @returns {boolean} True if they reference the same image and positioning
   */
  equals(other) {
    if (!(other instanceof AtlasData)) return false;
    return this._atlasImage.equals(other._atlasImage) &&
           this._atlasPositioning === other._atlasPositioning;
  }

  /**
   * Get debug information about this atlas data
   * @returns {Object} Debug information
   */
  getDebugInfo() {
    return {
      atlasImage: this._atlasImage ? this._atlasImage.getDebugInfo() : null,
      atlasPositioning: this._atlasPositioning ? {
        availableCharacters: this._atlasPositioning.getAvailableCharacters().length,
        characters: this._atlasPositioning.getAvailableCharacters().slice(0, 10) // First 10 for brevity
      } : null,
      isValid: this.isValid(),
      canRender: this.canRender()
    };
  }
}