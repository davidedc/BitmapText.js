// AtlasPositioningFAB - Font Assets Building Class for Atlas Positioning
//
// Extends AtlasPositioning with mutable building helpers used during font asset
// generation. Storage is the same `_placements[char] = {xInAtlas, yInAtlas,
// tightWidth, tightHeight, dx, dy}` dict the runtime uses — the FAB sets the
// per-glyph metrics first (calculatePositioning), then fills in atlas placement
// coordinates (setGlyphPositionInAtlas) after AtlasBuilder lays out the rows.
// extractAtlasPositioningInstance produces a frozen runtime AtlasPositioning by
// deep-cloning the placement dict.
//
// DISTRIBUTION ROLE:
// - Part of "full toolkit" distribution for font assets building applications
// - NOT included in the runtime-only bundle.
class AtlasPositioningFAB extends AtlasPositioning {
  constructor(data = {}) {
    super(data, { mutable: true });
  }

  /**
   * Extract a clean immutable AtlasPositioning instance for runtime use.
   * Deep-copies each placement object so subsequent FAB mutations don't leak
   * into the frozen runtime instance.
   * @returns {AtlasPositioning}
   */
  extractAtlasPositioningInstance() {
    const placements = {};
    for (const char in this._placements) {
      placements[char] = { ...this._placements[char] };
    }
    return new AtlasPositioning({ placements });
  }

