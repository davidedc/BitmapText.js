// Static utility class for expanding minified font metrics data (runtime only)
// Converts compact format back to FontMetrics instances for use by the rendering engine
// NOTE: Requires BitmapText.js to be loaded first (uses BitmapText.CHARACTER_SET)

class MetricsExpander {
  // Private constructor - prevent instantiation following Effective Java patterns
  constructor() {
    throw new Error('MetricsExpander cannot be instantiated - use static methods');
  }

  /**
   * TIER 6c OPTIMIZATION: Decode base64 string to array of integers
   * Reverses the base64 byte encoding from MetricsMinifier
   *
   * @param {string} base64 - Base64 encoded string
   * @returns {Array<number>} Array of integers (0-255)
   */
  static #decodeFromBase64Bytes(base64) {
    // In browser: use atob
    // In Node.js: use Buffer
    let bytes;

    if (typeof Buffer !== 'undefined') {
      // Node.js environment
      bytes = Buffer.from(base64, 'base64');
    } else {
      // Browser environment
      const binary = atob(base64);
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
    }

    return Array.from(bytes);
  }

  /**
   * TIER 6c OPTIMIZATION: Decode varint+zigzag+base64 to signed integers
   * Reverses the VarInt encoding from MetricsMinifier
   *
   * @param {string} base64 - Base64 encoded varint bytes
   * @returns {Array<number>} Array of signed integers
   */
  static #decodeVarInts(base64) {
    const bytes = this.#decodeFromBase64Bytes(base64);
    const integers = [];
    let i = 0;

    while (i < bytes.length) {
      // Decode VarInt: 7 bits per byte, MSB indicates continuation
      let value = 0;
      let shift = 0;
      let byte;

      do {
        byte = bytes[i++];
        value |= (byte & 0x7F) << shift;
        shift += 7;
      } while (byte & 0x80);

      // Zigzag decoding: convert unsigned back to signed
      // 0→0, 1→-1, 2→1, 3→-2, 4→2, ...
      const signed = (value & 1) ? -(value + 1) / 2 : value / 2;
      integers.push(signed);
    }

    return integers;
  }

  /**
   * TIER 7 OPTIMIZATION: Decompress value lookup array from delta encoding + base64
   *
   * Reverses the compression:
   * 1. Decode base64 → varint → zigzag → deltas
   * 2. Reconstruct sorted values from deltas
   * 3. Return as unsorted array (order doesn't matter for lookup)
   *
   * @param {string} base64 - Base64 encoded delta-compressed string
   * @returns {Array<number>} Array of metric value integers
   */
  static #decompressValueArray(base64) {
    // Decode base64 → deltas
    const deltas = this.#decodeVarInts(base64);

    // Reconstruct sorted values from deltas
    const sorted = [deltas[0]]; // First value is absolute
    for (let i = 1; i < deltas.length; i++) {
      sorted.push(sorted[i - 1] + deltas[i]);
    }

    // Return as-is (order doesn't matter for value lookup)
    // The indices in tuplets refer to sorted positions
    return sorted;
  }

  /**
   * Expands minified metrics back to FontMetrics instance for runtime use
   * TIER 7 FORMAT (backward compatible with Tier 6c)
   *
   * @param {Array} minified - Minified metrics array [kv, k, b, v, t, g, s, cl]
   *   - v can be array (Tier 6c) or base64 string (Tier 7)
   * @returns {FontMetrics} FontMetrics instance with expanded data
   * @throws {Error} If invalid format detected
   */
  static expand(minified) {
    // Check if FontMetrics class is available
    if (typeof FontMetrics === 'undefined') {
      throw new Error('FontMetrics class not found. Please ensure FontMetrics.js is loaded before MetricsExpander.js');
    }

    // Validate Tier 6c format: 8-element array only
    if (!Array.isArray(minified) || minified.length !== 8) {
      throw new Error(
        `Invalid format - expected 8-element array (Tier 6c), got ${typeof minified === 'object' ? 'array' : typeof minified} with ${minified?.length || 0} elements.\n` +
        `Please regenerate font assets with the current version.`
      );
    }

    // Extract values from Tier 6c/7 array format
    let [kv, k, b, v, t, g, s, cl] = minified;

    // Convert integer values back to floats (divide by 10000)
    kv = this.#convertIntegersToValues(kv);

    // TIER 7: Handle value lookup array - can be array (Tier 6c) or base64 string (Tier 7)
    if (typeof v === 'string') {
      // Tier 7: Decompress from delta-encoded base64
      v = this.#decompressValueArray(v);
      v = this.#convertIntegersToValues(v);
    } else if (Array.isArray(v)) {
      // Tier 6c: Already an array of integers
      v = this.#convertIntegersToValues(v);
    } else {
      throw new Error('Invalid value lookup format - expected array or string');
    }

    // Unflatten baseline array to object
    b = this.#unflattenBaseline(b);

    // Decode base64-encoded binary data
    // t = VarInt+zigzag encoded flattened tuplets
    // g = byte-encoded tuplet indices
    t = this.#decodeVarInts(t);
    g = this.#decodeFromBase64Bytes(g);

    // Unflatten tuplet data from negative-delimiter format
    t = this.#unflattenTuplets(t);

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
   * Always uses BitmapText.CHARACTER_SET for range expansion
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
   * Always uses BitmapText.CHARACTER_SET for range expansion
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
          const startIndex = BitmapText.CHARACTER_SET.indexOf(startChar);
          const endIndex = BitmapText.CHARACTER_SET.indexOf(endChar);

          if (startIndex !== -1 && endIndex !== -1 && startIndex <= endIndex) {
            // Valid range, expand it
            for (let i = startIndex; i <= endIndex; i++) {
              expanded[BitmapText.CHARACTER_SET[i]] = rightSideObj;
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
   * Always uses BitmapText.CHARACTER_SET for range expansion
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

        // Verify it's a valid range in BitmapText.CHARACTER_SET
        const startIndex = BitmapText.CHARACTER_SET.indexOf(startChar);
        const endIndex = BitmapText.CHARACTER_SET.indexOf(endChar);

        if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
          // Valid range - expand it
          for (let j = startIndex; j <= endIndex; j++) {
            chars.push(BitmapText.CHARACTER_SET[j]);
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
   * TIER 2 OPTIMIZATION: Reconstructs from array of arrays using BitmapText.CHARACTER_SET
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
   * Always uses BitmapText.CHARACTER_SET for character order
   * @param {Array} tupletIndices - Array of tuplet indices (single integers)
   * @param {Object} metricsCommonToAllCharacters - Common metrics shared across all characters
   * @param {Array} valueLookup - Value lookup table mapping indices to actual values
   * @param {Array} tupletLookup - Tuplet lookup table mapping tuplet indices to index arrays
   * @param {number} [commonLeftIndex] - Common left bounding box index (Tier 6b, optional)
   * @private
   */
  static #expandCharacterMetrics(tupletIndices, metricsCommonToAllCharacters, valueLookup, tupletLookup, commonLeftIndex) {
    const expanded = {};

    // Convert BitmapText.CHARACTER_SET string to array of characters
    const chars = Array.from(BitmapText.CHARACTER_SET);

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