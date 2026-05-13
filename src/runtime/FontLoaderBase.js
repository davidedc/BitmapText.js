// FontLoaderBase - Abstract Static Base Class for Font Loading
//
// This abstract static class provides the core font loading infrastructure
// for BitmapText. It defines the public API and shared logic for font loading,
// while platform-specific implementations (browser, Node.js) extend this class.
//
// DISTRIBUTION ROLE:
// - Used by both browser and Node.js distributions
// - Defines abstract methods implemented by platform-specific loaders
// - Contains shared loading orchestration and atlas reconstruction logic
//
// ARCHITECTURE:
// - Abstract static class (not instantiated)
// - Extended by FontLoaderBrowser and FontLoaderNode
// - Owns fontDirectory configuration (#fontDirectory private field)
// - Works with BitmapText's internal stores (#fontMetrics, #atlasData)
// - Uses Template Method Pattern for platform-specific operations
// - BitmapText delegates fontDirectory get/set to FontLoader (this class owns what it uses)
//
// LOADING FLOW:
// 1. loadFonts() orchestrates loading of multiple fonts
// 2. loadMetricsFile() loads metrics (platform-specific)
// 3. loadAtlasFile() loads atlas image (platform-specific)
// 4. loadAtlasFromPackage() reconstructs atlas from image (shared)
// 5. processPendingAtlas() handles async atlas/metrics loading (shared)

class FontLoaderBase {
  // ============================================
  // Shared Static Storage
  // ============================================

  // Temporary storage for atlas packages before reconstruction
  static _tempAtlasPackages = {};

  // Pending atlases waiting for metrics
  static _pendingAtlases = new Map();

  // Loading promises to prevent duplicate loads
  static _loadingPromises = new Map();

  // Singleton: resolves when the metrics bundle is fully loaded, decoded, and
  // every record is registered into MetricsBundleStore. Materialisation of
  // density-specific FontMetrics happens lazily on first FontMetricsStore lookup.
  static _bundleReadyPromise = null;

  // Internal: set by `BitmapText.registerBundle` when the bundle script executes.
  // The platform-specific `loadBundleFile` awaits this after `script.onload` /
  // `eval()` returns.
  static _bundleDecodePromise = null;

  // Per-density singletons: resolves when the positioning bundle for a given
  // density is fully loaded, decoded, and every record is registered into
  // PositioningBundleStore. Materialisation of AtlasPositioning happens lazily
  // on first PositioningBundleStore.getPositioning lookup.
  static _positioningBundleReadyPromises = new Map(); // density → Promise

  // Internal: set by `BitmapText.registerPositioningBundle` when the bundle
  // script executes. The platform-specific `loadPositioningBundleFile` awaits
  // this after `script.onload` / `eval()` returns.
  static _positioningBundleDecodePromises = new Map(); // density → Promise

  // Browser-only: references to the <script> elements injected by the platform
  // loader. The browser override populates these in loadBundleFile and
  // loadPositioningBundleFile; the unload* methods read them via the
  // _removeMetricsScriptElement / _removePositioningScriptElement hooks below
  // and detach them from document.head. Node leaves these untouched — its
  // `eval`-based loader has no DOM to clean.
  static _metricsScriptElement = null;             // HTMLScriptElement | null
  static _positioningScriptElements = new Map();   // density → HTMLScriptElement

  // ============================================
  // Configuration
  // ============================================

  /**
   * Default font directory for all platforms
   * @constant {string}
   */
  static DEFAULT_FONT_DIRECTORY = './font-assets/';

  /**
   * User-configured font directory override (null = use default)
   * @private
   */
  static #fontDirectory = null;

  /**
   * Set font directory (overrides default)
   * @param {string} path - Path to font assets directory
   */
  static setFontDirectory(path) {
    FontLoaderBase.#fontDirectory = path;
  }

  /**
   * Get font directory (returns override or default)
   * @returns {string} Font directory path
   */
  static getFontDirectory() {
    return FontLoaderBase.#fontDirectory ?? FontLoaderBase.DEFAULT_FONT_DIRECTORY;
  }

