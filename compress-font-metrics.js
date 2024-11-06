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
    compressedGlyphs[char] = [
      glyph.width, // TODO to check if BEFORE COMPRESSING rounding to two decimal places also works i.e. toFixed(2)
      glyph.actualBoundingBoxLeft, // TODO to check if BEFORE COMPRESSING rounding to two decimal places also works i.e. toFixed(2)
      glyph.actualBoundingBoxRight, // TODO to check if BEFORE COMPRESSING rounding to two decimal places also works i.e. toFixed(2)
      glyph.actualBoundingBoxAscent, // TODO to check if BEFORE COMPRESSING rounding to two decimal places also works i.e. toFixed(2)
      glyph.actualBoundingBoxDescent // TODO to check if BEFORE COMPRESSING rounding to two decimal places also works i.e. toFixed(2)
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
