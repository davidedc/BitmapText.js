// BitmapText - Core Runtime Class

// Status constants are loaded as global variables by StatusCode.js (loaded before this file)
// In Node.js bundles, StatusCode.js is concatenated before this file
if (typeof StatusCode === 'undefined' || typeof SUCCESS_STATUS === 'undefined' || typeof createErrorStatus === 'undefined') {
  throw new Error('StatusCode.js must be loaded before BitmapText.js');
}
// 
// This is a CORE RUNTIME class designed for minimal bundle size (~5-7KB).
// It provides essential text rendering capabilities for consuming pre-built bitmap fonts.
// 
// DISTRIBUTION ROLE:
// - Part of "runtime-only" distribution for production applications
// - Extended by BitmapTextFAB for font assets building capabilities
// - Contains no font generation code to keep bundle size minimal
// 
// ARCHITECTURE:
// - Constructed with an AtlasDataStore (atlas images) and FontMetricsStore (metrics data)
// - Draws text by looking up glyphs from atlases and positioning them with metrics/kerning
// - Uses textBaseline='bottom' positioning (y = bottom of text bounding box)
// - Supports placeholder rectangles when atlases are missing but metrics are available
// - Separates image assets (AtlasDataStore) from positioning data (FontMetricsStore) for flexible loading
//
// For font assets building capabilities, use BitmapTextFAB which extends this class.
class BitmapText {
  constructor(atlasDataStore, fontMetricsStore, canvasFactory) {
    this.atlasDataStore = atlasDataStore;
    this.fontMetricsStore = fontMetricsStore;
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

  // This returns an object with metrics and status information:
  // {
  //   metrics: TextMetrics-compatible object (or null if measurement failed),
  //   status: { code: StatusCode, missingChars?: Set }
  // }
  //
  // The metrics object has the same shape and meaning as the TextMetrics object (see
  // https://developer.mozilla.org/en-US/docs/Web/API/TextMetrics ) i.e.:
  //  * the width should be the sum of the advancements (detracting kerning)
  //  * actualBoundingBoxLeft = the actualBoundingBoxLeft of the first character
  //  * actualBoundingBoxRight = the sum of the advancements (detracting kerning) EXCLUDING the one of the last char, plus the actualBoundingBoxRight of the last char
  measureText(text, fontProperties, textProperties) {
    if (!textProperties) {
      textProperties = new TextProperties();
    }

    // FAST PATH: Handle empty text (100% success)
    if (text.length === 0) {
      return {
        metrics: {
          width: 0,
          actualBoundingBoxLeft: 0,
          actualBoundingBoxRight: 0,
          actualBoundingBoxAscent: 0,
          actualBoundingBoxDescent: 0,
          fontBoundingBoxAscent: 0,
          fontBoundingBoxDescent: 0
        },
        status: SUCCESS_STATUS  // Reuse immutable object for performance
      };
    }

    // Check if FontMetrics exists at all
    const fontMetrics = this.fontMetricsStore.getFontMetrics(fontProperties);
    if (!fontMetrics) {
      return {
        metrics: null,
        status: createErrorStatus(StatusCode.NO_METRICS)
      };
    }

    // Scan text for missing glyphs (excluding spaces which are handled specially)
    const missingChars = new Set();
    for (const char of text) {
      if (char !== ' ' && !fontMetrics.hasGlyph(char)) {
        missingChars.add(char);
      }
    }

    // If any glyphs missing, can't calculate accurate metrics
    if (missingChars.size > 0) {
      return {
        metrics: null,  // Can't provide partial metrics reliably
        status: createErrorStatus(StatusCode.PARTIAL_METRICS, {
          missingChars: missingChars
        })
      };
    }

    // SUCCESS PATH: Calculate metrics normally
    // Convert to array of code points for proper Unicode handling
    const chars = [...text];
    let width_CssPx = 0;
    let characterMetrics = fontMetrics.getCharacterMetrics(chars[0]);
    const actualBoundingBoxLeft_CssPx = characterMetrics.actualBoundingBoxLeft;
    let actualBoundingBoxAscent = 0;
    let actualBoundingBoxDescent = 0;
    let actualBoundingBoxRight_CssPx;
    let advancement_CssPx = 0;

    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      const nextChar = chars[i + 1];

      characterMetrics = fontMetrics.getCharacterMetrics(char);

      actualBoundingBoxAscent = Math.max(actualBoundingBoxAscent, characterMetrics.actualBoundingBoxAscent);
      actualBoundingBoxDescent = Math.min(actualBoundingBoxDescent, characterMetrics.actualBoundingBoxDescent);

      advancement_CssPx = this.calculateAdvancement_CssPx(fontMetrics, fontProperties, char, nextChar, textProperties);
      width_CssPx += advancement_CssPx;
    }

    // the actualBoundingBoxRight_CssPx is the sum of all the advancements (detracting kerning) up to the last character...
    actualBoundingBoxRight_CssPx = width_CssPx - advancement_CssPx;
    // ... plus the actualBoundingBoxRight_CssPx of the last character
    // (this is in place of adding its advancement_CssPx)
    actualBoundingBoxRight_CssPx += characterMetrics.actualBoundingBoxRight;

    return {
      metrics: {
        width: width_CssPx,
        // note that standard measureText returns a TextMetrics object
        // which has no height, so let's make things uniform and resist the temptation to provide it.
        actualBoundingBoxLeft: actualBoundingBoxLeft_CssPx,
        actualBoundingBoxRight: actualBoundingBoxRight_CssPx,
        actualBoundingBoxAscent,
        actualBoundingBoxDescent,
        fontBoundingBoxAscent: characterMetrics.fontBoundingBoxAscent,
        fontBoundingBoxDescent: characterMetrics.fontBoundingBoxDescent
      },
      status: SUCCESS_STATUS  // Reuse immutable object for performance
    };
  }

