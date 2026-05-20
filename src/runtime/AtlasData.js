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
   * Check if this atlas data is valid for rendering
   * @returns {boolean} True if atlas has valid image and dimensions
   */
  isValid() {
    return this.atlasImage?.isValid();
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
}