  /**
   * Get default font directory (shared across all platforms)
   * @deprecated Use getFontDirectory() instead
   * @returns {string} Font directory path
   */
  static getDefaultFontDirectory() {
    return FontLoaderBase.DEFAULT_FONT_DIRECTORY;
  }

  // ============================================
  // Registration API (called by asset files)
  // ============================================

  /**
   * Decode the metrics bundle and register every record into MetricsBundleStore.
   * Called by `BitmapText.registerBundle` (which is called by the bundle JS file).
   *
   * Bundle envelope: `{ formatVersion, records: [...] }` where formatVersion
   * matches `BitmapText.BUNDLE_SCHEMA_VERSION`. The runtime refuses to load
   * mismatched-version assets — stale bundles must be regenerated, not papered over.
   *
   * @param {string} b64 - Base64-encoded deflate-raw stream of the bundle JSON.
   * @returns {Promise<void>} Resolves once every record is registered.
   */
  static async processBundle(b64) {
    if (typeof BundleCodec === 'undefined') {
      throw new Error('FontLoader.processBundle: BundleCodec not available');
    }
    if (typeof MetricsBundleStore === 'undefined') {
      throw new Error('FontLoader.processBundle: MetricsBundleStore not available');
    }

    const envelope = await BundleCodec.decodeBundle(b64);
    if (!envelope || envelope.formatVersion !== BitmapText.BUNDLE_SCHEMA_VERSION) {
      throw new Error(
        `FontLoader.processBundle: metrics-bundle.js formatVersion mismatch ` +
        `(got ${envelope && envelope.formatVersion}, expected ${BitmapText.BUNDLE_SCHEMA_VERSION}). ` +
        `Regenerate font-assets/ with the current build.`
      );
    }
    const records = envelope.records;

    const styleByIdx = ['normal', 'italic', 'oblique'];
    const ids = [];
    for (const [fontFamily, styleIdx, weightIdx, fontSize, minified] of records) {
      const fontStyle = styleByIdx[styleIdx];
      const fontWeight = weightIdx === 0 ? 'normal' : (weightIdx === 1 ? 'bold' : String(weightIdx));
      MetricsBundleStore.setRecord(fontFamily, fontStyle, fontWeight, fontSize, minified);

      if (typeof FontManifest !== 'undefined') {
        // The bundle is density-agnostic. Register both density-1 and density-2
        // idStrings so consumers that enumerate via FontManifest see what's available.
        const sizeStr = Number.isInteger(fontSize) ? `${fontSize}-0` : String(fontSize).replace('.', '-');
        ids.push(`density-1-0-${fontFamily}-style-${fontStyle}-weight-${fontWeight}-size-${sizeStr}`);
        ids.push(`density-2-0-${fontFamily}-style-${fontStyle}-weight-${fontWeight}-size-${sizeStr}`);
      }
    }
    if (typeof FontManifest !== 'undefined' && ids.length) {
      FontManifest.addFontIDs(ids);
    }
  }

  /**
   * Decode a per-density positioning bundle and register every record into
   * PositioningBundleStore. Called by `BitmapText.registerPositioningBundle`
   * (which is called by `positioning-bundle-density-<N>.js`).
   *
   * Bundle envelope: `{ formatVersion, density: <N>, records: [...] }`.
   *
   * @param {number} density - Pixel density this bundle is for (1, 1.5, 2, ...).
   * @param {string} b64 - Base64-encoded deflate-raw stream of the bundle JSON.
   * @returns {Promise<void>} Resolves once every record is registered.
   */
  static async processPositioningBundle(density, b64) {
    if (typeof BundleCodec === 'undefined') {
      throw new Error('FontLoader.processPositioningBundle: BundleCodec not available');
    }
    if (typeof PositioningBundleStore === 'undefined') {
      throw new Error('FontLoader.processPositioningBundle: PositioningBundleStore not available');
    }

    const envelope = await BundleCodec.decodeBundle(b64);
    if (!envelope || envelope.formatVersion !== BitmapText.BUNDLE_SCHEMA_VERSION) {
      throw new Error(
        `FontLoader.processPositioningBundle: positioning-bundle-density-${density}.js formatVersion mismatch ` +
        `(got ${envelope && envelope.formatVersion}, expected ${BitmapText.BUNDLE_SCHEMA_VERSION}). ` +
        `Regenerate font-assets/ with the current build.`
      );
    }
    if (envelope.density !== density) {
      throw new Error(
        `FontLoader.processPositioningBundle: density mismatch ` +
        `(envelope says ${envelope.density}, expected ${density})`
      );
    }
    const records = envelope.records;

    const styleByIdx = ['normal', 'italic', 'oblique'];
    for (const [fontFamily, styleIdx, weightIdx, fontSize, arrays] of records) {
      const fontStyle = styleByIdx[styleIdx];
      const fontWeight = weightIdx === 0 ? 'normal' : (weightIdx === 1 ? 'bold' : String(weightIdx));
      PositioningBundleStore.setRecord(density, fontFamily, fontStyle, fontWeight, fontSize, arrays);
    }
  }

