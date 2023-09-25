// a class CrispBitmpTextDrawer, constructed with a CrispBitmapGlyphStore
// has a method to draw text on a canvas
// the text is drawn by looking up the glyphs in the CrispBitmapGlyphStore
// and drawing them on the canvas one after the other, advancing the x position by the width of the glyph
// the text is drawn with the top bottom left corner of the first glyph at the x, y position specified
class CrispBitmapText {
  constructor(glyphStore) {
    this.glyphStore = glyphStore;
  }

  // TODO all the vertical metrics done properly.
  // This returns an object of the same shape
  // and meaning as the TextMetrics object (see
  // https://developer.mozilla.org/en-US/docs/Web/API/TextMetrics ) i.e.:
  //  * the width should be the sum of the advancements (detracting kerning)
  //  * actualBoundingBoxLeft =
  //      the actualBoundingBoxLeft of the first character
  //  * actualBoundingBoxRight =
  //      the sum of the advancements (detracting kerning) EXCLUDING the one of the last char, plus the actualBoundingBoxRight of the last char
  measureText(text, fontSize, fontFamily, fontEmphasis) {
    
    if (text.length === 0)
      return { width: 0, height: 0, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 0};
    
    var width = 0;
    var actualBoundingBoxLeft = this.glyphStore.getGlyph(fontFamily, fontSize, text[0], fontEmphasis).letterMeasures.actualBoundingBoxLeft;
    var actualBoundingBoxRight = 0;
    var advancement = 0;
    var glyph = null;

    for (let i = 0; i < text.length; i++) {
      const letter = text[i];

      glyph = this.glyphStore.getGlyph(fontFamily, fontSize, letter, fontEmphasis);

      advancement = this.calculateAdvancement(i, text, glyph, fontFamily, letter, fontSize, fontEmphasis);
      width += advancement;
    }

    // the actualBoundingBoxRight is the sum of all the advancements (detracting kerning) up to the last character...
    actualBoundingBoxRight = width - advancement;
    // ... plus the actualBoundingBoxRight of the last character
    // (this is in place of adding its advancement)
    actualBoundingBoxRight += glyph.letterMeasures.actualBoundingBoxRight; 

    // get the height of the text by looking at the height of 'a' - they are all the same height
    glyph = this.glyphStore.getGlyph(fontFamily, fontSize, 'a', fontEmphasis);
    return { width: width, height: Math.round(glyph.letterMeasures.fontBoundingBoxAscent + glyph.letterMeasures.fontBoundingBoxDescent), actualBoundingBoxLeft: actualBoundingBoxLeft, actualBoundingBoxRight: actualBoundingBoxRight };
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


  getKerningCorrection(fontFamily, letter, nextLetter, fontSize, fontEmphasis) {

    if (fontSize <= specs[fontFamily][fontEmphasis]["Kerning cutoff"]) {
      return 0;
    }

    if (USE_KERNING_FROM_SPECS) {
      // for all entries in the Kerning array with a sizeRange that includes the current font size
      //   get the kerning array and for each one:
      //     if letter matches any of the letters in the "left" object or the "left" object is "*any*" and the nextLetter matches any of the letters in the "right" object or the "right" object is "*any*"
      //       return the value of the "adjustment" property
      for (let i = 0; i < specs[fontFamily][fontEmphasis]["Kerning"].length; i++) {
        const kerningEntry = specs[fontFamily][fontEmphasis]["Kerning"][i];
        if (kerningEntry.sizeRange.from <= fontSize && kerningEntry.sizeRange.to >= fontSize) {
          // scan the kerningEntry.kerning array
          for (let j = 0; j < kerningEntry.kerning.length; j++) {
            const kerning = kerningEntry.kerning[j];
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


  // Get the advancement of the i-th character i.e. needed AFTER the i-th character
  // so that the i+1-th character is drawn at the right place
  // This depends on both the advancement specified by the glyph of the i-th character
  // AND by the kerning correction depending on the pair of the i-th and i+1-th characters
  calculateAdvancement(i, text, glyph, fontFamily, letter, fontSize, fontEmphasis) {
    // if (letter === ' ') debugger

    // if glyph doesn't contain the letter, log out an error with the missing letter
    if (!glyph) {
      console.log("glyph doesn't contain the letter " + letter);
    }

    var x = 0;

    // TODO this "space" section should handle all characters without a glyph
    //      as there are many kinds of space-like characters.

    // Handle space first ------------------------------------------
    // You could add the space advancement as we got it from the browser
    // (remember that the space doesn't have the tightCanvasBox)
    // but since at small sizes we meddle with kerning quite a bit, we want
    // to also meddle with this to try to make the width of text
    // similar to what the browser paints normally.
    // console.log(glyph.letterMeasures.width + " " + x);
    // deal with the size of the " " character
    if (letter === " ") {
      const spaceAdvancementOverrideForSmallSizesInPx = glyph.getSingleFloatCorrection(fontFamily, fontSize, fontEmphasis, "Space advancement override for small sizes in px");
      if (spaceAdvancementOverrideForSmallSizesInPx !== null) {
        x += spaceAdvancementOverrideForSmallSizesInPx;
      }
      else {
        x += glyph.letterMeasures.width;
      }
    }
    // Non-space characters ------------------------------------------
    else {
      // for small sizes we create our own advancement (width)
      const advancementOverrideForSmallSizesInPx = glyph.getSingleFloatCorrection(fontFamily, fontSize, fontEmphasis, "Advancement override for small sizes in px");
      //console.log("advancementOverrideForSmallSizesInPx: " + advancementOverrideForSmallSizesInPx);
      if (advancementOverrideForSmallSizesInPx !== null) {
        x += (glyph.tightCanvasBox.bottomRightCorner.x - glyph.tightCanvasBox.topLeftCorner.x + 1) + advancementOverrideForSmallSizesInPx;
      }
      // for all other sizes we use the advancement (width) as given by the browser
      else {
        x += glyph.letterMeasures.width;
      }
    }

    // Next, apply the kerning correction ----------------------------

    const nextLetter = text[i + 1];
    const kerningCorrection = this.getKerningCorrection(fontFamily, letter, nextLetter, fontSize, fontEmphasis);

    // console.log("kerningCorrection: " + kerningCorrection);   (fontFamily, fontSize, fontEmphasis, correctionKey, kerning)
    
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
    const kerningDiscretisationForSmallSizes = glyph.getSingleFloatCorrectionForSizeBracket(fontFamily, fontSize, fontEmphasis, "Kerning discretisation for small sizes", kerningCorrection);
    if (kerningDiscretisationForSmallSizes !== null) {
      //console.log("kerning was: " + kerningCorrection + " and is hence correction: " + kerningDiscretisationForSmallSizes + " for letter " + letter + " and nextLetter " + nextLetter + " and fontSize " + fontSize + " and fontEmphasis " + fontEmphasis + " and fontFamily " + fontFamily);
      x -= kerningDiscretisationForSmallSizes;
    }
    else {
      x -= glyph.letterMeasures.width * kerningCorrection;
    }

    // since we might want to actually _place_ a glyph,
    // following this measurement, we want to return an
    // integer coordinate here
    return Math.round(x);
  }

  drawText(ctx, text, x, y, fontSize, fontFamily, fontEmphasis) {
    for (let i = 0; i < text.length; i++) {
      const letter = text[i];
      const glyph = this.glyphStore.getGlyph(fontFamily, fontSize, letter, fontEmphasis);


      if (glyph) {
        if (glyph.tightCanvas) {

          // Some glyphs protrude to the left of the x that you specify, i.e. their
          // actualBoundingBoxLeft > 0, for example it's quite large for the
          // italic f in Times New Roman. The other glyphs that don't protrude to the left
          // simply have actualBoundingBoxLeft = 0.
          //
          // (Note that actualBoundingBoxLeft comes from the canvas measureText method, i.e.
          // it's not inferred from looking at how the canvas paints the glyph.)
          //
          // Hence, to render all glyphs correctly, you need to blit the glyph at
          //    x - actualBoundingBoxLeft
          // so the part that should protrude to the left is actually partially blitted to
          // the left of x, as it should be.
          //
          // Note that if the fist character has a positive actualBoundingBoxLeft and we draw
          // at x = 0 on a canvas, the left part of the glyph will be cropped. This is same as
          // it happens with a standard Canvas - one should just position the text
          // carefully to avoid this (although it's rare that people actually take care of this).

          var actualBoundingBoxLeftPull = Math.round(glyph.letterMeasures.actualBoundingBoxLeft);

          var yPos = y - glyph.tightCanvas.height - glyph.tightCanvas.distanceBetweenBottomAndBottomOfCanvas + 2;
          var xPos = x - actualBoundingBoxLeftPull;

          // For normal sizes:
          //    we use the same spacing as the canvas gave us for each glyph
          // For small sizes:
          //    we ignore the spacing that the canvas gave us because a) it's allover the place and
          //    b) it's not really needed. So we just blit the tightCanvas, we'll take care
          //    of the spacing simply via the advancement.
          //    So, in particular, the left spacing of the first character will be ignored, which really is
          //    not a big deal, this can be seen in capital R and a, where for small sizes straight-up
          //    touch the left side of the canvas.
          if (glyph.getSingleFloatCorrection(fontFamily, fontSize, fontEmphasis, "Advancement override for small sizes in px") !== null) {
            // small sizes
            console.log("small size");
            ctx.drawImage(glyph.tightCanvas, xPos, yPos);
          }
          else {
            // normal sizes
            var leftSpacingAsGivenToUsByTheCanvas = glyph.tightCanvasBox.topLeftCorner.x;
            ctx.drawImage(glyph.tightCanvas, xPos + leftSpacingAsGivenToUsByTheCanvas, y - glyph.tightCanvas.height - glyph.tightCanvas.distanceBetweenBottomAndBottomOfCanvas + 2);
          }
        }

        x += this.calculateAdvancement(i, text, glyph, fontFamily, letter, fontSize, fontEmphasis);

      }
    }
  }
}
