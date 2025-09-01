#!/usr/bin/env node

/**
 * BitmapText.js Node.js Demo
 * 
 * Renders "Hello World" using bitmap fonts, loads QOI glyph sheet,
 * and exports as uncompressed PNG. Single file with all dependencies.
 * 
 * Usage:
 *   node examples/node/hello-world-node.js
 * 
 * Output:
 *   hello-world-output.png (in current directory)
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// MINIMAL CANVAS MOCK - Only what BitmapText.js needs
// ============================================================================

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
    
    for (let py = Math.max(0, y); py < Math.min(this.canvas.height, y + h); py++) {
      for (let px = Math.max(0, x); px < Math.min(canvasWidth, x + w); px++) {
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
  
  drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh) {
    if (!this.canvas.data || !source.data) return;
    
    // Handle different drawImage signatures
    if (arguments.length === 3) {
      // drawImage(image, dx, dy)
      dx = sx; dy = sy;
      sx = sy = 0;
      sw = dw = source.width;
      sh = dh = source.height;
    } else if (arguments.length === 5) {
      // drawImage(image, dx, dy, dw, dh)
      dw = sw; dh = sh;
      sw = dx; sh = dy;
      dx = sx; dy = sy;
      sx = sy = 0;
    }
    
    const srcData = source.data;
    const dstData = this.canvas.data;
    const srcWidth = source.width;
    const dstWidth = this.canvas.width;
    
    // Simple pixel copy (no scaling - assumes dw==sw, dh==sh)
    for (let y = 0; y < sh && y + dy < this.canvas.height; y++) {
      for (let x = 0; x < sw && x + dx < dstWidth; x++) {
        const srcI = ((sy + y) * srcWidth + (sx + x)) * 4;
        const dstI = ((dy + y) * dstWidth + (dx + x)) * 4;
        
        if (srcI >= 0 && srcI < srcData.length - 3 && dstI >= 0 && dstI < dstData.length - 3) {
          if (this.globalCompositeOperation === 'source-over') {
            // Standard alpha blending
            const srcAlpha = srcData[srcI + 3] / 255;
            const dstAlpha = dstData[dstI + 3] / 255;
            const outAlpha = srcAlpha + dstAlpha * (1 - srcAlpha);
            
            if (outAlpha > 0) {
              dstData[dstI] = (srcData[srcI] * srcAlpha + dstData[dstI] * dstAlpha * (1 - srcAlpha)) / outAlpha;
              dstData[dstI+1] = (srcData[srcI+1] * srcAlpha + dstData[dstI+1] * dstAlpha * (1 - srcAlpha)) / outAlpha;
              dstData[dstI+2] = (srcData[srcI+2] * srcAlpha + dstData[dstI+2] * dstAlpha * (1 - srcAlpha)) / outAlpha;
              dstData[dstI+3] = outAlpha * 255;
            }
          }
        }
      }
    }
  }
  
  _parseColor(color) {
    // Simple color parser
    if (color === 'black') return [0, 0, 0];
    if (color === 'white') return [255, 255, 255];
    if (color && color[0] === '#' && color.length === 7) {
      return [
        parseInt(color.substr(1,2), 16),
        parseInt(color.substr(3,2), 16),
        parseInt(color.substr(5,2), 16)
      ];
    }
    return [0, 0, 0];
  }
}

class Image {
  constructor(width, height, data) {
    this.width = width;
    this.height = height;
    this.data = data; // Uint8ClampedArray from QOI decode
  }
}

// ============================================================================
// UTILITY FUNCTIONS - nested-properties.js
// ============================================================================

function ensureNestedPropertiesExist(obj, properties) {
    let current = obj;
    for (let prop of properties) {
        if (current[prop] === undefined) {
            current[prop] = {};
        }
        current = current[prop];
    }
}

function getNestedProperty(obj, properties) {
    let current = obj;
    for (let prop of properties) {
        if (current[prop] === undefined) {
            return undefined;
        }
        current = current[prop];
    }
    return current;
}

function setNestedProperty(obj, properties, value) {
    if (properties.length === 0) return;
    
    let current = obj;
    for (let i = 0; i < properties.length - 1; i++) {
        let prop = properties[i];
        if (current[prop] === undefined) {
            current[prop] = {};
        }
        current = current[prop];
    }
    current[properties[properties.length - 1]] = value;
}

function checkNestedPropertiesExist(obj, properties) {
    let current = obj;
    for (let prop of properties) {
        if (current[prop] === undefined) {
            return false;
        }
        current = current[prop];
    }
    return true;
}

// ============================================================================
// DECOMPRESSION UTILITY - decompress.js
// ============================================================================

function decompressFontMetrics(compressed) {
  // Decompress kerning table
  const kerningTable = {};
  Object.entries(compressed.k).forEach(([char, values]) => {
    kerningTable[char] = values;
  });

  // Decompress glyph metrics
  const glyphsTextMetrics = {};
  Object.entries(compressed.g).forEach(([char, metrics]) => {
    glyphsTextMetrics[char] = {
      width: metrics[0],
      actualBoundingBoxLeft: metrics[1],
      actualBoundingBoxRight: metrics[2],
      actualBoundingBoxAscent: metrics[3],
      actualBoundingBoxDescent: metrics[4],
      fontBoundingBoxAscent: compressed.b.fba,
      fontBoundingBoxDescent: compressed.b.fbd,
      emHeightAscent: compressed.b.fba,
      emHeightDescent: compressed.b.fbd,
      hangingBaseline: compressed.b.hb,
      alphabeticBaseline: compressed.b.ab,
      ideographicBaseline: compressed.b.ib
    };
  });

  // Decompress tight metrics
  const glyphSheetsMetrics = {
    tightWidth: compressed.t.w,
    tightHeight: compressed.t.h,
    dx: compressed.t.dx,
    dy: compressed.t.dy,
    xInGlyphSheet: compressed.t.x
  };

  return {
    kerningTable,
    glyphsTextMetrics,
    spaceAdvancementOverrideForSmallSizesInPx: compressed.s,
    glyphSheetsMetrics
  };
}

// ============================================================================
// QOI DECODER - QOIDecode.js
// ============================================================================

function QOIDecode (arrayBuffer, byteOffset, byteLength, outputChannels) {
    if (typeof byteOffset === 'undefined' || byteOffset === null) {
        byteOffset = 0;
    }

    if (typeof byteLength === 'undefined' || byteLength === null) {
        byteLength = arrayBuffer.byteLength - byteOffset;
    }

    const uint8 = new Uint8Array(arrayBuffer, byteOffset, byteLength);

    const magic1 = uint8[0];
    const magic2 = uint8[1];
    const magic3 = uint8[2];
    const magic4 = uint8[3];

    const width = ((uint8[4] << 24) | (uint8[5] << 16) | (uint8[6] << 8) | uint8[7]) >>> 0;
    const height = ((uint8[8] << 24) | (uint8[9] << 16) | (uint8[10] << 8) | uint8[11]) >>> 0;

    const channels = uint8[12];
    const colorspace = uint8[13];

    if (typeof outputChannels === 'undefined' || outputChannels === null) {
        outputChannels = channels;
    }

    if (magic1 !== 0x71 || magic2 !== 0x6F || magic3 !== 0x69 || magic4 !== 0x66) {
        throw new Error('QOI.decode: The signature of the QOI file is invalid');
    }

    if (channels < 3 || channels > 4) {
        throw new Error('QOI.decode: The number of channels declared in the file is invalid');
    }

    if (colorspace > 1) {
        throw new Error('QOI.decode: The colorspace declared in the file is invalid');
    }

    if (outputChannels < 3 || outputChannels > 4) {
        throw new Error('QOI.decode: The number of channels for the output is invalid');
    }

    const pixelLength = width * height * outputChannels;
    const result = new Uint8Array(pixelLength);

    let arrayPosition = 14;

    const index = new Uint8Array(64 * 4);
    let indexPosition = 0;

    let red = 0;
    let green = 0;
    let blue = 0;
    let alpha = 255;

    const chunksLength = byteLength - 8;

    let run = 0;
    let pixelPosition = 0;

    for (; pixelPosition < pixelLength && arrayPosition < byteLength - 4; pixelPosition += outputChannels) {
        if (run > 0) {
            run--;
        } else if (arrayPosition < chunksLength) {
            const byte1 = uint8[arrayPosition++];

            if (byte1 === 0b11111110) { // QOI_OP_RGB
                red = uint8[arrayPosition++];
                green = uint8[arrayPosition++];
                blue = uint8[arrayPosition++];
            } else if (byte1 === 0b11111111) { // QOI_OP_RGBA
                red = uint8[arrayPosition++];
                green = uint8[arrayPosition++];
                blue = uint8[arrayPosition++];
                alpha = uint8[arrayPosition++];
            } else if ((byte1 & 0b11000000) === 0b00000000) { // QOI_OP_INDEX
                red = index[byte1 * 4];
                green = index[byte1 * 4 + 1];
                blue = index[byte1 * 4 + 2];
                alpha = index[byte1 * 4 + 3];
            } else if ((byte1 & 0b11000000) === 0b01000000) { // QOI_OP_DIFF
                red += ((byte1 >> 4) & 0b00000011) - 2;
                green += ((byte1 >> 2) & 0b00000011) - 2;
                blue += (byte1 & 0b00000011) - 2;

                // handle wraparound
                red = (red + 256) % 256;
                green = (green + 256) % 256;
                blue = (blue + 256) % 256;
            } else if ((byte1 & 0b11000000) === 0b10000000) { // QOI_OP_LUMA
                const byte2 = uint8[arrayPosition++];
                const greenDiff = (byte1 & 0b00111111) - 32;
                const redDiff = greenDiff + ((byte2 >> 4) & 0b00001111) - 8;
                const blueDiff = greenDiff + (byte2 & 0b00001111) - 8;

                // handle wraparound
                red = (red + redDiff + 256) % 256;
                green = (green + greenDiff + 256) % 256;
                blue = (blue + blueDiff + 256) % 256;
            } else if ((byte1 & 0b11000000) === 0b11000000) { // QOI_OP_RUN
                run = byte1 & 0b00111111;
            }

            indexPosition = ((red * 3 + green * 5 + blue * 7 + alpha * 11) % 64) * 4;
            index[indexPosition] = red;
            index[indexPosition + 1] = green;
            index[indexPosition + 2] = blue;
            index[indexPosition + 3] = alpha;
        }

        if (outputChannels === 4) { // RGBA
            result[pixelPosition] = red;
            result[pixelPosition + 1] = green;
            result[pixelPosition + 2] = blue;
            result[pixelPosition + 3] = alpha;
        } else { // RGB
            result[pixelPosition] = red;
            result[pixelPosition + 1] = green;
            result[pixelPosition + 2] = blue;
        }
    }

    if (pixelPosition < pixelLength) {
        throw new Error('QOI.decode: Incomplete image');
    }

    // checking the 00000001 padding is not required, as per specs

    return {
        width: width,
        height: height,
        colorspace: colorspace,
        channels: outputChannels,
        data: result
    };
}

// ============================================================================
// PNG ENCODING OPTIONS - PngEncodingOptions.js
// ============================================================================

class PngEncodingOptions {
    constructor(config = {}) {
        const {
            preserveTransparency = true,
            compressionLevel = 0
        } = config;
        
        if (typeof preserveTransparency !== 'boolean') {
            throw new Error('preserveTransparency must be a boolean');
        }
        
        if (typeof compressionLevel !== 'number' || compressionLevel < 0 || compressionLevel > 9) {
            throw new Error('compressionLevel must be a number between 0-9');
        }
        
        if (compressionLevel !== 0) {
            throw new Error('Only compression level 0 (no compression) is currently supported');
        }
        
        this._config = Object.freeze({
            preserveTransparency,
            compressionLevel
        });
        
        Object.freeze(this);
    }
    
    get preserveTransparency() {
        return this._config.preserveTransparency;
    }
    
    get compressionLevel() {
        return this._config.compressionLevel;
    }
    
    static withDefaults() {
        return new PngEncodingOptions();
    }
    
    static withTransparency() {
        return new PngEncodingOptions({ preserveTransparency: true });
    }
    
    static withoutTransparency() {
        return new PngEncodingOptions({ preserveTransparency: false });
    }
    
    static withCompressionLevel(level) {
        return new PngEncodingOptions({ compressionLevel: level });
    }
    
    static forMaximumCompatibility() {
        return new PngEncodingOptions({
            preserveTransparency: true,
            compressionLevel: 0
        });
    }
    
    equals(other) {
        if (!(other instanceof PngEncodingOptions)) {
            return false;
        }
        
        const config1 = this._config;
        const config2 = other._config;
        
        return config1.preserveTransparency === config2.preserveTransparency &&
               config1.compressionLevel === config2.compressionLevel;
    }
    
    toString() {
        const config = this._config;
        return `PngEncodingOptions(transparency: ${config.preserveTransparency}, compression: ${config.compressionLevel})`;
    }
    
    withTransparency(preserveTransparency) {
        return new PngEncodingOptions({
            preserveTransparency,
            compressionLevel: this._config.compressionLevel
        });
    }
    
    withCompression(compressionLevel) {
        return new PngEncodingOptions({
            preserveTransparency: this._config.preserveTransparency,
            compressionLevel
        });
    }
}

// Default options instance
PngEncodingOptions.DEFAULT = new PngEncodingOptions();

// ============================================================================
// PNG ENCODER - PngEncoder.js
// ============================================================================

class PngEncoder {
    static encode(surface, options = PngEncodingOptions.DEFAULT) {
        if (!surface || typeof surface !== 'object') {
            throw new Error('Surface must be a valid Surface object');
        }
        
        if (!surface.width || !surface.height || !surface.data) {
            throw new Error('Surface must have width, height, and data properties');
        }
        
        const width = surface.width;
        const height = surface.height;
        const data = surface.data;
        
        const expectedSize = width * height * 4;
        if (data.length !== expectedSize) {
            throw new Error(`Surface data size mismatch. Expected ${expectedSize}, got ${data.length}`);
        }
        
        if (width <= 0 || height <= 0) {
            throw new Error('Surface dimensions must be positive');
        }
        
        if (width > PngEncoder.MAX_DIMENSION || height > PngEncoder.MAX_DIMENSION) {
            throw new Error(`Surface dimensions must be ≤ ${PngEncoder.MAX_DIMENSION}x${PngEncoder.MAX_DIMENSION}`);
        }
        
        const scanlines = PngEncoder._createScanlines(width, height, data);
        const zlibData = PngEncoder._createZlibData(scanlines);
        
        const signature = PngEncoder._createSignature();
        const ihdrChunk = PngEncoder._createIHDRChunk(width, height);
        const idatChunk = PngEncoder._createIDATChunk(zlibData);
        const iendChunk = PngEncoder._createIENDChunk();
        
        const totalLength = signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length;
        const result = new Uint8Array(totalLength);
        
        let offset = 0;
        result.set(signature, offset);
        offset += signature.length;
        result.set(ihdrChunk, offset);
        offset += ihdrChunk.length;
        result.set(idatChunk, offset);
        offset += idatChunk.length;
        result.set(iendChunk, offset);
        
        return result.buffer;
    }
    
    static _createSignature() {
        return new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    }
    
    static _createScanlines(width, height, data) {
        const bytesPerPixel = 4;
        const stride = width * bytesPerPixel;
        const scanlineLength = stride + 1;
        const result = new Uint8Array(scanlineLength * height);
        
        let srcOffset = 0;
        let destOffset = 0;
        
        for (let y = 0; y < height; y++) {
            result[destOffset++] = 0;
            
            for (let x = 0; x < width; x++) {
                result[destOffset++] = data[srcOffset++];
                result[destOffset++] = data[srcOffset++];
                result[destOffset++] = data[srcOffset++];
                result[destOffset++] = data[srcOffset++];
            }
        }
        
        return result;
    }
    
    static _createZlibData(uncompressed) {
        const header = new Uint8Array([0x78, 0x01]);
        
        const blocks = [];
        const maxBlockSize = 65535;
        let offset = 0;
        
        while (offset < uncompressed.length) {
            const remaining = uncompressed.length - offset;
            const blockSize = Math.min(maxBlockSize, remaining);
            const isLastBlock = (offset + blockSize === uncompressed.length);
            
            const bfinal = isLastBlock ? 1 : 0;
            const blockHeader = new Uint8Array(5);
            blockHeader[0] = bfinal;
            
            blockHeader[1] = blockSize & 0xFF;
            blockHeader[2] = (blockSize >>> 8) & 0xFF;
            
            const nlen = (~blockSize) & 0xFFFF;
            blockHeader[3] = nlen & 0xFF;
            blockHeader[4] = (nlen >>> 8) & 0xFF;
            
            blocks.push(blockHeader);
            blocks.push(uncompressed.subarray(offset, offset + blockSize));
            
            offset += blockSize;
        }
        
        const adler32 = PngEncoder._calculateAdler32(uncompressed);
        const trailer = PngEncoder._u32be(adler32);
        
        let totalLength = header.length + trailer.length;
        for (const block of blocks) {
            totalLength += block.length;
        }
        
        const result = new Uint8Array(totalLength);
        let resultOffset = 0;
        
        result.set(header, resultOffset);
        resultOffset += header.length;
        
        for (const block of blocks) {
            result.set(block, resultOffset);
            resultOffset += block.length;
        }
        
        result.set(trailer, resultOffset);
        
        return result;
    }
    
    static _createIHDRChunk(width, height) {
        const data = new Uint8Array(13);
        
        const widthBytes = PngEncoder._u32be(width);
        data.set(widthBytes, 0);
        
        const heightBytes = PngEncoder._u32be(height);
        data.set(heightBytes, 4);
        
        data[8] = 8;    // Bit depth
        data[9] = 6;    // Color type: RGBA
        data[10] = 0;   // Compression method
        data[11] = 0;   // Filter method
        data[12] = 0;   // Interlace method
        
        return PngEncoder._createChunk('IHDR', data);
    }
    
    static _createIDATChunk(zlibData) {
        return PngEncoder._createChunk('IDAT', zlibData);
    }
    
    static _createIENDChunk() {
        return PngEncoder._createChunk('IEND', new Uint8Array(0));
    }
    
    static _createChunk(type, data) {
        if (type.length !== 4) {
            throw new Error('Chunk type must be exactly 4 characters');
        }
        
        const typeBytes = new TextEncoder().encode(type);
        const length = data.length;
        const lengthBytes = PngEncoder._u32be(length);
        
        const crcInput = new Uint8Array(typeBytes.length + data.length);
        crcInput.set(typeBytes, 0);
        crcInput.set(data, typeBytes.length);
        const crc = PngEncoder._calculateCRC32(crcInput);
        const crcBytes = PngEncoder._u32be(crc);
        
        const chunk = new Uint8Array(4 + 4 + length + 4);
        let offset = 0;
        
        chunk.set(lengthBytes, offset);
        offset += lengthBytes.length;
        chunk.set(typeBytes, offset);
        offset += typeBytes.length;
        chunk.set(data, offset);
        offset += data.length;
        chunk.set(crcBytes, offset);
        
        return chunk;
    }
    
    static _u32be(value) {
        const bytes = new Uint8Array(4);
        bytes[0] = (value >>> 24) & 0xFF;
        bytes[1] = (value >>> 16) & 0xFF;
        bytes[2] = (value >>> 8) & 0xFF;
        bytes[3] = value & 0xFF;
        return bytes;
    }
    
    static _calculateCRC32(data) {
        let crc = 0xFFFFFFFF;
        
        for (let i = 0; i < data.length; i++) {
            crc ^= data[i];
            
            for (let j = 0; j < 8; j++) {
                crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
            }
        }
        
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }
    
    static _calculateAdler32(data) {
        let s1 = 1;
        let s2 = 0;
        const MOD_ADLER = 65521;
        
        for (let i = 0; i < data.length; i++) {
            s1 = (s1 + data[i]) % MOD_ADLER;
            s2 = (s2 + s1) % MOD_ADLER;
        }
        
        return ((s2 << 16) | s1) >>> 0;
    }
    
    static canEncode(surface) {
        try {
            if (!surface || typeof surface !== 'object') return false;
            if (!surface.width || !surface.height || !surface.data) return false;
            if (surface.width <= 0 || surface.height <= 0) return false;
            if (surface.width > PngEncoder.MAX_DIMENSION || 
                surface.height > PngEncoder.MAX_DIMENSION) return false;
                
            const expectedSize = surface.width * surface.height * 4;
            return surface.data.length === expectedSize;
        } catch (error) {
            return false;
        }
    }
}

PngEncoder.MAX_DIMENSION = 65535;

// ============================================================================
// BITMAP GLYPH STORE - BitmapGlyphStore.js
// ============================================================================

class BitmapGlyphStore {
  constructor() {
    this.kerningTables = {};
    this.glyphsTextMetrics = {};
    this.spaceAdvancementOverrideForSmallSizesInPx = {};
    
    this.glyphSheets = {};
    this.glyphSheetsMetrics = {
      tightWidth: {},
      tightHeight: {},
      dx: {},
      dy: {},
      xInGlyphSheet: {}
    };
  }

  getFontPropertiesArray(fontProperties) {
    const {
      pixelDensity,
      fontFamily,
      fontStyle,
      fontWeight,
      fontSize
    } = fontProperties;
    return [pixelDensity, fontFamily, fontStyle, fontWeight, fontSize];
  }

  getKerningTable(fontProperties) {
    ensureNestedPropertiesExist(this.kerningTables, this.getFontPropertiesArray(fontProperties));
    return getNestedProperty(this.kerningTables, this.getFontPropertiesArray(fontProperties));
  }

  setKerningTable(fontProperties, kerningTable) {
    setNestedProperty(this.kerningTables,this.getFontPropertiesArray(fontProperties), kerningTable);
  }
  
  getGlyphSheet(fontProperties) {
    ensureNestedPropertiesExist(this.glyphSheets,this.getFontPropertiesArray(fontProperties));
    return getNestedProperty(this.glyphSheets,this.getFontPropertiesArray(fontProperties));
  }

  setGlyphSheet(fontProperties, glyphSheet) {
    setNestedProperty(this.glyphSheets,this.getFontPropertiesArray(fontProperties), glyphSheet);
  }

  getGlyphSheetMetrics(fontProperties, letter) {
    const address = this.getFontPropertiesArray(fontProperties).concat(letter);
    const glyphSheetsMetrics = this.glyphSheetsMetrics;
    return {
      xInGlyphSheet: getNestedProperty(glyphSheetsMetrics.xInGlyphSheet, address),
      tightWidth: getNestedProperty(glyphSheetsMetrics.tightWidth, address),
      tightHeight: getNestedProperty(glyphSheetsMetrics.tightHeight, address),
      dx: getNestedProperty(glyphSheetsMetrics.dx, address),
      dy: getNestedProperty(glyphSheetsMetrics.dy, address)
    };
  }

  setGlyphSheetMetrics(fontProperties, metrics) {
    const glyphSheetsMetrics = this.glyphSheetsMetrics;
    for (const metricKey in metrics) {
      setNestedProperty(glyphSheetsMetrics[metricKey],this.getFontPropertiesArray(fontProperties), metrics[metricKey]);
    }
  }

  getGlyphsTextMetrics(fontProperties, letter) {
    return getNestedProperty(this.glyphsTextMetrics, this.getFontPropertiesArray(fontProperties).concat(letter));
  }

  setGlyphsTextMetrics(fontProperties, metrics) {
    setNestedProperty(this.glyphsTextMetrics,this.getFontPropertiesArray(fontProperties), metrics);
  }

  setGlyphTextMetrics(fontProperties, letter, metrics) {
    setNestedProperty(this.glyphsTextMetrics, this.getFontPropertiesArray(fontProperties).concat(letter), metrics);
  }

  getSpaceAdvancementOverrideForSmallSizesInPx(fontProperties) {
    return getNestedProperty(this.spaceAdvancementOverrideForSmallSizesInPx, this.getFontPropertiesArray(fontProperties));
  }

  setSpaceAdvancementOverrideForSmallSizesInPx(fontProperties, spaceAdvancementOverrideForSmallSizesInPx) {
    setNestedProperty(this.spaceAdvancementOverrideForSmallSizesInPx, this.getFontPropertiesArray(fontProperties), spaceAdvancementOverrideForSmallSizesInPx);
  }
}

// ============================================================================
// BITMAP TEXT - BitmapText.js (Node.js compatible version)
// ============================================================================

class BitmapText {
  constructor(glyphStore, canvasFactory) {
    this.glyphStore = glyphStore;
    // Use factory function if provided (Node.js), else use document (browser)
    if (canvasFactory) {
      this.coloredGlyphCanvas = canvasFactory();
    } else if (typeof document !== 'undefined') {
      this.coloredGlyphCanvas = document.createElement('canvas');
    } else {
      throw new Error('Canvas factory function required in Node.js environment');
    }
    this.coloredGlyphCtx = this.coloredGlyphCanvas.getContext('2d');
  }

  measureText(text, fontProperties) {
    if (text.length === 0)
      return {
        width: 0,
        actualBoundingBoxLeft: 0,
        actualBoundingBoxRight: 0,
        actualBoundingBoxAscent: 0,
        actualBoundingBoxDescent: 0,
        fontBoundingBoxAscent: 0,
        fontBoundingBoxDescent: 0
      };

    let width_CSS_Px = 0;
    let letterTextMetrics = this.glyphStore.getGlyphsTextMetrics(fontProperties, text[0]);
    const actualBoundingBoxLeft_CSS_Px = letterTextMetrics.actualBoundingBoxLeft;
    let actualBoundingBoxAscent = 0;
    let actualBoundingBoxDescent = 0;
    let actualBoundingBoxRight_CSS_Px;
    let advancement_CSS_Px = 0;

    for (let i = 0; i < text.length; i++) {
      const letter = text[i];
      const nextLetter = text[i + 1];

      letterTextMetrics = this.glyphStore.getGlyphsTextMetrics(fontProperties, letter);

      actualBoundingBoxAscent = Math.max(actualBoundingBoxAscent, letterTextMetrics.actualBoundingBoxAscent);
      actualBoundingBoxDescent = Math.min(actualBoundingBoxDescent, letterTextMetrics.actualBoundingBoxDescent);

      advancement_CSS_Px = this.calculateAdvancement_CSS_Px(fontProperties, letter, nextLetter);
      width_CSS_Px += advancement_CSS_Px;
    }

    actualBoundingBoxRight_CSS_Px = width_CSS_Px - advancement_CSS_Px;
    actualBoundingBoxRight_CSS_Px += letterTextMetrics.actualBoundingBoxRight;

    return {
      width: width_CSS_Px,
      actualBoundingBoxLeft: actualBoundingBoxLeft_CSS_Px,
      actualBoundingBoxRight: actualBoundingBoxRight_CSS_Px,
      actualBoundingBoxAscent,
      actualBoundingBoxDescent,
      fontBoundingBoxAscent: letterTextMetrics.fontBoundingBoxAscent,
      fontBoundingBoxDescent: letterTextMetrics.fontBoundingBoxDescent
    };
  }

  calculateAdvancement_CSS_Px(fontProperties, letter, nextLetter) {
    const letterTextMetrics = this.glyphStore.getGlyphsTextMetrics(fontProperties, letter);
    let x_CSS_Px = 0;

    if (letter === " ") {
      const spaceAdvancementOverrideForSmallSizesInPx_CSS_Px = this.glyphStore.getSpaceAdvancementOverrideForSmallSizesInPx(fontProperties);
      if (spaceAdvancementOverrideForSmallSizesInPx_CSS_Px !== null) {
        x_CSS_Px += spaceAdvancementOverrideForSmallSizesInPx_CSS_Px;
      }
      else {
        x_CSS_Px += letterTextMetrics.width;
      }
    }
    else {
      x_CSS_Px += letterTextMetrics.width;
    }

    let kerningCorrection = this.getKerningCorrection(fontProperties, letter, nextLetter);
    x_CSS_Px -= fontProperties.fontSize * kerningCorrection / 1000;

    return Math.round(x_CSS_Px);
  }

  getKerningCorrection(fontProperties, letter, nextLetter) {
    const properties = [letter, nextLetter];

    if (isKerningEnabled && nextLetter) {
      let kerningCorrectionPlace = this.glyphStore.getKerningTable(fontProperties);
      if (checkNestedPropertiesExist(kerningCorrectionPlace, properties))
        return getNestedProperty(kerningCorrectionPlace, properties);
    }

    return 0;
  }

  drawTextFromGlyphSheet(ctx, text, x_CSS_Px, y_CSS_Px, fontProperties, textColor = 'black') {
    const position = {
      x: x_CSS_Px * fontProperties.pixelDensity,
      y: y_CSS_Px * fontProperties.pixelDensity
    };
    
    const glyphSheet = this.glyphStore.getGlyphSheet(fontProperties);

    for (let i = 0; i < text.length; i++) {
      const currentLetter = text[i];
      const nextLetter = text[i + 1];
      
      this.drawLetter(ctx,
        currentLetter,
        position,
        glyphSheet,
        fontProperties,
        textColor
      );

      position.x += this.calculateLetterAdvancement(fontProperties, currentLetter, nextLetter);
    }
  }

  drawLetter(ctx, letter, position, glyphSheet, fontProperties, textColor) {
    const metrics = this.glyphStore.getGlyphSheetMetrics(fontProperties, letter);
    if (!metrics.xInGlyphSheet) return;

    const coloredGlyphCanvas = this.createColoredGlyph(glyphSheet, metrics, textColor);
    this.renderGlyphToMainCanvas(ctx, coloredGlyphCanvas, position, metrics);
  }

  createColoredGlyph(glyphSheet, metrics, textColor) {
    const { xInGlyphSheet, tightWidth, tightHeight } = metrics;
    
    this.coloredGlyphCanvas.width = tightWidth;
    this.coloredGlyphCanvas.height = tightHeight;
    this.coloredGlyphCtx.clearRect(0, 0, tightWidth, tightHeight);

    this.coloredGlyphCtx.globalCompositeOperation = 'source-over';
    this.coloredGlyphCtx.drawImage(
      glyphSheet,
      xInGlyphSheet, 0,
      tightWidth, tightHeight,
      0, 0,
      tightWidth, tightHeight
    );

    this.coloredGlyphCtx.globalCompositeOperation = 'source-in';
    this.coloredGlyphCtx.fillStyle = textColor;
    this.coloredGlyphCtx.fillRect(0, 0, tightWidth, tightHeight);

    return this.coloredGlyphCanvas;
  }

  renderGlyphToMainCanvas(ctx, coloredGlyphCanvas, position, metrics) {
    const { tightWidth, tightHeight, dx, dy } = metrics;
    
    ctx.drawImage(
      coloredGlyphCanvas,
      0, 0,
      tightWidth, tightHeight,
      position.x + dx,
      position.y + dy,
      tightWidth, tightHeight
    );
  }

  calculateLetterAdvancement(fontProperties, currentLetter, nextLetter) {
    return this.calculateAdvancement_CSS_Px(fontProperties, currentLetter, nextLetter) 
      * fontProperties.pixelDensity;
  }
}

// ============================================================================
// MAIN EXECUTION - Node.js Hello World Demo
// ============================================================================

// Set global variables (required by BitmapText)
global.loadedBitmapFontData = {};
global.isKerningEnabled = true;

// Font properties for Arial normal normal 19 with pixel density 1
const fontProperties = {
  pixelDensity: 1,
  fontFamily: "Arial",
  fontStyle: "normal",
  fontWeight: "normal",
  fontSize: 19
};

function main() {
  try {
    console.log('BitmapText.js Node.js Demo - Loading font data...');
    
    // Load font metrics (JS file)
    const fontDataPath = path.resolve(__dirname, '../../data/glyph-sheet-density-1-0-Arial-style-normal-weight-normal-size-19-0.js');
    if (!fs.existsSync(fontDataPath)) {
      throw new Error(`Font data file not found: ${fontDataPath}`);
    }
    
    // Execute the font data JS file to populate global.loadedBitmapFontData
    const fontDataCode = fs.readFileSync(fontDataPath, 'utf8');
    eval(fontDataCode);
    
    const IDString = "density-1-0-Arial-style-normal-weight-normal-size-19-0";
    const fontData = global.loadedBitmapFontData[IDString];
    if (!fontData) {
      throw new Error(`Font data not found for ID: ${IDString}`);
    }
    
    console.log('Font metrics loaded successfully');
    
    // Load and decode QOI glyph sheet
    const qoiPath = path.resolve(__dirname, '../../data/glyph-sheet-density-1-0-Arial-style-normal-weight-normal-size-19-0.qoi');
    if (!fs.existsSync(qoiPath)) {
      throw new Error(`QOI file not found: ${qoiPath}`);
    }
    
    console.log('Loading QOI glyph sheet...');
    const qoiBuffer = fs.readFileSync(qoiPath);
    const qoiData = QOIDecode(qoiBuffer.buffer, 0, null, 4); // Force RGBA output
    
    if (qoiData.error) {
      throw new Error('Failed to decode QOI file');
    }
    
    console.log(`QOI decoded: ${qoiData.width}x${qoiData.height}, ${qoiData.channels} channels`);
    
    // Create Image from QOI data
    const glyphSheetImage = new Image(qoiData.width, qoiData.height, new Uint8ClampedArray(qoiData.data));
    
    // Setup BitmapText system
    console.log('Setting up BitmapText system...');
    const bitmapGlyphStore = new BitmapGlyphStore();
    const bitmapText = new BitmapText(bitmapGlyphStore, () => new Canvas());
    
    // Process font data and populate glyph store
    bitmapGlyphStore.setKerningTable(fontProperties, fontData.kerningTable);
    bitmapGlyphStore.setGlyphsTextMetrics(fontProperties, fontData.glyphsTextMetrics);
    bitmapGlyphStore.setGlyphSheetMetrics(fontProperties, fontData.glyphSheetsMetrics);
    bitmapGlyphStore.setSpaceAdvancementOverrideForSmallSizesInPx(
      fontProperties,
      fontData.spaceAdvancementOverrideForSmallSizesInPx
    );
    bitmapGlyphStore.setGlyphSheet(fontProperties, glyphSheetImage);
    
    // Create output canvas
    console.log('Creating canvas and rendering...');
    const canvas = new Canvas();
    canvas.width = 300;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    
    // White background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 300, 100);
    
    // Render "Hello World" using bitmap text
    bitmapText.drawTextFromGlyphSheet(
      ctx,
      "Hello World",
      10,  // x position
      50,  // y position
      fontProperties,
      '#000000'  // black color
    );
    
    console.log('Text rendered successfully');
    
    // Export to PNG
    console.log('Encoding PNG...');
    const surface = {
      width: canvas.width,
      height: canvas.height,
      data: canvas.data
    };
    
    if (!PngEncoder.canEncode(surface)) {
      throw new Error('Surface cannot be encoded to PNG');
    }
    
    const pngBuffer = PngEncoder.encode(surface, PngEncodingOptions.DEFAULT);
    
    // Write PNG file
    const outputPath = path.resolve(process.cwd(), 'hello-world-output.png');
    fs.writeFileSync(outputPath, Buffer.from(pngBuffer));
    
    console.log(`\nSuccess! 🎉`);
    console.log(`Generated: ${outputPath}`);
    console.log(`Canvas size: ${canvas.width}x${canvas.height}`);
    console.log(`File size: ${fs.statSync(outputPath).size} bytes`);
    console.log(`\nThe PNG contains "Hello World" rendered using bitmap fonts from QOI data.`);
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure you run this from the project root directory');
    console.error('2. Ensure font data exists: data/glyph-sheet-density-1-0-Arial-style-normal-weight-normal-size-19-0.*');
    console.error('3. Generate fonts using public/font-builder.html if needed');
    process.exit(1);
  }
}

// Run the demo
if (require.main === module) {
  main();
}