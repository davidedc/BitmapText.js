// Decompress font metrics back to original format
function decompressFontMetrics(compressed) {
  // Decompress kerning table
  const kerningTable = {};
  Object.entries(compressed.k).forEach(([char, values]) => {
    kerningTable[char] = values;
  });

  // Decompress glyph metrics
  const glyphsTextMetrics = {};
  Object.entries(compressed.g).forEach(([char, metrics]) => {
    glyphsTextMetrics[char] = {
      width: metrics[0],
      actualBoundingBoxLeft: metrics[1],
      actualBoundingBoxRight: metrics[2],
      actualBoundingBoxAscent: metrics[3],
      actualBoundingBoxDescent: metrics[4],
      fontBoundingBoxAscent: compressed.b.fba,
      fontBoundingBoxDescent: compressed.b.fbd,
      emHeightAscent: compressed.b.fba,
      emHeightDescent: compressed.b.fbd,
      hangingBaseline: compressed.b.hb,
      alphabeticBaseline: compressed.b.ab,
      ideographicBaseline: compressed.b.ib
    };
  });

  // Decompress tight metrics
  const glyphSheetsMetrics = {
    tightWidth: compressed.t.w,
    tightHeight: compressed.t.h,
    dx: compressed.t.dx,
    dy: compressed.t.dy,
    xInGlyphSheet: compressed.t.x
  };

  return {
    kerningTable,
    glyphsTextMetrics,
    spaceAdvancementOverrideForSmallSizesInPx: compressed.s,
    glyphSheetsMetrics
  };
}