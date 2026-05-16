// BitmapTextRegistration - Cold-path methods for BitmapText
//
// Extends BitmapText with registration, loading, storage-access, and query
// methods that run once per app launch (or rarely). Concatenated AFTER
// BitmapText.js by the bundler; methods are attached directly to the
// existing BitmapText class so the public API surface is unchanged.
//
// Hot rendering code (drawTextFromAtlas, measureText, per-glyph helpers)
// stays in BitmapText.js. The config API (setFontDirectory, setCanvasFactory,
// configure) also stays there because it touches private render state
// (#coloredGlyphCanvas, #coloredGlyphCtx, #canvasFactory).
//
// Aliases (BitmapText.rBundle / .pBundle / .a) live at the bottom of this
// file because they reference registerBundle / registerPositioningBundle /
// registerAtlas, which are defined here.

// ============================================
// Internal helpers
// ============================================

/**
 * Redirect idString for sizes < 9 to size 9.
 * @param {string} idString - Original font ID string
 * @param {boolean} silent - If true, suppress console warning
 * @returns {{redirected: boolean, idString: string, originalSize: number}} Redirection result
 */
BitmapText._redirectIdStringIfNeeded = function(idString, silent = false) {
  const fontProps = FontProperties.fromIDString(idString);

  if (BitmapText._shouldUseMinSize(fontProps.fontSize)) {
    const minSizeProps = BitmapText._createFontPropsAtMinSize(fontProps);
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
};

/**
 * Convert registration parameters to ID string.
 * Used by registerAtlas to build the idString from per-asset arguments.
 * @param {number} density - Pixel density
 * @param {string} fontFamily - Font family name
 * @param {number} styleIdx - Style index (0=normal, 1=italic, 2=oblique)
 * @param {number} weightIdx - Weight index (0=normal, 1=bold, or numeric)
 * @param {number} size - Font size
 * @returns {string} ID string (e.g., "density-1-0-Arial-style-normal-weight-normal-size-19-0")
 */
BitmapText._parametersToIDString = function(density, fontFamily, styleIdx, weightIdx, size) {
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
};

// ============================================
// Registration API (called by asset files)
// ============================================

/**
 * Ensure the metrics bundle has been loaded, decoded, and registered. Use this
 * when you want to enumerate available fonts (via `FontManifest.allFontIDs()`)
 * before calling `loadFont`/`loadFonts`. Idempotent: safe to call multiple times.
 * @returns {Promise<void>}
 */
BitmapText.ensureMetricsBundleLoaded = async function() {
  BitmapText._ensureFontLoader();
  return FontLoaderBase.loadMetricsFile();
};

/**
 * Ensure the per-density positioning bundle has been loaded, decoded, and
 * registered. Idempotent and per-density. Apps that pick one density at
 * startup pay the cost once for the density they actually use.
 * @param {number} pixelDensity - Pixel density to load (1, 1.5, 2, ...)
 * @returns {Promise<void>}
 */
BitmapText.ensurePositioningBundleLoaded = async function(pixelDensity) {
  BitmapText._ensureFontLoader();
  return FontLoaderBase.loadPositioningFile(pixelDensity);
};

/**
 * Register the metrics bundle (called once by `font-assets/metrics-bundle.js`).
 *
 * Kicks off async base64 → deflate-raw → JSON decode. Stores the resulting
 * Promise on FontLoaderBase so `loadFont()` can await it.
 *
 * @param {string} b64 - Base64-encoded deflate-raw stream containing the bundle JSON.
 */
BitmapText.registerBundle = function(b64) {
  BitmapText._ensureFontLoader();
  FontLoaderBase._bundleDecodePromise = FontLoaderBase.processBundle(b64);
};

/**
 * Register a per-density positioning bundle (called once by
 * `font-assets/positioning-bundle-density-<N>.js`).
 *
 * @param {number} pixelDensity - Pixel density this bundle is for.
 * @param {string} b64 - Base64-encoded deflate-raw stream containing the bundle JSON.
 */
BitmapText.registerPositioningBundle = function(pixelDensity, b64) {
  BitmapText._ensureFontLoader();
  FontLoaderBase._positioningBundleDecodePromises.set(
    pixelDensity,
    FontLoaderBase.processPositioningBundle(pixelDensity, b64)
  );
};

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
BitmapText.registerAtlas = function(density, fontFamily, styleIdx, weightIdx, size, base64Data) {
  BitmapText._ensureFontLoader();
  const fullIDString = BitmapText._parametersToIDString(density, fontFamily, styleIdx, weightIdx, size);
  FontLoaderBase.registerAtlas(fullIDString, base64Data);
};

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
BitmapText.loadFont = async function(idString, options = {}) {
  BitmapText._ensureFontLoader();
  // Redirect sizes < 9 to size 9
  const redirection = BitmapText._redirectIdStringIfNeeded(idString);
  return BitmapText._fontLoader.loadFont(redirection.idString, options, BitmapText);
};

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
BitmapText.loadFonts = async function(idStrings, options = {}) {
  BitmapText._ensureFontLoader();
  // Redirect sizes < 9 to size 9 for all idStrings
  const redirectedIdStrings = idStrings.map(idString => {
    const redirection = BitmapText._redirectIdStringIfNeeded(idString);
    return redirection.idString;
  });
  return BitmapText._fontLoader.loadFonts(redirectedIdStrings, options, BitmapText);
};

/**
 * Load only metrics for fonts
 * @param {Array<string>} idStrings - Array of font ID strings
 * @param {Object} options - Loading options
 * @returns {Promise} Resolves when metrics are loaded
 */
BitmapText.loadMetrics = async function(idStrings, options = {}) {
  BitmapText._ensureFontLoader();
  // Redirect sizes < 9 to size 9 for all idStrings
  const redirectedIdStrings = idStrings.map(idString => {
    const redirection = BitmapText._redirectIdStringIfNeeded(idString);
    return redirection.idString;
  });
  return BitmapText._fontLoader.loadMetrics(redirectedIdStrings, options, BitmapText);
};

/**
 * Load only atlases for fonts (metrics must be loaded first)
 * @param {Array<string>} idStrings - Array of font ID strings
 * @param {Object} options - Loading options
 * @returns {Promise} Resolves when atlases are loaded
 */
BitmapText.loadAtlases = async function(idStrings, options = {}) {
  BitmapText._ensureFontLoader();
  // Redirect sizes < 9 to size 9 for all idStrings
  const redirectedIdStrings = idStrings.map(idString => {
    const redirection = BitmapText._redirectIdStringIfNeeded(idString);
    return redirection.idString;
  });
  return BitmapText._fontLoader.loadAtlases(redirectedIdStrings, options, BitmapText);
};

// ============================================
// Builder/Testing Tool API
// ============================================

/**
 * Set atlas data for a font (for builder/testing tools)
 * Public API - delegates to AtlasDataStore
 * @param {FontProperties} fontProperties - Font configuration
 * @param {AtlasData} atlasData - Atlas data to store
 */
BitmapText.setAtlasData = function(fontProperties, atlasData) {
  AtlasDataStore.setAtlasData(fontProperties, atlasData);
};

/**
 * Get atlas data for a font
 * Public API - delegates to AtlasDataStore
 * @param {FontProperties} fontProperties - Font configuration
 * @returns {AtlasData|undefined} Atlas data or undefined if not found
 */
BitmapText.getAtlasData = function(fontProperties) {
  return AtlasDataStore.getAtlasData(fontProperties);
};

/**
 * Delete atlas data for a font
 * Public API - delegates to AtlasDataStore
 * @param {FontProperties} fontProperties - Font configuration
 * @returns {boolean} True if atlas was deleted
 */
BitmapText.deleteAtlas = function(fontProperties) {
  return AtlasDataStore.deleteAtlas(fontProperties);
};

/**
 * Set font metrics for a font (for builder/testing tools)
 * Public API - delegates to FontMetricsStore
 * @param {FontProperties} fontProperties - Font configuration
 * @param {FontMetrics} fontMetrics - Font metrics to store
 */
BitmapText.setFontMetrics = function(fontProperties, fontMetrics) {
  FontMetricsStore.setFontMetrics(fontProperties, fontMetrics);
};

/**
 * Get font metrics for a font
 * Public API - delegates to FontMetricsStore
 * @param {FontProperties} fontProperties - Font configuration
 * @returns {FontMetrics|undefined} Font metrics or undefined if not found
 */
BitmapText.getFontMetrics = function(fontProperties) {
  return FontMetricsStore.getFontMetrics(fontProperties);
};

/**
 * Unload both metrics and atlas for a font
 * @param {string} idString - Font ID string
 */
BitmapText.unloadFont = function(idString) {
  const fontProperties = FontProperties.fromIDString(idString);
  FontMetricsStore.deleteFontMetrics(fontProperties);
  AtlasDataStore.deleteAtlas(fontProperties);
};

/**
 * Unload multiple fonts
 * @param {Array<string>} idStrings - Array of font ID strings
 */
BitmapText.unloadFonts = function(idStrings) {
  idStrings.forEach(id => BitmapText.unloadFont(id));
};

/**
 * Unload metrics (cascades to unload atlas)
 * @param {string} idString - Font ID string
 */
BitmapText.unloadMetrics = function(idString) {
  const fontProperties = FontProperties.fromIDString(idString);
  FontMetricsStore.deleteFontMetrics(fontProperties);
  AtlasDataStore.deleteAtlas(fontProperties); // Cascade: no metrics = no atlas
};

/**
 * Unload atlas only (keeps metrics)
 * @param {string} idString - Font ID string
 */
BitmapText.unloadAtlas = function(idString) {
  const fontProperties = FontProperties.fromIDString(idString);
  AtlasDataStore.deleteAtlas(fontProperties);
};

/**
 * Unload all fonts (both metrics and atlases)
 */
BitmapText.unloadAllFonts = function() {
  FontMetricsStore.clear();
  AtlasDataStore.clear();
};

/**
 * Unload all atlases (keep metrics)
 */
BitmapText.unloadAllAtlases = function() {
  AtlasDataStore.clear();
};

/**
 * Unload the metrics bundle: clears MetricsBundleStore records, drops the
 * cached bundle promises, and (in browser) detaches the injected <script>
 * element from `document.head`. Safe to call when the bundle was never
 * loaded.
 *
 * Note: this does NOT clear FontManifest; callers wanting a full reset can
 * call `FontManifest.clear()` separately. See `FontLoaderBase.unloadMetricsBundle`
 * for the in-flight-load race contract.
 */
BitmapText.unloadMetricsBundle = function() {
  BitmapText._ensureFontLoader();
  FontLoaderBase.unloadMetricsBundle();
};

/**
 * Unload the per-density positioning bundle: clears PositioningBundleStore
 * records + materialised AtlasPositionings for that density, drops the
 * cached per-density promises, and (in browser) detaches the injected
 * <script> element from `document.head`. Safe to call when the bundle was
 * never loaded.
 *
 * In-flight atlas loads of `pixelDensity` may complete after this call and
 * transiently re-populate the store; callers needing a clean unload should
 * first retire those loads. See `FontLoaderBase.unloadPositioningBundle`
 * for the full contract.
 *
 * @param {number} pixelDensity
 */
BitmapText.unloadPositioningBundle = function(pixelDensity) {
  BitmapText._ensureFontLoader();
  FontLoaderBase.unloadPositioningBundle(pixelDensity);
};

// ============================================
// Query API
// ============================================

/**
 * Check if font is fully loaded (both metrics and atlas)
 * For sizes < 9, checks if size 9 metrics exist (atlas always false for < 9)
 * @param {string} idString - Font ID string
 * @returns {boolean} True if both metrics and atlas are loaded
 */
BitmapText.hasFont = function(idString) {
  return BitmapText.hasMetrics(idString) && BitmapText.hasAtlas(idString);
};

/**
 * Check if metrics are loaded for a font
 * For sizes < 9, checks if size 9 metrics exist
 * @param {string} idString - Font ID string
 * @returns {boolean} True if metrics are loaded
 */
BitmapText.hasMetrics = function(idString) {
  // Redirect sizes < 9 to check for 9 metrics (silent to avoid log spam)
  const redirection = BitmapText._redirectIdStringIfNeeded(idString, true);
  const fontProperties = FontProperties.fromIDString(redirection.idString);
  return FontMetricsStore.hasFontMetrics(fontProperties);
};

/**
 * Check if atlas is loaded for a font
 * For sizes < 9, always returns false (these sizes use placeholder mode)
 * @param {string} idString - Font ID string
 * @returns {boolean} True if atlas is loaded
 */
BitmapText.hasAtlas = function(idString) {
  const fontProperties = FontProperties.fromIDString(idString);

  // Sizes < 9 never have atlases (always use placeholder mode)
  if (BitmapText._shouldUseMinSize(fontProperties.fontSize)) {
    return false;
  }

  const atlasData = AtlasDataStore.getAtlasData(fontProperties);
  return atlasData && BitmapText._isValidAtlas(atlasData);
};

/**
 * Get list of fully loaded fonts (both metrics and atlas)
 * @returns {Array<string>} Array of font ID strings
 */
BitmapText.getLoadedFonts = function() {
  const loaded = [];
  for (const key of FontMetricsStore.getAvailableFonts()) {
    const fontProperties = FontProperties.fromKey(key);
    const atlasData = AtlasDataStore.getAtlasData(fontProperties);
    if (atlasData && BitmapText._isValidAtlas(atlasData)) {
      loaded.push(fontProperties.idString);
    }
  }
  return loaded;
};

/**
 * Get list of fonts with loaded metrics
 * @returns {Array<string>} Array of font ID strings
 */
BitmapText.getLoadedMetrics = function() {
  const loaded = [];
  for (const key of FontMetricsStore.getAvailableFonts()) {
    const fontProperties = FontProperties.fromKey(key);
    loaded.push(fontProperties.idString);
  }
  return loaded;
};

/**
 * Get list of fonts with loaded atlases
 * @returns {Array<string>} Array of font ID strings
 */
BitmapText.getLoadedAtlases = function() {
  const loaded = [];
  for (const key of AtlasDataStore.getAvailableFonts()) {
    const fontProperties = FontProperties.fromKey(key);
    const atlasData = AtlasDataStore.getAtlasData(fontProperties);
    if (BitmapText._isValidAtlas(atlasData)) {
      loaded.push(fontProperties.idString);
    }
  }
  return loaded;
};

// ============================================
// Aliases (load-bearing - referenced by every checked-in asset .js file)
// ============================================
// TIER 6b OPTIMIZATION: Short aliases for registration methods (saves ~15 bytes per file)
BitmapText.rBundle = BitmapText.registerBundle;
BitmapText.pBundle = BitmapText.registerPositioningBundle;
BitmapText.a = BitmapText.registerAtlas;
