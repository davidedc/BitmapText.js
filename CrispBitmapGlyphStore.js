// a class to store all the crispBitmapGlyphs
// so that we can retrieve them by font family, font size and letter
class CrispBitmapGlyphStore {
  constructor() {
    this.glyphs = {};
  }

  addGlyph(glyph) {
    if (!this.glyphs[glyph.fontFamily]) {
      this.glyphs[glyph.fontFamily] = {};
    }
    if (!this.glyphs[glyph.fontFamily][glyph.fontEmphasis]) {
      this.glyphs[glyph.fontFamily][glyph.fontEmphasis] = {};
    }
    if (!this.glyphs[glyph.fontFamily][glyph.fontEmphasis][glyph.fontSize]) {
      this.glyphs[glyph.fontFamily][glyph.fontEmphasis][glyph.fontSize] = {};
    }
    if (!this.glyphs[glyph.fontFamily][glyph.fontEmphasis][glyph.fontSize][glyph.letter]) {
      this.glyphs[glyph.fontFamily][glyph.fontEmphasis][glyph.fontSize][glyph.letter] = glyph;
    }
  }

  getGlyph(fontFamily, fontSize, letter, fontEmphasis) {
    if (this.glyphs[fontFamily]?.[fontEmphasis]?.[fontSize]?.[letter]) {
      return this.glyphs[fontFamily][fontEmphasis][fontSize][letter];
    }
    return null;
  }

  // get a canvas with all the glyphs of a certain font family, font size and font emphasis
  // 1. go through all the glyphs and get the maximum width and height each so that you calculate the
  //    width and height of the rectangle needed to fit all the glyphs
  // 2. create a canvas with the width and height calculated such that a-zA-Z0-9 can fit in the canvas
  // 3. draw each glyph in the canvas
  getGlyphsSheet(fontFamily, fontSize, fontEmphasis) {
    if (! this.glyphs[fontFamily]?.[fontEmphasis]?.[fontSize])
      return;

    let glyphs = this.glyphs[fontFamily][fontEmphasis][fontSize];
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

      glyph.width = glyph.tightCanvasBox.bottomRightCorner.x - glyph.tightCanvasBox.topLeftCorner.x;
      glyph.height = glyph.tightCanvasBox.bottomRightCorner.y - glyph.tightCanvasBox.topLeftCorner.y;

      if (!isNaN(glyph.width) ) {
        fittingWidth += glyph.width;
      }
      if (glyph.height > maxHeight) {
        maxHeight = glyph.height;
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
      if (!glyph.tightCanvas || isNaN(glyph.width)) {
        continue;
      }
      ctx.drawImage(glyph.tightCanvas, x, 0);
      // check that glyph.width is a valid number
      x += glyph.width;
    }
    return canvas;
  }
}
