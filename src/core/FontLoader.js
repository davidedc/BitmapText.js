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
  // Static storage for temporary atlas data from JS files
  static _tempAtlasData = {};

  // Static storage for temporary atlas positioning data from JS files
  static _tempAtlasPositioning = {};

  constructor(atlasDataStore, fontMetricsStore, onProgress = null) {
    this.atlasDataStore = atlasDataStore;
    this.fontMetricsStore = fontMetricsStore;
    this.onProgress = onProgress;
    this.loadedCount = 0;
    this.totalCount = 0;
  }

  // Static method for atlas JS files to register their temporary base64 data
  // This method name conveys that these are temporary data:image/png;base64 strings
  // that will be deleted once an image is created from them
  static registerTempAtlasData(IDString, base64Data) {
    if (typeof IDString !== 'string' || typeof base64Data !== 'string') {
      console.warn('FontLoader.registerTempAtlasData: Invalid arguments - both IDString and base64Data must be strings');
      return;
    }
    FontLoader._tempAtlasData[IDString] = base64Data;
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
        const imageData = FontLoader._tempAtlasData[IDString];

        if (!imageData) {
          console.warn(FontLoaderConfig.messages.imageDataMissing(IDString));
          imageScript.remove();
          this.incrementProgress();
          resolve(); // Not a failure - will use placeholder rectangles
          return;
        }

        const img = new Image();
        img.src = `data:image/png;base64,${imageData}`;

        img.onload = () => {
          const fontProperties = FontProperties.fromIDString(IDString);

          // Create AtlasImage instance from loaded image
          if (typeof AtlasImage === 'undefined') {
            throw new Error(`AtlasImage class required for font loading - not available for ${IDString}`);
          }
          const atlasImage = new AtlasImage(img);

          // Get atlas positioning data
          const positioningData = FontLoader._tempAtlasPositioning[IDString];
          let atlasPositioning = null;

          if (positioningData) {
            // Expand minified positioning data to AtlasPositioning instance
            if (typeof AtlasExpander !== 'undefined') {
              atlasPositioning = AtlasExpander.expand(positioningData);
            } else {
              console.warn(`AtlasExpander not available for ${IDString} - positioning data will be raw`);
              atlasPositioning = positioningData;
            }
          }

          // Create AtlasData object containing AtlasImage and AtlasPositioning
          if (typeof AtlasData === 'undefined') {
            throw new Error(`AtlasData class required for font loading - not available for ${IDString}`);
          }
          const atlasData = new AtlasData(atlasImage, atlasPositioning);
          this.atlasDataStore.setAtlas(fontProperties, atlasData);

          imageScript.remove();
          delete FontLoader._tempAtlasData[IDString]; // Clean up temporary image data
          delete FontLoader._tempAtlasPositioning[IDString]; // Clean up temporary positioning data

          this.incrementProgress();
          resolve();
        };

        img.onerror = () => {
          console.warn(FontLoaderConfig.messages.base64DecodeFailed(IDString));
          imageScript.remove();
          delete FontLoader._tempAtlasData[IDString]; // Clean up temporary image data
          delete FontLoader._tempAtlasPositioning[IDString]; // Clean up temporary positioning data
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
        this.atlasDataStore.setAtlas(fontProperties, atlasData);

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