  /**
   * Register atlas from atlas-*.js file (base64 only, positioning reconstructed later)
   * Called by self-registering atlas files
   * @param {string} idString - Font ID string
   * @param {string} base64Data - Base64-encoded atlas data
   */
  static registerAtlas(idString, base64Data) {
    if (typeof idString !== 'string' || typeof base64Data !== 'string') {
      console.warn('FontLoader.registerAtlas: Invalid arguments - idString and base64Data must be strings');
      return;
    }

    FontLoaderBase._tempAtlasPackages[idString] = { base64Data };
  }

  // ============================================
  // Public Loading API
  // ============================================

  /**
   * Load a single font
   * @param {string} idString - Font ID string
   * @param {Object} options - Loading options
   * @param {Function} [options.onProgress] - Progress callback (loaded, total)
   * @param {boolean} [options.isFileProtocol] - Whether using file:// protocol
   * @param {Object} bitmapTextClass - BitmapText class reference
   * @returns {Promise} Resolves when font is loaded
   */
  static async loadFont(idString, options, bitmapTextClass) {
    return this.loadFonts([idString], options, bitmapTextClass);
  }

  /**
   * Load multiple fonts
   * @param {Array<string>} idStrings - Array of font ID strings
   * @param {Object} options - Loading options
   * @param {Function} [options.onProgress] - Progress callback (loaded, total)
   * @param {boolean} [options.isFileProtocol] - Whether using file:// protocol
   * @param {boolean} [options.loadMetrics] - Load metrics (default: true)
   * @param {boolean} [options.loadAtlases] - Load atlases (default: true)
   * @param {Object} bitmapTextClass - BitmapText class reference
   * @returns {Promise} Resolves when all fonts are loaded
   */
  static async loadFonts(idStrings, options = {}, bitmapTextClass) {
    const {
      onProgress = null,
      isFileProtocol = false,
      loadMetrics = true,
      loadAtlases = true
    } = options;

    const filesPerFont = (loadMetrics ? 1 : 0) + (loadAtlases ? 1 : 0);
    const totalFiles = idStrings.length * filesPerFont;
    let loadedFiles = 0;

    const reportProgress = () => {
      if (onProgress) onProgress(loadedFiles, totalFiles);
    };

    for (const idString of idStrings) {
      // Check if already loading
      if (FontLoaderBase._loadingPromises.has(idString)) {
        await FontLoaderBase._loadingPromises.get(idString);
        continue;
      }

      const loadPromise = (async () => {
        try {
          if (loadMetrics) {
            await this.loadMetricsFile(idString, bitmapTextClass);
            loadedFiles++;
            reportProgress();
          }

          if (loadAtlases) {
            await this.loadAtlasFile(idString, isFileProtocol, bitmapTextClass);
            loadedFiles++;
            reportProgress();
          }
        } finally {
          FontLoaderBase._loadingPromises.delete(idString);
        }
      })();

      FontLoaderBase._loadingPromises.set(idString, loadPromise);
      await loadPromise;
    }
  }

  /**
   * Load only metrics for fonts
   * @param {Array<string>} idStrings - Array of font ID strings
   * @param {Object} options - Loading options
   * @param {Object} bitmapTextClass - BitmapText class reference
   * @returns {Promise} Resolves when metrics are loaded
   */
  static async loadMetrics(idStrings, options, bitmapTextClass) {
    return this.loadFonts(idStrings, { ...options, loadAtlases: false }, bitmapTextClass);
  }