  // Get the advancement of the i-th character i.e. needed AFTER the i-th character
  // so that the i+1-th character is drawn at the right place
  // This depends on both the advancement specified by the glyph of the i-th character
  // AND by the kerning correction depending on the pair of the i-th and i+1-th characters
  calculateAdvancement_CssPx(fontMetrics, fontProperties, char, nextChar, textProperties) {
    if (!textProperties) {
      textProperties = new TextProperties();
    }
    const characterMetrics = fontMetrics.getCharacterMetrics(char);
    let x_CssPx = 0;

    // TODO this "space" section should handle all characters without a glyph
    //      as there are many kinds of space-like characters.

    // Handle space first ------------------------------------------
    // You could add the space advancement as we got it from the browser
    // (remember that the space doesn't have the tightCanvasBox)
    // but since at small sizes we meddle with kerning quite a bit, we want
    // to also meddle with this to try to make the width of text
    // similar to what the browser paints normally.
    // console.log(characterMetrics.width + " " + x_CSS_Px);
    // deal with the size of the " " character
    if (char === " ") {
      const spaceAdvancementOverrideForSmallSizesInPx_CssPx = fontMetrics.getSpaceAdvancementOverride();
      if (spaceAdvancementOverrideForSmallSizesInPx_CssPx !== null) {
        x_CssPx += spaceAdvancementOverrideForSmallSizesInPx_CssPx;
      }
      else {
        x_CssPx += characterMetrics.width;
      }
    }
    // Non-space characters ------------------------------------------
    else {
      x_CssPx += characterMetrics.width;
    }

    // Next, apply the kerning correction ----------------------------
    let kerningCorrection = this.getKerningCorrection(fontMetrics, char, nextChar, textProperties);

    // We multiply the advancement of the character by the kerning
    // Tracking and kerning are both measured in 1/1000 em, a unit of measure that is relative to the current type size.
    // We don't use ems, rather we use pxs, however we still want to keep Kerning as strictly proportional to the current type size,
    // and also to keep it as a measure "in thousands".
    x_CssPx -= fontProperties.fontSize * kerningCorrection / 1000;

    // since we might want to actually _place_ a glyph,
    // following this measurement, we want to return an
    // integer coordinate here
    return Math.round(x_CssPx);
  }

  getKerningCorrection(fontMetrics, char, nextChar, textProperties) {
    if (!textProperties) {
      textProperties = new TextProperties();
    }

    if (textProperties.isKerningEnabled && nextChar) {
      return fontMetrics.getKerningAdjustment(char, nextChar);
    }

    return 0;
  }

