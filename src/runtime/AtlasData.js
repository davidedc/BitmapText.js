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

    // Store AtlasImage instance (public field - object is frozen)
    this.atlasImage = atlasImage;

    // Store AtlasPositioning instance (public field - object is frozen)
    this.atlasPositioning = atlasPositioning;

    // Freeze for immutability (safe to use as value object)
    Object.freeze(this);
  }

  /**
   * Check if positioning data exists for a character
   * Null-safe convenience method that delegates to the AtlasPositioning instance.
   * This demonstrates the delegation pattern: AtlasData wraps AtlasPositioning
   * and provides a simplified interface for checking character availability.
   * @param {string} char - Character (code point) to check
   * @returns {boolean} True if positioning data exists
   */
  hasPositioning(char) {
    if (!this.atlasPositioning) return false;

    // Delegate to AtlasPositioning instance
    return this.atlasPositioning.hasPositioning(char);
  }

  /**
   * Check if this atlas data is valid for rendering
   * @returns {boolean} True if atlas has valid image and dimensions
   */
  isValid() {
    return this.atlasImage?.isValid();
  }

  /**
   * Get all available characters in this atlas
   * @returns {string[]} Array of available characters
   */
  getAvailableCharacters() {
    if (!this.atlasPositioning) return [];

    // Delegate to AtlasPositioning instance
    return this.atlasPositioning.getAvailableCharacters();
  }

  /**
   * Get the width of the atlas image
   * @returns {number} Width in pixels
   */
  get width() {
    return this.atlasImage.width;
  }

  /**
   * Get the height of the atlas image
   * @returns {number} Height in pixels
   */
  get height() {
    return this.atlasImage.height;
  }

  /**
   * Check if the atlas can be rendered
   * @returns {boolean} True if atlas is ready for rendering operations
   */
  canRender() {
    return this.atlasImage?.canRender();
  }

  /**
   * Check if this atlas data equals another atlas data
   * @param {AtlasData} other - Another AtlasData instance
   * @returns {boolean} True if they reference the same image and positioning
   */
  equals(other) {
    if (!(other instanceof AtlasData)) return false;
    return this.atlasImage.equals(other.atlasImage) &&
           this.atlasPositioning === other.atlasPositioning;
  }

  /**
   * Get debug information about this atlas data
   * @returns {Object} Debug information
   */
  getDebugInfo() {
    return {
      atlasImage: this.atlasImage ? this.atlasImage.getDebugInfo() : null,
      atlasPositioning: this.atlasPositioning ? {
        availableCharacters: this.atlasPositioning.getAvailableCharacters().length,
        characters: this.atlasPositioning.getAvailableCharacters().slice(0, 10) // First 10 for brevity
      } : null,
      isValid: this.isValid(),
      canRender: this.canRender()
    };
  }
}