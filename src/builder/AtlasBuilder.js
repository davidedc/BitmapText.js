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
   * @param {FontMetrics} fontMetrics - Font metrics for dimensions (CSS pixels)
   * @param {Object} glyphs - Map of char → GlyphFAB instances (canvases already at physical pixels)
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

    // Get first character's glyph for cell height calculation
    // Cell height is CONSTANT across all characters in this font
    // Use actual canvas.height (already at physical pixels), not CSS dimensions
    // Fall back to canvasCopy if canvas has invalid dimensions (removed from DOM)
    const firstChar = characters[0];
    const firstGlyph = glyphs[firstChar];

    if (!firstGlyph) {
      throw new Error(`AtlasBuilder: No glyph found for character '${firstChar}'`);
    }

    // Get canvas height, preferring canvasCopy if main canvas is invalid
    const firstCanvas = (firstGlyph.canvas && firstGlyph.canvas.height > 0)
      ? firstGlyph.canvas
      : firstGlyph.canvasCopy;

    if (!firstCanvas || firstCanvas.height === 0) {
      throw new Error(`AtlasBuilder: No valid canvas found for character '${firstChar}'`);
    }

    const cellHeight_PhysPx = firstCanvas.height;

    // Calculate cell widths (VARIABLE per character) and total atlas width
    // Use actual canvas.width (already at physical pixels), not CSS dimensions
    const cellWidths_PhysPx = {};
    let totalWidth_PhysPx = 0;
    const cellDebugInfo = []; // Track first 5 chars for debugging

    for (const char of characters) {
      const glyph = glyphs[char];

      if (!glyph) {
        console.warn(`AtlasBuilder: No glyph found for character '${char}', skipping`);
        continue;
      }

      // Get canvas, preferring canvasCopy if main canvas is invalid (removed from DOM)
      // This happens when glyphs are created for non-displayed font sizes
      const glyphCanvas = (glyph.canvas && glyph.canvas.width > 0)
        ? glyph.canvas
        : glyph.canvasCopy;

      if (!glyphCanvas || glyphCanvas.width === 0) {
        console.warn(`AtlasBuilder: No valid canvas found for character '${char}', skipping`);
        continue;
      }

      // Cell width = actual canvas width (already scaled to physical pixels)
      const cellWidth_PhysPx = glyphCanvas.width;

      // Debug first few characters
      if (cellDebugInfo.length < 5) {
        cellDebugInfo.push(`${char}:w=${cellWidth_PhysPx},x=${totalWidth_PhysPx}`);
      }

      cellWidths_PhysPx[char] = cellWidth_PhysPx;
      totalWidth_PhysPx += cellWidth_PhysPx;
    }

    console.debug(`🔍 AtlasBuilder: Built cells (first 5): ${cellDebugInfo.join(', ')}`);

    // Create canvas for atlas (variable-width cells)
    const canvas = document.createElement('canvas');
    canvas.width = totalWidth_PhysPx;
    canvas.height = cellHeight_PhysPx;
    const ctx = canvas.getContext('2d');

    // Draw each glyph's character canvas (NOT tight!) in sequence
    let x_PhysPx = 0;
    for (const char of characters) {
      const glyph = glyphs[char];

      if (!glyph) {
        console.warn(`AtlasBuilder: No glyph for character '${char}'`);
        continue;
      }

      // Get canvas, preferring canvasCopy if main canvas is invalid (same logic as above)
      const glyphCanvas = (glyph.canvas && glyph.canvas.width > 0)
        ? glyph.canvas
        : glyph.canvasCopy;

      if (!glyphCanvas || glyphCanvas.width === 0) {
        console.error(`AtlasBuilder: Character '${char}' has no valid canvas for drawing! Skipping.`);
        x_PhysPx += cellWidths_PhysPx[char] || 0;
        continue;
      }

      // Draw the glyph canvas to the atlas
      ctx.drawImage(glyphCanvas, x_PhysPx, 0);

      x_PhysPx += cellWidths_PhysPx[char];
    }

    console.debug(`AtlasBuilder: Built atlas ${totalWidth_PhysPx}×${cellHeight_PhysPx} with ${characters.length} characters`);

    return {
      canvas,                      // Atlas canvas
      cellWidths: cellWidths_PhysPx,   // Width of each character's cell (variable, physical pixels)
      cellHeight: cellHeight_PhysPx,   // Height of all cells (constant, physical pixels)
      characters,                  // Sorted character list (for debugging)
      totalWidth: totalWidth_PhysPx    // Total atlas width (sum of all cell widths, physical pixels)
    };
  }
}
