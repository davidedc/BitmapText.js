class GlyphIDString {
  // Extract font properties from the filename -------------
  // The filename is the font family, style, weight, size and pixel density, all lowercase, with
  // any special characters and spaces replaced by dashes and all multiple dashes replaced by a single dash
  // note that the pixel density and the weight have two parts because they could have decimals
  // e.g.
  //
  //   glyphs-sheet-density-1-5-Arial-style-normal-weight-normal-size-18-5 for pixel density 1.5 and size 18.5
  //   glyphs-sheet-density-1-0-Arial-style-normal-weight-normal-size-18-0 for pixel density 1 and size 18
  //
  // Note that any density or size number without a decimal part will still have a 0 after the decimal point in the filename
  // HOWEVER, if the decimal part is 0, it will be omitted in the returned object

  static parseFilename(filename) {
    const parts = filename.split('-');     

    // Extract and format numeric values (handling decimal parts)
    const pixelDensity = this._formatNumericPart(parts[3], parts[4]);
    const fontSize = this._formatNumericPart(parts[11], parts[12]);
      
    return {
        pixelDensity,
        fontFamily: parts[5],
        fontStyle: parts[7],
        fontWeight: parts[9],
        fontSize
    };
  }

  // Helper method to format numeric parts
  static _formatNumericPart(integerPart, decimalPart) {
    if (!decimalPart || decimalPart === '0') {
      return integerPart;
    }
    return `${integerPart}.${decimalPart}`;
  }
}