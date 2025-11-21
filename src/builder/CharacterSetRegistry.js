/**
 * Registry for tracking custom display character sets per font family.
 *
 * This allows certain fonts (like BitmapTextSymbols) to specify a subset of characters
 * that should be displayed in the font builder UI, even though all 204 standard characters
 * are generated for minifier compatibility.
 *
 * Usage:
 *   // During initialization (from font spec)
 *   CharacterSetRegistry.setDisplayCharacterSet('BitmapTextSymbols', '☺☹♠♡♦♣│─├└▶▼▲◀✔✘≠↗');
 *
 *   // During font building
 *   const displayChars = CharacterSetRegistry.getDisplayCharacterSet('BitmapTextSymbols');
 *   // Returns: '☺☹♠♡♦♣│─├└▶▼▲◀✔✘≠↗'
 *
 */
class CharacterSetRegistry {
  /**
   * Map: fontFamily (string) → display character set (string)
   * Only stores fonts with custom character sets
   * @type {Map<string, string>}
   */
  static #displayCharacterSets = new Map();

  /**
   * Set the display character set for a font family.
   * These are the characters that should be shown in the UI for this font.
   *
   * @param {string} fontFamily - Font family name (e.g., 'BitmapTextSymbols')
   * @param {string} characters - String of characters to display (e.g., '☺☹♠♡...')
   */
  static setDisplayCharacterSet(fontFamily, characters) {
    if (typeof fontFamily !== 'string' || fontFamily.length === 0) {
      throw new Error('CharacterSetRegistry: fontFamily must be a non-empty string');
    }
    if (typeof characters !== 'string' || characters.length === 0) {
      throw new Error('CharacterSetRegistry: characters must be a non-empty string');
    }
    CharacterSetRegistry.#displayCharacterSets.set(fontFamily, characters);
  }

  /**
   * Get the display character set for a font family.
   * Returns null if the font uses the standard 204-character set.
   *
   * @param {string} fontFamily - Font family name
   * @returns {string|null} Character string if custom set exists, null otherwise
   */
  static getDisplayCharacterSet(fontFamily) {
    return CharacterSetRegistry.#displayCharacterSets.get(fontFamily) || null;
  }

  /**
   * Clear all custom character sets.
   * Useful for testing or reinitialization.
   */
  static clear() {
    CharacterSetRegistry.#displayCharacterSets.clear();
  }
}
