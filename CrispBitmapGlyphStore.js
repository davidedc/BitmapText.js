// A class to store all the glyph sheets and kerning tables
// and the minimal set of info necessary to draw text.
class CrispBitmapGlyphStore {
  constructor() {
    // Only use these three "compact" data structures in the measuring and drawing methods
    // "compact" means that they are the final data structures that are used to measure
    // text and draw the glyphs/text. (As opposed to the other data structures that contain
    // all kinds of other intermediate data useful for construction/inspection)

    // These three are needed to measure text and place each glyph one after the other with the correct advancement
    this.kerningTables = {}; // [pixelDensity, fontFamily, fontStyle, fontWeight, fontSize]
    this.glyphsTextMetrics = {}; // [pixelDensity, fontFamily, fontStyle, fontWeight, fontSize, letter]
    this.spaceAdvancementOverrideForSmallSizesInPx = {}; // [pixelDensity, fontFamily, fontStyle, fontWeight, fontSize]

    // These two are needed to precisely paint a glyph from the sheet into the destination canvas
    this.glyphsSheets = {}; // [pixelDensity, fontFamily, fontStyle, fontWeight, fontSize]
    this.glyphsSheetsMetrics = {
      // All objects indexed on [pixelDensity, fontFamily, fontStyle, fontWeight, fontSize, letter]
      tightWidth: {},
      tightHeight: {},
      dx: {},
      dy: {},
      xInGlyphSheet: {}
    };
  }

  getKerningTable(fontProperties) {
    const {
      pixelDensity = PIXEL_DENSITY,
      fontFamily,
      fontStyle,
      fontWeight,
      fontSize
    } = fontProperties;
    ensureNestedPropertiesExist(this.kerningTables, [
      pixelDensity,
      fontFamily,
      fontStyle,
      fontWeight,
      fontSize
    ]);
    return getNestedProperty(this.kerningTables, [
      pixelDensity,
      fontFamily,
      fontStyle,
      fontWeight,
      fontSize
    ]);
  }

  setKerningTable(fontProperties, kerningTable) {
    const {
      pixelDensity = PIXEL_DENSITY,
      fontFamily,
      fontStyle,
      fontWeight,
      fontSize
    } = fontProperties;
    setNestedProperty(this.kerningTables, [
      pixelDensity,
      fontFamily,
      fontStyle,
      fontWeight,
      fontSize
    ], kerningTable);
  }
  
  getGlyphsSheet(fontProperties) {
    const {
      pixelDensity = PIXEL_DENSITY,
      fontFamily,
      fontStyle,
      fontWeight,
      fontSize
    } = fontProperties;
    ensureNestedPropertiesExist(this.glyphsSheets, [
      pixelDensity,
      fontFamily,
      fontStyle,
      fontWeight,
      fontSize
    ]);
    return getNestedProperty(this.glyphsSheets, [
      pixelDensity,
      fontFamily,
      fontStyle,
      fontWeight,
      fontSize
    ]);
  }

  setGlyphsSheet(fontProperties, glyphsSheet) {
    const {
      pixelDensity = PIXEL_DENSITY,
      fontFamily,
      fontStyle,
      fontWeight,
      fontSize
    } = fontProperties;
    setNestedProperty(this.glyphsSheets, [
      pixelDensity,
      fontFamily,
      fontStyle,
      fontWeight,
      fontSize
    ], glyphsSheet);
  }

  // return an object with xInGlyphSheet, tightWidth, tightHeight, dx, dy
  getGlyphsSheetMetrics(fontProperties, letter) {
    const {
      pixelDensity = PIXEL_DENSITY,
      fontFamily,
      fontStyle,
      fontWeight,
      fontSize
    } = fontProperties;
    const address = [pixelDensity, fontFamily, fontStyle, fontWeight, fontSize, letter];
    const glyphsSheetsMetrics = this.glyphsSheetsMetrics;
    return {
      xInGlyphSheet: getNestedProperty(glyphsSheetsMetrics.xInGlyphSheet, address),
      tightWidth: getNestedProperty(glyphsSheetsMetrics.tightWidth, address),
      tightHeight: getNestedProperty(glyphsSheetsMetrics.tightHeight, address),
      dx: getNestedProperty(glyphsSheetsMetrics.dx, address),
      dy: getNestedProperty(glyphsSheetsMetrics.dy, address)
    };
  }

  setGlyphsSheetMetrics(fontProperties, metrics) {
    const {
      pixelDensity = PIXEL_DENSITY,
      fontFamily,
      fontStyle,
      fontWeight,
      fontSize
    } = fontProperties;
    const glyphsSheetsMetrics = this.glyphsSheetsMetrics;
    for (const metricKey in metrics) {
      setNestedProperty(glyphsSheetsMetrics[metricKey], [
        pixelDensity,
        fontFamily,
        fontStyle,
        fontWeight,
        fontSize
      ], metrics[metricKey]);
    }
  }

  getGlyphsTextMetrics(fontProperties, letter) {
    const {
      pixelDensity = PIXEL_DENSITY,
      fontFamily,
      fontStyle,
      fontWeight,
      fontSize
    } = fontProperties;
    return getNestedProperty(this.glyphsTextMetrics, [
      pixelDensity,
      fontFamily,
      fontStyle,
      fontWeight,
      fontSize,
      letter
    ]);
  }

  setGlyphsTextMetrics(fontProperties, metrics) {
    const {
      pixelDensity = PIXEL_DENSITY,
      fontFamily,
      fontStyle,
      fontWeight,
      fontSize
    } = fontProperties;
    setNestedProperty(this.glyphsTextMetrics, [
      pixelDensity,
      fontFamily,
      fontStyle,
      fontWeight,
      fontSize
    ], metrics);
  }

  setGlyphTextMetrics(fontProperties, letter, metrics) {
    const {
      pixelDensity = PIXEL_DENSITY,
      fontFamily,
      fontStyle,
      fontWeight,
      fontSize
    } = fontProperties;
    setNestedProperty(this.glyphsTextMetrics, [
      pixelDensity,
      fontFamily,
      fontStyle,
      fontWeight,
      fontSize,
      letter
    ], metrics);
  }

  getSpaceAdvancementOverrideForSmallSizesInPx(fontProperties) {
    const {
      pixelDensity = PIXEL_DENSITY,
      fontFamily,
      fontStyle,
      fontWeight,
      fontSize
    } = fontProperties;
    return getNestedProperty(this.spaceAdvancementOverrideForSmallSizesInPx, [
      pixelDensity,
      fontFamily,
      fontStyle,
      fontWeight,
      fontSize
    ]);
  }

  setSpaceAdvancementOverrideForSmallSizesInPx(fontProperties, spaceAdvancementOverrideForSmallSizesInPx) {
    const {
      pixelDensity = PIXEL_DENSITY,
      fontFamily,
      fontStyle,
      fontWeight,
      fontSize
    } = fontProperties;
    setNestedProperty(this.spaceAdvancementOverrideForSmallSizesInPx, [
      pixelDensity,
      fontFamily,
      fontStyle,
      fontWeight,
      fontSize
    ], spaceAdvancementOverrideForSmallSizesInPx);
  }

}
