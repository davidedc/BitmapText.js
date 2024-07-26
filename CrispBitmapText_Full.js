// a class constructed with a CrispBitmapGlyphStore_Full
// has a method to draw text on a canvas
// the text is drawn by looking up the glyphs in the CrispBitmapGlyphStore_Full
// and drawing them on the canvas one after the other, advancing the x position by the width of the glyph
// the text is drawn with the top bottom left corner of the first glyph at the x, y position specified
class CrispBitmapText_Full {
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
  measureText(text, fontSize, fontFamily, fontStyle, fontWeight) {
    
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
    const actualBoundingBoxLeft_CSS_Px = this.glyphStore.getGlyph(fontFamily, fontSize, text[0], fontStyle, fontWeight).letterMeasures.actualBoundingBoxLeft;
    let actualBoundingBoxRight_CSS_Px;
    let advancement_CSS_Px = 0;
    let glyph = null;

    for (let i = 0; i < text.length; i++) {
      const letter = text[i];

      glyph = this.glyphStore.getGlyph(fontFamily, fontSize, letter, fontStyle, fontWeight);

      advancement_CSS_Px = this.calculateAdvancement_CSS_Px(i, text, glyph, fontFamily, letter, fontSize, fontStyle, fontWeight);
      width_CSS_Px += advancement_CSS_Px;
    }

    // the actualBoundingBoxRight_CSS_Px is the sum of all the advancements (detracting kerning) up to the last character...
    actualBoundingBoxRight_CSS_Px = width_CSS_Px - advancement_CSS_Px;
    // ... plus the actualBoundingBoxRight_CSS_Px of the last character
    // (this is in place of adding its advancement_CSS_Px)
    actualBoundingBoxRight_CSS_Px += glyph.letterMeasures.actualBoundingBoxRight; 

    return {
      width: width_CSS_Px,
      // this one below is a nice convenience but it's not what standard measureText provides
      // so let's make things uniform and resist the temptation to provide it.
      //height: Math.round(glyph.letterMeasures.fontBoundingBoxAscent + glyph.letterMeasures.fontBoundingBoxDescent),
      actualBoundingBoxLeft: actualBoundingBoxLeft_CSS_Px,
      actualBoundingBoxRight: actualBoundingBoxRight_CSS_Px,
      actualBoundingBoxAscent: glyph.letterMeasures.actualBoundingBoxAscent,
      actualBoundingBoxDescent: glyph.letterMeasures.actualBoundingBoxDescent,
      fontBoundingBoxAscent: glyph.letterMeasures.fontBoundingBoxAscent,
      fontBoundingBoxDescent: glyph.letterMeasures.fontBoundingBoxDescent
    };
  }

  hasLotsOfSpaceAtBottomRight(letter) {
    return ['V', '7', '/', 'T', 'Y'].indexOf(letter) !== -1;
  }

  hasLotsOfSpaceAtBottomLeft(letter) {
    return ['V', '\\', 'T', 'Y'].indexOf(letter) !== -1;
  }

  hasSomeSpaceAtBottomLeft(letter) {
    return ['W', '7'].indexOf(letter) !== -1;
  }


  hasSomeSpaceAtBottomRight(letter) {
    return ['W', 'f', 'P'].indexOf(letter) !== -1;
  }

  hasSpaceAtTopRight(letter) {
    return ['A', '\\', 'L', 'h'].indexOf(letter) !== -1;
  }

  protrudesBottomLeft(letter) {
    return ['A', '/'].indexOf(letter) !== -1;
  }

  protrudesBottomRight(letter) {
    return ['A', '\\', 'L'].indexOf(letter) !== -1;
  }

  protrudesTopLeft(letter) {
    return ['V', 'W', '\\', 'T', 'Y'].indexOf(letter) !== -1;
  }

  isShortCharacter(letter) {
    return ['a', 'c', 'e', 'g', 'i', 'j', 'm', 'n', 'o', 'p', 'q', 'r', 's', 'u', 'v', 'w', 'x', 'y', 'z', '.', ',', ':', ';', '—', '·', 'Ç', 'à', 'ç', '•'].indexOf(letter) !== -1;
  }


