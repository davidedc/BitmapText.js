// FontMetricsStore - Core Runtime Class
//
// This is a CORE RUNTIME class designed for minimal bundle size (~3-5KB).
// It provides essential font metrics storage and retrieval for text measurement and positioning.
//
// DISTRIBUTION ROLE:
// - Part of "runtime-only" distribution for production applications  
// - Extended by FontMetricsStoreFAB for font assets building and generation
// - Contains only data structures and accessors needed for text measurement
// - No font generation, validation, or optimization code
//
// ARCHITECTURE:
// - Stores pre-calculated font metrics, kerning data, and glyph positioning
// - Uses Map-based storage for O(1) glyph lookups by font properties
// - Provides the minimal metrics interface needed by BitmapText for text measurement
// - Optimized for fast access patterns during text measurement and positioning
// - Separate from AtlasStore to enable independent loading strategies
//
// SEPARATION RATIONALE:
// - Font metrics are small data loaded from metrics-*.js files
// - Can be loaded upfront for immediate text measurement capabilities
// - Independent of atlas images which are larger and can be lazy-loaded
// - Aligns with file structure: metrics-*.js vs atlas-*.png
//
// For font assets building and generation capabilities, use FontMetricsStoreFAB.
class FontMetricsStore {
  constructor() {
    // Keys are FontProperties.key strings for O(1) lookup
    
    // These are needed to measure text and place each glyph one after the other with the correct advancement
    this.kerningTables = new Map(); // fontProperties.key → kerningTable
    this.glyphsTextMetrics = new Map(); // fontProperties.key + ":" + letter → metrics
    this.spaceAdvancementOverrideForSmallSizesInPx = new Map(); // fontProperties.key → override
    
    // These are needed to precisely position a glyph from the atlas (renamed from atlasMetrics)
    this.fontMetrics = {
      // All Maps indexed on fontProperties.key + ":" + letter for glyph-specific metrics
      tightWidth: new Map(),
      tightHeight: new Map(),
      dx: new Map(),
      dy: new Map(),
      xInAtlas: new Map()
    };
  }

  getKerningTable(fontProperties) {
    // Direct Map lookup
    return this.kerningTables.get(fontProperties.key) || {};
  }

  setKerningTable(fontProperties, kerningTable) {
    this.kerningTables.set(fontProperties.key, kerningTable);
  }

  // Renamed from getAtlasMetrics to better reflect that this contains font positioning metrics
  // return an object with xInAtlas, tightWidth, tightHeight, dx, dy
  getFontMetrics(fontProperties, letter) {
    const glyphKey = `${fontProperties.key}:${letter}`;
    const fontMetrics = this.fontMetrics;
    
    return {
      xInAtlas: fontMetrics.xInAtlas.get(glyphKey),
      tightWidth: fontMetrics.tightWidth.get(glyphKey),
      tightHeight: fontMetrics.tightHeight.get(glyphKey),
      dx: fontMetrics.dx.get(glyphKey),
      dy: fontMetrics.dy.get(glyphKey)
    };
  }

  // Renamed from setAtlasMetrics to better reflect that this contains font positioning metrics
  setFontMetrics(fontProperties, metrics) {
    const fontMetrics = this.fontMetrics;
    
    // Set metrics for each letter in the font
    for (const metricKey in metrics) {
      if (fontMetrics[metricKey]) {
        const letterMetrics = metrics[metricKey];
        for (const letter in letterMetrics) {
          const glyphKey = `${fontProperties.key}:${letter}`;
          fontMetrics[metricKey].set(glyphKey, letterMetrics[letter]);
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
}