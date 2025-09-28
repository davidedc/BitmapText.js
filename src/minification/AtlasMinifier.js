// Static utility class for minifying atlas positioning data (build-time only)
// Converts verbose atlas positioning structures to compact format for smaller file sizes
class AtlasMinifier {
  // Private constructor - prevent instantiation following Effective Java patterns
  constructor() {
    throw new Error('AtlasMinifier cannot be instantiated - use static methods');
  }

  /**
   * Minifies atlas positioning data for smaller file size
   * @param {Object} atlasPositioning - Full positioning object containing tightWidth, tightHeight, dx, dy, xInAtlas
   * @returns {Object} Minified positioning with shortened keys
   */
  static minify(atlasPositioning) {
    if (!atlasPositioning) {
      return null;
    }

    return {
      w: atlasPositioning.tightWidth || {},    // w -> tightWidth
      h: atlasPositioning.tightHeight || {},   // h -> tightHeight
      dx: atlasPositioning.dx || {},           // dx unchanged
      dy: atlasPositioning.dy || {},           // dy unchanged
      x: atlasPositioning.xInAtlas || {}       // x -> xInAtlas
    };
  }

  /**
   * Minifies atlas positioning from AtlasPositioning instance
   * @param {AtlasPositioning} atlasPositioning - AtlasPositioning instance
   * @returns {Object} Minified positioning with shortened keys
   */
  static minifyFromInstance(atlasPositioning) {
    if (!atlasPositioning) {
      return null;
    }

    const rawData = atlasPositioning.getRawData();
    return this.minify(rawData);
  }
}