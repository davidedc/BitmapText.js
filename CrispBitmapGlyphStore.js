// a class to store all the glyphs sheets and kerning tables
// and the minimal set of info necessary to draw text.
class CrispBitmapGlyphStore {
  constructor() {    
    // only use these three "compact" data structures in the measuring and drawing methods
    // "compact" means that they are the final data structures that are used to measure
    // text and draw the glyphs/text. (As opposed to the other data structures that contain
    // all kinds of other intermediate data useful for construction/inspection)

    // these three needed to measure text and place each glyph one after the other with the correct advancement
    this.kerningTables = {}; // [pixelDensity,fontFamily, fontStyle, fontWeight, fontSize]    
    this.glyphsTextMetrics = {}; // [pixelDensity, fontFamily, fontStyle, fontWeight, fontSize, letter]
    this.spaceAdvancementOverrideForSmallSizesInPx = {}; // [pixelDensity, fontFamily, fontStyle, fontWeight, fontSize]
    // these two needed to precisely paint a glyph from the sheet into the destination canvas
    this.glyphsSheets = {}; // [pixelDensity, fontFamily, fontStyle, fontWeight, fontSize]
    this.glyphsSheetsMetrics = { // all objects indexed on [pixelDensity, fontFamily, fontStyle, fontWeight, fontSize, letter]
      tightWidth: {},
      tightHeight: {},
      dx: {},
      dy: {},
      xInGlyphSheet: {}
    };
  }
}
