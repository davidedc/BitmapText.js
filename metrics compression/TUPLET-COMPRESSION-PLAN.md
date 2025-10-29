# Tuplet Compression Optimization - Implementation Plan

**Date:** 2025-10-18
**Optimization:** Tier 5 - Tuplet Length Compression
**Expected Savings:** ~22% reduction in glyph array index count (~225 index values)
**Combined with Tier 4:** ~60% total savings on glyph data

---

## Problem Analysis

### Current Format (After Tier 4 - Value Indexing)

```javascript
{
  "v": [10.5669, 0.2188, 13.5938, 0, ...],  // Value lookup table
  "g": [
    [7,3,7,2,3],     // [width_idx, left_idx, right_idx, ascent_idx, descent_idx]
    [0,3,0,2,1],     //  ^^^^^^^^^           ^^^^^^^^^               ^^^^^^^^^
    [7,3,7,2,3],     //  often same          often same              often same
    // 204 glyphs × 5 indices = 1,020 index values
  ]
}
```

**Observed Redundancy Patterns:**

1. **Pattern 1:** `indices[0] === indices[2]` (width === right)
   - Occurs when `actualBoundingBoxRight === width`
   - Very common in most fonts (~70% of glyphs)

2. **Pattern 2:** `indices[1] === indices[4]` (left === descent)
   - Occurs when both are 0 (most common case)
   - Frequently co-occurs with Pattern 1 (~40% of glyphs)

**Real Example:**
```javascript
[7, 3, 7, 2, 3]
//^     ^     ^
//same  same  same

// Pattern 1: indices[0] === indices[2]  (7 === 7) ✓
// Pattern 2: indices[1] === indices[4]  (3 === 3) ✓
```

---

## Proposed Optimization

### Three Compression Cases

**Case A - No Compression (5 elements):**
```javascript
[w, l, r, a, d]  // All values independent
```
- Condition: `w ≠ r`
- No decompression needed
- Example: `[0, 3, 5, 2, 1]` (width ≠ right)

**Case B - Width=Right Compression (4 elements):**
```javascript
[w, l, a, d]  // Omit 'r' since r === w
```
- Condition: `w === r  AND  l ≠ d`
- Decompression: Insert `w` at position 2
- Example: `[7, 3, 2, 1]` → `[7, 3, 7, 2, 1]`
           
**Case C - Both Compressions (3 elements):**
```javascript
[w, l, a]  // Omit 'r' and 'd' since r === w and d === l
```
- Condition: `w === r  AND  l === d`
- Decompression: Insert `w` at position 2, insert `l` at position 4
- Example: `[7, 3, 2]` → `[7, 3, 7, 2, 3]`

---

## Decompression Algorithm

```javascript
function decompressTuplet(compressed) {
  if (compressed.length === 5) {
    // Case A: No decompression needed
    return compressed;
  }
  else if (compressed.length === 4) {
    // Case B: w === r (insert w at position 2)
    return [
      compressed[0],  // width
      compressed[1],  // left
      compressed[0],  // right = width
      compressed[2],  // ascent
      compressed[3]   // descent
    ];
  }
  else if (compressed.length === 3) {
    // Case C: w === r AND l === d
    return [
      compressed[0],  // width
      compressed[1],  // left
      compressed[0],  // right = width
      compressed[2],  // ascent
      compressed[1]   // descent = left
    ];
  }
  else {
    throw new Error(`Invalid tuplet length: ${compressed.length}`);
  }
}
```

**Key Insight:** The decompression logic is **deterministic** based solely on array length!

---

## Expected Savings

### Conservative Estimates

Based on typical font metrics patterns:

| Case | Condition | Estimated % | Glyphs | Elements | Total Indices |
|------|-----------|-------------|--------|----------|---------------|
| C | w===r AND l===d | 40% | 82 | 3 | 246 |
| B | w===r only | 30% | 61 | 4 | 244 |
| A | No compression | 30% | 61 | 5 | 305 |
| **Total** | | **100%** | **204** | | **795** |

**Current (5 elements per glyph):** 204 × 5 = 1,020 index values

**Compressed:** 82×3 + 61×4 + 61×5 = 795 index values

**Savings:** 1,020 - 795 = **225 index values (22.1%)**

### Character Savings

Assuming average index length of 1.5 characters (mix of 0-9 and 10-99):
- Index savings: 225 indices × 1.5 chars = **338 characters**
- Separator savings: 225 fewer commas = **225 characters**
- **Total: ~563 characters saved**

