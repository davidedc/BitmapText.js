// BitmapText - Static Core Runtime Class
//
// Status constants are loaded as global variables by StatusCode.js (loaded before this file)
// In Node.js bundles, StatusCode.js is concatenated before this file
if (typeof StatusCode === 'undefined' || typeof SUCCESS_STATUS === 'undefined' || typeof createErrorStatus === 'undefined') {
  throw new Error('StatusCode.js must be loaded before BitmapText.js');
}
//
// This is a STATIC CORE RUNTIME class designed for minimal bundle size and zero-ceremony usage.
// It provides essential text rendering capabilities for consuming pre-built bitmap fonts.
//
// DISTRIBUTION ROLE:
// - Part of "runtime-only" distribution for production applications
// - All methods are static - no instantiation needed
// - Contains no font generation code to keep bundle size minimal
//
// ARCHITECTURE:
// - Facade pattern: Delegates storage to AtlasDataStore/FontMetricsStore, font loading to FontLoader
// - fontDirectory configuration owned by FontLoader (this class delegates get/set)
// - Auto-detects environment (browser vs Node.js) for canvas creation
// - Draws text by looking up glyphs from atlases and positioning them with metrics/kerning
// - Uses textBaseline='bottom' positioning (y = bottom of text bounding box)
// - Supports placeholder rectangles when atlases are missing but metrics are available
//
// CANVAS FACTORY (Node.js only):
// - Node.js has no DOM, thus no native Canvas
// - BitmapText needs Canvas to:
//   1. Load atlas images from files
//   2. Scan pixels to find tight bounding boxes for each glyph
//   3. Create tight atlas from scanned data
// - Cannot pass class reference: HTMLCanvasElement is NOT constructible
//   (new HTMLCanvasElement() throws "Illegal constructor")
// - Must pass factory function: () => new Canvas()
// - Browser: via document.createElement('canvas')
// - Node.js: Must configure with canvas-mock providing Canvas constructor
//
// USAGE:
// - Zero configuration for browser: Just call BitmapText.drawTextFromAtlas()
// - Node.js: Optionally set canvas factory: BitmapText.setCanvasFactory(() => new Canvas())
// - Loading: BitmapText.loadFont(idString) or BitmapText.loadFonts([idStrings])
// - Query: BitmapText.hasFont(idString), BitmapText.getLoadedFonts()
//
class BitmapText {
  // ============================================
  // Static Constants
  // ============================================

  // Kerning unit divisor (kerning measured in 1/1000 em units)
  static KERNING_UNIT_DIVISOR = 1000;

  // Font asset naming conventions
  static METRICS_PREFIX = 'metrics-';
  static ATLAS_PREFIX = 'atlas-';
  static PNG_EXTENSION = '.png';
  static QOI_EXTENSION = '.qoi';
  static JS_EXTENSION = '.js';

  // ============================================
  // Static Storage & Configuration
  // ============================================

  // Font data storage delegated to AtlasDataStore and FontMetricsStore
  // (no private maps - stores are the single source of truth)

  // Configuration (user overrides, delegates to FontLoader for defaults)
  // fontDirectory is owned by FontLoader (it's the component that uses it)
  static #canvasFactory = (typeof document !== 'undefined' ? () => document.createElement('canvas') : null);         // Optional user override

  // Rendering resources (lazy-initialized on first render)
  static #coloredGlyphCanvas = null;    // Shared scratch canvas for coloring
  static #coloredGlyphCtx = null;       // 2D context for scratch canvas

  // Font loader (platform-specific, set at runtime)
  static #fontLoader = null;            // FontLoaderBrowser or FontLoaderNode

  // ============================================
  // Configuration API (Optional)
  // ============================================

  /**
   * Set font directory (overrides default)
   * Delegates to FontLoader which owns this configuration
   * @param {string} path - Path to font assets directory
   */
  static setFontDirectory(path) {
    BitmapText.#ensureFontLoader();
    BitmapText.#fontLoader.setFontDirectory(path);
  }

  /**
   * Get font directory (returns override or default)
   * Delegates to FontLoader which owns this configuration
   * @returns {string} Font directory path
   */
  static getFontDirectory() {
    BitmapText.#ensureFontLoader();
    return BitmapText.#fontLoader.getFontDirectory();
  }

