// FontLoaderConfig - Core Runtime Class
//
// This is a CORE RUNTIME class designed for minimal bundle size (~1KB).
// It provides essential font loading configuration with static methods and constants.
//
// DISTRIBUTION ROLE:
// - Part of "runtime-only" distribution for production applications
// - Centralized configuration for font asset paths and error messages
// - Used by FontLoader for path resolution and messaging
//
// ARCHITECTURE:
// - Static class with configuration constants and path building methods
// - Pre-defined paths and message templates for consistent font loading
// - Provides factory methods for building asset paths from ID strings
//
class FontLoaderConfig {
  static paths = {
    dataDir: '../font-assets/',
    metricsPrefix: 'metrics-',
    atlasPrefix: 'atlas-',
    imagePrefix: 'atlas-',
    pngExtension: '.png',
    qoiExtension: '.qoi',
    jsExtension: '.js'
  };

  static messages = {
    metricsNotFound: (IDString) => `Metrics JS not found: metrics-${IDString}.js - font will not be available`,
    pngImageNotFound: (IDString) => `Atlas image not found: atlas-${IDString}.png - will use placeholder rectangles`,
    jsImageNotFound: (IDString) => `Atlas JS not found: atlas-${IDString}-png.js - will use placeholder rectangles`,
    imageDataMissing: (IDString) => `Image data not found in JS file for ${IDString} - will use placeholder rectangles`,
    base64DecodeFailed: (IDString) => `Failed to decode base64 image data for ${IDString} - will use placeholder rectangles`
  };

  // Build file paths
  static getMetricsPath(IDString) {
    return `${this.paths.dataDir}${this.paths.metricsPrefix}${IDString}${this.paths.jsExtension}`;
  }

  static getPngPath(IDString) {
    return `${this.paths.dataDir}${this.paths.atlasPrefix}${IDString}${this.paths.pngExtension}`;
  }

  static getQoiPath(IDString) {
    return `${this.paths.dataDir}${this.paths.atlasPrefix}${IDString}${this.paths.qoiExtension}`;
  }

  static getImageJsPath(IDString) {
    return `${this.paths.dataDir}${this.paths.imagePrefix}${IDString}-png${this.paths.jsExtension}`;
  }
}