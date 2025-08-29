// Compress font metrics data into a more compact format
function compressFontMetrics(data) {
  const metrics = data;
  
  // Extract base metrics that are common across most glyphs
  // Use the first available character to get base metrics
  const firstChar = Object.keys(metrics.glyphsTextMetrics)[0];
  const firstGlyph = metrics.glyphsTextMetrics[firstChar];
  
  const baseMetrics = {
    fba: firstGlyph.fontBoundingBoxAscent,
    fbd: firstGlyph.fontBoundingBoxDescent,
    hb: firstGlyph.hangingBaseline,
    ab: firstGlyph.alphabeticBaseline,
    ib: firstGlyph.ideographicBaseline,
  };

  // Compress kerning table directly
  const compressedKerning = {};
  Object.entries(metrics.kerningTable).forEach(([char, values]) => {
    compressedKerning[char] = values;
  });

  // Compress glyph metrics into arrays with exact values
  const compressedGlyphs = {};
  Object.entries(metrics.glyphsTextMetrics).forEach(([char, glyph]) => {
    compressedGlyphs[char] = [
      glyph.width, 
      glyph.actualBoundingBoxLeft,
      glyph.actualBoundingBoxRight,
      glyph.actualBoundingBoxAscent,
      glyph.actualBoundingBoxDescent
    ];
  });

  // Compress tight metrics
  const compressedTight = {
    w: metrics.glyphSheetsMetrics.tightWidth,
    h: metrics.glyphSheetsMetrics.tightHeight,
    dx: metrics.glyphSheetsMetrics.dx,
    dy: metrics.glyphSheetsMetrics.dy,
    x: metrics.glyphSheetsMetrics.xInGlyphSheet
  };

  return {
    k: compressedKerning,  // kerningTable
    b: baseMetrics,        // base metrics
    g: compressedGlyphs,   // glyphs
    t: compressedTight,    // tight metrics
    s: metrics.spaceAdvancementOverrideForSmallSizesInPx
  };
}