  /**
   * Load only atlases for fonts (metrics must be loaded first)
   * @param {Array<string>} idStrings - Array of font ID strings
   * @param {Object} options - Loading options
   * @param {Object} bitmapTextClass - BitmapText class reference
   * @returns {Promise} Resolves when atlases are loaded
   */
  static async loadAtlases(idStrings, options, bitmapTextClass) {
    return this.loadFonts(idStrings, { ...options, loadMetrics: false }, bitmapTextClass);
  }

  // ============================================
  // Platform-Specific Loading (Abstract Methods)
  // ============================================

  /**
   * Ensure the metrics bundle is loaded (idempotent singleton).
   * The first call triggers the platform's `loadBundleFile`; subsequent calls
   * return the same Promise.
   * @returns {Promise<void>} Resolves once every record is in MetricsBundleStore.
   */
  static async loadMetricsFile(/* idString, bitmapTextClass */) {
    if (!FontLoaderBase._bundleReadyPromise) {
      FontLoaderBase._bundleReadyPromise = FontLoader.loadBundleFile();
    }
    return FontLoaderBase._bundleReadyPromise;
  }

  /**
   * Ensure the positioning bundle for `pixelDensity` is loaded (idempotent
   * singleton, per density). The first call for a density triggers the
   * platform's `loadPositioningBundleFile`; subsequent calls return the
   * same Promise.
   * @param {number} pixelDensity
   * @returns {Promise<void>} Resolves once every record is in PositioningBundleStore.
   */
  static async loadPositioningFile(pixelDensity) {
    if (!FontLoaderBase._positioningBundleReadyPromises.has(pixelDensity)) {
      FontLoaderBase._positioningBundleReadyPromises.set(
        pixelDensity,
        FontLoader.loadPositioningBundleFile(pixelDensity)
      );
    }
    return FontLoaderBase._positioningBundleReadyPromises.get(pixelDensity);
  }

  // ============================================
  // Bundle Unload API
  // ============================================
  //
  // Mirrors the load pairs above. Each unload:
  //   1. Wipes the data store entries (records + materialised caches).
  //   2. Drops the cached ready/decode promises so a subsequent load re-fetches.
  //   3. Calls the platform cleanup hook to detach the injected <script>
  //      element (browser; no-op on Node).
  //
  // Idempotency: safe to call multiple times. Calling on a never-loaded bundle
  // is a no-op (clear/delete on absent keys are no-ops; the cleanup hook
  // tolerates a null/missing element).
  //
  // In-flight load race: if an atlas load is in flight at the moment of
  // unloadPositioningBundle, its inner `loadPositioningFile(density)` may
  // have already captured the promise from `_positioningBundleReadyPromises`
  // BEFORE this method deletes that entry. The load will then complete and
  // re-populate `PositioningBundleStore` with that density's records — a
  // benign transient (the atlas still finishes loading correctly), but the
  // bundle records reappear in the store. Callers that want a fully-clean
  // unload should either (a) only call this after all in-flight loads of
  // that density resolve, or (b) accept the transient and call unload again
  // if needed. See public/lru-atlas-loading-demo-bundled.html for an example
  // of strategy (a): the demo retires LRU entries of a density before
  // calling unloadPositioningBundle for it.

  /**
   * Unload the metrics bundle: clear MetricsBundleStore records, drop the
   * bundle ready/decode promises, and detach the <script> element (browser).
   *
   * FontManifest entries are NOT cleared — the manifest is a registry of
   * known idStrings whose lifetime is decoupled from the records here.
   * Clearing it would break enumerators that already cached its content;
   * callers wanting a manifest reset can call `FontManifest.clear()`.
   */
  static unloadMetricsBundle() {
    if (typeof MetricsBundleStore !== 'undefined') {
      MetricsBundleStore.clear();
    }
    FontLoaderBase._bundleReadyPromise = null;
    FontLoaderBase._bundleDecodePromise = null;
    FontLoader._removeMetricsScriptElement();
  }

