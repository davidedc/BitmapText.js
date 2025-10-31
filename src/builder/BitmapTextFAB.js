// BitmapTextFAB - Font Assets Building Static Class
//
// This static class extends BitmapText to provide font assets building capabilities
// for bitmap text rendering with atlas and metrics generation.
//
// DISTRIBUTION ROLE:
// - Part of "full toolkit" distribution for font assets building applications
// - Extends BitmapText with building, validation, and generation features
// - Works with AtlasDataStoreFAB and FontMetricsStoreFAB for complete font assets building
//
// ARCHITECTURE:
// - Static class extending static BitmapText
// - Inherits all runtime text rendering from BitmapText
// - Adds glyph creation, kerning calculation, and font assets building methods
// - Uses static AtlasDataStoreFAB and FontMetricsStoreFAB stores
// - Integrates with font assets building pipeline and specifications
//
// SEPARATION OF CONCERNS:
// - Uses AtlasDataStoreFAB for glyph storage and atlas building
// - Uses FontMetricsStoreFAB for metrics calculation and kerning management
// - Both stores work together during the font assets building process
class BitmapTextFAB extends BitmapText {
  // Static kerning calculator (initialized via setSpecs)
  static #kerningCalculator = null;

  /**
   * Set specs and initialize kerning calculator
   * Called when specs are parsed or updated
   * @param {Specs} specs - Font specifications instance
   */
  static setSpecs(specs) {
    if (!specs) {
      throw new Error('setSpecs() requires non-null Specs instance');
    }
    this.#kerningCalculator = new KerningCalculator(specs);
  }