### Combined with Tier 4

**Before any indexing:** 3,818 characters (raw values)
**After Tier 4:** 1,806 characters (value indexing)
**After Tier 5:** ~1,243 characters (+ tuplet compression)

**Total savings from Tiers 4+5:** 3,818 - 1,243 = **2,575 characters (67.5%)**

---

## Implementation Details

### 1. MetricsMinifier.js Changes

**Modify `#createValueLookupTable()` method:**

```javascript
// Step 5: Convert glyph arrays to indices and compress tuplets
const indexedGlyphs = Array.from(CHARACTER_SET).map(char => {
  const glyph = characterMetrics[char];
  const indices = [
    valueToIndex.get(glyph.width),                      // 0
    valueToIndex.get(glyph.actualBoundingBoxLeft),      // 1
    valueToIndex.get(glyph.actualBoundingBoxRight),     // 2
    valueToIndex.get(glyph.actualBoundingBoxAscent),    // 3
    valueToIndex.get(glyph.actualBoundingBoxDescent)    // 4
  ];
  
  // Check compression opportunities
  const widthEqualsRight = indices[0] === indices[2];   // w === r
  const leftEqualsDescent = indices[1] === indices[4];  // l === d
  
  if (widthEqualsRight && leftEqualsDescent) {
    // Case C: Both conditions - compress to 3 elements [w, l, a]
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
```

**Add compression statistics logging:**

```javascript
// Count compression cases for debugging
let caseC = 0, caseB = 0, caseA = 0;
for (const tuplet of indexedGlyphs) {
  if (tuplet.length === 3) caseC++;
  else if (tuplet.length === 4) caseB++;
  else caseA++;
}

console.debug(`🗜️  Tuplet compression: ${caseC} × 3-elem, ${caseB} × 4-elem, ${caseA} × 5-elem (saved ${1020 - (caseC*3 + caseB*4 + caseA*5)} indices)`);
```

### 2. MetricsExpander.js Changes

**Modify `#expandCharacterMetrics()` method:**

```javascript
static #expandCharacterMetrics(minifiedGlyphs, metricsCommonToAllCharacters, valueLookup) {
  const expanded = {};
  const chars = Array.from(CHARACTER_SET);

  chars.forEach((char, index) => {
    const compressed = minifiedGlyphs[index];
    let indices;
    
    // Decompress based on tuplet length
    if (compressed.length === 3) {
      // Case C: [w, l, a] → [w, l, w, a, l]
      indices = [
        compressed[0],  // width
        compressed[1],  // left
        compressed[0],  // right = width (case 1)
        compressed[2],  // ascent
        compressed[1]   // descent = left (case 2)
      ];
    }
    else if (compressed.length === 4) {
      // Case B: [w, l, a, d] → [w, l, w, a, d]
      indices = [
        compressed[0],  // width
        compressed[1],  // left
        compressed[0],  // right = width (case 1)
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
        `Invalid glyph tuplet length for character "${char}": ${compressed.length}.\n` +
        `Expected 3, 4, or 5 elements, got [${compressed.join(',')}].\n` +
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
      width,
      actualBoundingBoxLeft,
      actualBoundingBoxRight,
      actualBoundingBoxAscent,
      actualBoundingBoxDescent,
      // ... common metrics
    };
  });
  
  return expanded;
}
```

---

## File Format

### New Format (with tuplet compression)

```json
{
  "k": {...},
  "b": {...},
  "v": [10.5669, 0.2188, 13.5938, 0, ...],
  "g": [
    [7,3,2],       // Case C: 3 elements (w===r AND l===d)
    [0,3,2,1],     // Case B: 4 elements (w===r only)
    [5,3,7,2,1],   // Case A: 5 elements (no compression)
    // Mixed lengths based on redundancy patterns
  ],
  "s": 5
}
```

### Legacy Format (without tuplet compression)

```json
{
  "k": {...},
  "b": {...},
  "v": [10.5669, 0.2188, 13.5938, 0, ...],
  "g": [
    [7,3,7,2,3],   // Always 5 elements
    [0,3,0,2,1],
    [5,3,7,2,1],
  ],
  "s": 5
}
```

**Note:** This is a backwards-compatible optimization!
- Old format (all 5-element tuplets) still works
- New format (mixed 3/4/5-element tuplets) is more compact
- Expander handles both seamlessly

**However, per user requirement:** We'll make it breaking (no backwards compatibility)
- Clear error if any tuplet has unexpected length
- Simpler code, clearer behavior