  // This draws text from atlas and returns status information:
  // {
  //   rendered: boolean (whether any rendering occurred),
  //   status: { code: StatusCode, missingChars?: Set, missingAtlasChars?: Set, placeholdersUsed?: boolean }
  // }
  drawTextFromAtlas(ctx, text, x_CssPx, y_CssPx, fontProperties, textProperties = null) {
    textProperties = textProperties || new TextProperties();

    // Check FontMetrics availability first
    const fontMetrics = this.fontMetricsStore.getFontMetrics(fontProperties);
    if (!fontMetrics) {
      return {
        rendered: false,
        status: createErrorStatus(StatusCode.NO_METRICS)
      };
    }

    // Scan for missing metrics (can't render without metrics)
    const missingMetricsChars = new Set();
    for (const char of text) {
      if (char !== ' ' && !fontMetrics.hasGlyph(char)) {
        missingMetricsChars.add(char);
      }
    }

    if (missingMetricsChars.size > 0) {
      return {
        rendered: false,
        status: createErrorStatus(StatusCode.PARTIAL_METRICS, {
          missingChars: missingMetricsChars
        })
      };
    }

    // Check atlas data availability
    const atlasData = this.atlasDataStore.getAtlasData(fontProperties);
    const atlasValid = this.atlasDataStore.isValidAtlas(atlasData);

    // Track which glyphs are missing from atlas (for partial atlas status)
    const missingAtlasChars = new Set();
    let placeholdersUsed = false;

    // Render text
    // Convert to array of code points for proper Unicode handling
    const chars = [...text];
    const textColor = textProperties.textColor;
    const position_PhysPx = {
      x: x_CssPx * fontProperties.pixelDensity,
      y: y_CssPx * fontProperties.pixelDensity
    };

    for (let i = 0; i < chars.length; i++) {
      const currentChar = chars[i];
      const nextChar = chars[i + 1];

      // Check if atlas has a glyph for this character (excluding spaces)
      if (currentChar !== ' ') {
        if (!atlasValid || !atlasData.hasPositioning(currentChar)) {
          missingAtlasChars.add(currentChar);
          placeholdersUsed = true;
        }
      }

      // Draw (either real glyph or placeholder)
      this.drawCharacter(ctx,
        currentChar,
        position_PhysPx,
        atlasData,
        fontMetrics,
        textColor
      );

      position_PhysPx.x += this.calculateCharacterAdvancement_PhysPx(fontMetrics, fontProperties, currentChar, nextChar, textProperties);
    }

    // Determine status code
    let statusCode;
    if (!atlasValid) {
      statusCode = StatusCode.NO_ATLAS;
    } else if (missingAtlasChars.size > 0) {
      statusCode = StatusCode.PARTIAL_ATLAS;
    } else {
      // Complete success
      return {
        rendered: true,
        status: SUCCESS_STATUS  // Reuse immutable object for performance
      };
    }

    // Return detailed status for non-success cases
    return {
      rendered: true,  // We did render something (placeholders or partial)
      status: createErrorStatus(statusCode, {
        missingAtlasChars: missingAtlasChars.size > 0 ? missingAtlasChars : undefined,
        placeholdersUsed: placeholdersUsed
      })
    };
  }

  drawCharacter(ctx, char, position_PhysPx, atlasData, fontMetrics, textColor) {
    // There are several optimisations possible here:
    // 1. We could make a special case when the color is black
    // 2. We could cache the colored atlases in a small LRU cache

    // If atlasData is missing but metrics exist, draw simplified placeholder rectangle
    if (!this.atlasDataStore.isValidAtlas(atlasData)) {
      // Use character metrics for simplified placeholder (no atlasData positioning needed)
      const characterMetrics = fontMetrics.getCharacterMetrics(char);
      if (characterMetrics) {
        this.drawPlaceholderRectangle(ctx, char, position_PhysPx, characterMetrics, textColor);
      }
      return;
    }

    if (!atlasData.hasPositioning(char)) return;

    const atlasPositioning = atlasData.atlasPositioning.getPositioning(char);

    // Get the atlasData image for rendering
    const atlasImage = atlasData.atlasImage.image;
    const coloredGlyphCanvas = this.createColoredGlyph(atlasImage, atlasPositioning, textColor);
    this.renderGlyphToMainCanvas(ctx, coloredGlyphCanvas, position_PhysPx, atlasPositioning);
  }

