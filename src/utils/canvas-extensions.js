CanvasRenderingContext2D.prototype.getHash = function () {
  // Check for invalid canvas dimensions
  if (this.canvas.width === 0 || this.canvas.height === 0) {
    return 0;
  }
  
  const data = this.getImageData(0, 0, this.canvas.width, this.canvas.height).data;

  // scan the data. The data for each pixel is 4 bytes, one for each component (RGBA)
  // so put that pixel info into a 32 bit integer, and use that to calculate the hash
  let hash = 0 | 0;
  if (data.length === 0) return hash | 0;

  for (let i = 0; i < data.length; i += 4) {
    // pack the pixel data into a single 32 bit integer
    const int32ValueFromPixelData = data[i] << 24 | data[i + 1] << 16 | data[i + 2] << 8 | data[i + 3];
    hash = ((hash << 5) - hash) + int32ValueFromPixelData;
    hash |= 0; // Convert to 32 bit integer
  }

  // Also add to the hash the width and the height.
  // Each of these MOST PROBABLY fits into a 16-bit integer, so we could pack both into a 32 bit integer
  // however it's really not worth to introduce that assumption as for example PNG files
  // have no size limit and we'd gain nothing from this optimisation.
  hash = ((hash << 5) - hash) + this.canvas.width;
  hash |= 0;
  hash = ((hash << 5) - hash) + this.canvas.height;
  hash |= 0;

  return hash | 0;

};

CanvasRenderingContext2D.prototype.getHashString = function () {
  const hex = (this.getHash() + 0x100000000).toString(16);
  return hex.substring(1, 9);
}

CanvasRenderingContext2D.prototype.getBlackAndWhiteHash = function () {
  // Check for invalid canvas dimensions
  if (this.canvas.width === 0 || this.canvas.height === 0) {
    return 0;
  }

  const imageData = this.getImageData(0, 0, this.canvas.width, this.canvas.height);
  const data = imageData.data;

  // Calculate hash with black-and-white pixels (all non-white pixels converted to black)
  let hash = 0 | 0;
  if (data.length === 0) return hash | 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // Convert to black-and-white: if pixel is pure white (255, 255, 255), keep it white
    // Otherwise, convert to black (0, 0, 0)
    let bwR, bwG, bwB;
    if (r === 255 && g === 255 && b === 255) {
      // Pure white - keep as is
      bwR = 255;
      bwG = 255;
      bwB = 255;
    } else {
      // Any other color - convert to black
      bwR = 0;
      bwG = 0;
      bwB = 0;
    }

    // Pack the black-and-white pixel data into a single 32 bit integer
    const int32ValueFromPixelData = bwR << 24 | bwG << 16 | bwB << 8 | a;
    hash = ((hash << 5) - hash) + int32ValueFromPixelData;
    hash |= 0; // Convert to 32 bit integer
  }

  // Also add to the hash the width and the height (same as getHash)
  hash = ((hash << 5) - hash) + this.canvas.width;
  hash |= 0;
  hash = ((hash << 5) - hash) + this.canvas.height;
  hash |= 0;

  return hash | 0;
};

CanvasRenderingContext2D.prototype.getBlackAndWhiteHashString = function () {
  const hex = (this.getBlackAndWhiteHash() + 0x100000000).toString(16);
  return hex.substring(1, 9);
};

CanvasRenderingContext2D.prototype.toPNGImage = function() {
  // Get the data URL of the canvas content
  const dataURL = this.canvas.toDataURL('image/png');
  
  // Create a new Image element
  const img = new Image();
  
  // Set the src attribute to the data URL
  img.src = dataURL;
  
  // Return the Image element
  return img;
};