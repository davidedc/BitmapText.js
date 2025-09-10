// BitmapGlyphStore - Core Runtime Class
//
// This is a CORE RUNTIME class designed for minimal bundle size (~5-8KB).
// It provides essential glyph data storage and retrieval for text rendering.
//
// DISTRIBUTION ROLE:
// - Part of "runtime-only" distribution for production applications  
// - Extended by BitmapGlyphStoreEditor for font generation and building
// - Contains only data structures and accessors needed at runtime
// - No font generation, validation, or optimization code
//
// ARCHITECTURE:
// - Stores pre-rendered glyph sheets, metrics, and kerning data
// - Uses Map-based storage for O(1) glyph lookups by font properties
// - Provides the minimal data interface needed by BitmapText for rendering
// - Optimized for fast access patterns during text drawing
//
// For font generation and building capabilities, use BitmapGlyphStoreEditor.
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
    return this.kerningTables.get(fontProperties.key) || {};
  }

  setKerningTable(fontProperties, kerningTable) {
    this.kerningTables.set(fontProperties.key, kerningTable);
  }
  
  getGlyphSheet(fontProperties) {
    return this.glyphSheets.get(fontProperties.key);
  }

  setGlyphSheet(fontProperties, glyphSheet) {
    this.glyphSheets.set(fontProperties.key, glyphSheet);
  }

  // return an object with xInGlyphSheet, tightWidth, tightHeight, dx, dy
  getGlyphSheetMetrics(fontProperties, letter) {
    const glyphKey = `${fontProperties.key}:${letter}`;
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
    const glyphSheetsMetrics = this.glyphSheetsMetrics;
    
    // Set metrics for each letter in the font
    for (const metricKey in metrics) {
      if (glyphSheetsMetrics[metricKey]) {
        const letterMetrics = metrics[metricKey];
        for (const letter in letterMetrics) {
          const glyphKey = `${fontProperties.key}:${letter}`;
          glyphSheetsMetrics[metricKey].set(glyphKey, letterMetrics[letter]);
        }
      }
    }
  }

  getGlyphsTextMetrics(fontProperties, letter) {
    const glyphKey = `${fontProperties.key}:${letter}`;
    return this.glyphsTextMetrics.get(glyphKey);
  }

  setGlyphsTextMetrics(fontProperties, metrics) {
    // Set metrics for each letter
    for (const letter in metrics) {
      const glyphKey = `${fontProperties.key}:${letter}`;
      this.glyphsTextMetrics.set(glyphKey, metrics[letter]);
    }
  }

  setGlyphTextMetrics(fontProperties, letter, metrics) {
    const glyphKey = `${fontProperties.key}:${letter}`;
    this.glyphsTextMetrics.set(glyphKey, metrics);
  }

  getSpaceAdvancementOverrideForSmallSizesInPx(fontProperties) {
    return this.spaceAdvancementOverrideForSmallSizesInPx.get(fontProperties.key);
  }

  setSpaceAdvancementOverrideForSmallSizesInPx(fontProperties, spaceAdvancementOverrideForSmallSizesInPx) {
    this.spaceAdvancementOverrideForSmallSizesInPx.set(fontProperties.key, spaceAdvancementOverrideForSmallSizesInPx);
  }

  // Helper method to check if a glyph sheet is valid for rendering
  isValidGlyphSheet(glyphSheet) {
    return glyphSheet && typeof glyphSheet === 'object' && glyphSheet.width > 0;
  }


}
