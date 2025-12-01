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

  // Minimum renderable font size (sizes < 8.5 use interpolated metrics from 8.5)
  static MIN_RENDERABLE_SIZE = 8.5;

  // Font asset naming conventions
  static METRICS_PREFIX = 'metrics-';
  static ATLAS_PREFIX = 'atlas-';
  static WEBP_EXTENSION = '.webp';
  static QOI_EXTENSION = '.qoi';
  static JS_EXTENSION = '.js';

  // Default text color (matches TextProperties default)
  static #DEFAULT_TEXT_COLOR = '#000000';

  /**
   * Fast font-invariant character detection helper
   * Uses string.includes() for ~1-2ns lookup performance
   *
   * @private
   * @param {string} char - Already-resolved character (caller must resolve aliases first)
   * @returns {boolean} True if character is font-invariant
   */
  static #isInvariantCharacter(char) {
    return CharacterSets.FONT_INVARIANT_CHARS.includes(char);
  }

  /**
   * Calculate optimal grid dimensions for atlas layout
   * Uses square-ish approach (ceil(sqrt(N))) to minimize max dimension
   *
   * For 204 characters: 15 columns × 14 rows (6 empty cells)
   *
   * @param {number} characterCount - Number of characters to arrange
   * @returns {{columns: number, rows: number}} Grid dimensions
   */
  static calculateOptimalGridDimensions(characterCount) {
    if (characterCount <= 0) {
      throw new Error('BitmapText: Character count must be positive');
    }

    // Square-ish grid: minimizes max dimension while keeping layout simple
    const columns = Math.ceil(Math.sqrt(characterCount));
    const rows = Math.ceil(characterCount / columns);

    return { columns, rows };
  }

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

  /**
   * Check if font size requires minimum size redirection
   * @param {number} fontSize - Font size in CSS pixels
   * @returns {boolean} True if size < 8.5 and should use interpolated metrics
   * @private
   */
  static #shouldUseMinSize(fontSize) {
    return fontSize < BitmapText.MIN_RENDERABLE_SIZE;
  }

  /**
   * Create FontProperties with minimum renderable size (8.5)
   * @param {FontProperties} fontProperties - Original font properties
   * @returns {FontProperties} New FontProperties with size 8.5
   * @private
   */
  static #createFontPropsAtMinSize(fontProperties) {
    return new FontProperties(
      fontProperties.pixelDensity,
      fontProperties.fontFamily,
      fontProperties.fontStyle,
      fontProperties.fontWeight,
      BitmapText.MIN_RENDERABLE_SIZE
    );
  }

  /**
   * Create interpolated FontMetrics wrapper for sizes < 8.5
   * Returns a wrapper object that interpolates all metric values proportionally
   * @param {FontMetrics} metricsAt8_5 - Font metrics at size 8.5
   * @param {number} targetSize - Desired font size (< 8.5)
   * @returns {InterpolatedFontMetrics} Interpolated metrics wrapper with FontMetrics-compatible interface
   * @private
   */
  static #createInterpolatedFontMetrics(metricsAt8_5, targetSize) {
    return new InterpolatedFontMetrics(metricsAt8_5, targetSize);
  }

  /**
   * Redirect idString for sizes < 8.5 to size 8.5
   * @param {string} idString - Original font ID string
   * @param {boolean} silent - If true, suppress console warning
   * @returns {{redirected: boolean, idString: string, originalSize: number}} Redirection result
   * @private
   */
  static #redirectIdStringIfNeeded(idString, silent = false) {
    const fontProps = FontProperties.fromIDString(idString);

    if (BitmapText.#shouldUseMinSize(fontProps.fontSize)) {
      const minSizeProps = BitmapText.#createFontPropsAtMinSize(fontProps);
      if (!silent) {
        console.warn(
          `BitmapText: Font size ${fontProps.fontSize}px requested. Redirecting to size ${BitmapText.MIN_RENDERABLE_SIZE}px ` +
          `(minimum supported size). Sizes < ${BitmapText.MIN_RENDERABLE_SIZE}px render using interpolated placeholder rectangles.`
        );
      }
      return {
        redirected: true,
        idString: minSizeProps.idString,
        originalSize: fontProps.fontSize
      };
    }

    return {
      redirected: false,
      idString: idString,
      originalSize: fontProps.fontSize
    };
  }

  // ============================================
  // Registration API (called by asset files)
  // ============================================

  /**
   * Convert registration parameters to ID string
   * Shared helper for registerMetrics and registerAtlas
   * @private
   * @param {number} density - Pixel density
   * @param {string} fontFamily - Font family name
   * @param {number} styleIdx - Style index (0=normal, 1=italic, 2=oblique)
   * @param {number} weightIdx - Weight index (0=normal, 1=bold, or numeric)
   * @param {number} size - Font size
   * @returns {string} ID string (e.g., "density-1-0-Arial-style-normal-weight-normal-size-19-0")
   */
  static #parametersToIDString(density, fontFamily, styleIdx, weightIdx, size) {
    // Decompress style and weight indices
    const style = styleIdx === 0 ? 'normal' : (styleIdx === 1 ? 'italic' : 'oblique');
    const weight = weightIdx === 0 ? 'normal' : (weightIdx === 1 ? 'bold' : String(weightIdx));

    // Format density (1 → 1-0, 1.5 → 1-5)
    const densityStr = String(density);
    const densityFormatted = densityStr.includes('.') ? densityStr.replace('.', '-') : `${densityStr}-0`;

    // Format size (18 → 18-0, 18.5 → 18-5)
    const sizeStr = String(size);
    const sizeFormatted = sizeStr.includes('.') ? sizeStr.replace('.', '-') : `${sizeStr}-0`;

    // Reconstruct full ID
    return `density-${densityFormatted}-${fontFamily}-style-${style}-weight-${weight}-size-${sizeFormatted}`;
  }

  /**
   * Register font metrics from metrics-*.js file
   * TIER 6c: Multi-parameter format only (no legacy support)
   *
   * @param {number} density - Pixel density (e.g., 1 or 1.5)
   * @param {string} fontFamily - Font family name (e.g., 'Arial')
   * @param {number} styleIdx - Style index (0=normal, 1=italic, 2=oblique)
   * @param {number} weightIdx - Weight index (0=normal, 1=bold, or numeric weight)
   * @param {number} size - Font size (e.g., 18 or 18.5)
   * @param {Array} compactedData - Tier 6c compacted metrics array
   */
  static registerMetrics(density, fontFamily, styleIdx, weightIdx, size, compactedData) {
    BitmapText.#ensureFontLoader();
    const fullIDString = BitmapText.#parametersToIDString(density, fontFamily, styleIdx, weightIdx, size);
    FontLoaderBase.registerMetrics(fullIDString, compactedData, BitmapText);
  }

  /**
   * Register atlas from atlas-*.js file (base64 only, positioning reconstructed later)
   * Delegates to FontLoader which handles platform-specific details
   * @param {number} density - Pixel density (e.g., 1 or 1.5)
   * @param {string} fontFamily - Font family name (e.g., 'Arial')
   * @param {number} styleIdx - Style index (0=normal, 1=italic, 2=oblique)
   * @param {number} weightIdx - Weight index (0=normal, 1=bold, or numeric weight)
   * @param {number} size - Font size (e.g., 18 or 18.5)
   * @param {string} base64Data - Base64-encoded atlas data
   */
  static registerAtlas(density, fontFamily, styleIdx, weightIdx, size, base64Data) {
    BitmapText.#ensureFontLoader();
    const fullIDString = BitmapText.#parametersToIDString(density, fontFamily, styleIdx, weightIdx, size);
    FontLoaderBase.registerAtlas(fullIDString, base64Data);
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
    let fontMetrics = FontMetricsStore.getFontMetrics(fontProperties);

    // If metrics not found and size < 8.5, try interpolating from size 8.5
    if (!fontMetrics && BitmapText.#shouldUseMinSize(fontProperties.fontSize)) {
      const minSizeProps = BitmapText.#createFontPropsAtMinSize(fontProperties);
      const metricsAt8_5 = FontMetricsStore.getFontMetrics(minSizeProps);

      if (metricsAt8_5) {
        // Create interpolated metrics wrapper
        fontMetrics = BitmapText.#createInterpolatedFontMetrics(metricsAt8_5, fontProperties.fontSize);
      } else {
        // Even 8.5 metrics don't exist
        return {
          metrics: null,
          status: createErrorStatus(StatusCode.NO_METRICS, {
            requiresMinSize: true,
            requestedSize: fontProperties.fontSize,
            minSize: BitmapText.MIN_RENDERABLE_SIZE
          })
        };
      }
    } else if (!fontMetrics) {
      return {
        metrics: null,
        status: createErrorStatus(StatusCode.NO_METRICS)
      };
    }

    // PRE-CREATE font-invariant font properties ONCE for potential auto-redirect
    const invariantFontProps = new FontProperties(
      fontProperties.pixelDensity,
      CharacterSets.INVARIANT_FONT_FAMILY,
      'normal',
      'normal',
      fontProperties.fontSize
    );

    // PRE-FETCH font-invariant font data
    let invariantFontMetrics = FontMetricsStore.getFontMetrics(invariantFontProps);

    // If font-invariant font not found and size < 8.5, try interpolating from size 8.5
    if (!invariantFontMetrics && BitmapText.#shouldUseMinSize(fontProperties.fontSize)) {
      const invariantMinSizeProps = BitmapText.#createFontPropsAtMinSize(invariantFontProps);
      const invariantMetricsAt8_5 = FontMetricsStore.getFontMetrics(invariantMinSizeProps);

      if (invariantMetricsAt8_5) {
        // Create interpolated metrics wrapper for font-invariant font
        invariantFontMetrics = BitmapText.#createInterpolatedFontMetrics(invariantMetricsAt8_5, fontProperties.fontSize);
      }
    }

    const hasInvariantFont = invariantFontMetrics !== null;

    // Resolve all character aliases upfront using fast regex pass
    // This is 2-386x faster than per-character resolution (see CharacterSets.resolveString)
    const resolvedText = CharacterSets.resolveString(text);
    const chars = [...resolvedText];

    // Scan for missing glyphs (excluding spaces which are handled specially)
    // Check each character against the appropriate font (base or font-invariant)
    const missingChars = new Set();
    for (const char of chars) {
      if (char !== ' ') {
        // Determine which font should handle this character
        const isInvariant = hasInvariantFont && BitmapText.#isInvariantCharacter(char);
        const checkFontMetrics = isInvariant ? invariantFontMetrics : fontMetrics;

        if (!checkFontMetrics.hasGlyph(char)) {
          missingChars.add(char);
        }
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
    let width_CssPx = 0;

    // First character (already resolved)
    const firstChar = chars[0];

    // Determine font for first character
    const firstCharIsInvariant = hasInvariantFont && BitmapText.#isInvariantCharacter(firstChar);
    let currentFontMetrics = firstCharIsInvariant ? invariantFontMetrics : fontMetrics;
    let currentFontProps = firstCharIsInvariant ? invariantFontProps : fontProperties;

    let characterMetrics = currentFontMetrics.getCharacterMetrics(firstChar);
    const actualBoundingBoxLeft_CssPx = characterMetrics.actualBoundingBoxLeft;
    let actualBoundingBoxAscent = 0;
    let actualBoundingBoxDescent = 0;
    let actualBoundingBoxRight_CssPx;
    let advancement_CssPx = 0;

    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      const nextChar = chars[i + 1];

      // FAST CHECK: Is this a font-invariant character? Switch fonts if needed
      const isInvariant = hasInvariantFont && BitmapText.#isInvariantCharacter(char);
      if (isInvariant && currentFontProps !== invariantFontProps) {
        currentFontMetrics = invariantFontMetrics;
        currentFontProps = invariantFontProps;
      } else if (!isInvariant && currentFontProps !== fontProperties) {
        currentFontMetrics = fontMetrics;
        currentFontProps = fontProperties;
      }

      characterMetrics = currentFontMetrics.getCharacterMetrics(char);

      actualBoundingBoxAscent = Math.max(actualBoundingBoxAscent, characterMetrics.actualBoundingBoxAscent);
      actualBoundingBoxDescent = Math.min(actualBoundingBoxDescent, characterMetrics.actualBoundingBoxDescent);

      advancement_CssPx = this.calculateAdvancement_CssPx(currentFontMetrics, currentFontProps, char, nextChar, textProperties, characterMetrics);
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
    let fontMetrics = FontMetricsStore.getFontMetrics(fontProperties);
    let forceInvalidAtlas = false;

    // For sizes < 8.5, always use interpolated metrics from 8.5 and force placeholder mode
    if (BitmapText.#shouldUseMinSize(fontProperties.fontSize)) {
      const minSizeProps = BitmapText.#createFontPropsAtMinSize(fontProperties);
      const metricsAt8_5 = FontMetricsStore.getFontMetrics(minSizeProps);

      if (!metricsAt8_5) {
        // Size 8.5 metrics don't exist - can't render
        return {
          rendered: false,
          status: createErrorStatus(StatusCode.NO_METRICS, {
            requiresMinSize: true,
            requestedSize: fontProperties.fontSize,
            minSize: BitmapText.MIN_RENDERABLE_SIZE
          })
        };
      }

      // Create interpolated metrics wrapper and force placeholder mode
      fontMetrics = BitmapText.#createInterpolatedFontMetrics(metricsAt8_5, fontProperties.fontSize);
      forceInvalidAtlas = true; // Always use placeholders for sizes < 8.5
    } else if (!fontMetrics) {
      // Normal size but metrics not found
      return {
        rendered: false,
        status: createErrorStatus(StatusCode.NO_METRICS)
      };
    }

    // PRE-CREATE font-invariant font properties ONCE (not per-character!)
    // This avoids object allocation in hot rendering loop
    const invariantFontProps = new FontProperties(
      fontProperties.pixelDensity,
      CharacterSets.INVARIANT_FONT_FAMILY,
      'normal',  // Always normal style for font-invariant characters
      'normal',  // Always normal weight for font-invariant characters
      fontProperties.fontSize
    );

    // PRE-FETCH font-invariant font data ONCE
    let invariantFontMetrics = FontMetricsStore.getFontMetrics(invariantFontProps);

    // If font-invariant font not found and size < 8.5, try interpolating from size 8.5
    if (!invariantFontMetrics && BitmapText.#shouldUseMinSize(fontProperties.fontSize)) {
      const invariantMinSizeProps = BitmapText.#createFontPropsAtMinSize(invariantFontProps);
      const invariantMetricsAt8_5 = FontMetricsStore.getFontMetrics(invariantMinSizeProps);

      if (invariantMetricsAt8_5) {
        // Create interpolated metrics wrapper for font-invariant font
        invariantFontMetrics = BitmapText.#createInterpolatedFontMetrics(invariantMetricsAt8_5, fontProperties.fontSize);
      }
    }

    const hasInvariantFont = invariantFontMetrics !== null;

    // Resolve all character aliases upfront using fast regex pass
    // This is 2-386x faster than per-character resolution (see CharacterSets.resolveString)
    const resolvedText = CharacterSets.resolveString(text);
    const chars = [...resolvedText];

    // Scan for missing metrics (can't render without metrics)
    // Check each character against the appropriate font (base or font-invariant)
    const missingMetricsChars = new Set();
    for (const char of chars) {
      if (char !== ' ') {
        // Determine which font should handle this character
        const isInvariant = hasInvariantFont && BitmapText.#isInvariantCharacter(char);
        const checkFontMetrics = isInvariant ? invariantFontMetrics : fontMetrics;

        if (!checkFontMetrics.hasGlyph(char)) {
          missingMetricsChars.add(char);
        }
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

    // Check atlas data availability (force invalid for sizes < 8.5)
    let atlasData = forceInvalidAtlas ? null : AtlasDataStore.getAtlasData(fontProperties);
    const atlasValid = forceInvalidAtlas ? false : BitmapText.#isValidAtlas(atlasData);

    const invariantAtlasData = invariantFontMetrics ?
      AtlasDataStore.getAtlasData(invariantFontProps) : null;
    const invariantAtlasValid = invariantFontMetrics ?
      BitmapText.#isValidAtlas(invariantAtlasData) : false;

    // Track current font to minimize redundant lookups
    let currentFontProps = fontProperties;
    let currentFontMetrics = fontMetrics;
    let currentAtlasData = atlasData;
    let currentAtlasValid = atlasValid;

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
    const textColor = textProperties.textColor;

    // BASELINE SUPPORT: Convert user's y from their chosen baseline to 'bottom' baseline
    // Get baseline data from first character (baseline values are identical for all characters in a font)
    // Use first actual character, or fallback to space character for baseline calculation
    const firstChar = chars.find(c => fontMetrics.hasGlyph(c)) || chars[0];
    const characterMetricsForBaseline = fontMetrics.getCharacterMetrics(firstChar);
    const baselineOffset_CssPx = characterMetricsForBaseline
      ? BitmapText.#calculateBaselineOffsetToBottom(textProperties.textBaseline, characterMetricsForBaseline)
      : 0;

    // ALIGNMENT SUPPORT: Convert user's x from their chosen alignment to 'left' alignment
    // Measure text width to calculate alignment offset (measureText accounts for kerning if enabled)
    let alignmentOffset_CssPx = 0;
    if (textProperties.textAlign !== 'left') {
      const measureResult = BitmapText.measureText(text, fontProperties, textProperties);
      if (measureResult.status.code === 0 && measureResult.metrics) {
        // Successfully measured text - calculate alignment offset
        alignmentOffset_CssPx = BitmapText.#calculateAlignmentOffsetToLeft(
          textProperties.textAlign,
          measureResult.metrics.width
        );
      } else {
        // Failed to measure (missing glyphs, etc.) - default to left alignment (offset = 0)
        // Text will still render but won't be aligned as requested
        console.warn(`BitmapText: Failed to measure text for alignment '${textProperties.textAlign}', defaulting to left alignment`);
      }
    }

    // Apply baseline and alignment offsets, then convert to physical pixels
    const position_PhysPx = {
      x: (x_CssPx + alignmentOffset_CssPx) * fontProperties.pixelDensity,
      y: (y_CssPx + baselineOffset_CssPx) * fontProperties.pixelDensity
    };

    // OPTIMIZATION: Batch colored text rendering (single composite operation)
    // Check if we're rendering colored text with a valid atlas
    const isColoredText = textColor !== BitmapText.#DEFAULT_TEXT_COLOR;
    if (isColoredText && atlasValid) {
      // Use optimized batch rendering for colored text
      // This reduces composite operations from N (per character) to 1 (per text string)
      const batchResult = BitmapText.#drawColoredTextBatched(
        ctx, text, chars, position_PhysPx, atlasData, fontMetrics, fontProperties, textProperties
      );

      // Merge batch results into tracking sets
      batchResult.missingAtlasChars.forEach(char => missingAtlasChars.add(char));
      placeholdersUsed = placeholdersUsed || batchResult.placeholdersUsed;

      // Skip character-by-character loop for colored text
    } else {
      // Black text or invalid atlas: use character-by-character rendering
      // Note: chars array is already resolved (emojis→symbols) from resolvedText
      for (let i = 0; i < chars.length; i++) {
        const currentChar = chars[i];
        const nextChar = chars[i + 1];

        // FAST CHECK: Is this a font-invariant character? (string.includes on 18 chars = ~1-2ns)
        const isInvariant = hasInvariantFont && BitmapText.#isInvariantCharacter(currentChar);

        // Switch font ONLY if needed (avoids redundant assignments)
        if (isInvariant && currentFontProps !== invariantFontProps) {
          currentFontProps = invariantFontProps;
          currentFontMetrics = invariantFontMetrics;
          currentAtlasData = invariantAtlasData;
          currentAtlasValid = invariantAtlasValid;
        } else if (!isInvariant && currentFontProps !== fontProperties) {
          // Switch back to base font
          currentFontProps = fontProperties;
          currentFontMetrics = fontMetrics;
          currentAtlasData = atlasData;
          currentAtlasValid = atlasValid;
        }

        // Check if atlas has a glyph for this character (excluding spaces)
        if (currentChar !== ' ') {
          if (!currentAtlasValid || !currentAtlasData.hasPositioning(currentChar)) {
            missingAtlasChars.add(currentChar);
            placeholdersUsed = true;
          }
        }

        // Draw using appropriate font (either real glyph or placeholder)
        BitmapText.#drawCharacter(ctx,
          currentChar,
          position_PhysPx,
          currentAtlasData,
          currentFontMetrics,
          textColor
        );

        // Calculate advancement using current font's metrics
        position_PhysPx.x += BitmapText.#calculateCharacterAdvancement_PhysPx(
          currentFontMetrics, currentFontProps, currentChar, nextChar, textProperties);
      }
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

  static calculateAdvancement_CssPx(fontMetrics, fontProperties, char, nextChar, textProperties, characterMetrics = null) {
    if (!textProperties) {
      textProperties = new TextProperties();
    }
    if (!characterMetrics) {
      characterMetrics = fontMetrics.getCharacterMetrics(char);
    }
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

    // For interpolated metrics (sizes < 8.5), preserve float precision for linear scaling
    // For normal metrics (sizes ≥ 8.5), round to integers for crisp pixel-aligned rendering
    if (fontMetrics.isInterpolatedMetrics) {
      return x_CssPx;  // Float positioning for placeholder rectangles
    } else {
      return Math.round(x_CssPx);  // Integer positioning for crisp atlas glyphs
    }
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

  /**
   * Calculate y-offset to convert from specified textBaseline to 'bottom' baseline
   *
   * INTERNAL REFERENCE: BitmapText uses 'bottom' baseline for all dy calculations.
   * All glyph dy offsets are pre-calculated assuming y is at the bottom of the em square.
   * This method converts user's chosen baseline to that internal reference.
   *
   * COORDINATE SYSTEM: y increases downward (Canvas convention)
   * All baseline distances are in CSS pixels and relative to alphabetic baseline (ab = 0)
   *
   * BASELINE GEOMETRY:
   * - top: At fontBoundingBoxAscent above alphabetic
   * - hanging: At hangingBaseline above alphabetic (Tibetan, Devanagari)
   * - middle: At (fontBoundingBoxAscent - fontBoundingBoxDescent) / 2 above alphabetic
   * - alphabetic: At 0 (reference point for Latin scripts)
   * - ideographic: At ideographicBaseline below alphabetic (CJK scripts, negative value)
   * - bottom: At fontBoundingBoxDescent below alphabetic
   *
   * @private
   * @param {string} textBaseline - User's chosen baseline ('top', 'hanging', 'middle', 'alphabetic', 'ideographic', 'bottom')
   * @param {Object} characterMetrics - Metrics containing baseline data (fba, fbd, hb, ab, ib)
   * @returns {number} Offset in CSS pixels to add to y coordinate to reach 'bottom' baseline
   */
  static #calculateBaselineOffsetToBottom(textBaseline, characterMetrics) {
    // Extract baseline measurements from character metrics
    // These values are captured from browser's TextMetrics during font generation
    const fba = characterMetrics.fontBoundingBoxAscent;    // Distance from alphabetic to top of em square (positive)
    const fbd = characterMetrics.fontBoundingBoxDescent;   // Distance from alphabetic to bottom of em square (positive, downward)
    const hb = characterMetrics.hangingBaseline;           // Distance from alphabetic to hanging baseline (positive, upward)
    const ib = characterMetrics.ideographicBaseline;       // Distance from alphabetic to ideographic baseline (negative, downward)

    // Convert from user's baseline to bottom baseline
    // Formulas derived from geometric relationships in em square coordinate system
    switch (textBaseline) {
      case 'top':
        // Top of em square → Bottom of em square
        // Move down by full em height: ascent + descent
        return fba + fbd;

      case 'hanging':
        // Hanging baseline → Bottom of em square
        // Hanging is hb above alphabetic, bottom is fbd below alphabetic
        // Total distance: hb (up to alphabetic) + fbd (down to bottom)
        return hb + fbd;

      case 'middle':
        // Middle of em square → Bottom of em square
        // Middle is halfway between top and bottom
        // Distance from middle to bottom: (ascent + descent) / 2
        return (fba + fbd) / 2;

      case 'alphabetic':
        // Alphabetic baseline → Bottom of em square
        // Alphabetic is fbd above bottom (standard for Latin text)
        return fbd;

      case 'ideographic':
        // Ideographic baseline → Bottom of em square
        // Ideographic is ib pixels relative to alphabetic (negative = below alphabetic)
        // Distance from ideographic to bottom: fbd + ib
        // Example: if fbd=4 and ib=-4.0264, offset = 4 + (-4.0264) = -0.0264
        // This small negative offset places ideographic just above bottom, matching native Canvas
        return fbd + ib;

      case 'bottom':
        // Already at bottom baseline - no offset needed
        return 0;

      default:
        // Unknown baseline value - warn and default to bottom
        console.warn(`BitmapText: Unknown textBaseline '${textBaseline}', defaulting to 'bottom'. Valid values: top, hanging, middle, alphabetic, ideographic, bottom`);
        return 0;
    }
  }

  /**
   * Calculate x-offset to convert from specified textAlign to 'left' alignment
   *
   * INTERNAL REFERENCE: BitmapText uses 'left' alignment for internal rendering.
   * All text rendering starts from the x-coordinate and advances rightward.
   * This method converts user's chosen alignment to that internal reference.
   *
   * COORDINATE SYSTEM: x increases rightward (Canvas convention)
   * All measurements are in CSS pixels
   *
   * ALIGNMENT GEOMETRY:
   * - left: x marks the start of the text (no offset needed)
   * - center: x marks the center of the text (offset by -width/2)
   * - right: x marks the end of the text (offset by -width)
   *
   * @private
   * @param {string} textAlign - User's chosen alignment ('left', 'center', 'right')
   * @param {number} textWidth_CssPx - Total width of the text in CSS pixels
   * @returns {number} Offset in CSS pixels to add to x coordinate to reach 'left' alignment
   */
  static #calculateAlignmentOffsetToLeft(textAlign, textWidth_CssPx) {
    // Convert from user's alignment to left alignment (internal reference)
    switch (textAlign) {
      case 'left':
        // Already at left alignment - no offset needed
        return 0;

      case 'center':
        // Center alignment → Left alignment
        // Text is centered at x, need to shift left by half width to get start position
        return -textWidth_CssPx / 2;

      case 'right':
        // Right alignment → Left alignment
        // Text ends at x, need to shift left by full width to get start position
        return -textWidth_CssPx;

      default:
        // Unknown alignment value - warn and default to left
        console.warn(`BitmapText: Unknown textAlign '${textAlign}', defaulting to 'left'. Valid values: left, center, right`);
        return 0;
    }
  }

  /**
   * Draw colored text using optimized batch rendering
   *
   * OPTIMIZATION: Instead of switching composite operations for EACH character:
   * 1. Measure total text extent ONCE
   * 2. Draw ALL glyphs to one scratch canvas (in original black form)
   * 3. Apply color transformation ONCE using composite operation
   * 4. Copy entire colored text block to main canvas ONCE
   *
   * This reduces expensive composite operation switches from N (per character) to 1 (per text string)
   * Expected performance improvement: 2-5x faster for colored text rendering
   *
   * @private
   * @param {CanvasRenderingContext2D} ctx - Main canvas context
   * @param {string} text - Full text string to render
   * @param {Array<string>} chars - Text split into characters
   * @param {Object} startPosition_PhysPx - Starting position in physical pixels {x, y}
   * @param {AtlasData} atlasData - Atlas data containing glyphs
   * @param {FontMetrics} fontMetrics - Font metrics for measurements
   * @param {FontProperties} fontProperties - Font configuration
   * @param {TextProperties} textProperties - Text rendering configuration
   * @returns {{missingAtlasChars: Set, placeholdersUsed: boolean}} Status information
   */
  static #drawColoredTextBatched(ctx, text, chars, startPosition_PhysPx, atlasData, fontMetrics, fontProperties, textProperties) {
    const missingAtlasChars = new Set();
    let placeholdersUsed = false;

    // Step 1: Measure text to determine bounding box for scratch canvas
    const measureResult = BitmapText.measureText(text, fontProperties, textProperties);
    if (measureResult.status.code !== 0 || !measureResult.metrics) {
      // Cannot measure - fallback to character-by-character rendering
      console.warn('BitmapText: Batch rendering failed (cannot measure text), falling back to per-character rendering');
      return { missingAtlasChars, placeholdersUsed };
    }

    const metrics = measureResult.metrics;

    // PRE-CREATE font-invariant font properties ONCE
    const invariantFontProps = new FontProperties(
      fontProperties.pixelDensity,
      CharacterSets.INVARIANT_FONT_FAMILY,
      'normal',
      'normal',
      fontProperties.fontSize
    );

    // PRE-FETCH font-invariant font data
    const invariantFontMetrics = FontMetricsStore.getFontMetrics(invariantFontProps);
    const invariantAtlasData = invariantFontMetrics ?
      AtlasDataStore.getAtlasData(invariantFontProps) : null;
    const hasInvariantFont = invariantFontMetrics !== null;

    // Track current font to minimize lookups
    let currentFontProps = fontProperties;
    let currentFontMetrics = fontMetrics;
    let currentAtlasData = atlasData;

    // Calculate scratch canvas dimensions in physical pixels
    // CRITICAL: Use FONT bounding box (not actual text bounding box)
    // This ensures we have room for ALL characters in the font, not just those in this text
    // Example: "hello" has small actualBoundingBoxAscent (x-height only)
    //          but we need room for "HELLO" (cap-height) when rendering any text
    //
    // CRITICAL: Calculate VISUAL width (actual pixel span) not typographic width (advancement)
    //
    // Canvas API Semantics:
    // - metrics.width = sum of character advancements (includes kerning, represents "cursor advancement")
    // - metrics.actualBoundingBoxLeft = distance from text start to leftmost pixel
    // - metrics.actualBoundingBoxRight = distance from text start to rightmost pixel
    // - Visual width = actualBoundingBoxLeft + actualBoundingBoxRight (actual pixels occupied)
    //
    // WIDTH DIMENSION ROUNDING: Use Math.ceil on physical pixels for visual width
    // Canvas width must accommodate all pixels including those at fractional positions.
    // Math.ceil ensures glyphs drawing at rounded-up positions won't be clipped.
    // Example: visualWidth=24.4 → Math.ceil(24.4)=25 → canvas [0-24] → glyph at px 24 fits ✓
    const visualWidth_CssPx = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
    const textWidth_PhysPx = Math.ceil(visualWidth_CssPx * fontProperties.pixelDensity);

    // HEIGHT DIMENSION ROUNDING: MUST match GlyphFAB.js calculation EXACTLY
    // CRITICAL: GlyphFAB.js (lines 247-252) uses Math.round on CSS pixels, then multiplies by pixelDensity
    // The dy offsets in atlas were calculated based on THIS EXACT canvas height
    const fontBoundingBoxHeight_CssPx = Math.round(
      metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent
    );
    const textHeight_PhysPx = fontBoundingBoxHeight_CssPx * fontProperties.pixelDensity;

    // Pre-round position offset values for consistent positioning throughout
    // CRITICAL: These values are used both for positioning glyphs inside scratch canvas
    // and for positioning the final scratch canvas copy to main canvas
    // Using the SAME rounded values prevents 1-pixel misalignment from float rounding discrepancies
    const actualBoundingBoxLeft_PhysPx = Math.round(metrics.actualBoundingBoxLeft * fontProperties.pixelDensity);

    // CRITICAL: Baseline position must match GlyphFAB.js (GlyphFAB.js:288)
    // GlyphFAB positions baseline at "canvas.height / pixelDensity - 1" in CSS pixels
    // In physical pixels: baseline_y = canvas.height - pixelDensity
    // The dy offsets in atlas are calculated relative to THIS baseline position
    // Missing this offset causes descender clipping (bottom row of j, y, g, p, q cut off)
    const baselineY_PhysPx = textHeight_PhysPx - fontProperties.pixelDensity;

    // Safety check: ensure dimensions are reasonable
    if (textWidth_PhysPx <= 0 || textHeight_PhysPx <= 0 || textWidth_PhysPx > 32000 || textHeight_PhysPx > 32000) {
      console.warn(`BitmapText: Invalid scratch canvas dimensions (${textWidth_PhysPx}x${textHeight_PhysPx}), falling back`);
      return { missingAtlasChars, placeholdersUsed };
    }

    // Step 2: Setup scratch canvas sized for entire text block
    BitmapText.#coloredGlyphCanvas.width = textWidth_PhysPx;
    BitmapText.#coloredGlyphCanvas.height = textHeight_PhysPx;
    BitmapText.#coloredGlyphCtx.clearRect(0, 0, textWidth_PhysPx, textHeight_PhysPx);

    // Step 3: Draw ALL glyphs to scratch canvas in their original black form
    // Position relative to scratch canvas origin (not main canvas)
    const position_PhysPx = {
      // Horizontal: Start at actualBoundingBoxLeft to account for glyphs that protrude left (e.g., italic 'f')
      // CRITICAL: Use pre-rounded value (line 950) for consistency with final copy (line 1017+)
      x: actualBoundingBoxLeft_PhysPx,
      // Vertical: Position baseline to match GlyphFAB.js rendering (GlyphFAB.js:288)
      // Baseline is at "canvas.height / pixelDensity - 1" in CSS pixels
      // which equals "canvas.height - pixelDensity" in physical pixels
      // NOT at canvas bottom, but one pixel-row above it
      // Glyphs draw upward/downward from here using their dy offsets from atlas
      // CRITICAL: Must match glyph building baseline or dy offsets will be wrong (descenders clip)
      y: baselineY_PhysPx
    };

    // Note: chars array is already resolved (emojis→symbols) from caller
    for (let i = 0; i < chars.length; i++) {
      const currentChar = chars[i];
      const nextChar = chars[i + 1];

      // FAST CHECK: Is this a font-invariant character? (string.includes on 18 chars = ~1-2ns)
      const isInvariant = hasInvariantFont && BitmapText.#isInvariantCharacter(currentChar);

      // Switch font ONLY if needed (avoids redundant assignments)
      if (isInvariant && currentFontProps !== invariantFontProps) {
        currentFontProps = invariantFontProps;
        currentFontMetrics = invariantFontMetrics;
        currentAtlasData = invariantAtlasData;
      } else if (!isInvariant && currentFontProps !== fontProperties) {
        // Switch back to base font
        currentFontProps = fontProperties;
        currentFontMetrics = fontMetrics;
        currentAtlasData = atlasData;
      }

      // Track missing characters
      if (currentChar !== ' ' && !currentAtlasData.hasPositioning(currentChar)) {
        missingAtlasChars.add(currentChar);
        placeholdersUsed = true;
        // Advance position even for missing characters to maintain layout
        position_PhysPx.x += BitmapText.#calculateCharacterAdvancement_PhysPx(
          currentFontMetrics, currentFontProps, currentChar, nextChar, textProperties
        );
        continue;
      }

      // Draw glyph to scratch canvas (skip spaces, they have no visual)
      if (currentChar !== ' ' && currentAtlasData.hasPositioning(currentChar)) {
        const atlasPositioning = currentAtlasData.atlasPositioning.getPositioning(currentChar);
        const atlasImage = currentAtlasData.atlasImage.image;
        const { xInAtlas, yInAtlas, tightWidth, tightHeight, dx, dy } = atlasPositioning;

        // Draw original glyph (black) to scratch canvas at correct position
        BitmapText.#coloredGlyphCtx.drawImage(
          atlasImage,
          xInAtlas, yInAtlas,
          tightWidth, tightHeight,
          Math.round(position_PhysPx.x + dx),
          Math.round(position_PhysPx.y + dy),
          tightWidth, tightHeight
        );
      }

      // Advance position for next character
      position_PhysPx.x += BitmapText.#calculateCharacterAdvancement_PhysPx(
        currentFontMetrics, currentFontProps, currentChar, nextChar, textProperties
      );
    }

    // Step 4: Apply color transformation ONCE to entire text
    // This is the key optimization - only ONE composite operation instead of N
    BitmapText.#coloredGlyphCtx.globalCompositeOperation = 'source-in';
    BitmapText.#coloredGlyphCtx.fillStyle = textProperties.textColor;
    BitmapText.#coloredGlyphCtx.fillRect(0, 0, textWidth_PhysPx, textHeight_PhysPx);

    // Reset composite operation for future use
    BitmapText.#coloredGlyphCtx.globalCompositeOperation = 'source-over';

    // Step 5: Copy entire colored text block to main canvas ONCE
    // POSITIONING GEOMETRY:
    // - Main canvas: startPosition_PhysPx.y is at the bottom baseline (textBaseline='bottom')
    // - Scratch canvas: baseline is at y = baselineY_PhysPx (textHeight - pixelDensity, NOT at canvas bottom)
    // - To align baselines: scratch canvas top = startPosition_PhysPx.y - baselineY_PhysPx
    // - Horizontal: account for actualBoundingBoxLeft offset (glyphs that protrude left)
    // CRITICAL: Use baselineY_PhysPx (line 957) not textHeight_PhysPx to account for baseline offset
    ctx.drawImage(
      BitmapText.#coloredGlyphCanvas,
      0, 0,
      textWidth_PhysPx, textHeight_PhysPx,
      Math.round(startPosition_PhysPx.x) - actualBoundingBoxLeft_PhysPx,
      Math.round(startPosition_PhysPx.y) - baselineY_PhysPx,
      textWidth_PhysPx, textHeight_PhysPx
    );

    return { missingAtlasChars, placeholdersUsed };
  }

  // Rendering optimizations:
  // 1. ✓ IMPLEMENTED: Black text fast path (see #drawCharacterDirect for 2-3x speedup)
  // 2. ✓ IMPLEMENTED: Batch colored text rendering (single composite operation per text string)
  // 3. FUTURE: Cache colored glyphs in LRU cache to avoid re-coloring same characters
  static #drawCharacter(ctx, char, position_PhysPx, atlasData, fontMetrics, textColor) {
    // If atlasData is missing but metrics exist, draw simplified placeholder rectangle
    if (!BitmapText.#isValidAtlas(atlasData)) {
      const characterMetrics = fontMetrics.getCharacterMetrics(char);
      if (characterMetrics) {
        BitmapText.#drawPlaceholderRectangle(ctx, char, position_PhysPx, characterMetrics, textColor);
      }
      return;
    }

    // FAST PATH: Black text renders directly from atlas (2-3x faster)
    // Skips scratch canvas + composite operations when using default color
    if (textColor === BitmapText.#DEFAULT_TEXT_COLOR) {
      BitmapText.#drawCharacterDirect(ctx, char, position_PhysPx, atlasData, fontMetrics);
      return;
    }

    // NOTE: Colored text now uses batch rendering in drawTextFromAtlas
    // This method is kept for compatibility/fallback but should rarely be called for colored text
    // SLOW PATH: Colored text requires double-pass rendering
    // 1. Copy glyph from atlas to scratch canvas
    // 2. Apply color using composite operation
    // 3. Draw colored glyph to main canvas
    if (!atlasData.hasPositioning(char)) return;

    const atlasPositioning = atlasData.atlasPositioning.getPositioning(char);
    const atlasImage = atlasData.atlasImage.image;
    const coloredGlyphCanvas = BitmapText.#createColoredGlyph(atlasImage, atlasPositioning, textColor);
    BitmapText.#renderGlyphToMainCanvas(ctx, coloredGlyphCanvas, position_PhysPx, atlasPositioning);
  }

  static #createColoredGlyph(atlasImage, atlasPositioning, textColor) {
    const { xInAtlas, yInAtlas, tightWidth, tightHeight } = atlasPositioning;

    // Setup temporary canvas, same size as the glyph
    BitmapText.#coloredGlyphCanvas.width = tightWidth;
    BitmapText.#coloredGlyphCanvas.height = tightHeight;
    BitmapText.#coloredGlyphCtx.clearRect(0, 0, tightWidth, tightHeight);

    // Draw original glyph
    BitmapText.#coloredGlyphCtx.globalCompositeOperation = 'source-over';
    BitmapText.#coloredGlyphCtx.drawImage(
      atlasImage,
      xInAtlas, yInAtlas,
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

  /**
   * Fast path: Draw character directly from atlas (black text only)
   * Skips scratch canvas and color composite operations for 2-3x faster rendering
   * @private
   */
  static #drawCharacterDirect(ctx, char, position_PhysPx, atlasData, fontMetrics) {
    if (!atlasData.hasPositioning(char)) return;

    const atlasPositioning = atlasData.atlasPositioning.getPositioning(char);
    const atlasImage = atlasData.atlasImage.image;
    const { xInAtlas, yInAtlas, tightWidth, tightHeight, dx, dy } = atlasPositioning;

    // Single drawImage operation: atlas → main canvas
    // Round coordinates at draw stage for crisp, pixel-aligned rendering
    // Position tracking uses floats to avoid accumulation errors, but final
    // draw coordinates must be integers to prevent subpixel antialiasing
    ctx.drawImage(
      atlasImage,
      xInAtlas, yInAtlas,
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
    // Redirect sizes < 8.5 to size 8.5
    const redirection = BitmapText.#redirectIdStringIfNeeded(idString);
    return BitmapText.#fontLoader.loadFont(redirection.idString, options, BitmapText);
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
    // Redirect sizes < 8.5 to size 8.5 for all idStrings
    const redirectedIdStrings = idStrings.map(idString => {
      const redirection = BitmapText.#redirectIdStringIfNeeded(idString);
      return redirection.idString;
    });
    return BitmapText.#fontLoader.loadFonts(redirectedIdStrings, options, BitmapText);
  }

  /**
   * Load only metrics for fonts
   * @param {Array<string>} idStrings - Array of font ID strings
   * @param {Object} options - Loading options
   * @returns {Promise} Resolves when metrics are loaded
   */
  static async loadMetrics(idStrings, options = {}) {
    BitmapText.#ensureFontLoader();
    // Redirect sizes < 8.5 to size 8.5 for all idStrings
    const redirectedIdStrings = idStrings.map(idString => {
      const redirection = BitmapText.#redirectIdStringIfNeeded(idString);
      return redirection.idString;
    });
    return BitmapText.#fontLoader.loadMetrics(redirectedIdStrings, options, BitmapText);
  }

  /**
   * Load only atlases for fonts (metrics must be loaded first)
   * @param {Array<string>} idStrings - Array of font ID strings
   * @param {Object} options - Loading options
   * @returns {Promise} Resolves when atlases are loaded
   */
  static async loadAtlases(idStrings, options = {}) {
    BitmapText.#ensureFontLoader();
    // Redirect sizes < 8.5 to size 8.5 for all idStrings
    const redirectedIdStrings = idStrings.map(idString => {
      const redirection = BitmapText.#redirectIdStringIfNeeded(idString);
      return redirection.idString;
    });
    return BitmapText.#fontLoader.loadAtlases(redirectedIdStrings, options, BitmapText);
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
   * For sizes < 8.5, checks if size 8.5 metrics exist (atlas always false for < 8.5)
   * @param {string} idString - Font ID string
   * @returns {boolean} True if both metrics and atlas are loaded
   */
  static hasFont(idString) {
    return this.hasMetrics(idString) && this.hasAtlas(idString);
  }

  /**
   * Check if metrics are loaded for a font
   * For sizes < 8.5, checks if size 8.5 metrics exist
   * @param {string} idString - Font ID string
   * @returns {boolean} True if metrics are loaded
   */
  static hasMetrics(idString) {
    // Redirect sizes < 8.5 to check for 8.5 metrics (silent to avoid log spam)
    const redirection = BitmapText.#redirectIdStringIfNeeded(idString, true);
    const fontProperties = FontProperties.fromIDString(redirection.idString);
    return FontMetricsStore.hasFontMetrics(fontProperties);
  }

  /**
   * Check if atlas is loaded for a font
   * For sizes < 8.5, always returns false (these sizes use placeholder mode)
   * @param {string} idString - Font ID string
   * @returns {boolean} True if atlas is loaded
   */
  static hasAtlas(idString) {
    const fontProperties = FontProperties.fromIDString(idString);

    // Sizes < 8.5 never have atlases (always use placeholder mode)
    if (BitmapText.#shouldUseMinSize(fontProperties.fontSize)) {
      return false;
    }

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

// TIER 6b OPTIMIZATION: Short aliases for registration methods (saves ~15 bytes per file)
BitmapText.r = BitmapText.registerMetrics;
BitmapText.a = BitmapText.registerAtlas;
