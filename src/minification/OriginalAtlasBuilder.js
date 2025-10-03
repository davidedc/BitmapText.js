// OriginalAtlasBuilder - Build-Time Utility
//
// This utility class builds original-bounds atlases from individual glyph canvases.
// Original-bounds atlases use each character's actualBoundingBox width and the font's
// fontBoundingBox height, creating variable-width cells at a constant height.
//
// DISTRIBUTION ROLE:
// - Part of validation harness (Phase 0) in font-assets-builder.html
// - Used for building original-bounds atlases that will be reconstructed at runtime
// - NOT part of runtime distribution (only needed during font generation)
//
// ARCHITECTURE:
// - Takes individual glyph.canvas (NOT glyph.tightCanvas) from GlyphFAB
// - Packs them horizontally in SORTED character order (critical for determinism)
// - Returns canvas with cell dimension metadata for reconstruction
//
// CRITICAL REQUIREMENTS:
// - MUST use sorted character order (same as TightAtlasReconstructor)
// - MUST use glyph.canvas (original bounds), NOT glyph.tightCanvas
// - Cell widths MUST match character metrics exactly
// - Cell height MUST be constant across all characters in font

class OriginalAtlasBuilder {
  // Private constructor - prevent instantiation following Effective Java patterns
  constructor() {
    throw new Error('OriginalAtlasBuilder cannot be instantiated - use static methods');
  }

  /**
   * Build original-bounds atlas from glyphs
   * @param {Object} glyphs - Map of char → GlyphFAB instances
   * @param {FontMetrics} fontMetrics - Font metrics for dimensions
   * @returns {{canvas, cellWidths, cellHeight, characters, totalWidth}}
   */
  static buildOriginalAtlas(glyphs, fontMetrics) {
    // ⚠️ CRITICAL: Use SORTED characters for determinism
    // JavaScript object iteration order is not guaranteed to be stable across
    // build and runtime environments. Explicit sorting ensures consistency.
    const characters = Object.keys(glyphs).sort();

    if (characters.length === 0) {
      throw new Error('OriginalAtlasBuilder: No glyphs provided for atlas building');
    }

    // Get first character's metrics for cell height calculation
    // Cell height is CONSTANT across all characters in this font
    const firstChar = characters[0];
    const firstMetrics = fontMetrics.getCharacterMetrics(firstChar);

    if (!firstMetrics) {
      throw new Error(`OriginalAtlasBuilder: No metrics found for character '${firstChar}'`);
    }

    const cellHeight = Math.ceil(
      firstMetrics.fontBoundingBoxAscent +
      firstMetrics.fontBoundingBoxDescent
    );

    // Calculate cell widths (VARIABLE per character) and total atlas width
    const cellWidths = {};
    let totalWidth = 0;

    for (const char of characters) {
      const metrics = fontMetrics.getCharacterMetrics(char);

      if (!metrics) {
        console.warn(`OriginalAtlasBuilder: No metrics found for character '${char}', skipping`);
        continue;
      }

      // Cell width = actualBoundingBoxLeft + actualBoundingBoxRight
      // This matches the original canvas dimensions from GlyphFAB.js:153-156
      const cellWidth = Math.ceil(
        metrics.actualBoundingBoxLeft +
        metrics.actualBoundingBoxRight
      );

      cellWidths[char] = cellWidth;
      totalWidth += cellWidth;
    }

    // Create canvas for original-bounds atlas
    const canvas = document.createElement('canvas');
    canvas.width = totalWidth;
    canvas.height = cellHeight;
    const ctx = canvas.getContext('2d');

    // Draw each glyph's ORIGINAL canvas (NOT tight!) in sequence
    let x = 0;
    for (const char of characters) {
      const glyph = glyphs[char];

      // ⚠️ CRITICAL: Use glyph.canvas (original bounds), NOT glyph.tightCanvas
      // glyph.canvas contains the character at its original position within
      // the actualBoundingBox × fontBoundingBox rectangle
      if (glyph && glyph.canvas) {
        ctx.drawImage(glyph.canvas, x, 0);
      } else {
        console.warn(`OriginalAtlasBuilder: Character '${char}' has no original canvas`);
      }

      x += cellWidths[char];
    }

    return {
      canvas,           // Original-bounds atlas canvas
      cellWidths,       // Width of each character's cell (variable)
      cellHeight,       // Height of all cells (constant)
      characters,       // Sorted character list (for debugging)
      totalWidth        // Total atlas width (sum of all cell widths)
    };
  }
}