  getKerningCorrectionFromSpec(fontFamily, letter, nextLetter, fontSize, fontStyle, fontWeight) {

    if (specCombinationExists(fontFamily, fontStyle, fontWeight, "Kerning cutoff")) {
      if (fontSize <= specs[fontFamily][fontStyle][fontWeight]["Kerning cutoff"]) {
        return 0;
      }
    }

    if (specCombinationExists(fontFamily, fontStyle, fontWeight, "Kerning")) {
  
      // for all entries in the Kerning array with a sizeRange that includes the current font size
      //   get the kerning array and for each one:
      //     if letter matches any of the letters in the "left" object or the "left" object is "*any*" and the nextLetter matches any of the letters in the "right" object or the "right" object is "*any*"
      //       return the value of the "adjustment" property
      for (const element of specs[fontFamily][fontStyle][fontWeight]["Kerning"]) {
        const kerningEntry = element;
        if (kerningEntry.sizeRange.from <= fontSize && kerningEntry.sizeRange.to >= fontSize) {
          // scan the kerningEntry.kerning array
          for (const element of kerningEntry.kerning) {
            const kerning = element;
            if ((kerning.left.indexOf(letter) !== -1 || kerning.left.indexOf("*any*") !== -1) && (kerning.right.indexOf(nextLetter) !== -1 || kerning.right.indexOf("*any*") !== -1)) {
              //console.log("kerning correction for " + letter + " " + nextLetter + " is " + kerning.adjustment);
              return kerning.adjustment;
            }
          }
        }
      }

      return 0;
    }

    return 0;
  }

  buildKerningTableIfDoesntExist(fontFamily, fontStyle, fontWeight, fontSize) {

    // check if the kerningTable already exists in the glyphs store
    if (this.glyphStore.kerningTables[fontFamily] &&
        this.glyphStore.kerningTables[fontFamily][fontStyle] &&
        this.glyphStore.kerningTables[fontFamily][fontStyle][fontWeight] &&
        this.glyphStore.kerningTables[fontFamily][fontStyle][fontWeight][fontSize]) {
      return;
    }

    // go through all the letters and for each letter, go through all the other letters
    // and calculate the kerning correction between the two letters
    // and store it in the kerningTable
    const kerningTable = {};
    for (const letter of characterSet) {
      kerningTable[letter] = {};
      for (const nextLetter of characterSet) {
        const kerningCorrection = this.getKerningCorrectionFromSpec(fontFamily, letter, nextLetter, fontSize, fontStyle, fontWeight);
        if (kerningCorrection !== 0) {
          kerningTable[letter][nextLetter] = kerningCorrection;
        }
      }
    }

    // prune the letters that don't have any kerning corrections
    for (const letter in kerningTable) {
      if (Object.keys(kerningTable[letter]).length === 0) {
        delete kerningTable[letter];
      }
    }

    // create the object level by level if it doesn't exist
    // in this.glyphStore.kerningTables
    let currentKerningTableLevel = this.glyphStore.kerningTables;
    for (let i = 0; i < 4; i++) {
      const prop = [fontFamily, fontStyle, fontWeight, fontSize][i];
      if (!currentKerningTableLevel[prop]) {
        currentKerningTableLevel[prop] = {};
      }
      if (i === 3) {
        currentKerningTableLevel[prop] = kerningTable;
      }
      else {
        currentKerningTableLevel = currentKerningTableLevel[prop];
      }
    }

    // store the kerningTable in the glyphs store
    // so that it can be retrieved later
    // when drawing text
    this.glyphStore.kerningTables[fontFamily][fontStyle][fontWeight][fontSize] = kerningTable;

  }
          


