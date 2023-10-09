CanvasRenderingContext2D.prototype.getHash = function () {
  var data = this.getImageData(0, 0, this.canvas.width, this.canvas.height).data;

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

  return hash | 0;
};