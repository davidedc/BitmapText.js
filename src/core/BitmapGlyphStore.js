// A class to store all the glyph sheets and kerning tables
// and the minimal set of info necessary to draw text.
class BitmapGlyphStore {
  constructor() {
    // Keys are FontProperties.key strings for O(1) lookup
    
    // These are needed to measure text and place each glyph one after the other with the correct advancement
    this.kerningTables = new Map(); // fontProperties.key → kerningTable
    this.glyphsTextMetrics = new Map(); // fontProperties.key + ":" + letter → metrics
    this.spaceAdvancementOverrideForSmallSizesInPx = new Map(); // fontProperties.key → override
    
    // These are needed to precisely paint a glyph from the sheet into the destination canvas
    this.glyphSheets = new Map(); // fontProperties.key → glyphSheet
    this.glyphSheetsMetrics = {
      // All Maps indexed on fontProperties.key + ":" + letter for glyph-specific metrics
      tightWidth: new Map(),
      tightHeight: new Map(),
      dx: new Map(),
      dy: new Map(),
      xInGlyphSheet: new Map()
    };
  }

  getKerningTable(fontProperties) {
    // Direct Map lookup
    const key = fontProperties.key || this.#getLegacyKey(fontProperties);
    return this.kerningTables.get(key) || {};
  }

  setKerningTable(fontProperties, kerningTable) {
    const key = fontProperties.key || this.#getLegacyKey(fontProperties);
    this.kerningTables.set(key, kerningTable);
  }
  
  getGlyphSheet(fontProperties) {
    const key = fontProperties.key || this.#getLegacyKey(fontProperties);
    return this.glyphSheets.get(key);
  }

  setGlyphSheet(fontProperties, glyphSheet) {
    const key = fontProperties.key || this.#getLegacyKey(fontProperties);
    this.glyphSheets.set(key, glyphSheet);
  }

  // return an object with xInGlyphSheet, tightWidth, tightHeight, dx, dy
  getGlyphSheetMetrics(fontProperties, letter) {
    const baseKey = fontProperties.key || this.#getLegacyKey(fontProperties);
    const glyphKey = `${baseKey}:${letter}`;
    const glyphSheetsMetrics = this.glyphSheetsMetrics;
    
    return {
      xInGlyphSheet: glyphSheetsMetrics.xInGlyphSheet.get(glyphKey),
      tightWidth: glyphSheetsMetrics.tightWidth.get(glyphKey),
      tightHeight: glyphSheetsMetrics.tightHeight.get(glyphKey),
      dx: glyphSheetsMetrics.dx.get(glyphKey),
      dy: glyphSheetsMetrics.dy.get(glyphKey)
    };
  }

  setGlyphSheetMetrics(fontProperties, metrics) {
    const baseKey = fontProperties.key || this.#getLegacyKey(fontProperties);
    const glyphSheetsMetrics = this.glyphSheetsMetrics;
    
    // Set metrics for each letter in the font
    for (const metricKey in metrics) {
      if (glyphSheetsMetrics[metricKey]) {
        const letterMetrics = metrics[metricKey];
        for (const letter in letterMetrics) {
          const glyphKey = `${baseKey}:${letter}`;
          glyphSheetsMetrics[metricKey].set(glyphKey, letterMetrics[letter]);
        }
      }
    }
  }

  getGlyphsTextMetrics(fontProperties, letter) {
    const baseKey = fontProperties.key || this.#getLegacyKey(fontProperties);
    const glyphKey = `${baseKey}:${letter}`;
    return this.glyphsTextMetrics.get(glyphKey);
  }

  setGlyphsTextMetrics(fontProperties, metrics) {
    const baseKey = fontProperties.key || this.#getLegacyKey(fontProperties);
    // Set metrics for each letter
    for (const letter in metrics) {
      const glyphKey = `${baseKey}:${letter}`;
      this.glyphsTextMetrics.set(glyphKey, metrics[letter]);
    }
  }

  setGlyphTextMetrics(fontProperties, letter, metrics) {
    const baseKey = fontProperties.key || this.#getLegacyKey(fontProperties);
    const glyphKey = `${baseKey}:${letter}`;
    this.glyphsTextMetrics.set(glyphKey, metrics);
  }

  getSpaceAdvancementOverrideForSmallSizesInPx(fontProperties) {
    const key = fontProperties.key || this.#getLegacyKey(fontProperties);
    return this.spaceAdvancementOverrideForSmallSizesInPx.get(key);
  }

  setSpaceAdvancementOverrideForSmallSizesInPx(fontProperties, spaceAdvancementOverrideForSmallSizesInPx) {
    const key = fontProperties.key || this.#getLegacyKey(fontProperties);
    this.spaceAdvancementOverrideForSmallSizesInPx.set(key, spaceAdvancementOverrideForSmallSizesInPx);
  }

  // Helper method to check if a glyph sheet is valid for rendering
  isValidGlyphSheet(glyphSheet) {
    return glyphSheet && typeof glyphSheet === 'object' && glyphSheet.width > 0;
  }

  // TEMPORARY: Legacy key generation for backward compatibility during migration
  // This will be removed once all code uses FontProperties instances
  #getLegacyKey(fontProperties) {
    const { pixelDensity, fontFamily, fontStyle, fontWeight, fontSize } = fontProperties;
    return `${pixelDensity || 1}:${fontFamily}:${fontStyle || 'normal'}:${fontWeight || 'normal'}:${fontSize}`;
  }

}
