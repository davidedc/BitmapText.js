# BREAKING CHANGE: Removed Legacy Character Order Support

**Date:** 2025-10-17
**Type:** Breaking Change
**Impact:** All existing font files must be regenerated

---

## Changes Made

### 1. Removed 'c' Field from Minified Format

**Before:**
```json
{
  "k": {...},
  "b": {...},
  "g": [...],
  "s": 5,
  "c": "0123456789 !\"#$%..." // 208 bytes
}
```

**After:**
```json
{
  "k": {...},
  "b": {...},
  "g": [...],
  "s": 5
  // No 'c' field - always uses CHARACTER_SET
}
```

**Savings:** 208 bytes per font file

---

## Modified Files

### `src/builder/MetricsMinifier.js`

**Changes:**
- ✅ Removed `characterOrder` parameter from all methods
- ✅ Always uses `CHARACTER_SET` for compression
- ✅ Never includes 'c' field in output
- ✅ Throws error if input characterMetrics not in CHARACTER_SET order
- ✅ Updated all documentation

**Key changes:**
```javascript
// BEFORE: Accepted any character order
static minify(metricsData) {
  const characterOrder = Object.keys(metricsData.characterMetrics).join('');
  if (characterOrder !== CHARACTER_SET) {
    result.c = characterOrder; // Include 'c' field for non-default order
  }
}

// AFTER: Requires CHARACTER_SET order
static minify(metricsData) {
  const characterOrder = Object.keys(metricsData.characterMetrics).join('');
  if (characterOrder !== CHARACTER_SET) {
    throw new Error('characterMetrics must be in CHARACTER_SET order');
  }
  // Never include 'c' field
}
```

### `src/builder/MetricsExpander.js`

**Changes:**
- ✅ Removed `characterOrder` parameter from all methods
- ✅ Always uses `CHARACTER_SET` for expansion
- ✅ Rejects files with 'c' field (legacy format)
- ✅ Updated all documentation

**Key changes:**
```javascript
// BEFORE: Accepted any character order
static expand(minified) {
  const characterOrder = minified.c || CHARACTER_SET;
  // ... use characterOrder
}

// AFTER: Rejects legacy format
static expand(minified) {
  if (minified.c) {
    throw new Error('Legacy format not supported - regenerate font assets');
  }
  // Always use CHARACTER_SET
}
```

### `tools/export-font-data.js`

**Changes:**
- ✅ Sorts characterMetrics into CHARACTER_SET order before minification
- ✅ Validates all characters are in CHARACTER_SET
- ✅ Throws error if unknown characters found

**Key changes:**
```javascript
// Sort characterMetrics into CHARACTER_SET order
const characterMetrics = {};
for (const char of CHARACTER_SET) {
    if (unsortedCharacterMetrics[char]) {
        characterMetrics[char] = unsortedCharacterMetrics[char];
    }
}

// Verify all characters are in CHARACTER_SET
const missingFromDefault = Object.keys(unsortedCharacterMetrics).filter(
    char => !CHARACTER_SET.includes(char)
);
if (missingFromDefault.length > 0) {
    throw new Error('Font contains characters not in CHARACTER_SET');
}
```

---

## Migration Guide

### For Users

**You MUST regenerate all font files:**

1. Open `public/font-assets-builder.html`
2. Select your font and sizes
3. Click "Build Font Assets"
4. Download `fontAssets.zip`
5. Replace all files in `font-assets/` directory

**Warning:** Old font files will throw this error:
```
Legacy minified format detected - 'c' field present.
This file was generated with an old character order and is no longer supported.
Please regenerate font assets using the current font-assets-builder.
```

### For Developers

**If you have custom character sets:**

You must add them to `CHARACTER_SET` in `src/builder/CHARACTER_SET.js`:

```javascript
// Add custom characters to the generation logic
const customChars = ['★', '♥', '→']; // Your custom chars
for (const char of customChars) {
  chars.push(char);
}
```