  // Get the advancement of the i-th character i.e. needed AFTER the i-th character
  // so that the i+1-th character is drawn at the right place
  // This depends on both the advancement specified by the glyph of the i-th character
  // AND by the kerning correction depending on the pair of the i-th and i+1-th characters
  calculateAdvancement_CSS_Px(i, text, glyph, fontFamily, letter, fontSize, fontStyle, fontWeight) {
    // if (letter === ' ') debugger

    // if glyph doesn't contain the letter, log out an error with the missing letter
    if (!glyph) {
      console.log("glyph doesn't contain the letter " + letter);
    }

    let x_CSS_Px = 0;

    // TODO this "space" section should handle all characters without a glyph
    //      as there are many kinds of space-like characters.

    // Handle space first ------------------------------------------
    // You could add the space advancement as we got it from the browser
    // (remember that the space doesn't have the tightCanvasBox)
    // but since at small sizes we meddle with kerning quite a bit, we want
    // to also meddle with this to try to make the width of text
    // similar to what the browser paints normally.
    // console.log(glyph.letterMeasures.width + " " + x_CSS_Px);
    // deal with the size of the " " character
    if (letter === " ") {
      const spaceAdvancementOverrideForSmallSizesInPx_CSS_Px = glyph.getSingleFloatCorrection(fontFamily, fontSize, fontStyle, fontWeight, "Space advancement override for small sizes in px");
      if (spaceAdvancementOverrideForSmallSizesInPx_CSS_Px !== null) {
        x_CSS_Px += spaceAdvancementOverrideForSmallSizesInPx_CSS_Px;
      }
      else {
        x_CSS_Px += glyph.letterMeasures.width;
      }
    }
    // Non-space characters ------------------------------------------
    else {
      // for small sizes we create our own advancement (width)
      // NOTE THIS IS NOW DISABLED because this advancement should be exactly the same at any PIXEL_DENSITY
      // ...but it's not because crisp pixels painted at different PIXEL_DENSITYs are painted differently.
      const advancementOverrideForSmallSizes_CSS_Px = glyph.getSingleFloatCorrection(fontFamily, fontSize, fontStyle, fontWeight, "Advancement override for small sizes in px");
      //console.log("advancementOverrideForSmallSizes_CSS_Px: " + advancementOverrideForSmallSizes_CSS_Px);
      if (advancementOverrideForSmallSizes_CSS_Px !== null) {
        x_CSS_Px += ((glyph.tightCanvasBox.bottomRightCorner.x - glyph.tightCanvasBox.topLeftCorner.x) / PIXEL_DENSITY + 1) + advancementOverrideForSmallSizes_CSS_Px;
      }
      // for all other sizes we use the advancement (width) as given by the browser
      else {
        x_CSS_Px += glyph.letterMeasures.width;
      }
    }

    // Next, apply the kerning correction ----------------------------

    const nextLetter = text[i + 1];
    let kerningCorrection = this.getKerningCorrection(fontFamily, fontStyle, fontWeight, fontSize, nextLetter, letter);

    // console.log("kerningCorrection: " + kerningCorrection);   (fontFamily, fontSize, fontStyle, fontWeight, correctionKey, kerning)
    
    // We apply kerning in two ways depending on the size of the font.
    //  * For large sizes we multiply the advancement of the letter by the kerning
    //  * For small sizes basically kerning means to decide whether to shorten the
    //    distance of two letters by 0, 1 or 2 pixels, so instead of multiplying the
    //    advancement of a letter by the kerning as we do for big sizes, we just
    //    discretise the kerning into a small number like 0,1 or 2.
    //
    //if (fontSize === 16) {
    //  debugger
    //}
    const kerningDiscretisationForSmallSizes_CSS_Px = glyph.getSingleFloatCorrectionForSizeBracket(fontFamily, fontSize, fontStyle, fontWeight, "Kerning discretisation for small sizes", kerningCorrection);
    if (kerningDiscretisationForSmallSizes_CSS_Px !== null) {
      //console.log("kerning was: " + kerningCorrection + " and is hence correction: " + kerningDiscretisationForSmallSizes_CSS_Px + " for letter " + letter + " and nextLetter " + nextLetter + " and fontSize " + fontSize + " and fontStyle " + fontStyle + " and fontFamily " + fontFamily);
      x_CSS_Px -= kerningDiscretisationForSmallSizes_CSS_Px;
    }
    else {
      // Tracking and kerning are both measured in 1/1000 em, a unit of measure that is relative to the current type size.
      // We don't use ems, rather we use pxs, however we still want to keep Kerning as strictly proportional to the current type size,
      // and also to keep it as a measure "in thousands".
      x_CSS_Px -= fontSize * kerningCorrection / 1000;
    }

    // since we might want to actually _place_ a glyph,
    // following this measurement, we want to return an
    // integer coordinate here
    return Math.round(x_CSS_Px);
  }

  getKerningCorrection(fontFamily, fontStyle, fontWeight, fontSize, nextLetter, letter) {
    //console.log("kerningTable at fontSize " + fontSize + " fontStyle " + fontStyle + " fontWeight " + fontWeight + " fontFamily " + fontFamily + " letter " + letter + " nextLetter " + nextLetter );
    // if there is no next letter, the kerning correction is 0
    let kerningCorrection = 0;
    if (ENABLE_KERNING && nextLetter) {
      let kerningCorrectionPlace = this.glyphStore.kerningTables[fontFamily][fontStyle][fontWeight][fontSize];
      // if the kerning correction is not in the kerning table, it's 0
      if (kerningCorrectionPlace[letter] && kerningCorrectionPlace[letter][nextLetter]) {
        kerningCorrection = kerningCorrectionPlace[letter][nextLetter];
      }
    }
    return kerningCorrection;
  }

