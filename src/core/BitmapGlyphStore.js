// A class to store all the glyph sheets and kerning tables
// and the minimal set of info necessary to draw text.
class BitmapGlyphStore {
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
    this.glyphSheets = {}; // [pixelDensity, fontFamily, fontStyle, fontWeight, fontSize]
    this.glyphSheetsMetrics = {
      // All objects indexed on [pixelDensity, fontFamily, fontStyle, fontWeight, fontSize, letter]
      tightWidth: {},
      tightHeight: {},
      dx: {},
      dy: {},
      xInGlyphSheet: {}
    };
  }

  // method that de-structure a fontProperties object
  // into an array [pixelDensity, fontFamily, fontStyle, fontWeight, fontSize]
  getFontPropertiesArray(fontProperties) {
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
    return getNestedProperty(this.kerningTables, this.getFontPropertiesArray(fontProperties)) || {};
  }

  setKerningTable(fontProperties, kerningTable) {
    setNestedProperty(this.kerningTables,this.getFontPropertiesArray(fontProperties), kerningTable);
  }
  
  getGlyphSheet(fontProperties) {
    return getNestedProperty(this.glyphSheets,this.getFontPropertiesArray(fontProperties));
  }

  setGlyphSheet(fontProperties, glyphSheet) {
    setNestedProperty(this.glyphSheets,this.getFontPropertiesArray(fontProperties), glyphSheet);
  }

  // return an object with xInGlyphSheet, tightWidth, tightHeight, dx, dy
  getGlyphSheetMetrics(fontProperties, letter) {
    const address = this.getFontPropertiesArray(fontProperties).concat(letter);
    const glyphSheetsMetrics = this.glyphSheetsMetrics;
    return {
      xInGlyphSheet: getNestedProperty(glyphSheetsMetrics.xInGlyphSheet, address),
      tightWidth: getNestedProperty(glyphSheetsMetrics.tightWidth, address),
      tightHeight: getNestedProperty(glyphSheetsMetrics.tightHeight, address),
      dx: getNestedProperty(glyphSheetsMetrics.dx, address),
      dy: getNestedProperty(glyphSheetsMetrics.dy, address)
    };
  }

  setGlyphSheetMetrics(fontProperties, metrics) {
    const glyphSheetsMetrics = this.glyphSheetsMetrics;
    for (const metricKey in metrics) {
      setNestedProperty(glyphSheetsMetrics[metricKey],this.getFontPropertiesArray(fontProperties), metrics[metricKey]);
    }
  }

  getGlyphsTextMetrics(fontProperties, letter) {
    return getNestedProperty(this.glyphsTextMetrics, this.getFontPropertiesArray(fontProperties).concat(letter));
  }

  setGlyphsTextMetrics(fontProperties, metrics) {
    setNestedProperty(this.glyphsTextMetrics,this.getFontPropertiesArray(fontProperties), metrics);
  }

  setGlyphTextMetrics(fontProperties, letter, metrics) {
    setNestedProperty(this.glyphsTextMetrics, this.getFontPropertiesArray(fontProperties).concat(letter), metrics);
  }

  getSpaceAdvancementOverrideForSmallSizesInPx(fontProperties) {
    return getNestedProperty(this.spaceAdvancementOverrideForSmallSizesInPx, this.getFontPropertiesArray(fontProperties));
  }

  setSpaceAdvancementOverrideForSmallSizesInPx(fontProperties, spaceAdvancementOverrideForSmallSizesInPx) {
    setNestedProperty(this.spaceAdvancementOverrideForSmallSizesInPx, this.getFontPropertiesArray(fontProperties), spaceAdvancementOverrideForSmallSizesInPx);
  }

  // Helper method to check if a glyph sheet is valid for rendering
  isValidGlyphSheet(glyphSheet) {
    return glyphSheet && typeof glyphSheet === 'object' && glyphSheet.width > 0;
  }

}
