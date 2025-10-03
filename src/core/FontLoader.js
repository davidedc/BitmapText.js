// FontLoader - Core Runtime Class
//
// This is a CORE RUNTIME class designed for minimal bundle size (~4-5KB).
// It provides essential font loading capabilities for consuming pre-built bitmap fonts.
//
// DISTRIBUTION ROLE:
// - Part of "runtime-only" distribution for production applications
// - Manages loading of font metrics (JS files) and atlases (PNG or JS files)
// - Handles both HTTP and file:// protocol loading scenarios
// - Provides error handling and progress reporting for font loading
//
// ARCHITECTURE:
// - Promise-based font loading with error recovery
// - Static storage for temporary atlas data from JS files
// - Protocol detection (file:// vs http://) for appropriate loading strategy
// - Graceful degradation: missing atlases result in placeholder rectangles
//
// DEPENDENCIES:
// - FontLoaderConfig: For path building and error messages
// - FontProperties: For ID string parsing and font identification
// - AtlasDataStore: For storing loaded atlas images
// - FontMetricsStore: For receiving metrics data from loaded JS files

// Shared utility for loading bitmap font data with error handling
class FontLoader {
  // Static storage for atlas packages (base64 only) from JS files
  // PHASE 1: No positioning data - will be reconstructed at runtime
  static _tempAtlasPackages = {};

  constructor(atlasDataStore, fontMetricsStore, onProgress = null, canvasFactory = null) {
    this.atlasDataStore = atlasDataStore;
    this.fontMetricsStore = fontMetricsStore;
    this.onProgress = onProgress;
    this.loadedCount = 0;
    this.totalCount = 0;
    // Canvas factory for TightAtlasReconstructor (browser: createElement, Node.js: Canvas class)
    this.canvasFactory = canvasFactory || (() => {
      if (typeof document !== 'undefined') {
        return document.createElement('canvas');
      }
      throw new Error('Canvas factory required in Node.js environment');
    });
  }

  // Static method for atlas JS files to register packages
  // PHASE 1: Only takes base64 data (NO positioning data)
  static registerAtlasPackage(IDString, base64Data) {
    if (typeof IDString !== 'string' || typeof base64Data !== 'string') {
      console.warn('FontLoader.registerAtlasPackage: Invalid arguments - IDString and base64Data must be strings');
      return;
    }

    FontLoader._tempAtlasPackages[IDString] = {
      base64Data: base64Data
    };
  }

  // Creates AtlasData from loaded Atlas image, then stores in AtlasDataStore
  // PHASE 1: Uses TightAtlasReconstructor to convert Atlas → Tight Atlas + positioning
  // @param {string} IDString - Font ID string
  // @param {Image|Canvas} atlasImage - Loaded Atlas image (variable-width cells format)
  // @returns {boolean} - True if successful, false if metrics not available
  createAndStoreAtlasDataFromPackage(IDString, atlasImage) {
    const fontProperties = FontProperties.fromIDString(IDString);

    // Get temp package (may not exist)
    const pkg = FontLoader._tempAtlasPackages[IDString];

    // Clean up immediately
    delete FontLoader._tempAtlasPackages[IDString];

    // PHASE 1: Reconstruct tight atlas from Atlas image using TightAtlasReconstructor
    // This requires FontMetrics to be loaded first (for cell dimensions)
    const fontMetrics = this.fontMetricsStore.getFontMetrics(fontProperties);

    if (!fontMetrics) {
      console.warn(`FontLoader: Metrics not loaded for ${IDString} - cannot reconstruct tight atlas`);
      console.warn('Make sure metrics are loaded before atlases');
      return false;
    }

    // Check if TightAtlasReconstructor is available
    if (typeof TightAtlasReconstructor === 'undefined') {
      throw new Error(`TightAtlasReconstructor required for font loading - not available for ${IDString}`);
    }

    // Reconstruct tight atlas + positioning from Atlas image
    const { atlasImage: tightAtlasImage, atlasPositioning } =
      TightAtlasReconstructor.reconstructFromAtlas(atlasImage, fontMetrics, this.canvasFactory);

    // Create AtlasData instance
    const atlasData = new AtlasData(tightAtlasImage, atlasPositioning);

    // Store in atlas data store
    this.atlasDataStore.setAtlasData(fontProperties, atlasData);

    return true;
  }

