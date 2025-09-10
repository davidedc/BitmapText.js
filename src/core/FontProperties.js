// FontProperties - Core Runtime Class  
//
// This is a CORE RUNTIME class designed for minimal bundle size (~2-3KB).
// It provides essential font configuration management with maximum performance.
//
// DISTRIBUTION ROLE:
// - Part of "runtime-only" distribution for production applications
// - Extended by FontPropertiesEditor for validation and generation utilities  
// - Contains no validation code to minimize runtime overhead
// - Optimized for performance with pre-computed keys and immutability
//
// ARCHITECTURE:
// - Immutable font configuration object safe to use as Map keys
// - Pre-computes storage keys and ID strings for optimal lookup performance
// - Provides factory methods for creating instances from various inputs
// - Properties in fixed order: pixelDensity, fontFamily, fontStyle, fontWeight, fontSize
//
// For validation and font generation utilities, use FontPropertiesEditor.
class FontProperties {
  constructor(pixelDensity, fontFamily, fontStyle, fontWeight, fontSize) {
    // Direct assignment, no validation in core for performance
    this.pixelDensity = pixelDensity || 1;
    this.fontFamily = fontFamily;
    this.fontStyle = fontStyle || 'normal';
    this.fontWeight = fontWeight || 'normal';
    this.fontSize = fontSize;
    
    // Pre-compute storage key (critical for performance optimization)
    // Used for Map lookups in BitmapGlyphStore
    this._key = `${this.pixelDensity}:${this.fontFamily}:${this.fontStyle}:${this.fontWeight}:${this.fontSize}`;
    
    // Pre-compute ID string for file naming and manifest keys
    // Format: density-1-0-Arial-style-normal-weight-normal-size-18-0
    this._idString = `density-${this.#formatNumber(this.pixelDensity)}-${this.fontFamily}-style-${this.fontStyle}-weight-${this.fontWeight}-size-${this.#formatNumber(this.fontSize)}`;
    
    // Freeze for immutability (safe to use as Map keys)
    Object.freeze(this);
  }
  
  // Format number handling non-integers: 1.5 → "1-5", 18.5 → "18-5", 18 → "18-0"
  #formatNumber(num) {
    const str = String(num);
    return str.includes('.') ? str.replace('.', '-') : `${str}-0`;
  }
  
  // Getter for pre-computed storage key
  get key() {
    return this._key;
  }
  
  // Getter for pre-computed ID string
  get idString() {
    return this._idString;
  }
  
  
  // Factory method to create FontProperties from ID string
  // Parses: density-1-0-Arial-style-normal-weight-normal-size-18-0
  static fromIDString(idString) {
    const parts = idString.split('-');     

    // Extract and format numeric values (handling decimal parts)
    const pixelDensity = parseFloat(FontProperties.#formatNumericPart(parts[1], parts[2]));
    const fontSize = parseFloat(FontProperties.#formatNumericPart(parts[9], parts[10]));
    const fontFamily = parts[3];
    const fontStyle = parts[5];
    const fontWeight = parts[7];
    
    // Return new FontProperties instance
    return new FontProperties(pixelDensity, fontFamily, fontStyle, fontWeight, fontSize);
  }

  // Helper method to format numeric parts (used by fromIDString)
  static #formatNumericPart(integerPart, decimalPart) {
    if (!decimalPart || decimalPart === '0') {
      return integerPart;
    }
    return `${integerPart}.${decimalPart}`;
  }
  
  // Equality comparison based on key
  equals(other) {
    if (!(other instanceof FontProperties)) return false;
    return this._key === other._key;
  }
}