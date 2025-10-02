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
   * Validates that xInAtlas and tightHeight can be correctly reconstructed
   * This ensures the optimizations are safe before removing them from serialization
   * @param {AtlasPositioning} atlasPositioning - Instance to validate (must have _xInAtlas, _tightWidth, _tightHeight)
   * @param {AtlasImage} atlasImage - Atlas image for tightHeight reconstruction
   * @throws {Error} If reconstruction doesn't match original values
   */
  static validateReconstruction(atlasPositioning, atlasImage) {
    if (!atlasPositioning) {
      return; // Nothing to validate
    }

    const originalXInAtlas = atlasPositioning._xInAtlas;
    const originalTightHeight = atlasPositioning._tightHeight;

    if (!originalXInAtlas) {
      return; // No xInAtlas to validate (empty atlas)
    }

    const tightWidth = atlasPositioning._tightWidth;
    if (!tightWidth) {
      throw new Error('AtlasPositioning missing _tightWidth - cannot validate reconstruction');
    }

    // VALIDATE xInAtlas reconstruction using shared utility
    // Filter tightWidth to only include characters that are in the atlas (have xInAtlas)
    const tightWidthInAtlas = {};
    for (let char in originalXInAtlas) {
      tightWidthInAtlas[char] = tightWidth[char];
    }
    const reconstructedXInAtlas = AtlasReconstructionUtils.reconstructXInAtlas(tightWidthInAtlas);

    const errors = [];

    // Validate xInAtlas: every character in original must match reconstructed
    for (let char in originalXInAtlas) {
      const original = originalXInAtlas[char];
      const reconstructed = reconstructedXInAtlas[char];

      if (reconstructed === undefined) {
        errors.push(`xInAtlas - Char '${char}': in original but not reconstructed (missing tightWidth?)`);
      } else if (original !== reconstructed) {
        errors.push(`xInAtlas - Char '${char}': expected x=${original}, got x=${reconstructed}`);
      }
    }

    // Validate: no extra characters in reconstructed xInAtlas
    for (let char in reconstructedXInAtlas) {
      if (!(char in originalXInAtlas)) {
        errors.push(`xInAtlas - Char '${char}': reconstructed but not in original`);
      }
    }

    // VALIDATE tightHeight reconstruction using shared utility (if atlasImage provided)
    if (atlasImage && originalTightHeight) {
      const imageData = AtlasReconstructionUtils.getImageData(atlasImage);
      const reconstructedTightHeight = AtlasReconstructionUtils.reconstructTightHeight(
        tightWidthInAtlas,
        reconstructedXInAtlas,
        imageData
      );

      // Validate tightHeight: only check characters that are in the atlas (have xInAtlas)
      for (let char in originalXInAtlas) {
        const original = originalTightHeight[char];
        const reconstructed = reconstructedTightHeight[char];

        if (reconstructed === undefined) {
          errors.push(`tightHeight - Char '${char}': in original but not reconstructed`);
        } else if (original !== reconstructed) {
          errors.push(`tightHeight - Char '${char}': expected h=${original}, got h=${reconstructed}`);
        }
      }

      // Validate: no extra characters in reconstructed tightHeight
      for (let char in reconstructedTightHeight) {
        if (!(char in originalXInAtlas)) {
          errors.push(`tightHeight - Char '${char}': reconstructed but not in atlas`);
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(
        'Atlas reconstruction validation FAILED:\n' +
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
   * tightHeight is NOT included in output - will be reconstructed at runtime from atlas image
   * @param {Object} atlasPositioning - Full positioning object containing tightWidth, tightHeight, dx, dy, xInAtlas
   * @returns {Object} Minified positioning with shortened keys (w, dx, dy only)
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
      dx: {},  // dx offset
      dy: {}   // dy offset
      // NOTE: NO 'x' property - will be reconstructed at runtime from 'w'
      // NOTE: NO 'h' property - will be reconstructed at runtime from atlas image pixels
    };

    for (const char of charsInAtlas) {
      minified.w[char] = atlasPositioning.tightWidth[char];
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
   * Includes validation to ensure xInAtlas and tightHeight can be reconstructed correctly
   * @param {AtlasPositioning} atlasPositioning - AtlasPositioning instance
   * @param {AtlasImage} atlasImage - Atlas image for tightHeight reconstruction validation
   * @returns {Object} Minified positioning with shortened keys
   * @throws {Error} If reconstruction validation fails
   */
  static minifyFromInstance(atlasPositioning, atlasImage) {
    if (!atlasPositioning) {
      return null;
    }

    // VALIDATE before minification to ensure reconstruction will work correctly
    this.validateReconstruction(atlasPositioning, atlasImage);

    const rawData = this.getRawData(atlasPositioning);
    return this.minify(rawData);
  }
}