  /**
   * Ensure kerning calculator is initialized
   * @private
   * @throws {Error} If kerning calculator not initialized
   */
  static #ensureKerningCalculator() {
    if (!this.#kerningCalculator) {
      throw new Error(
        'Kerning calculator not initialized. ' +
        'Call setSpecs() before using kerning methods.'
      );
    }
  }

  // Historical note: Nine character classification methods deleted as dead code in commit 5bf84de
  // (Sept 2023) when system moved to spec-based kerning. Recoverable from git history if needed.

  /**
   * Get kerning correction from spec
   * @deprecated Use kerningCalculator.calculateCorrection() for direct access
   * @private Internal method - prefer buildKerningTableIfDoesntExist()
   */
  static getKerningCorrectionFromSpec(fontProperties, char, nextChar) {
    this.#ensureKerningCalculator();
    return this.#kerningCalculator.calculateCorrection(fontProperties, char, nextChar);
  }

  /**
   * Build kerning table if it doesn't exist
   * Delegates calculation to KerningCalculator, handles storage orchestration
   */
  static buildKerningTableIfDoesntExist(fontProperties) {
    this.#ensureKerningCalculator();

    // Early return if table already exists (idempotent operation)
    if (FontMetricsStoreFAB.kerningTableExists(fontProperties)) {
      return;
    }

    // Build kerning table using calculator (pure calculation, no side effects)
    const kerningTable = this.#kerningCalculator.buildTable(
      fontProperties,
      BitmapText.CHARACTER_SET
    );

    // Store kerning table (orchestration responsibility of FAB class)
    FontMetricsStoreFAB.setKerningTable(fontProperties, kerningTable);

    // Store space advancement override (separate concern, but stored together)
    const spaceAdvancementOverride = this.#kerningCalculator.getSpaceAdvancementOverride(
      fontProperties
    );
    FontMetricsStoreFAB.setSpaceAdvancementOverrideForSmallSizesInPx(
      fontProperties,
      spaceAdvancementOverride
    );
  }

  /**
   * Draws text by rendering individual character canvases directly (bypasses atlas)
   *
   * This method renders text using pre-generated glyph canvases instead of an atlas texture.
   * Primarily used for debugging, validation, or scenarios where atlas rendering is unavailable.
   *
   * TECHNICAL NOTE:
   * Canvas context provides fontSize, fontFamily, and fontStyle via ctx.font, but font-weight
   * (e.g., "bold") is not extractable due to Canvas API limitations. The only way to detect
   * weight would be through rendering and measuring, which is prohibitively slow.
   * Therefore, fontProperties must be explicitly passed as a parameter.
   *
   * @param {CanvasRenderingContext2D} ctx - Target canvas context for rendering
   * @param {string} text - Text string to render
   * @param {number} x_CssPx - X position in CSS pixels
   * @param {number} y_CssPx - Y position in CSS pixels (baseline position)
   * @param {FontProperties} fontProperties - Font configuration (family, size, weight, style, pixelDensity)
   * @param {TextProperties} [textProperties=null] - Optional text rendering properties (letterSpacing, etc.)
   */
  static drawTextViaIndividualCanvasesNotViaAtlas(ctx, text, x_CssPx, y_CssPx, fontProperties, textProperties = null) {
    let x_PhysPx = x_CssPx * fontProperties.pixelDensity;
    const y_PhysPx = y_CssPx * fontProperties.pixelDensity;

    // Get FontMetrics instance once for this font
    const fontMetrics = FontMetricsStoreFAB.getFontMetrics(fontProperties);
    if (!fontMetrics) {
      throw new Error(`No metrics found for font: ${fontProperties.key}`);
    }

    // Use provided TextProperties or create default
    if (!textProperties) {
      textProperties = new TextProperties();
    }

    // Convert to array of code points for proper Unicode handling
    const chars = [...text];
    let drawnCount = 0;
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      const nextChar = chars[i + 1];
      const glyph = AtlasDataStoreFAB.getGlyph(
        fontProperties,
        char
      );
      const characterMetrics = fontMetrics.getCharacterMetrics(char);

      if (glyph?.tightCanvas) {
        drawnCount++;
        // Some glyphs protrude to the left of the x_PhysPx that you specify, i.e. their
        // actualBoundingBoxLeft > 0, for example it's quite large for the
        // italic f in Times New Roman. The other glyphs that don't protrude to the left
        // simply have actualBoundingBoxLeft = 0.
        //
        // (Note that actualBoundingBoxLeft comes from the canvas measureText method, i.e.
        // it's not inferred from looking at how the canvas paints the glyph.)
        //
        // Hence, to render all glyphs correctly, you need to blit the glyph at
        //    x_PhysPx - actualBoundingBoxLeft
        // so the part that should protrude to the left is actually partially blitted to
        // the left of x, as it should be.
        //
        // Note that if the fist character has a positive actualBoundingBoxLeft and we draw
        // at x = 0 on a canvas, the left part of the glyph will be cropped. This is same as
        // it happens with a standard Canvas - one should just position the text
        // carefully to avoid this (although it's rare that people actually take care of this).
        const actualBoundingBoxLeftPull_CssPx = Math.round(
          characterMetrics.actualBoundingBoxLeft
        );

        const yPos_PhysPx =
          y_PhysPx -
          glyph.tightCanvas.height -
          glyph.tightCanvas.distanceBetweenBottomAndBottomOfCanvas_PhysPx +
          fontProperties.pixelDensity;
        const xPos_PhysPx =
          x_PhysPx - actualBoundingBoxLeftPull_CssPx * fontProperties.pixelDensity;

        const leftSpacing_PhysPx = glyph.tightCanvasBox.topLeftCorner.x;

        // Example: the user asks to draw the potential bottom of the text (i.e. including the most descending parts
        // that might or might not be painted on that last row of pixels, depending on the character, typically
        // "Ç" or "ç" or italic f in Times New Roman are the most descending characters, and they touch the bottom
        // because we set textBaseline to 'bottom'. If the chardoes not touch the bottom, the number of empty rows
        // (obviously not in the tightCanvas because... it's tight) is measured by distanceBetweenBottomAndBottomOfCanvas)
        // at y = 20 (i.e. the 21st pixel starting from the top).
        // I.e. y = 20 (line 21) is the bottom-most row of pixels that the most descending characters would touch.
        // The tight canvas of the glyph is 10px tall, and
        // the distance between the bottom of the tight canvas and the bottom of the canvas is 5px.
        // Hence we paint the charstarting the top at row (20 + 1) - (10-1) - 5 = row 7. Row 7 i.e. y = 6.
        //   explained: (20+1) is the row of y = 20; - (10-1) brings you to the top of the tight canvas,
        //              and to leave 5 spaces below you have to subtract 5.
        // That's what we do below applying the formula below:
        //     y = 20 - 10 - 5 + 1 = 6.
        // Let's verify that: painting the first row of the charat y = 6 i.e. row 7 means that the tight box will span from row 7 to row 16
        // (inclusive), and addind the distance of 5 pixels (5 empty rows), we get that the bottom of the canvas will be at row 16 + 5 = 21 i.e. y = 20
        // (which is what we wanted).
        // See https://www.w3schools.com/jsref/canvas_drawimage.asp
        const drawX = xPos_PhysPx + leftSpacing_PhysPx;
        const drawY = yPos_PhysPx;

        // TODO: Remove debug logging before production release
        // Debug first character of first call
        if (i === 0 && drawnCount === 1) {
          console.log(`[DEBUG] First drawImage call: char="${char}", canvas=${glyph.tightCanvas.width}x${glyph.tightCanvas.height}, x=${drawX}, y=${drawY}, y_PhysPx=${y_PhysPx}, tightCanvas.height=${glyph.tightCanvas.height}`);
        }

        ctx.drawImage(
          glyph.tightCanvas,
          drawX,
          drawY
        );
      }

      x_PhysPx +=
        BitmapText.calculateAdvancement_CssPx(fontMetrics, fontProperties, char, nextChar, textProperties) *
        fontProperties.pixelDensity;
    }
    // TODO: Remove debug logging before production release
    console.log(`[DEBUG] drawTextViaIndividualCanvasesNotViaAtlas drew ${drawnCount} glyphs for text: "${text.substring(0, 20)}..."`);
  }
}