  /**
   * Override canvas factory (Node.js only, testing, or custom canvas implementations)
   *
   * WHY A FACTORY FUNCTION?
   * HTMLCanvasElement is not constructible in JavaScript - new HTMLCanvasElement()
   * throws "Illegal constructor". Browser uses document.createElement('canvas'),
   * Node.js requires canvas-mock providing Canvas constructor.
   *
   * @param {Function} factory - Function that returns a canvas instance
   * @example
   * // Node.js
   * BitmapText.setCanvasFactory(() => new Canvas());
   *
   * // Browser (custom implementation)
   * BitmapText.setCanvasFactory(() => new OffscreenCanvas(0, 0));
   */
  static setCanvasFactory(factory) {
    BitmapText.#canvasFactory = factory;
    // Reset canvas to use new factory on next render
    BitmapText.#coloredGlyphCanvas = null;
    BitmapText.#coloredGlyphCtx = null;
  }

  /**
   * Get canvas factory (with fallback to platform default)
   *
   * USAGE PATTERN:
   * const canvas = BitmapText.getCanvasFactory()();  // Note double invocation
   *   - First ():  Gets the factory function
   *   - Second (): Invokes factory to create canvas
   *
   * @returns {Function} Canvas factory function
   */
  static getCanvasFactory() {
    return BitmapText.#canvasFactory;
  }

  /**
   * Configure multiple options at once
   * @param {Object} options - Configuration options
   * @param {string} [options.fontDirectory] - Font assets directory
   * @param {Function} [options.canvasFactory] - Canvas factory function
   */
  static configure(options = {}) {
    if (options.fontDirectory !== undefined) {
      BitmapText.setFontDirectory(options.fontDirectory);
    }
    if (options.canvasFactory !== undefined) {
      BitmapText.setCanvasFactory(options.canvasFactory);
    }
  }

  /**
   * Ensure font loader is initialized
   * @private
   */
  static #ensureFontLoader() {
    if (BitmapText.#fontLoader) {
      return;
    }

    // Check if platform-specific FontLoader is available
    if (typeof FontLoader === 'undefined') {
      throw new Error(
        'BitmapText: FontLoader not loaded.\n' +
        'Ensure platform-specific FontLoader is included before BitmapText.js:\n' +
        '  - Browser: <script src="src/platform/FontLoader-browser.js"></script>\n' +
        '  - Node.js: Include src/platform/FontLoader-node.js in bundle'
      );
    }

