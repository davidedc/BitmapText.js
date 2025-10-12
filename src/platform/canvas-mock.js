// Canvas Mock - Minimal HTML Canvas API Implementation
//
// This module provides a lightweight Canvas API implementation for Node.js
// environments where node-canvas is not available or desired. It implements
// only the subset of Canvas API methods required by BitmapText.js.
//
// DISTRIBUTION ROLE:
// - Only included in Node.js distributions
// - Excluded from browser bundles via build scripts
// - Used as fallback when node-canvas is unavailable
//
// ARCHITECTURE:
// - Three classes: Canvas, Context2D, and Image
// - Pure JavaScript pixel manipulation using Uint8ClampedArray
// - No external dependencies (no node-canvas, no Sharp, no Jimp)
// - Implements minimal Canvas API surface needed for font rendering
//
// SUPPORTED CANVAS API SUBSET:
// - Canvas: width, height properties, getContext('2d')
// - Context2D: fillStyle, globalCompositeOperation, fillRect, clearRect,
//   drawImage, createImageData, putImageData, getImageData
// - Image: width, height, data properties
//
// LIMITATIONS COMPARED TO REAL CANVAS:
// - No anti-aliasing or bilinear filtering (nearest-neighbor only)
// - Limited color format support (hex colors and named 'black'/'white')
// - No text rendering (fillText is stub)
// - No path operations (moveTo, lineTo, stroke, etc.)
// - No gradients or patterns
// - Only 'source-over' and 'source-in' composite operations
// - No image format encoding (no PNG/JPEG output)
// - drawImage supports only 3-argument, 5-argument, and 9-argument forms
//
// PERFORMANCE CONSIDERATIONS:
// - Pure JavaScript pixel operations are slower than native implementations
// - Best suited for small images and simple operations
// - For production Node.js use, prefer node-canvas when available

// ============================================
// Canvas Class - Minimal Canvas Element Mock
// ============================================

/**
 * Canvas - Minimal HTML Canvas element implementation
 *
 * Provides a basic canvas with width/height properties and pixel buffer.
 * The pixel buffer is a Uint8ClampedArray in RGBA format (4 bytes per pixel).
 *
 * @class Canvas
 */
class Canvas {
  constructor() {
    this._width = 0;
    this._height = 0;
    this.data = null;
  }
  
  get width() { return this._width; }
  set width(w) {
    this._width = w;
    this._updateBuffer();
  }
  
  get height() { return this._height; }
  set height(h) {
    this._height = h;
    this._updateBuffer();
  }
  
  /**
   * Update internal pixel buffer when dimensions change
   * @private
   */
  _updateBuffer() {
    if (this._width > 0 && this._height > 0) {
      this.data = new Uint8ClampedArray(this._width * this._height * 4);
    }
  }

  /**
   * Get rendering context (only '2d' is supported)
   * @param {string} type - Context type ('2d' is the only supported value)
   * @returns {Context2D|null} 2D rendering context or null if unsupported type
   */
  getContext(type) {
    if (type === '2d') {
      return new Context2D(this);
    }
    return null;
  }
}

// ============================================
// Context2D Class - Canvas 2D Rendering Context
// ============================================

/**
 * Context2D - Minimal CanvasRenderingContext2D implementation
 *
 * Provides basic 2D drawing operations for font rendering. Supports
 * rectangular operations, image drawing, and pixel data manipulation.
 * Does not support paths, text rendering, or advanced compositing.
 *
 * @class Context2D
 */
