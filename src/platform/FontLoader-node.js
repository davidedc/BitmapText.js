// FontLoader - Node.js-Specific Font Loader
//
// This static class extends FontLoaderBase to provide Node.js-specific
// font loading implementation using Node.js APIs (fs, path, require).
//
// DISTRIBUTION ROLE:
// - Only included in Node.js distributions
// - Excluded from browser bundles via build scripts
// - Uses Node.js-specific APIs (fs, path, eval)
//
// ARCHITECTURE:
// - Static class extending FontLoaderBase
// - Implements abstract methods for Node.js environment
// - Uses fs.readFileSync for metrics and atlas loading
// - Uses eval() to execute metrics registration code
// - Uses QOIDecode for atlas decompression
//
// LOADING STRATEGIES:
// - Metrics: fs.readFileSync + eval()
// - Atlas: fs.readFileSync QOI file + QOIDecode + canvas creation

class FontLoader extends FontLoaderBase {
  // ============================================
  // Platform Configuration
  // ============================================

  /**
   * Get default canvas factory for Node.js
   * @returns {Function} Canvas factory function
   */
  static getDefaultCanvasFactory() {
    // Node.js uses node-canvas library
    // Returns a factory that creates Canvas instances
    return () => {
      if (typeof require === 'undefined') {
        throw new Error('FontLoader requires Node.js environment with require()');
      }
      const { createCanvas } = require('canvas');
      return createCanvas(0, 0);
    };
  }

  /**
   * Get default data directory for Node.js
   * @returns {string} Data directory path
   */
  static getDefaultDataDir() {
    return './font-assets/';
  }

  // ============================================
  // File Name Constants (from BitmapText)
  // ============================================

  static METRICS_PREFIX = 'metrics-';
  static ATLAS_PREFIX = 'atlas-';
  static JS_EXTENSION = '.js';

  // ============================================
  // Node.js-Specific Loading Implementation
  // ============================================

  /**
   * Load metrics file via fs.readFileSync + eval
   * @param {string} idString - Font ID string
   * @param {Object} bitmapTextClass - BitmapText class reference
   * @returns {Promise} Resolves when metrics are loaded
   */
  static async loadMetricsFile(idString, bitmapTextClass) {
    if (typeof require === 'undefined') {
      throw new Error('FontLoader.loadMetricsFile requires Node.js environment');
    }

    const fs = require('fs');
    const path = require('path');

    const dataDir = bitmapTextClass.getDataDir();
    const metricsPath = path.resolve(dataDir, `${FontLoader.METRICS_PREFIX}${idString}${FontLoader.JS_EXTENSION}`);

    try {
      const metricsCode = fs.readFileSync(metricsPath, 'utf8');
      // Execute with BitmapText in scope
      // The metrics file will call BitmapText.registerMetrics()
      eval(metricsCode);
    } catch (error) {
      console.warn(`Metrics file not found: ${metricsPath}`);
      throw error;
    }
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

    const dataDir = bitmapTextClass.getDataDir();
    const atlasPath = path.resolve(dataDir, `${FontLoader.ATLAS_PREFIX}${idString}-qoi${FontLoader.JS_EXTENSION}`);

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

        // Create canvas and draw
        const canvasFactory = bitmapTextClass.getCanvasFactory();
        const canvas = canvasFactory();
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
