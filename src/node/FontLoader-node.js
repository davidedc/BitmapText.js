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
// - Static: FontLoader.registerAtlasPackage(IDString, base64Data, positioningData)
// - Instance: loadAtlasFromPackage(IDString, image)
// - Instance: loadFont(IDString, isFileProtocol?)
// - Instance: loadFonts(IDStrings, isFileProtocol?)
// - Instance: isComplete()
//
// ARCHITECTURE:
// - Static storage for temporary atlas packages from JS files (shared between instances)
// - Instance methods for font loading with progress tracking
// - Synchronous implementation (no Promises in Node version for simplicity)

// Node.js modules
const fs = require('fs');

// FontLoader class for Node.js environment
class FontLoader {
  // Static storage for atlas packages (base64 only) from JS files
  // No positioning data - will be reconstructed at runtime
  // Shared across all FontLoader instances (matches browser behavior)
  static _tempAtlasPackages = {};

  // Constructor matching browser API
  constructor(atlasDataStore, fontMetricsStore, onProgress = null, canvasFactory = null) {
    this.atlasDataStore = atlasDataStore;
    this.fontMetricsStore = fontMetricsStore;
    this.onProgress = onProgress;
    this.loadedCount = 0;
    this.totalCount = 0;
    // Canvas factory for TightAtlasReconstructor (Node.js: default to Canvas creation if not provided)
    this.canvasFactory = canvasFactory || (() => new Canvas(0, 0));
  }

  // Static method for atlas JS files to register packages
  // Only takes base64 data (NO positioning data)
  // IDENTICAL API TO BROWSER VERSION
  static registerAtlasPackage(IDString, base64Data) {
    FontLoaderShared.registerAtlasPackage(IDString, base64Data, FontLoader._tempAtlasPackages);
  }

  // Loads AtlasData from Atlas image and stores in AtlasDataStore
  // Uses TightAtlasReconstructor to convert Atlas → Tight Atlas + positioning
  // IDENTICAL API TO BROWSER VERSION
  // @param {string} IDString - Font ID string
  // @param {Canvas} atlasImage - Loaded Atlas image (variable-width cells format)
  // @returns {boolean} - True if successful, false if metrics not available
  loadAtlasFromPackage(IDString, atlasImage) {
    return FontLoaderShared.loadAtlasFromPackage(IDString, atlasImage, {
      atlasDataStore: this.atlasDataStore,
      fontMetricsStore: this.fontMetricsStore,
      canvasFactory: this.canvasFactory,
      tempPackagesMap: FontLoader._tempAtlasPackages
    });
  }

  // Load font data for a single ID string
  // IDENTICAL API TO BROWSER VERSION (but synchronous implementation)
  // In Node.js, this is synchronous (no Promise) but maintains same call signature
  loadFont(IDString, isFileProtocol = false) {
    this.totalCount += 2; // Each font has 2 files (metrics + image)

    try {
      this.loadMetrics(IDString);
      this.loadAtlas(IDString, isFileProtocol);
    } catch (error) {
      console.warn(`Font loading failed for ${IDString}:`, error.message);
    }
  }

  // Load multiple fonts from an array of ID strings
  // IDENTICAL API TO BROWSER VERSION (but synchronous implementation)
  loadFonts(IDStrings, isFileProtocol = false) {
    this.totalCount = IDStrings.length * 2;
    this.loadedCount = 0;

    for (const IDString of IDStrings) {
      this.loadFont(IDString, isFileProtocol);
    }
  }

  // Load metrics JS file (synchronous Node.js implementation)
  loadMetrics(IDString) {
    try {
      // For Node.js, we need to construct the path
      // This assumes metrics files are in font-assets/ directory
      const metricsPath = `font-assets/metrics-${IDString}.js`;

      if (!fs.existsSync(metricsPath)) {
        console.warn(`Metrics file not found: ${metricsPath}`);
        this.incrementProgress(); // Missing metrics
        this.incrementProgress(); // Missing image (won't be loaded)
        throw new Error(`Metrics not found for ${IDString}`);
      }

      // Execute the JS file (which populates FontMetricsStore)
      // The metrics file expects global fontMetricsStore, FontProperties, and MetricsExpander
      // Make them available temporarily for the eval
      const jsCode = fs.readFileSync(metricsPath, 'utf8');
      const fontMetricsStore = this.fontMetricsStore;  // Local ref for eval scope
      eval(jsCode);

      this.incrementProgress();
    } catch (error) {
      throw error;
    }
  }

  // Load atlas based on protocol (synchronous Node.js implementation)
  loadAtlas(IDString, isFileProtocol) {
    // In Node.js, we always load from JS files (isFileProtocol is ignored)
    // This parameter is kept for API compatibility with browser version
    this.loadAtlasFromJS(IDString);
  }

  // Load atlas from JS file (synchronous Node.js implementation)
  loadAtlasFromJS(IDString) {
    try {
      // For Node.js, we need to construct the path
      const atlasJsPath = `font-assets/atlas-${IDString}-qoi.js`;

      if (!fs.existsSync(atlasJsPath)) {
        console.warn(`Atlas JS file not found: ${atlasJsPath}`);
        this.incrementProgress();
        return; // Not a failure - will use placeholder rectangles
      }

      // Execute the JS file (which calls registerAtlasPackage)
      const jsCode = fs.readFileSync(atlasJsPath, 'utf8');
      eval(jsCode);

      const pkg = FontLoader._tempAtlasPackages[IDString];

      if (!pkg || !pkg.base64Data) {
        console.warn(`Atlas package data missing for ${IDString}`);
        delete FontLoader._tempAtlasPackages[IDString]; // Clean up
        this.incrementProgress();
        return; // Not a failure - will use placeholder rectangles
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
        return; // Not a failure - will use placeholder rectangles
      }

      // Create Image from QOI data (assuming Image class is available globally)
      if (typeof Image === 'undefined') {
        throw new Error('Image class not available - required for Node.js font loading');
      }

      const atlasImage = new Image(qoiData.width, qoiData.height, new Uint8ClampedArray(qoiData.data));

      // Use the shared loadAtlasFromPackage method
      this.loadAtlasFromPackage(IDString, atlasImage);

      this.incrementProgress();
    } catch (error) {
      console.warn(`Atlas loading failed for ${IDString}:`, error.message);
      this.incrementProgress();
    }
  }

  // Increment progress counter and call callback
  // IDENTICAL TO BROWSER VERSION
  incrementProgress() {
    FontLoaderShared.incrementProgress(this);
  }

  // Check if loading is complete
  // IDENTICAL TO BROWSER VERSION
  isComplete() {
    return FontLoaderShared.isComplete(this.loadedCount, this.totalCount);
  }
}

// Make FontLoader available globally (mimics browser environment)
if (typeof global !== 'undefined') {
  global.FontLoader = FontLoader;
}

// Export for module usage
module.exports = FontLoader;