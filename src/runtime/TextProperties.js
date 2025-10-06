// TextProperties - Core Runtime Class
//
// This is a CORE RUNTIME class designed for minimal bundle size (~1-2KB).
// It provides essential text rendering configuration with maximum performance.
//
// DISTRIBUTION ROLE:
// - Part of "runtime-only" distribution for production applications
// - Manages text rendering properties: kerning, alignment, baseline, color
// - Contains no validation code to minimize runtime overhead
// - Optimized for performance with pre-computed keys and immutability
//
// ARCHITECTURE:
// - Immutable text configuration object safe to use as Map keys
// - Pre-computes storage keys for optimal lookup performance
// - Provides factory methods for creating instances from various inputs
// - Properties: isKerningEnabled, textBaseline, textAlign, textColor
//
// This class replaces the global isKerningEnabled variable and consolidates
// all text rendering properties into a single, immutable configuration object.
class TextProperties {
  constructor(options = {}) {
    // Extract options with defaults - optimized for BitmapText usage
    const {
      isKerningEnabled = true,        // Enable kerning by default for better text rendering
      textBaseline = 'bottom',        // This is DIFFERENT FROM THE HTML5 Canvas default (BitmapText uses 'bottom' as default because it's the only one supported yet, but the default in HTML5Canvas is 'alphabetic')
      textAlign = 'left',             // HTML5 Canvas default
      textColor = '#000000'           // Black color default
    } = options;

    // Direct assignment, no validation in core for performance
    this.isKerningEnabled = isKerningEnabled;
    this.textBaseline = textBaseline;
    this.textAlign = textAlign;
    this.textColor = textColor;

    // Pre-compute storage key (for potential caching or Map lookups)
    this._key = `kerning:${this.isKerningEnabled}:baseline:${this.textBaseline}:align:${this.textAlign}:color:${this.textColor}`;

    // Freeze for immutability (safe to use as Map keys)
    Object.freeze(this);
  }

  // Getter for pre-computed storage key
  get key() {
    return this._key;
  }

  // Factory method to create TextProperties with specific kerning setting
  static withKerning(isKerningEnabled, options = {}) {
    return new TextProperties({
      ...options,
      isKerningEnabled
    });
  }

  // Factory method to create TextProperties with specific color
  static withColor(textColor, options = {}) {
    return new TextProperties({
      ...options,
      textColor
    });
  }

  // Factory method to create TextProperties for BitmapText (uses 'bottom' baseline)
  static forBitmapText(options = {}) {
    return new TextProperties({
      textBaseline: 'bottom',  // BitmapText uses bottom baseline positioning
      ...options
    });
  }

  // Create a new TextProperties with modified kerning
  withKerningEnabled(isKerningEnabled) {
    return new TextProperties({
      isKerningEnabled,
      textBaseline: this.textBaseline,
      textAlign: this.textAlign,
      textColor: this.textColor
    });
  }

  // Create a new TextProperties with modified color
  withTextColor(textColor) {
    return new TextProperties({
      isKerningEnabled: this.isKerningEnabled,
      textBaseline: this.textBaseline,
      textAlign: this.textAlign,
      textColor
    });
  }

  // Equality comparison based on key
  equals(other) {
    if (!(other instanceof TextProperties)) return false;
    return this._key === other._key;
  }

  // Return plain object for compatibility/debugging
  toObject() {
    return {
      isKerningEnabled: this.isKerningEnabled,
      textBaseline: this.textBaseline,
      textAlign: this.textAlign,
      textColor: this.textColor
    };
  }
}