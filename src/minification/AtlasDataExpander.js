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
   * Reconstructs xInAtlas positions from tightWidth data
   * Characters are positioned sequentially in the atlas in the order they appear
   * in the minified data (JavaScript for...in iteration order)
   * @param {Object} minified - Minified positioning data with 'w' property
   * @returns {Object} Map of character to xInAtlas position
   */
  static reconstructXInAtlas(minified) {
    const xInAtlas = {};
    let x = 0;

    // Iterate in the same order as atlas was built (JavaScript for...in order)
    // All characters in minified.w are in the atlas (non-atlas chars filtered during minification)
    for (let char in minified.w) {
      xInAtlas[char] = x;
      x += minified.w[char];
    }

    return xInAtlas;
  }

  /**
   * Expands minified atlas positioning back to AtlasPositioning instance for runtime use
   * @param {Object} minified - Minified positioning object with shortened keys
   * @returns {AtlasPositioning} AtlasPositioning instance with expanded data
   */
  static expand(minified) {
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

    const expandedData = {
      tightWidth: minified.w || {},     // w -> tightWidth
      tightHeight: minified.h || {},    // h -> tightHeight
      dx: minified.dx || {},            // dx unchanged
      dy: minified.dy || {},            // dy unchanged
      xInAtlas: xInAtlas                // Reconstructed from width data or legacy format
    };

    return new AtlasPositioning(expandedData);
  }

  /**
   * Expands minified atlas positioning to raw object (for cases where AtlasPositioning class is not needed)
   * @param {Object} minified - Minified positioning object with shortened keys
   * @returns {Object} Raw positioning object with full property names
   */
  static expandToRaw(minified) {
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

    return {
      tightWidth: minified.w || {},     // w -> tightWidth
      tightHeight: minified.h || {},    // h -> tightHeight
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

    // Expand positioning data
    const atlasPositioning = this.expand(minifiedPositioning);

    // Create and return AtlasData instance
    return new AtlasData(atlasImage, atlasPositioning);
  }
}