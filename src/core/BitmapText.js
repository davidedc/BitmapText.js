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
// - Constructed with an AtlasStore (atlas images) and FontMetricsStore (metrics data)
// - Draws text by looking up glyphs from atlases and positioning them with metrics/kerning
// - Uses textBaseline='bottom' positioning (y = bottom of text bounding box)
// - Supports placeholder rectangles when atlases are missing but metrics are available
// - Separates image assets (AtlasStore) from positioning data (FontMetricsStore) for flexible loading
//
// For font assets building capabilities, use BitmapTextFAB which extends this class.
class BitmapText {
  constructor(atlasStore, fontMetricsStore, canvasFactory) {
    this.atlasStore = atlasStore;
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
    let width_CSS_Px = 0;
    let letterTextMetrics = fontMetrics.getTextMetrics(text[0]);
    const actualBoundingBoxLeft_CSS_Px = letterTextMetrics.actualBoundingBoxLeft;
    let actualBoundingBoxAscent = 0;
    let actualBoundingBoxDescent = 0;
    let actualBoundingBoxRight_CSS_Px;
    let advancement_CSS_Px = 0;

    for (let i = 0; i < text.length; i++) {
      const letter = text[i];
      const nextLetter = text[i + 1];

      letterTextMetrics = fontMetrics.getTextMetrics(letter);

      actualBoundingBoxAscent = Math.max(actualBoundingBoxAscent, letterTextMetrics.actualBoundingBoxAscent);
      actualBoundingBoxDescent = Math.min(actualBoundingBoxDescent, letterTextMetrics.actualBoundingBoxDescent);

      advancement_CSS_Px = this.calculateAdvancement_CSS_Px(fontMetrics, fontProperties, letter, nextLetter, textProperties);
      width_CSS_Px += advancement_CSS_Px;
    }

    // the actualBoundingBoxRight_CSS_Px is the sum of all the advancements (detracting kerning) up to the last character...
    actualBoundingBoxRight_CSS_Px = width_CSS_Px - advancement_CSS_Px;
    // ... plus the actualBoundingBoxRight_CSS_Px of the last character
    // (this is in place of adding its advancement_CSS_Px)
    actualBoundingBoxRight_CSS_Px += letterTextMetrics.actualBoundingBoxRight;

    return {
      metrics: {
        width: width_CSS_Px,
        // note that standard measureText returns a TextMetrics object
        // which has no height, so let's make things uniform and resist the temptation to provide it.
        actualBoundingBoxLeft: actualBoundingBoxLeft_CSS_Px,
        actualBoundingBoxRight: actualBoundingBoxRight_CSS_Px,
        actualBoundingBoxAscent,
        actualBoundingBoxDescent,
        fontBoundingBoxAscent: letterTextMetrics.fontBoundingBoxAscent,
        fontBoundingBoxDescent: letterTextMetrics.fontBoundingBoxDescent
      },
      status: SUCCESS_STATUS  // Reuse immutable object for performance
    };
  }

  // Get the advancement of the i-th character i.e. needed AFTER the i-th character
  // so that the i+1-th character is drawn at the right place
  // This depends on both the advancement specified by the glyph of the i-th character
  // AND by the kerning correction depending on the pair of the i-th and i+1-th characters
  calculateAdvancement_CSS_Px(fontMetrics, fontProperties, letter, nextLetter, textProperties) {
    if (!textProperties) {
      textProperties = new TextProperties();
    }
    const letterTextMetrics = fontMetrics.getTextMetrics(letter);
    let x_CSS_Px = 0;

    // TODO this "space" section should handle all characters without a glyph
    //      as there are many kinds of space-like characters.

    // Handle space first ------------------------------------------
    // You could add the space advancement as we got it from the browser
    // (remember that the space doesn't have the tightCanvasBox)
    // but since at small sizes we meddle with kerning quite a bit, we want
    // to also meddle with this to try to make the width of text
    // similar to what the browser paints normally.
    // console.log(letterTextMetrics.width + " " + x_CSS_Px);
    // deal with the size of the " " character
    if (letter === " ") {
      const spaceAdvancementOverrideForSmallSizesInPx_CSS_Px = fontMetrics.getSpaceAdvancementOverride();
      if (spaceAdvancementOverrideForSmallSizesInPx_CSS_Px !== null) {
        x_CSS_Px += spaceAdvancementOverrideForSmallSizesInPx_CSS_Px;
      }
      else {
        x_CSS_Px += letterTextMetrics.width;
      }
    }
    // Non-space characters ------------------------------------------
    else {
      x_CSS_Px += letterTextMetrics.width;
    }

    // Next, apply the kerning correction ----------------------------
    let kerningCorrection = this.getKerningCorrection(fontMetrics, letter, nextLetter, textProperties);

    // We multiply the advancement of the letter by the kerning
    // Tracking and kerning are both measured in 1/1000 em, a unit of measure that is relative to the current type size.
    // We don't use ems, rather we use pxs, however we still want to keep Kerning as strictly proportional to the current type size,
    // and also to keep it as a measure "in thousands".
    x_CSS_Px -= fontProperties.fontSize * kerningCorrection / 1000;

    // since we might want to actually _place_ a glyph,
    // following this measurement, we want to return an
    // integer coordinate here
    return Math.round(x_CSS_Px);
  }

