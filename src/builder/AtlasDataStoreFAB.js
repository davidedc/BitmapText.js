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
   * Filters glyphs based on custom character sets if defined for the font family.
   *
   * @param {FontProperties} fontProperties - Font configuration
   * @returns {Object} Map of char → GlyphFAB
   */
  static getGlyphsForFont(fontProperties) {
    const glyphs = {};

    // Check if this font family has a custom display character set
    const customCharSet = CharacterSetRegistry.getDisplayCharacterSet(fontProperties.fontFamily);

    console.log(`🔍 getGlyphsForFont DEBUG for ${fontProperties.fontFamily}:`);
    console.log(`  - fontProperties.key: ${fontProperties.key}`);
    console.log(`  - customCharSet:`, customCharSet);
    console.log(`  - Total glyphs in store: ${AtlasDataStoreFAB.#glyphs.size}`);

    let matchingKeyCount = 0;
    let includedCount = 0;
    let skippedCount = 0;

    for (const [glyphKey, glyph] of AtlasDataStoreFAB.#glyphs) {
      if (glyphKey.startsWith(fontProperties.key + ':')) {
        matchingKeyCount++;
        const char = glyphKey.substring(fontProperties.key.length + 1);

        // If custom character set exists, only include characters from that set
        if (customCharSet) {
          if (customCharSet.includes(char)) {
            glyphs[char] = glyph;
            includedCount++;
            if (includedCount <= 5) {
              console.log(`  ✓ Including char: "${char}" (U+${char.charCodeAt(0).toString(16).toUpperCase()})`);
            }
          } else {
            skippedCount++;
            if (skippedCount <= 5) {
              console.log(`  ✗ Skipping char: "${char}" (U+${char.charCodeAt(0).toString(16).toUpperCase()})`);
            }
          }
          // Skip characters not in the custom set
        } else {
          // No custom set - include all characters (standard behavior)
          glyphs[char] = glyph;
          includedCount++;
        }
      }
    }

    console.log(`  - Glyphs matching font key: ${matchingKeyCount}`);
    console.log(`  - Glyphs included: ${includedCount}`);
    console.log(`  - Glyphs skipped: ${skippedCount}`);
    console.log(`  - Final glyphs object size: ${Object.keys(glyphs).length}`);

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
