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
      xInAtlas: { ...this._xInAtlas },
      yInAtlas: { ...this._yInAtlas }
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

      // Empty glyph (no visible pixels — e.g. space): emit zero-sized entry to
      // stay in lockstep with AtlasBuilder, which packs nothing for these. The
      // runtime PositioningBundleStore computes xInAtlas as cumsum(tightWidth),
      // so 0 here means subsequent glyphs aren't shifted in the atlas. drawImage
      // with zero width is a no-op, so the render path tolerates this directly.
      if (!glyph.tightCanvasBox?.bottomRightCorner || !glyph.tightCanvasBox?.topLeftCorner) {
        this._tightWidth[char] = 0;
        this._tightHeight[char] = 0;
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

      // Calculate positioning offsets for atlas rendering (all in physical pixels).
      // dx_PhysPx: Horizontal offset accounting for actualBoundingBoxLeft and tight canvas left edge
      // dy_PhysPx: Vertical offset accounting for tight height, bottom distance, and pixelDensity baseline
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
   * @param {number} yPosition_PhysPx - Y position in atlas (physical pixels, defaults to 0 for backward compatibility)
   */
  setGlyphPositionInAtlas(char, xPosition_PhysPx, yPosition_PhysPx = 0) {
    this._xInAtlas[char] = xPosition_PhysPx;
    this._yInAtlas[char] = yPosition_PhysPx;
  }

  /**
   * Serialise this positioning into the per-(font, density) array shape used
   * by the positioning bundle.
   *
   * Single-row atlas (most fonts): 4 arrays
   *   [tightWidth[], tightHeight[], dx[], dy[]]
   * yInAtlas is implicit (always 0); xInAtlas is implicit (cumsum of tightWidth).
   *
   * Multi-row atlas (e.g. wide italic-bold density-2 sizes whose total tight width
   * would exceed cwebp's 16383px hard limit): 5 arrays
   *   [tightWidth[], tightHeight[], dx[], dy[], yInAtlas[]]
   * xInAtlas is still implicit — runtime cumsums tightWidth, resetting to 0
   * whenever yInAtlas changes.
   *
   * Arrays are in sorted-character order (matches AtlasBuilder's pack order).
   *
   * @returns {(number[])[]}
   */
  serialiseAsBundleRecord() {
    const characters = Object.keys(this._tightWidth).sort();
    const n = characters.length;
    const tightWidth = new Array(n);
    const tightHeight = new Array(n);
    const dx = new Array(n);
    const dy = new Array(n);
    const yInAtlas = new Array(n);
    let multiRow = false;
    for (let i = 0; i < n; i++) {
      const char = characters[i];
      tightWidth[i] = this._tightWidth[char];
      tightHeight[i] = this._tightHeight[char];
      dx[i] = this._dx[char];
      dy[i] = this._dy[char];
      const y = this._yInAtlas[char] || 0;
      yInAtlas[i] = y;
      if (y !== 0) multiRow = true;
    }
    return multiRow
      ? [tightWidth, tightHeight, dx, dy, yInAtlas]
      : [tightWidth, tightHeight, dx, dy];
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
    this._yInAtlas = {};
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

  /**
   * Generate a deterministic hash of the positioning data for any AtlasPositioning instance
   * Uses a simple but stable algorithm that works cross-browser/cross-platform
   * NOTE: This is a static method that accepts an AtlasPositioning instance (runtime or FAB)
   * @param {AtlasPositioning} atlasPositioningInstance - Instance to hash
   * @returns {string} 6-character hex hash
   */
  static getHash(atlasPositioningInstance) {
    // Get sorted characters for deterministic ordering
    const chars = atlasPositioningInstance.getAvailableCharacters().sort();

    // Build deterministic string representation
    const parts = [];
    for (const char of chars) {
      const pos = atlasPositioningInstance.getPositioning(char);
      // Use fixed-precision to avoid floating point variations
      parts.push(
        `${char}:` +
        `w${pos.tightWidth}` +
        `h${pos.tightHeight}` +
        `x${pos.dx}` +
        `y${pos.dy}` +
        `ax${pos.xInAtlas}` +
        `ay${pos.yInAtlas}`
      );
    }

    // Simple hash function (FNV-1a variant)
    const str = parts.join('|');
    let hash = 2166136261; // FNV offset basis
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }

    // Return as 6-character hex (24 bits)
    return (hash >>> 0).toString(16).substring(0, 6).padStart(6, '0');
  }
}