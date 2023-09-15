// a class CrispBitmpTextDrawer, constructed with a CrispBitmapGlyphStore
// has a method to draw text on a canvas
// the text is drawn by looking up the glyphs in the CrispBitmapGlyphStore
// and drawing them on the canvas one after the other, advancing the x position by the width of the glyph
// the text is drawn with the top bottom left corner of the first glyph at the x, y position specified
class CrispBitmapText {
  constructor(glyphStore) {
    this.glyphStore = glyphStore;
  }

  measureText(text, fontSize, fontFamily, fontEmphasis) {
    var width = 0;
    for (let i = 0; i < text.length; i++) {
      const letter = text[i];

      const glyph = this.glyphStore.getGlyph(fontFamily, fontSize, letter, fontEmphasis);

      width += this.getAdvanceWidth(i, text, glyph, fontFamily, letter, fontSize, fontEmphasis);
    }
    // get the height of the text by looking at the height of 'a' - they are all the same height
    const glyph = this.glyphStore.getGlyph(fontFamily, fontSize, 'a', fontEmphasis);
    return { width, height: Math.round(glyph.letterMeasures.fontBoundingBoxAscent + glyph.letterMeasures.fontBoundingBoxDescent) };
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
              console.log("kerning correction for " + letter + " " + nextLetter + " is " + kerning.adjustment);
              return kerning.adjustment;
            }
          }
        }
      }

      return 0;
    }


    if (fontFamily === 'Arial' && fontSize <= 21) {
      if (letter === 'A' && this.isShortCharacter(nextLetter)) {
        return 0.1;
      }
    }

    if (fontFamily === 'Arial' && fontSize <= 20) {
      if ((['f', 't', 'v', 'y'].indexOf(letter) !== -1) || (['f', 't', 'v', 'y'].indexOf(nextLetter) !== -1)) {
        return 0.1;
      }
      if (['r', 'k'].indexOf(letter) !== -1) {
        return 0.1;
      }

      if (letter === 'p' && nextLetter === 'a') {
        return 0.1;
      }

      if (letter === 'c' && nextLetter === 'y') {
        return 0.1;
      }

      //if (letter === 'c' && nextLetter === 'c') {
      //  return 0.1;
      //}
    }

    // the j at sizes 21-23 is too close to the previous letter
    // and I can't fix this any other way, so I'm using this
    // anti-kerning hack here
    if (fontFamily === 'Arial' && (fontSize >= 21 && fontSize <= 23)) {
      if (['j'].indexOf(nextLetter) !== -1) {
        return -0.15;
      }
    }

    // monospace fonts don't need kerning
    if (fontFamily === 'Courier New') {
      return 0;
    }

    // in my OS and my browser, the crisp rendering of consecutive V and W are joined together at the top,
    // which makes things like "WWW" just look like single zipgzag. Note that this doesn't happen in the
    // antialiased render. At any rate, we are going to correct the spacing between those pairs here.
    if (fontFamily === 'Arial' && (letter === 'W' || letter === 'V') && (nextLetter === 'W' || nextLetter === 'V')) {
      return -0.04;
    }

    if ((this.protrudesBottomRight(letter) && this.hasSomeSpaceAtBottomLeft(nextLetter)) || (this.hasSomeSpaceAtBottomRight(letter) && this.protrudesBottomLeft(nextLetter))) {
      if (fontFamily === 'Arial') {
        return 0.1;
      }
      else if (fontFamily === 'Times New Roman') {
        return 0.1;
      }
      else {
        return 0.1;
      }
    }
    if ((this.hasLotsOfSpaceAtBottomRight(letter) && this.protrudesBottomLeft(nextLetter)) || (this.protrudesBottomRight(letter) && this.hasLotsOfSpaceAtBottomLeft(nextLetter))) {
      if (fontFamily === 'Arial') {
        return 0.15;
      }
      else if (fontFamily === 'Times New Roman') {
        return 0.2;
      }
      else {
        return 0.1;
      }
    }

    if (this.hasSpaceAtTopRight(letter) && this.protrudesTopLeft(nextLetter)) {
      if (fontFamily === 'Times New Roman') {
        return 0.2;
      }
      else {
        return 0.13;
      }
    }
    if ((this.isShortCharacter(letter) && this.hasSomeSpaceAtBottomLeft(nextLetter)) || (this.hasSomeSpaceAtBottomRight(letter) && this.isShortCharacter(nextLetter))) {
      if (fontFamily === 'Arial') {
        return 0.01;
      }
      else if (fontFamily === 'Times New Roman') {
        return 0.1;
      }
      else {
        return 0.1;
      }
    }
    if ((this.hasLotsOfSpaceAtBottomRight(letter) && this.isShortCharacter(nextLetter)) || (this.isShortCharacter(letter) && this.hasLotsOfSpaceAtBottomLeft(nextLetter))) {
      if (fontFamily === 'Arial') {
        return 0.15;
      }
      else if (fontFamily === 'Times New Roman') {
        return 0.15;
      }
      else {
        return 0.1;
      }
    }
    if (this.isShortCharacter(letter) && this.protrudesTopLeft(nextLetter)) {
      return 0.03;
    }
    return 0;
  }


  // get the advancement needed for the i-th character i.e. needed after the i-th character
  // so that the i+1-th character is drawn at the right place
  getAdvanceWidth(i, text, glyph, fontFamily, letter, fontSize, fontEmphasis) {
    var x = 0;


    // if glyph doesn't contain the letter, log out an error with the missing letter
    if (!glyph) {
      console.log("glyph doesn't contain the letter " + letter);
    }

    // if it's not the last character
    if (i < text.length - 1) {

      // You could add the space advancement as we got it from the browser
      // (remember that the space doesn't have the tightCanvasBox)
      // but since at small sizes we meddle with kerning quite a bit, we want
      // to also meddle with this to try to make the width of text
      // similar to what the browser paints normally.
      // console.log(glyph.letterMeasures.width + " " + x);
      // deal with the size of the " " character
      if (fontFamily === 'Arial') {
        if (glyph.letter === " ") {
          if (fontSize >= 15 && fontSize <= 20)
            return 5;
          else if (fontSize >= 14 && fontSize < 15)
            return 4;
          else if (fontSize >= 12 && fontSize < 14)
            return 3;
          else if (fontSize < 12)
            return 2;
        }
      }

      // I THINK WE SHOULD ADD THE actualBoundingBoxLeft NOT HERE BUT OUTSIDE
      // WHERE YOU CALL getAdvanceWidth
      // for the first character you need to further advance by the actualBoundingBoxLeft
      // because the first character is not drawn at x, but at x - actualBoundingBoxLeft
      if (i == 0) {
        x = glyph.letterMeasures.actualBoundingBoxLeft;
      }

      // for small sizes we create our own advancement (width)
      // also in the case of space there is no tightCanvasBox
      if (fontFamily === 'Arial' && fontSize > 11 && fontSize <= 20 && letter !== ' ') {
        x += (glyph.tightCanvasBox.bottomRightCorner.x - glyph.tightCanvasBox.topLeftCorner.x + 1) + 2;
      }
      else if (fontFamily === 'Arial' && fontSize <= 11 && letter !== ' ') {
        x += (glyph.tightCanvasBox.bottomRightCorner.x - glyph.tightCanvasBox.topLeftCorner.x + 1) + 1;
      }
      // for the space (which doesn't have the tightCanvasBox) and bigger sizes we obey what originally came from the browser
      else {
        x += glyph.letterMeasures.width;
      }

      const nextLetter = text[i + 1];
      const kerningCorrection = this.getKerningCorrection(fontFamily, letter, nextLetter, fontSize, fontEmphasis);

      // console.log("kerningCorrection: " + kerningCorrection);
      if (fontFamily === 'Arial' && fontSize <= 20) {
        if (kerningCorrection > 0 && kerningCorrection < 0.145) {
          x -= 1;
        }
        else if (kerningCorrection > 0.145) {
          x -= 2;
        }
      }
      else {
        x -= glyph.letterMeasures.width * kerningCorrection;
      }
    }
    else {
      // with the last character you don't just advance by the advance with,
      // rather you need to add the actualBoundingBoxRight
      if (fontFamily === 'Arial' && fontSize <= 20) {
        x += (glyph.tightCanvasBox.bottomRightCorner.x - glyph.tightCanvasBox.topLeftCorner.x + 1) + 2;
      }
      else {
        x += glyph.letterMeasures.actualBoundingBoxRight;
      }
    }
    return Math.round(x);
  }

  drawText(ctx, text, x, y, fontSize, fontFamily, fontEmphasis) {
    for (let i = 0; i < text.length; i++) {
      const letter = text[i];
      const glyph = this.glyphStore.getGlyph(fontFamily, fontSize, letter, fontEmphasis);


      if (glyph) {
        if (glyph.tightCanvas) {

          // some letters protrude to the left, i.e. the so called actualBoundingBoxLeft
          // is positive, for example it's quite large for the italic f in Times New Roman.
          // For these characters you basically draw them at x - actualBoundingBoxLeft
          // but for the first character you don't want to do that, because it would be
          // drawn outside the canvas. So for the first character you draw it at x.
          // TODO SURELY THERE IS A BETTER NAME FOR THIS VARIABLE THAN "slightlyToTheLeft"
          var slightlyToTheLeft = Math.round(glyph.letterMeasures.actualBoundingBoxLeft);
          if (i == 0)
            slightlyToTheLeft = 0;

          if (fontFamily === 'Arial' && fontSize <= 20) {
            ctx.drawImage(glyph.tightCanvas, x - slightlyToTheLeft, y - glyph.tightCanvas.height - glyph.tightCanvas.distanceBetweenBottomAndBottomOfCanvas + 2);
          }
          else {
            ctx.drawImage(glyph.tightCanvas, x - slightlyToTheLeft + glyph.tightCanvasBox.topLeftCorner.x, y - glyph.tightCanvas.height - glyph.tightCanvas.distanceBetweenBottomAndBottomOfCanvas + 2);
          }
        }

        // I think we should add the actualBoundingBoxLeft right here i.e. doing
        // x += slightlyToTheLeft + all this below
        x += this.getAdvanceWidth(i, text, glyph, fontFamily, letter, fontSize, fontEmphasis);

      }
    }
  }
}
