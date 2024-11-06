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

  // Compress kerning table directly
  const compressedKerning = {};
  Object.entries(metrics.kerningTable).forEach(([char, values]) => {
    compressedKerning[char] = values;
  });

  // Compress glyph metrics into arrays with exact values
  const compressedGlyphs = {};
  Object.entries(metrics.glyphsTextMetrics).forEach(([char, glyph]) => {
    // TODO to check if in all the glyph.* fields below BEFORE COMPRESSING rounding to
    // two decimal places also gives a good result (i.e. toFixed(2))
    // because we are storing a lot of decimal places here! and when I tried
    // a toFixed(2) we still got a hash match on the generated rendered text image
    // so probably 2 decumal places is enough and it would make things more compact.
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
