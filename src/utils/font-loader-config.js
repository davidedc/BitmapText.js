// Configuration constants for font loading
const FontLoaderConfig = {
  paths: {
    dataDir: '../font-assets/',
    metricsPrefix: 'metrics-',
    atlasPrefix: 'atlas-',
    imagePrefix: 'atlas-',
    pngExtension: '.png',
    qoiExtension: '.qoi',
    jsExtension: '.js'
  },
  
  messages: {
    metricsNotFound: (IDString) => `Metrics JS not found: metrics-${IDString}.js - font will not be available`,
    pngImageNotFound: (IDString) => `Atlas image not found: atlas-${IDString}.png - will use placeholder rectangles`,
    jsImageNotFound: (IDString) => `Atlas JS not found: atlas-${IDString}.js - will use placeholder rectangles`,
    imageDataMissing: (IDString) => `Image data not found in JS file for ${IDString} - will use placeholder rectangles`,
    base64DecodeFailed: (IDString) => `Failed to decode base64 image data for ${IDString} - will use placeholder rectangles`
  },

  // Build file paths
  getMetricsPath(IDString) {
    return `${this.paths.dataDir}${this.paths.metricsPrefix}${IDString}${this.paths.jsExtension}`;
  },

  getPngPath(IDString) {
    return `${this.paths.dataDir}${this.paths.atlasPrefix}${IDString}${this.paths.pngExtension}`;
  },

  getQoiPath(IDString) {
    return `${this.paths.dataDir}${this.paths.atlasPrefix}${IDString}${this.paths.qoiExtension}`;
  },

  getImageJsPath(IDString) {
    return `${this.paths.dataDir}${this.paths.imagePrefix}${IDString}${this.paths.jsExtension}`;
  }
};