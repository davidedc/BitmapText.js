// a class constructed with a BitmapGlyphStore
// has a method to draw text on a canvas
// the text is drawn by looking up the glyphs in the BitmapGlyphStore
// and drawing them on the canvas one after the other, advancing the x position by the width of the glyph
// the text is drawn with x, y positioning equivalent to textBaseline='bottom'
// where x is the left edge of the first glyph and y is the bottom of the text bounding box (lowest point any character reaches)
class BitmapText {
  constructor(glyphStore, canvasFactory) {
    this.glyphStore = glyphStore;
    // we keep one canvas and a context for coloring all the glyphs
    if (canvasFactory) {
      this.coloredGlyphCanvas = canvasFactory();
    } else if (typeof document !== 'undefined') {
      this.coloredGlyphCanvas = document.createElement('canvas');
    } else {
      throw new Error('Canvas factory required in Node.js environment');
    }
    this.coloredGlyphCtx = this.coloredGlyphCanvas.getContext('2d');
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

    if (isKerningEnabled && nextLetter) {
      let kerningCorrectionPlace = this.glyphStore.getKerningTable(fontProperties);
      if (checkNestedPropertiesExist(kerningCorrectionPlace, properties))
        return getNestedProperty(kerningCorrectionPlace, properties);
    }

    return 0;
  }

  drawTextFromGlyphSheet(ctx, text, x_CSS_Px, y_CSS_Px, fontProperties, textColor = 'black') {
    const position = {
      x: x_CSS_Px * fontProperties.pixelDensity,
      y: y_CSS_Px * fontProperties.pixelDensity
    };
    
    const glyphSheet = this.glyphStore.getGlyphSheet(fontProperties);

    for (let i = 0; i < text.length; i++) {
      const currentLetter = text[i];
      const nextLetter = text[i + 1];
      
      this.drawLetter(ctx,
        currentLetter,
        position,
        glyphSheet,
        fontProperties,
        textColor
      );

      position.x += this.calculateLetterAdvancement(fontProperties, currentLetter, nextLetter);
    }
  }

  drawLetter(ctx, letter, position, glyphSheet, fontProperties, textColor) {
    // There are several optimisations possible here:
    // 1. We could make a special case when the color is black
    // 2. We could cache the colored glyph sheets in a small LRU cache

    const metrics = this.glyphStore.getGlyphSheetMetrics(fontProperties, letter);
    
    // If glyph sheet is missing but metrics exist, draw placeholder rectangle
    if (!this.glyphStore.isValidGlyphSheet(glyphSheet)) {
      // For placeholder rectangles, we need tightWidth and tightHeight, but not xInGlyphSheet
      if (metrics.tightWidth && metrics.tightHeight) {
        this.drawPlaceholderRectangle(ctx, position, metrics, textColor);
      }
      return;
    }
    
    // For normal glyph rendering, we need xInGlyphSheet
    if (!metrics.xInGlyphSheet) return;

    const coloredGlyphCanvas = this.createColoredGlyph(glyphSheet, metrics, textColor);
    this.renderGlyphToMainCanvas(ctx, coloredGlyphCanvas, position, metrics);
  }

  createColoredGlyph(glyphSheet, metrics, textColor) {
    const { xInGlyphSheet, tightWidth, tightHeight } = metrics;
    
    // Setup temporary canvas, same size as the glyph
    this.coloredGlyphCanvas.width = tightWidth;
    this.coloredGlyphCanvas.height = tightHeight;
    this.coloredGlyphCtx.clearRect(0, 0, tightWidth, tightHeight);

    // Draw original glyph
    this.coloredGlyphCtx.globalCompositeOperation = 'source-over'; // reset the composite operation
    // see https://stackoverflow.com/a/6061102
    this.coloredGlyphCtx.drawImage(
      glyphSheet,
      xInGlyphSheet, 0,
      tightWidth, tightHeight,
      0, 0,
      tightWidth, tightHeight
    );

    // Apply color
    this.coloredGlyphCtx.globalCompositeOperation = 'source-in';
    this.coloredGlyphCtx.fillStyle = textColor;
    this.coloredGlyphCtx.fillRect(0, 0, tightWidth, tightHeight);

    return this.coloredGlyphCanvas;
  }

  renderGlyphToMainCanvas(ctx, coloredGlyphCanvas, position, metrics) {
    const { tightWidth, tightHeight, dx, dy } = metrics;
    
     // see https://stackoverflow.com/a/6061102
    ctx.drawImage(
      coloredGlyphCanvas,
      0, 0,
      tightWidth, tightHeight,
      position.x + dx,
      position.y + dy,
      tightWidth, tightHeight
    );
  }

  drawPlaceholderRectangle(ctx, position, metrics, textColor) {
    const { tightWidth, tightHeight, dx, dy } = metrics;
    
    const rectX = position.x + dx;
    const rectY = position.y + dy;
    
    // Default to black if textColor is null or undefined
    const actualColor = textColor || 'black';
    
    // Draw a filled rectangle at the same position and size as the glyph would be
    ctx.fillStyle = actualColor;
    ctx.fillRect(rectX, rectY, tightWidth, tightHeight);
  }

  calculateLetterAdvancement(fontProperties, currentLetter, nextLetter) {
    return this.calculateAdvancement_CSS_Px(fontProperties, currentLetter, nextLetter) 
      * fontProperties.pixelDensity;
  }
}
