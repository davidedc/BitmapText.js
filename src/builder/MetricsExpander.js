// Static utility class for expanding minified font metrics data (runtime only)
// Converts compact format back to FontMetrics instances for use by the rendering engine
// NOTE: Requires DEFAULT_CHARACTER_SET.js to be loaded first

class MetricsExpander {
  // Private constructor - prevent instantiation following Effective Java patterns
  constructor() {
    throw new Error('MetricsExpander cannot be instantiated - use static methods');
  }
  
  /**
   * Expands minified metrics back to FontMetrics instance for runtime use
   * TIER 2 OPTIMIZATION: Array-based glyph reconstruction
   * TIER 3 OPTIMIZATION: Uses DEFAULT_CHARACTER_SET when 'c' field is missing
   * @param {Object} minified - Minified metrics object with shortened keys
   * @returns {FontMetrics} FontMetrics instance with expanded data
   */
  static expand(minified) {
    // Check if FontMetrics class is available (for cases where loaded as standalone)
    if (typeof FontMetrics === 'undefined') {
      throw new Error('FontMetrics class not found. Please ensure FontMetrics.js is loaded before MetricsExpander.js');
    }

    // TIER 3: Use DEFAULT_CHARACTER_SET if 'c' field is missing (backward compatible)
    const characterOrder = minified.c || DEFAULT_CHARACTER_SET;

    const expandedData = {
      kerningTable: this.#expandKerningTable(minified.k, characterOrder),
      characterMetrics: this.#expandCharacterMetrics(minified.g, characterOrder, minified.b),
      spaceAdvancementOverrideForSmallSizesInPx: minified.s
    };

    // Verify pixelDensity was preserved
    const firstChar = Object.keys(expandedData.characterMetrics)[0];
    const pixelDensity = expandedData.characterMetrics[firstChar]?.pixelDensity;
    console.debug(`🔍 MetricsExpander: Restored pixelDensity=${pixelDensity} for ${Object.keys(expandedData.characterMetrics).length} characters`);

    return new FontMetrics(expandedData);
  }
  
  /**
   * Expands kerning table with range notation support
   * TIER 3 OPTIMIZATION: Two-dimensional expansion (reverse order of compression)
   *   Pass 1 (left-side):  {"A-B":{"s":20}} → {"A":{"s":20},"B":{"s":20}}
   *   Pass 2 (right-side): {"A":{"0-1":20}} → {"A":{"0":20,"1":20}}
   * Later entries override earlier ones, allowing exceptions to ranges
   * @param {Object} minified - Minified kerning table
   * @param {string} characterOrder - Character order string for range expansion
   * @private
   */
  static #expandKerningTable(minified, characterOrder) {
    // PASS 1: Expand left side (characters that come before)
    const leftExpanded = this.#expandLeftSide(minified, characterOrder);

    // PASS 2: Expand right side (characters that follow)
    const expanded = {};
    for (const [leftChar, pairs] of Object.entries(leftExpanded)) {
      expanded[leftChar] = this.#expandKerningPairs(pairs, characterOrder);
    }