Then regenerate the constant.

---

## Benefits

### 1. Smaller File Sizes
- **208 bytes saved per font** (no 'c' field)
- **Cumulative savings** across all font sizes

### 2. Simpler Code
- Removed ~50 lines of backwards compatibility code
- No more character order parameter passing
- Clearer intent: one standard character order

### 3. Better Error Messages
- Clear errors when using old files
- Clear errors when using unsupported characters
- Fails fast during build, not at runtime

### 4. Consistent Behavior
- All font files use same character order
- Kerning ranges compress/expand identically
- No edge cases with different character orders

---

## Breaking Changes Summary

### ❌ No Longer Supported

1. **Legacy font files with 'c' field** - will throw error at runtime
2. **Custom character orders** - must match CHARACTER_SET
3. **Mixed character orders** - all files must use same order

### ✅ Required Actions

1. **Regenerate all font files** using current font-assets-builder
2. **Update CHARACTER_SET** if you need custom characters
3. **Test all demos** after regeneration

---

## Technical Details

### Character Order Validation

**Build-time (MetricsMinifier):**
```javascript
const characterOrder = Object.keys(metricsData.characterMetrics).join('');
if (characterOrder !== CHARACTER_SET) {
  throw new Error('Must use CHARACTER_SET order');
}
```

**Runtime (MetricsExpander):**
```javascript
if (minified.c) {
  throw new Error('Legacy format not supported');
}
// Always use CHARACTER_SET
```

### CHARACTER_SET Definition

204 characters in sorted order:
```
 !"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_`abcdefghijklmnopqrstuvwxyz{|}~¡¢£¤¥¦§¨©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ—'•…‰‹›€™œšŸŽž█
```

**Components:**
- ASCII printable (32-126): 95 chars
- CP-1252 printable: 14 chars
- Latin-1 Supplement (161-255, excluding 173): 94 chars
- Full Block (█): 1 char
- **Total: 204 characters**

---

## Testing

### Test 1: New Font Files

**Expected:** No 'c' field, smaller files
```bash
node "metrics compression/test-roundtrip-verification.js"
# Should pass with new format
```

### Test 2: Old Font Files

**Expected:** Error with clear message
```javascript
// Loading old file will throw:
Error: Legacy minified format detected - 'c' field present.
```

### Test 3: Build Process

**Expected:** Automatic sorting and validation
```bash
# Open font-assets-builder.html
# Build font → should create files without 'c' field
# Verify in generated .js files
```

---

## File Size Impact

### Per Font File

| Component | Before | After | Saved |
|-----------|--------|-------|-------|
| 'c' field | 208 bytes | 0 bytes | **208 bytes** |
| Kerning (with 2D compression) | 3,244 bytes | 1,005 bytes | **2,239 bytes** |
| **Total savings** | - | - | **2,447 bytes** |

### Typical Project (3 font sizes)

- Old total: ~30 KB
- New total: ~22.7 KB
- **Saved: ~7.3 KB (24.3%)**

---

## Rollback

If you need to rollback:

```bash
git revert <commit-hash>
```

You'll lose:
- 208 bytes per file ('c' field removal)
- Two-dimensional compression benefits
- Cleaner codebase

**Not recommended** - better to regenerate fonts.

---

## Summary

**Breaking Change:** Removed backwards compatibility for legacy character orders

**Impact:**
- ❌ All existing font files will fail to load
- ✅ Must regenerate all font files
- ✅ 208 bytes saved per file
- ✅ Simpler, cleaner codebase
- ✅ Better error messages

**Migration:** Regenerate all fonts using current font-assets-builder

**Timeline:** Breaking change effective immediately

---

## Related Documents

- `TWO-DIMENSIONAL-COMPRESSION-COMPLETE.md` - Compression implementation
- `FIX-CHARACTER-ORDER-BUG.md` - Original character order fix (now obsolete)
- `CHARACTER_SET.js` - Character set definition