  // Note that you can parse the fontSize fontFamily and font-style from the ctx.font string
  // HOWEVER for some quirks of Canvas implementaiton there is no way to read the font-weight
  // (i.e. "bold"). The only way would be to do some text rendering and then measure the text
  // and see if it's bold or not. This is not a good idea because it's slow.
  // So, the best way is to keep track of the font-family, font-size and
  // font-style that you use in your own code and pass as params.
  drawText(ctx, text, x_CSS_Px, y_CSS_Px, fontSize, fontFamily, fontStyle, fontWeight) {

    let x_Phys_Px = x_CSS_Px * PIXEL_DENSITY;
    const y_Phys_Px = y_CSS_Px * PIXEL_DENSITY;

    for (let i = 0; i < text.length; i++) {
      const letter = text[i];
      const glyph = this.glyphStore.getGlyph(fontFamily, fontSize, letter, fontStyle, fontWeight);


      if (glyph) {
        if (glyph.tightCanvas) {

          // Some glyphs protrude to the left of the x_Phys_Px that you specify, i.e. their
          // actualBoundingBoxLeft > 0, for example it's quite large for the
          // italic f in Times New Roman. The other glyphs that don't protrude to the left
          // simply have actualBoundingBoxLeft = 0.
          //
          // (Note that actualBoundingBoxLeft comes from the canvas measureText method, i.e.
          // it's not inferred from looking at how the canvas paints the glyph.)
          //
          // Hence, to render all glyphs correctly, you need to blit the glyph at
          //    x_Phys_Px - actualBoundingBoxLeft
          // so the part that should protrude to the left is actually partially blitted to
          // the left of x, as it should be.
          //
          // Note that if the fist character has a positive actualBoundingBoxLeft and we draw
          // at x = 0 on a canvas, the left part of the glyph will be cropped. This is same as
          // it happens with a standard Canvas - one should just position the text
          // carefully to avoid this (although it's rare that people actually take care of this).

          const actualBoundingBoxLeftPull_CSS_Px = Math.round(glyph.letterMeasures.actualBoundingBoxLeft);

          const yPos_Phys_Px = y_Phys_Px - glyph.tightCanvas.height - glyph.tightCanvas.distanceBetweenBottomAndBottomOfCanvas + 1 * PIXEL_DENSITY;
          const xPos_Phys_Px = x_Phys_Px - actualBoundingBoxLeftPull_CSS_Px * PIXEL_DENSITY;

          // For normal sizes:
          //    we use the same spacing as the canvas gave us for each glyph
          // For small sizes:
          //    we ignore the spacing that the canvas gave us because a) it's allover the place and
          //    b) it's not really needed. So we just blit the tightCanvas, we'll take care
          //    of the spacing simply via the advancement.
          //    So, in particular, the left spacing of the first character will be ignored, which really is
          //    not a big deal, this can be seen in capital R and a, where for small sizes straight-up
          //    touch the left side of the canvas.
          if (glyph.getSingleFloatCorrection(fontFamily, fontSize, fontStyle, fontWeight, "Advancement override for small sizes in px") !== null) {
            // NOT USED AT THE MOMENT, I'M NOT SURE THIS IS CORRECT
            // small sizes
            console.log("small size");
            ctx.drawImage(glyph.tightCanvas, xPos_Phys_Px, yPos_Phys_Px);
            alert("small size now is used!");
          }
          else {
            // normal sizes
            const leftSpacingAsGivenToUsByTheCanvas_Phys_Px = glyph.tightCanvasBox.topLeftCorner.x;
            // Example: the user asks to draw the potential bottom of the text (i.e. including the most descending parts
            // that might or might not be painted on that last row of pixels, depending on the letter, typically
            // "Ç" or "ç" or italic f in Times New Roman are the most descending letters, and they touch the bottom
            // because we set textBaseline to 'bottom'. If the letter does not touch the bottom, the number of empty rows
            // (obviously not in the tightCanvas because... it's tight) is measured by distanceBetweenBottomAndBottomOfCanvas)
            // at y = 20 (i.e. the 21st pixel starting from the top).
            // I.e. y = 20 (line 21) is the bottom-most row of pixels that the most descending letters would touch.
            // The tight canvas of the glyph is 10px tall, and
            // the distance between the bottom of the tight canvas and the bottom of the canvas is 5px.
            // Hence we paint the letter starting the top at row (20 + 1) - (10-1) - 5 = row 7. Row 7 i.e. y = 6.
            //   explained: (20+1) is the row of y = 20; - (10-1) brings you to the top of the tight canvas,
            //              and to leave 5 spaces below you have to subtract 5.
            // That's what we do below applying the formula below:
            //     y = 20 - 10 - 5 + 1 = 6.
            // Let's verify that: painting the first row of the letter at y = 6 i.e. row 7 means that the tight box will span from row 7 to row 16
            // (inclusive), and addind the distance of 5 pixels (5 empty rows), we get that the bottom of the canvas will be at row 16 + 5 = 21 i.e. y = 20
            // (which is what we wanted).
            // See https://www.w3schools.com/jsref/canvas_drawimage.asp
            ctx.drawImage(glyph.tightCanvas,
              // x, y -------------------
              xPos_Phys_Px + leftSpacingAsGivenToUsByTheCanvas_Phys_Px,
              y_Phys_Px - glyph.tightCanvas.height - glyph.tightCanvas.distanceBetweenBottomAndBottomOfCanvas + 1 * PIXEL_DENSITY);
          }
        }

        x_Phys_Px += this.calculateAdvancement_CSS_Px(i, text, glyph, fontFamily, letter, fontSize, fontStyle, fontWeight) * PIXEL_DENSITY;

      }
    }
  }


