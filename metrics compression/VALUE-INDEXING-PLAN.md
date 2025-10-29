# Value Indexing Optimization - Implementation Plan

**Date:** 2025-10-18
**Optimization:** Tier 4 - Value Indexing for Glyph Metrics
**Expected Savings:** ~52.7% of glyph data size (~2,012 characters per font file)

---

## Problem Analysis

### Current Format

```javascript
{
  "k": {...},
  "b": {...},
  "g": [
    [5.1399,0,5.1399,0,0],
    [5.1399,0,5.1399,13.2344,0],
    [10.5669,0,10.5669,13.6563,0.2188],
    // 204 glyphs × 5 values = 1,020 values total
  ],
  "s": 5
}
```

**Problem:** Massive value repetition
- `0` appears 293 times (34% of all values!)
- `10.5669` appears 58 times
- `0.2188` appears 56 times
- Only 108 unique values out of 862 total values

### Proposed Format

```javascript
{
  "k": {...},
  "b": {...},
  "v": [10.5669, 0.2188, 13.5938, 0, ...],  // Value lookup table (108 values)
  "g": [
    [0,3,0,2,3],      // Indices into 'v' array
    [0,3,0,2,3],
    [0,3,0,2,1],
    // ...
  ],
  "s": 5
}
```

**Benefits:**
- Value `10.5669` (7 chars) × 58 occurrences = 406 chars
  - Becomes: lookup[0] (7 chars) + index 0 (1 char) × 58 = 7 + 58 = 65 chars
  - **Savings: 341 chars from this one value!**

---

## Optimization Strategy

### Index Assignment Algorithm

**Goal:** Maximize total savings by assigning shortest indices to highest-value targets

**Scoring Function:**
```
score(value) = occurrences × string_length
```

**Why this works:**
- High occurrence count → more savings from short index
- Long string representation → more benefit per replacement

**Algorithm:**
1. Collect all unique values from glyph arrays
2. Count occurrences of each value
3. Calculate `score = count × JSON.stringify(value).length`
4. Sort by score DESCENDING
5. Assign indices 0, 1, 2, ... in sorted order
6. Replace all values with their assigned indices

**Index Length Impact:**
- Indices 0-9: 1 character (10 slots) - assign highest-scoring values here
- Indices 10-99: 2 characters (90 slots)
- Indices 100-999: 3 characters (900 slots)

### Example from Real Data

| Value | Count | Len | Score | Index | Savings |
|-------|-------|-----|-------|-------|---------|
| 10.5669 | 58 | 7 | 406 | 0 | 7×57 - 58×1 = 399 - 58 = 341 |
| 0.2188 | 56 | 6 | 336 | 1 | 6×55 - 56×1 = 330 - 56 = 274 |
| 13.5938 | 43 | 7 | 301 | 2 | 7×42 - 43×1 = 294 - 43 = 251 |
| 0 | 293 | 1 | 293 | 3 | 1×292 - 293×1 = 292 - 293 = -1 |

**Note:** Value `0` has high score due to occurrence count, but actually costs 1 extra char to index. This is acceptable because:
1. Simplifies implementation (all values indexed uniformly)
2. Minimal overhead (1 char across entire font = negligible)
3. Future optimization potential (special encoding for common small values)

---

## Implementation Details

### 1. MetricsMinifier.js Changes

**New method:** `#createValueLookupTable(characterMetrics)`

```javascript
static #createValueLookupTable(characterMetrics) {
  // Step 1: Collect all unique values and count occurrences
  const valueOccurrences = new Map(); // value -> count
  
  for (const char of DEFAULT_CHARACTER_SET) {
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
  
  // Step 2: Calculate scores and sort
  const valueScores = Array.from(valueOccurrences.entries()).map(([value, count]) => {
    const stringLength = JSON.stringify(value).length;
    const score = count * stringLength;
    return { value, count, stringLength, score };
  });
  
  // Sort by score DESCENDING (highest savings first)
  valueScores.sort((a, b) => b.score - a.score);
  
  // Step 3: Create value lookup table (sorted by score)
  const valueLookup = valueScores.map(vs => vs.value);
  
  // Step 4: Create value-to-index map for fast lookup
  const valueToIndex = new Map();
  valueLookup.forEach((value, index) => {
    valueToIndex.set(value, index);
  });
  
  // Step 5: Convert glyph arrays to use indices
  const indexedGlyphs = Array.from(DEFAULT_CHARACTER_SET).map(char => {
    const glyph = characterMetrics[char];
    return [
      valueToIndex.get(glyph.width),
      valueToIndex.get(glyph.actualBoundingBoxLeft),
      valueToIndex.get(glyph.actualBoundingBoxRight),
      valueToIndex.get(glyph.actualBoundingBoxAscent),
      valueToIndex.get(glyph.actualBoundingBoxDescent)
    ];
  });
  
  return {
    valueLookup,
    indexedGlyphs
  };
}
```

