// AtlasStoreFAB - Font Assets Building Class for Atlas Images
// 
// This class extends AtlasStore to provide font assets building capabilities
// for atlas image generation and management.
//
// DISTRIBUTION ROLE:
// - Part of "full toolkit" distribution for font assets building applications
// - Extends AtlasStore with atlas building, optimization, and generation features
// - Works in conjunction with FontMetricsStoreFAB for complete font assets building
// - Provides extraction methods to create clean runtime AtlasStore instances
//
// ARCHITECTURE:
// - Inherits atlas storage functionality from AtlasStore
// - Adds glyph storage and atlas building pipeline
// - Focuses solely on image atlas generation (metrics handled by FontMetricsStoreFAB)
// - Integrates with FontMetricsStoreFAB during the building process
//
// SEPARATION OF CONCERNS:
// - AtlasStoreFAB: Handles atlas image building from individual glyphs
// - FontMetricsStoreFAB: Handles metrics calculation and positioning data
// - Both work together during font assets building but can be used independently
class AtlasStoreFAB extends AtlasStore {
  constructor() {
    super();
    // FAB-specific glyph storage using Map for O(1) lookups
    // Key format: fontProperties.key + ":" + letter
    this.glyphs = new Map();
  }

  // Extract a clean AtlasStore instance for runtime distribution
  // This removes FAB-specific functionality and provides only runtime atlas data
  extractAtlasStoreInstance() {
    const instance = new AtlasStore();
    instance.atlases = this.atlases;
    return instance;
  }



  addGlyph(glyph) {
    const glyphKey = `${glyph.fontProperties.key}:${glyph.letter}`;
    this.glyphs.set(glyphKey, glyph);
  }

  getGlyph(fontProperties, letter) {
    const glyphKey = `${fontProperties.key}:${letter}`;
    return this.glyphs.get(glyphKey);
  }

  // Build an atlas image from individual glyphs for a specific font configuration
  // 1. Find all glyphs for the font configuration
  // 2. Calculate atlas dimensions from glyph tight bounds
  // 3. Create canvas and draw all glyphs horizontally
  // 4. Store atlas and return image data
  // 
  // NOTE: This method focuses solely on atlas image generation.
  // Font metrics calculation is handled by FontMetricsStoreFAB.calculateAndSetFontMetrics()
  buildAtlas(fontProperties, fontMetricsStore) {
    // Find all glyphs for this font configuration
    const glyphs = {};
    for (const [glyphKey, glyph] of this.glyphs) {
      if (glyphKey.startsWith(fontProperties.key + ':')) {
        const letter = glyphKey.substring(fontProperties.key.length + 1);
        glyphs[letter] = glyph;
      }
    }
    
    if (Object.keys(glyphs).length === 0) return null;

    // First, have the FontMetricsStoreFAB calculate all the font metrics
    // This populates tightWidth, tightHeight, dx, dy in the fontMetricsStore
    fontMetricsStore.calculateAndSetFontMetrics(fontProperties, glyphs);

    // Get FontMetrics instance once for this font
    const fontMetrics = fontMetricsStore.getFontMetrics(fontProperties);
    if (!fontMetrics) {
      throw new Error(`No font metrics found for: ${fontProperties.key}`);
    }

    // Calculate atlas dimensions using the metrics from FontMetrics instance
    let fittingWidth = 0;
    let maxHeight = 0;

    for (let letter in glyphs) {
      const metrics = fontMetrics.getGlyphMetrics(letter);
      const tightWidth = metrics.tightWidth;
      const tightHeight = metrics.tightHeight;
      
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
    for (let letter in glyphs) {
      let glyph = glyphs[letter];
      const metrics = fontMetrics.getGlyphMetrics(letter);
      const tightWidth = metrics.tightWidth;
      
      // Skip glyphs without valid tight canvas or width
      if (!glyph.tightCanvas || !tightWidth || isNaN(tightWidth)) {
        if (!tightWidth) {
          console.warn(`glyph ${fontProperties.fontStyle} ${fontProperties.fontWeight} ${fontProperties.fontFamily} ${fontProperties.fontSize} ${letter} has no tightWidth`);
        }
        if (!glyph.tightCanvas) {
          console.warn(`glyph ${fontProperties.fontStyle} ${fontProperties.fontWeight} ${fontProperties.fontFamily} ${fontProperties.fontSize} ${letter} has no tightCanvas`);
        }
        continue;
      }
      
      // Draw the glyph at the current x position
      ctx.drawImage(glyph.tightCanvas, x, 0);

      // Record the x position in the atlas for this glyph
      fontMetricsStore.setGlyphPositionInAtlas(fontProperties, letter, x);

      // Advance x position for next glyph
      x += tightWidth;
    }

    // Store the completed atlas
    this.setAtlas(fontProperties, canvas);

    // Create PNG export for saving
    const atlasPNG = ctx.toPNGImage();
    
    // NOTE: The canvas can be used immediately for setAtlas, but the PNG image
    // needs processing time before it can be used for rendering. Return both
    // for different use cases.
    return [atlasPNG, ctx];
  }

}
