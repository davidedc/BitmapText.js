// AtlasPositioningFAB - Font Assets Building Class for Atlas Positioning
//
// This class extends AtlasPositioning to provide font assets building capabilities
// for atlas positioning data including glyph dimensions and positioning calculations.
//
// DISTRIBUTION ROLE:
// - Part of "full toolkit" distribution for font assets building applications
// - Extends AtlasPositioning with building, calculation, and optimization features
// - Provides extraction methods to create clean runtime AtlasPositioning instances
//
// ARCHITECTURE:
// - Inherits all runtime functionality from AtlasPositioning
// - Uses mutable option to prevent freezing during building operations
// - Calculates positioning data from glyph canvas bounds and font metrics
// - Manages xInAtlas positions during atlas building process
//
// SEPARATION OF CONCERNS:
// - AtlasPositioningFAB: Handles ONLY atlas positioning calculations
// - FontMetricsFAB: Handles ONLY font metrics, kerning, and character measurements
// - Clear separation eliminates mixed responsibilities
//
// KEY CAPABILITIES:
// - Calculate positioning from glyph canvas data
// - Set xInAtlas positions during atlas building
// - Extract clean immutable AtlasPositioning instances
class AtlasPositioningFAB extends AtlasPositioning {
  constructor(data = {}) {
    // Call super with mutable option to prevent freezing during building
    super(data, { mutable: true });
  }

  /**
   * Extract a clean immutable AtlasPositioning instance for runtime use
   * This removes FAB-specific functionality and provides only runtime data
   * @returns {AtlasPositioning} Clean runtime AtlasPositioning instance
   */
  extractAtlasPositioningInstance() {
    return new AtlasPositioning({
      tightWidth: { ...this._tightWidth },
      tightHeight: { ...this._tightHeight },
      dx: { ...this._dx },
      dy: { ...this._dy },
      xInAtlas: { ...this._xInAtlas }
    });
  }

  /**
   * Calculate and set atlas positioning data from glyph data
   * This method calculates positioning data needed for atlas building and rendering
   * @param {Object} glyphs - Object mapping characters to glyph data
   * @param {FontProperties} fontProperties - Font configuration for positioning calculations
   * @param {FontMetricsStore} fontMetricsStore - Store to get character metrics from
   */
  calculatePositioning(glyphs, fontProperties, fontMetricsStore) {
    for (let letter in glyphs) {
      let glyph = glyphs[letter];

      // Get character metrics from FontMetricsStore
      const fontMetrics = fontMetricsStore.getFontMetrics(fontProperties);
      if (!fontMetrics) {
        throw new Error(`No font metrics found for: ${fontProperties.key}`);
      }

      let characterMetrics = fontMetrics.getCharacterMetrics(letter);

      // Skip glyphs without valid tight canvas box, but set default metrics
      if (!glyph.tightCanvasBox?.bottomRightCorner || !glyph.tightCanvasBox?.topLeftCorner) {
        // Set minimal default metrics for glyphs without visible pixels
        this._tightWidth[letter] = 1;
        this._tightHeight[letter] = 1;
        this._dx[letter] = 0;
        this._dy[letter] = 0;
        continue;
      }

      // Calculate tight dimensions from glyph bounds
      const tightWidth =
        glyph.tightCanvasBox.bottomRightCorner.x -
        glyph.tightCanvasBox.topLeftCorner.x +
        1;
      const tightHeight =
        glyph.tightCanvasBox.bottomRightCorner.y -
        glyph.tightCanvasBox.topLeftCorner.y +
        1;

      // Calculate positioning offsets for atlas rendering
      const dx = - Math.round(characterMetrics.actualBoundingBoxLeft) * fontProperties.pixelDensity + glyph.tightCanvasBox.topLeftCorner.x;
      const dy = - tightHeight - glyph.tightCanvas.distanceBetweenBottomAndBottomOfCanvas + 1 * fontProperties.pixelDensity;

      // Set the calculated metrics
      this._tightWidth[letter] = tightWidth;
      this._tightHeight[letter] = tightHeight;
      this._dx[letter] = dx;
      this._dy[letter] = dy;
    }
  }

  /**
   * Set glyph position in atlas after atlas is built
   * @param {string} letter - Character to set position for
   * @param {number} xPosition - X position in atlas
   */
  setGlyphPositionInAtlas(letter, xPosition) {
    this._xInAtlas[letter] = xPosition;
  }

  /**
   * Validate that all required positioning data is present for expected characters
   * @param {string[]} expectedLetters - Array of characters that should have positioning
   * @returns {string[]} Array of missing positioning data (empty if all present)
   */
  validatePositioning(expectedLetters) {
    const missingPositioning = [];

    for (const letter of expectedLetters) {
      if (!this.hasPositioning(letter)) {
        missingPositioning.push(`${letter}: missing positioning`);
      }
    }

    return missingPositioning;
  }

  /**
   * Clear all positioning data
   */
  clearPositioning() {
    this._tightWidth = {};
    this._tightHeight = {};
    this._dx = {};
    this._dy = {};
    this._xInAtlas = {};
  }

  /**
   * Get summary of positioning data for debugging
   * @returns {Object} Summary statistics
   */
  getPositioningSummary() {
    const characters = this.getAvailableCharacters();
    return {
      characterCount: characters.length,
      characters: characters.slice(0, 10), // First 10 for brevity
      samplePositioning: characters.length > 0 ? this.getPositioning(characters[0]) : null
    };
  }
}