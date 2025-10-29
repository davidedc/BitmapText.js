# Two-Dimensional Kerning Compression - Complete

**Date:** 2025-10-17
**Feature:** Left-side kerning range compression (Tier 3 optimization enhancement)

---

## Summary

Successfully implemented two-dimensional kerning compression that compresses both:
1. **Right-side (existing):** Characters that follow → `{"A":{"0":20,"1":20}}` → `{"A":{"0-1":20}}`
2. **Left-side (NEW):** Characters that come before → `{"A":{"s":20},"B":{"s":20}}` → `{"A-B":{"s":20}}`

---

## Results on Real Font File

**File:** `metrics-density-1-0-Arial-style-normal-weight-normal-size-19-0.js`

### Compression Metrics

| Metric | Before | After | Savings |
|--------|--------|-------|---------|
| **Kerning table** | 3,244 bytes | 1,005 bytes | **2,239 bytes (69.0%)** |
| **Total JSON** | 9,894 bytes | 7,655 bytes | **2,239 bytes (22.6%)** |
| **Left entries** | 204 (0 ranges) | 31 (6 ranges) | 173 entries eliminated |
| **Right entries** | 280 (13 ranges) | 107 (13 ranges) | 173 entries eliminated |

### Key Achievements

✅ **69.0% kerning table compression** (vs 0% without left-side compression)
✅ **6 new left-side ranges** created automatically
✅ **100% data integrity** (verified roundtrip successful)
✅ **Backward compatible** with existing font files
✅ **No breaking changes** to API or file format

---

## Implementation Details

### Sequential Two-Pass Approach

As requested by user: *"for simplicity can you first compress in one sense, and then in the second?"*

```javascript
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
```

### Left-Side Compression Algorithm

1. **Group by signature:** Group left characters that have identical right-side objects (using JSON.stringify)
2. **Find ranges:** Convert character indices to ranges using existing `#findConsecutiveRanges()` helper
3. **Create notation:** Use "A-C" format for 3+ consecutive characters, keep 1-2 characters separate

### Example Compression

**Before (right-side only):**
```json
{
  "A": {"s-u": -20, "v": -15},
  "B": {"s-u": -20, "v": -10},
  "C": {"s-u": -20, "v": -10},
  "D": {"s-u": -20, "w": -5},
  "E": {"s-u": -20, "w": -5}
}
```

**After (two-dimensional):**
```json
{
  "A": {"s-u": -20, "v": -15},
  "B-C": {"s-u": -20, "v": -10},
  "D-E": {"s-u": -20, "w": -5}
}
```

---

## Files Modified

### 1. `src/builder/MetricsMinifier.js`
- ✅ Added `#compressLeftSide()` method (lines 190-246)
- ✅ Updated `#minifyKerningTable()` to implement two-pass compression
- ✅ Updated documentation with two-dimensional examples

**Key method:**
```javascript
static #compressLeftSide(kerningTable, characterOrder) {
  // Groups left characters by identical right-side objects
  // Creates ranges for 3+ consecutive characters
  // Reuses existing #findConsecutiveRanges() helper
}
```

### 2. `src/builder/MetricsExpander.js`
- ✅ Added `#expandLeftSide()` method (lines 64-104)
- ✅ Updated `#expandKerningTable()` to implement two-pass expansion (reverse order)
- ✅ Updated documentation with two-dimensional examples

**Key method:**
```javascript
static #expandLeftSide(minified, characterOrder) {
  // Expands left-side ranges before right-side expansion
  // Reverses the compression order
}
```

---

## Testing

### Test 1: Two-Dimensional Compression Roundtrip
**File:** `metrics compression/test-two-dimensional-compression.js`

**Results:**
- ✅ 70.9% compression ratio (203 → 59 bytes)
- ✅ 2 left-side ranges created ("A-C", "D-F")
- ✅ 2 right-side ranges created ("s-u", "a-e")
- ✅ Perfect roundtrip (expand → compress produces identical data)

