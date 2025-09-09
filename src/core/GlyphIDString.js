class GlyphIDString {
  // Extract font properties from the IDString and return FontProperties instance
  // The IDString is the font family, style, weight, size and pixel density, all lowercase, with
  // any special characters and spaces replaced by dashes and all multiple dashes replaced by a single dash
  // note that the pixel density and the weight have two parts because they could have decimals
  // e.g.
  //
  //   density-1-5-Arial-style-normal-weight-normal-size-18-5 for pixel density 1.5 and size 18.5
  //   density-1-0-Arial-style-normal-weight-normal-size-18-0 for pixel density 1 and size 18
  //
  // Note that any density or size number without a decimal part will still have a 0 after the decimal point in the IDString
  // HOWEVER, if the decimal part is 0, it will be omitted in the returned numeric values

  static parseIDString(IDString) {
    const parts = IDString.split('-');     

    // Extract and format numeric values (handling decimal parts)
    const pixelDensity = parseFloat(this._formatNumericPart(parts[1], parts[2]));
    const fontSize = parseFloat(this._formatNumericPart(parts[9], parts[10]));
    const fontFamily = parts[3];
    const fontStyle = parts[5];
    const fontWeight = parts[7];
    
    // Return FontProperties instance instead of plain object
    return new FontProperties(pixelDensity, fontFamily, fontStyle, fontWeight, fontSize);
  }

  // Helper method to format numeric parts
  static _formatNumericPart(integerPart, decimalPart) {
    if (!decimalPart || decimalPart === '0') {
      return integerPart;
    }
    return `${integerPart}.${decimalPart}`;
  }
  
}