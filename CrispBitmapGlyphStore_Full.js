// a class to store all the crispBitmapGlyph_Fulls
// so that we can retrieve them by font family, font size and letter
class CrispBitmapGlyphStore_Full extends CrispBitmapGlyphStore {
  constructor() {    
    super();
    // these objects contain all kinds of other
    // intermediate data useful for construction/inspection
    // so don't use them in the measuring and drawing methods
    this.glyphs = {};
  }

  extractCrispBitmapGlyphStoreInstance() {
    const instance = new CrispBitmapGlyphStore();
    instance.kerningTables = this.kerningTables;
    instance.glyphsTextMetrics = this.glyphsTextMetrics;
    instance.spaceAdvancementOverrideForSmallSizesInPx = this.spaceAdvancementOverrideForSmallSizesInPx;
    instance.glyphsSheets = this.glyphsSheets;
    instance.glyphsSheetsMetrics = this.glyphsSheetsMetrics;
    return instance;
  }

  clearKerningTables() {
    this.kerningTables = {};
  }

  clearKerningTable(fontFamily, fontStyle, fontWeight, fontSize) {
    const properties = [PIXEL_DENSITY, fontFamily, fontStyle, fontWeight, fontSize];

    if (checkNestedPropertiesExist(this.kerningTables, properties)) {
        setNestedProperty(this.kerningTables, properties, null);
    }
  }

  addGlyph(glyph) {
    setNestedProperty(this.glyphs, [glyph.fontFamily, glyph.fontStyle, glyph.fontWeight, glyph.fontSize, glyph.letter], glyph);
    // glyphsSheets is actually part of the narrower CrispBitmapGlyphStore class
    // however we also need it here in the Full class for construction of things.
    ensureNestedPropertiesExist(this.glyphsSheets, [PIXEL_DENSITY, glyph.fontFamily, glyph.fontStyle, glyph.fontWeight, glyph.fontSize]);
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
      let letterTextMetrics = getNestedProperty(this.glyphsTextMetrics, [PIXEL_DENSITY, fontFamily, fontStyle, fontWeight, fontSize, letter]);
      // the width is calculated from the glyph.tightCanvasBox
      // example: bottomRightCorner: {x: 40, y: 71}
      // topLeftCorner: {x: 4, y: 13}

      // if the bottomRightCorner or the topLeftCorner is not defined, then the glyph is not valid
      // and just continue
      if (!glyph.tightCanvasBox?.bottomRightCorner || !glyph.tightCanvasBox?.topLeftCorner) {
        continue;
      }

      // Note that PIXEL_DENSITY can be an integer or a fractional number.
      // In both cases, JavaScript will automatically convert the number to a string when using it as an object key.
      // For example, if PIXEL_DENSITY is 2, the key will be "2", and if it's 1.5, the key will be "1.5".

      // you use 1 * PIXEL_DENSITY because it's always good to do things in increments of PIXEL_DENSITY
      // so that everything remains divisible by PIXEL_DENSITY
      const tightWidth = glyph.tightCanvasBox.bottomRightCorner.x - glyph.tightCanvasBox.topLeftCorner.x + 1 * PIXEL_DENSITY;
      const tightHeight = glyph.tightCanvasBox.bottomRightCorner.y - glyph.tightCanvasBox.topLeftCorner.y + 1 * PIXEL_DENSITY;
      setNestedProperty(this.glyphsSheetsMetrics.tightWidth, [PIXEL_DENSITY, fontFamily, fontStyle, fontWeight, fontSize, letter], tightWidth);
      setNestedProperty(this.glyphsSheetsMetrics.tightHeight, [PIXEL_DENSITY, fontFamily, fontStyle, fontWeight, fontSize, letter], tightHeight);

      const dx = - Math.round(letterTextMetrics.actualBoundingBoxLeft) * PIXEL_DENSITY + glyph.tightCanvasBox.topLeftCorner.x;
      const dy = - tightHeight - glyph.tightCanvas.distanceBetweenBottomAndBottomOfCanvas + 1 * PIXEL_DENSITY;
      setNestedProperty(this.glyphsSheetsMetrics.dx, [PIXEL_DENSITY, fontFamily, fontStyle, fontWeight, fontSize, letter], dx);
      setNestedProperty(this.glyphsSheetsMetrics.dy, [PIXEL_DENSITY, fontFamily, fontStyle, fontWeight, fontSize, letter], dy);

      if (!isNaN(tightWidth)) fittingWidth += tightWidth;
      if (tightHeight > maxHeight) maxHeight = tightHeight;
    }

    const canvas = document.createElement('canvas');
    canvas.width = fittingWidth;
    canvas.height = maxHeight;
    const ctx = canvas.getContext('2d');
    let x = 0;

    for (let letter in glyphs) {
      let glyph = glyphs[letter];
      const tightWidth = getNestedProperty(this.glyphsSheetsMetrics.tightWidth, [PIXEL_DENSITY, fontFamily, fontStyle, fontWeight, fontSize, letter]);
      // if there is no glyph.tightCanvas, then just continue
      if (!glyph.tightCanvas || !tightWidth || isNaN(tightWidth)) {
        if (!tightWidth) {
          console.warn("glyph " + fontStyle + " " + fontWeight + " " + fontFamily + " " + fontSize + " " + letter + ' has no tightWidth[PIXEL_DENSITY]');
        }
        if (!glyph.tightCanvas) {
          console.warn("glyph " + fontStyle + " " + fontWeight + " " + fontFamily + " " + fontSize + " " + letter + " has no tightCanvas");
        }
        continue;
      }
      ctx.drawImage(glyph.tightCanvas, x, 0);

      setNestedProperty(this.glyphsSheetsMetrics.xInGlyphSheet, [PIXEL_DENSITY, fontFamily, fontStyle, fontWeight, fontSize, letter], x);

      x += tightWidth;
    }

    const glyphsSheetsPNG = ctx.toPNGImage();
    // NOTE that you can't use the image in here... although the data URL is a base64-encoded
    // string representing the image data, and there is no network request involved... however,
    // even though the data is available immediately, the Image element still needs a short
    // amount of time to process the data and make it available for rendering.
    // This processing time is typically very brief, but if you try it here, you'll get frequent
    // failures to paint the letters from this image.
    this.glyphsSheets[PIXEL_DENSITY][fontFamily][fontStyle][fontWeight][fontSize][PIXEL_DENSITY] = canvas;

    // ... but you CAN return it here as it will be added to the DOM and the browser seems to
    // have no problem in showing it 100% of the time.
    return glyphsSheetsPNG
  }
}
