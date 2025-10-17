// Static utility class for minifying font metrics data (build-time only)
// Converts verbose object structures to compact format for smaller file sizes
// NOTE: Requires DEFAULT_CHARACTER_SET.js to be loaded first

class MetricsMinifier {
  // Private constructor - prevent instantiation following Effective Java patterns
  constructor() {
    throw new Error('MetricsMinifier cannot be instantiated - use static methods');
  }
  
  /**
   * Minifies font metrics data for smaller file size
   * TIER 2 OPTIMIZATION: Array-based glyph encoding
   * TIER 3 OPTIMIZATION: Omits 'c' field when character set matches DEFAULT_CHARACTER_SET
   * @param {Object} metricsData - Full metrics object containing kerningTable, characterMetrics, etc.
   * @returns {Object} Minified metrics with shortened keys and compacted structure
   */
  static minify(metricsData) {
    const characterOrder = Object.keys(metricsData.characterMetrics).join('');
    const result = {
      k: this.#minifyKerningTable(metricsData.kerningTable, characterOrder),
      b: this.#extractMetricsCommonToAllCharacters(metricsData.characterMetrics),
      g: this.#minifyCharacterMetrics(metricsData.characterMetrics),
      s: metricsData.spaceAdvancementOverrideForSmallSizesInPx
    };

    // TIER 3: Only include 'c' field if character set differs from DEFAULT_CHARACTER_SET
    // This saves 208 bytes when using the standard character set
    if (characterOrder !== DEFAULT_CHARACTER_SET) {
      result.c = characterOrder;
    }

    return result;
  }

  /**
   * Minifies font metrics data with automatic roundtrip verification
   * This is the RECOMMENDED method for font-assets-builder to catch compression bugs immediately
   *
   * Process:
   * 1. Minify the metrics data
   * 2. Expand it back using MetricsExpander
   * 3. Compare expanded data with original
   * 4. Throw detailed error if mismatch (prevents broken font files)
   * 5. Return minified data if verification passes
   *
   * @param {Object} metricsData - Full metrics object containing kerningTable, characterMetrics, etc.
   * @returns {Object} Minified metrics with verified integrity
   * @throws {Error} If roundtrip verification fails
   */
  static minifyWithVerification(metricsData) {
    // Step 1: Minify
    const minified = this.minify(metricsData);

    // Step 2: Check if MetricsExpander is available
    if (typeof MetricsExpander === 'undefined') {
      console.warn('⚠️  MetricsExpander not loaded - skipping roundtrip verification');
      return minified;
    }

    // Step 3: Expand back
    const expanded = MetricsExpander.expand(minified);

    // Step 4: Verify kerning table
    const originalKerning = metricsData.kerningTable;
    const expandedKerning = expanded._kerningTable;

    // Check all original kerning pairs
    for (const [leftChar, pairs] of Object.entries(originalKerning)) {
      if (!expandedKerning[leftChar]) {
        throw new Error(
          `Roundtrip verification failed: Missing left character "${leftChar}" in expanded kerning table.\n` +
          `This indicates a bug in MetricsMinifier compression or MetricsExpander expansion.`
        );
      }

      for (const [rightChar, value] of Object.entries(pairs)) {
        const expandedValue = expandedKerning[leftChar][rightChar];
        if (expandedValue !== value) {
          throw new Error(
            `Roundtrip verification failed: Kerning mismatch for "${leftChar}/${rightChar}".\n` +
            `Expected: ${value}, Got: ${expandedValue}\n` +
            `This indicates a bug in MetricsMinifier compression or MetricsExpander expansion.`
          );
        }
      }
    }

    // Check for extra kerning pairs in expanded (should not happen)
    for (const [leftChar, pairs] of Object.entries(expandedKerning)) {
      if (!originalKerning[leftChar]) {
        throw new Error(
          `Roundtrip verification failed: Extra left character "${leftChar}" in expanded kerning table.\n` +
          `This indicates a bug in MetricsExpander expansion.`
        );
      }

      for (const rightChar of Object.keys(pairs)) {
        if (!(rightChar in originalKerning[leftChar])) {
          throw new Error(
            `Roundtrip verification failed: Extra kerning pair "${leftChar}/${rightChar}" in expanded data.\n` +
            `This indicates a bug in MetricsExpander expansion.`
          );
        }
      }
    }

    // Step 5: Verify character metrics count
    const originalCharCount = Object.keys(metricsData.characterMetrics).length;
    const expandedCharCount = Object.keys(expanded._characterMetrics).length;

    if (originalCharCount !== expandedCharCount) {
      throw new Error(
        `Roundtrip verification failed: Character count mismatch.\n` +
        `Expected: ${originalCharCount}, Got: ${expandedCharCount}\n` +
        `This indicates a bug in MetricsMinifier or MetricsExpander.`
      );
    }

    // All checks passed!
    console.debug('✅ Roundtrip verification passed - compression integrity verified');
    return minified;
  }