---

## Breaking Changes

**This is a BREAKING CHANGE** - tuplet format changes from fixed 5-element to variable 3/4/5-element.

### Migration

All font files MUST be regenerated (this already applies from Tier 4).

### Error Handling

**Invalid tuplet length:**
```
Invalid glyph tuplet length for character "A": 6.
Expected 3, 4, or 5 elements, got [7,3,7,2,3,1].
This indicates a corrupted font file. Please regenerate font assets.
```

---

## Testing Strategy

### 1. Unit Tests for Compression Logic

**File:** `metrics compression/test-tuplet-compression.js`

Tests:
1. ✅ Case A (no compression) preserved correctly
2. ✅ Case B (w===r) compressed to 4 elements
3. ✅ Case C (w===r AND l===d) compressed to 3 elements
4. ✅ Decompression logic correct for all cases
5. ✅ Roundtrip integrity (compress → decompress → verify)
6. ✅ Invalid tuplet lengths rejected with clear error
7. ✅ Compression statistics match expected patterns

### 2. Integration Tests

Update existing tests:
- `test-value-indexing.js` - verify tuplets have variable lengths
- `test-roundtrip-verification.js` - verify all glyphs decompress correctly

### 3. Real Font Testing

- Regenerate Arial 19px font
- Verify compression distribution (Case A/B/C percentages)
- Measure actual character savings
- Test in Node.js demos

---

## Edge Cases

### 1. All Glyphs Case A (No Compression)

If no glyphs match compression patterns:
- All tuplets remain 5 elements
- No overhead, just opportunity cost
- Still valid format

### 2. All Glyphs Case C (Maximum Compression)

If all glyphs compress to 3 elements:
- Maximum savings: 204 × 2 = 408 indices
- Unlikely but handled correctly

### 3. Invalid Tuplet Lengths

Tuplets with length ∉ {3, 4, 5}:
- Throw clear error during expansion
- Indicates corrupted file
- Guides user to regenerate

### 4. Negative Indices or Out-of-Bounds

If an index is invalid:
- `valueLookup[index]` returns `undefined`
- Character metrics become invalid
- Caught by existing validation

---

## Implementation Checklist

### Core Changes
- [ ] Modify `#createValueLookupTable()` in MetricsMinifier.js
- [ ] Add compression logic for Cases A/B/C
- [ ] Add compression statistics logging
- [ ] Modify `#expandCharacterMetrics()` in MetricsExpander.js
- [ ] Add decompression logic based on tuplet length
- [ ] Add error handling for invalid lengths

### Testing
- [ ] Create `test-tuplet-compression.js`
- [ ] Test all three compression cases
- [ ] Test decompression logic
- [ ] Test roundtrip integrity
- [ ] Test error handling
- [ ] Update existing tests for variable-length tuplets

### Documentation
- [ ] Create `TUPLET-COMPRESSION-COMPLETE.md`
- [ ] Update `VALUE-INDEXING-COMPLETE.md` with combined savings
- [ ] Document breaking change

### Verification
- [ ] Run all tests
- [ ] Regenerate font assets
- [ ] Verify compression statistics
- [ ] Test Node.js demos
- [ ] Measure actual savings

---

## Success Criteria

✅ All three compression cases work correctly
✅ Decompression logic handles all tuplet lengths
✅ Roundtrip verification succeeds
✅ Compression statistics match expectations (~40% Case C, ~30% Case B, ~30% Case A)
✅ ~225 indices saved (22% reduction)
✅ Combined with Tier 4: ~67.5% total glyph data savings
✅ All tests pass
✅ Node.js demos work correctly

---

## Benefits Summary

### 1. Additional 22% Index Reduction

- ✅ 225 fewer index values
- ✅ ~563 fewer characters (indices + separators)
- ✅ Stacks with Tier 4 value indexing

### 2. Combined Tier 4 + Tier 5 Savings

- ✅ 67.5% total glyph data reduction
- ✅ 2,575 characters saved per font file
- ✅ ~7.7 KB saved in typical project (3 fonts)

### 3. Zero Complexity Cost

- ✅ Decompression is simple array expansion
- ✅ Length-based switching (no flags needed)
- ✅ No runtime performance impact

### 4. Elegant Design

- ✅ Self-describing format (length indicates compression)
- ✅ No additional metadata needed
- ✅ Graceful error handling

---

## Status

📋 **PLANNED** - Ready for implementation

Next step: Implement compression logic in MetricsMinifier.js