**Modified method:** `minify()`

```javascript
static minify(metricsData) {
  // ... existing validation ...
  
  const { valueLookup, indexedGlyphs } = this.#createValueLookupTable(
    metricsData.characterMetrics
  );
  
  return {
    k: this.#minifyKerningTable(metricsData.kerningTable),
    b: this.#extractMetricsCommonToAllCharacters(metricsData.characterMetrics),
    v: valueLookup,          // NEW: Value lookup table
    g: indexedGlyphs,        // MODIFIED: Now contains indices instead of raw values
    s: metricsData.spaceAdvancementOverrideForSmallSizesInPx
  };
}
```

### 2. MetricsExpander.js Changes

**Modified method:** `expand()`

```javascript
static expand(minified) {
  if (typeof FontMetrics === 'undefined') {
    throw new Error('FontMetrics class not found...');
  }
  
  // Reject legacy format with 'c' field
  if (minified.c) {
    throw new Error('Legacy minified format detected - \'c\' field present...');
  }
  
  // Require value lookup table
  if (!minified.v) {
    throw new Error(
      'Missing value lookup table (\'v\' field).\n' +
      'This file was generated with an old format and is no longer supported.\n' +
      'Please regenerate font assets using the current font-assets-builder.'
    );
  }
  
  const expandedData = {
    kerningTable: this.#expandKerningTable(minified.k),
    characterMetrics: this.#expandCharacterMetrics(minified.g, minified.b, minified.v),
    spaceAdvancementOverrideForSmallSizesInPx: minified.s
  };
  
  return new FontMetrics(expandedData);
}
```

**Modified method:** `#expandCharacterMetrics()`

```javascript
static #expandCharacterMetrics(minifiedGlyphs, metricsCommonToAllCharacters, valueLookup) {
  const expanded = {};
  const chars = Array.from(DEFAULT_CHARACTER_SET);
  
  chars.forEach((char, index) => {
    const indices = minifiedGlyphs[index];
    
    // Look up actual values from indices
    const width = valueLookup[indices[0]];
    const actualBoundingBoxLeft = valueLookup[indices[1]];
    const actualBoundingBoxRight = valueLookup[indices[2]];
    const actualBoundingBoxAscent = valueLookup[indices[3]];
    const actualBoundingBoxDescent = valueLookup[indices[4]];
    
    expanded[char] = {
      width,
      actualBoundingBoxLeft,
      actualBoundingBoxRight,
      actualBoundingBoxAscent,
      actualBoundingBoxDescent,
      fontBoundingBoxAscent: metricsCommonToAllCharacters.fba,
      fontBoundingBoxDescent: metricsCommonToAllCharacters.fbd,
      hangingBaseline: metricsCommonToAllCharacters.hb,
      alphabeticBaseline: metricsCommonToAllCharacters.ab,
      ideographicBaseline: metricsCommonToAllCharacters.ib,
      pixelDensity: metricsCommonToAllCharacters.pd
    };
  });
  
  return expanded;
}
```

---

## File Format

### New Format (with value indexing)

```json
{
  "k": {...},
  "b": {
    "fba": 17,
    "fbd": 4,
    "hb": 17.2002,
    "ab": 0,
    "ib": -4.0264,
    "pd": 1
  },
  "v": [10.5669, 0.2188, 13.5938, 0, 13.8281, ...],
  "g": [
    [0,3,0,2,3],
    [0,3,0,2,3],
    [0,3,0,2,1],
    // 204 glyphs
  ],
  "s": 5
}
```

### Legacy Format (REJECTED)

```json
{
  "k": {...},
  "b": {...},
  "g": [[5.1399,0,5.1399,0,0], ...],  // Raw values (no 'v' field)
  "s": 5
}
```

**Error message:**
```
Missing value lookup table ('v' field).
This file was generated with an old format and is no longer supported.
Please regenerate font assets using the current font-assets-builder.
```

---

## Breaking Changes

**This is a BREAKING CHANGE** - all existing font files MUST be regenerated.

### Migration Steps

1. Open `public/font-assets-builder.html`
2. Select your fonts and sizes
3. Click "Build Font Assets"
4. Download `fontAssets.zip`
5. **Replace ALL files** in `font-assets/` directory

