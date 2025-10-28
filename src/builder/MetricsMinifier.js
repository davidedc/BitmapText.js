// Static utility class for minifying font metrics data (build-time only)
// Converts verbose object structures to compact format for smaller file sizes
// NOTE: Requires src/runtime/CHARACTER_SET.js to be loaded first

class MetricsMinifier {
  // Private constructor - prevent instantiation following Effective Java patterns
  constructor() {
    throw new Error('MetricsMinifier cannot be instantiated - use static methods');
  }
  
  /**
   * Compresses font ID string from verbose format to compact format
   * TIER 6 OPTIMIZATION: Font ID compression
   *
   * @param {string} idString - Full ID like 'density-1-0-Arial-style-normal-weight-normal-size-18-0'
   * @returns {string} Compact ID like '1,Arial,0,0,18'
   */
  static compressFontID(idString) {
    // Parse: density-1-0-Arial-style-normal-weight-normal-size-18-0
    const parts = idString.split('-');

    // Extract values
    const density = parts[1] + (parts[2] === '0' ? '' : '.' + parts[2]); // "1" or "1.5"
    const fontFamily = parts[3];
    const style = parts[5]; // "normal", "italic", "oblique"
    const weight = parts[7]; // "normal", "bold", or numeric
    const size = parts[9] + (parts[10] === '0' ? '' : '.' + parts[10]); // "18" or "18.5"

    // Compress style: 0=normal, 1=italic, 2=oblique
    const styleIdx = style === 'normal' ? '0' : (style === 'italic' ? '1' : '2');

    // Compress weight: 0=normal, 1=bold, or keep numeric
    const weightIdx = weight === 'normal' ? '0' : (weight === 'bold' ? '1' : weight);

    // Format: density,fontFamily,styleIdx,weightIdx,size
    return `${density},${fontFamily},${styleIdx},${weightIdx},${size}`;
  }

  /**
   * Decompresses font ID string from compact format to verbose format
   * TIER 6 OPTIMIZATION: Font ID decompression
   *
   * @param {string} compressed - Compact ID like '1,Arial,0,0,18'
   * @returns {string} Full ID like 'density-1-0-Arial-style-normal-weight-normal-size-18-0'
   */
  static decompressFontID(compressed) {
    const parts = compressed.split(',');

    // Parse compact format: density,fontFamily,styleIdx,weightIdx,size
    const density = parts[0];
    const fontFamily = parts[1];
    const styleIdx = parts[2];
    const weightIdx = parts[3];
    const size = parts[4];

    // Decompress style
    const style = styleIdx === '0' ? 'normal' : (styleIdx === '1' ? 'italic' : 'oblique');

    // Decompress weight
    const weight = weightIdx === '0' ? 'normal' : (weightIdx === '1' ? 'bold' : weightIdx);

    // Format density (1 → 1-0, 1.5 → 1-5)
    const densityFormatted = density.includes('.') ? density.replace('.', '-') : `${density}-0`;

    // Format size (18 → 18-0, 18.5 → 18-5)
    const sizeFormatted = size.includes('.') ? size.replace('.', '-') : `${size}-0`;

    // Reconstruct full ID
    return `density-${densityFormatted}-${fontFamily}-style-${style}-weight-${weight}-size-${sizeFormatted}`;
  }

