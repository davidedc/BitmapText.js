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
   * TIER 5 OPTIMIZATION: Tuplet deduplication (looks up tuplets from indices)
   * TIER 6 OPTIMIZATION: Additional space optimizations (baseline/top-level arrays, tuplet flattening, integer values)
   *
   * @param {Array|Object} minified - Minified metrics (Tier 6: array, Tier 5: object)
   * @returns {FontMetrics} FontMetrics instance with expanded data
   * @throws {Error} If invalid format detected
   */
  static expand(minified) {
    // Check if FontMetrics class is available (for cases where loaded as standalone)
    if (typeof FontMetrics === 'undefined') {
      throw new Error('FontMetrics class not found. Please ensure FontMetrics.js is loaded before MetricsExpander.js');
    }

    // TIER 6+6b: Detect array format (new) vs object format (old)
    let kv, k, b, v, t, g, s, cl;

    if (Array.isArray(minified)) {
      // TIER 6/6b: Array format [kv, k, b, v, t, g, s] or [kv, k, b, v, t, g, s, cl]
      if (minified.length !== 7 && minified.length !== 8) {
        throw new Error(
          `Invalid Tier 6 array format - expected 7 or 8 elements, got ${minified.length}.\n` +
          `This indicates a corrupted font file. Please regenerate font assets.`
        );
      }

      // Extract values from array (Tier 6/6b format)
      if (minified.length === 8) {
        // TIER 6b: 8-element format with common left index
        [kv, k, b, v, t, g, s, cl] = minified;
      } else {
        // TIER 6: 7-element format (backward compatibility)
        [kv, k, b, v, t, g, s] = minified;
        cl = undefined;  // No 2-element tuplets in Tier 6
      }

      // TIER 6: Convert integer values back to floats (divide by 10000)
      kv = this.#convertIntegersToValues(kv);
      v = this.#convertIntegersToValues(v);

      // TIER 6: Unflatten baseline array to object
      b = this.#unflattenBaseline(b);

      // TIER 6/6b: Unflatten tuplet data from length-prefixed format
      t = this.#unflattenTuplets(t);

    } else if (typeof minified === 'object' && minified !== null) {
      // TIER 5: Object format (legacy support for Tier 5 files)

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

      // Require tuplet lookup table (Tier 5 optimization)
      if (!minified.t) {
        throw new Error(
          `Missing tuplet lookup table ('t' field).\n` +
          `This file was generated with an old format (Tier 4 only).\n` +
          `Please regenerate font assets using the current font-assets-builder.`
        );
      }

      // Extract values from object (Tier 5 format)
      kv = minified.kv;
      k = minified.k;
      b = minified.b;
      v = minified.v;
      t = minified.t;
      g = minified.g;
      s = minified.s;

    } else {
      throw new Error(
        `Invalid minified format - expected array (Tier 6) or object (Tier 5), got ${typeof minified}.\n` +
        `This indicates a corrupted font file. Please regenerate font assets.`
      );
    }

    const expandedData = {
      kerningTable: this.#expandKerningTable(k, kv),
      characterMetrics: this.#expandCharacterMetrics(g, b, v, t, cl),
      spaceAdvancementOverrideForSmallSizesInPx: s
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
   * Expands kerning pairs from compact string notation to individual character pairs
   * TIER 6b OPTIMIZATION: Handles advanced compact notation with non-sequential grouping
   *
   * Parses compact strings like "-,.:;ac-egj-s" which means:
   * - Dash at START is literal
   * - Individual chars: comma, dot, colon, semicolon
   * - Ranges: a, c-e (c,d,e), g, j-s (j,k,l,m,n,o,p,q,r,s)
   *
   * Always uses CHARACTER_SET for range expansion
   * @param {Object} pairs - Compressed pairs like {"-,.:;ac-egj-s":20}
   * @returns {Object} Expanded pairs like {"-":20,",":20,".":20,...,"s":20}
   * @private
   */
  static #expandKerningPairs(pairs) {
    const expanded = {};

    // Process entries in order so later entries can override earlier ones
    for (const [key, value] of Object.entries(pairs)) {
      // Parse the compact string notation
      const chars = this.#parseCompactCharString(key);

      // Assign value to all parsed characters
      for (const char of chars) {
        expanded[char] = value;
      }
    }

    return expanded;
  }

  /**
   * Parses compact character string notation
   * TIER 6b OPTIMIZATION: Handles dash-at-start and range notation
   *
   * Format:
   * - First char is dash → literal dash character
   * - "a-z" → range from a to z
   * - "abc" → individual characters a, b, c
   * - "-,.:;ac-egj-s" → dash, comma, dot, colon, semicolon, a, c-e range, g, j-s range
   *
   * @param {string} compactStr - Compact string like "-,.:;ac-egj-s"
   * @returns {string[]} Array of individual characters
   * @private
   */
  static #parseCompactCharString(compactStr) {
    const chars = [];
    let i = 0;

    // Handle dash at start (literal)
    if (compactStr[0] === '-') {
      chars.push('-');
      i = 1;
    }

    // Parse rest of string
    while (i < compactStr.length) {
      const currentChar = compactStr[i];

      // Check if this is the start of a range pattern
      if (i + 2 < compactStr.length && compactStr[i + 1] === '-') {
        // Pattern: "X-Y" where X and Y are single characters
        const startChar = currentChar;
        const endChar = compactStr[i + 2];

        // Verify it's a valid range in CHARACTER_SET
        const startIndex = CHARACTER_SET.indexOf(startChar);
        const endIndex = CHARACTER_SET.indexOf(endChar);

        if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
          // Valid range - expand it
          for (let j = startIndex; j <= endIndex; j++) {
            chars.push(CHARACTER_SET[j]);
          }
          i += 3; // Skip X, -, Y
        } else {
          // Not a valid range - treat as individual characters
          chars.push(currentChar);
          i++;
        }
      } else {
        // Individual character
        chars.push(currentChar);
        i++;
      }
    }

    return chars;
  }
  
  /**
   * Expands glyph metrics from arrays back to full objects
   * TIER 2 OPTIMIZATION: Reconstructs from array of arrays using CHARACTER_SET
   * TIER 4 OPTIMIZATION: Looks up actual values from indices using valueLookup table
   * TIER 5a OPTIMIZATION: Decompresses variable-length tuplets (2/3/4/5 elements)
   * TIER 5b OPTIMIZATION: Looks up tuplets from tuplet indices
   * TIER 6b OPTIMIZATION: 2-element tuplets using common left index
   *
   * Tuplet decompression (deterministic based on length):
   *   - Length 2: [w, a] → [w, CL, w, a, CL]  (w===r AND l===CL AND d===CL)
   *   - Length 3: [w, l, a] → [w, l, w, a, l]  (w===r AND l===d)
   *   - Length 4: [w, l, a, d] → [w, l, w, a, d]  (w===r only)
   *   - Length 5: [w, l, r, a, d] (no decompression)
   *
   * Reconstructs full TextMetrics-compatible objects from compact arrays
   * Always uses CHARACTER_SET for character order
   * @param {Array} tupletIndices - Array of tuplet indices (single integers)
   * @param {Object} metricsCommonToAllCharacters - Common metrics shared across all characters
   * @param {Array} valueLookup - Value lookup table mapping indices to actual values
   * @param {Array} tupletLookup - Tuplet lookup table mapping tuplet indices to index arrays
   * @param {number} [commonLeftIndex] - Common left bounding box index (Tier 6b, optional)
   * @private
   */
  static #expandCharacterMetrics(tupletIndices, metricsCommonToAllCharacters, valueLookup, tupletLookup, commonLeftIndex) {
    const expanded = {};

    // Convert CHARACTER_SET string to array of characters
    const chars = Array.from(CHARACTER_SET);

    // Reconstruct object by mapping array positions to characters
    chars.forEach((char, index) => {
      // TIER 5b: Look up tuplet from tuplet index
      const tupletIndex = tupletIndices[index];
      const compressed = tupletLookup[tupletIndex];

      let indices;

      // TIER 5+6b: Decompress tuplet based on length
      if (compressed.length === 2) {
        // Case D (TIER 6b): [w, a] → [w, CL, w, a, CL]
        // All three patterns: w===r AND l===CL AND d===CL
        if (commonLeftIndex === undefined) {
          throw new Error(
            `2-element tuplet found but no common left index provided.\n` +
            `Character "${char}" at index ${index}: [${compressed.join(',')}]\n` +
            `This indicates a corrupted Tier 6b font file. Please regenerate font assets.`
          );
        }
        indices = [
          compressed[0],    // width
          commonLeftIndex,  // left = common left
          compressed[0],    // right = width (pattern 1)
          compressed[1],    // ascent
          commonLeftIndex   // descent = common left (pattern 2)
        ];
      }
      else if (compressed.length === 3) {
        // Case C: [w, l, a] → [w, l, w, a, l]
        // Both w===r and l===d
        indices = [
          compressed[0],  // width
          compressed[1],  // left
          compressed[0],  // right = width (pattern 1)
          compressed[2],  // ascent
          compressed[1]   // descent = left (pattern 2)
        ];
      }
      else if (compressed.length === 4) {
        // Case B: [w, l, a, d] → [w, l, w, a, d]
        // Only w===r
        indices = [
          compressed[0],  // width
          compressed[1],  // left
          compressed[0],  // right = width (pattern 1)
          compressed[2],  // ascent
          compressed[3]   // descent
        ];
      }
      else if (compressed.length === 5) {
        // Case A: [w, l, r, a, d] - no decompression needed
        indices = compressed;
      }
      else {
        throw new Error(
          `Invalid glyph tuplet length for character "${char}" at index ${index}.\n` +
          `Expected 2, 3, 4, or 5 elements, got ${compressed.length}: [${compressed.join(',')}]\n` +
          `This indicates a corrupted font file. Please regenerate font assets.`
        );
      }

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

  /**
   * Converts array of integer values back to floats by dividing by 10000
   * TIER 6 OPTIMIZATION: Integer to value conversion
   *
   * @param {number[]} integers - Array of integer values
   * @returns {number[]} Array of float values
   * @private
   */
  static #convertIntegersToValues(integers) {
    return integers.map(int => int / 10000);
  }

  /**
   * Unflattens baseline array back to object
   * TIER 6 OPTIMIZATION: Baseline array → object
   *
   * @param {number[]} baselineArray - Array [fba, fbd, hb, ab, ib, pd]
   * @returns {Object} Baseline object with {fba, fbd, hb, ab, ib, pd}
   * @private
   */
  static #unflattenBaseline(baselineArray) {
    if (!Array.isArray(baselineArray) || baselineArray.length !== 6) {
      throw new Error(
        `Invalid baseline array - expected 6 elements, got ${baselineArray?.length}.\n` +
        `This indicates a corrupted font file. Please regenerate font assets.`
      );
    }

    // Fixed order: fba, fbd, hb, ab, ib, pd
    return {
      fba: baselineArray[0],
      fbd: baselineArray[1],
      hb: baselineArray[2],
      ab: baselineArray[3],
      ib: baselineArray[4],
      pd: baselineArray[5]
    };
  }

  /**
   * Unflattens tuplet data from negative delimiter format
   * TIER 6b OPTIMIZATION: Tuplet array unflattening with negative delimiters
   *
   * Parses negative-delimited format and shifts back to 0-based indices.
   * Negative numbers mark the end of each tuplet.
   *
   * Converts: [3,2,-15,1,2,16,-8] → [[2,1,14],[0,1,15,7]]
   * Each tuplet ends with a negative number (1-based) which becomes last element (0-based)
   *
   * @param {number[]} flattened - Flattened array with negative delimiters (1-based indices)
   * @returns {Array<Array<number>>} Array of tuplet arrays (0-based indices)
   * @private
   */
  static #unflattenTuplets(flattened) {
    const tuplets = [];
    let currentTuplet = [];

    for (let i = 0; i < flattened.length; i++) {
      const value = flattened[i];

      if (value < 0) {
        // Negative marks end of tuplet
        // Negate back and subtract 1 to get 0-based index
        currentTuplet.push((-value) - 1);

        // Validate tuplet length
        if (currentTuplet.length < 2 || currentTuplet.length > 5) {
          throw new Error(
            `Invalid tuplet length ${currentTuplet.length} at position ${i}.\n` +
            `Expected 2, 3, 4, or 5. This indicates a corrupted font file.\n` +
            `Please regenerate font assets.`
          );
        }

        tuplets.push(currentTuplet);
        currentTuplet = [];
      } else {
        // Positive value: subtract 1 to get 0-based index
        currentTuplet.push(value - 1);
      }
    }

    // Check for incomplete tuplet at end
    if (currentTuplet.length > 0) {
      throw new Error(
        `Incomplete tuplet at end of data.\n` +
        `Found ${currentTuplet.length} elements without negative delimiter.\n` +
        `This indicates a corrupted font file. Please regenerate font assets.`
      );
    }

    return tuplets;
  }

}