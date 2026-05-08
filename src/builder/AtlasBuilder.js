// AtlasBuilder - Build-Time Utility
//
// Packs per-glyph tight canvases into a tight atlas in sorted-character order.
// Single-row when total width fits under MAX_ROW_WIDTH; wraps to multiple rows
// otherwise (large density-2 sizes — e.g. italic-bold size 90+ — can produce
// total widths >16K, exceeding cwebp's 16383px hard limit).
//
// DISTRIBUTION ROLE:
// - Used by the build pipeline (font-assets-builder.html, automated-font-builder.js)
// - NOT part of runtime distribution (runtime consumes the pre-packed tight atlas)
//
// ARCHITECTURE:
// - Takes glyph.tightCanvas from GlyphFAB (already cropped to non-transparent pixels)
// - Greedy row-pack in SORTED character order (critical for determinism)
// - Returns canvas + per-character tight widths/heights/yInAtlas for AtlasPositioningFAB
//
// CRITICAL REQUIREMENTS:
// - MUST use sorted character order (matches AtlasPositioningFAB and the runtime
//   PositioningBundleStore — char index is the bundle array index)
// - MUST use glyph.tightCanvas (already cropped)
// - Each row uses uniform height (maxHeight across all glyphs in the font),
//   so the runtime can recover xInAtlas from cumsum-within-row.
//
class AtlasBuilder {
  // Private constructor - prevent instantiation following Effective Java patterns
  constructor() {
    throw new Error('AtlasBuilder cannot be instantiated - use static methods');
  }

  // Wrap target. cwebp's hard limit is 16383px; we leave a margin for jitter
  // in the cumulative-width calc (rounded glyph widths can sum unpredictably).
  static MAX_ROW_WIDTH_PHYS_PX = 14000;

  /**
   * Build a tight atlas from glyphs. Single-row when it fits; multi-row otherwise.
   *
   * @param {FontMetrics} fontMetrics - Font metrics (kept for API symmetry; not used in tight layout)
   * @param {Object} glyphs - Map of char → GlyphFAB instances. Each glyph.tightCanvas
   *                          is the already-cropped per-glyph image at physical pixels.
   * @returns {{canvas, characters, tightWidths, tightHeights, yInAtlas, totalWidth, totalHeight, rowCount}}
   */
  static buildAtlas(fontMetrics, glyphs) {
    // Sorted characters: deterministic across builds, matches AtlasPositioningFAB
    // and PositioningBundleStore. The character index in this array IS the index
    // used to look up tight bounds in the positioning bundle.
    const characters = Object.keys(glyphs).sort();

    if (characters.length === 0) {
      throw new Error('AtlasBuilder: No glyphs provided for atlas building');
    }

    // Per-character tight dimensions, sized from each glyph's tight canvas.
    const tightWidths_PhysPx = {};
    const tightHeights_PhysPx = {};
    let maxHeight_PhysPx = 0;
    const cellDebugInfo = [];

    for (const char of characters) {
      const glyph = glyphs[char];
      if (!glyph) {
        console.warn(`AtlasBuilder: No glyph found for character '${char}', skipping`);
        tightWidths_PhysPx[char] = 0;
        tightHeights_PhysPx[char] = 0;
        continue;
      }

      const tight = glyph.tightCanvas;
      if (!tight || tight.width === 0 || tight.height === 0) {
        // Glyph has no visible pixels (e.g. space). Nothing to pack — record
        // 0×0 so the positioning bundle stays in lockstep with the character set.
        tightWidths_PhysPx[char] = 0;
        tightHeights_PhysPx[char] = 0;
        continue;
      }

      tightWidths_PhysPx[char] = tight.width;
      tightHeights_PhysPx[char] = tight.height;
      if (tight.height > maxHeight_PhysPx) maxHeight_PhysPx = tight.height;

      if (cellDebugInfo.length < 5) {
        cellDebugInfo.push(`${char}:w=${tight.width},h=${tight.height}`);
      }
    }

    if (maxHeight_PhysPx === 0) {
      throw new Error('AtlasBuilder: All glyphs are empty — nothing to pack');
    }

    // Greedy row-pack: assign each glyph to the current row; start a new row
    // when the running width would exceed MAX_ROW_WIDTH. Rows have uniform
    // height so xInAtlas can be recovered at runtime from cumsum-within-row.
    const yInAtlas_PhysPx = {};
    const rowWidths = []; // sum of tightWidths per row
    let curRowWidth = 0;
    let curY = 0;

    for (const char of characters) {
      const w = tightWidths_PhysPx[char];
      // Wrap if adding this glyph would exceed the row budget. Empty glyphs
      // (w=0) never trigger a wrap by themselves.
      if (w > 0 && curRowWidth + w > AtlasBuilder.MAX_ROW_WIDTH_PHYS_PX && curRowWidth > 0) {
        rowWidths.push(curRowWidth);
        curRowWidth = 0;
        curY += maxHeight_PhysPx;
      }
      yInAtlas_PhysPx[char] = curY;
      curRowWidth += w;
    }
    rowWidths.push(curRowWidth); // close the last row

    const rowCount = rowWidths.length;
    const atlasWidth_PhysPx = Math.max(...rowWidths);
    const atlasHeight_PhysPx = rowCount * maxHeight_PhysPx;

    console.debug(
      `🔍 AtlasBuilder: Built tight cells (first 5): ${cellDebugInfo.join(', ')}; ` +
      `${rowCount} row(s), atlas ${atlasWidth_PhysPx}×${atlasHeight_PhysPx}`
    );

    const canvas = document.createElement('canvas');
    canvas.width = atlasWidth_PhysPx;
    canvas.height = atlasHeight_PhysPx;
    const ctx = canvas.getContext('2d');

    // Pack: walk characters in order, drop each at (xCursor, yInAtlas[char]).
    // xCursor resets when y advances (new row).
    let xCursor = 0;
    let prevY = 0;
    for (const char of characters) {
      const y = yInAtlas_PhysPx[char];
      if (y !== prevY) { xCursor = 0; prevY = y; }
      const glyph = glyphs[char];
      const tight = glyph && glyph.tightCanvas;
      if (tight && tight.width > 0 && tight.height > 0) {
        ctx.drawImage(tight, xCursor, y);
      }
      xCursor += tightWidths_PhysPx[char];
    }

    console.debug(
      `AtlasBuilder: Built tight atlas ${atlasWidth_PhysPx}×${atlasHeight_PhysPx} ` +
      `(${characters.length} characters, ${rowCount} row${rowCount === 1 ? '' : 's'})`
    );

    return {
      canvas,                                      // Tight atlas canvas
      characters,                                  // Sorted character list (determines bundle order)
      tightWidths: tightWidths_PhysPx,             // char → tight width (physical pixels)
      tightHeights: tightHeights_PhysPx,           // char → tight height (physical pixels)
      yInAtlas: yInAtlas_PhysPx,                   // char → row top y (physical pixels)
      totalWidth: atlasWidth_PhysPx,               // Atlas width (max row width)
      totalHeight: atlasHeight_PhysPx,             // Atlas height (rowCount × maxHeight)
      rowCount                                     // Number of rows used
    };
  }
}
