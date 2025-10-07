// BitmapTextFAB - Font Assets Building Class
// 
// This class extends BitmapText to provide font assets building capabilities
// for bitmap text rendering with atlas and metrics generation.
//
// DISTRIBUTION ROLE:
// - Part of "full toolkit" distribution for font assets building applications
// - Extends BitmapText with building, validation, and generation features
// - Works with AtlasDataStoreFAB and FontMetricsStoreFAB for complete font assets building
//
// ARCHITECTURE:
// - Constructed with AtlasDataStoreFAB (glyph and atlas building) and FontMetricsStoreFAB (metrics)
// - Inherits all runtime text rendering from BitmapText
// - Adds glyph creation, kerning calculation, and font assets building methods
// - Integrates with font assets building pipeline and specifications
//
// SEPARATION OF CONCERNS:
// - Uses AtlasDataStoreFAB for glyph storage and atlas building
// - Uses FontMetricsStoreFAB for metrics calculation and kerning management
// - Both stores work together during the font assets building process
class BitmapTextFAB extends BitmapText {

  constructor(atlasDataStoreFAB, fontMetricsStoreFAB, canvasFactory) {
    // Pass both stores to parent BitmapText constructor
    // Parent expects (atlasDataStore, fontMetricsStore, canvasFactory)
    super(atlasDataStoreFAB, fontMetricsStoreFAB, canvasFactory);

    // Store references to FAB-specific stores for building operations
    // Note: this.atlasDataStore and this.fontMetricsStore are already set by parent
    this.atlasDataStoreFAB = atlasDataStoreFAB;
    this.fontMetricsStoreFAB = fontMetricsStoreFAB;
  }

  // Historical note: Character classification methods (hasLotsOfSpaceAtBottomRight,
  // hasLotsOfSpaceAtBottomLeft, hasSomeSpaceAtBottomLeft, hasSomeSpaceAtBottomRight,
  // hasSpaceAtTopRight, protrudesBottomLeft, protrudesBottomRight, protrudesTopLeft,
  // isShortCharacter) were DELETED as dead code - they were part of the old kerning
  // algorithm removed in commit 5bf84de (Sept 2023) when the system moved to spec-based
  // kerning. These methods had zero callers and are recoverable from git history if needed.

  getKerningCorrectionFromSpec(fontProperties, char, nextChar) {
    const { fontFamily, fontStyle, fontWeight, fontSize } = fontProperties;

    if (specs.specCombinationExists(fontProperties, "Kerning cutoff")) {
      if (fontSize <= specs.kerningCutoff(fontProperties)) {
        return 0;
      }
    }

    if (specs.specCombinationExists(fontProperties, "Kerning")) {
      // for all entries in the Kerning array with a sizeRange that includes the current font size
      //   get the kerning array and for each one:
      //     if charmatches any of the characters in the "left" object or the "left" object is "*any*" and the nextChar matches any of the characters in the "right" object or the "right" object is "*any*"
      //       return the value of the "adjustment" property
      for (const kerningEntry of specs.kerning(fontProperties)) {
        if (
          kerningEntry.sizeRange.from <= fontSize &&
          kerningEntry.sizeRange.to >= fontSize
        ) {
          for (const kerning of kerningEntry.kerning) {
            if (
              (kerning.left.includes(char) ||
                kerning.left.includes("*any*")) &&
              (kerning.right.includes(nextChar) ||
                kerning.right.includes("*any*"))
            ) {
              return kerning.adjustment;
            }
          }
        }
      }
      return 0;
    }
    return 0;
  }

  buildKerningTableIfDoesntExist(fontProperties) {
    if (this.fontMetricsStoreFAB.kerningTableExists(fontProperties))
      return;

    // go through all the characters and for each character, go through all the other characters
    // and calculate the kerning correction between the two characters
    // and store it in the kerningTable
    const kerningTable = {};
    for (const char of characterSet) {
      kerningTable[char] = {};
      for (const nextChar of characterSet) {
        const kerningCorrection = this.getKerningCorrectionFromSpec(
          fontProperties,
          char,
          nextChar
        );
        if (kerningCorrection !== 0) {
          kerningTable[char][nextChar] = kerningCorrection;
        }
      }
    }

    // prune the characters that don't have any kerning corrections
    for (const char in kerningTable) {
      if (Object.keys(kerningTable[char]).length === 0) {
        delete kerningTable[char];
      }
    }

    this.fontMetricsStoreFAB.setKerningTable(fontProperties, kerningTable);

    const spaceAdvancementOverrideForSmallSizesInPx =
      specs.getSingleFloatCorrection(fontProperties, "Space advancement override for small sizes in px");
    this.fontMetricsStoreFAB.setSpaceAdvancementOverrideForSmallSizesInPx(fontProperties, spaceAdvancementOverrideForSmallSizesInPx);
  }

  // Note that you can parse the fontSize fontFamily and font-style from the ctx.font string
  // HOWEVER for some quirks of Canvas implementaiton there is no way to read the font-weight
  // (i.e. "bold"). The only way would be to do some text rendering and then measure the text
  // and see if it's bold or not. This is not a good idea because it's slow.
  // So, the best way is to keep track of the font-family, font-size and
  // font-style that you use in your own code and pass as params.
  drawTextViaIndividualCanvasesNotViaAtlas(ctx, text, x_CssPx, y_CssPx, fontProperties, textProperties = null) {
    let x_PhysPx = x_CssPx * fontProperties.pixelDensity;
    const y_PhysPx = y_CssPx * fontProperties.pixelDensity;

    // Get FontMetrics instance once for this font
    const fontMetrics = this.fontMetricsStoreFAB.getFontMetrics(fontProperties);
    if (!fontMetrics) {
      throw new Error(`No metrics found for font: ${fontProperties.key}`);
    }

    // Use provided TextProperties or create default
    if (!textProperties) {
      textProperties = new TextProperties();
    }

    // Convert to array of code points for proper Unicode handling
    const chars = [...text];
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      const nextChar = chars[i + 1];
      const glyph = this.atlasDataStoreFAB.getGlyph(
        fontProperties,
        char
      );
      const characterMetrics = fontMetrics.getCharacterMetrics(char);

      if (glyph && glyph.tightCanvas) {
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
        ctx.drawImage(
          glyph.tightCanvas,
          xPos_PhysPx + leftSpacing_PhysPx,
          yPos_PhysPx
        );
      }

      x_PhysPx +=
        this.calculateAdvancement_CssPx(fontMetrics, fontProperties, char, nextChar, textProperties) *
        fontProperties.pixelDensity;
    }
  }
}
