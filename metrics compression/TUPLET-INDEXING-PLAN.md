# Tuplet Indexing Optimization - Implementation Plan

**Date:** 2025-10-18
**Optimization:** Tier 5 - Tuplet Indexing (Index Arrays Deduplication)
**Expected Savings:** ~15-40% additional reduction on glyph data
**Builds On:** Tier 4 (Value Indexing)

---

## Problem Analysis

### Current Format (After Tier 4 - Value Indexing)

```javascript
{
  "k": {...},
  "b": {...},
  "v": [10.5669, 0.2188, 13.5938, 0, ...],  // Value lookup table
  "g": [
    [0,3,0,2,1],     // Tuplet of indices
    [0,3,0,2,3],
    [0,3,0,2,1],     // DUPLICATE of first tuplet!
    [0,3,0,4,1],
    [0,3,0,2,1],     // Another duplicate!
    // ... 204 glyphs
  ],
  "s": 5
}
```

**Problem:** Many tuplets are IDENTICAL

Analysis shows:
- 204 total glyphs (tuplets)
- ~128 unique tuplets (actual number varies by font)
- **37.3% deduplication potential**
- Top tuplet appears 16 times

**Example:**
- Tuplet `[0,3,0,2,1]` (11 chars in JSON) appears 16 times
- Current: 16 × 11 = 176 chars
- If indexed at position 0: 11 (lookup) + 16 × 1 (index) = 27 chars
- **Savings: 149 chars from ONE tuplet!**

### Proposed Format (Tier 5 - Tuplet Indexing)

```javascript
{
  "k": {...},
  "b": {...},
  "v": [10.5669, 0.2188, 13.5938, 0, ...],        // Value lookup (Tier 4)
  "t": [[0,3,0,2,1], [0,3,0,2,3], [0,3,0,4,1]], // Tuplet lookup (Tier 5)
  "g": [0, 1, 0, 2, 0],                          // Indices into 't' array
  "s": 5
}
```

**Benefits:**
- Each unique tuplet stored once in 't'
- 'g' array becomes single integers instead of arrays
- Shorter JSON representation
- Faster parsing (simpler structure)

---

## Optimization Strategy

### Scoring Algorithm

**Goal:** Maximize savings by assigning shortest indices to highest-value tuplets

**Scoring Function:**
```
score(tuplet) = JSON.stringify(tuplet).length × occurrences
```

**Why this works:**
- Long JSON representation → more chars to save per occurrence
- High occurrence count → more savings from short index
- Same algorithm as Tier 4, applied to tuplets instead of values

**Example Scoring:**

| Tuplet | JSON Length | Occurrences | Score | Index | Savings |
|--------|-------------|-------------|-------|-------|---------|
| `[0,3,0,2,1]` | 11 | 16 | 176 | 0 | 11 + 16×1 = 27 vs 176 = **149 saved** |
| `[4,3,2]` | 7 | 8 | 56 | 1 | 7 + 8×1 = 15 vs 56 = **41 saved** |
| `[4,18,20,11,3]` | 14 | 3 | 42 | 2 | 14 + 3×1 = 17 vs 42 = **25 saved** |
| `[0,3,19,1]` | 10 | 4 | 40 | 3 | 10 + 4×1 = 14 vs 40 = **26 saved** |

**Index Length Impact:**
- Indices 0-9: 1 character (10 slots)
- Indices 10-99: 2 characters (90 slots)
- Indices 100-127: 3 characters (28 slots for typical font)

### Algorithm Steps

1. **Input:** Value-indexed glyph arrays from Tier 4
2. **Collect unique tuplets** and count occurrences
3. **Calculate scores:** `JSON.stringify(tuplet).length × count`
4. **Sort by score descending**
5. **Create tuplet lookup table** (sorted by score)
6. **Create tuplet-to-index map** for fast lookup
7. **Replace all tuplet arrays** with single indices
8. **Output:** `{v, t, g, k, b, s}`

---

## Implementation Details

### 1. MetricsMinifier.js Changes

**New method:** `#createTupletLookupTable(indexedGlyphs)`

