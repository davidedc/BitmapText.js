class CrispBitmapGlyph_Full {
  constructor(letter, fontSize, fontFamily, fontStyle, fontWeight) {
    this.letter = letter;
    this.fontSize = fontSize;
    this.fontFamily = fontFamily;
    this.fontStyle = fontStyle;
    this.fontWeight = fontWeight;

    const { canvas, tightCanvas, tightCanvasBox, letterMeasures } = this.createCanvases();
    this.canvas = canvas;
    this.tightCanvas = tightCanvas;
    this.tightCanvasBox = tightCanvasBox;

    // this.letterMeasures = letterMeasures;
    setNestedProperty(crispBitmapGlyphStore_Full.compact_glyphs_measures, [this.fontFamily, this.fontStyle, this.fontWeight, this.fontSize, this.letter], letterMeasures);

    this.displayCanvasesAndData();
  }

  displayCanvasesAndData() {
    document.body.appendChild(this.canvas);
    if (!this.tightCanvas) {
      document.body.appendChild(document.createElement('div'));
    } else {
      document.body.appendChild(this.tightCanvas);
    }
  }

  // this method can be refactored with the next one
  getSingleFloatCorrectionForLetter(fontFamily, letter, nextLetter, fontSize, fontStyle, fontWeight, correctionKey, pixelDensity) {

    // if specs[fontFamily][fontStyle][fontWeight][correctionKey] doesn't exist
    if (!specCombinationExists(fontFamily, fontStyle, fontWeight, correctionKey)) {
      return 0;
    }

    if (fontSize <= specs[fontFamily][fontStyle][fontWeight][correctionKey]) {
      return 0;
    }
  
    for (const element of specs[fontFamily][fontStyle][fontWeight][correctionKey]) {
      const correctionEntry = element;
      if (correctionEntry.sizeRange == undefined) return 0;

      // check if the passed pixelDensity is the same as the one in the correctionEntry
      // if not, return 0
      // if (pixelDensity !== null) debugger;
      if (pixelDensity !== null && correctionEntry.sizeRange.pixelDensity !== null && pixelDensity !== correctionEntry.sizeRange.pixelDensity) continue;

      if (correctionEntry.sizeRange.from <= fontSize && correctionEntry.sizeRange.to >= fontSize) {
        for (const element of correctionEntry.lettersAndTheirCorrections) {
          const charAndOffset = element;
          if (charAndOffset.string.indexOf(letter) !== -1) {
            return charAndOffset.adjustment;
          }
        }
      }
    }
  
    return 0;
  }

  getSingleFloatCorrection(fontFamily, fontSize, fontStyle, fontWeight, correctionKey) {

    // if specs[fontFamily][fontStyle][fontWeight][correctionKey] doesn't exist
    if (!specCombinationExists(fontFamily, fontStyle, fontWeight, correctionKey)) {
      return null;
    }

    if (fontSize <= specs[fontFamily][fontStyle][fontWeight][correctionKey]) {
      return null;
    }
  
    for (const element of specs[fontFamily][fontStyle][fontWeight][correctionKey]) {
      const correctionEntry = element;
      if (correctionEntry.sizeRange == undefined) return null;
      if (correctionEntry.sizeRange.from <= fontSize && correctionEntry.sizeRange.to >= fontSize) {
        return correctionEntry.correction;
      }
    }
  
    return null;
  }


  createCanvasWithLetter() {
    const canvas = document.createElement('canvas');

    // add the canvas to the page otherwise the
    // CSS font smoorhing properties are not applied
    // I tried setting the properties via javascript
    // like this:
    //   canvas.style["-webkit-font-smoothing"] = "none";
    //   canvas.style["-moz-osx-font-smoothing"] = "none";
    //   canvas.style["font-smooth"] = "never";
    // but it didn't work
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    ctx.font = `${this.fontStyle} ${this.fontWeight} ${this.fontSize}px ${this.fontFamily}`;

    // size the canvas so it fits the this.letter
    const letterMeasuresOrig = ctx.measureText(this.letter);

    // let's make a copy of letterMeasuresOrig into letterMeasures
    // so we can modify it
    let letterMeasures = {};
    for (let key in letterMeasuresOrig) {
      letterMeasures[key] = letterMeasuresOrig[key];
    }

    // for the space character, Chrome gives actualBoundingBoxLeft == actualBoundingBoxRight == 0
    // even if the width is not 0. Since we are going to use the actualBoundingBoxLeft and actualBoundingBoxRight
    // to size the canvas, we need to fix that.
    if (letterMeasures.actualBoundingBoxLeft === 0 && letterMeasures.actualBoundingBoxRight === 0) {
      letterMeasures.actualBoundingBoxRight = letterMeasures.width;
    }

    //////////////////////////////////////////////
    // START OF LETTER-LEVEL RENDERING CORRECTIONS
    //////////////////////////////////////////////
    // These defects we are fixing are visible at small sizes (12px or so), however
    // that's a crucial use case for a crisp text renderer.
    // The defects to be corrected can be spotted by disabling all the kerning corrections and
    // rendering at size 12 (pretty much the smallest legible size) and looking
    // for problems like letters that touch, letters that miss a pixel, letter that
    // are systematically too far/close to the previous/next, etc.
    // These corrections are specific to the font, and also
    // likely specific to the OS, browser and possibly
    // depend on other factors like the screen resolution, etc.
    // HOWEVER once we fix them, we bake the letters and their sizes and
    // the kerning info into a format that we re-use pixel-perfectly in all
    // OSs and browsers, so these corrections only need to be done in
    // one place to get a good rendering everywhere.
    // for the letter "W" Arial 80px let's add 2 pixels to the actualBoundingBoxRight...
    // ...don't understand why, but the actualBoundingBoxLeft + actualBoundingBoxRight
    // is not enough to fit the letter in the canvas and the top-right gets ever so slightly clipped...

    // get the specs for "ActualBoundingBoxLeft correction px" of this
    // font family and style and weight and size
    

    letterMeasures.actualBoundingBoxLeft += this.getSingleFloatCorrectionForLetter(this.fontFamily, this.letter, null, this.fontSize, this.fontStyle, this.fontWeight, "ActualBoundingBoxLeft correction px");
    //console.log ("letterMeasures.actualBoundingBoxLeft: " + letterMeasures.actualBoundingBoxLeft);
    letterMeasures.actualBoundingBoxRight += this.getSingleFloatCorrectionForLetter(this.fontFamily, this.letter, null, this.fontSize, this.fontStyle, this.fontWeight, "ActualBoundingBoxRight correction px");
    //console.log ("letterMeasures.actualBoundingBoxRight: " + letterMeasures.actualBoundingBoxRight);
    letterMeasures.actualBoundingBoxLeft += Math.floor(this.fontSize * this.getSingleFloatCorrectionForLetter(this.fontFamily, this.letter, null, this.fontSize, this.fontStyle, this.fontWeight, "ActualBoundingBoxLeft correction proportional"));
    //console.log ("letterMeasures.actualBoundingBoxLeft: " + letterMeasures.actualBoundingBoxLeft);
    letterMeasures.actualBoundingBoxRight += Math.floor(this.fontSize * this.getSingleFloatCorrectionForLetter(this.fontFamily, this.letter, null, this.fontSize, this.fontStyle, this.fontWeight, "ActualBoundingBoxRight correction proportional"));
    //console.log ("letterMeasures.actualBoundingBoxRight: " + letterMeasures.actualBoundingBoxRight);
    letterMeasures.width += Math.floor(this.fontSize * this.getSingleFloatCorrectionForLetter(this.fontFamily, this.letter, null, this.fontSize, this.fontStyle, this.fontWeight, "Advancement correction proportional"));
    //console.log ("letterMeasures.width: " + letterMeasures.width);
  


    // END OF LETTER-LEVEL RENDERING CORRECTIONS
    /////////////////////////////////////////////

    // Happens at small sizes due to a browser rendering defect.
    // This correction will simply paint the letter
    // n pixel more to the right in the mini canvas
    const cropLeftCorrection_CSS_Px = this.getSingleFloatCorrectionForLetter(this.fontFamily, this.letter, null, this.fontSize, this.fontStyle, this.fontWeight, "CropLeft correction px", PIXEL_DENSITY);

    const canvasPixelsWidth = Math.round(letterMeasures.actualBoundingBoxLeft + letterMeasures.actualBoundingBoxRight);
    canvas.style.width = canvasPixelsWidth + 'px';
    canvas.width = canvasPixelsWidth * PIXEL_DENSITY;

    // add a div with letterMeasures.actualBoundingBoxLeft + letterMeasures.actualBoundingBoxRight
    const div = document.createElement('div');
    div.textContent = this.letter + " bbox left: " + letterMeasures.actualBoundingBoxLeft + " bbox right:" + letterMeasures.actualBoundingBoxRight;

    // add to the textcontent the actualBoundingBoxLeft in red if it's not 0
    if (letterMeasures.actualBoundingBoxLeft !== 0) {
      div.style.color = "red";
    }

    document.body.appendChild(div);

    const canvasPixelsHeight = Math.round(letterMeasures.fontBoundingBoxAscent + letterMeasures.fontBoundingBoxDescent);;
    canvas.style.height = canvasPixelsHeight + 'px';
    canvas.height = canvasPixelsHeight * PIXEL_DENSITY;

    ctx.scale(PIXEL_DENSITY, PIXEL_DENSITY);

    // make the background white
    // ctx.fillStyle = 'white';
    // ctx.fillRect(0, 0, canvas.width / PIXEL_DENSITY, canvas.height / PIXEL_DENSITY);
    // draw the text so that it fits in the canvas.
    // The chosen x,y is at the crossing of the first column and last row
    // of where any pixel can be drawn.
    // see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textBaseline
    ctx.textBaseline = 'bottom';

    ctx.font = this.fontStyle + " " + this.fontWeight + " " + this.fontSize + 'px ' + this.fontFamily;

    // you have to start painting the letter at actualBoundingBoxLeft because that's how much
    // TO THE LEFT OF THAT POINT that letter will ALSO extend
    ctx.fillText(this.letter, Math.round(letterMeasures.actualBoundingBoxLeft) + cropLeftCorrection_CSS_Px, canvas.height / PIXEL_DENSITY - 1);

    // now can remove the canvas from the page
    canvas.remove();

    return { canvas, letterMeasures };
  }

  getBoundingBoxOfOnPixels(canvas) {
    // get the image data, and from it get the tight bounding box of the letter/text
    const onPixelsArray = this.getOnPixelsArray(canvas);
    const tightCanvasBox = this.getBoundingBox(canvas, onPixelsArray);

    ///////////////////////////////////////////////////////////////////
    // Copy the tight canvas box to a new canvas and add it to the page
    // so you can look at it / inspect it if needed.
    ///////////////////////////////////////////////////////////////////

    const tightCanvas = document.createElement('canvas');

    if (tightCanvasBox.topLeftCorner === null || tightCanvasBox.bottomRightCorner === null) {
      return { tightCanvas: null, tightCanvasBox: null };
    }

    // Note on why you multiply +1 and -1 by PIXEL_DENSITY: -----------------------
    // it's a good idea to keep the physical pixels divisible by PIXEL_DENSITY
    // just for purity reasons, and also in theory it should make the scaling down
    // of the canvas look better.
    // ----------------------------------------------------------------------------

    // Always add one to these coordinatest subtractions!
    // Example: if the canvas right has an x of 15 (i.e. SIXTEENTH pixel from left) and the left is 5 (i.e. SIXTH pixel from left),
    // then the width of the tight canvas is 15 - 5 + 1 = 11
    const tightCanvasPixelsWidth = tightCanvasBox.bottomRightCorner.x - tightCanvasBox.topLeftCorner.x + 1 * PIXEL_DENSITY;
    tightCanvas.style.width = tightCanvasPixelsWidth / PIXEL_DENSITY + 'px';
    tightCanvas.width = tightCanvasPixelsWidth;

    // Always add one to these coordinatest subtractions!
    // Example: if the canvas bottom has a y of 15 (i.e. SIXTEENTH pixel from top) and the top is 5 (i.e. SIXTH pixel from top),
    // then the height of the tight canvas is 15 - 5 + 1 = 11
    const tightCanvasPixelsHeight = tightCanvasBox.bottomRightCorner.y - tightCanvasBox.topLeftCorner.y + 1 * PIXEL_DENSITY;
    tightCanvas.style.height = tightCanvasPixelsHeight / PIXEL_DENSITY + 'px';
    tightCanvas.height = tightCanvasPixelsHeight;

    // This one is a distance so you have to subtract 1
    // Example: if the canvas is 15 tall and the bottomRightCorner.y (i.e. the bottom of the tight canvas)
    // is 5 (which means it's on the SIXTH pixel down from the top), then
    // the distance between the bottom of the canvas and the bottom of the tight canvas box is 15 - 5 - 1 = 9
    tightCanvas.distanceBetweenBottomAndBottomOfCanvas = canvas.height - tightCanvasBox.bottomRightCorner.y - 1 * PIXEL_DENSITY;

    // Now draw the tight canvas
    const tightCanvasBoxCtx = tightCanvas.getContext('2d');
    // avoid scaling here and just use physical pixels coordinates and sizes since the source and destination canvases have the same scale
    tightCanvasBoxCtx.drawImage(canvas, tightCanvasBox.topLeftCorner.x , tightCanvasBox.topLeftCorner.y , tightCanvas.width , tightCanvas.height , 0, 0, tightCanvas.width , tightCanvas.height );

    return { tightCanvas, tightCanvasBox };
  }

  createCanvases() {
    const { canvas, letterMeasures } = this.createCanvasWithLetter();
    const { tightCanvas, tightCanvasBox } = this.getBoundingBoxOfOnPixels(canvas);

    if (!tightCanvas)
      return { canvas, tightCanvas: null, tightCanvasBox: null, letterMeasures };

    const div = document.createElement('div');
    div.textContent = "tightCanvasBox width in px, phys: " + (tightCanvasBox.bottomRightCorner.x - tightCanvasBox.topLeftCorner.x) + " css: " + (tightCanvasBox.bottomRightCorner.x - tightCanvasBox.topLeftCorner.x) / PIXEL_DENSITY; 
    document.body.appendChild(div);

    return { canvas, tightCanvas, tightCanvasBox, letterMeasures };
  }

  // function that gets the bounding box of the text and its position, by looking at the pixels
  getBoundingBox(canvas, onPixelsArray) {
    // find the top left and bottom right corners of the text
    let topLeftCorner = null;
    let bottomRightCorner = null;

    for (let i = 0; i < onPixelsArray.length; i++) {
      if (onPixelsArray[i]) {
        const x = i % canvas.width;
        const y = Math.floor(i / canvas.width);

        if (topLeftCorner === null) {
          topLeftCorner = { x, y };
        }

        if (bottomRightCorner === null) {
          bottomRightCorner = { x, y };
        }
        bottomRightCorner.y = y;

        if (x < topLeftCorner.x) {
          topLeftCorner.x = x;
        }
        if (x > bottomRightCorner.x) {
          bottomRightCorner.x = x;
        }
      }
    }

    // return the bounding box
    return {
      topLeftCorner,
      bottomRightCorner
    };
  }

  getOnPixelsArray(canvas) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // create a new array with a boolean for each pixel to represent whether it is on or not
    // note that the color in which the character is painted doesn't matter, we are just looking
    // for pixels that are not transparent
    const pixels = [];
    for (let i = 0; i < data.length; i += 4) {
      // isOn is when any of the components is 0 AND the alpha is not 0
      // that's because we are working with canvases with transparent backgrounds
      // because glyphs often have are painted on top of other content AND also
      // because glyphs actually often have to overlap with each other e.g. in the case of "ff" in Times New Roman
      const isOn = data[i + 3] !== 0;
      pixels.push(isOn);
    }
    return pixels;
  }
}