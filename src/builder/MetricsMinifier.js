// Static utility class for minifying font metrics data (build-time only).
//
// Wire format (one record per (family, style, weight, size); the outer 5-tuple
// `[family, styleIdx, weightIdx, size, payload]` is added by the bundle writer):
//
//   payload = [kv, k, b, v, chars, s]    // 6 slots
//
//     [0] kv     int[]    kerning value lookup, scored-sorted, ints × 10000
//                         (usually empty — kept for the few records that have
//                          a kerning table)
//     [1] k      object   2D-range-compressed kerning table with kv indices
//     [2] b      [6]      baseline [fba, fbd, hb, ab, ib, pd] — pd=null in
//                         the shipped bundle; the runtime injects density at
//                         MetricsExpander.expand time
//     [3] v      string   BundleCodec.encodeDeltaVarIntB64 of the magnitude-
//                         sorted unique-glyph-metric-value table, ints × 10000
//     [4] chars  string   BundleCodec.encodeVarIntB64 of the flat 5×N stream of
//                         value-table indices in sorted character order:
//                         [w₀,l₀,r₀,a₀,d₀, w₁,l₁,r₁,a₁,d₁, ...]
//     [5] s      n|null   spaceAdvancementOverrideForSmallSizesInPx
//
// Requires BundleCodec.js + CharacterSets.js to be loaded first.

class MetricsMinifier {
  constructor() {
    throw new Error('MetricsMinifier cannot be instantiated - use static methods');
  }

  /**
   * Minifies font metrics data into the 6-slot wire record.
   *
   * @param {Object} metricsData - { kerningTable, characterMetrics, spaceAdvancementOverrideForSmallSizesInPx }
   * @param {Array<string>} [characterSet=CharacterSets.FONT_SPECIFIC_CHARS]
   * @returns {Array} 6-element minified record
   * @throws {Error} If characters are missing or extra
   */
  static minify(metricsData, characterSet = CharacterSets.FONT_SPECIFIC_CHARS) {
    const missingChars = [];
    for (const char of characterSet) {
      if (!(char in metricsData.characterMetrics)) missingChars.push(char);
    }
    if (missingChars.length > 0) {
      throw new Error(
        `MetricsMinifier requires ALL ${characterSet.length} characters from the provided character set.\n` +
        `Missing ${missingChars.length} characters: ${missingChars.slice(0, 10).join(', ')}${missingChars.length > 10 ? '...' : ''}\n` +
        `Please ensure font-assets-builder generates ALL required characters.`
      );
    }

    const extraChars = Object.keys(metricsData.characterMetrics).filter(c => !characterSet.includes(c));
    if (extraChars.length > 0) {
      throw new Error(
        `Font contains ${extraChars.length} characters not in the provided character set: ${extraChars.join(', ')}\n` +
        `Please update the character set or remove these characters.`
      );
    }

    // Value-lookup table for per-glyph metric values (width, left, right, ascent,
    // descent). Magnitude-sorted ascending so deltas are small for varint encoding.
    const { valueLookup, indexedGlyphs } = MetricsMinifier.#createValueLookupTable(
      metricsData.characterMetrics,
      characterSet
    );

