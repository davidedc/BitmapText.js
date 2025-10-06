// AtlasBuilder - Build-Time Utility
//
// This utility class builds atlases from individual glyph canvases.
// Atlases use each character's actualBoundingBox width and the font's
// fontBoundingBox height, creating variable-width cells at a constant height.
//
// DISTRIBUTION ROLE:
// - Used by font-assets-builder.html to generate atlas source for reconstruction
// - Used for building atlases that will be reconstructed at runtime into tight atlases
// - NOT part of runtime distribution (only needed during font generation)
//
// ARCHITECTURE:
// - Takes individual glyph.canvas (NOT glyph.tightCanvas) from GlyphFAB
// - Packs them horizontally in SORTED character order (critical for determinism)
// - Returns canvas with cell dimension metadata for reconstruction
//
// CRITICAL REQUIREMENTS:
// - MUST use sorted character order (same as TightAtlasReconstructor)
// - MUST use glyph.canvas (standard cells), NOT glyph.tightCanvas
// - Cell widths MUST match character metrics exactly
// - Cell height MUST be constant across all characters in font
//
class AtlasBuilder {
  // Private constructor - prevent instantiation following Effective Java patterns
  constructor() {
    throw new Error('AtlasBuilder cannot be instantiated - use static methods');
  }

  /**
   * Build atlas from glyphs (variable-width cells format)
   *
   * PARAMETER ORDER: Standardized to (fontMetrics, data) for API consistency
   *
   * @param {FontMetrics} fontMetrics - Font metrics for dimensions
   * @param {Object} glyphs - Map of char → GlyphFAB instances
   * @returns {{canvas, cellWidths, cellHeight, characters, totalWidth}}
   */
  static buildAtlas(fontMetrics, glyphs) {
    // ⚠️ CRITICAL: Use SORTED characters for determinism
    // JavaScript object iteration order is not guaranteed to be stable across
    // build and runtime environments. Explicit sorting ensures consistency.
    const characters = Object.keys(glyphs).sort();

    if (characters.length === 0) {
      throw new Error('AtlasBuilder: No glyphs provided for atlas building');
    }

    // Get first character's metrics for cell height calculation
    // Cell height is CONSTANT across all characters in this font
    const firstChar = characters[0];
    const firstMetrics = fontMetrics.getCharacterMetrics(firstChar);

    if (!firstMetrics) {
      throw new Error(`AtlasBuilder: No metrics found for character '${firstChar}'`);
    }

    const cellHeight = AtlasCellDimensions.getHeight(firstMetrics);

    // Calculate cell widths (VARIABLE per character) and total atlas width
    const cellWidths = {};
    let totalWidth = 0;

    for (const char of characters) {
      const metrics = fontMetrics.getCharacterMetrics(char);

      if (!metrics) {
        console.warn(`AtlasBuilder: No metrics found for character '${char}', skipping`);
        continue;
      }

      // Cell width = actualBoundingBoxLeft + actualBoundingBoxRight
      // This matches the character canvas dimensions from GlyphFAB.js:153-156
      const cellWidth = AtlasCellDimensions.getWidth(metrics);

      cellWidths[char] = cellWidth;
      totalWidth += cellWidth;
    }

    // Create canvas for atlas (variable-width cells)
    const canvas = document.createElement('canvas');
    canvas.width = totalWidth;
    canvas.height = cellHeight;
    const ctx = canvas.getContext('2d');

    // Draw each glyph's character canvas (NOT tight!) in sequence
    let x = 0;
    for (const char of characters) {
      const glyph = glyphs[char];

      // ⚠️ CRITICAL: Use glyph.canvas (standard cells), NOT glyph.tightCanvas
      // glyph.canvas contains the character at its original position within
      // the actualBoundingBox × fontBoundingBox rectangle
      if (glyph && glyph.canvas) {
        // If canvas has invalid dimensions (0x0), use canvasCopy instead
        const hasInvalidDimensions = glyph.canvas.width === 0 || glyph.canvas.height === 0;
        const hasCanvasCopy = !!glyph.canvasCopy;

        if (hasInvalidDimensions && !hasCanvasCopy) {
          // Skip drawing entirely - cannot draw a 0x0 canvas
          // This prevents InvalidStateError from attempting to draw invalid canvas
          console.error(`AtlasBuilder: Character '${char}' has invalid canvas (${glyph.canvas.width}x${glyph.canvas.height}) and no canvasCopy! Skipping draw.`);
          console.error('Glyph object:', glyph);
        } else if (hasInvalidDimensions && hasCanvasCopy) {
          // Use the preserved canvas copy
          ctx.drawImage(glyph.canvasCopy, x, 0);
        } else {
          // Normal case: use the standard glyph.canvas
          ctx.drawImage(glyph.canvas, x, 0);
        }
      } else {
        console.warn(`AtlasBuilder: Character '${char}' has no character canvas`);
      }

      x += cellWidths[char];
    }

    console.debug(`AtlasBuilder: Built atlas ${totalWidth}×${cellHeight} with ${characters.length} characters`);

    return {
      canvas,           // Atlas canvas
      cellWidths,       // Width of each character's cell (variable)
      cellHeight,       // Height of all cells (constant)
      characters,       // Sorted character list (for debugging)
      totalWidth        // Total atlas width (sum of all cell widths)
    };
  }
}
