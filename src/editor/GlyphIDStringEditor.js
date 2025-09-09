// Uses FontProperties.idString
class GlyphIDString_Editor extends GlyphIDString {
  static getIDString(fontProperties) {
      // Use pre-computed idString from FontProperties for performance
      if (fontProperties.idString) {
          return fontProperties.idString;
      }
      
      // Legacy fallback for plain objects (will be removed after migration)
      return GlyphIDString_Editor.getIDStringLegacy(fontProperties);
  }
  
  // DEPRECATED: Legacy method for backward compatibility
  // Will be removed once all code uses FontProperties instances
  static getIDStringLegacy(properties) {
      const { pixelDensity, fontFamily, fontStyle, fontWeight, fontSize } = properties;
      
      // Format numbers to always have a digit before and after decimal point
      // e.g. 1.0 instead of 1
      const formatNumber = num => {
          const [intPart, decPart = '0'] = num.toString().split('.');
          return `${intPart}.${decPart}`;
      };
      
      // Construct the IDString with all components
      let IDString = [
          'density-' + formatNumber(pixelDensity),
          fontFamily,
          'style-' + fontStyle,
          'weight-' + fontWeight,
          'size-' + formatNumber(fontSize)
      ].join('-');
      
      // Clean up the IDString by replacing special characters and multiple dashes
      return IDString.replace(/[^A-Za-z0-9]/g, '-').replace(/-+/g, '-');
  }
}