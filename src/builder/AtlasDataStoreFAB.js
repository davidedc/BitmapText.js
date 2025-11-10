// AtlasDataStoreFAB - Font Assets Building Static Class for storage of Atlas Data
//
// This static class extends AtlasDataStore to provide font assets building capabilities
// for atlas image generation and management.
//
// DISTRIBUTION ROLE:
// - Part of "full toolkit" distribution for font assets building applications
// - Extends AtlasDataStore with atlas building, optimization, and generation features
// - Works in conjunction with FontMetricsStoreFAB for complete font assets building
//
// ARCHITECTURE:
// - Static class extending static AtlasDataStore
// - Inherits atlas storage functionality from parent
// - Adds glyph storage and atlas building pipeline
// - Focuses solely on image atlas generation (metrics handled by FontMetricsStoreFAB)
// - Integrates with FontMetricsStoreFAB during the building process
//
// SEPARATION OF CONCERNS:
// - AtlasDataStoreFAB: Handles atlas image building from individual canvases
// - FontMetricsStoreFAB: Handles metrics calculation and positioning data
// - Both work together during font assets building but can be used independently
class AtlasDataStoreFAB extends AtlasDataStore {
  // Private static storage for glyphs (FAB-specific)
  // Key format: fontProperties.key + ":" + char
  static #glyphs = new Map();

  static addGlyph(glyph) {
    const glyphKey = `${glyph.fontProperties.key}:${glyph.char}`;
    AtlasDataStoreFAB.#glyphs.set(glyphKey, glyph);
  }

  static getGlyph(fontProperties, char) {
    const glyphKey = `${fontProperties.key}:${char}`;
    return AtlasDataStoreFAB.#glyphs.get(glyphKey);
  }

  /**
   * Get glyphs for a specific font configuration (helper method)
   * @param {FontProperties} fontProperties - Font configuration
   * @returns {Object} Map of char → GlyphFAB
   */
  static getGlyphsForFont(fontProperties) {
    const glyphs = {};
    for (const [glyphKey, glyph] of AtlasDataStoreFAB.#glyphs) {
      if (glyphKey.startsWith(fontProperties.key + ':')) {
        const char = glyphKey.substring(fontProperties.key.length + 1);
        glyphs[char] = glyph;
      }
    }
    return glyphs;
  }

  /**
   * Clear all glyphs for a specific font configuration
   * @param {FontProperties} fontProperties - Font configuration
   */
  static clearGlyphsForFont(fontProperties) {
    const keysToDelete = [];
    for (const glyphKey of AtlasDataStoreFAB.#glyphs.keys()) {
      if (glyphKey.startsWith(fontProperties.key + ':')) {
        keysToDelete.push(glyphKey);
      }
    }
    for (const key of keysToDelete) {
      AtlasDataStoreFAB.#glyphs.delete(key);
    }
  }

  /**
   * Get all available font keys (unique font configurations that have glyphs)
   * @returns {Array<string>} Array of font property keys (format: "density:family:style:weight:size")
   */
  static getAvailableFonts() {
    const fontKeys = new Set();
    for (const glyphKey of AtlasDataStoreFAB.#glyphs.keys()) {
      // Glyph key format: "fontProperties.key:char"
      // Extract font key by removing ":char" suffix
      const lastColonIndex = glyphKey.lastIndexOf(':');
      if (lastColonIndex !== -1) {
        const fontKey = glyphKey.substring(0, lastColonIndex);
        fontKeys.add(fontKey);
      }
    }
    return Array.from(fontKeys);
  }

  /**
   * Build atlas for export
   * Uses glyph.canvas (variable-width cells) instead of glyph.tightCanvas
   *
   * @param {FontProperties} fontProperties - Font configuration
   * @returns {{canvas, cellWidths, cellHeight, characters, totalWidth}}
   */
  static buildAtlas(fontProperties) {
    const glyphs = AtlasDataStoreFAB.getGlyphsForFont(fontProperties);
    const fontMetrics = FontMetricsStore.getFontMetrics(fontProperties);

    if (!fontMetrics) {
      throw new Error(`No FontMetrics found for ${fontProperties.key}`);
    }

    return AtlasBuilder.buildAtlas(fontMetrics, glyphs);
  }

  /**
   * Reconstruct tight atlas from standard atlas
   * Reconstructs tight atlas by scanning atlas pixels
   *
   * @param {Canvas|Image} atlasCanvas - Atlas image (variable-width cells)
   * @param {FontProperties} fontProperties - Font configuration
   * @returns {AtlasData} AtlasData containing reconstructed tight atlas and positioning
   */
  static reconstructTightAtlas(atlasCanvas, fontProperties) {
    const fontMetrics = FontMetricsStore.getFontMetrics(fontProperties);

    if (!fontMetrics) {
      throw new Error(`No FontMetrics found for ${fontProperties.key}`);
    }

    const { atlasImage, atlasPositioning } =
      TightAtlasReconstructor.reconstructFromAtlas(
        fontMetrics,
        atlasCanvas
      );

    return new AtlasData(atlasImage, atlasPositioning);
  }

}