  /**
   * Extracts common metrics shared across all characters
   * so that we don't need to repeat these in the serialised file.
   * Extract these from the first available character
   * @private
   */
  static #extractMetricsCommonToAllCharacters(characterMetrics) {
    const firstChar = Object.keys(characterMetrics)[0];
    const firstGlyph = characterMetrics[firstChar];

    return {
      fba: firstGlyph.fontBoundingBoxAscent,     // fontBoundingBoxAscent
      fbd: firstGlyph.fontBoundingBoxDescent,    // fontBoundingBoxDescent
      hb: firstGlyph.hangingBaseline,            // hangingBaseline
      ab: firstGlyph.alphabeticBaseline,         // alphabeticBaseline
      ib: firstGlyph.ideographicBaseline,        // ideographicBaseline
      pd: firstGlyph.pixelDensity                // pixelDensity (CRITICAL for atlas reconstruction)
    };
  }
  
  /**
   * Converts glyph metrics objects to compact arrays
   * TIER 2 OPTIMIZATION: Returns array of arrays (removes character keys, uses position instead)
   * Array format: [width, actualBoundingBoxLeft, actualBoundingBoxRight, actualBoundingBoxAscent, actualBoundingBoxDescent]
   * Character order is stored separately in 'c' field for reconstruction
   * @private
   */
  static #minifyCharacterMetrics(characterMetrics) {
    // Convert to array of arrays (no character keys)
    // Order preserved via Object.keys(), character order string stored in 'c' field
    return Object.values(characterMetrics).map(glyph => [
      glyph.width,
      glyph.actualBoundingBoxLeft,
      glyph.actualBoundingBoxRight,
      glyph.actualBoundingBoxAscent,
      glyph.actualBoundingBoxDescent
    ]);
  }
  
  /**
   * Minifies kerning table using two-dimensional range notation
   * TIER 3 OPTIMIZATION: Two-pass compression
   *   Pass 1 (right-side): {"A":{"0":20,"1":20}} → {"A":{"0-1":20}}
   *   Pass 2 (left-side):  {"A":{"s":20},"B":{"s":20}} → {"A-B":{"s":20}}
   * @param {Object} kerningTable - Kerning table to minify
   * @param {string} characterOrder - Character order string for range compression
   * @private
   */
  static #minifyKerningTable(kerningTable, characterOrder) {
    // PASS 1: Compress right side (characters that follow)
    const rightCompressed = {};
    for (const [leftChar, pairs] of Object.entries(kerningTable)) {
      rightCompressed[leftChar] = this.#compressKerningPairs(pairs, characterOrder);
    }

    // PASS 2: Compress left side (characters that come before)
    const leftCompressed = this.#compressLeftSide(rightCompressed, characterOrder);

    return leftCompressed;
  }

  /**
   * Compresses kerning pairs by finding consecutive character ranges with same value
   * @param {Object} pairs - Kerning pairs like {"0":20,"1":20,"2":20,...}
   * @param {string} characterOrder - Character order string for range compression
   * @returns {Object} Compressed pairs like {"0-2":20}
   * @private
   */
  static #compressKerningPairs(pairs, characterOrder) {
    if (Object.keys(pairs).length === 0) return {};

    // Build map of value -> array of character indices
    const valueToIndices = {};

    for (const [char, value] of Object.entries(pairs)) {
      const index = characterOrder.indexOf(char);
      if (index === -1) {
        console.warn(`Character "${char}" not found in character order, skipping`);
        continue;
      }

      if (!valueToIndices[value]) {
        valueToIndices[value] = [];
      }
      valueToIndices[value].push(index);
    }

    // For each value, find consecutive ranges
    const compressed = {};

    for (const [value, indices] of Object.entries(valueToIndices)) {
      // Sort indices
      indices.sort((a, b) => a - b);

      // Find consecutive ranges
      const ranges = this.#findConsecutiveRanges(indices);

      // Convert ranges to notation
      for (const range of ranges) {
        if (range.start === 0 && range.end === characterOrder.length - 1) {
          // Special case: Full character set
          const firstChar = characterOrder[0];
          const lastChar = characterOrder[characterOrder.length - 1];
          compressed[`${firstChar}-${lastChar}`] = parseFloat(value);
        } else if (range.start === range.end) {
          // Single character
          compressed[characterOrder[range.start]] = parseFloat(value);
        } else if (range.end === range.start + 1) {
          // Two characters - more efficient as separate entries
          compressed[characterOrder[range.start]] = parseFloat(value);
          compressed[characterOrder[range.end]] = parseFloat(value);
        } else {
          // Range of 3+ characters
          const startChar = characterOrder[range.start];
          const endChar = characterOrder[range.end];
          compressed[`${startChar}-${endChar}`] = parseFloat(value);
        }
      }
    }

    return compressed;
  }

  /**
   * Finds consecutive ranges in sorted array of indices
   * @param {number[]} indices - Sorted array of indices
   * @returns {Array<{start: number, end: number}>} Array of range objects
   * @private
   */
  static #findConsecutiveRanges(indices) {
    if (indices.length === 0) return [];

    const ranges = [];
    let rangeStart = indices[0];
    let rangeEnd = indices[0];

    for (let i = 1; i < indices.length; i++) {
      if (indices[i] === rangeEnd + 1) {
        // Consecutive, extend range
        rangeEnd = indices[i];
      } else {
        // Gap found, save current range and start new one
        ranges.push({ start: rangeStart, end: rangeEnd });
        rangeStart = indices[i];
        rangeEnd = indices[i];
      }
    }

    // Save final range
    ranges.push({ start: rangeStart, end: rangeEnd });

    return ranges;
  }

  /**
   * Compresses left side of kerning table (characters that come before)
   * TIER 3 OPTIMIZATION: Two-dimensional compression pass 2
   * Groups left characters with identical right-side objects and compresses to ranges
   * Example: {"A":{"s":20},"B":{"s":20},"C":{"s":20}} → {"A-C":{"s":20}}
   * @param {Object} kerningTable - Right-compressed kerning table
   * @param {string} characterOrder - Character order string for range compression
   * @returns {Object} Left-compressed kerning table
   * @private
   */
  static #compressLeftSide(kerningTable, characterOrder) {
    // Group left characters by their right-side object signature
    const rightSideToLeftChars = {};

    for (const [leftChar, rightSideObj] of Object.entries(kerningTable)) {
      const signature = JSON.stringify(rightSideObj);
      if (!rightSideToLeftChars[signature]) {
        rightSideToLeftChars[signature] = [];
      }
      rightSideToLeftChars[signature].push(leftChar);
    }

    // For each group, find consecutive ranges and compress
    const compressed = {};

    for (const [signature, leftChars] of Object.entries(rightSideToLeftChars)) {
      const rightSideObj = JSON.parse(signature);

      // Convert left characters to indices in characterOrder
      const indices = leftChars
        .map(char => characterOrder.indexOf(char))
        .filter(idx => idx !== -1)
        .sort((a, b) => a - b);

      // Find consecutive ranges using existing helper
      const ranges = this.#findConsecutiveRanges(indices);

      // Convert ranges to notation (3+ chars → range, 1-2 chars → keep separate)
      for (const range of ranges) {
        if (range.start === range.end) {
          // Single character
          compressed[characterOrder[range.start]] = rightSideObj;
        } else if (range.end === range.start + 1) {
          // Two characters - more efficient as separate entries
          compressed[characterOrder[range.start]] = rightSideObj;
          compressed[characterOrder[range.end]] = rightSideObj;
        } else {
          // Range of 3+ characters
          const startChar = characterOrder[range.start];
          const endChar = characterOrder[range.end];
          compressed[`${startChar}-${endChar}`] = rightSideObj;
        }
      }
    }

    return compressed;
  }

}