// Configuration constants for font loading
const FontLoaderConfig = {
  paths: {
    dataDir: '../data/',
    metricsPrefix: 'glyph-sheet-',
    imagePrefix: 'image-glyph-sheet-',
    pngExtension: '.png',
    jsExtension: '.js'
  },
  
  messages: {
    metricsNotFound: (IDString) => `Metrics JS not found: glyph-sheet-${IDString}.js - font will not be available`,
    pngImageNotFound: (IDString) => `Glyph sheet image not found: glyph-sheet-${IDString}.png - will use placeholder rectangles`,
    jsImageNotFound: (IDString) => `Glyph sheet JS not found: image-glyph-sheet-${IDString}.js - will use placeholder rectangles`,
    imageDataMissing: (IDString) => `Image data not found in JS file for ${IDString} - will use placeholder rectangles`,
    base64DecodeFailed: (IDString) => `Failed to decode base64 image data for ${IDString} - will use placeholder rectangles`
  },

  // Build file paths
  getMetricsPath(IDString) {
    return `${this.paths.dataDir}${this.paths.metricsPrefix}${IDString}${this.paths.jsExtension}`;
  },

  getPngPath(IDString) {
    return `${this.paths.dataDir}${this.paths.metricsPrefix}${IDString}${this.paths.pngExtension}`;
  },

  getImageJsPath(IDString) {
    return `${this.paths.dataDir}${this.paths.imagePrefix}${IDString}${this.paths.jsExtension}`;
  }
};