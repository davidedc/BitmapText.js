// AtlasDataStoreFAB - Font Assets Building Class for storage of Atlas Data (which
// includes atlas positioning data and atlas images)
//
// This class extends AtlasDataStore to provide font assets building capabilities
// for atlas image generation and management.
//
// DISTRIBUTION ROLE:
// - Part of "full toolkit" distribution for font assets building applications
// - Extends AtlasDataStore with atlas building, optimization, and generation features
// - Works in conjunction with FontMetricsStoreFAB for complete font assets building
// - Provides extraction methods to create clean runtime AtlasDataStore instances
//
// ARCHITECTURE:
// - Inherits atlas storage functionality from AtlasDataStore
// - Adds glyph storage and atlas building pipeline
// - Focuses solely on image atlas generation (metrics handled by FontMetricsStoreFAB)
// - Integrates with FontMetricsStoreFAB during the building process
//
// SEPARATION OF CONCERNS:
// - AtlasDataStoreFAB: Handles atlas image building from individual canvases
// - FontMetricsStoreFAB: Handles metrics calculation and positioning data
// - Both work together during font assets building but can be used independently
class AtlasDataStoreFAB extends AtlasDataStore {
  constructor() {
    super();
    // FAB-specific glyph storage using Map for O(1) lookups
    // Key format: fontProperties.key + ":" + char
    this.glyphs = new Map();
  }

  // Extract a clean AtlasDataStore instance for runtime distribution
  // This removes FAB-specific functionality and provides only runtime atlas data
  // Converts AtlasImageFAB instances to AtlasImage instances
  extractAtlasDataStoreInstance() {
    const instance = new AtlasDataStore();

    // Convert AtlasData containing AtlasImageFAB to AtlasData containing AtlasImage
    for (const [fontKey, atlasData] of this.atlases) {
      if (atlasData instanceof AtlasData) {
        // Check if the atlasData contains AtlasImageFAB
        if (atlasData.atlasImage instanceof AtlasImageFAB) {
          // Extract clean AtlasImage instance
          const cleanAtlasImage = atlasData.atlasImage.extractAtlasImageInstance();
          const cleanAtlasData = new AtlasData(cleanAtlasImage, atlasData.atlasPositioning);
          instance.atlases.set(fontKey, cleanAtlasData);
        } else {
          // Already contains AtlasImage, copy as-is
          instance.atlases.set(fontKey, atlasData);
        }
      } else {
        console.warn(`Unexpected atlas data type for ${fontKey} - skipping`);
      }
    }

    return instance;
  }



  addGlyph(glyph) {
    const glyphKey = `${glyph.fontProperties.key}:${glyph.char}`;
    this.glyphs.set(glyphKey, glyph);
  }

  getGlyph(fontProperties, char) {
    const glyphKey = `${fontProperties.key}:${char}`;
    return this.glyphs.get(glyphKey);
  }


  /**
   * Get glyphs for a specific font configuration (helper method)
   * @param {FontProperties} fontProperties - Font configuration
   * @returns {Object} Map of char → GlyphFAB
   */
  getGlyphsForFont(fontProperties) {
    const glyphs = {};
    for (const [glyphKey, glyph] of this.glyphs) {
      if (glyphKey.startsWith(fontProperties.key + ':')) {
        const char = glyphKey.substring(fontProperties.key.length + 1);
        glyphs[char] = glyph;
      }
    }
    return glyphs;
  }

  /**
   * Build atlas for validation/export (NEW METHOD for Phase 0)
   * Uses glyph.canvas (variable-width cells) instead of glyph.tightCanvas
   *
   * @param {FontProperties} fontProperties - Font configuration
   * @param {FontMetricsStore} fontMetricsStore - Font metrics store
   * @returns {{canvas, cellWidths, cellHeight, characters, totalWidth}}
   */
  buildAtlas(fontProperties, fontMetricsStore) {
    const glyphs = this.getGlyphsForFont(fontProperties);
    const fontMetrics = fontMetricsStore.getFontMetrics(fontProperties);

    if (!fontMetrics) {
      throw new Error(`No FontMetrics found for ${fontProperties.key}`);
    }

    return AtlasBuilder.buildAtlas(glyphs, fontMetrics);
  }

  /**
   * Reconstruct tight atlas from standard atlas (NEW METHOD for Phase 0 validation)
   * Reconstructs tight atlas by scanning atlas pixels
   *
   * @param {Canvas|Image} atlasCanvas - Atlas image (variable-width cells)
   * @param {FontProperties} fontProperties - Font configuration
   * @param {FontMetricsStore} fontMetricsStore - Font metrics store
   * @returns {AtlasData} AtlasData containing reconstructed tight atlas and positioning
   */
  reconstructTightAtlas(atlasCanvas, fontProperties, fontMetricsStore) {
    const fontMetrics = fontMetricsStore.getFontMetrics(fontProperties);

    if (!fontMetrics) {
      throw new Error(`No FontMetrics found for ${fontProperties.key}`);
    }

    const { atlasImage, atlasPositioning } =
      TightAtlasReconstructor.reconstructFromAtlas(
        atlasCanvas,
        fontMetrics,
        () => document.createElement('canvas')
      );

    return new AtlasData(atlasImage, atlasPositioning);
  }

}
