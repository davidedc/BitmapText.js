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
  // Static storage for atlas packages (base64 + positioning) from JS files
  // Each package contains both image data and positioning data as an atomic unit
  static _tempAtlasPackages = {};

  constructor(atlasDataStore, fontMetricsStore, onProgress = null) {
    this.atlasDataStore = atlasDataStore;
    this.fontMetricsStore = fontMetricsStore;
    this.onProgress = onProgress;
    this.loadedCount = 0;
    this.totalCount = 0;
  }

  // Static method for atlas JS files to register complete packages
  // Takes BOTH base64 image data and positioning data together since they're always paired
  static registerAtlasPackage(IDString, base64Data, positioningData) {
    if (typeof IDString !== 'string' || typeof base64Data !== 'string') {
      console.warn('FontLoader.registerAtlasPackage: Invalid arguments - IDString and base64Data must be strings');
      return;
    }
    if (positioningData !== null && positioningData !== undefined && typeof positioningData !== 'object') {
      console.warn('FontLoader.registerAtlasPackage: Invalid positioningData - must be object, null, or undefined');
      return;
    }

    FontLoader._tempAtlasPackages[IDString] = {
      base64Data: base64Data,
      positioningData: positioningData
    };
  }

  // Creates AtlasData from loaded image and temp package data, then stores in AtlasDataStore
  // This encapsulates the entire flow: retrieve package → expand positioning → create AtlasData → store → cleanup
  // @param {string} IDString - Font ID string
  // @param {Image|Canvas} image - Loaded/decoded image or canvas element
  // @returns {boolean} - True if package found, false if missing (will still create AtlasData without positioning)
  createAndStoreAtlasDataFromPackage(IDString, image) {
    const fontProperties = FontProperties.fromIDString(IDString);

    // Get temp package (may not exist)
    const pkg = FontLoader._tempAtlasPackages[IDString];

    // Clean up immediately
    delete FontLoader._tempAtlasPackages[IDString];

    // Extract positioning data (null/undefined if no package)
    const positioningData = pkg ? pkg.positioningData : null;

    // Use AtlasDataExpander.createAtlasData() to handle expansion and AtlasData creation
    // This method handles null positioning gracefully (will create AtlasData with null positioning)
    let atlasData;
    if (typeof AtlasDataExpander !== 'undefined') {
      atlasData = AtlasDataExpander.createAtlasData(image, positioningData);
    } else {
      // Fallback without AtlasDataExpander
      console.warn(`AtlasDataExpander not available for ${IDString} - creating AtlasData without positioning`);
      const atlasImage = new AtlasImage(image);
      atlasData = new AtlasData(atlasImage, null);
    }

    // Store in atlas data store
    this.atlasDataStore.setAtlasData(fontProperties, atlasData);

    return pkg !== null && pkg !== undefined;
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
        const fontProperties = FontProperties.fromIDString(IDString);

        // Create AtlasImage instance from loaded PNG image
        if (typeof AtlasImage === 'undefined') {
          throw new Error(`AtlasImage class required for font loading - not available for ${IDString}`);
        }
        const atlasImage = new AtlasImage(img);

        // PNG files don't have positioning data - create AtlasData with AtlasImage only
        if (typeof AtlasData === 'undefined') {
          throw new Error(`AtlasData class required for font loading - not available for ${IDString}`);
        }
        const atlasData = new AtlasData(atlasImage, null);
        this.atlasDataStore.setAtlasData(fontProperties, atlasData);

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