// AtlasDataExpander - Static utility class for expanding minified atlas positioning data (runtime only)
// Converts compact format back to AtlasPositioning instances for use by the rendering engine
//
// ARCHITECTURAL DESIGN RATIONALE:
// This class works with minified atlas positioning data that was processed by AtlasDataMinifier.
// It operates on runtime-ready instances and provides clean AtlasPositioning instances for
// the rendering engine, maintaining the separation between build-time and runtime functionality.
//
// The expansion process ensures that:
// 1. Minified data (w, h, x) is properly expanded to full property names (tightWidth, tightHeight, xInAtlas)
// 2. Runtime AtlasPositioning instances are created for the rendering pipeline
// 3. AtlasData instances can be properly constructed from loaded image and positioning data

class AtlasDataExpander {
  // Private constructor - prevent instantiation following Effective Java patterns
  constructor() {
    throw new Error('AtlasDataExpander cannot be instantiated - use static methods');
  }

  /**
   * Reconstructs xInAtlas positions from tightWidth data (uses shared utility)
   * @param {Object} minified - Minified positioning data with 'w' property
   * @returns {Object} Map of character to xInAtlas position
   */
  static reconstructXInAtlas(minified) {
    return AtlasReconstructionUtils.reconstructXInAtlas(minified.w);
  }

  /**
   * Expands minified atlas positioning back to AtlasPositioning instance for runtime use
   * Supports both old format (with 'x' and 'h') and new format (without them)
   * @param {Object} minified - Minified positioning object with shortened keys
   * @param {AtlasImage} [atlasImage] - Optional atlas image for tightHeight reconstruction (required for new format without 'h')
   * @returns {AtlasPositioning} AtlasPositioning instance with expanded data
   */
  static expand(minified, atlasImage) {
    // Check if AtlasPositioning class is available (for cases where loaded as standalone)
    if (typeof AtlasPositioning === 'undefined') {
      throw new Error('AtlasPositioning class not found. Please ensure AtlasPositioning.js is loaded before AtlasDataExpander.js');
    }

    if (!minified) {
      // Return empty AtlasPositioning if no data
      return new AtlasPositioning({});
    }

    // Reconstruct xInAtlas from width data (ALL values at once, single batch operation)
    // If minified.x exists (old format), use it; otherwise reconstruct (new format)
    const xInAtlas = minified.x || this.reconstructXInAtlas(minified);

    // Reconstruct tightHeight from atlas image if not in minified data (new format)
    let tightHeight;
    if (minified.h) {
      // Old format: use stored tightHeight
      tightHeight = minified.h;
    } else if (atlasImage) {
      // New format: reconstruct from atlas image
      const imageData = AtlasReconstructionUtils.getImageData(atlasImage);
      tightHeight = AtlasReconstructionUtils.reconstructTightHeight(minified.w, xInAtlas, imageData);
    } else {
      throw new Error('AtlasDataExpander.expand: tightHeight not in minified data and no atlasImage provided for reconstruction');
    }

    const expandedData = {
      tightWidth: minified.w || {},     // w -> tightWidth
      tightHeight: tightHeight,         // h -> tightHeight (or reconstructed)
      dx: minified.dx || {},            // dx unchanged
      dy: minified.dy || {},            // dy unchanged
      xInAtlas: xInAtlas                // Reconstructed from width data or legacy format
    };

    return new AtlasPositioning(expandedData);
  }

  /**
   * Expands minified atlas positioning to raw object (for cases where AtlasPositioning class is not needed)
   * Supports both old format (with 'x' and 'h') and new format (without them)
   * @param {Object} minified - Minified positioning object with shortened keys
   * @param {AtlasImage} [atlasImage] - Optional atlas image for tightHeight reconstruction (required for new format without 'h')
   * @returns {Object} Raw positioning object with full property names
   */
  static expandToRaw(minified, atlasImage) {
    if (!minified) {
      return {
        tightWidth: {},
        tightHeight: {},
        dx: {},
        dy: {},
        xInAtlas: {}
      };
    }

    // Reconstruct xInAtlas from width data
    // If minified.x exists (old format), use it; otherwise reconstruct (new format)
    const xInAtlas = minified.x || this.reconstructXInAtlas(minified);

    // Reconstruct tightHeight from atlas image if not in minified data (new format)
    let tightHeight;
    if (minified.h) {
      // Old format: use stored tightHeight
      tightHeight = minified.h;
    } else if (atlasImage) {
      // New format: reconstruct from atlas image
      const imageData = AtlasReconstructionUtils.getImageData(atlasImage);
      tightHeight = AtlasReconstructionUtils.reconstructTightHeight(minified.w, xInAtlas, imageData);
    } else {
      throw new Error('AtlasDataExpander.expandToRaw: tightHeight not in minified data and no atlasImage provided for reconstruction');
    }

    return {
      tightWidth: minified.w || {},     // w -> tightWidth
      tightHeight: tightHeight,         // h -> tightHeight (or reconstructed)
      dx: minified.dx || {},            // dx unchanged
      dy: minified.dy || {},            // dy unchanged
      xInAtlas: xInAtlas                // Reconstructed from width data or legacy format
    };
  }

  /**
   * Creates AtlasData instance from image and minified positioning data
   * @param {Canvas|Image|AtlasImage} image - Image element, Canvas, or AtlasImage instance
   * @param {Object} minifiedPositioning - Minified positioning object with shortened keys
   * @returns {AtlasData} AtlasData instance combining AtlasImage and AtlasPositioning
   */
  static createAtlasData(image, minifiedPositioning) {
    // Check if required classes are available
    if (typeof AtlasData === 'undefined') {
      throw new Error('AtlasData class not found. Please ensure AtlasData.js is loaded before AtlasDataExpander.js');
    }
    if (typeof AtlasImage === 'undefined') {
      throw new Error('AtlasImage class not found. Please ensure AtlasImage.js is loaded before AtlasDataExpander.js');
    }

    // Create AtlasImage instance if not already one
    let atlasImage;
    if (image instanceof AtlasImage) {
      atlasImage = image;
    } else {
      atlasImage = new AtlasImage(image);
    }

    // Expand positioning data (pass atlasImage for tightHeight reconstruction if needed)
    const atlasPositioning = this.expand(minifiedPositioning, atlasImage);

    // Create and return AtlasData instance
    return new AtlasData(atlasImage, atlasPositioning);
  }
}