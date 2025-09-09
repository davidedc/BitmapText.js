// Core FontProperties class for runtime use
// Optimized for performance - no validation, pre-computed keys
// Properties always in order: pixelDensity, fontFamily, fontStyle, fontWeight, fontSize
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
  
  
  // Equality comparison based on key
  equals(other) {
    if (!(other instanceof FontProperties)) return false;
    return this._key === other._key;
  }
}