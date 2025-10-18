// Static utility class for expanding minified font metrics data (runtime only)
// Converts compact format back to FontMetrics instances for use by the rendering engine
// NOTE: Requires src/runtime/CHARACTER_SET.js to be loaded first

class MetricsExpander {
  // Private constructor - prevent instantiation following Effective Java patterns
  constructor() {
    throw new Error('MetricsExpander cannot be instantiated - use static methods');
  }
  
  /**
   * Expands minified metrics back to FontMetrics instance for runtime use
   * TIER 2 OPTIMIZATION: Array-based glyph reconstruction
   * TIER 3 OPTIMIZATION: Two-dimensional kerning range expansion
   * TIER 4 OPTIMIZATION: Value indexing (looks up actual values from indices)
   *
   * REQUIRES: Minified data must NOT contain 'c' field (always uses CHARACTER_SET)
   * REQUIRES: Minified data must contain 'kv' field (kerning value lookup table)
   * REQUIRES: Minified data must contain 'v' field (glyph value lookup table)
   *
   * @param {Object} minified - Minified metrics object with 'kv', 'k', 'v', 'g', 'b', 's'
   * @returns {FontMetrics} FontMetrics instance with expanded data
   * @throws {Error} If 'c', 'kv', or 'v' fields are missing/invalid
   */
  static expand(minified) {
    // Check if FontMetrics class is available (for cases where loaded as standalone)
    if (typeof FontMetrics === 'undefined') {
      throw new Error('FontMetrics class not found. Please ensure FontMetrics.js is loaded before MetricsExpander.js');
    }

    // Reject legacy format with 'c' field
    if (minified.c) {
      throw new Error(
        `Legacy minified format detected - 'c' field present.\n` +
        `This file was generated with an old character order and is no longer supported.\n` +
        `Please regenerate font assets using the current font-assets-builder.`
      );
    }

    // Require value lookup tables (Tier 4 optimization)
    if (!minified.v) {
      throw new Error(
        `Missing glyph value lookup table ('v' field).\n` +
        `This file was generated with an old format and is no longer supported.\n` +
        `Please regenerate font assets using the current font-assets-builder.`
      );
    }

    if (!minified.kv) {
      throw new Error(
        `Missing kerning value lookup table ('kv' field).\n` +
        `This file was generated with an old format and is no longer supported.\n` +
        `Please regenerate font assets using the current font-assets-builder.`
      );
    }

    const expandedData = {
      kerningTable: this.#expandKerningTable(minified.k, minified.kv),
      characterMetrics: this.#expandCharacterMetrics(minified.g, minified.b, minified.v),
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
   * TIER 4 OPTIMIZATION: Value indexing (looks up actual kerning values from indices)
   *   Pass 1 (left-side):  {"A-B":{"s":0}} → {"A":{"s":0},"B":{"s":0}}
   *   Pass 2 (right-side): {"A":{"0-1":0}} → {"A":{"0":0,"1":0}}
   *   Pass 3 (values):     {"A":{"s":0}} → {"A":{"s":20}} (lookup from kerningValueLookup[0])
   * Always uses CHARACTER_SET for range expansion
   * Later entries override earlier ones, allowing exceptions to ranges
   * @param {Object} minified - Minified kerning table with indexed values
   * @param {Array} kerningValueLookup - Value lookup table for kerning values
   * @private
   */
  static #expandKerningTable(minified, kerningValueLookup) {
    // PASS 1: Expand left side (characters that come before)
    const leftExpanded = this.#expandLeftSide(minified);

    // PASS 2: Expand right side (characters that follow)
    const rangeExpanded = {};
    for (const [leftChar, pairs] of Object.entries(leftExpanded)) {
      rangeExpanded[leftChar] = this.#expandKerningPairs(pairs);
    }

    // PASS 3 (TIER 4): Replace all indices with actual values from lookup table
    const expanded = {};
    for (const [leftChar, pairs] of Object.entries(rangeExpanded)) {
      expanded[leftChar] = {};
      for (const [rightChar, index] of Object.entries(pairs)) {
        expanded[leftChar][rightChar] = kerningValueLookup[index];
      }
    }

    return expanded;
  }

  /**
   * Expands left side of kerning table (characters that come before)
   * TIER 3 OPTIMIZATION: Two-dimensional expansion pass 1
   * Handles left-side range notation like "A-C":{"s":20} → {"A":{"s":20},"B":{"s":20},"C":{"s":20}}
   * Always uses CHARACTER_SET for range expansion
   * @param {Object} minified - Minified kerning table with potential left-side ranges
   * @returns {Object} Left-expanded kerning table
   * @private
   */
  static #expandLeftSide(minified) {
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
          const startIndex = CHARACTER_SET.indexOf(startChar);
          const endIndex = CHARACTER_SET.indexOf(endChar);

          if (startIndex !== -1 && endIndex !== -1 && startIndex <= endIndex) {
            // Valid range, expand it
            for (let i = startIndex; i <= endIndex; i++) {
              expanded[CHARACTER_SET[i]] = rightSideObj;
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
   * Always uses CHARACTER_SET for range expansion
   * @param {Object} pairs - Compressed pairs like {"0-█":20} or {"A":10,"B-D":20}
   * @returns {Object} Expanded pairs like {"0":20,"1":20,...,"█":20}
   * @private
   */
  static #expandKerningPairs(pairs) {
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
          const startIndex = CHARACTER_SET.indexOf(startChar);
          const endIndex = CHARACTER_SET.indexOf(endChar);

          if (startIndex !== -1 && endIndex !== -1 && startIndex <= endIndex) {
            // Valid range, expand it
            for (let i = startIndex; i <= endIndex; i++) {
              expanded[CHARACTER_SET[i]] = value;
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
   * TIER 2 OPTIMIZATION: Reconstructs from array of arrays using CHARACTER_SET
   * TIER 4 OPTIMIZATION: Looks up actual values from indices using valueLookup table
   * Reconstructs full TextMetrics-compatible objects from compact arrays
   * Always uses CHARACTER_SET for character order
   * @param {Array} minifiedGlyphs - Array of metric index arrays
   * @param {Object} metricsCommonToAllCharacters - Common metrics shared across all characters
   * @param {Array} valueLookup - Value lookup table mapping indices to actual values
   * @private
   */
  static #expandCharacterMetrics(minifiedGlyphs, metricsCommonToAllCharacters, valueLookup) {
    const expanded = {};

    // Convert CHARACTER_SET string to array of characters
    const chars = Array.from(CHARACTER_SET);

    // Reconstruct object by mapping array positions to characters
    chars.forEach((char, index) => {
      const indices = minifiedGlyphs[index];

      // TIER 4: Look up actual values from indices
      const width = valueLookup[indices[0]];
      const actualBoundingBoxLeft = valueLookup[indices[1]];
      const actualBoundingBoxRight = valueLookup[indices[2]];
      const actualBoundingBoxAscent = valueLookup[indices[3]];
      const actualBoundingBoxDescent = valueLookup[indices[4]];

      expanded[char] = {
        // Glyph-specific metrics looked up from value table
        width,
        actualBoundingBoxLeft,
        actualBoundingBoxRight,
        actualBoundingBoxAscent,
        actualBoundingBoxDescent,

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