  // Load font data for a single ID string
  loadFont(IDString, isFileProtocol = false) {
    this.totalCount += 2; // Each font has 2 files (metrics + image)

    return this.loadMetrics(IDString)
      .then(() => this.loadAtlas(IDString, isFileProtocol))
      .catch(error => {
        // Even if loading fails, we still count it as processed to prevent hanging
        console.warn(`Font loading failed for ${IDString}:`, error.message);
      });
  }

  // Load multiple fonts from an array of ID strings
  loadFonts(IDStrings, isFileProtocol = false) {
    this.totalCount = IDStrings.length * 2;
    this.loadedCount = 0;

    const promises = IDStrings.map(IDString => this.loadFont(IDString, isFileProtocol));

    return Promise.all(promises);
  }

  // Load metrics JS file
  loadMetrics(IDString) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = FontLoaderConfig.getMetricsPath(IDString);

      script.onload = () => {
        this.incrementProgress();
        resolve();
      };

      script.onerror = () => {
        script.remove();
        console.warn(FontLoaderConfig.messages.metricsNotFound(IDString));

        // Count both missing files to maintain expected count
        this.incrementProgress(); // Missing metrics
        this.incrementProgress(); // Missing image (won't be loaded)

        reject(new Error(`Metrics not found for ${IDString}`));
      };

      document.head.appendChild(script);
    });
  }

  // Load atlas based on protocol
  loadAtlas(IDString, isFileProtocol) {
    if (isFileProtocol) {
      return this.loadAtlasFromJS(IDString);
    } else {
      return this.loadAtlasFromPNG(IDString);
    }
  }

  // Load atlas from JS file (for file:// protocol)
  loadAtlasFromJS(IDString) {
    return new Promise((resolve, reject) => {
      const imageScript = document.createElement('script');
      imageScript.src = FontLoaderConfig.getImageJsPath(IDString);

      imageScript.onload = () => {
        const pkg = FontLoader._tempAtlasPackages[IDString];

        if (!pkg || !pkg.base64Data) {
          console.warn(FontLoaderConfig.messages.imageDataMissing(IDString));
          imageScript.remove();
          this.incrementProgress();
          resolve(); // Not a failure - will use placeholder rectangles
          return;
        }

        const img = new Image();
        img.src = `data:image/png;base64,${pkg.base64Data}`;

        img.onload = () => {
          // Complete flow: get package → expand → create AtlasData → store → cleanup
          this.createAndStoreAtlasDataFromPackage(IDString, img);

          imageScript.remove();
          this.incrementProgress();
          resolve();
        };

        img.onerror = () => {
          console.warn(FontLoaderConfig.messages.base64DecodeFailed(IDString));
          imageScript.remove();
          delete FontLoader._tempAtlasPackages[IDString]; // Clean up package
          this.incrementProgress();
          resolve(); // Not a failure - will use placeholder rectangles
        };
      };

      imageScript.onerror = () => {
        console.warn(FontLoaderConfig.messages.jsImageNotFound(IDString));
        imageScript.remove();
        this.incrementProgress();
        resolve(); // Not a failure - will use placeholder rectangles
      };

      document.head.appendChild(imageScript);
    });
  }

  // Load atlas from PNG file (for http:// protocol)
  loadAtlasFromPNG(IDString) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = FontLoaderConfig.getPngPath(IDString);

      img.onload = () => {
        // PHASE 1: PNG files are now Atlas format (variable-width cells)
        // Reconstruct tight atlas + positioning using TightAtlasReconstructor
        const success = this.createAndStoreAtlasDataFromPackage(IDString, img);

        if (!success) {
          console.warn(`Failed to reconstruct atlas for ${IDString} - metrics not loaded yet`);
        }

        this.incrementProgress();
        resolve();
      };

      img.onerror = () => {
        console.warn(FontLoaderConfig.messages.pngImageNotFound(IDString));
        this.incrementProgress();
        resolve(); // Not a failure - will use placeholder rectangles
      };
    });
  }

  // Increment progress counter and call callback
  incrementProgress() {
    this.loadedCount++;
    if (this.onProgress) {
      this.onProgress(this.loadedCount, this.totalCount);
    }
  }

  // Check if loading is complete
  isComplete() {
    return this.loadedCount >= this.totalCount;
  }
}