// a class constructed with a BitmapGlyphStore
// has a method to draw text on a canvas
// the text is drawn by looking up the glyphs in the BitmapGlyphStore
// and drawing them on the canvas one after the other, advancing the x position by the width of the glyph
// the text is drawn with the top bottom left corner of the first glyph at the x, y position specified
class BitmapText {
  constructor(glyphStore) {
    this.glyphStore = glyphStore;
  }

  // This returns an object of the same shape
  // and meaning as the TextMetrics object (see
  // https://developer.mozilla.org/en-US/docs/Web/API/TextMetrics ) i.e.:
  //  * the width should be the sum of the advancements (detracting kerning)
  //  * actualBoundingBoxLeft =
  //      the actualBoundingBoxLeft of the first character
  //  * actualBoundingBoxRight =
  //      the sum of the advancements (detracting kerning) EXCLUDING the one of the last char, plus the actualBoundingBoxRight of the last char
  measureText(text, fontProperties) {
    if (text.length === 0)
      return {
        width: 0,
        actualBoundingBoxLeft: 0,
        actualBoundingBoxRight: 0,
        actualBoundingBoxAscent: 0,
        actualBoundingBoxDescent: 0,
        fontBoundingBoxAscent: 0,
        fontBoundingBoxDescent: 0
      };

    let width_CSS_Px = 0;
    let letterTextMetrics = this.glyphStore.getGlyphsTextMetrics(fontProperties, text[0]);
    const actualBoundingBoxLeft_CSS_Px = letterTextMetrics.actualBoundingBoxLeft;
    let actualBoundingBoxAscent = 0;
    let actualBoundingBoxDescent = 0;
    let actualBoundingBoxRight_CSS_Px;
    let advancement_CSS_Px = 0;

    for (let i = 0; i < text.length; i++) {
      const letter = text[i];
      const nextLetter = text[i + 1];

      letterTextMetrics = this.glyphStore.getGlyphsTextMetrics(fontProperties, letter);

      actualBoundingBoxAscent = Math.max(actualBoundingBoxAscent, letterTextMetrics.actualBoundingBoxAscent);
      actualBoundingBoxDescent = Math.min(actualBoundingBoxDescent, letterTextMetrics.actualBoundingBoxDescent);

      advancement_CSS_Px = this.calculateAdvancement_CSS_Px(fontProperties, letter, nextLetter);
      width_CSS_Px += advancement_CSS_Px;
    }

    // the actualBoundingBoxRight_CSS_Px is the sum of all the advancements (detracting kerning) up to the last character...
    actualBoundingBoxRight_CSS_Px = width_CSS_Px - advancement_CSS_Px;
    // ... plus the actualBoundingBoxRight_CSS_Px of the last character
    // (this is in place of adding its advancement_CSS_Px)
    actualBoundingBoxRight_CSS_Px += letterTextMetrics.actualBoundingBoxRight;

    return {
      width: width_CSS_Px,
      // note that standard measureText returns a TextMetrics object
      // which has no height, so let's make things uniform and resist the temptation to provide it.
      actualBoundingBoxLeft: actualBoundingBoxLeft_CSS_Px,
      actualBoundingBoxRight: actualBoundingBoxRight_CSS_Px,
      actualBoundingBoxAscent,
      actualBoundingBoxDescent,
      fontBoundingBoxAscent: letterTextMetrics.fontBoundingBoxAscent,
      fontBoundingBoxDescent: letterTextMetrics.fontBoundingBoxDescent
    };
  }

  // Get the advancement of the i-th character i.e. needed AFTER the i-th character
  // so that the i+1-th character is drawn at the right place
  // This depends on both the advancement specified by the glyph of the i-th character
  // AND by the kerning correction depending on the pair of the i-th and i+1-th characters
  calculateAdvancement_CSS_Px(fontProperties, letter, nextLetter) {
    const letterTextMetrics = this.glyphStore.getGlyphsTextMetrics(fontProperties, letter);
    let x_CSS_Px = 0;

    // TODO this "space" section should handle all characters without a glyph
    //      as there are many kinds of space-like characters.

    // Handle space first ------------------------------------------
    // You could add the space advancement as we got it from the browser
    // (remember that the space doesn't have the tightCanvasBox)
    // but since at small sizes we meddle with kerning quite a bit, we want
    // to also meddle with this to try to make the width of text
    // similar to what the browser paints normally.
    // console.log(letterTextMetrics.width + " " + x_CSS_Px);
    // deal with the size of the " " character
    if (letter === " ") {
      const spaceAdvancementOverrideForSmallSizesInPx_CSS_Px = this.glyphStore.getSpaceAdvancementOverrideForSmallSizesInPx(fontProperties);
      if (spaceAdvancementOverrideForSmallSizesInPx_CSS_Px !== null) {
        x_CSS_Px += spaceAdvancementOverrideForSmallSizesInPx_CSS_Px;
      }
      else {
        x_CSS_Px += letterTextMetrics.width;
      }
    }
    // Non-space characters ------------------------------------------
    else {
      x_CSS_Px += letterTextMetrics.width;
    }

    // Next, apply the kerning correction ----------------------------
    let kerningCorrection = this.getKerningCorrection(fontProperties, letter, nextLetter);

    // We multiply the advancement of the letter by the kerning
    // Tracking and kerning are both measured in 1/1000 em, a unit of measure that is relative to the current type size.
    // We don't use ems, rather we use pxs, however we still want to keep Kerning as strictly proportional to the current type size,
    // and also to keep it as a measure "in thousands".
    x_CSS_Px -= fontProperties.fontSize * kerningCorrection / 1000;

    // since we might want to actually _place_ a glyph,
    // following this measurement, we want to return an
    // integer coordinate here
    return Math.round(x_CSS_Px);
  }

  getKerningCorrection(fontProperties, letter, nextLetter) {
    const properties = [letter, nextLetter];

    if (ENABLE_KERNING && nextLetter) {
      let kerningCorrectionPlace = this.glyphStore.getKerningTable(fontProperties);
      if (checkNestedPropertiesExist(kerningCorrectionPlace, properties))
        return getNestedProperty(kerningCorrectionPlace, properties);
    }

    return 0;
  }

  drawTextFromGlyphSheet(ctx, text, x_CSS_Px, y_CSS_Px, fontProperties) {
    let x_Phys_Px = x_CSS_Px * fontProperties.pixelDensity;
    const y_Phys_Px = y_CSS_Px * fontProperties.pixelDensity;

    const glyphsSheet = this.glyphStore.getGlyphsSheet(fontProperties);

    for (let i = 0; i < text.length; i++) {
      const letter = text[i];
      const nextLetter = text[i + 1];

      const {xInGlyphSheet, tightWidth, tightHeight, dx, dy} =
        this.glyphStore.getGlyphsSheetMetrics(fontProperties, letter);

      if (xInGlyphSheet) {
        // see https://stackoverflow.com/a/6061102
        ctx.drawImage(
          glyphsSheet,
          // Source x, y
          xInGlyphSheet,
          0,
          // Source width, height
          tightWidth,
          tightHeight,
          // Destination x, y
          x_Phys_Px + dx,
          // same formula for the y as ctx.drawText above, see explanation there
          y_Phys_Px + dy,
          // Destination width, height
          tightWidth,
          tightHeight
        );
      }

      x_Phys_Px +=
        this.calculateAdvancement_CSS_Px(fontProperties, letter, nextLetter) *
        fontProperties.pixelDensity;
    }
  }
}
