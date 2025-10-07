// MINIMAL CANVAS MOCK - Only what BitmapText.js needs

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
  
  _updateBuffer() {
    if (this._width > 0 && this._height > 0) {
      this.data = new Uint8ClampedArray(this._width * this._height * 4);
    }
  }
  
  getContext(type) {
    if (type === '2d') {
      return new Context2D(this);
    }
    return null;
  }
}

class Context2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.fillStyle = '#000000';
    this.globalCompositeOperation = 'source-over';
  }
  
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
  
  fillRect(x, y, w, h) {
    if (!this.canvas.data) return;

    const data = this.canvas.data;
    const canvasWidth = this.canvas.width;
    const [r, g, b] = this._parseColor(this.fillStyle);

    // Floor coordinates to integers (canvas uses integer pixel coordinates)
    // This is critical for placeholder rectangles which pass floating-point coordinates
    const x0 = Math.floor(Math.max(0, x));
    const y0 = Math.floor(Math.max(0, y));
    const x1 = Math.floor(Math.min(canvasWidth, x + w));
    const y1 = Math.floor(Math.min(this.canvas.height, y + h));

    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const i = (py * canvasWidth + px) * 4;

        if (this.globalCompositeOperation === 'source-in') {
          // Only fill where alpha > 0 (preserve alpha, change color)
          if (data[i+3] > 0) {
            data[i] = r;
            data[i+1] = g;
            data[i+2] = b;
            // Keep existing alpha value
          }
        } else {
          // source-over: normal fill
          data[i] = r;
          data[i+1] = g;
          data[i+2] = b;
          data[i+3] = 255;
        }
      }
    }
  }
  
  drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh) {
    if (!this.canvas.data || !image.data) return;
    
    // Handle different call signatures
    if (arguments.length === 5) {
      // drawImage(image, dx, dy, dw, dh) - scale to fit
      dw = sx; dh = sy; dx = sw; dy = sh;
      sx = 0; sy = 0; sw = image.width; sh = image.height;
    } else if (arguments.length === 3) {
      // drawImage(image, dx, dy) - no scaling
      dx = sx; dy = sy;
      sx = 0; sy = 0; sw = image.width; sh = image.height;
      dw = sw; dh = sh;
    }
    
    const destData = this.canvas.data;
    const srcData = image.data;
    const destWidth = this.canvas.width;
    const srcWidth = image.width;
    
    // Simple nearest-neighbor sampling
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

// Simple Image class for holding decoded data
class Image {
  constructor(width, height, data) {
    this.width = width;
    this.height = height;
    this.data = data;
  }
}