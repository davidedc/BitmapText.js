// AtlasImageFAB - Font Assets Building Class
//
// This extends AtlasImage with font assets building capabilities (~3-4KB additional).
// It provides image creation, manipulation, and serialization for atlas generation.
//
// DISTRIBUTION ROLE:
// - Part of "full distribution" for font assets building applications
// - Extends AtlasImage with creation and export capabilities
// - Contains image generation, validation, and serialization code
// - Used during atlas creation and font assets building pipeline
//
// ARCHITECTURE:
// - Extends AtlasImage with mutable options for font assets building
// - Provides factory methods for creating atlas images from various sources
// - Handles image format conversion and serialization
// - Can extract clean AtlasImage instances for runtime distribution
//
// FONT ASSETS BUILDING CAPABILITIES:
// - Create atlas images from canvases, base64 data, or URLs
// - Convert between different image formats (Canvas, Image, base64)
// - Export to various formats (PNG, QOI, base64)
// - Validate and optimize atlas images for rendering
//
// For runtime-only applications, use AtlasImage which provides minimal image encapsulation.
class AtlasImageFAB extends AtlasImage {
  constructor(image, options = {}) {
    // Allow mutable instances for font assets building
    super(image, { mutable: true, ...options });
  }

  /**
   * Create AtlasImageFAB from a canvas element
   * @param {HTMLCanvasElement} canvas - Canvas element containing atlas
   * @returns {AtlasImageFAB} New AtlasImageFAB instance
   */
  static createFromCanvas(canvas) {
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
      throw new Error('AtlasImageFAB.createFromCanvas requires HTMLCanvasElement');
    }

    // Create a copy of the canvas to prevent DOM modifications from affecting stored data
    const canvasCopy = document.createElement('canvas');
    canvasCopy.width = canvas.width;
    canvasCopy.height = canvas.height;
    const ctx = canvasCopy.getContext('2d');
    ctx.drawImage(canvas, 0, 0);

