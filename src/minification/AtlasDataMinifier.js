// AtlasDataMinifier - Static utility class for minifying atlas positioning data (build-time only)
// Converts verbose atlas positioning structures to compact format for smaller file sizes
//
// ARCHITECTURAL DESIGN RATIONALE:
// This class operates on extracted non-FAB runtime instances (AtlasPositioning) rather than
// FAB instances for important reasons:
// 1. Ensures we only serialize/export data needed at runtime (no build-time methods)
// 2. Allows immediate serialization/deserialization validation against exact runtime data
// 3. Keeps minification logic separate from runtime classes to avoid unnecessary code in production
// 4. The export pipeline intentionally extracts clean runtime instances before minification
//
// This is why getRawData() is moved here as a static method - it's only needed for
// serialization/minification, not for runtime operations.
class AtlasDataMinifier {
  // Private constructor - prevent instantiation following Effective Java patterns
  constructor() {
    throw new Error('AtlasDataMinifier cannot be instantiated - use static methods');
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
   * Extracts raw positioning data from AtlasPositioning instance
   * Used only for serialization/minification - not needed at runtime
   * This would be better as a method in AtlasPositioningFAB, however it
   * wouldn't work there because at time of minification (where this is needed)
   * we have only AtlasPositioning instances. So in theory we could put it in
   * AtlasPositioning class, however this is never used at runtime so it
   * would be a waste of space at runtime, so here we are, it's a method here.
   * @param {AtlasPositioning} atlasPositioning - AtlasPositioning instance
   * @returns {Object} Raw positioning data
   */
  static getRawData(atlasPositioning) {
    if (!atlasPositioning) {
      return null;
    }
    return {
      tightWidth: atlasPositioning._tightWidth,
      tightHeight: atlasPositioning._tightHeight,
      dx: atlasPositioning._dx,
      dy: atlasPositioning._dy,
      xInAtlas: atlasPositioning._xInAtlas
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

    const rawData = this.getRawData(atlasPositioning);
    return this.minify(rawData);
  }
}