  /**
   * Minifies font metrics data for smaller file size
   * TIER 2 OPTIMIZATION: Array-based glyph encoding
   * TIER 3 OPTIMIZATION: Two-dimensional kerning range compression
   * TIER 4 OPTIMIZATION: Value indexing (replaces repeated metric values with indices)
   * TIER 5 OPTIMIZATION: Tuplet deduplication (deduplicates glyph index arrays)
   * TIER 6 OPTIMIZATION: Additional space optimizations (baseline/top-level arrays, tuplet flattening, integer values)
   *
   * REQUIRES: metricsData.characterMetrics must contain ALL 204 characters from CHARACTER_SET
   *
   * @param {Object} metricsData - Full metrics object containing kerningTable, characterMetrics, etc.
   * @returns {Array} Minified metrics as array (Tier 6: top-level object → array)
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

    // TIER 6b: Find most common left bounding box value for 2-element tuplet compression
    const commonLeftValue = this.#findCommonLeftValue(metricsData.characterMetrics);

    // TIER 4+6b: Create value lookup table and indexed glyph arrays with 2-element compression
    const { valueLookup, indexedGlyphs, commonLeftIndex } = this.#createValueLookupTable(
      metricsData.characterMetrics,
      commonLeftValue
    );

    // TIER 4: Create kerning value lookup table and indexed kerning table
    const { kerningValueLookup, indexedKerningTable } = this.#createKerningValueLookupTable(
      metricsData.kerningTable
    );

    // TIER 5: Create tuplet lookup table and tuplet indices
    const { tupletLookup, tupletIndices } = this.#createTupletLookupTable(
      indexedGlyphs
    );

    // TIER 6a: Convert value lookups to integers (multiply by 10000)
    const valueLookupIntegers = this.#convertValuesToIntegers(valueLookup);
    const kerningValueLookupIntegers = this.#convertValuesToIntegers(kerningValueLookup);

    // TIER 6: Flatten baseline object to array
    const baselineArray = this.#flattenBaseline(
      this.#extractMetricsCommonToAllCharacters(metricsData.characterMetrics)
    );

    // TIER 6: Flatten tuplet lookup arrays to length-prefixed format
    const flattenedTuplets = this.#flattenTuplets(tupletLookup);

    // TIER 6: Return as array instead of object (top-level flattening)
    // Array format: [kv, k, b, v, t, g, s, cl]
    return [
      kerningValueLookupIntegers,  // 0: TIER 4+6: Kerning value lookup (as integers)
      indexedKerningTable,         // 1: TIER 4: Kerning table with indexed values
      baselineArray,               // 2: TIER 6: Baseline array [fba,fbd,hb,ab,ib,pd]
      valueLookupIntegers,         // 3: TIER 4+6: Glyph value lookup (as integers)
      flattenedTuplets,            // 4: TIER 5+6: Flattened tuplet data (length-prefixed)
      tupletIndices,               // 5: TIER 5: Tuplet indices (single integers)
      metricsData.spaceAdvancementOverrideForSmallSizesInPx,  // 6: Space override
      commonLeftIndex              // 7: TIER 6b: Common left index for 2-element tuplet decompression
    ];
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
   * Finds the most common left bounding box value across all glyphs
   * TIER 6b OPTIMIZATION: 2-element tuplet compression requires common left value
   *
   * Analysis shows ~92% of glyphs share the same left value (usually 0)
   * This enables aggressive 2-element tuplet compression for these glyphs
   *
   * @param {Object} characterMetrics - Character metrics object with all 204 characters
   * @returns {number} Most common left bounding box value
   * @private
   */
  static #findCommonLeftValue(characterMetrics) {
    // Count frequency of each left value
    const leftValueCounts = new Map();

    for (const char of CHARACTER_SET) {
      const leftValue = characterMetrics[char].actualBoundingBoxLeft;
      leftValueCounts.set(leftValue, (leftValueCounts.get(leftValue) || 0) + 1);
    }

    // Find the most frequent left value
    let mostCommonValue = 0;
    let maxCount = 0;

