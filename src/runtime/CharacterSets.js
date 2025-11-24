/**
 * CharacterSets - Character set configuration for BitmapText.js
 *
 * This class defines the character sets used throughout the BitmapText.js library.
 * It contains both font-specific characters (required in all fonts) and font-invariant
 * characters (auto-redirect to BitmapTextInvariant font).
 *
 * @class CharacterSets
 * @static
 */
class CharacterSets {
  // ============================================
  // Font-Specific Character Set (204 characters)
  // ============================================

  /**
   * Font-specific character set constant (204 characters)
   * Used by both build-time (MetricsMinifier) and runtime (MetricsExpander)
   * This is the sorted character set that defines the standard order for all font metrics.
   * ALL font files must contain exactly these 204 characters in this order.
   *
   * @type {string}
   * @static
   * @readonly
   */
  static FONT_SPECIFIC_CHARS = CharacterSets.#generateFontSpecificChars();

  // ============================================
  // Font-Invariant Character Configuration
  // ============================================

  /**
   * Font-invariant characters that auto-redirect to BitmapTextInvariant font.
   * These 18 Unicode characters render using monospaced Courier New metrics
   * regardless of the font specified in FontProperties.
   *
   * Characters: ☺☹♠♡♦♣│─├└▶▼▲◀✔✘≠↗
   *
   * @type {string}
   * @static
   * @readonly
   */
  static FONT_INVARIANT_CHARS = '☺☹♠♡♦♣│─├└▶▼▲◀✔✘≠↗';

  /**
   * Font family name for font-invariant characters.
   * These characters are internally rendered using Courier New to ensure
   * consistent monospaced appearance across all fonts.
   *
   * @type {string}
   * @static
   * @readonly
   */
  static INVARIANT_FONT_FAMILY = 'BitmapTextInvariant';

  // ============================================
  // Private Generator Methods
  // ============================================

  /**
   * Generates the font-specific character set (204 characters).
   * This includes ASCII printable characters, selected CP-1252 characters,
   * Latin-1 Supplement characters, and the Full Block character.
   *
   * Character composition:
   * - ASCII printable (32-126): 95 characters
   * - Windows-1252 subset (CP-1252): 14 characters
   * - Latin-1 Supplement (161-255, excluding soft hyphen 173): 94 characters
   * - Full Block character (█): 1 character
   *
   * Total: 204 characters
   *
   * @private
   * @static
   * @returns {string} Sorted character set string
   */
  static #generateFontSpecificChars() {
    const chars = [];

    // ASCII printable characters (32-126)
    // Includes space, numbers, letters, and common symbols
    for (let i = 32; i <= 126; i++) {
      chars.push(String.fromCharCode(i));
    }

    // A selection from Windows-1252 (CP-1252) printable characters.
    // This is the most standard definition of "extended ASCII codes" from 128 to 159
    // and many of these are common/useful symbols that people "expect to have".
    // However fromCharCode doesn't work on those as that range is not defined
    // in UTF-8/Unicode (modern web standard, so we want to include (some of) them but we have
    // to map them to specific Unicode code points, not the byte values themselves.
    // NOTE: we could likely shave some of these off, as they are not easily printable
    // in Javascript and some of them are fairly arcane/
    const cp1252PrintableChars = [
      8364, // € Euro sign (CP-1252: 128)
      //  8218, // ‚ Single low-9 quotation mark (CP-1252: 130)
      //  402,  // ƒ Latin small letter f with hook (CP-1252: 131)
      //  8222, // „ Double low-9 quotation mark (CP-1252: 132)
      8230, // … Horizontal ellipsis (CP-1252: 133)
      //  8224, // † Dagger (CP-1252: 134)
      //  8225, // ‡ Double dagger (CP-1252: 135)
      //  710,  // ˆ Modifier letter circumflex accent (CP-1252: 136)
      8240, // ‰ Per mille sign (CP-1252: 137)
      //  352,  // Š Latin capital letter S with caron (CP-1252: 138)
      8249, // ‹ Single left-pointing angle quotation (CP-1252: 139)
      //  338,  // Œ Latin capital ligature OE (CP-1252: 140)
      381,  // Ž Latin capital letter Z with caron (CP-1252: 142)
      //  8216, // ' Left single quotation mark (CP-1252: 145)

      // UNFORTUNATELY SOMETIMES USED INSTEAD OF APOSTROPHE
      8217, // ' ""curly apostrophe"" or "right single quotation mark" (CP-1252: 146)

      //  8220, // " Left double quotation mark (CP-1252: 147)
      //  8221, // " Right double quotation mark (CP-1252: 148)
      8226, // • Bullet (CP-1252: 149)
      //  8211, // – En dash (CP-1252: 150)
      8212, // — Em dash (CP-1252: 151)
      //  732,  // ˜ Small tilde (CP-1252: 152)
      8482, // ™ Trade mark sign (CP-1252: 153)
      353,  // š Latin small letter s with caron (CP-1252: 154)
      8250, // › Single right-pointing angle quotation mark (CP-1252: 155)
      339,  // œ Latin small ligature oe (CP-1252: 156)
      382,  // ž Latin small letter z with caron (CP-1252: 158)
      376   // Ÿ Latin capital letter Y with diaeresis (CP-1252: 159)
    ];

    for (const code of cp1252PrintableChars) {
      chars.push(String.fromCharCode(code));
    }

    // Latin-1 Supplement characters (161-255)
    // These are properly defined in UTF-8/Unicode
    // Exclude U+00AD (173) - soft hyphen, which has zero width
    for (let i = 161; i <= 255; i++) {
      if (i !== 173) { // Skip soft hyphen
        chars.push(String.fromCharCode(i));
      }
    }

    // Add Full Block character (allows us to see the maximum space taken by a glyph)
    chars.push('█');

    // Sort the character set (this is how it's used throughout the codebase)
    return chars.sort().join('');
  }
}
