// AtlasImage - Core Runtime Class
//
// This is a CORE RUNTIME class designed for minimal bundle size (~1-2KB).
// It encapsulates atlas image data as an immutable domain object.
//
// DISTRIBUTION ROLE:
// - Part of "runtime-only" distribution for production applications
// - Extended by AtlasImageFAB for font assets building capabilities
// - Contains only essential image data and accessor methods
// - No image generation, validation, or serialization code
//
// ARCHITECTURE:
// - Immutable object representing atlas image for ONE font configuration
// - Provides clean API for accessing image properties and validation
// - Follows same immutable pattern as FontProperties, TextProperties, FontMetrics, and AtlasPositioning
// - Establishes architectural symmetry: AtlasImage + AtlasPositioning = AtlasData
//
// SEPARATION RATIONALE:
// - Encapsulates image-related functionality in dedicated domain object
// - Eliminates raw Canvas/Image element handling throughout the codebase
// - Provides consistent interface for image validation and access
// - Enables cleaner, more object-oriented API design
//
// For font assets building capabilities, use AtlasImageFAB which extends this class.
class AtlasImage {
  constructor(image, options = {}) {
    // Validate input image
    if (!image) {
      throw new Error('AtlasImage constructor requires image (Canvas or Image element)');
    }

    if (typeof image !== 'object' || (image.width === undefined && image.naturalWidth === undefined)) {
      throw new Error('AtlasImage constructor requires Canvas or Image element with width property');
    }

    // Store image (Canvas or Image element) - public field (object is frozen)
    this.image = image;

    // Freeze for immutability (safe to use as value object)
    // Skip freezing if this is for font assets building (FAB)
    if (!options.mutable) {
      Object.freeze(this);
    }
  }

  /**
   * Get the width of the atlas image
   * @returns {number} Width in pixels
   */
  get width() {
    // Handle both Canvas (width) and Image (naturalWidth/width) elements
    return this.image.naturalWidth || this.image.width || 0;
  }

  /**
   * Get the height of the atlas image
   * @returns {number} Height in pixels
   */
  get height() {
    // Handle both Canvas (height) and Image (naturalHeight/height) elements
    return this.image.naturalHeight || this.image.height || 0;
  }

  /**
   * Check if this atlas image is valid for rendering
   * @returns {boolean} True if image has valid dimensions
   */
  isValid() {
    return this.image &&
           typeof this.image === 'object' &&
           this.width > 0 &&
           this.height > 0;
  }
}