  drawTextFromGlyphSheet(ctx, text, x_CSS_Px, y_CSS_Px, fontSize, fontFamily, fontStyle, fontWeight) {

    let x_Phys_Px = x_CSS_Px * PIXEL_DENSITY;
    const y_Phys_Px = y_CSS_Px * PIXEL_DENSITY;

    const glyphsSheet = this.glyphStore.glyphsSheets[fontFamily][fontStyle][fontWeight][fontSize][PIXEL_DENSITY];


    for (let i = 0; i < text.length; i++) {
      const letter = text[i];
      const glyph = this.glyphStore.getGlyph(fontFamily, fontSize, letter, fontStyle, fontWeight);


      if (glyph) {
        if (glyph.tightCanvas) {

          // Some glyphs protrude to the left of the x_Phys_Px that you specify, i.e. their
          // actualBoundingBoxLeft > 0, for example it's quite large for the
          // italic f in Times New Roman. The other glyphs that don't protrude to the left
          // simply have actualBoundingBoxLeft = 0.
          //
          // (Note that actualBoundingBoxLeft comes from the canvas measureText method, i.e.
          // it's not inferred from looking at how the canvas paints the glyph.)
          //
          // Hence, to render all glyphs correctly, you need to blit the glyph at
          //    x_Phys_Px - actualBoundingBoxLeft
          // so the part that should protrude to the left is actually partially blitted to
          // the left of x, as it should be.
          //
          // Note that if the fist character has a positive actualBoundingBoxLeft and we draw
          // at x = 0 on a canvas, the left part of the glyph will be cropped. This is same as
          // it happens with a standard Canvas - one should just position the text
          // carefully to avoid this (although it's rare that people actually take care of this).

          // const actualBoundingBoxLeftPull_CSS_Px = Math.round(glyph.letterMeasures.actualBoundingBoxLeft);

          // const yPos_Phys_Px = y_Phys_Px - glyph.tightCanvas.height - glyph.tightCanvas.distanceBetweenBottomAndBottomOfCanvas + 1 * PIXEL_DENSITY;
          // const xPos_Phys_Px = x_Phys_Px - Math.round(glyph.letterMeasures.actualBoundingBoxLeft) * PIXEL_DENSITY;

          // For normal sizes:
          //    we use the same spacing as the canvas gave us for each glyph

          // normal sizes
          // const leftSpacingAsGivenToUsByTheCanvas_Phys_Px = glyph.tightCanvasBox.topLeftCorner.x;
          // see https://stackoverflow.com/a/6061102
          ctx.drawImage(glyphsSheet,
            // sx, sy -------------------
            glyph.xInGlyphSheet, 0,
            // sWidth, sHeight ----------
            glyph.tightWidth[PIXEL_DENSITY], glyph.tightHeight[PIXEL_DENSITY],
            // then dx, dy --------------
            x_Phys_Px + glyph.dx[PIXEL_DENSITY],
            // same formula for the y as ctx.drawText above, see explanation there
            y_Phys_Px + glyph.dy[PIXEL_DENSITY],
            // then dWidth, dHeight -----
            glyph.tightWidth[PIXEL_DENSITY], glyph.tightHeight[PIXEL_DENSITY]);

        }

        x_Phys_Px += this.calculateAdvancement_CSS_Px(i, text, glyph, fontFamily, letter, fontSize, fontStyle, fontWeight) * PIXEL_DENSITY;

      }
    }
  }

}
