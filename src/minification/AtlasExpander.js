// Static utility class for expanding minified atlas positioning data (runtime only)
// Converts compact format back to AtlasPositioning instances for use by the rendering engine

class AtlasExpander {
  // Private constructor - prevent instantiation following Effective Java patterns
  constructor() {
    throw new Error('AtlasExpander cannot be instantiated - use static methods');
  }

  /**
   * Expands minified atlas positioning back to AtlasPositioning instance for runtime use
   * @param {Object} minified - Minified positioning object with shortened keys
   * @returns {AtlasPositioning} AtlasPositioning instance with expanded data
   */
  static expand(minified) {
    // Check if AtlasPositioning class is available (for cases where loaded as standalone)
    if (typeof AtlasPositioning === 'undefined') {
      throw new Error('AtlasPositioning class not found. Please ensure AtlasPositioning.js is loaded before AtlasExpander.js');
    }

    if (!minified) {
      // Return empty AtlasPositioning if no data
      return new AtlasPositioning({});
    }

    const expandedData = {
      tightWidth: minified.w || {},     // w -> tightWidth
      tightHeight: minified.h || {},    // h -> tightHeight
      dx: minified.dx || {},            // dx unchanged
      dy: minified.dy || {},            // dy unchanged
      xInAtlas: minified.x || {}        // x -> xInAtlas
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

    return {
      tightWidth: minified.w || {},     // w -> tightWidth
      tightHeight: minified.h || {},    // h -> tightHeight
      dx: minified.dx || {},            // dx unchanged
      dy: minified.dy || {},            // dy unchanged
      xInAtlas: minified.x || {}        // x -> xInAtlas
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
      throw new Error('AtlasData class not found. Please ensure AtlasData.js is loaded before AtlasExpander.js');
    }
    if (typeof AtlasImage === 'undefined') {
      throw new Error('AtlasImage class not found. Please ensure AtlasImage.js is loaded before AtlasExpander.js');
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