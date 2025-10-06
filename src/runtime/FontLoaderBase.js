// FontLoaderBase - Abstract Base Class for Font Loading
//
// This is an ABSTRACT BASE CLASS that provides shared functionality for
// loading bitmap fonts across different JavaScript environments.
//
// ARCHITECTURE:
// - Template Method Pattern: loadFont() orchestrates the loading process
// - Abstract Methods: Subclasses must implement environment-specific methods
// - Shared Logic: Common functionality lives here to avoid duplication
//
// SUBCLASSES:
// - FontLoader (browser): src/platform/FontLoader-browser.js
// - FontLoader (Node.js): src/platform/FontLoader-node.js
//
// EXTENSION POINTS:
// - getDefaultCanvasFactory(): Returns environment-specific canvas factory
// - loadMetrics(IDString): Environment-specific metrics loading
// - loadAtlas(IDString, isFileProtocol): Environment-specific atlas loading
//
// SHARED FUNCTIONALITY:
// - Static _tempAtlasPackages storage
// - registerAtlasPackage() for JS file registration
// - loadAtlasFromPackage() for atlas reconstruction
// - Progress tracking (incrementProgress, isComplete)
// - loadFont() / loadFonts() orchestration

class FontLoaderBase {
  // Static storage for atlas packages (base64 only) from JS files
  // No positioning data - will be reconstructed at runtime
  // Shared across all instances and subclasses
  static _tempAtlasPackages = {};

  // ============================================================================
  // STATIC CONSTANTS - Font Asset Naming Conventions
  // ============================================================================

  static METRICS_PREFIX = 'metrics-';
  static ATLAS_PREFIX = 'atlas-';
  static PNG_EXTENSION = '.png';
  static QOI_EXTENSION = '.qoi';
  static JS_EXTENSION = '.js';

  // ============================================================================
  // STATIC MESSAGES - Error and Warning Templates
  // ============================================================================

  static messages = {
    metricsNotFound: (IDString) => `Metrics JS not found: metrics-${IDString}.js - font will not be available`,
    pngImageNotFound: (IDString) => `Atlas image not found: atlas-${IDString}.png - will use placeholder rectangles`,
    jsImageNotFound: (IDString, format) => `Atlas JS not found: atlas-${IDString}-${format}.js - will use placeholder rectangles`,
    imageDataMissing: (IDString) => `Image data not found in JS file for ${IDString} - will use placeholder rectangles`,
    base64DecodeFailed: (IDString) => `Failed to decode base64 image data for ${IDString} - will use placeholder rectangles`
  };

  constructor(atlasDataStore, fontMetricsStore, onProgress = null, canvasFactory = null, dataDir = null) {
    this.atlasDataStore = atlasDataStore;
    this.fontMetricsStore = fontMetricsStore;
    this.onProgress = onProgress;
    this.loadedCount = 0;
    this.totalCount = 0;
    // Canvas factory for TightAtlasReconstructor
    // Use provided factory or get default from subclass
    this.canvasFactory = canvasFactory || this.getDefaultCanvasFactory();
    // Data directory for font assets
    // Use provided directory or get default from subclass
    this.dataDir = dataDir !== null ? dataDir : this.getDefaultDataDir();
  }

  // ============================================================================
  // ABSTRACT METHODS - Must be implemented by subclasses
  // ============================================================================

  /**
   * Get the default canvas factory for this environment
   * @returns {Function} Factory function that creates canvas elements
   * @abstract
   */
  getDefaultCanvasFactory() {
    throw new Error('[FontLoaderBase] getDefaultCanvasFactory() must be implemented by subclass');
  }

  /**
   * Get the default data directory for font assets in this environment
   * @returns {string} Default path to font assets directory
   * @abstract
   */
  getDefaultDataDir() {
    throw new Error('[FontLoaderBase] getDefaultDataDir() must be implemented by subclass');
  }

  /**
   * Load metrics file for a font
   * @param {string} IDString - Font ID string
   * @returns {Promise} Promise that resolves when metrics are loaded
   * @abstract
   */
  loadMetrics(IDString) {
    throw new Error('[FontLoaderBase] loadMetrics() must be implemented by subclass');
  }

  /**
   * Load atlas file for a font
   * @param {string} IDString - Font ID string
   * @param {boolean} isFileProtocol - Whether using file:// protocol
   * @returns {Promise} Promise that resolves when atlas is loaded
   * @abstract
   */
  loadAtlas(IDString, isFileProtocol) {
    throw new Error('[FontLoaderBase] loadAtlas() must be implemented by subclass');
  }

  // ============================================================================
  // SHARED STATIC METHODS
  // ============================================================================

  /**
   * Static method for atlas JS files to register packages
   * Only takes base64 data (NO positioning data)
   * @param {string} IDString - Font ID string
   * @param {string} base64Data - Base64-encoded atlas data
   */
  static registerAtlasPackage(IDString, base64Data) {
    if (typeof IDString !== 'string' || typeof base64Data !== 'string') {
      console.warn('FontLoader.registerAtlasPackage: Invalid arguments - IDString and base64Data must be strings');
      return;
    }

    FontLoaderBase._tempAtlasPackages[IDString] = {
      base64Data: base64Data
    };
  }

