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
// - Works with BitmapText's internal stores (#fontMetrics, #atlasData)
// - Uses Template Method Pattern for platform-specific operations
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

  // ============================================
  // Configuration
  // ============================================

  /**
   * Get default canvas factory for this platform
   * @abstract Must be implemented by derived classes
   * @returns {Function} Canvas factory function
   */
  static getDefaultCanvasFactory() {
    throw new Error('FontLoaderBase.getDefaultCanvasFactory() must be implemented by derived class');
  }

  /**
   * Get default data directory for this platform
   * @abstract Must be implemented by derived classes
   * @returns {string} Data directory path
   */
  static getDefaultDataDir() {
    throw new Error('FontLoaderBase.getDefaultDataDir() must be implemented by derived class');
  }

  // ============================================
  // Registration API (called by asset files)
  // ============================================

  /**
   * Register font metrics from metrics-*.js file
   * Called by self-registering metrics files
   * @param {string} idString - Font ID string
   * @param {Object} compactedData - Compacted metrics data
   * @param {Object} bitmapTextClass - BitmapText class reference (for backward compatibility)
   */
  static registerMetrics(idString, compactedData, bitmapTextClass) {
    if (typeof idString !== 'string') {
      console.warn('FontLoader.registerMetrics: Invalid idString - must be string');
      return;
    }

    if (typeof MetricsExpander === 'undefined') {
      console.warn('FontLoader.registerMetrics: MetricsExpander not available');
      return;
    }

    if (typeof FontProperties === 'undefined') {
      console.warn('FontLoader.registerMetrics: FontProperties not available');
      return;
    }

    const fontProperties = FontProperties.fromIDString(idString);
    const fontMetrics = MetricsExpander.expand(compactedData);

    // Store metrics directly in FontMetricsStore
    FontMetricsStore.setFontMetrics(fontProperties, fontMetrics);

    // Process any pending atlases that were waiting for these metrics
    FontLoaderBase._processPendingAtlas(idString);
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
   * Load metrics file for a font
   * @abstract Must be implemented by derived classes
   * @param {string} idString - Font ID string
   * @param {Object} bitmapTextClass - BitmapText class reference
   * @returns {Promise} Resolves when metrics are loaded
   */
  static async loadMetricsFile(idString, bitmapTextClass) {
    throw new Error('FontLoaderBase.loadMetricsFile() must be implemented by derived class');
  }

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
  // Shared Atlas Reconstruction Logic
  // ============================================

  /**
   * Load atlas from package (image + metrics) and reconstruct positioning
   * @param {string} idString - Font ID string
   * @param {HTMLImageElement|HTMLCanvasElement} atlasImage - Atlas source image
   * @param {Object} bitmapTextClass - BitmapText class reference
   * @returns {boolean} True if atlas was reconstructed, false if pending metrics
   */
  static _loadAtlasFromPackage(idString, atlasImage, bitmapTextClass) {
    const fontProperties = FontProperties.fromIDString(idString);

    // Clean up temporary package storage
    delete FontLoaderBase._tempAtlasPackages[idString];

    // Get font metrics (required for reconstruction)
    const fontMetrics = FontMetricsStore.getFontMetrics(fontProperties);

    if (!fontMetrics) {
      // Store atlas for later reconstruction when metrics become available
      FontLoaderBase._pendingAtlases.set(idString, {atlasImage, bitmapTextClass});
      return false;
    }

    // Check if TightAtlasReconstructor is available
    if (typeof TightAtlasReconstructor === 'undefined') {
      throw new Error(`FontLoader: TightAtlasReconstructor required for font loading - not available for ${idString}`);
    }

    // Get canvas factory from BitmapText
    const canvasFactory = bitmapTextClass.getCanvasFactory();

    // Reconstruct tight atlas + positioning from Atlas image
    const { atlasImage: tightAtlasImage, atlasPositioning } =
      TightAtlasReconstructor.reconstructFromAtlas(fontMetrics, atlasImage, canvasFactory);

    // Create AtlasData instance
    const atlasData = new AtlasData(tightAtlasImage, atlasPositioning);

    // Store directly in AtlasDataStore
    AtlasDataStore.setAtlasData(fontProperties, atlasData);

    return true;
  }

  /**
   * Process pending atlas that was waiting for metrics
   * @param {string} idString - Font ID string
   */
  static _processPendingAtlas(idString) {
    // Check if there's a pending atlas waiting for these metrics
    if (!FontLoaderBase._pendingAtlases.has(idString)) {
      return;
    }

    const {atlasImage, bitmapTextClass} = FontLoaderBase._pendingAtlases.get(idString);
    FontLoaderBase._pendingAtlases.delete(idString);

    // Try to load the atlas now that metrics are available
    FontLoaderBase._loadAtlasFromPackage(idString, atlasImage, bitmapTextClass);
  }
}
