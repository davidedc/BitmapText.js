// a class to store all the crispBitmapGlyph_Fulls
// so that we can retrieve them by font family, font size and letter
class CrispBitmapGlyphStore_Full {
  constructor() {
    this.glyphs = {};
    this.glyphsSheets = {};
    this.kerningTables = {};
  }

  clearKerningTables() {
    this.kerningTables = {};
  }

  clearKerningTable(fontFamily, fontStyle, fontWeight, fontSize) {
    if (!this.kerningTables[fontFamily]) return;
    if (!this.kerningTables[fontFamily][fontStyle]) return;
    if (!this.kerningTables[fontFamily][fontStyle][fontWeight]) return;
    if (!this.kerningTables[fontFamily][fontStyle][fontWeight][fontSize]) return;
    this.kerningTables[fontFamily][fontStyle][fontWeight][fontSize] = null;
  }

  addGlyph(glyph) {
    // the structure of the object follows these four levels:
    const propertiesLevels = ['fontFamily', 'fontStyle', 'fontWeight', 'fontSize', 'letter'];
    // so whenever you add a glyph, you go through the propertiesLevels and create the
    // structure (or part of it) if it's not there.

    let currentGlyphsLevel = this.glyphs;
    let currentGlyphsSheetsLevel = this.glyphsSheets;
  
    for (let i = 0; i < propertiesLevels.length; i++) {
      const prop = propertiesLevels[i];
      const value = glyph[prop];
  
      if (!currentGlyphsLevel[value]) {
        currentGlyphsLevel[value] = {};
        if (i < propertiesLevels.length - 1) {
          currentGlyphsSheetsLevel[value] = {};
        }
      }
  
      if (i === propertiesLevels.length - 1) {
        currentGlyphsLevel[value] = glyph;
      } else {
        currentGlyphsLevel = currentGlyphsLevel[value];
        currentGlyphsSheetsLevel = currentGlyphsSheetsLevel[value];
      }
    }
  }

  getGlyph(fontFamily, fontSize, letter, fontStyle, fontWeight) {
    return this.glyphs?.[fontFamily]?.[fontStyle]?.[fontWeight]?.[fontSize]?.[letter] || null;
  }

  // Get a canvas with all the glyphs of a certain font family, font size and font style
  // 1. go through all the glyphs and get the maximum width and height each so that you calculate the
  //    width and height of the rectangle needed to fit all the glyphs
  // 2. create a canvas with the width and height calculated such that a-zA-Z0-9 can fit in the canvas
  // 3. draw each glyph in the canvas
  getGlyphsSheet(fontFamily, fontSize, fontStyle, fontWeight) {
    const glyphs = this.glyphs?.[fontFamily]?.[fontStyle]?.[fontWeight]?.[fontSize];
    if (!glyphs) return null;

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
      const tightWidth = glyph.tightCanvasBox.bottomRightCorner.x - glyph.tightCanvasBox.topLeftCorner.x + 1 * PIXEL_DENSITY;
      const tightHeight = glyph.tightCanvasBox.bottomRightCorner.y - glyph.tightCanvasBox.topLeftCorner.y + 1 * PIXEL_DENSITY;

      glyph.tightWidth = { [PIXEL_DENSITY+""]: tightWidth };
      glyph.tightHeight = { [PIXEL_DENSITY+""]: tightHeight };

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
      // if there is no glyph.tightCanvas, then just continue
      if (!glyph.tightCanvas || !glyph.tightWidth || isNaN(glyph.tightWidth[PIXEL_DENSITY+""])) {
        if (!glyph.tightWidth) {
          console.warn("glyph " + fontStyle + " " + fontWeight + " " + fontFamily + " " + fontSize + " " + letter + ' has no tightWidth[PIXEL_DENSITY+""]');
        }
        if (!glyph.tightCanvas) {
          console.warn("glyph " + fontStyle + " " + fontWeight + " " + fontFamily + " " + fontSize + " " + letter + " has no tightCanvas");
        }
        continue;
      }
      ctx.drawImage(glyph.tightCanvas, x, 0);
      glyph.xInGlyphSheet = x;
      // check that glyph.tightWidth[PIXEL_DENSITY+""] is a valid number
      x += glyph.tightWidth[PIXEL_DENSITY+""];
    }

    const glyphsSheetsPNG = ctx.toPNGImage();
    // NOTE that you can't use the image in here... although the data URL is a base64-encoded
    // string representing the image data, and there is no network request involved... however,
    // even though the data is available immediately, the Image element still needs a short
    // amount of time to process the data and make it available for rendering.
    // This processing time is typically very brief, but if you try it here, you'll get frequent
    // failures to paint the letters from this image.
    this.glyphsSheets[fontFamily][fontStyle][fontWeight][fontSize][PIXEL_DENSITY+""] = canvas;

    // ... but you CAN return it here as it will be added to the DOM and the browser seems to
    // have no problem in showing it 100% of the time.
    return glyphsSheetsPNG
  }
}
