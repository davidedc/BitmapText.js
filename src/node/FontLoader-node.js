// FontLoader - Node.js Implementation
//
// This is a Node.js-compatible implementation of FontLoader that provides
// the SAME PUBLIC API as the browser version (src/core/FontLoader.js).
//
// ENVIRONMENT-SPECIFIC IMPLEMENTATION:
// - Browser: Promise-based, async, DOM script tags, Image elements
// - Node.js: Synchronous, fs module, eval, Buffer, no DOM
//
// SHARED PUBLIC API:
// - Constructor: new FontLoader(atlasDataStore, fontMetricsStore, onProgress?, canvasFactory?)
// - Static: FontLoader.registerAtlasPackage(IDString, base64Data)
// - Instance: loadAtlasFromPackage(IDString, atlasImage)
// - Instance: loadFont(IDString, isFileProtocol?)
// - Instance: loadFonts(IDStrings, isFileProtocol?)
// - Instance: isComplete()
//
// ARCHITECTURE:
// - Extends FontLoaderBase for shared functionality
// - Implements Node.js-specific loading (fs module, synchronous eval)
// - Synchronous implementation (no Promises for simplicity)
// - Static storage for temporary atlas packages from JS files (shared between instances)

// Node.js modules
// Check if fs is already available (for bundle context) before requiring
if (typeof fs === 'undefined') {
  var fs = require('fs');
}

// FontLoader class for Node.js environment
class FontLoader extends FontLoaderBase {
  // ============================================================================
  // ENVIRONMENT-SPECIFIC IMPLEMENTATIONS (Abstract method overrides)
  // ============================================================================

  /**
   * Get default canvas factory for Node.js environment
   * @returns {Function} Factory that creates Canvas instances (from canvas-mock)
   */
  getDefaultCanvasFactory() {
    return () => new Canvas(0, 0);
  }

  /**
   * Get default data directory for Node.js environment
   * @returns {string} Default path to font assets (relative to project root)
   */
  getDefaultDataDir() {
    return 'font-assets/';
  }

  /**
   * Load metrics JS file (Node.js implementation - synchronous)
   * @param {string} IDString - Font ID string
   * @returns {Promise} Promise that resolves when metrics are loaded (synchronous execution)
   */
  loadMetrics(IDString) {
    return new Promise((resolve, reject) => {
      try {
        const metricsPath = this.getMetricsPath(IDString);

        if (!fs.existsSync(metricsPath)) {
          console.warn(`Metrics file not found: ${metricsPath}`);
          this.incrementProgress(); // Missing metrics
          this.incrementProgress(); // Missing image (won't be loaded)
          reject(new Error(`Metrics not found for ${IDString}`));
          return;
        }

        // Execute the JS file (which populates FontMetricsStore)
        // The metrics file expects global fontMetricsStore, FontProperties, and MetricsExpander
        // Make them available temporarily for the eval
        const jsCode = fs.readFileSync(metricsPath, 'utf8');
        const fontMetricsStore = this.fontMetricsStore;  // Local ref for eval scope
        eval(jsCode);

        this.incrementProgress();
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Load atlas based on protocol (Node.js implementation)
   * @param {string} IDString - Font ID string
   * @param {boolean} isFileProtocol - Whether using file:// protocol (ignored in Node.js)
   * @returns {Promise} Promise that resolves when atlas is loaded
   */
  loadAtlas(IDString, isFileProtocol) {
    // In Node.js, we always load from JS files (isFileProtocol is ignored)
    // This parameter is kept for API compatibility with browser version
    return this.loadAtlasFromJS(IDString);
  }

  // ============================================================================
  // NODE.JS-SPECIFIC HELPER METHODS
  // ============================================================================

  /**
   * Load atlas from JS file (Node.js implementation - synchronous)
   * @param {string} IDString - Font ID string
   * @returns {Promise} Promise that resolves when atlas is loaded
   */
  loadAtlasFromJS(IDString) {
    return new Promise((resolve, reject) => {
      try {
        const atlasJsPath = this.getAtlasJsPath(IDString, 'qoi');

        if (!fs.existsSync(atlasJsPath)) {
          console.warn(`Atlas JS file not found: ${atlasJsPath}`);
          this.incrementProgress();
          resolve(); // Not a failure - will use placeholder rectangles
          return;
        }

        // Execute the JS file (which calls registerAtlasPackage)
        const jsCode = fs.readFileSync(atlasJsPath, 'utf8');
        eval(jsCode);

        const pkg = FontLoader._tempAtlasPackages[IDString];

        if (!pkg || !pkg.base64Data) {
          console.warn(`Atlas package data missing for ${IDString}`);
          delete FontLoader._tempAtlasPackages[IDString]; // Clean up
          this.incrementProgress();
          resolve(); // Not a failure - will use placeholder rectangles
          return;
        }

        // Convert base64 to Buffer
        const qoiBuffer = Buffer.from(pkg.base64Data, 'base64');

        // Decode QOI (assuming QOIDecode is available globally)
        if (typeof QOIDecode === 'undefined') {
          throw new Error('QOIDecode not available - required for Node.js font loading');
        }

        const qoiData = QOIDecode(qoiBuffer.buffer, 0, null, 4); // Force RGBA output

        if (qoiData.error) {
          console.warn(`Failed to decode QOI data for ${IDString}`);
          delete FontLoader._tempAtlasPackages[IDString]; // Clean up
          this.incrementProgress();
          resolve(); // Not a failure - will use placeholder rectangles
          return;
        }

        // Create Image from QOI data (assuming Image class is available globally)
        if (typeof Image === 'undefined') {
          throw new Error('Image class not available - required for Node.js font loading');
        }

        const atlasImage = new Image(qoiData.width, qoiData.height, new Uint8ClampedArray(qoiData.data));

        // Use inherited method to reconstruct and store atlas
        this.loadAtlasFromPackage(IDString, atlasImage);

        this.incrementProgress();
        resolve();
      } catch (error) {
        console.warn(`Atlas loading failed for ${IDString}:`, error.message);
        this.incrementProgress();
        resolve(); // Not a failure - will use placeholder rectangles
      }
    });
  }
}

// Make FontLoader available globally (mimics browser environment)
if (typeof global !== 'undefined') {
  global.FontLoader = FontLoader;
}

// Export for module usage
module.exports = FontLoader;
