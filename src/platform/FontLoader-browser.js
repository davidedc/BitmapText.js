// FontLoader - Browser-Specific Font Loader
//
// This static class extends FontLoaderBase to provide browser-specific
// font loading implementation using DOM APIs (script tags, Image objects).
//
// DISTRIBUTION ROLE:
// - Only included in browser distributions
// - Excluded from Node.js bundles via build scripts
// - Uses browser-specific APIs (document, Image, script tags)
//
// ARCHITECTURE:
// - Static class extending FontLoaderBase
// - Implements abstract methods for browser environment
// - Uses DOM script injection for metrics loading
// - Uses Image objects or script tags for atlas loading
//
// LOADING STRATEGIES:
// - Metrics: Always via script tag injection
// - Atlas (file:// protocol): Via script tag with base64 PNG data
// - Atlas (http/https): Via Image object loading PNG directly

class FontLoader extends FontLoaderBase {
  // ============================================
  // File Name Constants (from BitmapText)
  // ============================================

  static METRICS_PREFIX = 'metrics-';
  static ATLAS_PREFIX = 'atlas-';
  static JS_EXTENSION = '.js';
  static PNG_EXTENSION = '.png';

  // ============================================
  // Browser-Specific Loading Implementation
  // ============================================

  /**
   * Load metrics file via script tag injection
   * @param {string} idString - Font ID string
   * @param {Object} bitmapTextClass - BitmapText class reference
   * @returns {Promise} Resolves when metrics are loaded
   */
  static async loadMetricsFile(idString, bitmapTextClass) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const fontDirectory = FontLoaderBase.getFontDirectory();
      script.src = `${fontDirectory}${FontLoader.METRICS_PREFIX}${idString}${FontLoader.JS_EXTENSION}`;

      script.onload = () => {
        resolve();
      };

      script.onerror = () => {
        script.remove();
        console.warn(`Metrics JS not found: metrics-${idString}.js - font will not be available`);
        reject(new Error(`Metrics not found for ${idString}`));
      };

      document.head.appendChild(script);
    });
  }

  /**
   * Load atlas file (chooses strategy based on protocol)
   * @param {string} idString - Font ID string
   * @param {boolean} isFileProtocol - Whether using file:// protocol
   * @param {Object} bitmapTextClass - BitmapText class reference
   * @returns {Promise} Resolves when atlas is loaded
   */
  static async loadAtlasFile(idString, isFileProtocol, bitmapTextClass) {
    if (isFileProtocol) {
      return FontLoader._loadAtlasFromJS(idString, bitmapTextClass);
    } else {
      return FontLoader._loadAtlasFromPNG(idString, bitmapTextClass);
    }
  }

  // ============================================
  // Browser-Specific Atlas Loading Strategies
  // ============================================

  /**
   * Load atlas from JS file (for file:// protocol)
   * JS file contains base64-encoded PNG data
   * @private
   * @param {string} idString - Font ID string
   * @param {Object} bitmapTextClass - BitmapText class reference
   * @returns {Promise} Resolves when atlas is loaded
   */
  static _loadAtlasFromJS(idString, bitmapTextClass) {
    return new Promise((resolve, reject) => {
      const imageScript = document.createElement('script');
      const fontDirectory = FontLoaderBase.getFontDirectory();
      imageScript.src = `${fontDirectory}${FontLoader.ATLAS_PREFIX}${idString}-png${FontLoader.JS_EXTENSION}`;

      imageScript.onload = () => {
        const pkg = FontLoaderBase._tempAtlasPackages[idString];

        if (!pkg || !pkg.base64Data) {
          console.warn(`Image data not found in JS file for ${idString} - will use placeholder rectangles`);
          imageScript.remove();
          resolve();
          return;
        }

        const img = new Image();
        img.src = `data:image/png;base64,${pkg.base64Data}`;

        img.onload = () => {
          // Atlas will be reconstructed now or later when metrics are available
          FontLoaderBase._loadAtlasFromPackage(idString, img, bitmapTextClass);
          imageScript.remove();
          resolve();
        };

        img.onerror = () => {
          console.warn(`Failed to decode base64 image data for ${idString} - will use placeholder rectangles`);
          imageScript.remove();
          delete FontLoaderBase._tempAtlasPackages[idString];
          resolve();
        };
      };

      imageScript.onerror = () => {
        console.warn(`Atlas JS not found: atlas-${idString}-png.js - will use placeholder rectangles`);
        imageScript.remove();
        resolve();
      };

      document.head.appendChild(imageScript);
    });
  }

  /**
   * Load atlas from PNG file directly (for http/https protocols)
   * @private
   * @param {string} idString - Font ID string
   * @param {Object} bitmapTextClass - BitmapText class reference
   * @returns {Promise} Resolves when atlas is loaded
   */
  static _loadAtlasFromPNG(idString, bitmapTextClass) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const fontDirectory = FontLoaderBase.getFontDirectory();
      img.src = `${fontDirectory}${FontLoader.ATLAS_PREFIX}${idString}${FontLoader.PNG_EXTENSION}`;

      img.onload = () => {
        // Atlas will be reconstructed now or later when metrics are available
        FontLoaderBase._loadAtlasFromPackage(idString, img, bitmapTextClass);
        resolve();
      };

      img.onerror = () => {
        console.warn(`Atlas image not found: atlas-${idString}.png - will use placeholder rectangles`);
        resolve();
      };
    });
  }
}
