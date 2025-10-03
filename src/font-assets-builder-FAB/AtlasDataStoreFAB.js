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

  // Build an atlas image from individual canvases for a specific font configuration
  // 1. Find all glyphs for the font configuration
  // 2. Calculate atlas positioning data using AtlasPositioningFAB
  // 3. Calculate atlas dimensions from glyph tight bounds
  // 4. Create canvas and draw all glyphs horizontally
  // 5. Store atlas and return image data
  //
  // NOTE: This method now creates and manages AtlasPositioningFAB directly for clean separation.
  // Font metrics are still available from fontMetricsStore but only for character measurements.
  buildAtlas(fontProperties, fontMetricsStore) {
    // Find all glyphs for this font configuration
    const glyphs = {};
    for (const [glyphKey, glyph] of this.glyphs) {
      if (glyphKey.startsWith(fontProperties.key + ':')) {
        const char = glyphKey.substring(fontProperties.key.length + 1);
        glyphs[char] = glyph;
      }
    }

    if (Object.keys(glyphs).length === 0) return null;

    // Create AtlasPositioningFAB instance to handle positioning calculations
    if (typeof AtlasPositioningFAB === 'undefined') {
      throw new Error(`AtlasPositioningFAB class required for atlas building - not available for ${fontProperties.key}`);
    }
    const atlasPositioningFAB = new AtlasPositioningFAB();

    // Calculate positioning data from glyph bounds and font metrics
    atlasPositioningFAB.calculatePositioning(glyphs, fontProperties, fontMetricsStore);

    // Calculate atlas dimensions using positioning data
    let fittingWidth = 0;
    let maxHeight = 0;

    // ⚠️ CRITICAL FIX: Use sorted character order for determinism
    // JavaScript for...in iteration order is not guaranteed to be stable
    const sortedChars = Object.keys(glyphs).sort();

    for (const char of sortedChars) {
      const glyph = glyphs[char];

      // Only include dimensions for glyphs that will actually be drawn
      // Skip glyphs without tightCanvas (like space) to match drawing logic
      if (!glyph.tightCanvas) {
        continue;
      }

      const tightWidth = atlasPositioningFAB.getTightWidth(char);
      const tightHeight = atlasPositioningFAB.getTightHeight(char);

      if (tightWidth && !isNaN(tightWidth)) {
        fittingWidth += tightWidth;
      }
      if (tightHeight && tightHeight > maxHeight) {
        maxHeight = tightHeight;
      }
    }

    // Create atlas canvas
    const canvas = document.createElement("canvas");
    canvas.width = fittingWidth;
    canvas.height = maxHeight;
    const ctx = canvas.getContext("2d");
    let x = 0;

    // Draw each glyph into the atlas and record xInAtlas position
    for (const char of sortedChars) {
      let glyph = glyphs[char];
      const tightWidth = atlasPositioningFAB.getTightWidth(char);

      // Skip glyphs without valid tight canvas or width
      if (!glyph.tightCanvas || !tightWidth || isNaN(tightWidth)) {
        if (!tightWidth) {
          console.warn(`glyph ${fontProperties.fontStyle} ${fontProperties.fontWeight} ${fontProperties.fontFamily} ${fontProperties.fontSize} ${char} has no tightWidth`);
        }
        if (!glyph.tightCanvas) {
          console.warn(`glyph ${fontProperties.fontStyle} ${fontProperties.fontWeight} ${fontProperties.fontFamily} ${fontProperties.fontSize} ${char} has no tightCanvas`);
        }
        continue;
      }

      // Draw the glyph at the current x position
      ctx.drawImage(glyph.tightCanvas, x, 0);

      // Record the x position in the atlas using AtlasPositioningFAB
      atlasPositioningFAB.setGlyphPositionInAtlas(char, x);

      // Advance x position for next glyph
      x += tightWidth;
    }

    // Extract clean AtlasPositioning instance
    const atlasPositioning = atlasPositioningFAB.extractAtlasPositioningInstance();

    // Create AtlasImageFAB instance from the generated canvas
    if (typeof AtlasImageFAB === 'undefined') {
      throw new Error(`AtlasImageFAB class required for atlas building - not available for ${fontProperties.key}`);
    }
    const atlasImageFAB = AtlasImageFAB.createFromCanvas(canvas);

    // Create AtlasData object combining AtlasImageFAB and AtlasPositioning
    if (typeof AtlasData === 'undefined') {
      throw new Error(`AtlasData class required for atlas building - not available for ${fontProperties.key}`);
    }
    const atlasData = new AtlasData(atlasImageFAB, atlasPositioning);
    this.setAtlasData(fontProperties, atlasData);

    // Return only the AtlasImageFAB instance
    return atlasImageFAB;
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
   * Build original-bounds atlas for validation/export (NEW METHOD for Phase 0)
   * Uses glyph.canvas (original bounds) instead of glyph.tightCanvas
   *
   * @param {FontProperties} fontProperties - Font configuration
   * @param {FontMetricsStore} fontMetricsStore - Font metrics store
   * @returns {{canvas, cellWidths, cellHeight, characters, totalWidth}}
   */
  buildOriginalAtlas(fontProperties, fontMetricsStore) {
    const glyphs = this.getGlyphsForFont(fontProperties);
    const fontMetrics = fontMetricsStore.getFontMetrics(fontProperties);

    if (!fontMetrics) {
      throw new Error(`No FontMetrics found for ${fontProperties.key}`);
    }

    return OriginalAtlasBuilder.buildOriginalAtlas(glyphs, fontMetrics);
  }

  /**
   * Build tight atlas from original-bounds atlas (NEW METHOD for Phase 0 validation)
   * Reconstructs tight atlas by scanning original-bounds atlas pixels
   *
   * @param {Canvas|Image} originalAtlasCanvas - Original-bounds atlas image
   * @param {FontProperties} fontProperties - Font configuration
   * @param {FontMetricsStore} fontMetricsStore - Font metrics store
   * @returns {AtlasData} AtlasData containing reconstructed tight atlas and positioning
   */
  buildTightAtlasFromOriginal(originalAtlasCanvas, fontProperties, fontMetricsStore) {
    const fontMetrics = fontMetricsStore.getFontMetrics(fontProperties);

    if (!fontMetrics) {
      throw new Error(`No FontMetrics found for ${fontProperties.key}`);
    }

    const { atlasImage, atlasPositioning } =
      TightAtlasReconstructor.reconstructFromOriginalAtlas(
        originalAtlasCanvas,
        fontMetrics,
        () => document.createElement('canvas')
      );

    return new AtlasData(atlasImage, atlasPositioning);
  }

}
