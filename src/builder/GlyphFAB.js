class GlyphFAB {
  // Precision for metric truncation (rounds to 4 decimal places)
  static METRIC_TRUNCATION_PRECISION = 10000;

  // Debug sampling rate (10% of space characters)
  static DEBUG_SAMPLE_RATE = 0.1;

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

  /**
   * Creates and configures canvas element for glyph rendering
   *
   * SIDE EFFECTS:
   * - Appends canvas to DOM if drawCrisply is true (for CSS font-smoothing)
   *
   * @returns {{canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D}}
   * @private
   */
  createAndConfigureCanvas() {
    const { fontStyle, fontWeight, fontSize, fontFamily } = this.fontProperties;
    const canvas = document.createElement("canvas");

    if (drawCrisply) {
      // Canvas must be in DOM for CSS font-smoothing properties to apply
      // Setting via JavaScript doesn't work:
      //   canvas.style["-webkit-font-smoothing"] = "none";
      //   canvas.style["-moz-osx-font-smoothing"] = "none";
      //   canvas.style["font-smooth"] = "never";
      document.body.appendChild(canvas);
    }

    const ctx = canvas.getContext("2d");
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;

    return { canvas, ctx };
  }

  /**
   * Measures character using Canvas API and creates mutable copy
   *
   * EDGE CASE HANDLED:
   * - Space character: Chrome reports actualBoundingBoxLeft/Right = 0 even when width > 0
   *   Fix: Set actualBoundingBoxRight = width for spaces
   *
   * @param {CanvasRenderingContext2D} ctx - Canvas context with font already set
   * @returns {Object} Mutable TextMetrics object
   * @private
   */
  measureAndCopyCharacterMetrics(ctx) {
    // Measure character using Canvas API
    const charTextMetricsOrig = ctx.measureText(this.char);

    // Create mutable copy (original TextMetrics is read-only)
    const charTextMetrics = {};
    for (let key in charTextMetricsOrig) {
      charTextMetrics[key] = charTextMetricsOrig[key];
    }

    // Fix space character edge case
    // Chrome gives actualBoundingBoxLeft == actualBoundingBoxRight == 0 for spaces
    // even when width is not 0. We use bounding boxes to size canvas, so we need to fix this.
    if (
      charTextMetrics.actualBoundingBoxLeft === 0 &&
      charTextMetrics.actualBoundingBoxRight === 0
    ) {
      charTextMetrics.actualBoundingBoxRight = charTextMetrics.width;
    }

    return charTextMetrics;
  }

  /**
   * Applies font-specific rendering corrections from Specs
   *
   * CORRECTIONS APPLIED (in order):
   * 1. ActualBoundingBoxLeft - pixel correction
   * 2. ActualBoundingBoxRight - pixel correction
   * 3. ActualBoundingBoxLeft - proportional correction (fontSize-based)
   * 4. ActualBoundingBoxRight - proportional correction (fontSize-based)
   * 5. Width/Advancement - proportional correction (fontSize-based)
   * 6. Optional metric truncation (if truncateMetrics global is true)
   * 7. PixelDensity storage (for atlas reconstruction)
   *
   * RATIONALE:
   * These corrections fix browser-specific rendering defects visible at small sizes (12px).
   * Defects include: characters touching, missing pixels, inconsistent spacing.
   * Once baked into bitmaps, these corrections apply uniformly across all OSs/browsers.
   *
   * GLOBAL DEPENDENCIES:
   * - specs: Specs instance with correction values
   * - truncateMetrics: boolean flag for metric truncation
   *
   * @param {Object} charTextMetrics - Mutable TextMetrics object (modified in place)
   * @private
   */
  applySpecsCorrections(charTextMetrics) {
    const { fontSize } = this.fontProperties;

    //////////////////////////////////////////////
    // START OF CHARACTER-LEVEL RENDERING CORRECTIONS
    //////////////////////////////////////////////
    // These defects are visible at small sizes (12px), a crucial use case for crisp rendering.
    // Spot defects by: disable kerning corrections, render at size 12, look for:
    // - Characters that touch
    // - Characters missing pixels
    // - Systematically incorrect spacing
    //
    // Corrections are font/OS/browser specific, but once baked into bitmaps,
    // they ensure pixel-identical rendering everywhere.

    // 1. Pixel-based corrections (absolute)
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

    // 2. Proportional corrections (fontSize-relative)
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

    // 3. Advancement/width correction
    charTextMetrics.width += Math.floor(
      fontSize *
        specs.getSingleFloatCorrectionForChar(
          this.fontProperties,
          this.char,
          "Advancement correction proportional"
        )
    );

    // 4. Optional truncation to reduce floating point precision
    if (truncateMetrics) {
      for (let key in charTextMetrics) {
        charTextMetrics[key] = Math.round(charTextMetrics[key] * GlyphFAB.METRIC_TRUNCATION_PRECISION) / GlyphFAB.METRIC_TRUNCATION_PRECISION;
      }
    }

    // 5. Store pixelDensity for atlas reconstruction
    // Needed because atlas image is in physical pixels but metrics are in CSS pixels
    charTextMetrics.pixelDensity = this.fontProperties.pixelDensity;

    // END OF CHARACTER-LEVEL RENDERING CORRECTIONS
    /////////////////////////////////////////////
  }

  /**
   * Configures canvas dimensions based on character metrics
   *
   * CALCULATIONS:
   * - Width: actualBoundingBoxLeft + actualBoundingBoxRight
   * - Height: fontBoundingBoxAscent + fontBoundingBoxDescent
   * - Both scaled by pixelDensity for physical pixels
   *
   * SIDE EFFECTS:
   * - Sets canvas.width/height (physical pixels)
   * - Sets canvas.style.width/height (CSS pixels)
   * - Appends debug div to document.body
   *
   * @param {HTMLCanvasElement} canvas - Canvas to configure
   * @param {Object} charTextMetrics - Character metrics
   * @returns {number} cropLeftCorrection_CssPx for rendering
   * @private
   */
  configureCanvasDimensions(canvas, charTextMetrics) {
    const { pixelDensity } = this.fontProperties;

    // Get crop correction for rendering (browser rendering defect at small sizes)
    // This will paint the character n pixels more to the right in the canvas
    const cropLeftCorrection_CssPx = specs.getSingleFloatCorrectionForChar(
      this.fontProperties,
      this.char,
      "CropLeft correction px"
    );

    // Calculate and set WIDTH
    const canvasWidth_CssPx = Math.round(
      charTextMetrics.actualBoundingBoxLeft +
        charTextMetrics.actualBoundingBoxRight
    );
    canvas.style.width = canvasWidth_CssPx + "px";
    canvas.width = canvasWidth_CssPx * pixelDensity;

    // Debug div for bounding box visualization
    const div = document.createElement("div");
    div.textContent = `${this.char} bbox left: ${charTextMetrics.actualBoundingBoxLeft} bbox right: ${charTextMetrics.actualBoundingBoxRight}`;
    if (charTextMetrics.actualBoundingBoxLeft !== 0) {
      div.style.color = "red";  // Highlight non-zero left bbox
    }
    document.body.appendChild(div);

    // Calculate and set HEIGHT
    const canvasHeight_CssPx = Math.round(
      charTextMetrics.fontBoundingBoxAscent +
        charTextMetrics.fontBoundingBoxDescent
    );
    canvas.style.height = canvasHeight_CssPx + "px";
    canvas.height = canvasHeight_CssPx * pixelDensity;

    return cropLeftCorrection_CssPx;
  }

  /**
   * Renders character to canvas with proper scaling and positioning
   *
   * RENDERING DETAILS:
   * - Scale by pixelDensity for physical pixels
   * - Use textBaseline='bottom' for consistent positioning
   * - X position: actualBoundingBoxLeft + cropLeftCorrection
   * - Y position: canvas.height / pixelDensity - 1 (bottom alignment)
   *
   * @param {HTMLCanvasElement} canvas - Target canvas
   * @param {Object} charTextMetrics - Character metrics
   * @param {number} cropLeftCorrection_CssPx - Left crop correction from specs
   * @private
   */
  renderCharacterToCanvas(canvas, charTextMetrics, cropLeftCorrection_CssPx) {
    const { pixelDensity, fontStyle, fontWeight, fontSize, fontFamily } = this.fontProperties;
    const ctx = canvas.getContext("2d");

    // Scale for physical pixels
    ctx.scale(pixelDensity, pixelDensity);

    // Configure text rendering
    ctx.textBaseline = "bottom";
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;

    // Draw character at calculated position
    // X: Left bounding box + correction
    // Y: Bottom of canvas - 1 (textBaseline='bottom' reference point)
    ctx.fillText(
      this.char,
      Math.round(charTextMetrics.actualBoundingBoxLeft) + cropLeftCorrection_CssPx,
      canvas.height / pixelDensity - 1
    );
  }

  /**
   * Creates a copy of canvas for export BEFORE removing from DOM
   *
   * CRITICAL:
   * - Must copy BEFORE canvas.remove() to preserve image data
   * - Copy survives DOM removal, ensuring export works correctly
   *
   * SIDE EFFECTS:
   * - Removes original canvas from DOM if drawCrisply is true
   * - Debug logging for space characters (10% sample rate)
   *
   * @param {HTMLCanvasElement} canvas - Source canvas to copy
   * @returns {HTMLCanvasElement} Canvas copy with preserved image data
   * @private
   */
  createCanvasCopyForExport(canvas) {
    // Create copy BEFORE removing from DOM
    const canvasCopy = document.createElement('canvas');
    canvasCopy.width = canvas.width;
    canvasCopy.height = canvas.height;
    const copyCtx = canvasCopy.getContext('2d');
    copyCtx.drawImage(canvas, 0, 0);

    // Debug log for space characters (sampled at 10%)
    if (this.char === ' ' && Math.random() < GlyphFAB.DEBUG_SAMPLE_RATE) {
      console.log(`[GlyphFAB] Created canvasCopy for space character: ${canvasCopy.width}x${canvasCopy.height}`);
    }

    // Remove original canvas from DOM if needed for crisp rendering
    if (drawCrisply) {
      canvas.remove();
    }

    return canvasCopy;
  }

  /**
   * Creates canvas with rendered character and measures its metrics
   *
   * This is the main orchestration method that coordinates 6 specialized steps:
   * 1. Canvas creation and configuration
   * 2. Character metrics measurement
   * 3. Specs corrections application
   * 4. Canvas dimension configuration
   * 5. Character rendering
   * 6. Canvas preservation for export
   *
   * @returns {{canvas: HTMLCanvasElement, charTextMetrics: Object, canvasCopy: HTMLCanvasElement}}
   */
  createCanvasWithCharacterAndGetItsMetricss() {
    // Step 1: Create and configure canvas
    const { canvas, ctx } = this.createAndConfigureCanvas();

    // Step 2: Measure character metrics
    const charTextMetrics = this.measureAndCopyCharacterMetrics(ctx);

    // Step 3: Apply font-specific corrections
    this.applySpecsCorrections(charTextMetrics);

    // Step 4: Configure canvas dimensions
    const cropLeftCorrection_CssPx = this.configureCanvasDimensions(canvas, charTextMetrics);

    // Step 5: Render character to canvas
    this.renderCharacterToCanvas(canvas, charTextMetrics, cropLeftCorrection_CssPx);

    // Step 6: Create canvas copy for export
    const canvasCopy = this.createCanvasCopyForExport(canvas);

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

    const tightCanvasWidth_PhysPx =
      tightCanvasBox.bottomRightCorner.x - tightCanvasBox.topLeftCorner.x +
      1;
    tightCanvas.style.width =
      tightCanvasWidth_PhysPx / this.fontProperties.pixelDensity + "px";
    tightCanvas.width = tightCanvasWidth_PhysPx;

    // Always add one to these coordinatest subtractions!
    // Example: if the canvas bottom has a y of 15 (i.e. SIXTEENTH pixel from top) and the top is 5 (i.e. SIXTH pixel from top),
    // then the height of the tight canvas is 15 - 5 + 1 = 11
    const tightCanvasHeight_PhysPx =
      tightCanvasBox.bottomRightCorner.y - tightCanvasBox.topLeftCorner.y +
      1;
    tightCanvas.style.height =
      tightCanvasHeight_PhysPx / this.fontProperties.pixelDensity + "px";
    tightCanvas.height = tightCanvasHeight_PhysPx;

    // This one is a distance so you have to subtract 1
    // Example: if the canvas is 15 tall and the bottomRightCorner.y (i.e. the bottom of the tight canvas)
    // is 5 (which means it's on the SIXTH pixel down from the top), then
    // the distance between the bottom of the canvas and the bottom of the tight canvas box is 15 - 5 - 1 = 9
    tightCanvas.distanceBetweenBottomAndBottomOfCanvas_PhysPx =
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
    const tightBoxWidth_PhysPx = tightCanvasBox.bottomRightCorner.x - tightCanvasBox.topLeftCorner.x;
    const tightBoxWidth_CssPx = tightBoxWidth_PhysPx / this.fontProperties.pixelDensity;
    div.textContent = `tightCanvasBox width in px, phys: ${tightBoxWidth_PhysPx} css: ${tightBoxWidth_CssPx}`;
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
