class GlyphIDString_Full extends GlyphIDString {
  static getFilename(properties) {
      const { pixelDensity, fontFamily, fontStyle, fontWeight, fontSize } = properties;
      
      // Format numbers to always have a digit before and after decimal point
      // e.g. 1.0 instead of 1
      const formatNumber = num => {
          const [intPart, decPart = '0'] = num.toString().split('.');
          return `${intPart}.${decPart}`;
      };
      
      // Construct the filename with all components
      let filename = [
          'glyphs-sheet',
          'density-' + formatNumber(pixelDensity),
          fontFamily,
          'style-' + fontStyle,
          'weight-' + fontWeight,
          'size-' + formatNumber(fontSize)
      ].join('-');
      
      // Clean up the filename by replacing special characters and multiple dashes
      return filename.replace(/[^A-Za-z0-9]/g, '-').replace(/-+/g, '-');
  }
}