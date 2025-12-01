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
  // Font-Specific Character Set
  // ============================================

  /**
   * Font-specific character set constant
   * Used by both build-time (MetricsMinifier) and runtime (MetricsExpander)
   * This is the sorted character set that defines the standard order for all font metrics.
   * ALL font files must contain exactly these characters in this order.
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
   * These Unicode characters render using monospaced Courier New metrics
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
  // Character Aliasing (Emoji → Symbol Mapping)
  // ============================================
  //
  // WHY THIS EXISTS:
  // BitmapText.js uses monochrome (black/white) atlases only to minimize
  // filesystem size, loading time, and runtime memory. Since colored emoji
  // glyphs aren't supported, we map modern emojis to visually-similar
  // black/white Unicode symbols from the font-invariant character set.
  //
  // This allows users to type emojis (😊) which render as their
  // corresponding symbols (☺) without duplicating atlas/metrics entries.
  // If colored atlases were supported, this mechanism would be unnecessary.
  //
  // See docs/ARCHITECTURE.md for full architectural rationale.
  // ============================================

  /**
   * Maps input emoji characters to their rendered symbol equivalents.
   * @type {Object.<string, string>}
   * @static
   * @readonly
   */
  static CHARACTER_ALIASES = {
    '😊': '☺',  // U+1F60A Smiling Face with Smiling Eyes → U+263A White Smiling Face
    '😀': '☺',  // U+1F600 Grinning Face → U+263A White Smiling Face
    '😃': '☺',  // U+1F603 Grinning Face with Big Eyes → U+263A White Smiling Face
    '😢': '☹',  // U+1F622 Crying Face → U+2639 White Frowning Face
    '☹️': '☹',  // U+2639 U+FE0F Frowning Face (emoji variant) → U+2639 White Frowning Face
  };

  /**
   * Resolves an input character to its rendered equivalent.
   * Returns the original character if no alias exists.
   * This method is called during text measurement and rendering
   * to transparently map emojis to their bitmap symbol equivalents.
   *
   * Performance: O(1) object property lookup (~3-5ns)
   *
   * @param {string} char - Input character (may be emoji or regular character)
   * @returns {string} Resolved character for rendering
   * @static
   */
  static resolveCharacter(char) {
    return CharacterSets.CHARACTER_ALIASES[char] ?? char;
  }

  /**
   * Cached regex for string-level alias resolution.
   * Built lazily on first use, reused for all subsequent calls.
   * @type {RegExp|null}
   * @private
   */
  static #aliasRegex = null;

  /**
   * Resolves all character aliases in a string using a single regex pass.
   * Much faster than per-character resolution, especially for longer strings.
   *
   * Performance (100K iterations):
   * - Short strings (11-31 chars): 2.6-5.1x faster than per-char
   * - Long strings (900-1000 chars): 4-386x faster than per-char
   *
   * @param {string} text - Input text (may contain emojis)
   * @returns {string} Text with all aliases resolved
   * @static
   */
  static resolveString(text) {
    // Fast path: no aliases defined
    if (Object.keys(CharacterSets.CHARACTER_ALIASES).length === 0) {
      return text;
    }
    // Build regex once, cache for reuse
    if (!CharacterSets.#aliasRegex) {
      const patterns = Object.keys(CharacterSets.CHARACTER_ALIASES).join('|');
      CharacterSets.#aliasRegex = new RegExp(patterns, 'gu');
    }
    return text.replace(CharacterSets.#aliasRegex, m => CharacterSets.CHARACTER_ALIASES[m]);
  }

  // ============================================
  // Private Generator Methods
  // ============================================

  /**
   * Generates the font-specific character set.
   * This includes ASCII printable characters, selected CP-1252 characters,
   * Latin-1 Supplement characters, and the Full Block character.
   *
   * Character composition:
   * - ASCII printable (32-126): 95 characters
   * - Windows-1252 subset (CP-1252) + Unicode extras: 12 characters
   * - Latin-1 Supplement (161-255, excluding 26 rarely-used symbols): 69 characters
   * - Full Block character (█): 1 character
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
      // 8240, // ‰ U+2030 PER MILLE SIGN (CP-1252: 137) - REMOVED: rarely used
      //  352,  // Š Latin capital letter S with caron (CP-1252: 138)

      // If someone copy-pastes French quotation marks, that's on them.
      // 8249, // ‹ U+2039 SINGLE LEFT-POINTING ANGLE QUOTATION MARK (CP-1252: 139) - REMOVED: rarely used

      //  338,  // Œ Latin capital ligature OE (CP-1252: 140)
      381,  // Ž Latin capital letter Z with caron (CP-1252: 142)
      //  8216, // ' Left single quotation mark (CP-1252: 145)

      // UNFORTUNATELY SOMETIMES USED INSTEAD OF APOSTROPHE AND VERY HARD TO
      // DEBUG IF WE ENCOUNTER THIS ISSUE, LET'S KEEP IT
      8217, // ' ""curly apostrophe"" or "right single quotation mark" (CP-1252: 146)

      //  8220, // " Left double quotation mark (CP-1252: 147)
      //  8221, // " Right double quotation mark (CP-1252: 148)
      8226, // • Bullet (CP-1252: 149)

      // ============================================
      // HYPHEN / DASH FAMILY - IMPORTANT FOR DEBUGGING
      // ============================================
      // These characters look nearly identical but have different Unicode code points.
      // Including all of them prevents extremely hard-to-debug rendering issues when
      // text is copy-pasted from different sources (Word, web, etc.).
      //
      // | Name        | Char | Unicode | Length            | Common Use                              | Frequency    |
      // |-------------|------|---------|-------------------|-----------------------------------------|--------------|
      // | Hyphen      | -    | U+002D  | short             | Compound words, line breaks, codes      | Very high    |
      // | Minus sign  | −    | U+2212  | short/med (centered) | Math subtraction, equations          | Low (tech)   |
      // | En dash     | –    | U+2013  | medium (≈ "N")    | Ranges (5–10), connections (London–Paris)| Moderate     |
      // | Em dash     | —    | U+2014  | long (≈ "M")      | Breaks in thought, emphasis, asides     | High/rising  |
      //
      // Note: Hyphen (U+002D, code 45) is already included in ASCII printable (32-126).
      8722, // − U+2212 MINUS SIGN - math subtraction (looks like hyphen but vertically centered)
      8211, // – U+2013 EN DASH - ranges and connections (CP-1252: 150)
      8212, // — U+2014 EM DASH - breaks in thought, emphasis (CP-1252: 151)
      //  732,  // ˜ Small tilde (CP-1252: 152)
      // 8482, // ™ Trade mark sign (CP-1252: 153)
      353,  // š Latin small letter s with caron (CP-1252: 154)

      // If someone copy-pastes French quotation marks, that's on them.
      // 8250, // › U+203A SINGLE RIGHT-POINTING ANGLE QUOTATION MARK (CP-1252: 155) - REMOVED: rarely used

      339,  // œ Latin small ligature oe (CP-1252: 156)
      382,  // ž Latin small letter z with caron (CP-1252: 158)
      376   // Ÿ Latin capital letter Y with diaeresis (CP-1252: 159)
    ];

    for (const code of cp1252PrintableChars) {
      chars.push(String.fromCharCode(code));
    }

    // Latin-1 Supplement characters (161-255)
    // These are properly defined in UTF-8/Unicode
    // Excluded characters:
    const latin1Exclusions = new Set([
      173, // U+00AD - soft hyphen (zero width)
      164, // U+00A4 ¤ - CURRENCY SIGN (rarely used generic currency symbol)
      165, // U+00A5 ¥ - YEN SIGN (currency-specific)
      166, // U+00A6 ¦ - BROKEN BAR (legacy character)
      168, // U+00A8 ¨ - DIAERESIS (standalone modifier, not useful without base char)
      169, // U+00A9 © - COPYRIGHT SIGN (use text "(c)" or proper legal formatting)
      170, // U+00AA ª - FEMININE ORDINAL INDICATOR (Spanish/Portuguese specific)
      171, // U+00AB « - LEFT-POINTING DOUBLE ANGLE QUOTATION MARK (use standard quotes)
      172, // U+00AC ¬ - NOT SIGN (mathematical/logical, rarely used in text)
      174, // U+00AE ® - REGISTERED SIGN (use text "(R)" or proper legal formatting)
      175, // U+00AF ¯ - MACRON (standalone modifier, not useful without base char)
      176, // U+00B0 ° - DEGREE SIGN (specialized symbol)
      177, // U+00B1 ± - PLUS-MINUS SIGN (mathematical)
      178, // U+00B2 ² - SUPERSCRIPT TWO (use proper superscript formatting)
      179, // U+00B3 ³ - SUPERSCRIPT THREE (use proper superscript formatting)
      180, // U+00B4 ´ - ACUTE ACCENT (standalone modifier, not useful without base char)
      181, // U+00B5 µ - MICRO SIGN (use Greek mu or unit formatting)
      184, // U+00B8 ¸ - CEDILLA (standalone modifier, not useful without base char)
      185, // U+00B9 ¹ - SUPERSCRIPT ONE (use proper superscript formatting)
      186, // U+00BA º - MASCULINE ORDINAL INDICATOR (Spanish/Portuguese specific)
      187, // U+00BB » - RIGHT-POINTING DOUBLE ANGLE QUOTATION MARK (use standard quotes)
      188, // U+00BC ¼ - VULGAR FRACTION ONE QUARTER (use proper fraction formatting)
      189, // U+00BD ½ - VULGAR FRACTION ONE HALF (use proper fraction formatting)
      190, // U+00BE ¾ - VULGAR FRACTION THREE QUARTERS (use proper fraction formatting)
      215, // U+00D7 × - MULTIPLICATION SIGN (use 'x' or proper math formatting)
      247, // U+00F7 ÷ - DIVISION SIGN (use '/' or proper math formatting)
    ]);

    for (let i = 161; i <= 255; i++) {
      if (!latin1Exclusions.has(i)) {
        chars.push(String.fromCharCode(i));
      }
    }

    // Add Full Block character (allows us to see the maximum space taken by a glyph)
    chars.push('█');

    // Sort the character set (this is how it's used throughout the codebase)
    return chars.sort().join('');
  }
}
