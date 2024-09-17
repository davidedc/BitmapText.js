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

  // method that de-structure a fontProperties object
  // into an array [fontFamily, fontStyle, fontWeight, fontSize]
  destructureFontPropsFamily2Size(fontProperties) {
    const {
      fontFamily,
      fontStyle,
      fontWeight,
      fontSize
    } = fontProperties;
    return [fontFamily, fontStyle, fontWeight, fontSize];
  }


  // method that de-structure a fontProperties object
  // into an array [pixelDensity, fontFamily, fontStyle, fontWeight, fontSize]
  destructureFontPropsDensity2Size(fontProperties) {
    const {
      pixelDensity,
      fontFamily,
      fontStyle,
      fontWeight,
      fontSize
    } = fontProperties;
    return [pixelDensity, fontFamily, fontStyle, fontWeight, fontSize];
  }

  getKerningTable(fontProperties) {
    ensureNestedPropertiesExist(this.kerningTables, this.destructureFontPropsDensity2Size(fontProperties));
    return getNestedProperty(this.kerningTables, this.destructureFontPropsDensity2Size(fontProperties));
  }

  setKerningTable(fontProperties, kerningTable) {
    setNestedProperty(this.kerningTables,this.destructureFontPropsDensity2Size(fontProperties), kerningTable);
  }
  
  getGlyphsSheet(fontProperties) {
    ensureNestedPropertiesExist(this.glyphsSheets,this.destructureFontPropsDensity2Size(fontProperties));
    return getNestedProperty(this.glyphsSheets,this.destructureFontPropsDensity2Size(fontProperties));
  }

  setGlyphsSheet(fontProperties, glyphsSheet) {
    setNestedProperty(this.glyphsSheets,this.destructureFontPropsDensity2Size(fontProperties), glyphsSheet);
  }

  // return an object with xInGlyphSheet, tightWidth, tightHeight, dx, dy
  getGlyphsSheetMetrics(fontProperties, letter) {
    const address = this.destructureFontPropsDensity2Size(fontProperties).concat(letter);
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
    const glyphsSheetsMetrics = this.glyphsSheetsMetrics;
    for (const metricKey in metrics) {
      setNestedProperty(glyphsSheetsMetrics[metricKey],this.destructureFontPropsDensity2Size(fontProperties), metrics[metricKey]);
    }
  }

  getGlyphsTextMetrics(fontProperties, letter) {
    return getNestedProperty(this.glyphsTextMetrics, this.destructureFontPropsDensity2Size(fontProperties).concat(letter));
  }

  setGlyphsTextMetrics(fontProperties, metrics) {
    setNestedProperty(this.glyphsTextMetrics,this.destructureFontPropsDensity2Size(fontProperties), metrics);
  }

  setGlyphTextMetrics(fontProperties, letter, metrics) {
    setNestedProperty(this.glyphsTextMetrics, this.destructureFontPropsDensity2Size(fontProperties).concat(letter), metrics);
  }

  getSpaceAdvancementOverrideForSmallSizesInPx(fontProperties) {
    return getNestedProperty(this.spaceAdvancementOverrideForSmallSizesInPx, this.destructureFontPropsDensity2Size(fontProperties));
  }

  setSpaceAdvancementOverrideForSmallSizesInPx(fontProperties, spaceAdvancementOverrideForSmallSizesInPx) {
    setNestedProperty(this.spaceAdvancementOverrideForSmallSizesInPx, this.destructureFontPropsDensity2Size(fontProperties), spaceAdvancementOverrideForSmallSizesInPx);
  }

}
