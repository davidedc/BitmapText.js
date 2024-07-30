// a class to store all the crispBitmapGlyph_Fulls
// so that we can retrieve them by font family, font size and letter
class CrispBitmapGlyphStore_Full {
  constructor() {    
    // only use these three "compact" data structures in the measuring and drawing methods
    // "compact" means that they are the final data structures that are used to measure
    // text and draw the glyphs/text. (As opposed to the other data structures that contain
    // all kinds of other intermediate data useful for construction/inspection)
    this.compact_glyphsSheets = {}; // [fontFamily, fontStyle, fontWeight, fontSize]
    this.compact_kerningTables = {}; // [fontFamily, fontStyle, fontWeight, fontSize]
    this.compact_glyphs_measures = {}; // [fontFamily, fontStyle, fontWeight, fontSize, letter]
    this.compact_spaceAdvancementOverrideForSmallSizesInPx = {}; // [fontFamily, fontStyle, fontWeight, fontSize]

    // these objects instead contain all kinds of other
    // intermediate data useful for construction/inspection
    // so don't use them in the measuring and drawing methods
    this.glyphs = {};

  }

  clearKerningTables() {
    this.compact_kerningTables = {};
  }

  clearKerningTable(fontFamily, fontStyle, fontWeight, fontSize) {
    const properties = [fontFamily, fontStyle, fontWeight, fontSize];

    if (checkNestedPropertiesExist(this.compact_kerningTables, properties)) {
        setNestedProperty(this.compact_kerningTables, properties, null);
    }
  }

  addGlyph(glyph) {
    setNestedProperty(this.glyphs, [glyph.fontFamily, glyph.fontStyle, glyph.fontWeight, glyph.fontSize, glyph.letter], glyph);
    ensureNestedPropertiesExist(this.compact_glyphsSheets, [glyph.fontFamily, glyph.fontStyle, glyph.fontWeight, glyph.fontSize]);
  }

  getGlyph(fontFamily, fontSize, letter, fontStyle, fontWeight) {
    return getNestedProperty(this.glyphs, [fontFamily, fontStyle, fontWeight, fontSize, letter]);
  }

  // Get a canvas with all the glyphs of a certain font family, font size and font style
  // 1. go through all the glyphs and get the maximum width and height each so that you calculate the
  //    width and height of the rectangle needed to fit all the glyphs
  // 2. create a canvas with the width and height calculated such that a-zA-Z0-9 can fit in the canvas
  // 3. draw each glyph in the canvas
  getGlyphsSheet(fontFamily, fontSize, fontStyle, fontWeight) {
    const glyphs = getNestedProperty(this.glyphs, [fontFamily, fontStyle, fontWeight, fontSize]);
    if (!glyphs) return null;

    let fittingWidth = 0;
    let maxHeight = 0;

    for (let letter in glyphs) {
      let glyph = glyphs[letter];
      let letterMeasures = getNestedProperty(this.compact_glyphs_measures, [fontFamily, fontStyle, fontWeight, fontSize, letter]);
      // the width is calculated from the glyph.tightCanvasBox
      // example: bottomRightCorner: {x: 40, y: 71}
      // topLeftCorner: {x: 4, y: 13}

      // if the bottomRightCorner or the topLeftCorner is not defined, then the glyph is not valid
      // and just continue
      if (!glyph.tightCanvasBox?.bottomRightCorner || !glyph.tightCanvasBox?.topLeftCorner) {
        continue;
      }

      // you use 1 * PIXEL_DENSITY because it's always good to do things in increments of PIXEL_DENSITY
      // so that everything remains divisible by PIXEL_DENSITY
      const compact_tightWidth = glyph.tightCanvasBox.bottomRightCorner.x - glyph.tightCanvasBox.topLeftCorner.x + 1 * PIXEL_DENSITY;
      const compact_tightHeight = glyph.tightCanvasBox.bottomRightCorner.y - glyph.tightCanvasBox.topLeftCorner.y + 1 * PIXEL_DENSITY;

      // Note that PIXEL_DENSITY can be an integer or a fractional number.
      // In both cases, JavaScript will automatically convert the number to a string when using it as an object key.
      // For example, if PIXEL_DENSITY is 2, the key will be "2", and if it's 1.5, the key will be "1.5".
      glyph.compact_tightWidth = { [PIXEL_DENSITY]: compact_tightWidth };
      glyph.compact_tightHeight = { [PIXEL_DENSITY]: compact_tightHeight };

      glyph.compact_dx ={ [PIXEL_DENSITY]: - Math.round(letterMeasures.actualBoundingBoxLeft) * PIXEL_DENSITY + glyph.tightCanvasBox.topLeftCorner.x };
      glyph.compact_dy ={ [PIXEL_DENSITY]: - glyph.compact_tightHeight[PIXEL_DENSITY] - glyph.tightCanvas.distanceBetweenBottomAndBottomOfCanvas + 1 * PIXEL_DENSITY };

      if (!isNaN(compact_tightWidth)) fittingWidth += compact_tightWidth;
      if (compact_tightHeight > maxHeight) maxHeight = compact_tightHeight;
    }

    const canvas = document.createElement('canvas');
    canvas.width = fittingWidth;
    canvas.height = maxHeight;
    const ctx = canvas.getContext('2d');
    let x = 0;

    for (let letter in glyphs) {
      let glyph = glyphs[letter];
      // if there is no glyph.tightCanvas, then just continue
      if (!glyph.tightCanvas || !glyph.compact_tightWidth || isNaN(glyph.compact_tightWidth[PIXEL_DENSITY])) {
        if (!glyph.compact_tightWidth) {
          console.warn("glyph " + fontStyle + " " + fontWeight + " " + fontFamily + " " + fontSize + " " + letter + ' has no compact_tightWidth[PIXEL_DENSITY]');
        }
        if (!glyph.tightCanvas) {
          console.warn("glyph " + fontStyle + " " + fontWeight + " " + fontFamily + " " + fontSize + " " + letter + " has no tightCanvas");
        }
        continue;
      }
      ctx.drawImage(glyph.tightCanvas, x, 0);

      if (!glyph.compact_xInGlyphSheet) {
        glyph.compact_xInGlyphSheet = {};
      }
      glyph.compact_xInGlyphSheet[PIXEL_DENSITY] = x;

      // check that glyph.compact_tightWidth[PIXEL_DENSITY] is a valid number
      x += glyph.compact_tightWidth[PIXEL_DENSITY];
    }

    const glyphsSheetsPNG = ctx.toPNGImage();
    // NOTE that you can't use the image in here... although the data URL is a base64-encoded
    // string representing the image data, and there is no network request involved... however,
    // even though the data is available immediately, the Image element still needs a short
    // amount of time to process the data and make it available for rendering.
    // This processing time is typically very brief, but if you try it here, you'll get frequent
    // failures to paint the letters from this image.
    this.compact_glyphsSheets[fontFamily][fontStyle][fontWeight][fontSize][PIXEL_DENSITY] = canvas;

    // ... but you CAN return it here as it will be added to the DOM and the browser seems to
    // have no problem in showing it 100% of the time.
    return glyphsSheetsPNG
  }
}
