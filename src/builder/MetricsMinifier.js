// Static utility class for minifying font metrics data (build-time only)
// Converts verbose object structures to compact format for smaller file sizes
// NOTE: Requires src/runtime/CHARACTER_SET.js to be loaded first

class MetricsMinifier {
  // Private constructor - prevent instantiation following Effective Java patterns
  constructor() {
    throw new Error('MetricsMinifier cannot be instantiated - use static methods');
  }
  
  /**
   * Minifies font metrics data for smaller file size
   * TIER 2 OPTIMIZATION: Array-based glyph encoding
   * TIER 3 OPTIMIZATION: Two-dimensional kerning range compression
   * TIER 4 OPTIMIZATION: Value indexing (replaces repeated metric values with indices)
   *
   * REQUIRES: metricsData.characterMetrics must contain ALL 204 characters from CHARACTER_SET
   *
   * @param {Object} metricsData - Full metrics object containing kerningTable, characterMetrics, etc.
   * @returns {Object} Minified metrics with 'v' (value lookup), 'g' (indexed glyphs), 'k', 'b', 's'
   * @throws {Error} If not all 204 characters are present
   */
  static minify(metricsData) {
    // Validate that ALL 204 characters from CHARACTER_SET are present
    // Note: We DON'T use Object.keys() because JavaScript reorders numeric keys
    // Instead, we iterate through CHARACTER_SET and check each character exists
    const missingChars = [];
    for (const char of CHARACTER_SET) {
      if (!(char in metricsData.characterMetrics)) {
        missingChars.push(char);
      }
    }

    if (missingChars.length > 0) {
      throw new Error(
        `MetricsMinifier requires ALL 204 characters from CHARACTER_SET.\n` +
        `Missing ${missingChars.length} characters: ${missingChars.slice(0, 10).join(', ')}${missingChars.length > 10 ? '...' : ''}\n` +
        `Please ensure font-assets-builder generates ALL 204 characters.`
      );
    }

    // Check for extra characters not in CHARACTER_SET
    const extraChars = Object.keys(metricsData.characterMetrics).filter(
      char => !CHARACTER_SET.includes(char)
    );

    if (extraChars.length > 0) {
      throw new Error(
        `Font contains ${extraChars.length} characters not in CHARACTER_SET: ${extraChars.join(', ')}\n` +
        `Please update src/runtime/CHARACTER_SET.js to include these characters.`
      );
    }

    // TIER 4: Create value lookup table and indexed glyph arrays
    const { valueLookup, indexedGlyphs } = this.#createValueLookupTable(
      metricsData.characterMetrics
    );

