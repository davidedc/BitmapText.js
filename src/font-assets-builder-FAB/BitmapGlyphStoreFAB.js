// Class to store all the BitmapGlyph_FAB objects
// so that we can retrieve them by font family, font size and letter
class BitmapGlyphStore_FAB extends BitmapGlyphStore {
  constructor() {
    super();
    // FAB-specific glyph storage using Map for O(1) lookups
    // Key format: fontProperties.key + ":" + letter
    this.glyphs = new Map();
  }

  extractBitmapGlyphStoreInstance() {
    const instance = new BitmapGlyphStore();
    instance.kerningTables = this.kerningTables;
    instance.glyphsTextMetrics = this.glyphsTextMetrics;
    instance.spaceAdvancementOverrideForSmallSizesInPx = this.spaceAdvancementOverrideForSmallSizesInPx;
    instance.glyphSheets = this.glyphSheets;
    instance.glyphSheetsMetrics = this.glyphSheetsMetrics;
    return instance;
  }

  clearKerningTables() {
    this.kerningTables.clear();
  }

  kerningTableExists(fontProperties) {
    return this.kerningTables.has(fontProperties.key);
  }

  setKerningTable(fontProperties, kerningTable) {
    // Use parent class method which uses Maps
    super.setKerningTable(fontProperties, kerningTable);
  }



  addGlyph(glyph) {
    const glyphKey = `${glyph.fontProperties.key}:${glyph.letter}`;
    this.glyphs.set(glyphKey, glyph);
  }

  getGlyph(fontProperties, letter) {
    const glyphKey = `${fontProperties.key}:${letter}`;
    return this.glyphs.get(glyphKey);
  }

  // Get a canvas with all the glyphs of a certain font family, font size and font style
  // 1. go through all the glyphs and get the maximum width and height each so that you calculate the
  //    width and height of the rectangle needed to fit all the glyphs
  // 2. create a canvas with the width and height calculated such that a-zA-Z0-9 can fit in the canvas
  // 3. draw each glyph in the canvas
  buildGlyphSheet(fontProperties) {
    // Find all glyphs for this font configuration
    const glyphs = {};
    for (const [glyphKey, glyph] of this.glyphs) {
      if (glyphKey.startsWith(fontProperties.key + ':')) {
        const letter = glyphKey.substring(fontProperties.key.length + 1);
        glyphs[letter] = glyph;
      }
    }
    
    if (Object.keys(glyphs).length === 0) return null;

    let fittingWidth = 0;
    let maxHeight = 0;

    for (let letter in glyphs) {
      let glyph = glyphs[letter];
      let letterTextMetrics = this.getGlyphsTextMetrics(fontProperties, letter);

      // the width is calculated from the glyph.tightCanvasBox
      // example: bottomRightCorner: {x: 40, y: 71}
      // topLeftCorner: {x: 4, y: 13}

      // if the bottomRightCorner or the topLeftCorner is not defined, then the glyph is not valid
      // and just continue
      if (!glyph.tightCanvasBox?.bottomRightCorner || !glyph.tightCanvasBox?.topLeftCorner)
        continue;

      // Note that pixelDensity can be an integer or a fractional number.
      // In both cases, JavaScript will automatically convert the number to a string when using it as an object key.
      // For example, if pixelDensity is 2, the key will be "2", and if it's 1.5, the key will be "1.5".

      // you use 1 * pixelDensity because it's always good to do things in increments of pixelDensity
      // so that everything remains divisible by pixelDensity
      const tightWidth =
        glyph.tightCanvasBox.bottomRightCorner.x -
        glyph.tightCanvasBox.topLeftCorner.x +
        1;
      const tightHeight =
        glyph.tightCanvasBox.bottomRightCorner.y -
        glyph.tightCanvasBox.topLeftCorner.y +
        1;
      const glyphKey = `${fontProperties.key}:${letter}`;
      this.glyphSheetsMetrics.tightWidth.set(glyphKey, tightWidth);
      this.glyphSheetsMetrics.tightHeight.set(glyphKey, tightHeight);

      const dx = - Math.round(letterTextMetrics.actualBoundingBoxLeft) * fontProperties.pixelDensity + glyph.tightCanvasBox.topLeftCorner.x;
      const dy = - tightHeight - glyph.tightCanvas.distanceBetweenBottomAndBottomOfCanvas + 1 * fontProperties.pixelDensity;
      this.glyphSheetsMetrics.dx.set(glyphKey, dx);
      this.glyphSheetsMetrics.dy.set(glyphKey, dy);

      if (!isNaN(tightWidth)) fittingWidth += tightWidth;
      if (tightHeight > maxHeight) maxHeight = tightHeight;
    }

    const canvas = document.createElement("canvas");
    canvas.width = fittingWidth;
    canvas.height = maxHeight;
    const ctx = canvas.getContext("2d");
    let x = 0;

    for (let letter in glyphs) {
      let glyph = glyphs[letter];
      const glyphKey = `${fontProperties.key}:${letter}`;
      const tightWidth = this.glyphSheetsMetrics.tightWidth.get(glyphKey);
      // if there is no glyph.tightCanvas, then just continue
      if (!glyph.tightCanvas || !tightWidth || isNaN(tightWidth)) {
        if (!tightWidth)
          console.warn(`glyph ${fontProperties.fontStyle} ${fontProperties.fontWeight} ${fontProperties.fontFamily} ${fontProperties.fontSize} ${letter} has no tightWidth[fontProperties.pixelDensity]`);
        if (!glyph.tightCanvas)
          console.warn(`glyph ${fontProperties.fontStyle} ${fontProperties.fontWeight} ${fontProperties.fontFamily} ${fontProperties.fontSize} ${letter} has no tightCanvas`);
        continue;
      }
      ctx.drawImage(glyph.tightCanvas, x, 0);

      this.glyphSheetsMetrics.xInGlyphSheet.set(glyphKey, x);

      x += tightWidth;
    }

    const glyphSheetsPNG = ctx.toPNGImage();
    // NOTE that you can't use the image in here... although the data URL is a base64-encoded
    // string representing the image data, and there is no network request involved... however,
    // even though the data is available immediately, the Image element still needs a short
    // amount of time to process the data and make it available for rendering.
    // This processing time is typically very brief, but if you try it here, you'll get frequent
    // failures to paint the letters from this image.
    this.setGlyphSheet(fontProperties, canvas);

    // ... but you CAN return it here as it will be added to the DOM and the browser seems to
    // have no problem in showing it 100% of the time.
    return [glyphSheetsPNG, ctx];
  }

}
