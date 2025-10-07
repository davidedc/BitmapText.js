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
    // ⚠️ CRITICAL FIX: Use sorted character order for determinism
    // JavaScript for...in iteration order is not guaranteed to be stable
    const sortedChars = Object.keys(glyphs).sort();

    for (const char of sortedChars) {
      let glyph = glyphs[char];

      // Get character metrics from FontMetricsStore
      const fontMetrics = fontMetricsStore.getFontMetrics(fontProperties);
      if (!fontMetrics) {
        throw new Error(`No font metrics found for: ${fontProperties.key}`);
      }

      let characterMetrics = fontMetrics.getCharacterMetrics(char);

      // Skip glyphs without valid tight canvas box, but set default metrics
      if (!glyph.tightCanvasBox?.bottomRightCorner || !glyph.tightCanvasBox?.topLeftCorner) {
        // Set minimal default metrics for glyphs without visible pixels
        this._tightWidth[char] = 1;
        this._tightHeight[char] = 1;
        this._dx[char] = 0;
        this._dy[char] = 0;
        continue;
      }

      // Calculate tight dimensions from glyph bounds (all in physical pixels)
      const tightWidth_PhysPx =
        glyph.tightCanvasBox.bottomRightCorner.x -
        glyph.tightCanvasBox.topLeftCorner.x +
        1;
      const tightHeight_PhysPx =
        glyph.tightCanvasBox.bottomRightCorner.y -
        glyph.tightCanvasBox.topLeftCorner.y +
        1;

      // Calculate positioning offsets for atlas rendering (all in physical pixels)
      // EXACT formula - MUST match TightAtlasReconstructor.js:339-347
      const dx_PhysPx = - Math.round(characterMetrics.actualBoundingBoxLeft) * fontProperties.pixelDensity + glyph.tightCanvasBox.topLeftCorner.x;
      const dy_PhysPx = - tightHeight_PhysPx - glyph.tightCanvas.distanceBetweenBottomAndBottomOfCanvas_PhysPx + 1 * fontProperties.pixelDensity;

      // Set the calculated metrics (stored in physical pixels)
      this._tightWidth[char] = tightWidth_PhysPx;
      this._tightHeight[char] = tightHeight_PhysPx;
      this._dx[char] = dx_PhysPx;
      this._dy[char] = dy_PhysPx;
    }
  }

  /**
   * Set glyph position in atlas after atlas is built
   * @param {string} char - Character to set position for
   * @param {number} xPosition_PhysPx - X position in atlas (physical pixels)
   */
  setGlyphPositionInAtlas(char, xPosition_PhysPx) {
    this._xInAtlas[char] = xPosition_PhysPx;
  }

  /**
   * Validate that all required positioning data is present for expected characters
   * @param {string[]} expectedChars - Array of characters that should have positioning
   * @returns {string[]} Array of missing positioning data (empty if all present)
   */
  validatePositioning(expectedChars) {
    const missingPositioning = [];

    for (const char of expectedChars) {
      if (!this.hasPositioning(char)) {
        missingPositioning.push(`${char}: missing positioning`);
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