    BitmapText.#fontLoader = FontLoader;
  }

  // ============================================
  // Registration API (called by asset files)
  // ============================================

  /**
   * Register font metrics from metrics-*.js file
   * Delegates to FontLoader which handles platform-specific details
   * @param {string} idString - Font ID string
   * @param {Object} compactedData - Compacted metrics data
   */
  static registerMetrics(idString, compactedData) {
    BitmapText.#ensureFontLoader();
    FontLoaderBase.registerMetrics(idString, compactedData, BitmapText);
  }

  /**
   * Register atlas from atlas-*.js file (base64 only, positioning reconstructed later)
   * Delegates to FontLoader which handles platform-specific details
   * @param {string} idString - Font ID string
   * @param {string} base64Data - Base64-encoded atlas data
   */
  static registerAtlas(idString, base64Data) {
    BitmapText.#ensureFontLoader();
    FontLoaderBase.registerAtlas(idString, base64Data);
  }

  // ============================================
  // Rendering API
  // ============================================

  /**
   * Measure text dimensions
   *
   * RETURN VALUES: All measurements are in CSS PIXELS
   * - width, actualBoundingBox* values are CSS pixels
   * - Measurements are independent of canvas setup or context transforms
   * - To convert to physical pixels: multiply by fontProperties.pixelDensity
   *
   * NOTE: This method does NOT draw anything and is NOT affected by context transforms.
   * It purely calculates metrics based on font data.
   *
   * The metrics object has the same shape and meaning as the TextMetrics object (see
   * https://developer.mozilla.org/en-US/docs/Web/API/TextMetrics ):
   * - width: sum of character advancements (minus kerning adjustments)
   * - actualBoundingBoxLeft: actualBoundingBoxLeft of first character
   * - actualBoundingBoxRight: sum of advancements (excluding last) + last char's actualBoundingBoxRight
   *
   * @param {string} text - Text to measure
   * @param {FontProperties} fontProperties - Font configuration
   * @param {TextProperties} [textProperties] - Text rendering configuration (optional)
   * @returns {{metrics: {width: number, actualBoundingBoxLeft: number, actualBoundingBoxRight: number, actualBoundingBoxAscent: number, actualBoundingBoxDescent: number, fontBoundingBoxAscent: number, fontBoundingBoxDescent: number}|null, status: {code: number, missingChars?: Set}}}
   *   All numeric values in metrics are CSS pixels
   */
  static measureText(text, fontProperties, textProperties) {
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
        status: SUCCESS_STATUS
      };
    }

    // Check if FontMetrics exists at all
    const fontMetrics = FontMetricsStore.getFontMetrics(fontProperties);
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
        metrics: null,
        status: createErrorStatus(StatusCode.PARTIAL_METRICS, {
          missingChars: missingChars
        })
      };
    }

    // SUCCESS PATH: Calculate metrics normally
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

    actualBoundingBoxRight_CssPx = width_CssPx - advancement_CssPx;
    actualBoundingBoxRight_CssPx += characterMetrics.actualBoundingBoxRight;

    return {
      metrics: {
        width: width_CssPx,
        actualBoundingBoxLeft: actualBoundingBoxLeft_CssPx,
        actualBoundingBoxRight: actualBoundingBoxRight_CssPx,
        actualBoundingBoxAscent,
        actualBoundingBoxDescent,
        fontBoundingBoxAscent: characterMetrics.fontBoundingBoxAscent,
        fontBoundingBoxDescent: characterMetrics.fontBoundingBoxDescent
      },
      status: SUCCESS_STATUS
    };
  }

  /**
   * Draw text using pre-rendered glyphs from atlas
   *
   * COORDINATE SYSTEM:
   * - All coordinates are in CSS PIXELS relative to canvas origin (0,0)
   * - BitmapText IGNORES all context transforms (scale, translate, rotate, etc.)
   * - Internal conversion: physicalPixels = cssPixels × fontProperties.pixelDensity
   * - Transform is reset to identity during rendering, then restored
   *
   * TRANSFORM BEHAVIOR:
   * BitmapText will reset the context transform to identity before drawing,
   * meaning any ctx.scale(), ctx.translate(), ctx.rotate(), etc. are IGNORED.
   * This ensures pixel-perfect rendering at exact physical pixel positions.
   *
   * Example:
   *   ctx.scale(2, 2);          // User scales context
   *   ctx.translate(100, 50);    // User translates
   *   BitmapText.drawTextFromAtlas(ctx, "Hello", 10, 30, fontProps);
   *   // Text renders at (10, 30) CSS pixels from origin, NOT (120, 80)!
   *   // Transforms are ignored - coordinates are always absolute
   *
   * PIXEL DENSITY:
   * - Specified via fontProperties.pixelDensity (e.g., window.devicePixelRatio)
   * - Canvas should be sized: canvas.width = cssWidth × pixelDensity
   * - Do NOT use ctx.scale(dpr, dpr) - BitmapText handles density internally
   *
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D context (transform will be temporarily reset)
   * @param {string} text - Text to render
   * @param {number} x_CssPx - X position in CSS pixels (absolute, from canvas origin)
   * @param {number} y_CssPx - Y position in CSS pixels (absolute, from canvas origin, bottom baseline)
   * @param {FontProperties} fontProperties - Font configuration (including pixelDensity)
   * @param {TextProperties} [textProperties] - Text rendering configuration (optional)
   * @returns {{rendered: boolean, status: {code: number, missingChars?: Set, missingAtlasChars?: Set, placeholdersUsed?: boolean}}}
   *   Rendering result and status information
   */
  static drawTextFromAtlas(ctx, text, x_CssPx, y_CssPx, fontProperties, textProperties = null) {
    textProperties = textProperties || new TextProperties();

    // Lazy-initialize canvas on first render
    if (!BitmapText.#coloredGlyphCanvas) {
      // Explicit factory invocation: get factory, then call it
      BitmapText.#coloredGlyphCanvas = BitmapText.getCanvasFactory()();
      BitmapText.#coloredGlyphCtx = BitmapText.#coloredGlyphCanvas.getContext('2d');
    }

    // Check FontMetrics availability first
    const fontMetrics = FontMetricsStore.getFontMetrics(fontProperties);
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
    const atlasData = AtlasDataStore.getAtlasData(fontProperties);
    const atlasValid = BitmapText.#isValidAtlas(atlasData);

    // Track which glyphs are missing from atlas (for partial atlas status)
    const missingAtlasChars = new Set();
    let placeholdersUsed = false;

    // CRITICAL: Reset transform to identity for pixel-perfect physical rendering
    // BitmapText ignores ALL context transforms (scale, translate, rotate, etc.)
    // Coordinates are ALWAYS relative to canvas origin (0,0)
    // This ensures:
    // 1. Predictable positioning regardless of context state
    // 2. Pixel-perfect rendering at physical pixel boundaries
    // 3. No double-scaling when users apply ctx.scale(dpr, dpr)
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);  // Reset to identity matrix

    // Render text
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
      BitmapText.#drawCharacter(ctx,
        currentChar,
        position_PhysPx,
        atlasData,
        fontMetrics,
        textColor
      );

      position_PhysPx.x += BitmapText.#calculateCharacterAdvancement_PhysPx(fontMetrics, fontProperties, currentChar, nextChar, textProperties);
    }

    // Determine status code
    let statusCode;
    if (!atlasValid) {
      statusCode = StatusCode.NO_ATLAS;
    } else if (missingAtlasChars.size > 0) {
      statusCode = StatusCode.PARTIAL_ATLAS;
    } else {
      // Complete success
      ctx.restore();  // Restore original transform
      return {
        rendered: true,
        status: SUCCESS_STATUS
      };
    }

    // Return detailed status for non-success cases
    ctx.restore();  // Restore original transform
    return {
      rendered: true,
      status: createErrorStatus(statusCode, {
        missingAtlasChars: missingAtlasChars.size > 0 ? missingAtlasChars : undefined,
        placeholdersUsed: placeholdersUsed
      })
    };
  }

  // ============================================
  // Internal Rendering Helpers
  // ============================================
  // Get the advancement of the i-th character i.e. needed AFTER the i-th character
  // so that the i+1-th character is drawn at the right place
  // This depends on both the advancement specified by the glyph of the i-th character
  // AND by the kerning correction depending on the pair of the i-th and i+1-th characters

  static calculateAdvancement_CssPx(fontMetrics, fontProperties, char, nextChar, textProperties) {
    if (!textProperties) {
      textProperties = new TextProperties();
    }
    const characterMetrics = fontMetrics.getCharacterMetrics(char);
    let x_CssPx = 0;

    // LIMITATION: Only handles standard space (U+0020), not other Unicode space characters

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
    // Non-space characters
    else {
      x_CssPx += characterMetrics.width;
    }

    // Apply kerning correction
    let kerningCorrection = BitmapText.#getKerningCorrection(fontMetrics, char, nextChar, textProperties);

    // Kerning adjustments are measured in 1/1000 em units (font-size relative).
    // We convert to pixels by multiplying font size by the kerning correction
    // and dividing by 1000. This keeps kerning proportional to font size while
    // maintaining precision in the stored kerning values.
    x_CssPx -= fontProperties.fontSize * kerningCorrection / BitmapText.KERNING_UNIT_DIVISOR;

    // since we might want to actually _place_ a glyph,
    // following this measurement, we want to return an
    // integer coordinate here
    return Math.round(x_CssPx);
  }

  static #getKerningCorrection(fontMetrics, char, nextChar, textProperties) {
    if (!textProperties) {
      textProperties = new TextProperties();
    }

    if (textProperties.isKerningEnabled && nextChar) {
      return fontMetrics.getKerningAdjustment(char, nextChar);
    }

    return 0;
  }

  // There are several optimisations possible here:
  // 1. We could make a special case when the color is black
  // 2. We could cache the colored atlases in a small LRU cache
  // 3. We could batch first the coloring and then the characters blitting
  static #drawCharacter(ctx, char, position_PhysPx, atlasData, fontMetrics, textColor) {
    // If atlasData is missing but metrics exist, draw simplified placeholder rectangle
    if (!BitmapText.#isValidAtlas(atlasData)) {
      const characterMetrics = fontMetrics.getCharacterMetrics(char);
      if (characterMetrics) {
        BitmapText.#drawPlaceholderRectangle(ctx, char, position_PhysPx, characterMetrics, textColor);
      }
      return;
    }

    if (!atlasData.hasPositioning(char)) return;

    const atlasPositioning = atlasData.atlasPositioning.getPositioning(char);
    const atlasImage = atlasData.atlasImage.image;
    const coloredGlyphCanvas = BitmapText.#createColoredGlyph(atlasImage, atlasPositioning, textColor);
    BitmapText.#renderGlyphToMainCanvas(ctx, coloredGlyphCanvas, position_PhysPx, atlasPositioning);
  }

  static #createColoredGlyph(atlasImage, atlasPositioning, textColor) {
    const { xInAtlas, tightWidth, tightHeight } = atlasPositioning;

    // Setup temporary canvas, same size as the glyph
    BitmapText.#coloredGlyphCanvas.width = tightWidth;
    BitmapText.#coloredGlyphCanvas.height = tightHeight;
    BitmapText.#coloredGlyphCtx.clearRect(0, 0, tightWidth, tightHeight);

    // Draw original glyph
    BitmapText.#coloredGlyphCtx.globalCompositeOperation = 'source-over';
    BitmapText.#coloredGlyphCtx.drawImage(
      atlasImage,
      xInAtlas, 0,
      tightWidth, tightHeight,
      0, 0,
      tightWidth, tightHeight
    );

    // Apply color
    BitmapText.#coloredGlyphCtx.globalCompositeOperation = 'source-in';
    BitmapText.#coloredGlyphCtx.fillStyle = textColor;
    BitmapText.#coloredGlyphCtx.fillRect(0, 0, tightWidth, tightHeight);

    return BitmapText.#coloredGlyphCanvas;
  }

  static #renderGlyphToMainCanvas(ctx, coloredGlyphCanvas, position_PhysPx, atlasPositioning) {
    const { tightWidth, tightHeight, dx, dy } = atlasPositioning;

    // Round coordinates at draw stage for crisp, pixel-aligned rendering
    // Position tracking uses floats to avoid accumulation errors, but final
    // draw coordinates must be integers to prevent subpixel antialiasing
    // see https://stackoverflow.com/a/6061102
    ctx.drawImage(
      coloredGlyphCanvas,
      0, 0,
      tightWidth, tightHeight,
      Math.round(position_PhysPx.x + dx),
      Math.round(position_PhysPx.y + dy),
      tightWidth, tightHeight
    );
  }

  static #drawPlaceholderRectangle(ctx, char, position_PhysPx, characterMetrics, textColor) {
    if (char === ' ') return;

    if (characterMetrics.actualBoundingBoxLeft === undefined ||
        characterMetrics.actualBoundingBoxRight === undefined ||
        characterMetrics.actualBoundingBoxAscent === undefined ||
        characterMetrics.actualBoundingBoxDescent === undefined) {
      console.warn(`Missing bounding box metrics for character '${char}'`);
      return;
    }

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

    const actualColor = textColor || 'black';

    // Draw character-specific rectangle
    // Round coordinates at draw stage for crisp, pixel-aligned rendering
    // Position tracking uses floats to avoid accumulation errors, but final
    // draw coordinates must be integers to prevent subpixel antialiasing
    ctx.fillStyle = actualColor;
    ctx.fillRect(
      Math.round(rectX_PhysPx),
      Math.round(rectY_PhysPx),
      Math.round(width_PhysPx),
      Math.round(height_PhysPx)
    );
  }

  static #calculateCharacterAdvancement_PhysPx(fontMetrics, fontProperties, currentChar, nextChar, textProperties) {
    return this.calculateAdvancement_CssPx(fontMetrics, fontProperties, currentChar, nextChar, textProperties)
      * fontProperties.pixelDensity;
  }

  /**
   * Check if atlas data is valid and ready for rendering
   * @private
   * @param {*} atlasData - Potential AtlasData instance
   * @returns {boolean} True if atlasData is an AtlasData instance and is valid
   */
  static #isValidAtlas(atlasData) {
    if (!(atlasData instanceof AtlasData)) {
      return false;
    }
    return atlasData.isValid();
  }

  // ============================================
  // Loading API (Delegates to FontLoader)
  // ============================================

  /**
   * Load a single font
   * @param {string} idString - Font ID string
   * @param {Object} options - Loading options
   * @param {Function} [options.onProgress] - Progress callback (loaded, total)
   * @param {boolean} [options.isFileProtocol] - Whether using file:// protocol
   * @returns {Promise} Resolves when font is loaded
   */
  static async loadFont(idString, options = {}) {
    BitmapText.#ensureFontLoader();
    return BitmapText.#fontLoader.loadFont(idString, options, BitmapText);
  }

  /**
   * Load multiple fonts
   * @param {Array<string>} idStrings - Array of font ID strings
   * @param {Object} options - Loading options
   * @param {Function} [options.onProgress] - Progress callback (loaded, total)
   * @param {boolean} [options.isFileProtocol] - Whether using file:// protocol
   * @param {boolean} [options.loadMetrics] - Load metrics (default: true)
   * @param {boolean} [options.loadAtlases] - Load atlases (default: true)
   * @returns {Promise} Resolves when all fonts are loaded
   */
  static async loadFonts(idStrings, options = {}) {
    BitmapText.#ensureFontLoader();
    return BitmapText.#fontLoader.loadFonts(idStrings, options, BitmapText);
  }

  /**
   * Load only metrics for fonts
   * @param {Array<string>} idStrings - Array of font ID strings
   * @param {Object} options - Loading options
   * @returns {Promise} Resolves when metrics are loaded
   */
  static async loadMetrics(idStrings, options = {}) {
    BitmapText.#ensureFontLoader();
    return BitmapText.#fontLoader.loadMetrics(idStrings, options, BitmapText);
  }

  /**
   * Load only atlases for fonts (metrics must be loaded first)
   * @param {Array<string>} idStrings - Array of font ID strings
   * @param {Object} options - Loading options
   * @returns {Promise} Resolves when atlases are loaded
   */
  static async loadAtlases(idStrings, options = {}) {
    BitmapText.#ensureFontLoader();
    return BitmapText.#fontLoader.loadAtlases(idStrings, options, BitmapText);
  }

  // ============================================
  // Builder/Testing Tool API
  // ============================================

  /**
   * Set atlas data for a font (for builder/testing tools)
   * Public API - delegates to AtlasDataStore
   * @param {FontProperties} fontProperties - Font configuration
   * @param {AtlasData} atlasData - Atlas data to store
   */
  static setAtlasData(fontProperties, atlasData) {
    AtlasDataStore.setAtlasData(fontProperties, atlasData);
  }

  /**
   * Get atlas data for a font
   * Public API - delegates to AtlasDataStore
   * @param {FontProperties} fontProperties - Font configuration
   * @returns {AtlasData|undefined} Atlas data or undefined if not found
   */
  static getAtlasData(fontProperties) {
    return AtlasDataStore.getAtlasData(fontProperties);
  }

  /**
   * Delete atlas data for a font
   * Public API - delegates to AtlasDataStore
   * @param {FontProperties} fontProperties - Font configuration
   * @returns {boolean} True if atlas was deleted
   */
  static deleteAtlas(fontProperties) {
    return AtlasDataStore.deleteAtlas(fontProperties);
  }

  /**
   * Set font metrics for a font (for builder/testing tools)
   * Public API - delegates to FontMetricsStore
   * @param {FontProperties} fontProperties - Font configuration
   * @param {FontMetrics} fontMetrics - Font metrics to store
   */
  static setFontMetrics(fontProperties, fontMetrics) {
    FontMetricsStore.setFontMetrics(fontProperties, fontMetrics);
  }

  /**
   * Get font metrics for a font
   * Public API - delegates to FontMetricsStore
   * @param {FontProperties} fontProperties - Font configuration
   * @returns {FontMetrics|undefined} Font metrics or undefined if not found
   */
  static getFontMetrics(fontProperties) {
    return FontMetricsStore.getFontMetrics(fontProperties);
  }

  /**
   * Unload both metrics and atlas for a font
   * @param {string} idString - Font ID string
   */
  static unloadFont(idString) {
    const fontProperties = FontProperties.fromIDString(idString);
    FontMetricsStore.deleteFontMetrics(fontProperties);
    AtlasDataStore.deleteAtlas(fontProperties);
  }

  /**
   * Unload multiple fonts
   * @param {Array<string>} idStrings - Array of font ID strings
   */
  static unloadFonts(idStrings) {
    idStrings.forEach(id => this.unloadFont(id));
  }

  /**
   * Unload metrics (cascades to unload atlas)
   * @param {string} idString - Font ID string
   */
  static unloadMetrics(idString) {
    const fontProperties = FontProperties.fromIDString(idString);
    FontMetricsStore.deleteFontMetrics(fontProperties);
    AtlasDataStore.deleteAtlas(fontProperties); // Cascade: no metrics = no atlas
  }

  /**
   * Unload atlas only (keeps metrics)
   * @param {string} idString - Font ID string
   */
  static unloadAtlas(idString) {
    const fontProperties = FontProperties.fromIDString(idString);
    AtlasDataStore.deleteAtlas(fontProperties);
  }

  /**
   * Unload all fonts (both metrics and atlases)
   */
  static unloadAllFonts() {
    FontMetricsStore.clear();
    AtlasDataStore.clear();
  }

  /**
   * Unload all atlases (keep metrics)
   */
  static unloadAllAtlases() {
    AtlasDataStore.clear();
  }

  // ============================================
  // Query API
  // ============================================

  /**
   * Check if font is fully loaded (both metrics and atlas)
   * @param {string} idString - Font ID string
   * @returns {boolean} True if both metrics and atlas are loaded
   */
  static hasFont(idString) {
    return this.hasMetrics(idString) && this.hasAtlas(idString);
  }

  /**
   * Check if metrics are loaded for a font
   * @param {string} idString - Font ID string
   * @returns {boolean} True if metrics are loaded
   */
  static hasMetrics(idString) {
    const fontProperties = FontProperties.fromIDString(idString);
    return FontMetricsStore.hasFontMetrics(fontProperties);
  }

  /**
   * Check if atlas is loaded for a font
   * @param {string} idString - Font ID string
   * @returns {boolean} True if atlas is loaded
   */
  static hasAtlas(idString) {
    const fontProperties = FontProperties.fromIDString(idString);
    const atlasData = AtlasDataStore.getAtlasData(fontProperties);
    return atlasData && BitmapText.#isValidAtlas(atlasData);
  }

  /**
   * Get list of fully loaded fonts (both metrics and atlas)
   * @returns {Array<string>} Array of font ID strings
   */
  static getLoadedFonts() {
    const loaded = [];
    for (const key of FontMetricsStore.getAvailableFonts()) {
      const fontProperties = FontProperties.fromKey(key);
      const atlasData = AtlasDataStore.getAtlasData(fontProperties);
      if (atlasData && BitmapText.#isValidAtlas(atlasData)) {
        loaded.push(fontProperties.idString);
      }
    }
    return loaded;
  }

  /**
   * Get list of fonts with loaded metrics
   * @returns {Array<string>} Array of font ID strings
   */
  static getLoadedMetrics() {
    const loaded = [];
    for (const key of FontMetricsStore.getAvailableFonts()) {
      const fontProperties = FontProperties.fromKey(key);
      loaded.push(fontProperties.idString);
    }
    return loaded;
  }

  /**
   * Get list of fonts with loaded atlases
   * @returns {Array<string>} Array of font ID strings
   */
  static getLoadedAtlases() {
    const loaded = [];
    for (const key of AtlasDataStore.getAvailableFonts()) {
      const fontProperties = FontProperties.fromKey(key);
      const atlasData = AtlasDataStore.getAtlasData(fontProperties);
      if (BitmapText.#isValidAtlas(atlasData)) {
        loaded.push(fontProperties.idString);
      }
    }
    return loaded;
  }

  // ============================================
  // Testing Helpers
  // ============================================

  /**
   * Reset all state for testing
   * @private
   */
  static __resetForTesting() {
    FontMetricsStore.clear();
    AtlasDataStore.clear();
    // Clear FontLoader state
    if (FontLoaderBase._loadingPromises) {
      FontLoaderBase._loadingPromises.clear();
    }
    if (FontLoaderBase._tempAtlasPackages) {
      FontLoaderBase._tempAtlasPackages = {};
    }
    if (FontLoaderBase._pendingAtlases) {
      FontLoaderBase._pendingAtlases.clear();
    }
    // Reset FontLoader configuration
    if (FontLoaderBase.setFontDirectory) {
      FontLoaderBase.setFontDirectory(null);
    }
    BitmapText.#coloredGlyphCanvas = null;
    BitmapText.#coloredGlyphCtx = null;
    BitmapText.#canvasFactory = null;
    BitmapText.#fontLoader = null;
  }
}