  /**
   * Unload the per-density positioning bundle: clear PositioningBundleStore
   * records for that density, drop the per-density ready/decode promises,
   * and detach the <script> element (browser).
   * @param {number} pixelDensity
   */
  static unloadPositioningBundle(pixelDensity) {
    if (typeof PositioningBundleStore !== 'undefined') {
      PositioningBundleStore.clearDensity(pixelDensity);
    }
    FontLoaderBase._positioningBundleReadyPromises.delete(pixelDensity);
    FontLoaderBase._positioningBundleDecodePromises.delete(pixelDensity);
    FontLoader._removePositioningScriptElement(pixelDensity);
  }

  // Platform cleanup hooks. Base impls are no-ops so Node inherits the right
  // behaviour for free (its eval-based loader has no DOM to clean). The
  // browser FontLoader overrides these to detach the <script> from
  // document.head.
  static _removeMetricsScriptElement() { /* no-op base impl */ }
  static _removePositioningScriptElement(/* pixelDensity */) { /* no-op base impl */ }

  /**
   * Load atlas file for a font
   * @abstract Must be implemented by derived classes
   * @param {string} idString - Font ID string
   * @param {boolean} isFileProtocol - Whether using file:// protocol
   * @param {Object} bitmapTextClass - BitmapText class reference
   * @returns {Promise} Resolves when atlas is loaded
   */
  static async loadAtlasFile(idString, isFileProtocol, bitmapTextClass) {
    throw new Error('FontLoaderBase.loadAtlasFile() must be implemented by derived class');
  }

  // ============================================
  // Shared Atlas Loading Logic
  // ============================================

  /**
   * Load atlas from package: wrap the image, look up the pre-shipped positioning
   * for this font from PositioningBundleStore, store as AtlasData. The positioning
   * bundle for this density is awaited inline (idempotent singleton — first call
   * fetches, subsequent calls reuse the same Promise). No canvas readback, no
   * pixel scan.
   *
   * @param {string} idString - Font ID string
   * @param {HTMLImageElement|HTMLCanvasElement} atlasImage - Already-tight atlas
   * @param {Object} bitmapTextClass - BitmapText class reference (unused; kept for API parity)
   * @returns {Promise<boolean>} True on success, false if metrics not yet loaded
   */
  static async _loadAtlasFromPackage(idString, atlasImage, bitmapTextClass) {
    const fontProperties = FontProperties.fromIDString(idString);

    // Clean up temporary package storage
    delete FontLoaderBase._tempAtlasPackages[idString];

    // Get font metrics (still required for the character set; the bundle records
    // are positional arrays in sorted-character order).
    const fontMetrics = FontMetricsStore.getFontMetrics(fontProperties);

    if (!fontMetrics) {
      // Store atlas for later when metrics become available.
      FontLoaderBase._pendingAtlases.set(idString, { atlasImage, bitmapTextClass });
      return false;
    }

    // Idempotent per density: first call kicks off the bundle fetch + decode;
    // subsequent calls reuse the cached Promise.
    await FontLoaderBase.loadPositioningFile(fontProperties.pixelDensity);

    const atlasPositioning = PositioningBundleStore.getPositioning(fontProperties, fontMetrics);
    if (!atlasPositioning) {
      throw new Error(
        `FontLoader: no positioning record for ${idString} ` +
        `(density ${fontProperties.pixelDensity}) — positioning bundle missing this font?`
      );
    }

    const wrappedAtlasImage = new AtlasImage(atlasImage);
    const atlasData = new AtlasData(wrappedAtlasImage, atlasPositioning);

    AtlasDataStore.setAtlasData(fontProperties, atlasData);

    return true;
  }

  /**
   * Process pending atlas that was waiting for metrics. Async; mirrors
   * _loadAtlasFromPackage's signature.
   * @param {string} idString - Font ID string
   * @returns {Promise<void>}
   */
  static async _processPendingAtlas(idString) {
    // Check if there's a pending atlas waiting for these metrics
    if (!FontLoaderBase._pendingAtlases.has(idString)) {
      return;
    }

    const { atlasImage, bitmapTextClass } = FontLoaderBase._pendingAtlases.get(idString);
    FontLoaderBase._pendingAtlases.delete(idString);

    // Try to load the atlas now that metrics are available
    await FontLoaderBase._loadAtlasFromPackage(idString, atlasImage, bitmapTextClass);
  }
}
