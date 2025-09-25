class GlyphFAB {
  constructor(letter, fontProperties) {
    this.letter = letter;
    this.fontProperties = fontProperties;

    const {
      canvas,
      tightCanvas,
      tightCanvasBox,
      letterTextMetrics
    } = this.createCanvasesAndCharacterMetrics();
    this.canvas = canvas;
    this.tightCanvas = tightCanvas;
    this.tightCanvasBox = tightCanvasBox;

    // characterMetrics actually belongs to the fontMetricsStore
    // which is separate from the AtlasStoreFAB class
    fontMetricsStoreFAB.setCharacterMetrics(this.fontProperties, letter, letterTextMetrics);

    this.displayCanvasesAndData();
  }

  displayCanvasesAndData() {
    document.body.appendChild(this.canvas);
    if (!this.tightCanvas) {
      document.body.appendChild(document.createElement("div"));
    }
    else {
      document.body.appendChild(this.tightCanvas);
    }
  }

  createCanvasWithCharacterAndGetItsMetricss() {
    const { pixelDensity, fontFamily, fontStyle, fontWeight, fontSize } = this.fontProperties;
    const canvas = document.createElement("canvas");

    if (drawCrisply) {
      // add the canvas to the page otherwise the
      // CSS font smoorhing properties are not applied
      // I tried setting the properties via javascript
      // like this:
      //   canvas.style["-webkit-font-smoothing"] = "none";
      //   canvas.style["-moz-osx-font-smoothing"] = "none";
      //   canvas.style["font-smooth"] = "never";
      // but it didn't work
      document.body.appendChild(canvas);
    }

    const ctx = canvas.getContext("2d");
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;

    // size the canvas so it fits the this.letter
    const letterTextMetricsOrig = ctx.measureText(this.letter);

    // let's make a copy of letterTextMetricsOrig into letterTextMetrics
    // so we can modify it
    let letterTextMetrics = {};
    for (let key in letterTextMetricsOrig) {
      letterTextMetrics[key] = letterTextMetricsOrig[key];
    }

    // for the space character, Chrome gives actualBoundingBoxLeft == actualBoundingBoxRight == 0
    // even if the width is not 0. Since we are going to use the actualBoundingBoxLeft and actualBoundingBoxRight
    // to size the canvas, we need to fix that.
    if (
      letterTextMetrics.actualBoundingBoxLeft === 0 &&
      letterTextMetrics.actualBoundingBoxRight === 0
    ) {
      letterTextMetrics.actualBoundingBoxRight = letterTextMetrics.width;
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
    // the kerning info into a format that we re-use pixel-identically in all
    // OSs and browsers, so these corrections only need to be done in
    // one place to get a good rendering everywhere.
    // for the letter "W" Arial 80px let's add 2 pixels to the actualBoundingBoxRight...
    // ...don't understand why, but the actualBoundingBoxLeft + actualBoundingBoxRight
    // is not enough to fit the letter in the canvas and the top-right gets ever so slightly clipped...

    // get the specs for "ActualBoundingBoxLeft correction px" of this
    // font family and style and weight and size

    letterTextMetrics.actualBoundingBoxLeft += specs.getSingleFloatCorrectionForLetter(
      this.fontProperties,
      this.letter,
      "ActualBoundingBoxLeft correction px"
    );

    letterTextMetrics.actualBoundingBoxRight += specs.getSingleFloatCorrectionForLetter(
      this.fontProperties,
      this.letter,
      "ActualBoundingBoxRight correction px"
    );

    letterTextMetrics.actualBoundingBoxLeft += Math.floor(
      fontSize *
        specs.getSingleFloatCorrectionForLetter(
          this.fontProperties,
          this.letter,
          "ActualBoundingBoxLeft correction proportional"
        )
    );

    letterTextMetrics.actualBoundingBoxRight += Math.floor(
      fontSize *
        specs.getSingleFloatCorrectionForLetter(
          this.fontProperties,
          this.letter,
          "ActualBoundingBoxRight correction proportional"
        )
    );

    letterTextMetrics.width += Math.floor(
      fontSize *
        specs.getSingleFloatCorrectionForLetter(
          this.fontProperties,
          this.letter,
          "Advancement correction proportional"
        )
    );

    if (truncateMetrics) {
      // go through all letterTextMetrics values and truncate them to fewer decimal places
      for (let key in letterTextMetrics) {
        letterTextMetrics[key] = Math.round(letterTextMetrics[key] * 10000) / 10000;
      }
    }

    // END OF LETTER-LEVEL RENDERING CORRECTIONS
    /////////////////////////////////////////////

    // Happens at small sizes due to a browser rendering defect.
    // This correction will simply paint the letter
    // n pixel more to the right in the mini canvas
    const cropLeftCorrection_CSS_Px = specs.getSingleFloatCorrectionForLetter(
      this.fontProperties,
      this.letter,
      "CropLeft correction px",
    );

    const canvasPixelsWidth = Math.round(
      letterTextMetrics.actualBoundingBoxLeft +
        letterTextMetrics.actualBoundingBoxRight
    );
    canvas.style.width = canvasPixelsWidth + "px";
    canvas.width = canvasPixelsWidth * pixelDensity;

    const div = document.createElement("div");
    div.textContent = `${this.letter} bbox left: ${letterTextMetrics.actualBoundingBoxLeft} bbox right: ${letterTextMetrics.actualBoundingBoxRight}`;
    // add to the textcontent the actualBoundingBoxLeft in red if it's not 0
    if (letterTextMetrics.actualBoundingBoxLeft !== 0) {
      div.style.color = "red";
    }
    document.body.appendChild(div);

    const canvasPixelsHeight = Math.round(
      letterTextMetrics.fontBoundingBoxAscent +
        letterTextMetrics.fontBoundingBoxDescent
    );
    canvas.style.height = canvasPixelsHeight + "px";
    canvas.height = canvasPixelsHeight * pixelDensity;

    ctx.scale(pixelDensity, pixelDensity);
    // make the background white
    // ctx.fillStyle = 'white';
    // ctx.fillRect(0, 0, canvas.width / pixelDensity, canvas.height / pixelDensity);
    // draw the text so that it fits in the canvas.
    // The chosen x,y is at the crossing of the first column and last row
    // of where any pixel can be drawn.
    // see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textBaseline
    ctx.textBaseline = "bottom";
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;

    ctx.fillText(
      this.letter,
      Math.round(letterTextMetrics.actualBoundingBoxLeft) +
        cropLeftCorrection_CSS_Px,
      canvas.height / pixelDensity - 1
    );

    if (drawCrisply) {
      // now can remove the canvas from the page
      canvas.remove();
    }

    return { canvas, letterTextMetrics };
  }

  getBoundingBoxOfOnPixels(canvas) {
    // get the image data, and from it get the tight bounding box of the letter/text
    const onPixelsArray = this.getOnPixelsArray(canvas);
    const tightCanvasBox = this.getBoundingBox(canvas, onPixelsArray);

    ///////////////////////////////////////////////////////////////////
    // Copy the tight canvas box to a new canvas and add it to the page
    // so you can look at it / inspect it if needed.
    ///////////////////////////////////////////////////////////////////
    const tightCanvas = document.createElement("canvas");

    if (
      tightCanvasBox.topLeftCorner === null ||
      tightCanvasBox.bottomRightCorner === null
    ) {
      return { tightCanvas: null, tightCanvasBox: null };
    }

    // Note on why you multiply +1 and -1 by pixelDensity: -----------------------
    // it's a good idea to keep the physical pixels divisible by pixelDensity
    // just for purity reasons, and also in theory it should make the scaling down
    // of the canvas look better.
    // ----------------------------------------------------------------------------

    // Always add one to these coordinatest subtractions!
    // Example: if the canvas right has an x of 15 (i.e. SIXTEENTH pixel from left) and the left is 5 (i.e. SIXTH pixel from left),
    // then the width of the tight canvas is 15 - 5 + 1 = 11

    const tightCanvasPixelsWidth =
      tightCanvasBox.bottomRightCorner.x - tightCanvasBox.topLeftCorner.x +
      1;
    tightCanvas.style.width =
      tightCanvasPixelsWidth / this.fontProperties.pixelDensity + "px";
    tightCanvas.width = tightCanvasPixelsWidth;

    // Always add one to these coordinatest subtractions!
    // Example: if the canvas bottom has a y of 15 (i.e. SIXTEENTH pixel from top) and the top is 5 (i.e. SIXTH pixel from top),
    // then the height of the tight canvas is 15 - 5 + 1 = 11
    const tightCanvasPixelsHeight =
      tightCanvasBox.bottomRightCorner.y - tightCanvasBox.topLeftCorner.y +
      1;
    tightCanvas.style.height =
      tightCanvasPixelsHeight / this.fontProperties.pixelDensity + "px";
    tightCanvas.height = tightCanvasPixelsHeight;

    // This one is a distance so you have to subtract 1
    // Example: if the canvas is 15 tall and the bottomRightCorner.y (i.e. the bottom of the tight canvas)
    // is 5 (which means it's on the SIXTH pixel down from the top), then
    // the distance between the bottom of the canvas and the bottom of the tight canvas box is 15 - 5 - 1 = 9
    tightCanvas.distanceBetweenBottomAndBottomOfCanvas =
      canvas.height - tightCanvasBox.bottomRightCorner.y - 1;

    const tightCanvasBoxCtx = tightCanvas.getContext("2d");
    tightCanvasBoxCtx.drawImage(
      canvas,
      tightCanvasBox.topLeftCorner.x,
      tightCanvasBox.topLeftCorner.y,
      tightCanvas.width,
      tightCanvas.height,
      0,
      0,
      tightCanvas.width,
      tightCanvas.height
    );

    return { tightCanvas, tightCanvasBox };
  }

  createCanvasesAndCharacterMetrics() {
    const { canvas, letterTextMetrics } = this.createCanvasWithCharacterAndGetItsMetricss();
    const { tightCanvas, tightCanvasBox } =
      this.getBoundingBoxOfOnPixels(canvas);

    if (!tightCanvas)
      return {
        canvas,
        tightCanvas: null,
        tightCanvasBox: null,
        letterTextMetrics
      };

    const div = document.createElement("div");
    div.textContent = `tightCanvasBox width in px, phys: ${
      tightCanvasBox.bottomRightCorner.x - tightCanvasBox.topLeftCorner.x
    } css: ${
      (tightCanvasBox.bottomRightCorner.x - tightCanvasBox.topLeftCorner.x) /
      this.fontProperties.pixelDensity
    }`;
    document.body.appendChild(div);

    return { canvas, tightCanvas, tightCanvasBox, letterTextMetrics };
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

    // print out the letter, and the bounding box width and height
    // if both objects are not null
    if (topLeftCorner !== null && bottomRightCorner !== null)
      console.log(this.letter + " " + (bottomRightCorner.x - topLeftCorner.x + 1) + " " + (bottomRightCorner.y - topLeftCorner.y + 1));

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
      // isOn is when there is any opacity
      // that's because we are working with canvases with transparent backgrounds
      // because glyphs often have are painted on top of other content AND also
      // because glyphs actually often have to overlap with each other e.g. in the case of "ff" in Times New Roman
      const isOn = data[i + 3] !== 0;
      pixels.push(isOn);
    }
    return pixels;
  }
}