  getKerningCorrection(fontMetrics, letter, nextLetter, textProperties) {
    if (!textProperties) {
      textProperties = new TextProperties();
    }

    if (textProperties.isKerningEnabled && nextLetter) {
      return fontMetrics.getKerningAdjustment(letter, nextLetter);
    }

    return 0;
  }

  // This draws text from atlas and returns status information:
  // {
  //   rendered: boolean (whether any rendering occurred),
  //   status: { code: StatusCode, missingChars?: Set, missingAtlasChars?: Set, placeholdersUsed?: boolean }
  // }
  drawTextFromAtlas(ctx, text, x_CSS_Px, y_CSS_Px, fontProperties, textProperties = null) {
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

    // Check atlas availability
    const atlas = this.atlasStore.getAtlas(fontProperties);
    const atlasValid = this.atlasStore.isValidAtlas(atlas);

    // Track which glyphs are missing from atlas (for partial atlas status)
    const missingAtlasChars = new Set();
    let placeholdersUsed = false;

    // Render text
    const textColor = textProperties.textColor;
    const position = {
      x: x_CSS_Px * fontProperties.pixelDensity,
      y: y_CSS_Px * fontProperties.pixelDensity
    };

    for (let i = 0; i < text.length; i++) {
      const currentLetter = text[i];
      const nextLetter = text[i + 1];

      // Check if this specific glyph has atlas data (excluding spaces)
      if (currentLetter !== ' ') {
        if (!atlasValid || !fontMetrics.hasAtlasData(currentLetter)) {
          missingAtlasChars.add(currentLetter);
          placeholdersUsed = true;
        }
      }

      // Draw (either real glyph or placeholder)
      this.drawLetter(ctx,
        currentLetter,
        position,
        atlas,
        fontMetrics,
        textColor
      );

      position.x += this.calculateLetterAdvancement(fontMetrics, fontProperties, currentLetter, nextLetter, textProperties);
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

  drawLetter(ctx, letter, position, atlas, fontMetrics, textColor) {
    // There are several optimisations possible here:
    // 1. We could make a special case when the color is black
    // 2. We could cache the colored atlases in a small LRU cache

    const metrics = fontMetrics.getGlyphMetrics(letter);
    
    // If atlas is missing but metrics exist, draw placeholder rectangle
    if (!this.atlasStore.isValidAtlas(atlas)) {
      // For placeholder rectangles, we need tightWidth and tightHeight, but not xInAtlas
      if (metrics.tightWidth && metrics.tightHeight) {
        this.drawPlaceholderRectangle(ctx, position, metrics, textColor);
      }
      return;
    }
    
    // For normal glyph rendering, we need xInAtlas
    if (!metrics.xInAtlas) return;

    const coloredGlyphCanvas = this.createColoredGlyph(atlas, metrics, textColor);
    this.renderGlyphToMainCanvas(ctx, coloredGlyphCanvas, position, metrics);
  }

  createColoredGlyph(atlas, metrics, textColor) {
    const { xInAtlas, tightWidth, tightHeight } = metrics;
    
    // Setup temporary canvas, same size as the glyph
    this.coloredGlyphCanvas.width = tightWidth;
    this.coloredGlyphCanvas.height = tightHeight;
    this.coloredGlyphCtx.clearRect(0, 0, tightWidth, tightHeight);

    // Draw original glyph
    this.coloredGlyphCtx.globalCompositeOperation = 'source-over'; // reset the composite operation
    // see https://stackoverflow.com/a/6061102
    this.coloredGlyphCtx.drawImage(
      atlas,
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

  renderGlyphToMainCanvas(ctx, coloredGlyphCanvas, position, metrics) {
    const { tightWidth, tightHeight, dx, dy } = metrics;
    
     // see https://stackoverflow.com/a/6061102
    ctx.drawImage(
      coloredGlyphCanvas,
      0, 0,
      tightWidth, tightHeight,
      position.x + dx,
      position.y + dy,
      tightWidth, tightHeight
    );
  }

  drawPlaceholderRectangle(ctx, position, metrics, textColor) {
    const { tightWidth, tightHeight, dx, dy } = metrics;
    
    const rectX = position.x + dx;
    const rectY = position.y + dy;
    
    // Default to black if textColor is null or undefined
    const actualColor = textColor || 'black';
    
    // Draw a filled rectangle at the same position and size as the glyph would be
    ctx.fillStyle = actualColor;
    ctx.fillRect(rectX, rectY, tightWidth, tightHeight);
  }

  calculateLetterAdvancement(fontMetrics, fontProperties, currentLetter, nextLetter, textProperties) {
    return this.calculateAdvancement_CSS_Px(fontMetrics, fontProperties, currentLetter, nextLetter, textProperties)
      * fontProperties.pixelDensity;
  }
}