**Test data:**
```javascript
{
  "A-C": {      // Left range: A, B, C
    "s-u": -20  // Right range: s, t, u
  },
  "D-F": {      // Left range: D, E, F
    "v": -15,
    "w": -15
  },
  "G": {
    "a-e": -25  // Right range: a, b, c, d, e
  }
}
```

### Test 2: Real Font File Compression
**File:** `metrics compression/measure-real-file-savings.js`

**Results:**
- ✅ 69.0% kerning table compression (3,244 → 1,005 bytes)
- ✅ 22.6% total file size reduction
- ✅ 6 left-side ranges created on Arial 19.0 font
- ✅ Perfect data integrity verified

---

## Optimization Strategy

### When Ranges Are Created

**Left-side ranges:**
- Only for 3+ consecutive characters
- Only when characters have **identical** right-side objects
- Uses JSON.stringify for object comparison

**Right-side ranges:**
- Only for 3+ consecutive characters
- Only when characters have the same kerning value
- Existing optimization (unchanged)

### Why 3+ Characters?

Range notation "A-C" uses 3 characters. For only 2 characters:
- Range: `"A-B"` = 3 chars in JSON
- Separate: `"A","B"` = 2 chars in JSON (with comma)
- **Separate is more efficient!**

For 3+ characters:
- Range: `"A-C"` = 3 chars
- Separate: `"A","B","C"` = 5 chars
- **Range is more efficient!**

---

## Performance Impact

### Compression (Build-time)
- **No performance impact** - only runs during font asset building
- Sequential two-pass approach is simple and fast
- Reuses existing `#findConsecutiveRanges()` helper

### Expansion (Runtime)
- **Minimal impact** - expansion happens once per font load
- Two-pass expansion is straightforward
- Same algorithmic complexity as before

### Runtime Usage
- **No impact** - expanded data is identical to original
- Rendering performance unchanged

---

## Backward Compatibility

✅ **Fully backward compatible** - no breaking changes

**Handles all scenarios:**
1. ✅ Old files with no left-side ranges → expand correctly
2. ✅ New files with left-side ranges → expand correctly
3. ✅ Mixed character orders → works with any order
4. ✅ Files without kerning data → no overhead

**Example:** Old file without left-side ranges still works:
```javascript
// Old format (still supported)
{"A": {"s-u": -20}, "B": {"s-u": -20}}

// Expands to same result as:
// New format
{"A-B": {"s-u": -20}}
```

---

## Future Optimizations

This implementation opens the door for further optimizations:

### 1. Character Set Elimination (Already Implemented)
- Omit 'c' field when using CHARACTER_SET
- Saves 208 bytes per file

### 2. Three-Dimensional Compression (Future)
- Group by kerning value, then create 2D ranges
- Example: `{"-20": {"A-C": "s-u"}}` for all A/B/C + s/t/u pairs with value -20
- Potential additional 10-20% savings

### 3. Statistical Encoding (Future)
- Use most common kerning values as defaults
- Only store exceptions
- Potential additional 15-30% savings for fonts with repetitive kerning

---

## Recommendation

**Action:** Regenerate font assets to benefit from two-dimensional compression

**Steps:**
1. Open `public/font-assets-builder.html`
2. Select font and sizes
3. Build and download
4. Replace files in `font-assets/`

**Benefits:**
- 69% smaller kerning tables
- 22% smaller total file sizes
- Faster network transfer
- Faster font loading
- No code changes required

---

## Summary

**Problem:** Kerning tables had redundancy in both dimensions
**Solution:** Two-dimensional sequential compression (right → left)
**Result:** 69% kerning table compression on real font files
**Impact:** 2,239 bytes saved per font (22.6% total reduction)
**Quality:** 100% data integrity, backward compatible

✅ **IMPLEMENTATION COMPLETE AND TESTED**

---

## Related Documents

- `FIX-CHARACTER-ORDER-BUG.md` - Character order independence fix
- `FIX-COMPLETE.md` - CHARACTER_SET duplicate const fix
- `FIX-DUPLICATE-CONST.md` - Original duplicate const error
- `test-two-dimensional-compression.js` - Roundtrip test
- `measure-real-file-savings.js` - Real file analysis