```javascript
static #createTupletLookupTable(indexedGlyphs) {
  // Step 1: Collect unique tuplets and count occurrences
  const tupletOccurrences = new Map(); // stringified tuplet -> {tuplet, count}
  
  for (const tuplet of indexedGlyphs) {
    const key = JSON.stringify(tuplet);
    if (!tupletOccurrences.has(key)) {
      tupletOccurrences.set(key, { tuplet, count: 0 });
    }
    tupletOccurrences.get(key).count++;
  }
  
  // Step 2: Calculate scores and sort
  const tupletScores = Array.from(tupletOccurrences.values()).map(({tuplet, count}) => {
    const stringLength = JSON.stringify(tuplet).length;
    const score = stringLength * count;
    return { tuplet, count, stringLength, score };
  });
  
  // Sort by score DESCENDING (highest savings first)
  tupletScores.sort((a, b) => b.score - a.score);
  
  // Step 3: Create tuplet lookup table
  const tupletLookup = tupletScores.map(ts => ts.tuplet);
  
  // Step 4: Create tuplet-to-index map
  const tupletToIndex = new Map();
  tupletLookup.forEach((tuplet, index) => {
    const key = JSON.stringify(tuplet);
    tupletToIndex.set(key, index);
  });
  
  // Step 5: Convert glyph arrays to tuplet indices
  const tupletIndices = indexedGlyphs.map(tuplet => {
    const key = JSON.stringify(tuplet);
    return tupletToIndex.get(key);
  });
  
  return {
    tupletLookup,
    tupletIndices
  };
}
```

**Modified method:** `minify()`

```javascript
static minify(metricsData) {
  // ... existing validation ...
  
  // TIER 4: Create value lookup and indexed glyphs
  const { valueLookup, indexedGlyphs } = this.#createValueLookupTable(
    metricsData.characterMetrics
  );
  
  // TIER 5: Create tuplet lookup and tuplet indices
  const { tupletLookup, tupletIndices } = this.#createTupletLookupTable(
    indexedGlyphs
  );
  
  return {
    k: this.#minifyKerningTable(metricsData.kerningTable),
    b: this.#extractMetricsCommonToAllCharacters(metricsData.characterMetrics),
    v: valueLookup,          // TIER 4: Value lookup table
    t: tupletLookup,         // TIER 5: Tuplet lookup table
    g: tupletIndices,        // TIER 5: Now single integers, not arrays!
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
  
  // Reject legacy formats
  if (minified.c) {
    throw new Error('Legacy minified format detected - \'c\' field present...');
  }
  
  if (!minified.v) {
    throw new Error('Missing value lookup table (\'v\' field)...');
  }
  
  // Require tuplet lookup table (Tier 5)
  if (!minified.t) {
    throw new Error(
      'Missing tuplet lookup table (\'t\' field).\n' +
      'This file was generated with an old format (Tier 4 only).\n' +
      'Please regenerate font assets using the current font-assets-builder.'
    );
  }
  
  const expandedData = {
    kerningTable: this.#expandKerningTable(minified.k),
    characterMetrics: this.#expandCharacterMetrics(
      minified.g,
      minified.b,
      minified.v,
      minified.t  // NEW: Pass tuplet lookup
    ),
    spaceAdvancementOverrideForSmallSizesInPx: minified.s
  };
  
  return new FontMetrics(expandedData);
}
```

**Modified method:** `#expandCharacterMetrics()`