    return expanded;
  }

  /**
   * Expands left side of kerning table (characters that come before)
   * TIER 3 OPTIMIZATION: Two-dimensional expansion pass 1
   * Handles left-side range notation like "A-C":{"s":20} → {"A":{"s":20},"B":{"s":20},"C":{"s":20}}
   * @param {Object} minified - Minified kerning table with potential left-side ranges
   * @param {string} characterOrder - Character order string for range expansion
   * @returns {Object} Left-expanded kerning table
   * @private
   */
  static #expandLeftSide(minified, characterOrder) {
    const expanded = {};

    // Process entries in order so later entries can override earlier ones
    for (const [key, rightSideObj] of Object.entries(minified)) {
      if (key.includes('-') && key.length >= 3) {
        // Potential range notation (e.g., "A-Z" or "0-9")
        const hyphenIndex = key.indexOf('-');
        const startChar = key.substring(0, hyphenIndex);
        const endChar = key.substring(hyphenIndex + 1);

        // Check if both start and end are single characters in the character set
        if (startChar.length === 1 && endChar.length === 1) {
          const startIndex = characterOrder.indexOf(startChar);
          const endIndex = characterOrder.indexOf(endChar);

          if (startIndex !== -1 && endIndex !== -1 && startIndex <= endIndex) {
            // Valid range, expand it
            for (let i = startIndex; i <= endIndex; i++) {
              expanded[characterOrder[i]] = rightSideObj;
            }
            continue;
          }
        }
      }

      // Not a range, or invalid range - treat as literal character
      expanded[key] = rightSideObj;
    }

    return expanded;
  }

  /**
   * Expands kerning pairs from range notation to individual character pairs
   * @param {Object} pairs - Compressed pairs like {"0-█":20} or {"A":10,"B-D":20}
   * @param {string} characterOrder - Character order string for range expansion
   * @returns {Object} Expanded pairs like {"0":20,"1":20,...,"█":20}
   * @private
   */
  static #expandKerningPairs(pairs, characterOrder) {
    const expanded = {};

    // Process entries in order so later entries can override earlier ones
    for (const [key, value] of Object.entries(pairs)) {
      if (key.includes('-') && key.length >= 3) {
        // Potential range notation (e.g., "A-Z" or "0-█")
        const hyphenIndex = key.indexOf('-');
        const startChar = key.substring(0, hyphenIndex);
        const endChar = key.substring(hyphenIndex + 1);

        // Check if both start and end are single characters in the character set
        if (startChar.length === 1 && endChar.length === 1) {
          const startIndex = characterOrder.indexOf(startChar);
          const endIndex = characterOrder.indexOf(endChar);

          if (startIndex !== -1 && endIndex !== -1 && startIndex <= endIndex) {
            // Valid range, expand it
            for (let i = startIndex; i <= endIndex; i++) {
              expanded[characterOrder[i]] = value;
            }
            continue;
          }
        }
      }

      // Not a range, or invalid range - treat as literal character
      expanded[key] = value;
    }

    return expanded;
  }
  
  /**
   * Expands glyph metrics from arrays back to full objects
   * TIER 2 OPTIMIZATION: Reconstructs from array of arrays using character order string
   * Reconstructs full TextMetrics-compatible objects from compact arrays
   * @param {Array} minifiedGlyphs - Array of metric arrays
   * @param {string} characterOrder - String containing character order (e.g., "0123456789abc...")
   * @param {Object} metricsCommonToAllCharacters - Common metrics shared across all characters
   * @private
   */
  static #expandCharacterMetrics(minifiedGlyphs, characterOrder, metricsCommonToAllCharacters) {
    const expanded = {};

    // Convert character order string to array of characters
    const chars = Array.from(characterOrder);

    // Reconstruct object by mapping array positions to characters
    chars.forEach((char, index) => {
      const metrics = minifiedGlyphs[index];
      expanded[char] = {
        // Glyph-specific metrics from the array
        width: metrics[0],
        actualBoundingBoxLeft: metrics[1],
        actualBoundingBoxRight: metrics[2],
        actualBoundingBoxAscent: metrics[3],
        actualBoundingBoxDescent: metrics[4],

        // Copy over the metrics common to all characters.
        // This is a bit of a waste of memory, however this object needs to
        // look as much as possible like a TextMetrics object, and this
        // is what it looks like.
        fontBoundingBoxAscent: metricsCommonToAllCharacters.fba,
        fontBoundingBoxDescent: metricsCommonToAllCharacters.fbd,
        emHeightAscent: metricsCommonToAllCharacters.fba,          // Same as fontBoundingBoxAscent
        emHeightDescent: metricsCommonToAllCharacters.fbd,         // Same as fontBoundingBoxDescent
        hangingBaseline: metricsCommonToAllCharacters.hb,
        alphabeticBaseline: metricsCommonToAllCharacters.ab,
        ideographicBaseline: metricsCommonToAllCharacters.ib,
        pixelDensity: metricsCommonToAllCharacters.pd              // pixelDensity (CRITICAL for atlas reconstruction)
      };
    });
    return expanded;
  }
  
}