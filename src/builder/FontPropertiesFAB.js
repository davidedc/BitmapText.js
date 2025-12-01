// FontPropertiesFAB class for font assets building
// Extends FontProperties with validation and utility methods
// Properties always in order: pixelDensity, fontFamily, fontStyle, fontWeight, fontSize
class FontPropertiesFAB extends FontProperties {
  // Valid values for validation
  static VALID_STYLES = ['normal', 'italic', 'oblique'];
  static VALID_WEIGHTS = ['normal', 'bold', 'bolder', 'lighter', 
                          '100', '200', '300', '400', '500', '600', '700', '800', '900'];
  
  constructor(pixelDensity, fontFamily, fontStyle, fontWeight, fontSize) {
    // Validate all parameters before calling super
    FontPropertiesFAB.#validate(pixelDensity, fontFamily, fontStyle, fontWeight, fontSize);
    super(pixelDensity, fontFamily, fontStyle, fontWeight, fontSize);
  }
  
  // Comprehensive validation
  static #validate(pixelDensity, fontFamily, fontStyle, fontWeight, fontSize) {
    if (!pixelDensity || pixelDensity <= 0) {
      throw new Error(`Invalid pixelDensity: ${pixelDensity} - must be positive number`);
    }
    if (!fontFamily || typeof fontFamily !== 'string') {
      throw new Error(`Invalid fontFamily: ${fontFamily} - must be non-empty string`);
    }
    if (!FontPropertiesFAB.VALID_STYLES.includes(fontStyle)) {
      throw new Error(`Invalid fontStyle: ${fontStyle} - must be one of: ${FontPropertiesFAB.VALID_STYLES.join(', ')}`);
    }
    if (!FontPropertiesFAB.VALID_WEIGHTS.includes(fontWeight)) {
      throw new Error(`Invalid fontWeight: ${fontWeight} - must be one of: ${FontPropertiesFAB.VALID_WEIGHTS.join(', ')}`);
    }
    if (!fontSize || fontSize <= 0) {
      throw new Error(`Invalid fontSize: ${fontSize} - must be positive number`);
    }
    if (fontSize < 9) {
      throw new Error(`Invalid fontSize: ${fontSize} - font sizes < 9px are not supported for building. These sizes render using interpolated 9px metrics at runtime. Please build size 9px instead.`);
    }
  }
  
  // Factory method from plain object (common in UI and loading)
  static fromObject(obj) {
    return new FontPropertiesFAB(
      obj.pixelDensity || 1,
      obj.fontFamily,
      obj.fontStyle || 'normal',
      obj.fontWeight || 'normal',
      obj.fontSize
    );
  }
  
  // Factory method from ID string (for manifest parsing)
  // Parses: density-1-0-Arial-style-normal-weight-normal-size-18-0
  static fromIDString(idString) {
    const parts = idString.split('-');
    if (parts.length < 10) {
      throw new Error(`Invalid ID string format: ${idString}`);
    }
    
    // Parse pixelDensity from parts[1] and parts[2] (e.g., "1-0" → 1, "1-5" → 1.5)
    const pixelDensity = FontPropertiesFAB.#parseNumber(parts[1], parts[2]);
    let fontFamilyIndex = 3; // Always at index 3 since pixelDensity is always formatted as n-n
    
    // Find style, weight, size positions
    const styleIndex = parts.indexOf('style') + 1;
    const weightIndex = parts.indexOf('weight') + 1;
    const sizeIndex = parts.indexOf('size') + 1;
    
    if (styleIndex === 0 || weightIndex === 0 || sizeIndex === 0) {
      throw new Error(`Invalid ID string format: ${idString} - missing required parts`);
    }
    
    const fontFamily = parts.slice(fontFamilyIndex, styleIndex - 1).join('-');
    const fontStyle = parts[styleIndex];
    const fontWeight = parts[weightIndex];
    
    // Parse fontSize from size parts
    const fontSizeParts = parts.slice(sizeIndex);
    let fontSize;
    if (fontSizeParts.length >= 2 && !isNaN(fontSizeParts[1])) {
      fontSize = FontPropertiesFAB.#parseNumber(fontSizeParts[0], fontSizeParts[1]);
    } else {
      fontSize = parseFloat(fontSizeParts[0]);
    }
    
    return new FontPropertiesFAB(
      pixelDensity,
      fontFamily,
      fontStyle,
      fontWeight,
      fontSize
    );
  }
  
  // Parse number supporting non-integers: "1" + "5" → 1.5
  static #parseNumber(intPart, fracPart) {
    if (fracPart && !isNaN(fracPart)) {
      return parseFloat(`${intPart}.${fracPart}`);
    }
    return parseFloat(intPart);
  }
  
  // Create new instance with different size
  withSize(newSize) {
    return new FontPropertiesFAB(
      this.pixelDensity,
      this.fontFamily,
      this.fontStyle,
      this.fontWeight,
      newSize
    );
  }
  
  // Create new instance with different pixel density
  withPixelDensity(newDensity) {
    return new FontPropertiesFAB(
      newDensity,
      this.fontFamily,
      this.fontStyle,
      this.fontWeight,
      this.fontSize
    );
  }
  
  // Human-readable string for debugging
  toString() {
    return `FontProperties(${this.fontFamily} ${this.fontSize}px ${this.fontStyle} ${this.fontWeight} @${this.pixelDensity}x)`;
  }
  
  // JSON serialization
  toJSON() {
    return {
      pixelDensity: this.pixelDensity,
      fontFamily: this.fontFamily,
      fontStyle: this.fontStyle,
      fontWeight: this.fontWeight,
      fontSize: this.fontSize
    };
  }
}