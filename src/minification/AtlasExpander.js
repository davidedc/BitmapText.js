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
}