```javascript
static #expandCharacterMetrics(tupletIndices, metricsCommonToAllCharacters, valueLookup, tupletLookup) {
  const expanded = {};
  const chars = Array.from(CHARACTER_SET);
  
  chars.forEach((char, index) => {
    // TIER 5: Look up tuplet from index
    const tupletIndex = tupletIndices[index];
    const valueIndices = tupletLookup[tupletIndex];
    
    // TIER 4: Look up actual values from value indices
    const width = valueLookup[valueIndices[0]];
    const actualBoundingBoxLeft = valueLookup[valueIndices[1]];
    const actualBoundingBoxRight = valueLookup[valueIndices[2]];
    const actualBoundingBoxAscent = valueLookup[valueIndices[3]];
    const actualBoundingBoxDescent = valueLookup[valueIndices[4]];
    
    expanded[char] = {
      width,
      actualBoundingBoxLeft,
      actualBoundingBoxRight,
      actualBoundingBoxAscent,
      actualBoundingBoxDescent,
      fontBoundingBoxAscent: metricsCommonToAllCharacters.fba,
      fontBoundingBoxDescent: metricsCommonToAllCharacters.fbd,
      emHeightAscent: metricsCommonToAllCharacters.fba,
      emHeightDescent: metricsCommonToAllCharacters.fbd,
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

## File Format Evolution

### Tier 4 Format (Old - Rejected)

```json
{
  "k": {...},
  "b": {...},
  "v": [10.5669, 0.2188, ...],
  "g": [[0,3,0,2,1], [0,3,0,2,3], ...],  // Arrays of indices
  "s": 5
}
```

### Tier 5 Format (New - Required)

```json
{
  "k": {...},
  "b": {...},
  "v": [10.5669, 0.2188, ...],           // Value lookup
  "t": [[0,3,0,2,1], [0,3,0,2,3], ...],  // Tuplet lookup
  "g": [0, 1, 0, 2, ...],                 // Single integers!
  "s": 5
}
```

---

## Expected Savings

### Conservative Estimate

Based on analysis of Arial 19px (128 unique tuplets out of 204 glyphs):

| Component | Tier 4 Size | Tier 5 Size | Saved |
|-----------|-------------|-------------|-------|
| Glyph data ('g') | 1,960 chars | 385 chars | 1,575 chars |
| Tuplet lookup ('t') | 0 chars | 1,280 chars | -1,280 chars |
| **Net savings** | - | - | **295 chars (15%)** |

### Optimistic Estimate

If font has more repeated glyphs (e.g., monospace font):

- Could reach 30-40% additional savings
- More homogeneous glyphs = more duplication = more savings

---

## Combined Optimization Impact

### All Tiers (Per Font File)

| Tier | Optimization | Savings |
|------|--------------|---------|
| 3 | 2D Kerning Compression | 2,239 bytes |
| 3 | 'c' field elimination | 208 bytes |
| 4 | Value Indexing | 2,012 bytes |
| **5** | **Tuplet Indexing** | **~295 bytes** |
| **Total** | | **~4,754 bytes (46%)** |

---

## Testing Strategy

### 1. Create Tuplet Indexing Test

**File:** `metrics compression/test-tuplet-indexing.js`

Tests:
1. ✅ Tuplet lookup table created correctly
2. ✅ Tuplets sorted by score (JSON_length × occurrences)
3. ✅ High-scoring tuplets get low indices (0-9)
4. ✅ All glyph arrays replaced with valid tuplet indices
5. ✅ Roundtrip integrity (minify → expand → compare)
6. ✅ Actual savings match expectations
7. ✅ Old format (Tier 4 without 't') rejected

### 2. Update Roundtrip Verification

Modify `minifyWithVerification()` to verify Tier 5 format:
- Ensure 't' field exists
- Ensure 'g' field contains single integers (not arrays)
- Ensure all tuplet indices are valid

---

## Breaking Changes

**This is a BREAKING CHANGE** - all Tier 4 font files MUST be regenerated.

### Migration

1. All font files from Tier 4 are incompatible
2. Must regenerate using font-assets-builder
3. Clear error messages guide regeneration

### Error Messages

**Tier 4 file loaded in Tier 5 runtime:**
```
Missing tuplet lookup table ('t' field).
This file was generated with an old format (Tier 4 only).
Please regenerate font assets using the current font-assets-builder.
```

---

## Edge Cases

### 1. All Tuplets Unique

If all 204 glyphs have unique tuplets:
- Tuplet lookup: 204 entries
- Indices: 204 values (0-203 = 2-3 chars each)
- Overhead: ~408 chars vs direct arrays

**Decision:** Still beneficial because:
1. Simpler structure (single integers)
2. Faster parsing
3. Most fonts WILL have duplicates
4. Future optimization potential

### 2. Variable-Length Tuplets

All tuplets are length 5 (5 metric values per glyph).

**No edge case** - consistent length.

### 3. Floating Point in Lookup

Value lookup 'v' contains floats.
Tuplet lookup 't' contains integer arrays.

**No issue** - different data types, no confusion.

---

## Implementation Checklist

### Core Changes
- [ ] Add `#createTupletLookupTable()` to MetricsMinifier.js
- [ ] Modify `minify()` to create tuplet lookup
- [ ] Update `minifyWithVerification()` to verify Tier 5 format
- [ ] Modify `expand()` in MetricsExpander.js to require 't' field
- [ ] Update `#expandCharacterMetrics()` to use tuplet lookup

### Testing
- [ ] Create `test-tuplet-indexing.js`
- [ ] Update `test-roundtrip-verification.js`
- [ ] Run all tests and verify they pass

### Documentation
- [ ] Create `TUPLET-INDEXING-COMPLETE.md`
- [ ] Update combined savings numbers

### Font Assets
- [ ] Regenerate ALL font files
- [ ] Verify file sizes decreased by ~15%
- [ ] Test all fonts load correctly

---

## Status

📋 **PLANNED** - Ready for implementation

Next step: Implement `#createTupletLookupTable()` in MetricsMinifier.js
