// a class to store all the crispBitmapGlyphs
// so that we can retrieve them by font family, font size and letter
class CrispBitmapGlyphStore {
  constructor() {
    this.glyphs = {};
    this.glyphsSheets = {};
  }

  addGlyph(glyph) {
    if (!this.glyphs[glyph.fontFamily]) {
      this.glyphs[glyph.fontFamily] = {};
      this.glyphsSheets[glyph.fontFamily] = {};
    }
    if (!this.glyphs[glyph.fontFamily][glyph.fontStyle]) {
      this.glyphs[glyph.fontFamily][glyph.fontStyle] = {};
      this.glyphsSheets[glyph.fontFamily][glyph.fontStyle] = {};
    }
    if (!this.glyphs[glyph.fontFamily][glyph.fontStyle][glyph.fontWeight]) {
      this.glyphs[glyph.fontFamily][glyph.fontStyle][glyph.fontWeight] = {};
      this.glyphsSheets[glyph.fontFamily][glyph.fontStyle][glyph.fontWeight] = {};
    }
    if (!this.glyphs[glyph.fontFamily][glyph.fontStyle][glyph.fontWeight][glyph.fontSize]) {
      this.glyphs[glyph.fontFamily][glyph.fontStyle][glyph.fontWeight][glyph.fontSize] = {};
      this.glyphsSheets[glyph.fontFamily][glyph.fontStyle][glyph.fontWeight][glyph.fontSize] = {};
    }
    if (!this.glyphs[glyph.fontFamily][glyph.fontStyle][glyph.fontWeight][glyph.fontSize][glyph.letter]) {
      this.glyphs[glyph.fontFamily][glyph.fontStyle][glyph.fontWeight][glyph.fontSize][glyph.letter] = glyph;
    }
  }

  getGlyph(fontFamily, fontSize, letter, fontStyle, fontWeight) {
    if (this.glyphs[fontFamily]?.[fontStyle]?.[fontWeight]?.[fontSize]?.[letter]) {
      return this.glyphs[fontFamily][fontStyle][fontWeight][fontSize][letter];
    }
    return null;
  }

  // Get a canvas with all the glyphs of a certain font family, font size and font style
  // 1. go through all the glyphs and get the maximum width and height each so that you calculate the
  //    width and height of the rectangle needed to fit all the glyphs
  // 2. create a canvas with the width and height calculated such that a-zA-Z0-9 can fit in the canvas
  // 3. draw each glyph in the canvas
  getGlyphsSheet(fontFamily, fontSize, fontStyle, fontWeight) {
    if (! this.glyphs[fontFamily]?.[fontStyle]?.[fontWeight]?.[fontSize])
      return;

    let glyphs = this.glyphs[fontFamily][fontStyle][fontWeight][fontSize];
    let fittingWidth = 0;
    let maxHeight = 0;
    for (let letter in glyphs) {
      let glyph = glyphs[letter];
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
      glyph.tightWidth = [];
      glyph.tightHeight = [];
      glyph.tightWidth[PIXEL_DENSITY+""] = glyph.tightCanvasBox.bottomRightCorner.x - glyph.tightCanvasBox.topLeftCorner.x + 1 * PIXEL_DENSITY;
      glyph.tightHeight[PIXEL_DENSITY+""] = glyph.tightCanvasBox.bottomRightCorner.y - glyph.tightCanvasBox.topLeftCorner.y + 1 * PIXEL_DENSITY;

      if (!isNaN(glyph.tightWidth[PIXEL_DENSITY+""]) ) {
        fittingWidth += glyph.tightWidth[PIXEL_DENSITY+""];
      }
      if (glyph.tightHeight[PIXEL_DENSITY+""] > maxHeight) {
        maxHeight = glyph.tightHeight[PIXEL_DENSITY+""];
      }
    }
    let canvas = document.createElement('canvas');
    canvas.width = fittingWidth;
    canvas.height = maxHeight;
    let ctx = canvas.getContext('2d');
    let x = 0;
    for (let letter in glyphs) {
      let glyph = glyphs[letter];
      // if there is no glyph.tightCanvas, then just continue
      if (!glyph.tightCanvas || !glyph.tightWidth || isNaN(glyph.tightWidth[PIXEL_DENSITY+""])) {
        if (!glyph.tightWidth) {
          console.log("glyph " + fontStyle + " " + fontWeight + " " + fontFamily + " " + fontSize + " " + letter + ' has no tightWidth[PIXEL_DENSITY+""]');
        }
        if (!glyph.tightCanvas) {
          console.log("glyph " + fontStyle + " " + fontWeight + " " + fontFamily + " " + fontSize + " " + letter + " has no tightCanvas");
        }
        
        continue;
      }
      ctx.drawImage(glyph.tightCanvas, x, 0);
      glyph.xInGlyphSheet = x;
      // check that glyph.tightWidth[PIXEL_DENSITY+""] is a valid number
      x += glyph.tightWidth[PIXEL_DENSITY+""];
    }
    // put the canvas in the store so that we can retrieve it later
    this.glyphsSheets[fontFamily][fontStyle][fontWeight][fontSize][PIXEL_DENSITY+""] = canvas;
    return canvas;
  }
}
