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
   * Validates that xInAtlas can be correctly reconstructed from tightWidth
   * This ensures the optimization is safe before removing xInAtlas from serialization
   * @param {AtlasPositioning} atlasPositioning - Instance to validate (must have _xInAtlas and _tightWidth)
   * @throws {Error} If reconstruction doesn't match original values
   */
  static validateReconstruction(atlasPositioning) {
    if (!atlasPositioning) {
      return; // Nothing to validate
    }

    const originalXInAtlas = atlasPositioning._xInAtlas;
    if (!originalXInAtlas) {
      return; // No xInAtlas to validate (empty atlas)
    }

    const tightWidth = atlasPositioning._tightWidth;
    if (!tightWidth) {
      throw new Error('AtlasPositioning missing _tightWidth - cannot validate reconstruction');
    }

    // Reconstruct using the same algorithm that will be used at runtime
    const reconstructedXInAtlas = {};
    let x = 0;

    // Only process characters that are in the atlas (have xInAtlas)
    // This mirrors the atlas building process which only includes characters with tightCanvas
    for (let char in tightWidth) {
      if (char in originalXInAtlas) {
        reconstructedXInAtlas[char] = x;
        x += tightWidth[char];
      }
    }

    // Validate: every character in original must match reconstructed
    const errors = [];
    for (let char in originalXInAtlas) {
      const original = originalXInAtlas[char];
      const reconstructed = reconstructedXInAtlas[char];

      if (reconstructed === undefined) {
        errors.push(`Char '${char}': in xInAtlas but not reconstructed (missing tightWidth?)`);
      } else if (original !== reconstructed) {
        errors.push(`Char '${char}': expected x=${original}, got x=${reconstructed}`);
      }
    }

    // Validate: no extra characters in reconstructed
    for (let char in reconstructedXInAtlas) {
      if (!(char in originalXInAtlas)) {
        errors.push(`Char '${char}': reconstructed but not in original xInAtlas`);
      }
    }

    if (errors.length > 0) {
      throw new Error(
        'xInAtlas reconstruction validation FAILED:\n' +
        errors.join('\n') +
        '\n\nThis indicates a bug in the reconstruction algorithm or atlas packing.\n' +
        'The optimization cannot proceed safely.'
      );
    }
  }

  /**
   * Minifies atlas positioning data for smaller file size
   * Only includes characters that are actually in the atlas (have xInAtlas)
   * xInAtlas is NOT included in output - will be reconstructed at runtime from width data
   * @param {Object} atlasPositioning - Full positioning object containing tightWidth, tightHeight, dx, dy, xInAtlas
   * @returns {Object} Minified positioning with shortened keys (w, h, dx, dy only)
   */
  static minify(atlasPositioning) {
    if (!atlasPositioning) {
      return null;
    }

    // Get characters that are actually in the atlas (have xInAtlas)
    const charsInAtlas = Object.keys(atlasPositioning.xInAtlas || {});

    // Only serialize positioning for characters in the atlas
    const minified = {
      w: {},   // tightWidth
      h: {},   // tightHeight
      dx: {},  // dx offset
      dy: {}   // dy offset
      // NOTE: NO 'x' property - will be reconstructed at runtime from 'w'
    };

    for (const char of charsInAtlas) {
      minified.w[char] = atlasPositioning.tightWidth[char];
      minified.h[char] = atlasPositioning.tightHeight[char];
      minified.dx[char] = atlasPositioning.dx[char];
      minified.dy[char] = atlasPositioning.dy[char];
    }

    return minified;
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
   * Includes validation to ensure xInAtlas can be reconstructed correctly
   * @param {AtlasPositioning} atlasPositioning - AtlasPositioning instance
   * @returns {Object} Minified positioning with shortened keys
   * @throws {Error} If reconstruction validation fails
   */
  static minifyFromInstance(atlasPositioning) {
    if (!atlasPositioning) {
      return null;
    }

    // VALIDATE before minification to ensure reconstruction will work correctly
    this.validateReconstruction(atlasPositioning);

    const rawData = this.getRawData(atlasPositioning);
    return this.minify(rawData);
  }
}