// AtlasStore - Core Runtime Class
//
// This is a CORE RUNTIME class designed for minimal bundle size (~5-8KB).
// It provides essential glyph data storage and retrieval for text rendering.
//
// DISTRIBUTION ROLE:
// - Part of "runtime-only" distribution for production applications  
// - Extended by AtlasStoreFAB for font assets building and generation
// - Contains only data structures and accessors needed at runtime
// - No font generation, validation, or optimization code
//
// ARCHITECTURE:
// - Stores pre-rendered atlases, metrics, and kerning data
// - Uses Map-based storage for O(1) glyph lookups by font properties
// - Provides the minimal data interface needed by BitmapText for rendering
// - Optimized for fast access patterns during text drawing
//
// For font assets building and generation capabilities, use AtlasStoreFAB.
class AtlasStore {
  constructor() {
    // Keys are FontProperties.key strings for O(1) lookup
    
    // These are needed to measure text and place each glyph one after the other with the correct advancement
    this.kerningTables = new Map(); // fontProperties.key → kerningTable
    this.glyphsTextMetrics = new Map(); // fontProperties.key + ":" + letter → metrics
    this.spaceAdvancementOverrideForSmallSizesInPx = new Map(); // fontProperties.key → override
    
    // These are needed to precisely paint a glyph from the atlas into the destination canvas
    this.atlases = new Map(); // fontProperties.key → atlas
    this.atlasMetrics = {
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
  
  getAtlas(fontProperties) {
    return this.atlases.get(fontProperties.key);
  }

  setAtlas(fontProperties, atlas) {
    this.atlases.set(fontProperties.key, atlas);
  }

  // return an object with xInAtlas, tightWidth, tightHeight, dx, dy
  getAtlasMetrics(fontProperties, letter) {
    const glyphKey = `${fontProperties.key}:${letter}`;
    const atlasMetrics = this.atlasMetrics;
    
    return {
      xInAtlas: atlasMetrics.xInAtlas.get(glyphKey),
      tightWidth: atlasMetrics.tightWidth.get(glyphKey),
      tightHeight: atlasMetrics.tightHeight.get(glyphKey),
      dx: atlasMetrics.dx.get(glyphKey),
      dy: atlasMetrics.dy.get(glyphKey)
    };
  }

  setAtlasMetrics(fontProperties, metrics) {
    const atlasMetrics = this.atlasMetrics;
    
    // Set metrics for each letter in the font
    for (const metricKey in metrics) {
      if (atlasMetrics[metricKey]) {
        const letterMetrics = metrics[metricKey];
        for (const letter in letterMetrics) {
          const glyphKey = `${fontProperties.key}:${letter}`;
          atlasMetrics[metricKey].set(glyphKey, letterMetrics[letter]);
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

  // Helper method to check if an atlas is valid for rendering
  isValidAtlas(atlas) {
    return atlas && typeof atlas === 'object' && atlas.width > 0;
  }


}
