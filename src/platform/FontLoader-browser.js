// FontLoader - Core Runtime Class (Browser Implementation)
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
// - Extends FontLoaderBase for shared functionality
// - Implements browser-specific loading (DOM script tags, Image elements)
// - Promise-based font loading with error recovery
// - Protocol detection (file:// vs http://) for appropriate loading strategy
// - Graceful degradation: missing atlases result in placeholder rectangles
//
// DEPENDENCIES:
// - FontLoaderBase: Base class with shared logic, path building, and error messages
// - FontProperties: For ID string parsing and font identification
// - AtlasDataStore: For storing loaded atlas images
// - FontMetricsStore: For receiving metrics data from loaded JS files

// Shared utility for loading bitmap font data with error handling
class FontLoader extends FontLoaderBase {
  // ============================================================================
  // ENVIRONMENT-SPECIFIC IMPLEMENTATIONS (Abstract method overrides)
  // ============================================================================

  /**
   * Get default canvas factory for browser environment
   * @returns {Function} Factory that creates canvas elements via document.createElement
   */
  getDefaultCanvasFactory() {
    return () => {
      if (typeof document !== 'undefined') {
        return document.createElement('canvas');
      }
      throw new Error('[FontLoader] Canvas factory required in Node.js environment');
    };
  }

  /**
   * Get default data directory for browser environment
   * @returns {string} Default path to font assets (relative to HTML files in public/)
   */
  getDefaultDataDir() {
    return '../font-assets/';
  }

  /**
   * Load metrics JS file (browser implementation)
   * @param {string} IDString - Font ID string
   * @returns {Promise} Promise that resolves when metrics are loaded
   */
  loadMetrics(IDString) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = this.getMetricsPath(IDString);

      script.onload = () => {
        this.incrementProgress();
        resolve();
      };

      script.onerror = () => {
        script.remove();
        console.warn(FontLoaderBase.messages.metricsNotFound(IDString));

        // Count both missing files to maintain expected count
        this.incrementProgress(); // Missing metrics
        this.incrementProgress(); // Missing image (won't be loaded)

        reject(new Error(`Metrics not found for ${IDString}`));
      };

      document.head.appendChild(script);
    });
  }

  /**
   * Load atlas based on protocol (browser implementation)
   * @param {string} IDString - Font ID string
   * @param {boolean} isFileProtocol - Whether using file:// protocol
   * @returns {Promise} Promise that resolves when atlas is loaded
   */
  loadAtlas(IDString, isFileProtocol) {
    if (isFileProtocol) {
      return this.loadAtlasFromJS(IDString);
    } else {
      return this.loadAtlasFromPNG(IDString);
    }
  }

  // ============================================================================
  // BROWSER-SPECIFIC HELPER METHODS
  // ============================================================================

  /**
   * Load atlas from JS file (for file:// protocol)
   * @param {string} IDString - Font ID string
   * @returns {Promise} Promise that resolves when atlas is loaded
   */
  loadAtlasFromJS(IDString) {
    return new Promise((resolve, reject) => {
      const imageScript = document.createElement('script');
      imageScript.src = this.getAtlasJsPath(IDString, 'png');

      imageScript.onload = () => {
        const pkg = FontLoader._tempAtlasPackages[IDString];

        if (!pkg || !pkg.base64Data) {
          console.warn(FontLoaderBase.messages.imageDataMissing(IDString));
          imageScript.remove();
          this.incrementProgress();
          resolve(); // Not a failure - will use placeholder rectangles
          return;
        }

        const img = new Image();
        img.src = `data:image/png;base64,${pkg.base64Data}`;

        img.onload = () => {
          // Use inherited method to reconstruct and store atlas
          this.loadAtlasFromPackage(IDString, img);

          imageScript.remove();
          this.incrementProgress();
          resolve();
        };

        img.onerror = () => {
          console.warn(FontLoaderBase.messages.base64DecodeFailed(IDString));
          imageScript.remove();
          delete FontLoader._tempAtlasPackages[IDString]; // Clean up package
          this.incrementProgress();
          resolve(); // Not a failure - will use placeholder rectangles
        };
      };

      imageScript.onerror = () => {
        console.warn(FontLoaderBase.messages.jsImageNotFound(IDString, 'png'));
        imageScript.remove();
        this.incrementProgress();
        resolve(); // Not a failure - will use placeholder rectangles
      };

      document.head.appendChild(imageScript);
    });
  }

  /**
   * Load atlas from PNG file (for http:// protocol)
   * @param {string} IDString - Font ID string
   * @returns {Promise} Promise that resolves when atlas is loaded
   */
  loadAtlasFromPNG(IDString) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = this.getAtlasPngPath(IDString);

      img.onload = () => {
        // PNG files are now Atlas format (variable-width cells)
        // Use inherited method to reconstruct and store tight atlas + positioning
        const success = this.loadAtlasFromPackage(IDString, img);

        if (!success) {
          console.warn(`Failed to reconstruct atlas for ${IDString} - metrics not loaded yet`);
        }

        this.incrementProgress();
        resolve();
      };

      img.onerror = () => {
        console.warn(FontLoaderBase.messages.pngImageNotFound(IDString));
        this.incrementProgress();
        resolve(); // Not a failure - will use placeholder rectangles
      };
    });
  }
}