**DO NOT mix old and new files** - they are incompatible.

---

## Expected Savings

### Per Font File

| Component | Old Size | New Size | Saved |
|-----------|----------|----------|-------|
| Glyph data ('g') | 3,818 chars | 1,146 chars | 2,672 chars |
| Value lookup ('v') | 0 chars | 660 chars | -660 chars |
| **Net savings** | - | - | **2,012 chars (52.7%)** |

### Typical Project (3 font sizes)

- Old glyph data total: ~11.5 KB
- New glyph data total: ~5.4 KB
- **Total savings: ~6 KB (52%)**

### Combined with Previous Optimizations

| Optimization | Savings Per File |
|-------------|------------------|
| Tier 3: 2D Kerning Compression | 2,239 bytes |
| Tier 3: 'c' field elimination | 208 bytes |
| **Tier 4: Value Indexing** | **2,012 bytes** |
| **Total** | **4,459 bytes (~43%)** |

---

## Testing Strategy

### 1. Create Value Indexing Test

**File:** `metrics compression/test-value-indexing.js`

Tests:
1. ✅ Value lookup table is created correctly
2. ✅ Values are sorted by score (occurrences × string_length)
3. ✅ High-scoring values get low indices (0-9)
4. ✅ All glyph values replaced with correct indices
5. ✅ Roundtrip integrity (minify → expand → compare)
6. ✅ Actual savings match expected savings

### 2. Update Existing Tests

Update `test-roundtrip-verification.js`:
- Verify 'v' field exists in minified data
- Verify 'g' field contains indices (integers 0-107)
- Verify old format (without 'v') is rejected

### 3. Integration Testing

- Regenerate all font assets
- Test font-assets-builder.html in browser
- Run Node.js demos
- Verify all fonts load correctly

---

## Edge Cases

### 1. Floating Point Precision

JavaScript `Map` uses `SameValueZero` comparison:
- `0 === -0` (both map to same entry) ✅
- `NaN !== NaN` (would create duplicate entries)

For font metrics, we should never have `NaN`, so this is safe.

### 2. Value Uniqueness

Using `Map.set(value, count)` with numeric keys:
- `Map.set(0, ...)` and `Map.set(0.0, ...)` → same entry ✅
- `Map.set(1, ...)` and `Map.set(1.0, ...)` → same entry ✅

JavaScript numbers are always IEEE 754 doubles, so this works correctly.

### 3. Large Index Values

If we have >100 unique values:
- Indices 100-107 are 3 characters each
- Still beneficial because values are 6-7 characters

Example:
- Value `0.2188` (6 chars) with index 105 (3 chars) = 3 chars saved per occurrence
- Even with 3-char index, we save 50% per occurrence

### 4. Very Rare Values

Values that appear only once or twice might not benefit from indexing:
- Value `15.4287` (7 chars) appearing 1 time, index 100 (3 chars)
- Baseline: 7 chars
- Indexed: 7 (lookup) + 3 (index) = 10 chars
- Loss: 3 chars

**Decision:** Index ALL values anyway because:
1. Simplifies implementation (uniform encoding)
2. Simplifies expansion (always look up)
3. Overhead is minimal (few rare values)
4. Total net savings still ~52%

---

## Implementation Checklist

### Core Changes
- [ ] Add `#createValueLookupTable()` to MetricsMinifier.js
- [ ] Modify `minify()` to use value indexing
- [ ] Modify `minifyWithVerification()` to verify indexed format
- [ ] Modify `expand()` in MetricsExpander.js to require 'v' field
- [ ] Modify `#expandCharacterMetrics()` to use value lookup

### Testing
- [ ] Create `test-value-indexing.js`
- [ ] Update `test-roundtrip-verification.js`
- [ ] Run all tests and verify they pass

### Build Scripts
- [ ] Verify Node.js demo build scripts work with indexed format
- [ ] Test font-assets-builder.html in browser

### Documentation
- [ ] Create `VALUE-INDEXING-COMPLETE.md`
- [ ] Update README with new savings numbers
- [ ] Document breaking change

### Font Assets
- [ ] Regenerate ALL font files
- [ ] Verify file sizes decreased by ~52%
- [ ] Test all fonts load correctly

---

## Success Criteria

✅ All tests pass
✅ Roundtrip verification succeeds
✅ Font files are ~52% smaller (glyph data)
✅ Node.js demos work correctly
✅ Browser font builder works correctly
✅ Clear error messages for old format
✅ Documentation complete

---

## Status

📋 **PLANNED** - Ready for implementation

Next step: Implement `#createValueLookupTable()` in MetricsMinifier.js
