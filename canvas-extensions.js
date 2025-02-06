CanvasRenderingContext2D.prototype.getHash = function () {
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