    // TIER 4: Create kerning value lookup table and indexed kerning table
    const { kerningValueLookup, indexedKerningTable } = this.#createKerningValueLookupTable(
      metricsData.kerningTable
    );

    // Minify with value indexing (Tier 4 optimization)
    return {
      kv: kerningValueLookup,  // TIER 4: Kerning value lookup table
      k: indexedKerningTable,  // TIER 4: Kerning table with indexed values
      b: this.#extractMetricsCommonToAllCharacters(metricsData.characterMetrics),
      v: valueLookup,          // TIER 4: Glyph value lookup table
      g: indexedGlyphs,        // TIER 4: Glyph arrays now contain indices instead of raw values
      s: metricsData.spaceAdvancementOverrideForSmallSizesInPx
    };
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
   * Extract these from the first character in CHARACTER_SET (space)
   * @private
   */
  static #extractMetricsCommonToAllCharacters(characterMetrics) {
    // Use first character from CHARACTER_SET (space character)
    const firstChar = CHARACTER_SET[0];
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
   * Creates value lookup table and converts glyph metrics to indexed arrays with tuplet compression
   * TIER 4 OPTIMIZATION: Value indexing - replaces repeated metric values with indices
   * TIER 5 OPTIMIZATION: Tuplet compression - reduces tuplet length from 5 to 3/4/5 based on redundancy
   *
   * Strategy: Assign shortest indices to values with highest (occurrence_count × string_length)
   * This maximizes savings because frequently-occurring long values get 1-digit indices
   *
   * Tuplet compression:
   *   - Case C (3 elements): w===r AND l===d  →  [w, l, a]
   *   - Case B (4 elements): w===r only       →  [w, l, a, d]
   *   - Case A (5 elements): no compression   →  [w, l, r, a, d]
   *
   * @param {Object} characterMetrics - Character metrics object with all 204 characters
   * @returns {Object} Object with valueLookup array and indexedGlyphs array (variable-length tuplets)
   * @private
   */
  static #createValueLookupTable(characterMetrics) {
    // Step 1: Collect all unique values and count occurrences
    const valueOccurrences = new Map(); // value -> count

    for (const char of CHARACTER_SET) {
      const glyph = characterMetrics[char];
      const values = [
        glyph.width,
        glyph.actualBoundingBoxLeft,
        glyph.actualBoundingBoxRight,
        glyph.actualBoundingBoxAscent,
        glyph.actualBoundingBoxDescent
      ];

      for (const value of values) {
        valueOccurrences.set(value, (valueOccurrences.get(value) || 0) + 1);
      }
    }

    // Step 2: Calculate scores and sort by savings potential
    // Score = occurrences × string_length (higher = more savings from short index)
    const valueScores = Array.from(valueOccurrences.entries()).map(([value, count]) => {
      const stringLength = JSON.stringify(value).length;
      const score = count * stringLength;
      return { value, count, stringLength, score };
    });

    // Sort by score DESCENDING (highest savings first)
    // Top 10 values get indices 0-9 (1 char)
    // Next 90 values get indices 10-99 (2 chars)
    // Remaining values get indices 100+ (3+ chars)
    valueScores.sort((a, b) => b.score - a.score);

    // Step 3: Create value lookup table (sorted by score)
    const valueLookup = valueScores.map(vs => vs.value);

    // Step 4: Create value-to-index map for fast lookup during indexing
    const valueToIndex = new Map();
    valueLookup.forEach((value, index) => {
      valueToIndex.set(value, index);
    });

    // Step 5: Convert glyph arrays to indices and compress tuplets (TIER 5)
    const indexedGlyphs = Array.from(CHARACTER_SET).map(char => {
      const glyph = characterMetrics[char];
      const indices = [
        valueToIndex.get(glyph.width),                      // 0: width
        valueToIndex.get(glyph.actualBoundingBoxLeft),      // 1: left
        valueToIndex.get(glyph.actualBoundingBoxRight),     // 2: right
        valueToIndex.get(glyph.actualBoundingBoxAscent),    // 3: ascent
        valueToIndex.get(glyph.actualBoundingBoxDescent)    // 4: descent
      ];

      // TIER 5: Tuplet compression based on redundancy patterns
      const widthEqualsRight = indices[0] === indices[2];   // w === r
      const leftEqualsDescent = indices[1] === indices[4];  // l === d

      if (widthEqualsRight && leftEqualsDescent) {
        // Case C: Both conditions met - compress to 3 elements [w, l, a]
        return [indices[0], indices[1], indices[3]];
      }
      else if (widthEqualsRight) {
        // Case B: Only width === right - compress to 4 elements [w, l, a, d]
        return [indices[0], indices[1], indices[3], indices[4]];
      }
      else {
        // Case A: No compression - keep all 5 elements [w, l, r, a, d]
        return indices;
      }
    });

    // Log compression statistics
    let caseC = 0, caseB = 0, caseA = 0;
    for (const tuplet of indexedGlyphs) {
      if (tuplet.length === 3) caseC++;
      else if (tuplet.length === 4) caseB++;
      else caseA++;
    }
    const savedIndices = 1020 - (caseC * 3 + caseB * 4 + caseA * 5);
    console.debug(`🗜️  Tuplet compression: ${caseC} × 3-elem, ${caseB} × 4-elem, ${caseA} × 5-elem (saved ${savedIndices} indices)`);

    return {
      valueLookup,
      indexedGlyphs
    };
  }

  /**
   * Creates kerning value lookup table and replaces kerning values with indices
   * TIER 4 OPTIMIZATION: Value indexing for kerning table
   *
   * Strategy: Same as glyph value indexing - assign shortest indices to values
   * with highest (occurrence_count × string_length)
   *
   * @param {Object} kerningTable - Original kerning table with numeric values
   * @returns {Object} Object with kerningValueLookup array and indexedKerningTable
   * @private
   */
  static #createKerningValueLookupTable(kerningTable) {
    // Step 1: Collect all unique kerning values and count occurrences
    const valueOccurrences = new Map();

    for (const [leftChar, pairs] of Object.entries(kerningTable)) {
      for (const [rightChar, value] of Object.entries(pairs)) {
        valueOccurrences.set(value, (valueOccurrences.get(value) || 0) + 1);
      }
    }

    // Step 2: Calculate scores and sort by savings potential
    const valueScores = Array.from(valueOccurrences.entries()).map(([value, count]) => {
      const stringLength = JSON.stringify(value).length;
      const score = count * stringLength;
      return { value, count, stringLength, score };
    });

    // Sort by score DESCENDING (highest savings first)
    valueScores.sort((a, b) => b.score - a.score);

    // Step 3: Create kerning value lookup table
    const kerningValueLookup = valueScores.map(vs => vs.value);

    // Step 4: Create value-to-index map
    const valueToIndex = new Map();
    kerningValueLookup.forEach((value, index) => {
      valueToIndex.set(value, index);
    });

    // Step 5: Apply 2D compression with indexed values
    // First, replace all values with indices
    const indexedTable = {};
    for (const [leftChar, pairs] of Object.entries(kerningTable)) {
      indexedTable[leftChar] = {};
      for (const [rightChar, value] of Object.entries(pairs)) {
        indexedTable[leftChar][rightChar] = valueToIndex.get(value);
      }
    }

    // Then apply 2D range compression on the indexed table
    const indexedKerningTable = this.#minifyKerningTable(indexedTable);

    return {
      kerningValueLookup,
      indexedKerningTable
    };
  }

  /**
   * Converts glyph metrics objects to compact arrays
   * TIER 2 OPTIMIZATION: Returns array of arrays (removes character keys, uses position instead)
   * Array format: [width, actualBoundingBoxLeft, actualBoundingBoxRight, actualBoundingBoxAscent, actualBoundingBoxDescent]
   * Always uses CHARACTER_SET order (all 204 characters)
   * @deprecated This method is replaced by #createValueLookupTable (Tier 4 optimization)
   * @private
   */
  static #minifyCharacterMetrics(characterMetrics) {
    // Convert to array of arrays in CHARACTER_SET order
    // IMPORTANT: Must iterate through CHARACTER_SET, not Object.keys/values
    // because JavaScript reorders numeric string keys ("0"-"9")
    return Array.from(CHARACTER_SET).map(char => {
      const glyph = characterMetrics[char];
      return [
        glyph.width,
        glyph.actualBoundingBoxLeft,
        glyph.actualBoundingBoxRight,
        glyph.actualBoundingBoxAscent,
        glyph.actualBoundingBoxDescent
      ];
    });
  }
  
  /**
   * Minifies kerning table using two-dimensional range notation
   * TIER 3 OPTIMIZATION: Two-pass compression
   *   Pass 1 (right-side): {"A":{"0":20,"1":20}} → {"A":{"0-1":20}}
   *   Pass 2 (left-side):  {"A":{"s":20},"B":{"s":20}} → {"A-B":{"s":20}}
   * Always uses CHARACTER_SET for range compression
   * @param {Object} kerningTable - Kerning table to minify
   * @private
   */
  static #minifyKerningTable(kerningTable) {
    // PASS 1: Compress right side (characters that follow)
    const rightCompressed = {};
    for (const [leftChar, pairs] of Object.entries(kerningTable)) {
      rightCompressed[leftChar] = this.#compressKerningPairs(pairs);
    }

    // PASS 2: Compress left side (characters that come before)
    const leftCompressed = this.#compressLeftSide(rightCompressed);

    return leftCompressed;
  }

  /**
   * Compresses kerning pairs by finding consecutive character ranges with same value
   * Always uses CHARACTER_SET for range compression
   * @param {Object} pairs - Kerning pairs like {"0":20,"1":20,"2":20,...}
   * @returns {Object} Compressed pairs like {"0-2":20}
   * @private
   */
  static #compressKerningPairs(pairs) {
    if (Object.keys(pairs).length === 0) return {};

    // Build map of value -> array of character indices
    const valueToIndices = {};

    for (const [char, value] of Object.entries(pairs)) {
      const index = CHARACTER_SET.indexOf(char);
      if (index === -1) {
        console.warn(`Character "${char}" not found in CHARACTER_SET, skipping`);
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
        if (range.start === 0 && range.end === CHARACTER_SET.length - 1) {
          // Special case: Full character set
          const firstChar = CHARACTER_SET[0];
          const lastChar = CHARACTER_SET[CHARACTER_SET.length - 1];
          compressed[`${firstChar}-${lastChar}`] = parseFloat(value);
        } else if (range.start === range.end) {
          // Single character
          compressed[CHARACTER_SET[range.start]] = parseFloat(value);
        } else if (range.end === range.start + 1) {
          // Two characters - more efficient as separate entries
          compressed[CHARACTER_SET[range.start]] = parseFloat(value);
          compressed[CHARACTER_SET[range.end]] = parseFloat(value);
        } else {
          // Range of 3+ characters
          const startChar = CHARACTER_SET[range.start];
          const endChar = CHARACTER_SET[range.end];
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
   * Always uses CHARACTER_SET for range compression
   * Example: {"A":{"s":20},"B":{"s":20},"C":{"s":20}} → {"A-C":{"s":20}}
   * @param {Object} kerningTable - Right-compressed kerning table
   * @returns {Object} Left-compressed kerning table
   * @private
   */
  static #compressLeftSide(kerningTable) {
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

      // Convert left characters to indices in CHARACTER_SET
      const indices = leftChars
        .map(char => CHARACTER_SET.indexOf(char))
        .filter(idx => idx !== -1)
        .sort((a, b) => a - b);

      // Find consecutive ranges using existing helper
      const ranges = this.#findConsecutiveRanges(indices);

      // Convert ranges to notation (3+ chars → range, 1-2 chars → keep separate)
      for (const range of ranges) {
        if (range.start === range.end) {
          // Single character
          compressed[CHARACTER_SET[range.start]] = rightSideObj;
        } else if (range.end === range.start + 1) {
          // Two characters - more efficient as separate entries
          compressed[CHARACTER_SET[range.start]] = rightSideObj;
          compressed[CHARACTER_SET[range.end]] = rightSideObj;
        } else {
          // Range of 3+ characters
          const startChar = CHARACTER_SET[range.start];
          const endChar = CHARACTER_SET[range.end];
          compressed[`${startChar}-${endChar}`] = rightSideObj;
        }
      }
    }

    return compressed;
  }

}