    const { kerningValueLookup, indexedKerningTable } = MetricsMinifier.#createKerningValueLookupTable(
      metricsData.kerningTable
    );

    const valueLookupIntegers = valueLookup.map(MetricsMinifier.#toInt);
    const kerningValueLookupIntegers = kerningValueLookup.map(MetricsMinifier.#toInt);

    const baselineArray = MetricsMinifier.#flattenBaseline(
      MetricsMinifier.#extractMetricsCommonToAllCharacters(metricsData.characterMetrics, characterSet)
    );

    // Encoded streams.
    const encodedValueLookup = BundleCodec.encodeDeltaVarIntB64(valueLookupIntegers);
    const encodedChars = BundleCodec.encodeVarIntB64(indexedGlyphs.flat()); // flat 5×N stream

    return [
      kerningValueLookupIntegers,
      indexedKerningTable,
      baselineArray,
      encodedValueLookup,
      encodedChars,
      metricsData.spaceAdvancementOverrideForSmallSizesInPx,
    ];
  }

  /**
   * Minify + roundtrip-verify against MetricsExpander.expand. Catches compression
   * bugs immediately at build time.
   *
   * @throws {Error} If roundtrip diverges from input
   */
  static minifyWithVerification(metricsData, characterSet = CharacterSets.FONT_SPECIFIC_CHARS) {
    const minified = MetricsMinifier.minify(metricsData, characterSet);

    if (typeof MetricsExpander === 'undefined') {
      console.warn('⚠️  MetricsExpander not loaded - skipping roundtrip verification');
      return minified;
    }

    const expanded = MetricsExpander.expand(minified, characterSet);

    const originalKerning = metricsData.kerningTable;
    const expandedKerning = expanded._kerningTable;

    for (const [leftChar, pairs] of Object.entries(originalKerning)) {
      if (!expandedKerning[leftChar]) {
        throw new Error(`Roundtrip verification failed: Missing left character "${leftChar}".`);
      }
      for (const [rightChar, value] of Object.entries(pairs)) {
        const ev = expandedKerning[leftChar][rightChar];
        if (ev !== value) {
          throw new Error(`Roundtrip verification failed: Kerning "${leftChar}/${rightChar}" expected ${value}, got ${ev}.`);
        }
      }
    }
    for (const [leftChar, pairs] of Object.entries(expandedKerning)) {
      if (!originalKerning[leftChar]) {
        throw new Error(`Roundtrip verification failed: Extra left character "${leftChar}".`);
      }
      for (const rightChar of Object.keys(pairs)) {
        if (!(rightChar in originalKerning[leftChar])) {
          throw new Error(`Roundtrip verification failed: Extra kerning pair "${leftChar}/${rightChar}".`);
        }
      }
    }

    const originalCount = Object.keys(metricsData.characterMetrics).length;
    const expandedCount = Object.keys(expanded._characterMetrics).length;
    if (originalCount !== expandedCount) {
      throw new Error(`Roundtrip verification failed: char count ${originalCount} → ${expandedCount}.`);
    }

    console.debug('✅ Roundtrip verification passed');
    return minified;
  }

  // ----- internals -----

  static #toInt(v) {
    return Number.isInteger(v) ? v * 10000 : Math.round(v * 10000);
  }

  static #extractMetricsCommonToAllCharacters(characterMetrics, characterSet) {
    const firstGlyph = characterMetrics[characterSet[0]];
    return {
      fba: firstGlyph.fontBoundingBoxAscent,
      fbd: firstGlyph.fontBoundingBoxDescent,
      hb:  firstGlyph.hangingBaseline,
      ab:  firstGlyph.alphabeticBaseline,
      ib:  firstGlyph.ideographicBaseline,
      pd:  firstGlyph.pixelDensity,
    };
  }

  static #flattenBaseline(b) {
    return [b.fba, b.fbd, b.hb, b.ab, b.ib, b.pd];
  }

  // Collect unique per-glyph metric values across the character set; sort by
  // magnitude ascending so the delta-varint pre-pass yields small deltas. Then
  // map each glyph to a 5-tuple of indices into that table.
  static #createValueLookupTable(characterMetrics, characterSet) {
    const uniqueValues = new Set();
    for (const char of characterSet) {
      const g = characterMetrics[char];
      uniqueValues.add(g.width);
      uniqueValues.add(g.actualBoundingBoxLeft);
      uniqueValues.add(g.actualBoundingBoxRight);
      uniqueValues.add(g.actualBoundingBoxAscent);
      uniqueValues.add(g.actualBoundingBoxDescent);
    }
    const valueLookup = Array.from(uniqueValues).sort((a, b) => a - b);
    const valueToIndex = new Map();
    valueLookup.forEach((v, i) => valueToIndex.set(v, i));

    const indexedGlyphs = Array.from(characterSet).map(char => {
      const g = characterMetrics[char];
      return [
        valueToIndex.get(g.width),
        valueToIndex.get(g.actualBoundingBoxLeft),
        valueToIndex.get(g.actualBoundingBoxRight),
        valueToIndex.get(g.actualBoundingBoxAscent),
        valueToIndex.get(g.actualBoundingBoxDescent),
      ];
    });

    return { valueLookup, indexedGlyphs };
  }

  // Same value-indexing scheme for kerning, plus 2D range compression on the
  // resulting indexed table. The value-lookup ordering is scored by
  // (count × stringLength) descending so the most common values get the
  // shortest indices.
  static #createKerningValueLookupTable(kerningTable) {
    const valueOccurrences = new Map();
    for (const pairs of Object.values(kerningTable)) {
      for (const value of Object.values(pairs)) {
        valueOccurrences.set(value, (valueOccurrences.get(value) || 0) + 1);
      }
    }
    const valueScores = Array.from(valueOccurrences.entries()).map(([value, count]) => ({
      value, score: count * JSON.stringify(value).length,
    }));
    valueScores.sort((a, b) => b.score - a.score);
    const kerningValueLookup = valueScores.map(v => v.value);

    const valueToIndex = new Map();
    kerningValueLookup.forEach((v, i) => valueToIndex.set(v, i));

    const indexedTable = {};
    for (const [leftChar, pairs] of Object.entries(kerningTable)) {
      indexedTable[leftChar] = {};
      for (const [rightChar, value] of Object.entries(pairs)) {
        indexedTable[leftChar][rightChar] = valueToIndex.get(value);
      }
    }

    const indexedKerningTable = MetricsMinifier.#minifyKerningTable(indexedTable);
    return { kerningValueLookup, indexedKerningTable };
  }

  // 2D range compression of the kerning table:
  //   pass 1 (right side): {"A":{"0":20,"1":20}}  → {"A":{"0-1":20}}
  //   pass 2 (left side):  {"A":{"s":20},"B":{"s":20}} → {"A-B":{"s":20}}
  static #minifyKerningTable(kerningTable) {
    const rightCompressed = {};
    for (const [leftChar, pairs] of Object.entries(kerningTable)) {
      rightCompressed[leftChar] = MetricsMinifier.#compressKerningPairs(pairs);
    }
    return MetricsMinifier.#compressLeftSide(rightCompressed);
  }

  // Build compact-string keys grouping ALL chars sharing a kerning value, with
  // dash-at-start = literal dash, X-Y in middle = range of length ≥ 3.
  static #compressKerningPairs(pairs) {
    if (Object.keys(pairs).length === 0) return {};
    const valueToIndices = {};
    for (const [char, value] of Object.entries(pairs)) {
      const idx = CharacterSets.FONT_SPECIFIC_CHARS.indexOf(char);
      if (idx === -1) {
        console.warn(`Character "${char}" not in FONT_SPECIFIC_CHARS, skipping`);
        continue;
      }
      (valueToIndices[value] ||= []).push(idx);
    }
    const compressed = {};
    for (const [value, indices] of Object.entries(valueToIndices)) {
      indices.sort((a, b) => a - b);
      compressed[MetricsMinifier.#buildCompactCharString(indices)] = parseFloat(value);
    }
    return compressed;
  }

  static #buildCompactCharString(indices) {
    const DASH_INDEX = CharacterSets.FONT_SPECIFIC_CHARS.indexOf('-');
    let result = '';
    if (indices.includes(DASH_INDEX)) {
      result = '-';
      indices = indices.filter(i => i !== DASH_INDEX);
    }
    const ranges = MetricsMinifier.#findConsecutiveRanges(indices);
    for (const range of ranges) {
      if (range.start === range.end) {
        result += CharacterSets.FONT_SPECIFIC_CHARS[range.start];
      } else if (range.end === range.start + 1) {
        result += CharacterSets.FONT_SPECIFIC_CHARS[range.start];
        result += CharacterSets.FONT_SPECIFIC_CHARS[range.end];
      } else {
        result += CharacterSets.FONT_SPECIFIC_CHARS[range.start];
        result += '-';
        result += CharacterSets.FONT_SPECIFIC_CHARS[range.end];
      }
    }
    return result;
  }

  static #findConsecutiveRanges(indices) {
    if (indices.length === 0) return [];
    const ranges = [];
    let rs = indices[0], re = indices[0];
    for (let i = 1; i < indices.length; i++) {
      if (indices[i] === re + 1) { re = indices[i]; }
      else { ranges.push({ start: rs, end: re }); rs = indices[i]; re = indices[i]; }
    }
    ranges.push({ start: rs, end: re });
    return ranges;
  }

  // Group left chars whose right-side object is identical, then range-compress
  // those left-char groups.
  static #compressLeftSide(kerningTable) {
    const sigToLeftChars = {};
    for (const [leftChar, obj] of Object.entries(kerningTable)) {
      const sig = JSON.stringify(obj);
      (sigToLeftChars[sig] ||= []).push(leftChar);
    }
    const compressed = {};
    for (const [sig, leftChars] of Object.entries(sigToLeftChars)) {
      const obj = JSON.parse(sig);
      const indices = leftChars
        .map(c => CharacterSets.FONT_SPECIFIC_CHARS.indexOf(c))
        .filter(i => i !== -1)
        .sort((a, b) => a - b);
      const ranges = MetricsMinifier.#findConsecutiveRanges(indices);
      for (const range of ranges) {
        if (range.start === range.end) {
          compressed[CharacterSets.FONT_SPECIFIC_CHARS[range.start]] = obj;
        } else if (range.end === range.start + 1) {
          compressed[CharacterSets.FONT_SPECIFIC_CHARS[range.start]] = obj;
          compressed[CharacterSets.FONT_SPECIFIC_CHARS[range.end]] = obj;
        } else {
          const startChar = CharacterSets.FONT_SPECIFIC_CHARS[range.start];
          const endChar = CharacterSets.FONT_SPECIFIC_CHARS[range.end];
          compressed[`${startChar}-${endChar}`] = obj;
        }
      }
    }
    return compressed;
  }
}
