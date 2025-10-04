// AtlasCellDimensions - Utility for calculating atlas cell dimensions
//
// Provides centralized formulas for calculating cell dimensions from character metrics.
// These formulas MUST be consistent across AtlasBuilder and TightAtlasReconstructor.
//
// Cell dimensions follow the Atlas format (variable-width cells):
// - Cell width: actualBoundingBoxLeft + actualBoundingBoxRight (varies per character)
// - Cell height: fontBoundingBoxAscent + fontBoundingBoxDescent (constant per font)

class AtlasCellDimensions {
  // Private constructor - prevent instantiation
  constructor() {
    throw new Error('AtlasCellDimensions cannot be instantiated - use static methods');
  }

  /**
   * Calculate cell width for a character
   * @param {Object} charMetrics - Character metrics from FontMetrics
   * @returns {number} Cell width in pixels (ceiled)
   */
  static getWidth(charMetrics) {
    return Math.ceil(
      charMetrics.actualBoundingBoxLeft +
      charMetrics.actualBoundingBoxRight
    );
  }

  /**
   * Calculate cell height for a font
   * @param {Object} charMetrics - Character metrics (any character from the font)
   * @returns {number} Cell height in pixels (ceiled, constant for entire font)
   */
  static getHeight(charMetrics) {
    return Math.ceil(
      charMetrics.fontBoundingBoxAscent +
      charMetrics.fontBoundingBoxDescent
    );
  }

  /**
   * Calculate both dimensions
   * @param {Object} charMetrics - Character metrics
   * @returns {{width: number, height: number}}
   */
  static getDimensions(charMetrics) {
    return {
      width: this.getWidth(charMetrics),
      height: this.getHeight(charMetrics)
    };
  }
}