    for (const [value, count] of leftValueCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonValue = value;
      }
    }

    console.debug(`🔍 Common left value: ${mostCommonValue} (appears in ${maxCount}/${CHARACTER_SET.length} glyphs, ${(maxCount/CHARACTER_SET.length*100).toFixed(1)}%)`);

    return mostCommonValue;
  }

  /**
   * Creates value lookup table and converts glyph metrics to indexed arrays with tuplet compression
   * TIER 4 OPTIMIZATION: Value indexing - replaces repeated metric values with indices
   * TIER 5 OPTIMIZATION: Tuplet compression - reduces tuplet length from 5 to 3/4/5 based on redundancy
   * TIER 6b OPTIMIZATION: 2-element tuplet compression - further reduces when left===common
   *
   * Strategy: Assign shortest indices to values with highest (occurrence_count × string_length)
   * This maximizes savings because frequently-occurring long values get 1-digit indices
   *
   * Tuplet compression (cascading, most-frequent-first):
   *   - Case D (2 elements): w===r AND l===d AND l===CL  →  [w, a]  (CL = common left)
   *   - Case C (3 elements): w===r AND l===d             →  [w, l, a]
   *   - Case B (4 elements): w===r only                  →  [w, l, a, d]
   *   - Case A (5 elements): no compression              →  [w, l, r, a, d]
   *
   * @param {Object} characterMetrics - Character metrics object with all 204 characters
   * @param {number} commonLeftValue - Most common left bounding box value (will be converted to index)
   * @returns {Object} Object with valueLookup array, indexedGlyphs array, and commonLeftIndex
   * @private
   */
  static #createValueLookupTable(characterMetrics, commonLeftValue) {
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

    // TIER 6b: Convert common left value to index for tuplet compression
    const commonLeftIndex = valueToIndex.get(commonLeftValue);
    if (commonLeftIndex === undefined) {
      throw new Error(`Common left value ${commonLeftValue} not found in value lookup table`);
    }
    console.debug(`🔍 Common left index after value mapping: ${commonLeftIndex}`);

    // Step 5: Convert glyph arrays to indices and compress tuplets (TIER 5+6b)
    const indexedGlyphs = Array.from(CHARACTER_SET).map(char => {
      const glyph = characterMetrics[char];
      const indices = [
        valueToIndex.get(glyph.width),                      // 0: width
        valueToIndex.get(glyph.actualBoundingBoxLeft),      // 1: left
        valueToIndex.get(glyph.actualBoundingBoxRight),     // 2: right
        valueToIndex.get(glyph.actualBoundingBoxAscent),    // 3: ascent
        valueToIndex.get(glyph.actualBoundingBoxDescent)    // 4: descent
      ];

      // TIER 5+6b: Tuplet compression based on redundancy patterns
      // Cascading strategy (most-frequent-first):
      // Strategy 1: w===r (most frequent, 48%)
      // Strategy 2: l===d (combined with #1, 43%)
      // Strategy 3: l===common (combined with #1+#2, ~40% of those)
      const widthEqualsRight = indices[0] === indices[2];      // w === r
      const leftEqualsDescent = indices[1] === indices[4];     // l === d
      const leftEqualsCommon = indices[1] === commonLeftIndex; // l === common left

      if (widthEqualsRight && leftEqualsDescent && leftEqualsCommon) {
        // Case D: All three strategies apply - compress to 2 elements [w, a]
        // Decompression: [w, a] → [w, CL, w, a, CL]
        return [indices[0], indices[3]];
      }
      else if (widthEqualsRight && leftEqualsDescent) {
        // Case C: First two strategies apply - compress to 3 elements [w, l, a]
        // Decompression: [w, l, a] → [w, l, w, a, l]
        return [indices[0], indices[1], indices[3]];
      }
      else if (widthEqualsRight) {
        // Case B: First strategy only - compress to 4 elements [w, l, a, d]
        // Decompression: [w, l, a, d] → [w, l, w, a, d]
        return [indices[0], indices[1], indices[3], indices[4]];
      }
      else {
        // Case A: No compression - keep all 5 elements [w, l, r, a, d]
        return indices;
      }
    });

    // Log compression statistics
    let caseD = 0, caseC = 0, caseB = 0, caseA = 0;
    for (const tuplet of indexedGlyphs) {
      if (tuplet.length === 2) caseD++;
      else if (tuplet.length === 3) caseC++;
      else if (tuplet.length === 4) caseB++;
      else caseA++;
    }
    const savedIndices = 1020 - (caseD * 2 + caseC * 3 + caseB * 4 + caseA * 5);
    console.debug(`🗜️  Tuplet compression: ${caseD} × 2-elem, ${caseC} × 3-elem, ${caseB} × 4-elem, ${caseA} × 5-elem (saved ${savedIndices} indices)`);

    return {
      valueLookup,
      indexedGlyphs,
      commonLeftIndex  // TIER 6b: Return common left index for file format
    };
  }

  /**
   * Creates tuplet lookup table and replaces glyph index arrays with tuplet indices
   * TIER 5 OPTIMIZATION: Tuplet deduplication - many glyphs share identical index patterns
   *
   * Strategy: Assign shortest indices to tuplets with highest (JSON_length × occurrences)
   * This works on top of Tier 5a pattern compression (variable-length tuplets)
   *
   * @param {Array<Array<number>>} indexedGlyphs - Array of index tuplets (may be variable length 3-5)
   * @returns {Object} Object with tupletLookup array and tupletIndices array
   * @private
   */
  static #createTupletLookupTable(indexedGlyphs) {
    // Step 1: Collect unique tuplets and count occurrences
    const tupletOccurrences = new Map(); // JSON string -> {tuplet, count}

    for (const tuplet of indexedGlyphs) {
      const key = JSON.stringify(tuplet);
      if (!tupletOccurrences.has(key)) {
        tupletOccurrences.set(key, { tuplet, count: 0 });
      }
      tupletOccurrences.get(key).count++;
    }

    // Step 2: Calculate scores and sort by savings potential
    // Score = JSON_length × occurrences (higher = more savings from short index)
    const tupletScores = Array.from(tupletOccurrences.values()).map(({tuplet, count}) => {
      const stringLength = JSON.stringify(tuplet).length;
      const score = stringLength * count;
      return { tuplet, count, stringLength, score };
    });

    // Sort by score DESCENDING (highest savings first)
    // Top 10 tuplets get indices 0-9 (1 char each)
    // Next 90 tuplets get indices 10-99 (2 chars each)
    // Remaining tuplets get indices 100+ (3+ chars each)
    tupletScores.sort((a, b) => b.score - a.score);

    // Step 3: Create tuplet lookup table (sorted by score for optimal indexing)
    const tupletLookup = tupletScores.map(ts => ts.tuplet);

    // Step 4: Create tuplet-to-index map for fast lookup
    const tupletToIndex = new Map();
    tupletLookup.forEach((tuplet, index) => {
      const key = JSON.stringify(tuplet);
      tupletToIndex.set(key, index);
    });

    // Step 5: Convert glyph tuplets to single tuplet indices
    const tupletIndices = indexedGlyphs.map(tuplet => {
      const key = JSON.stringify(tuplet);
      return tupletToIndex.get(key);
    });

    // Log compression statistics
    const uniqueTuplets = tupletLookup.length;
    const totalGlyphs = indexedGlyphs.length;
    const deduplicationPercent = ((1 - uniqueTuplets / totalGlyphs) * 100).toFixed(1);

    console.debug(`🗜️  Tuplet deduplication: ${totalGlyphs} glyphs → ${uniqueTuplets} unique tuplets (${deduplicationPercent}% deduplicated)`);

    return {
      tupletLookup,
      tupletIndices
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
   * Compresses kerning pairs by grouping ALL characters with same value (sequential or not)
   * TIER 6b OPTIMIZATION: Advanced kerning compression
   *
   * Groups all characters with same value into compact string notation:
   * - Individual characters: "abc"
   * - Ranges (3+ consecutive): "a-z"
   * - Mixed: "a-eg-ijk" (range a-e, then g, then range g-i, then j, then k)
   *
   * Special dash handling:
   * - Dash at START is literal: "-abc" means dash, a, b, c
   * - Dash in MIDDLE is range: "a-c" means range from a to c
   *
   * Example: {" ":1,",":1,".":1,"a":1,"c":1,"d":1,"e":1} → {" ,.ac-e":1}
   *
   * Always uses CHARACTER_SET for range compression
   * @param {Object} pairs - Kerning pairs like {"0":20,"1":20,"2":20,...}
   * @returns {Object} Compressed pairs like {" ,.ac-e":20}
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

    // For each value, build compact string notation
    const compressed = {};

    for (const [value, indices] of Object.entries(valueToIndices)) {
      // Sort indices
      indices.sort((a, b) => a - b);

      // Build compact string notation
      const compactString = this.#buildCompactCharString(indices);

      // Store with compact string as key
      compressed[compactString] = parseFloat(value);
    }

    return compressed;
  }

  /**
   * Builds compact character string from indices
   * TIER 6b OPTIMIZATION: Groups all characters (sequential or not)
   *
   * Special handling:
   * - Dash character (index 13 in CHARACTER_SET): placed at beginning to avoid ambiguity
   * - Ranges of 3+: "a-z"
   * - Individual chars: "abc"
   * - Mixed: "-,.:;ac-egj-s"
   *
   * @param {number[]} indices - Sorted array of CHARACTER_SET indices
   * @returns {string} Compact string notation
   * @private
   */
  static #buildCompactCharString(indices) {
    const DASH_INDEX = CHARACTER_SET.indexOf('-');
    let result = '';

    // Check if dash is in the list - if so, handle it first
    const hasDash = indices.includes(DASH_INDEX);
    if (hasDash) {
      result = '-';
      // Remove dash from indices for processing
      indices = indices.filter(idx => idx !== DASH_INDEX);
    }

    // Find consecutive ranges
    const ranges = this.#findConsecutiveRanges(indices);

    // Build string from ranges
    for (const range of ranges) {
      if (range.start === range.end) {
        // Single character
        result += CHARACTER_SET[range.start];
      } else if (range.end === range.start + 1) {
        // Two characters - more efficient as separate (no dash needed)
        result += CHARACTER_SET[range.start];
        result += CHARACTER_SET[range.end];
      } else {
        // Range of 3+ characters - use dash notation
        result += CHARACTER_SET[range.start];
        result += '-';
        result += CHARACTER_SET[range.end];
      }
    }

    return result;
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

  /**
   * Converts array of float values to integers by multiplying by 10000
   * TIER 6 OPTIMIZATION: Value to integer conversion
   *
   * @param {number[]} values - Array of float values
   * @returns {number[]} Array of integer values
   * @private
   */
  static #convertValuesToIntegers(values) {
    return values.map(val => {
      // Handle integers (no decimal point)
      if (Number.isInteger(val)) {
        return val * 10000;
      }
      // Handle floats - multiply and round to avoid floating point errors
      return Math.round(val * 10000);
    });
  }

  /**
   * Flattens baseline object to array
   * TIER 6 OPTIMIZATION: Baseline object → array
   *
   * @param {Object} baseline - Baseline object with {fba, fbd, hb, ab, ib, pd}
   * @returns {number[]} Array [fba, fbd, hb, ab, ib, pd]
   * @private
   */
  static #flattenBaseline(baseline) {
    // Fixed order: fba, fbd, hb, ab, ib, pd
    return [
      baseline.fba,
      baseline.fbd,
      baseline.hb,
      baseline.ab,
      baseline.ib,
      baseline.pd
    ];
  }

  /**
   * Flattens tuplet arrays using negative delimiter format
   * TIER 6b OPTIMIZATION: Tuplet array flattening with negative delimiters
   *
   * Uses negative on last element to mark tuplet boundary.
   * Shifts indices by 1 to avoid -0 problem in JSON (0 becomes 1, 1 becomes 2, etc.)
   *
   * Converts: [[2,1,14],[0,1,15,7]] → [3,2,-15,1,2,16,-8]
   * Each tuplet ends with a negative number (saves 1 char per tuplet vs length-prefix)
   *
   * @param {Array<Array<number>>} tuplets - Array of tuplet arrays (0-based indices)
   * @returns {number[]} Flattened array with negative delimiters (1-based indices)
   * @private
   */
  static #flattenTuplets(tuplets) {
    const flattened = [];
    for (const tuplet of tuplets) {
      // Shift all indices by 1 (to avoid -0 problem) and negate the last one
      for (let i = 0; i < tuplet.length - 1; i++) {
        flattened.push(tuplet[i] + 1);  // Add 1 to shift from 0-based to 1-based
      }
      // Last element: add 1 and negate to mark end of tuplet
      flattened.push(-(tuplet[tuplet.length - 1] + 1));
    }
    return flattened;
  }

}