class Context2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.fillStyle = '#000000';
    this.globalCompositeOperation = 'source-over';
  }

  // ============================================
  // Rectangle Operations
  // ============================================

  /**
   * Clear a rectangular area to transparent black
   * @param {number} x - X coordinate of rectangle top-left corner
   * @param {number} y - Y coordinate of rectangle top-left corner
   * @param {number} w - Rectangle width
   * @param {number} h - Rectangle height
   */
  clearRect(x, y, w, h) {
    if (!this.canvas.data) return;
    
    const data = this.canvas.data;
    const canvasWidth = this.canvas.width;
    
    for (let py = Math.max(0, y); py < Math.min(this.canvas.height, y + h); py++) {
      for (let px = Math.max(0, x); px < Math.min(canvasWidth, x + w); px++) {
        const i = (py * canvasWidth + px) * 4;
        data[i] = data[i+1] = data[i+2] = data[i+3] = 0;
      }
    }
  }

  /**
   * Fill a rectangular area with the current fillStyle
   *
   * Supports two composite operations:
   * - 'source-over': Normal fill (replaces pixels with fillStyle)
   * - 'source-in': Preserve alpha channel, only change RGB channels
   *                (used for colorizing glyph masks)
   *
   * @param {number} x - X coordinate of rectangle top-left corner
   * @param {number} y - Y coordinate of rectangle top-left corner
   * @param {number} w - Rectangle width
   * @param {number} h - Rectangle height
   */
  fillRect(x, y, w, h) {
    if (!this.canvas.data) return;

    const data = this.canvas.data;
    const canvasWidth = this.canvas.width;
    const [r, g, b] = this._parseColor(this.fillStyle);

    // Canvas coordinates must be integers (callers should round before calling)
    // Clamp to canvas bounds
    const x0 = Math.max(0, x);
    const y0 = Math.max(0, y);
    const x1 = Math.min(canvasWidth, x + w);
    const y1 = Math.min(this.canvas.height, y + h);

    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const i = (py * canvasWidth + px) * 4;

        if (this.globalCompositeOperation === 'source-in') {
          // 'source-in' composite operation: Only fill where destination alpha > 0
          // This preserves the alpha channel (glyph shape) while changing the color.
          // Used by BitmapText to colorize white glyph masks with desired text color.
          if (data[i+3] > 0) {
            data[i] = r;
            data[i+1] = g;
            data[i+2] = b;
            // Keep existing alpha value (don't modify data[i+3])
          }
        } else {
          // 'source-over': Normal fill operation (default)
          data[i] = r;
          data[i+1] = g;
          data[i+2] = b;
          data[i+3] = 255;
        }
      }
    }
  }

  // ============================================
  // Composite Operation Property
  // ============================================

  /**
   * Set global composite operation (getter/setter handled by direct property access)
   *
   * Supported operations:
   * - 'source-over': Default - new pixels replace old pixels
   * - 'source-in': New pixels only drawn where destination alpha > 0,
   *                preserving destination alpha (used for colorization)
   *
   * @type {string}
   */
  // Note: globalCompositeOperation is set directly as a property in constructor

  // ============================================
  // Image Drawing
  // ============================================

  /**
   * Draw an image onto the canvas with optional scaling and clipping
   *
   * Supports three call signatures:
   * 1. drawImage(image, dx, dy) - Draw at position without scaling
   * 2. drawImage(image, dx, dy, dw, dh) - Draw scaled to fit rectangle
   * 3. drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh) - Draw clipped source region
   *
   * Uses nearest-neighbor sampling for scaling (no bilinear filtering).
   * This is faster but produces pixelated results when scaling.
   * Sufficient for bitmap font rendering where glyphs are drawn at original size.
   *
   * @param {Image|Canvas} image - Source image or canvas
   * @param {number} sx - Source X (or dx in 3-arg form)
   * @param {number} sy - Source Y (or dy in 3-arg form)
   * @param {number} sw - Source width (or dw in 5-arg form)
   * @param {number} sh - Source height (or dh in 5-arg form)
   * @param {number} dx - Destination X
   * @param {number} dy - Destination Y
   * @param {number} dw - Destination width
   * @param {number} dh - Destination height
   */
  drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh) {
    if (!this.canvas.data || !image.data) return;
    
    // Handle different call signatures by reassigning parameters
    // JavaScript allows flexible parameter handling through arguments.length
    if (arguments.length === 5) {
      // 5-argument form: drawImage(image, dx, dy, dw, dh)
      // Parameters are shifted: sx->dw, sy->dh, sw->dx, sh->dy
      dw = sx; dh = sy; dx = sw; dy = sh;
      sx = 0; sy = 0; sw = image.width; sh = image.height;
    } else if (arguments.length === 3) {
      // 3-argument form: drawImage(image, dx, dy)
      // Parameters are shifted: sx->dx, sy->dy
      dx = sx; dy = sy;
      sx = 0; sy = 0; sw = image.width; sh = image.height;
      dw = sw; dh = sh;
    }
    // 9-argument form uses parameters as-is (no reassignment needed)
    
    const destData = this.canvas.data;
    const srcData = image.data;
    const destWidth = this.canvas.width;
    const srcWidth = image.width;

    // Nearest-neighbor sampling (no bilinear filtering)
    // This is the simplest scaling algorithm: for each destination pixel,
    // find the closest source pixel and copy its color. Fast but produces
    // pixelated results when scaling up. For bitmap fonts, glyphs are typically
    // drawn at original size, so scaling artifacts are rarely visible.
    for (let y = 0; y < dh; y++) {
      for (let x = 0; x < dw; x++) {
        const srcX = Math.floor(sx + (x * sw / dw));
        const srcY = Math.floor(sy + (y * sh / dh));
        const destX = dx + x;
        const destY = dy + y;
        
        if (srcX >= 0 && srcX < image.width && srcY >= 0 && srcY < image.height &&
            destX >= 0 && destX < this.canvas.width && destY >= 0 && destY < this.canvas.height) {
          
          const srcI = (srcY * srcWidth + srcX) * 4;
          const destI = (destY * destWidth + destX) * 4;
          
          if (srcData[srcI + 3] > 0) {  // Only copy non-transparent pixels
            destData[destI] = srcData[srcI];     // R
            destData[destI + 1] = srcData[srcI + 1]; // G
            destData[destI + 2] = srcData[srcI + 2]; // B
            destData[destI + 3] = srcData[srcI + 3]; // A
          }
        }
      }
    }
  }

  // ============================================
  // Image Data Operations
  // ============================================

  /**
   * Create a new ImageData object with specified dimensions
   * @param {number} w - Width in pixels
   * @param {number} h - Height in pixels
   * @returns {Object} ImageData object with width, height, and data properties
   */
  createImageData(w, h) {
    return {
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4)
    };
  }

  /**
   * Write ImageData directly to canvas at specified position
   *
   * Copies pixel data from ImageData object to canvas buffer.
   * Ignores composite operations and alpha blending - raw pixel copy.
   *
   * @param {Object} imageData - ImageData object with width, height, and data
   * @param {number} dx - Destination X coordinate
   * @param {number} dy - Destination Y coordinate
   */
  putImageData(imageData, dx, dy) {
    if (!this.canvas.data) return;

    const canvasData = this.canvas.data;
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;
    const srcData = imageData.data;
    const srcWidth = imageData.width;
    const srcHeight = imageData.height;

    for (let y = 0; y < srcHeight; y++) {
      for (let x = 0; x < srcWidth; x++) {
        const destX = dx + x;
        const destY = dy + y;

        if (destX >= 0 && destX < canvasWidth && destY >= 0 && destY < canvasHeight) {
          const srcI = (y * srcWidth + x) * 4;
          const destI = (destY * canvasWidth + destX) * 4;

          canvasData[destI] = srcData[srcI];
          canvasData[destI + 1] = srcData[srcI + 1];
          canvasData[destI + 2] = srcData[srcI + 2];
          canvasData[destI + 3] = srcData[srcI + 3];
        }
      }
    }
  }

  /**
   * Extract pixel data from canvas as ImageData object
   *
   * Reads a rectangular region from the canvas and returns it as an
   * ImageData object. Pixels outside canvas bounds are transparent black.
   *
   * @param {number} x - Source X coordinate
   * @param {number} y - Source Y coordinate
   * @param {number} w - Width of region to extract
   * @param {number} h - Height of region to extract
   * @returns {Object} ImageData object containing the extracted pixels
   */
  getImageData(x, y, w, h) {
    if (!this.canvas.data) {
      return {
        width: w,
        height: h,
        data: new Uint8ClampedArray(w * h * 4)
      };
    }

    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;
    const canvasData = this.canvas.data;
    const imageData = new Uint8ClampedArray(w * h * 4);

    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const srcX = x + px;
        const srcY = y + py;

        if (srcX >= 0 && srcX < canvasWidth && srcY >= 0 && srcY < canvasHeight) {
          const srcI = (srcY * canvasWidth + srcX) * 4;
          const destI = (py * w + px) * 4;

          imageData[destI] = canvasData[srcI];
          imageData[destI + 1] = canvasData[srcI + 1];
          imageData[destI + 2] = canvasData[srcI + 2];
          imageData[destI + 3] = canvasData[srcI + 3];
        }
      }
    }

    return {
      width: w,
      height: h,
      data: imageData
    };
  }

  // ============================================
  // Color Parsing Utilities
  // ============================================

  /**
   * Parse color string to RGB values
   *
   * Supports limited color format subset:
   * - Named colors: 'white', 'black'
   * - Hex colors: '#RRGGBB' (6-digit hex)
   * - Unsupported formats default to black
   *
   * Does not support:
   * - Short hex (#RGB)
   * - rgba() or rgb() functions
   * - hsl() colors
   * - Other named colors
   *
   * @private
   * @param {string} color - Color string to parse
   * @returns {number[]} RGB values as [r, g, b] array (0-255 range)
   */
  _parseColor(color) {
    if (color === 'white') return [255, 255, 255];
    if (color === 'black' || color === '#000000') return [0, 0, 0];

    // Simple hex parsing
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      if (hex.length === 6) {
        return [
          parseInt(hex.slice(0, 2), 16),
          parseInt(hex.slice(2, 4), 16),
          parseInt(hex.slice(4, 6), 16)
        ];
      }
    }

    return [0, 0, 0]; // Default to black
  }
}

// ============================================
// Image Class - Decoded Image Container
// ============================================

/**
 * Image - Simple container for decoded image pixel data
 *
 * Holds decoded image data in RGBA format. Unlike browser Image objects,
 * this does not support loading from URLs or file paths - pixel data
 * must be provided directly during construction.
 *
 * @class Image
 */
class Image {
  /**
   * Create a new Image with pixel data
   * @param {number} width - Image width in pixels
   * @param {number} height - Image height in pixels
   * @param {Uint8ClampedArray} data - Pixel data in RGBA format (4 bytes per pixel)
   */
  constructor(width, height, data) {
    this.width = width;
    this.height = height;
    this.data = data;
  }
}