  // ============================================================================
  // SHARED INSTANCE METHODS - Path Building
  // ============================================================================

  /**
   * Build path to metrics JS file
   * @param {string} IDString - Font ID string
   * @returns {string} Full path to metrics file
   */
  getMetricsPath(IDString) {
    return `${this.dataDir}${FontLoaderBase.METRICS_PREFIX}${IDString}${FontLoaderBase.JS_EXTENSION}`;
  }

  /**
   * Build path to atlas PNG file
   * @param {string} IDString - Font ID string
   * @returns {string} Full path to atlas PNG file
   */
  getAtlasPngPath(IDString) {
    return `${this.dataDir}${FontLoaderBase.ATLAS_PREFIX}${IDString}${FontLoaderBase.PNG_EXTENSION}`;
  }

  /**
   * Build path to atlas QOI file
   * @param {string} IDString - Font ID string
   * @returns {string} Full path to atlas QOI file
   */
  getAtlasQoiPath(IDString) {
    return `${this.dataDir}${FontLoaderBase.ATLAS_PREFIX}${IDString}${FontLoaderBase.QOI_EXTENSION}`;
  }

  /**
   * Build path to atlas JS file (contains base64-encoded atlas data)
   * @param {string} IDString - Font ID string
   * @param {string} format - Image format ('png' or 'qoi')
   * @returns {string} Full path to atlas JS file
   */
  getAtlasJsPath(IDString, format) {
    return `${this.dataDir}${FontLoaderBase.ATLAS_PREFIX}${IDString}-${format}${FontLoaderBase.JS_EXTENSION}`;
  }

  // ============================================================================
  // SHARED INSTANCE METHODS - Atlas Loading
  // ============================================================================

  /**
   * Loads AtlasData from Atlas image and stores in AtlasDataStore
   * Uses TightAtlasReconstructor to convert Atlas → Tight Atlas + positioning
   * @param {string} IDString - Font ID string
   * @param {Image|Canvas} atlasImage - Loaded Atlas image (variable-width cells format)
   * @returns {boolean} - True if successful, false if metrics not available
   */
  loadAtlasFromPackage(IDString, atlasImage) {
    const fontProperties = FontProperties.fromIDString(IDString);

    // Clean up temporary package storage
    delete FontLoaderBase._tempAtlasPackages[IDString];

    // Reconstruct tight atlas from Atlas image using TightAtlasReconstructor
    // This requires FontMetrics to be loaded first (for cell dimensions)
    const fontMetrics = this.fontMetricsStore.getFontMetrics(fontProperties);

    if (!fontMetrics) {
      console.warn(`FontLoader: Metrics not loaded for ${IDString} - cannot reconstruct tight atlas`);
      console.warn('Make sure metrics are loaded before atlases');
      return false;
    }

    // Check if TightAtlasReconstructor is available
    if (typeof TightAtlasReconstructor === 'undefined') {
      throw new Error(`[FontLoader] TightAtlasReconstructor required for font loading - not available for ${IDString}`);
    }

    // Reconstruct tight atlas + positioning from Atlas image
    const { atlasImage: tightAtlasImage, atlasPositioning } =
      TightAtlasReconstructor.reconstructFromAtlas(fontMetrics, atlasImage, this.canvasFactory);

    // Create AtlasData instance
    const atlasData = new AtlasData(tightAtlasImage, atlasPositioning);

    // Store in atlas data store
    this.atlasDataStore.setAtlasData(fontProperties, atlasData);

    return true;
  }

  /**
   * Load font data for a single ID string
   * Template Method: Orchestrates metrics and atlas loading via abstract methods
   * @param {string} IDString - Font ID string
   * @param {boolean} isFileProtocol - Whether using file:// protocol
   * @returns {Promise} Promise that resolves when font is loaded
   */
  loadFont(IDString, isFileProtocol = false) {
    this.totalCount += 2; // Each font has 2 files (metrics + image)

    return this.loadMetrics(IDString)
      .then(() => this.loadAtlas(IDString, isFileProtocol))
      .catch(error => {
        // Even if loading fails, we still count it as processed to prevent hanging
        console.warn(`Font loading failed for ${IDString}:`, error.message);
      });
  }

  /**
   * Load multiple fonts from an array of ID strings
   * @param {Array<string>} IDStrings - Array of font ID strings
   * @param {boolean} isFileProtocol - Whether using file:// protocol
   * @returns {Promise} Promise that resolves when all fonts are loaded
   */
  loadFonts(IDStrings, isFileProtocol = false) {
    this.totalCount = IDStrings.length * 2;
    this.loadedCount = 0;

    const promises = IDStrings.map(IDString => this.loadFont(IDString, isFileProtocol));

    return Promise.all(promises);
  }

  /**
   * Increment progress counter and call callback
   */
  incrementProgress() {
    this.loadedCount++;
    if (this.onProgress) {
      this.onProgress(this.loadedCount, this.totalCount);
    }
  }

  /**
   * Check if loading is complete
   * @returns {boolean} True if all fonts have been loaded
   */
  isComplete() {
    return this.loadedCount >= this.totalCount;
  }
}