  createColoredGlyph(atlasImage, atlasPositioning, textColor) {
    const { xInAtlas, tightWidth, tightHeight } = atlasPositioning;
    
    // Setup temporary canvas, same size as the glyph
    this.coloredGlyphCanvas.width = tightWidth;
    this.coloredGlyphCanvas.height = tightHeight;
    this.coloredGlyphCtx.clearRect(0, 0, tightWidth, tightHeight);

    // Draw original glyph
    this.coloredGlyphCtx.globalCompositeOperation = 'source-over'; // reset the composite operation
    // see https://stackoverflow.com/a/6061102
    this.coloredGlyphCtx.drawImage(
      atlasImage,
      xInAtlas, 0,
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

  renderGlyphToMainCanvas(ctx, coloredGlyphCanvas, position_PhysPx, atlasPositioning) {
    const { tightWidth, tightHeight, dx, dy } = atlasPositioning;

    // see https://stackoverflow.com/a/6061102
    ctx.drawImage(
      coloredGlyphCanvas,
      0, 0,
      tightWidth, tightHeight,
      position_PhysPx.x + dx,
      position_PhysPx.y + dy,
      tightWidth, tightHeight
    );
  }

  drawPlaceholderRectangle(ctx, char, position_PhysPx, characterMetrics, textColor) {
    // Skip drawing for space characters (invisible)
    if (char === ' ') return;

    // Verify we have actual bounding box data (defensive coding)
    if (characterMetrics.actualBoundingBoxLeft === undefined ||
        characterMetrics.actualBoundingBoxRight === undefined ||
        characterMetrics.actualBoundingBoxAscent === undefined ||
        characterMetrics.actualBoundingBoxDescent === undefined) {
      console.warn(`Missing bounding box metrics for character '${char}'`);
      return;
    }

    // Get pixel density from character metrics (stored during metrics generation in GlyphFAB.js:145)
    const pixelDensity = characterMetrics.pixelDensity || 1;

    // Use CHARACTER-SPECIFIC actual bounding box (not font-wide fontBoundingBox)
    // This makes:
    // - 'a' shorter than 'A' (x-height vs cap-height)
    // - 'g' extends below baseline (shows descender)
    // - '.' very short (near baseline only)
    // Width: actualBoundingBoxLeft + actualBoundingBoxRight (CSS px) * pixelDensity → physical px
    // Height: actualBoundingBoxAscent + actualBoundingBoxDescent (CSS px) * pixelDensity → physical px
    const width_PhysPx = Math.round(
      characterMetrics.actualBoundingBoxLeft + characterMetrics.actualBoundingBoxRight
    ) * pixelDensity;

    const height_PhysPx = Math.round(
      characterMetrics.actualBoundingBoxAscent + characterMetrics.actualBoundingBoxDescent
    ) * pixelDensity;

    // X position: Account for actualBoundingBoxLeft (glyphs may protrude left, e.g., italic 'f')
    // This matches the dx offset calculation in atlas rendering (AtlasPositioningFAB.js:92)
    const rectX_PhysPx = position_PhysPx.x
      - Math.round(characterMetrics.actualBoundingBoxLeft) * pixelDensity;

    // Y position calculation:
    // - position_PhysPx.y is at em square BOTTOM (textBaseline='bottom')
    // - Em square bottom is fontBoundingBoxDescent below the alphabetic baseline
    // - So: alphabetic_baseline_y = position_PhysPx.y - fontBoundingBoxDescent * pixelDensity
    // - Character top = alphabetic_baseline_y - actualBoundingBoxAscent * pixelDensity
    // Result: rectY = position_PhysPx.y - fontBoundingBoxDescent * pixelDensity - actualBoundingBoxAscent * pixelDensity
    const rectY_PhysPx = position_PhysPx.y
      - characterMetrics.fontBoundingBoxDescent * pixelDensity
      - characterMetrics.actualBoundingBoxAscent * pixelDensity;

    // Default to black if textColor is null or undefined
    const actualColor = textColor || 'black';

    // Draw character-specific rectangle (all values in physical pixels)
    ctx.fillStyle = actualColor;
    ctx.fillRect(rectX_PhysPx, rectY_PhysPx, width_PhysPx, height_PhysPx);
  }

  calculateCharacterAdvancement_PhysPx(fontMetrics, fontProperties, currentChar, nextChar, textProperties) {
    return this.calculateAdvancement_CssPx(fontMetrics, fontProperties, currentChar, nextChar, textProperties)
      * fontProperties.pixelDensity;
  }
}