  /**
   * Calculate and set atlas positioning data from glyph data.
   * Sets {tightWidth, tightHeight, dx, dy} per character with xInAtlas/yInAtlas
   * initialised to 0 — atlas coordinates are filled in by setGlyphPositionInAtlas
   * once AtlasBuilder has laid out the rows.
   * @param {Object} glyphs - Object mapping characters to glyph data
   * @param {FontProperties} fontProperties - Font configuration for positioning calculations
   * @param {FontMetricsStore} fontMetricsStore - Store to get character metrics from
   */
  calculatePositioning(glyphs, fontProperties, fontMetricsStore) {
    // CRITICAL: Use sorted character order for determinism
    const sortedChars = Object.keys(glyphs).sort();

    for (const char of sortedChars) {
      const glyph = glyphs[char];

      const fontMetrics = fontMetricsStore.getFontMetrics(fontProperties);
      if (!fontMetrics) {
        throw new Error(`No font metrics found for: ${fontProperties.key}`);
      }

      const characterMetrics = fontMetrics.getCharacterMetrics(char);

      // Empty glyph (no visible pixels — e.g. space): emit zero-sized placement
      // so we stay in lockstep with AtlasBuilder, which packs nothing here.
      if (!glyph.tightCanvasBox?.bottomRightCorner || !glyph.tightCanvasBox?.topLeftCorner) {
        this._placements[char] = {
          xInAtlas: 0, yInAtlas: 0,
          tightWidth: 0, tightHeight: 0,
          dx: 0, dy: 0
        };
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

      // Atlas-positioning offsets (physical pixels).
      // dx: horizontal offset for actualBoundingBoxLeft and tight canvas left edge.
      // dy: vertical offset for tight height, bottom distance, and pixelDensity baseline.
      const dx_PhysPx = - Math.round(characterMetrics.actualBoundingBoxLeft) * fontProperties.pixelDensity + glyph.tightCanvasBox.topLeftCorner.x;
      const dy_PhysPx = - tightHeight_PhysPx - glyph.tightCanvas.distanceBetweenBottomAndBottomOfCanvas_PhysPx + 1 * fontProperties.pixelDensity;

      this._placements[char] = {
        xInAtlas: 0,
        yInAtlas: 0,
        tightWidth: tightWidth_PhysPx,
        tightHeight: tightHeight_PhysPx,
        dx: dx_PhysPx,
        dy: dy_PhysPx
      };
    }
  }

  /**
   * Set glyph position in atlas after atlas is built.
   * @param {string} char - Character to set position for
   * @param {number} xPosition_PhysPx - X position in atlas (physical pixels)
   * @param {number} yPosition_PhysPx - Y position in atlas (physical pixels, defaults to 0)
   */
  setGlyphPositionInAtlas(char, xPosition_PhysPx, yPosition_PhysPx = 0) {
    let p = this._placements[char];
    if (!p) {
      // Caller is setting position before calculatePositioning ran for this char.
      // Create a placeholder; tightWidth/tightHeight/dx/dy stay at 0 until later.
      p = { xInAtlas: 0, yInAtlas: 0, tightWidth: 0, tightHeight: 0, dx: 0, dy: 0 };
      this._placements[char] = p;
    }
    p.xInAtlas = xPosition_PhysPx;
    p.yInAtlas = yPosition_PhysPx;
  }

  /**
   * Serialise this positioning into the per-(font, density) wire shape used
   * by the positioning bundle. Each integer array is delta+zigzag+varint+base64
   * encoded via BundleCodec.encodeDeltaVarIntB64.
   *
   * Single-row atlas: 4 base64 strings [tightWidth, tightHeight, dx, dy]
   *   yInAtlas implicit (always 0); xInAtlas implicit (cumsum of tightWidth).
   * Multi-row atlas:  5 base64 strings [tightWidth, tightHeight, dx, dy, yInAtlas]
   *   xInAtlas still implicit — runtime cumsums tightWidth, resetting on yInAtlas change.
   *
   * Arrays are in sorted-character order (matches AtlasBuilder's pack order).
   *
   * @returns {string[]}
   */
  serialiseAsBundleRecord() {
    const characters = Object.keys(this._placements).sort();
    const n = characters.length;
    const tightWidth = new Array(n);
    const tightHeight = new Array(n);
    const dx = new Array(n);
    const dy = new Array(n);
    const yInAtlas = new Array(n);
    let multiRow = false;
    for (let i = 0; i < n; i++) {
      const p = this._placements[characters[i]];
      tightWidth[i] = p.tightWidth;
      tightHeight[i] = p.tightHeight;
      dx[i] = p.dx;
      dy[i] = p.dy;
      const y = p.yInAtlas || 0;
      yInAtlas[i] = y;
      if (y !== 0) multiRow = true;
    }
    const enc = BundleCodec.encodeDeltaVarIntB64;
    return multiRow
      ? [enc(tightWidth), enc(tightHeight), enc(dx), enc(dy), enc(yInAtlas)]
      : [enc(tightWidth), enc(tightHeight), enc(dx), enc(dy)];
  }

  /**
   * Validate that all required positioning data is present for expected characters.
   * @param {string[]} expectedChars - Characters that should have positioning
   * @returns {string[]} Array of missing positioning descriptions (empty if all present)
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
   * Clear all positioning data.
   */
  clearPositioning() {
    this._placements = {};
  }

  /**
   * Get summary of positioning data for debugging.
   * @returns {Object} Summary statistics
   */
  getPositioningSummary() {
    const characters = this.getAvailableCharacters();
    const firstChar = characters[0];
    const sample = characters.length > 0 ? this._placements[firstChar] : null;
    return {
      characterCount: characters.length,
      characters: characters.slice(0, 10),
      samplePositioning: sample ? { ...sample } : null
    };
  }

  /**
   * Generate a deterministic hash of the positioning data for any
   * AtlasPositioning instance. Uses a simple FNV-1a variant.
   * @param {AtlasPositioning} atlasPositioningInstance
   * @returns {string} 6-character hex hash
   */
  static getHash(atlasPositioningInstance) {
    const chars = atlasPositioningInstance.getAvailableCharacters().sort();

    const parts = [];
    for (const char of chars) {
      const p = atlasPositioningInstance._placements[char];
      parts.push(
        `${char}:` +
        `w${p.tightWidth}` +
        `h${p.tightHeight}` +
        `x${p.dx}` +
        `y${p.dy}` +
        `ax${p.xInAtlas}` +
        `ay${p.yInAtlas}`
      );
    }

    const str = parts.join('|');
    let hash = 2166136261; // FNV offset basis
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }

    return (hash >>> 0).toString(16).substring(0, 6).padStart(6, '0');
  }
}