    return new AtlasImageFAB(canvasCopy);
  }

  /**
   * Create AtlasImageFAB from base64 image data
   * @param {string} base64Data - Base64 encoded image data (with or without data URL prefix)
   * @param {Function} canvasFactory - Optional canvas factory for Node.js environments
   * @returns {Promise<AtlasImageFAB>} Promise resolving to AtlasImageFAB instance
   */
  static createFromBase64(base64Data, canvasFactory = null) {
    return new Promise((resolve, reject) => {
      if (!base64Data || typeof base64Data !== 'string') {
        reject(new Error('AtlasImageFAB.createFromBase64 requires base64 string'));
        return;
      }

      // Handle data URL format: data:image/png;base64,iVBORw0KGg...
      const base64Only = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
      const dataURL = base64Data.startsWith('data:') ? base64Data : `data:image/png;base64,${base64Only}`;

      const img = new Image();
      img.onload = () => {
        try {
          const atlasImageFAB = new AtlasImageFAB(img);
          resolve(atlasImageFAB);
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = () => {
        reject(new Error('Failed to load image from base64 data'));
      };
      img.src = dataURL;
    });
  }

  /**
   * Create AtlasImageFAB from image URL
   * @param {string} url - URL to image file
   * @returns {Promise<AtlasImageFAB>} Promise resolving to AtlasImageFAB instance
   */
  static createFromURL(url) {
    return new Promise((resolve, reject) => {
      if (!url || typeof url !== 'string') {
        reject(new Error('AtlasImageFAB.createFromURL requires URL string'));
        return;
      }

      const img = new Image();
      img.onload = () => {
        try {
          const atlasImageFAB = new AtlasImageFAB(img);
          resolve(atlasImageFAB);
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = () => {
        reject(new Error(`Failed to load image from URL: ${url}`));
      };
      img.src = url;
    });
  }

  /**
   * Convert the atlas image to base64 format
   * @param {string} format - Image format ('png', 'jpeg', 'webp')
   * @param {number} quality - Image quality for lossy formats (0-1)
   * @returns {string} Base64 encoded image data (without data URL prefix)
   */
  toBase64(format = 'png', quality = 0.92) {
    const canvas = this.toCanvas();
    const dataURL = canvas.toDataURL(`image/${format}`, quality);
    // Return just the base64 part, without the data URL prefix
    return dataURL.split(',')[1];
  }

  /**
   * Convert the atlas image to a canvas element
   * @returns {HTMLCanvasElement} Canvas containing the atlas image
   */
  toCanvas() {
    // If already a canvas, return it
    if (this.getImageType() === 'canvas') {
      return this._image;
    }

    // Create new canvas and draw the image onto it
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(this._image, 0, 0);
    return canvas;
  }

  /**
   * Export to PNG format as base64
   * @returns {string} Base64 encoded PNG data
   */
  toPNG() {
    return this.toBase64('png');
  }

  /**
   * Export to QOI format (if QOI encoder is available)
   * @returns {Uint8Array|null} QOI encoded data or null if encoder not available
   */
  toQOI() {
    // Check if QOI encoder is available
    if (typeof QOIEncode === 'undefined') {
      console.warn('QOI encoder not available - cannot export to QOI format');
      return null;
    }

    const canvas = this.toCanvas();
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // QOI expects RGBA data
    return QOIEncode(imageData.data, canvas.width, canvas.height, 4, 0);
  }

  /**
   * Create a copy of this atlas image
   * @returns {AtlasImageFAB} New AtlasImageFAB instance with copied image data
   */
  clone() {
    const canvas = this.toCanvas();
    return new AtlasImageFAB(canvas);
  }

  /**
   * Resize the atlas image to new dimensions
   * @param {number} newWidth - New width in pixels
   * @param {number} newHeight - New height in pixels
   * @param {string} method - Resize method ('nearest', 'bilinear')
   * @returns {AtlasImageFAB} New resized AtlasImageFAB instance
   */
  resize(newWidth, newHeight, method = 'bilinear') {
    const canvas = document.createElement('canvas');
    canvas.width = newWidth;
    canvas.height = newHeight;
    const ctx = canvas.getContext('2d');

    // Set image smoothing based on resize method
    ctx.imageSmoothingEnabled = method !== 'nearest';

    ctx.drawImage(this._image, 0, 0, newWidth, newHeight);
    return new AtlasImageFAB(canvas);
  }

  /**
   * Apply pixel density scaling to the atlas image
   * @param {number} pixelDensity - Pixel density multiplier
   * @returns {AtlasImageFAB} New scaled AtlasImageFAB instance
   */
  scaleForPixelDensity(pixelDensity) {
    if (pixelDensity === 1) return this;

    const newWidth = Math.round(this.width * pixelDensity);
    const newHeight = Math.round(this.height * pixelDensity);
    return this.resize(newWidth, newHeight, 'bilinear');
  }

  /**
   * Extract a clean AtlasImage instance for runtime use
   * @returns {AtlasImage} Immutable AtlasImage instance
   */
  extractAtlasImageInstance() {
    return new AtlasImage(this.image);
  }

  /**
   * Validate atlas image for font rendering
   * @returns {Object} Validation result with success flag and issues
   */
  validateForRendering() {
    const issues = [];

    if (!this.isValid()) {
      issues.push('Image has invalid dimensions');
    }

    if (!this.canRender()) {
      issues.push('Image is not ready for rendering');
    }

    if (this.width > 4096 || this.height > 4096) {
      issues.push('Image dimensions exceed recommended maximum (4096px)');
    }

    if (this.width < 32 || this.height < 32) {
      issues.push('Image dimensions below recommended minimum (32px)');
    }

    const aspectRatio = this.width / this.height;
    if (aspectRatio > 8 || aspectRatio < 0.125) {
      issues.push('Unusual aspect ratio detected');
    }

    return {
      success: issues.length === 0,
      issues: issues
    };
  }

  /**
   * Get detailed information about this atlas image for debugging
   * @returns {Object} Extended debug information
   */
  getDebugInfo() {
    const baseInfo = super.getDebugInfo();
    const validation = this.validateForRendering();

    return {
      ...baseInfo,
      validation: validation,
      memoryUsage: this.width * this.height * 4, // RGBA bytes
      aspectRatio: this.width / this.height
    };
  }
}