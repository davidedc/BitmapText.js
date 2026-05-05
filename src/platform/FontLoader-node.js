// FontLoader - Node.js-Specific Font Loader
//
// Node implementation of the FontLoaderBase abstract methods.
//
// METRICS:
//   The whole metrics corpus is one file: `font-assets/metrics-bundle.js`.
//   On the first metrics request we `fs.readFileSync` it and `eval` it; the
//   wrapper calls `BitmapText.registerBundle("<base64>")`, which sets
//   `FontLoaderBase._bundleDecodePromise` to the async decode work. The decode
//   uses `DecompressionStream('deflate-raw')` on Node 18+ or `zlib.inflateRawSync`
//   on Node ≤ 17 (handled inside MetricsBundleDecoder).
//
// ATLAS:
//   Per-font, unchanged: read QOI base64 wrapper, decode, paint into a canvas.

class FontLoader extends FontLoaderBase {

  // ============================================
  // File Name Constants
  // ============================================

  static ATLAS_PREFIX = 'atlas-';
  static JS_EXTENSION = '.js';
  static METRICS_BUNDLE_FILENAME = 'metrics-bundle.js';

  // ============================================
  // Node.js-Specific Loading Implementation
  // ============================================

  /**
   * Read + eval the metrics bundle once, then await the decode promise that
   * `BitmapText.registerBundle` set as a side effect of the eval.
   * @returns {Promise<void>} Resolves once every record is in MetricsBundleStore.
   */
  static async loadBundleFile() {
    if (typeof require === 'undefined') {
      throw new Error('FontLoader.loadBundleFile requires Node.js environment');
    }

    const fs = require('fs');
    const path = require('path');

    const fontDirectory = FontLoaderBase.getFontDirectory();
    const bundlePath = path.resolve(fontDirectory, FontLoader.METRICS_BUNDLE_FILENAME);
    const bundleCode = fs.readFileSync(bundlePath, 'utf8');
    eval(bundleCode);

    const decodePromise = FontLoaderBase._bundleDecodePromise;
    if (!decodePromise) {
      throw new Error('metrics-bundle.js evaluated but did not call BitmapText.registerBundle');
    }
    return decodePromise;
  }

  /**
   * Load atlas file via fs.readFileSync + QOIDecode
   * @param {string} idString - Font ID string
   * @param {boolean} isFileProtocol - Not used in Node.js
   * @param {Object} bitmapTextClass - BitmapText class reference
   * @returns {Promise} Resolves when atlas is loaded
   */
  static async loadAtlasFile(idString, isFileProtocol, bitmapTextClass) {
    if (typeof require === 'undefined') {
      throw new Error('FontLoader.loadAtlasFile requires Node.js environment');
    }

    const fs = require('fs');
    const path = require('path');

    const fontDirectory = FontLoaderBase.getFontDirectory();
    const atlasPath = path.resolve(fontDirectory, `${FontLoader.ATLAS_PREFIX}${idString}-qoi${FontLoader.JS_EXTENSION}`);

    try {
      const atlasCode = fs.readFileSync(atlasPath, 'utf8');
      // Execute with BitmapText in scope to call registerAtlas
      // The atlas file will call BitmapText.registerAtlas()
      eval(atlasCode);

      // Now reconstruct the atlas
      const pkg = FontLoaderBase._tempAtlasPackages[idString];
      if (pkg && pkg.base64Data) {
        // Decode QOI
        if (typeof QOIDecode === 'undefined') {
          throw new Error('FontLoader: QOIDecode not available - required for atlas loading');
        }

        const qoiData = Uint8Array.from(atob(pkg.base64Data), c => c.charCodeAt(0));
        const decoded = QOIDecode(qoiData.buffer);

        // Create canvas and draw (explicit double invocation: get factory, call factory)
        const canvas = bitmapTextClass.getCanvasFactory()();
        canvas.width = decoded.width;
        canvas.height = decoded.height;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(decoded.width, decoded.height);
        imageData.data.set(decoded.data);
        ctx.putImageData(imageData, 0, 0);

        // Reconstruct atlas
        FontLoaderBase._loadAtlasFromPackage(idString, canvas, bitmapTextClass);
      }
    } catch (error) {
      console.warn(`Atlas loading error for ${atlasPath}: ${error.message}`);
      console.warn('Will use placeholder rectangles');
    }
  }
}
