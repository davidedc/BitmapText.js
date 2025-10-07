class GlyphFAB {
  constructor(char, fontProperties) {
    this.char = char;
    this.fontProperties = fontProperties;

    const {
      canvas,
      tightCanvas,
      tightCanvasBox,
      charTextMetrics,
      canvasCopy
    } = this.createCanvasesAndCharacterMetrics();
    this.canvas = canvas;
    this.tightCanvas = tightCanvas;
    this.tightCanvasBox = tightCanvasBox;
    this.canvasCopy = canvasCopy; // Preserve canvas copy for export

    // characterMetrics actually belongs to the fontMetricsStore
    // which is separate from the AtlasDataStoreFAB class
    fontMetricsStoreFAB.setCharacterMetrics(this.fontProperties, char, charTextMetrics);

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

    // size the canvas so it fits the this.char
    const charTextMetricsOrig = ctx.measureText(this.char);

    // let's make a copy of charTextMetricsOrig into charTextMetrics
    // so we can modify it
    let charTextMetrics = {};
    for (let key in charTextMetricsOrig) {
      charTextMetrics[key] = charTextMetricsOrig[key];
    }

    // for the space character, Chrome gives actualBoundingBoxLeft == actualBoundingBoxRight == 0
    // even if the width is not 0. Since we are going to use the actualBoundingBoxLeft and actualBoundingBoxRight
    // to size the canvas, we need to fix that.
    if (
      charTextMetrics.actualBoundingBoxLeft === 0 &&
      charTextMetrics.actualBoundingBoxRight === 0
    ) {
      charTextMetrics.actualBoundingBoxRight = charTextMetrics.width;
    }

    //////////////////////////////////////////////
    // START OF CHARACTER-LEVEL RENDERING CORRECTIONS
    //////////////////////////////////////////////
    // These defects we are fixing are visible at small sizes (12px or so), however
    // that's a crucial use case for a crisp text renderer.
    // The defects to be corrected can be spotted by disabling all the kerning corrections and
    // rendering at size 12 (pretty much the smallest legible size) and looking
    // for problems like characters that touch, characters that miss a pixel, character that
    // are systematically too far/close to the previous/next, etc.
    // These corrections are specific to the font, and also
    // likely specific to the OS, browser and possibly
    // depend on other factors like the screen resolution, etc.
    // HOWEVER once we fix them, we bake the characters and their sizes and
    // the kerning info into a format that we re-use pixel-identically in all
    // OSs and browsers, so these corrections only need to be done in
    // one place to get a good rendering everywhere.
    // for the character "W" Arial 80px let's add 2 pixels to the actualBoundingBoxRight...
    // ...don't understand why, but the actualBoundingBoxLeft + actualBoundingBoxRight
    // is not enough to fit the character in the canvas and the top-right gets ever so slightly clipped...

    // get the specs for "ActualBoundingBoxLeft correction px" of this
    // font family and style and weight and size

    charTextMetrics.actualBoundingBoxLeft += specs.getSingleFloatCorrectionForChar(
      this.fontProperties,
      this.char,
      "ActualBoundingBoxLeft correction px"
    );

    charTextMetrics.actualBoundingBoxRight += specs.getSingleFloatCorrectionForChar(
      this.fontProperties,
      this.char,
      "ActualBoundingBoxRight correction px"
    );

    charTextMetrics.actualBoundingBoxLeft += Math.floor(
      fontSize *
        specs.getSingleFloatCorrectionForChar(
          this.fontProperties,
          this.char,
          "ActualBoundingBoxLeft correction proportional"
        )
    );

    charTextMetrics.actualBoundingBoxRight += Math.floor(
      fontSize *
        specs.getSingleFloatCorrectionForChar(
          this.fontProperties,
          this.char,
          "ActualBoundingBoxRight correction proportional"
        )
    );

    charTextMetrics.width += Math.floor(
      fontSize *
        specs.getSingleFloatCorrectionForChar(
          this.fontProperties,
          this.char,
          "Advancement correction proportional"
        )
    );

    if (truncateMetrics) {
      // go through all charTextMetrics values and truncate them to fewer decimal places
      for (let key in charTextMetrics) {
        charTextMetrics[key] = Math.round(charTextMetrics[key] * 10000) / 10000;
      }
    }

    // Store pixelDensity in charTextMetrics for later use in atlas reconstruction
    // This is needed because the atlas image is at physical pixels but metrics are in CSS pixels
    charTextMetrics.pixelDensity = this.fontProperties.pixelDensity;

    // END OF CHARACTER-LEVEL RENDERING CORRECTIONS
    /////////////////////////////////////////////

    // Happens at small sizes due to a browser rendering defect.
    // This correction will simply paint the character
    // n pixel more to the right in the mini canvas
    const cropLeftCorrection_CSS_Px = specs.getSingleFloatCorrectionForChar(
      this.fontProperties,
      this.char,
      "CropLeft correction px",
    );

    const canvasPixelsWidth = Math.round(
      charTextMetrics.actualBoundingBoxLeft +
        charTextMetrics.actualBoundingBoxRight
    );
    canvas.style.width = canvasPixelsWidth + "px";
    canvas.width = canvasPixelsWidth * pixelDensity;

    const div = document.createElement("div");
    div.textContent = `${this.char} bbox left: ${charTextMetrics.actualBoundingBoxLeft} bbox right: ${charTextMetrics.actualBoundingBoxRight}`;
    // add to the textcontent the actualBoundingBoxLeft in red if it's not 0
    if (charTextMetrics.actualBoundingBoxLeft !== 0) {
      div.style.color = "red";
    }
    document.body.appendChild(div);

    const canvasPixelsHeight = Math.round(
      charTextMetrics.fontBoundingBoxAscent +
        charTextMetrics.fontBoundingBoxDescent
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
      this.char,
      Math.round(charTextMetrics.actualBoundingBoxLeft) +
        cropLeftCorrection_CSS_Px,
      canvas.height / pixelDensity - 1
    );

    // Create a copy of the canvas BEFORE removing it from DOM
    // This preserves the image data for export, even after the original canvas is removed
    const canvasCopy = document.createElement('canvas');
    canvasCopy.width = canvas.width;
    canvasCopy.height = canvas.height;
    const copyCtx = canvasCopy.getContext('2d');
    copyCtx.drawImage(canvas, 0, 0);

    // Debug log to verify this code is running
    if (this.char === ' ' && Math.random() < 0.1) {
      console.log(`[GlyphFAB] Created canvasCopy for space character: ${canvasCopy.width}x${canvasCopy.height}`);
    }

    if (drawCrisply) {
      // now can remove the canvas from the page
      canvas.remove();
    }

    return { canvas, charTextMetrics, canvasCopy };
  }

  getBoundingBoxOfOnPixels(canvas) {
    // get the image data, and from it get the tight bounding box of the character/text
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
    const { canvas, charTextMetrics, canvasCopy } = this.createCanvasWithCharacterAndGetItsMetricss();
    const { tightCanvas, tightCanvasBox } =
      this.getBoundingBoxOfOnPixels(canvas);

    if (!tightCanvas)
      return {
        canvas,
        tightCanvas: null,
        tightCanvasBox: null,
        charTextMetrics,
        canvasCopy  // Include canvasCopy even when no tight canvas
      };

    const div = document.createElement("div");
    div.textContent = `tightCanvasBox width in px, phys: ${
      tightCanvasBox.bottomRightCorner.x - tightCanvasBox.topLeftCorner.x
    } css: ${
      (tightCanvasBox.bottomRightCorner.x - tightCanvasBox.topLeftCorner.x) /
      this.fontProperties.pixelDensity
    }`;
    document.body.appendChild(div);

    return { canvas, tightCanvas, tightCanvasBox, charTextMetrics, canvasCopy };
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

    // print out the character, and the bounding box width and height
    // if both objects are not null
    if (topLeftCorner !== null && bottomRightCorner !== null)
      console.log(this.char + " " + (bottomRightCorner.x - topLeftCorner.x + 1) + " " + (bottomRightCorner.y - topLeftCorner.y + 1));

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
