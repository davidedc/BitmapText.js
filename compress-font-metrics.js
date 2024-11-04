// Compress font metrics data into a more compact format
function compressFontMetrics(data) {
  const metrics = data;
  
  // Extract base metrics that are common across most glyphs
  const baseMetrics = {
    fba: metrics.glyphsTextMetrics['0'].fontBoundingBoxAscent,
    fbd: metrics.glyphsTextMetrics['0'].fontBoundingBoxDescent,
    hb: metrics.glyphsTextMetrics['0'].hangingBaseline,
    ab: metrics.glyphsTextMetrics['0'].alphabeticBaseline,
    ib: metrics.glyphsTextMetrics['0'].ideographicBaseline,
  };

  // Compress kerning table by removing redundant entries
  const compressedKerning = {};
  Object.entries(metrics.kerningTable).forEach(([char, values]) => {
    // Only store non-default kerning values
    const nonDefault = {};
    Object.entries(values).forEach(([target, value]) => {
      if (value !== 20) { // 20 is the default kerning value
        nonDefault[target] = value; 
      }
    });
    if (Object.keys(nonDefault).length > 0) {
      compressedKerning[char] = nonDefault;
    }
  });

  // Compress glyph metrics into arrays
  const compressedGlyphs = {};
  Object.entries(metrics.glyphsTextMetrics).forEach(([char, glyph]) => {
    compressedGlyphs[char] = [
      Number(glyph.width.toFixed(2)),
      Number(glyph.actualBoundingBoxLeft.toFixed(2)),
      Number(glyph.actualBoundingBoxRight.toFixed(2)),
      Number(glyph.actualBoundingBoxAscent.toFixed(2)),
      Number(glyph.actualBoundingBoxDescent.toFixed(2))
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
      k: compressedKerning, // kerningTable
      b: baseMetrics,       // base metrics
      g: compressedGlyphs,  // glyphs
      t: compressedTight,   // tight metrics
      s: metrics.spaceAdvancementOverrideForSmallSizesInPx
  };
}
