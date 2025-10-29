# Fix: Duplicate CHARACTER_SET Constant

**Date:** 2025-10-17
**Issue:** Browser error when loading font-assets-builder.html

## Problem

```
SyntaxError: Can't create duplicate variable: 'CHARACTER_SET'
ReferenceError: Can't find variable: MetricsExpander
```

Both `MetricsMinifier.js` and `MetricsExpander.js` declared the same constant:
```javascript
const CHARACTER_SET = "...";
```

When loaded sequentially in the browser via `<script>` tags, the second file failed to load because it tried to redeclare the constant, preventing `MetricsExpander` class from being defined.

## Solution

**1. Created shared constant file:**
- `src/builder/CHARACTER_SET.js`
- Contains only the constant declaration
- Loaded before both minifier and expander

**2. Removed constant from both files:**
- Updated `src/builder/MetricsMinifier.js` - removed const declaration
- Updated `src/builder/MetricsExpander.js` - removed const declaration
- Added comment: "NOTE: Requires CHARACTER_SET.js to be loaded first"

**3. Updated HTML loading order:**
- Modified `public/font-assets-builder.html`
- Load CHARACTER_SET.js BEFORE MetricsMinifier.js and MetricsExpander.js

```html
<!-- TIER 3 OPTIMIZATION: Load shared character set constant first -->
<script src="../src/builder/CHARACTER_SET.js"></script>
<script src="../src/builder/MetricsMinifier.js"></script>
<script src="../src/builder/MetricsExpander.js"></script>
```

## Files Modified

1. ✅ `src/builder/CHARACTER_SET.js` - NEW FILE
2. ✅ `src/builder/MetricsMinifier.js` - Removed const declaration
3. ✅ `src/builder/MetricsExpander.js` - Removed const declaration
4. ✅ `public/font-assets-builder.html` - Added script tag for CHARACTER_SET.js

## Verification

All files have valid syntax:
```bash
node -c src/builder/CHARACTER_SET.js  # ✅ OK
node -c src/builder/MetricsMinifier.js        # ✅ OK
node -c src/builder/MetricsExpander.js        # ✅ OK
```

## Status

✅ **FIXED** - font-assets-builder.html should now load without errors

## Next Steps

1. Reload font-assets-builder.html in browser
2. Test font generation and download
3. Verify Tier 3 optimizations are working correctly
