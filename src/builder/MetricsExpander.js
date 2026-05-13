// Static utility class for expanding minified font metrics data.
//
// Reverses MetricsMinifier.minify into a FontMetrics instance. Wire format
// documented in MetricsMinifier — six slots `[kv, k, b, v, chars, s]`.
// Requires BundleCodec.js + FontMetrics.js + CharacterSets.js to be loaded first.

class MetricsExpander {
  constructor() {
    throw new Error('MetricsExpander cannot be instantiated - use static methods');
  }

  /**
   * Expand a minified 6-slot record into a FontMetrics instance.
   *
   * @param {Array} minified - 6-element [kv, k, b, v, chars, s]
   * @param {Array<string>} [characterSet=CharacterSets.FONT_SPECIFIC_CHARS]
   * @param {number} [overrideDensity] - Bundle records ship with pd=null; the
   *   runtime supplies the density to inject into baseline[5] here.
   * @returns {FontMetrics}
   * @throws {Error} On format mismatch
   */
  static expand(minified, characterSet = CharacterSets.FONT_SPECIFIC_CHARS, overrideDensity) {
    if (typeof FontMetrics === 'undefined') {
      throw new Error('FontMetrics class not found. Please ensure FontMetrics.js is loaded before MetricsExpander.js');
    }
    if (!Array.isArray(minified) || minified.length !== 6) {
      throw new Error(
        `Invalid format - expected 6-element array, got ${typeof minified === 'object' ? 'array' : typeof minified} with ${minified?.length || 0} elements.\n` +
        `Please regenerate font assets with the current version.`
      );
    }

    const [kvInts, k, bArr, vEnc, charsEnc, s] = minified;

    // Value tables (×10000 ints → floats).
    const kv = kvInts.map(MetricsExpander.#toFloat);
    const v  = BundleCodec.decodeDeltaVarIntB64(vEnc).map(MetricsExpander.#toFloat);

    // Baseline. baseline[5] (pixelDensity) is null in the bundle; the runtime
    // supplies it here.
    if (!Array.isArray(bArr) || bArr.length !== 6) {
      throw new Error(`Invalid baseline array - expected 6 elements, got ${bArr?.length}.`);
    }
    const baseline = {
      fba: bArr[0], fbd: bArr[1], hb: bArr[2], ab: bArr[3], ib: bArr[4],
      pd:  overrideDensity !== undefined ? overrideDensity : bArr[5],
    };

    // Per-character 5-index stream.
    const flat = BundleCodec.decodeVarIntB64(charsEnc);
    const expectedLen = characterSet.length * 5;
    if (flat.length !== expectedLen) {
      throw new Error(
        `Char stream length ${flat.length} does not match ${expectedLen} ` +
        `(${characterSet.length} chars × 5). Bundle and runtime character sets disagree.`
      );
    }

    const expandedData = {
      kerningTable: MetricsExpander.#expandKerningTable(k, kv, characterSet),
      characterMetrics: MetricsExpander.#expandCharacterMetrics(flat, baseline, v, characterSet),
      spaceAdvancementOverrideForSmallSizesInPx: s,
    };

    return new FontMetrics(expandedData);
  }

  // ----- internals -----

  static #toFloat(n) { return n / 10000; }

  // Reverse the 2D range compression + value indexing.
  //   pass 1 (left):  "A-B":{"s":0} → {A:{s:0}, B:{s:0}}
  //   pass 2 (right): {A:{"0-1":0}} → {A:{0:0, 1:0}}
  //   pass 3 (values): A.s = kv[index]
  static #expandKerningTable(minified, kv, characterSet) {
    const leftExpanded = MetricsExpander.#expandLeftSide(minified, characterSet);
    const expanded = {};
    for (const [leftChar, pairs] of Object.entries(leftExpanded)) {
      const rightExpanded = MetricsExpander.#expandKerningPairs(pairs, characterSet);
      expanded[leftChar] = {};
      for (const [rightChar, index] of Object.entries(rightExpanded)) {
        expanded[leftChar][rightChar] = kv[index];
      }
    }
    return expanded;
  }

  static #expandLeftSide(minified, characterSet) {
    const expanded = {};
    for (const [key, obj] of Object.entries(minified)) {
      if (key.includes('-') && key.length >= 3) {
        const hyphenIndex = key.indexOf('-');
        const startChar = key.substring(0, hyphenIndex);
        const endChar   = key.substring(hyphenIndex + 1);
        if (startChar.length === 1 && endChar.length === 1) {
          const startIndex = characterSet.indexOf(startChar);
          const endIndex   = characterSet.indexOf(endChar);
          if (startIndex !== -1 && endIndex !== -1 && startIndex <= endIndex) {
            for (let i = startIndex; i <= endIndex; i++) expanded[characterSet[i]] = obj;
            continue;
          }
        }
      }
      expanded[key] = obj;
    }
    return expanded;
  }

  static #expandKerningPairs(pairs, characterSet) {
    const expanded = {};
    for (const [key, value] of Object.entries(pairs)) {
      for (const char of MetricsExpander.#parseCompactCharString(key, characterSet)) {
        expanded[char] = value;
      }
    }
    return expanded;
  }

  // Dash-at-start = literal; X-Y in middle = range of length ≥ 3.
  static #parseCompactCharString(compactStr, characterSet) {
    const chars = [];
    let i = 0;
    if (compactStr[0] === '-') { chars.push('-'); i = 1; }
    while (i < compactStr.length) {
      const cur = compactStr[i];
      if (i + 2 < compactStr.length && compactStr[i + 1] === '-') {
        const startChar = cur;
        const endChar = compactStr[i + 2];
        const startIndex = characterSet.indexOf(startChar);
        const endIndex   = characterSet.indexOf(endChar);
        if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
          for (let j = startIndex; j <= endIndex; j++) chars.push(characterSet[j]);
          i += 3;
        } else {
          chars.push(cur);
          i++;
        }
      } else {
        chars.push(cur);
        i++;
      }
    }
    return chars;
  }

  // Per-character expansion: read 5 indices from the flat stream, look up
  // values from the value table, attach the shared baseline fields.
  static #expandCharacterMetrics(flat, baseline, v, characterSet) {
    const expanded = {};
    const chars = Array.isArray(characterSet) ? characterSet : Array.from(characterSet);
    for (let i = 0; i < chars.length; i++) {
      const base = i * 5;
      const width                    = v[flat[base + 0]];
      const actualBoundingBoxLeft    = v[flat[base + 1]];
      const actualBoundingBoxRight   = v[flat[base + 2]];
      const actualBoundingBoxAscent  = v[flat[base + 3]];
      const actualBoundingBoxDescent = v[flat[base + 4]];
      expanded[chars[i]] = {
        width,
        actualBoundingBoxLeft,
        actualBoundingBoxRight,
        actualBoundingBoxAscent,
        actualBoundingBoxDescent,
        fontBoundingBoxAscent:  baseline.fba,
        fontBoundingBoxDescent: baseline.fbd,
        emHeightAscent:         baseline.fba,
        emHeightDescent:        baseline.fbd,
        hangingBaseline:        baseline.hb,
        alphabeticBaseline:     baseline.ab,
        ideographicBaseline:    baseline.ib,
        pixelDensity:           baseline.pd,
      };
    }
    return expanded;
  }
}
