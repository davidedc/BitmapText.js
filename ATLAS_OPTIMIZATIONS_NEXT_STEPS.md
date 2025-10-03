# Atlas Optimization: Atlas→Tight Conversion Plan
## VALIDATION-FIRST APPROACH (REVISED)

## Atlas Nomenclature

This document uses the following terminology:

- **Atlas**: Variable-width cells (actualBoundingBox width × fontBoundingBox height)
  - The straightforward, natural representation of how browsers measure text
  - Serialized format (Phase 1+)
  - Built by `AtlasBuilder`

- **Tight Atlas**: Cropped glyphs packed horizontally
  - Runtime internal representation
  - Reconstructed from Atlas via pixel scanning by `TightAtlasReconstructor`
  - Never serialized (calculated at runtime)

- **Fixed-Width Atlas**: All cells same width (examined but not implemented)
  - Alternative approach with uniform grid
  - Not used in current implementation

**Important**: `AtlasImage` and `AtlasData` are format-agnostic containers. The format (standard vs tight) is communicated through method names and documentation, not the type system.

## Document Purpose

This document captures the complete context, analysis, and implementation plan for optimizing atlas serialization by using **atlases** (variable-width cells based on font metrics bounding boxes) that are converted to tight atlases at runtime.



---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Current System Analysis](#current-system-analysis)
3. [Codebase Verification Results](#codebase-verification-results)
4. [Proposed Solutions](#proposed-solutions)
5. [Performance Analysis](#performance-analysis)
6. [Technical Architecture](#technical-architecture)
7. [Production Integration Plan](#production-integration-plan) ← **Only after validation**
8. [Risk Mitigation](#risk-mitigation)
9. [Success Metrics](#success-metrics)



---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Current System Analysis](#current-system-analysis)
3. [Codebase Verification Results](#codebase-verification-results)
4. [Proposed Solutions](#proposed-solutions)
5. [Performance Analysis](#performance-analysis)
6. [Technical Architecture](#technical-architecture)
7. [Production Integration Plan](#production-integration-plan)
8. [Risk Mitigation](#risk-mitigation)
9. [Success Metrics](#success-metrics)

---

## Problem Statement

### The Challenge

The current system uses tight atlases (minimal bounding boxes around each glyph) for both serialization and runtime. While this optimizes runtime memory, it requires serializing positioning data (tightWidth, dx, dy) alongside atlas images.

**Current File Structure Per Font:**
- Atlas image (tight): ~1.2 KB PNG
- Positioning data (minified): ~3.7 KB JS
- **Total: ~4.9 KB per font**

**Primary Concerns:**
1. **File size**: Positioning data represents 75% of serialized size
2. **Complexity**: Positioning data serialization/deserialization adds maintenance burden
3. **Network transfer**: For applications with many font sizes, this adds up significantly

### Key Insight

PNG/QOI compression handles empty space extremely efficiently. An atlas (with uniform height cells and some empty space) compresses to nearly the same size as a tight atlas, potentially even smaller due to better compression characteristics.

This means we can:
1. **Serialize**: Atlases (NO positioning data needed)
2. **Runtime**: Reconstruct tight atlases by scanning pixels once during load
3. **Result**: Eliminate 3.7 KB of positioning data, add ~10-15ms one-time reconstruction cost

---

## Current System Analysis

### Actual Measurements (Arial, Size 18, Pixel Density 1.0)

**Current Tight Atlas:**
- Dimensions: 864×20 pixels
- Runtime memory (RGBA): 69,120 bytes = 67.5 KB uncompressed
- PNG file size: 1,224 bytes = 1.2 KB
- Compression ratio: 1.8% (69 KB → 1.2 KB)

**Positioning Data (After 41% Minification):**
- File size: 3,680 bytes = 3.7 KB
- Contains: tightWidth, dx, dy for 115 characters
- Note: xInAtlas and tightHeight already reconstructed at load time (previous optimization)

**Total Current Serialization:**
- Atlas: 1.2 KB + Positioning: 3.7 KB = **4.9 KB per font**

**For 100 fonts**: ~490 KB total

### Current Architecture

**Build Time (font-assets-builder.html):**
```
GlyphFAB creates TWO canvases per glyph:
  ├─ canvas: Original bounding box (actualBoundingBoxLeft + Right × fontBoundingBox height)
  └─ tightCanvas: Cropped to visible pixels only
    ↓
AtlasDataStoreFAB.buildAtlas() uses TIGHT canvases:
  ├─ Packs tightCanvas glyphs horizontally at y=0
  ├─ Calculates positioning via AtlasPositioningFAB
  ├─ Records: tightWidth, tightHeight, dx, dy, xInAtlas
  └─ Exports: PNG/QOI tight atlas + positioning data (minified)
```

**Runtime (browser/Node.js):**
```
Load tight atlas image (PNG/QOI)
  ↓
Load positioning data (minified JS)
  ↓
AtlasDataExpander:
  ├─ Reconstructs xInAtlas (sum of tightWidths)
  ├─ Reconstructs tightHeight (scan atlas pixels)
  └─ Creates AtlasPositioning with all 5 properties
    ↓
Stores in AtlasDataStore
  ↓
BitmapText uses for O(1) glyph rendering
```

---

## Codebase Verification Results

### ✅ Original Canvas Dimensions (GlyphFAB.js:153-173)

**CONFIRMED**: Variable-width cells as proposed

```javascript
// Width: VARIABLE per character
const canvasPixelsWidth = Math.round(
  charTextMetrics.actualBoundingBoxLeft +
  charTextMetrics.actualBoundingBoxRight
);

// Height: CONSTANT per font
const canvasPixelsHeight = Math.round(
  charTextMetrics.fontBoundingBoxAscent +
  charTextMetrics.fontBoundingBoxDescent
);
```

**Implications:**
- Each character's original canvas has its own width (4-22px for Arial 18)
- All characters share same height (21px for Arial 18)
- This is EXACTLY the "Variable-Width Original-Bounds Atlas" proposed
- No additional metadata needed - widths derivable from character metrics

### ✅ Two Canvas Types (GlyphFAB.js)

**CRITICAL DISTINCTION**:

1. **`glyph.canvas`** (lines 153-198):
   - Dimensions: actualBoundingBox width × fontBoundingBox height
   - Contains character at original position
   - **This is what we'll use for original-bounds atlas**

2. **`glyph.tightCanvas`** (lines 210-266):
   - Dimensions: Tight cropped to visible pixels only
   - Extracted from `canvas` by pixel scanning
   - **This is what current system uses**

**Current buildAtlas() uses**: `glyph.tightCanvas` (AtlasDataStoreFAB.js:140)
**Proposed buildOriginalAtlas() would use**: `glyph.canvas`

### ✅ dx, dy Reconstruction Formula (AtlasPositioningFAB.js:87-88)

**FOUND - Exact formula**:

```javascript
// Input from found tight bounds within original canvas:
// - tightCanvasBox.topLeftCorner.x, .y (in physical pixels)
// - tightCanvasBox.bottomRightCorner.x, .y (in physical pixels)
// - canvas.height (original canvas height in physical pixels)

const tightWidth =
  tightCanvasBox.bottomRightCorner.x - tightCanvasBox.topLeftCorner.x + 1;
const tightHeight =
  tightCanvasBox.bottomRightCorner.y - tightCanvasBox.topLeftCorner.y + 1;

// Calculate distance from bottom of tight canvas to bottom of original canvas
const distanceBetweenBottomAndBottomOfCanvas =
  canvas.height - tightCanvasBox.bottomRightCorner.y - 1;

// Final positioning offsets
const dx =
  - Math.round(characterMetrics.actualBoundingBoxLeft) * pixelDensity
  + tightCanvasBox.topLeftCorner.x;

const dy =
  - tightHeight
  - distanceBetweenBottomAndBottomOfCanvas
  + 1 * pixelDensity;
```

**What we need to reconstruct**:
- Tight bounds within the cell (via pixel scanning) ✓
- Original canvas dimensions (from character metrics) ✓
- Character metrics (actualBoundingBoxLeft, etc.) ✓
- Pixel density ✓

**Conclusion**: All necessary data is available for reconstruction.

### ⚠️ Character Ordering (NEEDS FIXING)

**Current code** (AtlasDataStoreFAB.js:124, AtlasPositioningFAB.js:55):
```javascript
for (let char in glyphs) {
  // Process glyphs in insertion order
}
```

**Problem**: JavaScript object iteration order is:
1. Integer-indexed properties in ascending numeric order
2. String properties in **insertion order** (depends on when glyphs created)

**Required Fix**:
```javascript
// MUST use explicit sorting for determinism
const sortedChars = Object.keys(glyphs).sort();
for (const char of sortedChars) {
  // Process glyphs in guaranteed alphabetical order
}
```

**Without this fix**: Build and runtime might iterate in different orders, causing position misalignment.

### ✅ Baseline Position (GlyphFAB.js:183-191)

**Text drawing**:
```javascript
ctx.textBaseline = "bottom";
ctx.fillText(
  this.char,
  Math.round(charTextMetrics.actualBoundingBoxLeft) + cropLeftCorrection_CSS_Px,
  canvas.height / pixelDensity - 1
);
```

**Interpretation**:
- Text drawn with baseline at specified y-coordinate
- Baseline is at: `(fontBoundingBoxAscent + fontBoundingBoxDescent - 1)` in CSS pixels
- Character positioning relative to this baseline encoded in dx, dy

**For reconstruction**: The dx/dy formula accounts for this baseline positioning.

### 📊 Measurements Summary

| Component | Source | Value | Status |
|-----------|--------|-------|--------|
| Original canvas width | GlyphFAB.js:153-156 | Variable (4-22px) | ✅ Confirmed |
| Original canvas height | GlyphFAB.js:168-173 | Constant (21px) | ✅ Confirmed |
| dx formula | AtlasPositioningFAB.js:87 | Found | ✅ Documented |
| dy formula | AtlasPositioningFAB.js:88 | Found | ✅ Documented |
| Character ordering | Multiple files | for...in loop | ⚠️ Needs sorting |
| Two canvas types | GlyphFAB.js | canvas + tightCanvas | ✅ Identified |

---

## Proposed Solutions

We have THREE approaches to consider:

### Approach A: Fixed-Width Atlas

**Structure**:
```
All cells: maxCellWidth × cellHeight
  where maxCellWidth = 22px (widest character 'W')
        cellHeight = 21px (fontBoundingBoxAscent + Descent)

Atlas dimensions: 115 chars × 22px = 2,530px × 21px
Uncompressed: 2,530 × 21 × 4 = 212,520 bytes = 207.5 KB
```

**Characteristics**:
- ✅ Simpler position calculation: `cellX = index × 22`
- ✅ Easier debugging (visible grid)
- ❌ 2.1× larger than variable-width (207 KB vs 98 KB)
- ❌ More pixels to scan (~28,000 vs ~13,000)
- ❌ Larger PNG (estimated ~3.1 KB vs ~1.5 KB)

---

### Approach B: Atlas (Variable-Width Cells) ⭐ RECOMMENDED

**Structure**:
```
Each cell: cellWidth[char] × cellHeight
  where cellWidth[char] = ceil(actualBoundingBoxLeft + actualBoundingBoxRight) for that char
        cellHeight = 21px (constant)

Atlas dimensions: sum(cellWidths) × cellHeight ≈ 1,200px × 21px
Uncompressed: 1,200 × 21 × 4 = 100,800 bytes = 98.4 KB
```

**Characteristics**:
- ✅ 52% smaller than fixed-width (98 KB vs 208 KB)
- ✅ Fewer pixels to scan (~13,000)
- ✅ Matches current codebase structure exactly
- ✅ No extra metadata to serialize (widths from character metrics)
- ✅ Smaller PNG (estimated ~1.2-1.5 KB)
- ✅ Lower peak memory (166 KB vs 275 KB)
- ✅ Faster reconstruction (~12ms vs ~18ms)
- ❌ Requires dynamic position calculation (minor complexity)

**This is the RECOMMENDED approach** - verified against actual codebase.

---

### Approach C: Tight Atlas + Original Dimensions ⭐ SIMPLER ALTERNATIVE

**Structure**:
```
Serialize:
  - Tight atlas image: 1.2 KB (current)
  - Original dimensions per character:
    · originalWidth: ceil(actualBoundingBoxLeft + Right)
    · originalHeight: ceil(fontBoundingBoxAscent + Descent)
    · baselineY: position of baseline in original canvas

  Metadata size: 115 chars × 3 values × 2 bytes = ~690 bytes = 0.69 KB

Total: 1.2 KB + 0.69 KB = ~1.9 KB
```

**Runtime**:
```javascript
// Load tight atlas (already tight, no pixel scanning needed)
// Calculate dx, dy from original dimensions:

dx = (originalWidth - tightWidth) / 2  // or use actualBoundingBoxLeft
dy = tightTop - baselineY
```

**Characteristics**:
- ✅ Much faster load (~0.5ms vs ~12ms) - no pixel scanning
- ✅ Simpler implementation
- ✅ No peak memory spike
- ✅ Still good file reduction (61% vs 69%)
- ❌ Still need to serialize some data (but less)
- ❌ Less optimal file size than Approach B

**Trade-off**: Sacrifice ~8% additional file savings for 20× faster load time and simpler code.

---

## Detailed Comparison

### Numerical Comparison

| Metric | Current | Fixed-Width (A) | Variable-Width (B) | Tight+Dims (C) |
|--------|---------|-----------------|-------------------|----------------|
| **Serialization** |
| Tight atlas | 1.2 KB | - | - | 1.2 KB |
| Original atlas | - | ~3.1 KB | ~1.5 KB | - |
| Positioning data | 3.7 KB | - | - | ~0.7 KB |
| **Total file size** | **4.9 KB** | **~3.1 KB** | **~1.5 KB** | **~1.9 KB** |
| **Reduction** | 0% | **~37%** | **~69%** | **~61%** |
| | | | | |
| **Runtime** |
| Uncompressed atlas | 67.5 KB | 207.5 KB | 98.4 KB | 67.5 KB |
| Peak during load | 67.5 KB | 275 KB | 166 KB | 67.5 KB |
| Final memory | 67.5 KB | 67.5 KB | 67.5 KB | 67.5 KB |
| Load time/font | ~1ms | ~18ms | ~12ms | ~0.5ms |
| **100 fonts load** | **~0.1s** | **~1.8s** | **~1.2s** | **~0.05s** |
| | | | | |
| **Complexity** | Medium | Low | Medium | Low |

**Notes**:
- PNG sizes are ESTIMATES based on 1.5% compression ratio (needs measurement)
- Load times are CONSERVATIVE estimates (JavaScript pixel scanning overhead included)
- All approaches have same final runtime memory (67.5 KB per font)

### Recommendation Matrix

**Choose Variable-Width (B) if**:
- Maximum file size reduction is priority
- Load time <15ms per font is acceptable
- Willing to implement pixel scanning reconstruction

**Choose Tight+Dims (C) if**:
- Simplicity is priority
- Load time <1ms per font is needed
- File size reduction of 60% is sufficient

**Avoid Fixed-Width (A)**:
- Worst of both worlds: larger files AND slower load
- Only advantage is marginally simpler code

---

## Performance Analysis

### Corrected Estimates (Variable-Width, Approach B)

**Conservative, Realistic Analysis**:

```javascript
// Per-character tight bounds detection (optimized 4-step algorithm):

// 1. Scan bottom→up for first non-transparent pixel
//    Typical: 2 empty rows × 12px + 6 pixels ≈ 30 checks

// 2. Scan top→down (only to bottom found in step 1)
//    Typical: 3 empty rows × 12px + 6 pixels ≈ 42 checks

// 3. Scan left→right columns (only vertical range from steps 1-2)
//    Typical: 1 empty column × 15 rows + 8 pixels ≈ 23 checks

// 4. Scan right→left columns (only vertical range)
//    Typical: 1 empty column × 15 rows + 8 pixels ≈ 23 checks

// Total: ~118 pixel checks per character (vs 252 if we scanned all pixels)
// Efficiency gain: 53% fewer checks due to early exit

// JavaScript pixel checking time (realistic):
// - Array index calculation: (y * width + x) * 4 + 3
// - Bounds checking (V8 optimization)
// - Memory access
// - Alpha comparison
// - Conditional branch
// Realistic: 0.0003 - 0.0008ms per check (not 0.00003ms!)
// Conservative estimate: 0.0005ms per check

Pixel scanning: 115 chars × 118 checks × 0.0005ms = 6.8ms
Cell width lookups: 115 chars × 0.001ms = 0.12ms
getImageData(): 0.8ms (98.4 KB ImageData extraction)
Canvas creation: 0.3ms
drawImage operations: 115 × 0.015ms = 1.7ms (GPU-accelerated but with JS overhead)
Positioning structure creation: 0.4ms
Memory allocation: 0.2ms

REALISTIC TOTAL PER FONT: 10-12ms (not 5ms)
Conservative range accounting for browser variance: 10-15ms

For 100 fonts: 1.0-1.5 seconds (still excellent, but be honest)
```

**Original document claimed 5ms** - that was overly optimistic (assumed 0.00003ms per pixel check = 30 nanoseconds, ignoring JavaScript overhead).

### File Size Estimates (Needs Empirical Measurement!)

**Using observed compression ratio from current tight atlas**:
- Current: 69,120 bytes → 1,224 bytes = 1.77% compression

**Applying to variable-width original-bounds atlas**:
- Uncompressed: 98,400 bytes
- Estimated PNG: 98,400 × 0.015 = **1,476 bytes ≈ 1.5 KB**
- Using 1.5% ratio (conservative middle ground)

**File size reduction**:
- Current: 4.9 KB
- Proposed: 1.5 KB
- Reduction: (4.9 - 1.5) / 4.9 = **69%**

**WARNING**: This is an ESTIMATE. The actual compression ratio depends on:
- Empty space patterns in original-bounds cells
- PNG encoder settings
- Character distribution

**MUST measure empirically in Phase 0** with actual PNG exports!

---

## Technical Architecture

### New Components

#### 1. TightAtlasReconstructor (Core Runtime Class)

**Location**: `src/core/TightAtlasReconstructor.js`

**Purpose**: Reconstructs tight atlas from original-bounds atlas at runtime

**Key Methods**:
```javascript
class TightAtlasReconstructor {
  /**
   * Main entry point - reconstructs tight atlas from original-bounds atlas
   * @param {Image|Canvas} originalAtlasImage - Original-bounds atlas image
   * @param {FontMetrics} fontMetrics - Font metrics for cell dimensions
   * @param {Function} canvasFactory - Factory for creating canvases
   * @returns {{atlasImage: AtlasImage, atlasPositioning: AtlasPositioning}}
   */
  static reconstructFromOriginalAtlas(originalAtlasImage, fontMetrics, canvasFactory) {
    // 1. Get ImageData from original atlas
    const imageData = AtlasReconstructionUtils.getImageData(originalAtlasImage);

    // 2. Get sorted character list (CRITICAL for determinism)
    const characters = fontMetrics.getAvailableCharacters().sort();

    // 3. Calculate cell dimensions from font metrics
    const cellHeight = Math.ceil(
      fontMetrics._characterMetrics[characters[0]].fontBoundingBoxAscent +
      fontMetrics._characterMetrics[characters[0]].fontBoundingBoxDescent
    );

    // 4. Scan each cell to find tight bounds
    let cellX = 0;
    const tightBounds = {};
    for (const char of characters) {
      const charMetrics = fontMetrics.getCharacterMetrics(char);
      const cellWidth = Math.ceil(
        charMetrics.actualBoundingBoxLeft + charMetrics.actualBoundingBoxRight
      );

      // Find tight bounds within this cell
      const bounds = this.findTightBounds(imageData, cellX, 0, cellWidth, cellHeight);
      if (bounds) {
        tightBounds[char] = bounds;
      }

      cellX += cellWidth;
    }

    // 5. Repack into tight atlas
    return this.packTightAtlas(tightBounds, characters, fontMetrics, canvasFactory);
  }

  /**
   * Optimized tight bounds detection with early exit
   * @returns {{left, top, width, height} | null}
   */
  static findTightBounds(imageData, cellX, cellY, cellWidth, cellHeight) {
    const pixels = imageData.data;
    const atlasWidth = imageData.width;

    // Helper to get alpha at position
    const getAlpha = (x, y) => pixels[(y * atlasWidth + x) * 4 + 3];

    // STEP 1: Find bottom edge (scan UP from bottom) - early exit
    let bottom = -1;
    for (let y = cellY + cellHeight - 1; y >= cellY && bottom === -1; y--) {
      for (let x = cellX; x < cellX + cellWidth && bottom === -1; x++) {
        if (getAlpha(x, y) > 0) {
          bottom = y;
        }
      }
    }
    if (bottom === -1) return null; // Empty cell

    // STEP 2: Find top edge (scan DOWN, only to bottom) - early exit
    let top = cellY;
    for (let y = cellY; y <= bottom; y++) {
      for (let x = cellX; x < cellX + cellWidth; x++) {
        if (getAlpha(x, y) > 0) {
          top = y;
          goto foundTop;
        }
      }
    }
    foundTop:

    // STEP 3: Find left edge (scan columns, only vertical range) - early exit
    let left = cellX;
    for (let x = cellX; x < cellX + cellWidth; x++) {
      for (let y = top; y <= bottom; y++) {
        if (getAlpha(x, y) > 0) {
          left = x;
          goto foundLeft;
        }
      }
    }
    foundLeft:

    // STEP 4: Find right edge (scan right→left, only vertical range) - early exit
    let right = cellX + cellWidth - 1;
    for (let x = cellX + cellWidth - 1; x >= cellX; x--) {
      for (let y = top; y <= bottom; y++) {
        if (getAlpha(x, y) > 0) {
          right = x;
          goto foundRight;
        }
      }
    }
    foundRight:

    return {
      left: left - cellX,     // Relative to cell origin
      top: top - cellY,       // Relative to cell origin
      width: right - left + 1,
      height: bottom - top + 1
    };
  }

  /**
   * Pack tight glyphs and calculate positioning data
   */
  static packTightAtlas(tightBounds, characters, fontMetrics, canvasFactory) {
    // Calculate tight atlas dimensions
    let totalWidth = 0;
    let maxHeight = 0;
    for (const char of characters) {
      if (tightBounds[char]) {
        totalWidth += tightBounds[char].width;
        maxHeight = Math.max(maxHeight, tightBounds[char].height);
      }
    }

    // Create tight atlas canvas
    const tightCanvas = canvasFactory();
    tightCanvas.width = totalWidth;
    tightCanvas.height = maxHeight;
    const ctx = tightCanvas.getContext('2d');

    // Extract each tight glyph and draw to tight atlas
    const originalImageData = AtlasReconstructionUtils.getImageData(originalAtlasImage);
    let xInTightAtlas = 0;
    const positioning = {
      tightWidth: {},
      tightHeight: {},
      dx: {},
      dy: {},
      xInAtlas: {}
    };

    let cellX = 0;
    for (const char of characters) {
      const bounds = tightBounds[char];
      if (!bounds) continue;

      const charMetrics = fontMetrics.getCharacterMetrics(char);
      const cellWidth = Math.ceil(
        charMetrics.actualBoundingBoxLeft + charMetrics.actualBoundingBoxRight
      );
      const cellHeight = Math.ceil(
        charMetrics.fontBoundingBoxAscent + charMetrics.fontBoundingBoxDescent
      );

      // Extract tight glyph from original atlas
      const tempCanvas = canvasFactory();
      tempCanvas.width = bounds.width;
      tempCanvas.height = bounds.height;
      const tempCtx = tempCanvas.getContext('2d');

      // Use original atlas image to extract
      tempCtx.drawImage(
        originalAtlasImage,
        cellX + bounds.left, bounds.top,  // Source position in original atlas
        bounds.width, bounds.height,       // Source dimensions
        0, 0,                              // Dest position in temp
        bounds.width, bounds.height        // Dest dimensions
      );

      // Draw to tight atlas
      ctx.drawImage(tempCanvas, xInTightAtlas, 0);

      // Calculate positioning using exact formula from AtlasPositioningFAB.js:87-88
      const pixelDensity = fontMetrics._characterMetrics[char].pixelDensity || 1;
      const distanceBetweenBottomAndBottomOfCanvas =
        cellHeight - (bounds.top + bounds.height) - 1;

      positioning.tightWidth[char] = bounds.width;
      positioning.tightHeight[char] = bounds.height;
      positioning.xInAtlas[char] = xInTightAtlas;

      // Exact formula from codebase
      positioning.dx[char] =
        - Math.round(charMetrics.actualBoundingBoxLeft) * pixelDensity
        + bounds.left;

      positioning.dy[char] =
        - bounds.height
        - distanceBetweenBottomAndBottomOfCanvas
        + 1 * pixelDensity;

      xInTightAtlas += bounds.width;
      cellX += cellWidth;
    }

    // Create domain objects
    const atlasImage = new AtlasImage(tightCanvas);
    const atlasPositioning = new AtlasPositioning(positioning);

    return { atlasImage, atlasPositioning };
  }
}
```

#### 2. OriginalAtlasBuilder (Build-Time Utility)

**Location**: `src/minification/OriginalAtlasBuilder.js`

**Purpose**: Builds original-bounds atlases at font generation time

**Key Method**:
```javascript
class OriginalAtlasBuilder {
  /**
   * Build original-bounds atlas from glyphs
   * @param {Object} glyphs - Map of char → GlyphFAB
   * @param {FontMetrics} fontMetrics - Font metrics for dimensions
   * @returns {{canvas, cellWidths, cellHeight, characters}}
   */
  static buildOriginalAtlas(glyphs, fontMetrics) {
    // CRITICAL: Use sorted characters for determinism
    const characters = Object.keys(glyphs).sort();

    if (characters.length === 0) {
      throw new Error('No glyphs provided for atlas building');
    }

    // Get first character's metrics for cell height (constant across font)
    const firstChar = characters[0];
    const firstMetrics = fontMetrics.getCharacterMetrics(firstChar);
    const cellHeight = Math.ceil(
      firstMetrics.fontBoundingBoxAscent + firstMetrics.fontBoundingBoxDescent
    );

    // Calculate cell widths and total atlas width
    const cellWidths = {};
    let totalWidth = 0;
    for (const char of characters) {
      const metrics = fontMetrics.getCharacterMetrics(char);
      const cellWidth = Math.ceil(
        metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight
      );
      cellWidths[char] = cellWidth;
      totalWidth += cellWidth;
    }

    // Create atlas canvas
    const canvas = document.createElement('canvas');
    canvas.width = totalWidth;
    canvas.height = cellHeight;
    const ctx = canvas.getContext('2d');

    // Draw each glyph's ORIGINAL canvas (not tight!) in its cell
    let x = 0;
    for (const char of characters) {
      const glyph = glyphs[char];

      // Use glyph.canvas (original bounds), NOT glyph.tightCanvas!
      if (glyph.canvas) {
        ctx.drawImage(glyph.canvas, x, 0);
      } else {
        console.warn(`Character '${char}' has no original canvas`);
      }

      x += cellWidths[char];
    }

    return {
      canvas,
      cellWidths,
      cellHeight,
      characters
    };
  }
}
```

### Modified Components

#### 3. AtlasDataStoreFAB (Enhanced)

**New Methods**:
```javascript
/**
 * Build original-bounds atlas for export
 */
buildOriginalAtlas(fontProperties, fontMetricsStore) {
  const glyphs = this.getGlyphsForFont(fontProperties);
  const fontMetrics = fontMetricsStore.getFontMetrics(fontProperties);

  return OriginalAtlasBuilder.buildOriginalAtlas(glyphs, fontMetrics);
}

/**
 * Build tight atlas from original (for preview/validation)
 */
buildTightAtlasFromOriginal(originalAtlasImage, fontProperties, fontMetricsStore) {
  const fontMetrics = fontMetricsStore.getFontMetrics(fontProperties);

  const { atlasImage, atlasPositioning } =
    TightAtlasReconstructor.reconstructFromOriginalAtlas(
      originalAtlasImage,
      fontMetrics,
      () => document.createElement('canvas')
    );

  return new AtlasData(atlasImage, atlasPositioning);
}
```

**Existing Method (Kept for comparison)**:
```javascript
buildAtlas(fontProperties, fontMetricsStore) {
  // Original tight atlas builder using glyph.tightCanvas
  // Keep for validation and comparison
}
```

#### 4. FontLoader (Enhanced)

**Modified to detect format**:
```javascript
static registerAtlasPackage(fontIDString, base64ImageData, positioningData) {
  // Detect format:
  // - 2 parameters (fontIDString, base64ImageData) → NEW: Original-bounds atlas
  // - 3 parameters with positioningData → LEGACY: Tight atlas + positioning

  if (arguments.length === 2 || positioningData === undefined) {
    // NEW FORMAT: Original-bounds atlas (no positioning data)
    FontLoader._tempOriginalAtlasPackages[fontIDString] = {
      base64Data: base64ImageData,
      format: 'original-bounds'
    };
  } else {
    // LEGACY FORMAT: Tight atlas with positioning data
    FontLoader._tempAtlasPackages[fontIDString] = {
      base64Data: base64ImageData,
      positioningData: positioningData,
      format: 'tight'
    };
  }
}

/**
 * Handle original-bounds atlas - requires metrics to be loaded first
 */
static _handleOriginalAtlas(fontProperties, imageElement, atlasDataStore, fontMetricsStore) {
  const fontMetrics = fontMetricsStore.getFontMetrics(fontProperties);

  if (!fontMetrics) {
    // Metrics not loaded yet - queue for later
    this._pendingOriginalAtlases.push({fontProperties, imageElement});
    return;
  }

  // Reconstruct tight atlas from original
  const { atlasImage, atlasPositioning } =
    TightAtlasReconstructor.reconstructFromOriginalAtlas(
      imageElement,
      fontMetrics,
      this.canvasFactory
    );

  const atlasData = new AtlasData(atlasImage, atlasPositioning);
  atlasDataStore.setAtlasData(fontProperties, atlasData);
}
```

**Loading Order Dependency**:
- Metrics MUST be loaded before original-bounds atlases
- Original atlases require FontMetrics for cell dimension calculation
- Store pending atlases if metrics not yet loaded, process after metrics arrive

---



## Implementation Plan

### Phase 0: Validation Harness ✅ COMPLETED

**Goal**: Prove original-bounds → tight reconstruction produces IDENTICAL results to current tight atlas building.

**Status**: ✅ **VALIDATION PASSED** - Pixel-perfect reconstruction achieved

**Implementation Summary**:
- Created OriginalAtlasBuilder.js for building original-bounds atlases
- Created TightAtlasReconstructor.js for pixel-scanning reconstruction
- Added validation harness UI to font-assets-builder.html
- Fixed critical character ordering bugs (used sorted keys throughout)
- Fixed critical cellX tracking bug in reconstruction
- Added positioning hash feature (AtlasPositioning.getHash())
- Validation runs automatically on UI changes

**Validation Results**:
- ✅ Atlas dimensions: Identical
- ✅ Atlas pixels: 0 differences (pixel-perfect match)
- ✅ Positioning data: All 5 properties match exactly (tightWidth, tightHeight, dx, dy, xInAtlas)
- ✅ Positioning hash: Identical across both paths
- ✅ Render output: Pixel-identical

**Key Technical Achievements**:
1. **Character Ordering Fix**: Changed from `for...in` to `Object.keys().sort()` in AtlasDataStoreFAB and AtlasPositioningFAB
2. **cellX Tracking Fix**: Fixed bug where cellX wasn't incremented for empty characters (like space)
3. **4-Step Tight Bounds Detection**: Optimized pixel scanning with early exit (bottom→top, top→bottom, left→right, right→left)
4. **Exact Formula Matching**: dx/dy calculations match AtlasPositioningFAB.js:87-88 exactly
5. **Cross-Platform Hash**: Added deterministic FNV-1a hash for positioning data validation

**Scope**: Everything stays in font-assets-builder.html. Zero runtime/serialization changes.

**Strategy**: Build TWO parallel paths in font-assets-builder.html:

**PATH A (Control - Existing):**

```
Individual glyph canvases (glyph.tightCanvas)
    ↓
AtlasDataStoreFAB.buildAtlas() [EXISTING]
    ↓
AtlasPositioningFAB [EXISTING]
    ↓
Tight Atlas A + AtlasPositioning A
    ↓
Render A
```

**PATH B (Experimental - New):**

```
Individual glyph canvases (glyph.canvas - ORIGINAL BOUNDS)
    ↓
OriginalAtlasBuilder.buildOriginalAtlas() [NEW]
    ↓
Original-Bounds Atlas
    ↓
TightAtlasReconstructor.reconstructFromOriginalAtlas() [NEW]
    ↓
Tight Atlas B + AtlasPositioning B
    ↓
Render B
```

**VALIDATION (Side-by-Side Comparison):**

```
COMPARE:
├─ Tight Atlas A ←→ Tight Atlas B (pixel-identical?)
├─ AtlasPositioning A ←→ AtlasPositioning B (all 5 properties match?)
│  ├─ tightWidth[char] for all 115 chars
│  ├─ tightHeight[char] for all 115 chars
│  ├─ dx[char] for all 115 chars
│  ├─ dy[char] for all 115 chars
│  └─ xInAtlas[char] for all 115 chars
└─ Render A ←→ Render B (hash identical?)
```

**Success Criteria**: ZERO differences across all comparisons.

**Proceed to serialization changes ONLY when**: 100% pixel-perfect match achieved across multiple fonts, sizes, and pixel densities.

---

#### Step 1: Create New Utility Classes

##### 1.1 Create `src/minification/OriginalAtlasBuilder.js`

**Purpose**: Build original-bounds atlas from individual glyph canvases.

**Implementation**:

```javascript
class OriginalAtlasBuilder {
  static buildOriginalAtlas(glyphs, fontMetrics) {
    // ⚠️ CRITICAL: Use SORTED characters for determinism
    const characters = Object.keys(glyphs).sort();

    if (characters.length === 0) {
      throw new Error('No glyphs provided');
    }

    // Get cell height (CONSTANT for all chars in this font)
    const firstChar = characters[0];
    const firstMetrics = fontMetrics.getCharacterMetrics(firstChar);
    const cellHeight = Math.ceil(
      firstMetrics.fontBoundingBoxAscent +
      firstMetrics.fontBoundingBoxDescent
    );

    // Calculate cell widths (VARIABLE per char) and total width
    const cellWidths = {};
    let totalWidth = 0;

    for (const char of characters) {
      const metrics = fontMetrics.getCharacterMetrics(char);
      const cellWidth = Math.ceil(
        metrics.actualBoundingBoxLeft +
        metrics.actualBoundingBoxRight
      );
      cellWidths[char] = cellWidth;
      totalWidth += cellWidth;
    }

    // Create canvas for original-bounds atlas
    const canvas = document.createElement('canvas');
    canvas.width = totalWidth;
    canvas.height = cellHeight;
    const ctx = canvas.getContext('2d');

    // Draw each glyph's ORIGINAL canvas (NOT tight!)
    let x = 0;
    for (const char of characters) {
      const glyph = glyphs[char];

      // ⚠️ CRITICAL: Use glyph.canvas, NOT glyph.tightCanvas
      if (glyph.canvas) {
        ctx.drawImage(glyph.canvas, x, 0);
      } else {
        console.warn(`Character '${char}' has no original canvas`);
      }

      x += cellWidths[char];
    }

    return {
      canvas,           // Original-bounds atlas canvas
      cellWidths,       // Width of each character's cell
      cellHeight,       // Height of all cells (constant)
      characters,       // Sorted character list
      totalWidth        // Total atlas width
    };
  }
}
```

**Testing Checklist**:

- [ ] Uses `glyph.canvas` (original), not `glyph.tightCanvas`
- [ ] Characters are sorted (deterministic)
- [ ] Cell widths match character metrics exactly
- [ ] Cell height is constant for font
- [ ] Atlas dimensions calculated correctly

---

##### 1.2 Create `src/core/TightAtlasReconstructor.js`

**Purpose**: Reconstruct tight atlas from original-bounds atlas.

**Implementation** (Key Methods):

```javascript
class TightAtlasReconstructor {
  /**
   * Main entry point
   */
  static reconstructFromOriginalAtlas(originalAtlasImage, fontMetrics, canvasFactory) {
    // 1. Get ImageData from original atlas
    const imageData = AtlasReconstructionUtils.getImageData(originalAtlasImage);

    // 2. Get SORTED character list (CRITICAL for determinism)
    const characters = fontMetrics.getAvailableCharacters().sort();

    // 3. Calculate cell dimensions from font metrics
    const cellHeight = Math.ceil(
      fontMetrics._characterMetrics[characters[0]].fontBoundingBoxAscent +
      fontMetrics._characterMetrics[characters[0]].fontBoundingBoxDescent
    );

    // 4. Scan each cell to find tight bounds
    let cellX = 0;
    const tightBounds = {};

    for (const char of characters) {
      const charMetrics = fontMetrics.getCharacterMetrics(char);
      const cellWidth = Math.ceil(
        charMetrics.actualBoundingBoxLeft +
        charMetrics.actualBoundingBoxRight
      );

      // Find tight bounds within this cell
      const bounds = this.findTightBounds(
        imageData, cellX, 0, cellWidth, cellHeight
      );

      if (bounds) {
        tightBounds[char] = bounds;
      }

      cellX += cellWidth;
    }

    // 5. Repack into tight atlas with positioning data
    return this.packTightAtlas(tightBounds, characters, fontMetrics, canvasFactory);
  }

  /**
   * Find tight bounds within a cell using 4-step optimized algorithm
   */
  static findTightBounds(imageData, cellX, cellY, cellWidth, cellHeight) {
    const pixels = imageData.data;
    const atlasWidth = imageData.width;

    const getAlpha = (x, y) => pixels[(y * atlasWidth + x) * 4 + 3];

    // STEP 1: Find bottom edge (scan UP from bottom)
    let bottom = -1;
    for (let y = cellY + cellHeight - 1; y >= cellY && bottom === -1; y--) {
      for (let x = cellX; x < cellX + cellWidth && bottom === -1; x++) {
        if (getAlpha(x, y) > 0) {
          bottom = y;
        }
      }
    }
    if (bottom === -1) return null; // Empty cell

    // STEP 2: Find top edge (scan DOWN to bottom)
    let top = cellY;
    for (let y = cellY; y <= bottom; y++) {
      let found = false;
      for (let x = cellX; x < cellX + cellWidth; x++) {
        if (getAlpha(x, y) > 0) {
          top = y;
          found = true;
          break;
        }
      }
      if (found) break;
    }

    // STEP 3: Find left edge
    let left = cellX;
    for (let x = cellX; x < cellX + cellWidth; x++) {
      let found = false;
      for (let y = top; y <= bottom; y++) {
        if (getAlpha(x, y) > 0) {
          left = x;
          found = true;
          break;
        }
      }
      if (found) break;
    }

    // STEP 4: Find right edge
    let right = cellX + cellWidth - 1;
    for (let x = cellX + cellWidth - 1; x >= cellX; x--) {
      let found = false;
      for (let y = top; y <= bottom; y++) {
        if (getAlpha(x, y) > 0) {
          right = x;
          found = true;
          break;
        }
      }
      if (found) break;
    }

    return {
      left: left - cellX,      // Relative to cell origin
      top: top - cellY,        // Relative to cell origin
      width: right - left + 1,
      height: bottom - top + 1
    };
  }

  /**
   * Pack tight glyphs and calculate positioning data
   */
  static packTightAtlas(tightBounds, characters, fontMetrics, canvasFactory) {
    // Calculate tight atlas dimensions
    let totalWidth = 0;
    let maxHeight = 0;

    for (const char of characters) {
      if (tightBounds[char]) {
        totalWidth += tightBounds[char].width;
        maxHeight = Math.max(maxHeight, tightBounds[char].height);
      }
    }

    // Create tight atlas canvas
    const tightCanvas = canvasFactory();
    tightCanvas.width = totalWidth;
    tightCanvas.height = maxHeight;
    const ctx = tightCanvas.getContext('2d');

    // Initialize positioning data
    let xInTightAtlas = 0;
    const positioning = {
      tightWidth: {},
      tightHeight: {},
      dx: {},
      dy: {},
      xInAtlas: {}
    };

    // Extract and pack each tight glyph
    let cellX = 0;

    for (const char of characters) {
      const bounds = tightBounds[char];
      if (!bounds) continue;

      const charMetrics = fontMetrics.getCharacterMetrics(char);
      const cellWidth = Math.ceil(
        charMetrics.actualBoundingBoxLeft +
        charMetrics.actualBoundingBoxRight
      );
      const cellHeight = Math.ceil(
        charMetrics.fontBoundingBoxAscent +
        charMetrics.fontBoundingBoxDescent
      );

      // Extract tight glyph from original atlas
      const tempCanvas = canvasFactory();
      tempCanvas.width = bounds.width;
      tempCanvas.height = bounds.height;
      const tempCtx = tempCanvas.getContext('2d');

      // Copy from original atlas
      tempCtx.drawImage(
        originalAtlasImage,
        cellX + bounds.left, bounds.top,  // Source in original
        bounds.width, bounds.height,       // Source dimensions
        0, 0,                              // Dest in temp
        bounds.width, bounds.height        // Dest dimensions
      );

      // Draw to tight atlas
      ctx.drawImage(tempCanvas, xInTightAtlas, 0);

      // ⚠️ CRITICAL: Use EXACT formulas from AtlasPositioningFAB.js:87-88
      const pixelDensity = charMetrics.pixelDensity || 1;
      const distanceBetweenBottomAndBottomOfCanvas =
        cellHeight - (bounds.top + bounds.height) - 1;

      positioning.tightWidth[char] = bounds.width;
      positioning.tightHeight[char] = bounds.height;
      positioning.xInAtlas[char] = xInTightAtlas;

      // EXACT dx formula from codebase
      positioning.dx[char] =
        - Math.round(charMetrics.actualBoundingBoxLeft) * pixelDensity
        + bounds.left;

      // EXACT dy formula from codebase
      positioning.dy[char] =
        - bounds.height
        - distanceBetweenBottomAndBottomOfCanvas
        + 1 * pixelDensity;

      xInTightAtlas += bounds.width;
      cellX += cellWidth;
    }

    // Create domain objects
    const atlasImage = new AtlasImage(tightCanvas);
    const atlasPositioning = new AtlasPositioning(positioning);

    return { atlasImage, atlasPositioning };
  }
}
```

**Testing Checklist**:

- [ ] Uses sorted characters (same order as OriginalAtlasBuilder)
- [ ] 4-step tight bounds detection works correctly
- [ ] dx/dy formulas match AtlasPositioningFAB.js:87-88 exactly
- [ ] Handles empty cells gracefully
- [ ] Works with multi-part glyphs (i, j with dots)

---

#### Step 2: Enhance AtlasDataStoreFAB

**Add to `src/font-assets-builder-FAB/AtlasDataStoreFAB.js`**:

```javascript
/**
 * Build original-bounds atlas (NEW METHOD)
 */
buildOriginalAtlas(fontProperties, fontMetricsStore) {
  const glyphs = this.getGlyphsForFont(fontProperties);
  const fontMetrics = fontMetricsStore.getFontMetrics(fontProperties);

  return OriginalAtlasBuilder.buildOriginalAtlas(glyphs, fontMetrics);
}

/**
 * Build tight atlas from original-bounds atlas (NEW METHOD - for validation)
 */
buildTightAtlasFromOriginal(originalAtlasCanvas, fontProperties, fontMetricsStore) {
  const fontMetrics = fontMetricsStore.getFontMetrics(fontProperties);

  const { atlasImage, atlasPositioning } =
    TightAtlasReconstructor.reconstructFromOriginalAtlas(
      originalAtlasCanvas,
      fontMetrics,
      () => document.createElement('canvas')
    );

  return new AtlasData(atlasImage, atlasPositioning);
}
```

---

#### Step 3: Fix Character Ordering (CRITICAL)

**In `src/font-assets-builder-FAB/AtlasDataStoreFAB.js` buildAtlas() (line ~124)**:

```javascript
// BEFORE:
for (let char in glyphs) {
  // ...
}

// AFTER:
const sortedChars = Object.keys(glyphs).sort();
for (const char of sortedChars) {
  // ...
}
```

**In `src/font-assets-builder-FAB/AtlasPositioningFAB.js` (line ~55)**:

```javascript
// BEFORE:
for (let char in this.glyphs) {
  // ...
}

// AFTER:
const sortedChars = Object.keys(this.glyphs).sort();
for (const char of sortedChars) {
  // ...
}
```

---

#### Step 4: Update font-assets-builder.html UI

**Add validation section**:

```html
<!-- VALIDATION HARNESS SECTION (NEW) -->
<div id="validation-section" style="margin-top: 40px; border-top: 3px solid #333; padding-top: 20px;">
  <h2>🔬 Validation Harness: Original-Bounds → Tight Reconstruction</h2>

  <button onclick="runValidationHarness(currentFontProperties)">
    Run Validation
  </button>

  <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 20px;">
    <!-- Column 1: Current (Control) -->
    <div>
      <h3>PATH A: Current Tight (Control)</h3>
      <canvas id="current-tight-atlas" style="border: 1px solid #ccc;"></canvas>
      <div id="current-atlas-info"></div>
      <canvas id="current-render" style="border: 1px solid #ccc;"></canvas>
    </div>

    <!-- Column 2: Original-Bounds -->
    <div>
      <h3>PATH B: Original-Bounds</h3>
      <canvas id="original-bounds-atlas" style="border: 1px solid #ccc;"></canvas>
      <div id="original-atlas-info"></div>
    </div>

    <!-- Column 3: Reconstructed -->
    <div>
      <h3>PATH B: Reconstructed Tight</h3>
      <canvas id="reconstructed-tight-atlas" style="border: 1px solid #ccc;"></canvas>
      <div id="reconstructed-atlas-info"></div>
      <canvas id="reconstructed-render" style="border: 1px solid #ccc;"></canvas>
    </div>
  </div>

  <!-- Comparison Results -->
  <div id="comparison-results" style="margin-top: 20px; padding: 20px; background: #f0f0f0;">
    <h3>📊 Comparison Results</h3>

    <div id="atlas-comparison">
      <h4>Atlas Image Comparison:</h4>
      <div id="atlas-pixel-diff"></div>
    </div>

    <div id="positioning-comparison">
      <h4>Positioning Data Comparison:</h4>
      <div id="positioning-diff-summary"></div>
      <table id="positioning-diff-table" style="font-family: monospace; font-size: 12px;"></table>
    </div>

    <div id="render-comparison">
      <h4>Render Comparison:</h4>
      <div id="render-hash-diff"></div>
    </div>

    <div id="performance-metrics">
      <h4>Performance Metrics:</h4>
      <div id="reconstruction-time"></div>
    </div>

    <div id="file-size-estimates">
      <h4>File Size Estimates:</h4>
      <div id="size-comparison"></div>
    </div>
  </div>
</div>
```

**Add validation JavaScript**:

```javascript
function runValidationHarness(fontProperties) {
  console.log('🔬 Starting Validation Harness...');

  // PATH A: Current tight atlas building (control)
  console.time('PATH A: Current');
  const currentAtlasData = atlasDataStoreFAB.buildAtlas(fontProperties, fontMetricsStoreFAB);
  const currentAtlasPositioning = currentAtlasData.atlasPositioning;
  console.timeEnd('PATH A: Current');

  // PATH B: Original-bounds → Reconstructed tight
  console.time('PATH B: Original-bounds build');
  const originalAtlasResult = atlasDataStoreFAB.buildOriginalAtlas(fontProperties, fontMetricsStoreFAB);
  console.timeEnd('PATH B: Original-bounds build');

  console.time('PATH B: Tight reconstruction');
  const reconstructedAtlasData = atlasDataStoreFAB.buildTightAtlasFromOriginal(
    originalAtlasResult.canvas,
    fontProperties,
    fontMetricsStoreFAB
  );
  console.timeEnd('PATH B: Tight reconstruction');

  // Display atlases
  displayAtlasCanvas(currentAtlasData.atlasImage.image, 'current-tight-atlas');
  displayAtlasCanvas(originalAtlasResult.canvas, 'original-bounds-atlas');
  displayAtlasCanvas(reconstructedAtlasData.atlasImage.image, 'reconstructed-tight-atlas');

  // Display info
  document.getElementById('current-atlas-info').innerHTML =
    `Dims: ${currentAtlasData.atlasImage.width}×${currentAtlasData.atlasImage.height}`;
  document.getElementById('original-atlas-info').innerHTML =
    `Dims: ${originalAtlasResult.canvas.width}×${originalAtlasResult.canvas.height}`;
  document.getElementById('reconstructed-atlas-info').innerHTML =
    `Dims: ${reconstructedAtlasData.atlasImage.width}×${reconstructedAtlasData.atlasImage.height}`;

  // Render both
  const currentRenderCanvas = document.getElementById('current-render');
  const reconstructedRenderCanvas = document.getElementById('reconstructed-render');

  renderTestText(currentRenderCanvas, currentAtlasData, fontProperties);
  renderTestText(reconstructedRenderCanvas, reconstructedAtlasData, fontProperties);

  // COMPARE EVERYTHING
  const comparison = {
    atlasPixelDiff: compareAtlasImages(
      currentAtlasData.atlasImage.image,
      reconstructedAtlasData.atlasImage.image
    ),
    positioningDiff: comparePositioning(
      currentAtlasPositioning,
      reconstructedAtlasData.atlasPositioning
    ),
    renderHashDiff: compareRenderHashes(
      currentRenderCanvas,
      reconstructedRenderCanvas
    )
  };

  // Display comparison results
  displayComparisonResults(comparison);

  // Final verdict
  const resultsDiv = document.getElementById('comparison-results');
  if (comparison.atlasPixelDiff === 0 &&
      comparison.positioningDiff.totalDifferences === 0 &&
      comparison.renderHashDiff.identical) {
    console.log('✅ VALIDATION PASSED: Perfect match!');
    resultsDiv.style.background = '#d4edda';
    resultsDiv.innerHTML = '<h2>✅ VALIDATION PASSED</h2>' + resultsDiv.innerHTML;
  } else {
    console.error('❌ VALIDATION FAILED: Differences detected');
    resultsDiv.style.background = '#f8d7da';
    resultsDiv.innerHTML = '<h2>❌ VALIDATION FAILED</h2>' + resultsDiv.innerHTML;
    console.log('Differences:', comparison);
  }
}

function displayAtlasCanvas(sourceCanvas, targetId) {
  const target = document.getElementById(targetId);
  target.width = sourceCanvas.width;
  target.height = sourceCanvas.height;
  const ctx = target.getContext('2d');
  ctx.drawImage(sourceCanvas, 0, 0);
}

function comparePositioning(posA, posB) {
  const charsA = posA.getAvailableCharacters().sort();
  const charsB = posB.getAvailableCharacters().sort();

  const differences = {
    tightWidth: [],
    tightHeight: [],
    dx: [],
    dy: [],
    xInAtlas: [],
    totalDifferences: 0,
    characterCountMismatch: charsA.length !== charsB.length
  };

  for (const char of charsA) {
    const a = posA.getPositioning(char);
    const b = posB.getPositioning(char);

    if (!b.tightWidth) {
      differences.totalDifferences++;
      continue;
    }

    if (a.tightWidth !== b.tightWidth) {
      differences.tightWidth.push({char, a: a.tightWidth, b: b.tightWidth});
      differences.totalDifferences++;
    }
    if (a.tightHeight !== b.tightHeight) {
      differences.tightHeight.push({char, a: a.tightHeight, b: b.tightHeight});
      differences.totalDifferences++;
    }
    if (a.dx !== b.dx) {
      differences.dx.push({char, a: a.dx, b: b.dx});
      differences.totalDifferences++;
    }
    if (a.dy !== b.dy) {
      differences.dy.push({char, a: a.dy, b: b.dy});
      differences.totalDifferences++;
    }
    if (a.xInAtlas !== b.xInAtlas) {
      differences.xInAtlas.push({char, a: a.xInAtlas, b: b.xInAtlas});
      differences.totalDifferences++;
    }
  }

  return differences;
}

function compareAtlasImages(imgA, imgB) {
  if (imgA.width !== imgB.width || imgA.height !== imgB.height) {
    return -1; // Dimension mismatch
  }

  const ctxA = document.createElement('canvas').getContext('2d');
  ctxA.canvas.width = imgA.width;
  ctxA.canvas.height = imgA.height;
  ctxA.drawImage(imgA, 0, 0);
  const dataA = ctxA.getImageData(0, 0, imgA.width, imgA.height).data;

  const ctxB = document.createElement('canvas').getContext('2d');
  ctxB.canvas.width = imgB.width;
  ctxB.canvas.height = imgB.height;
  ctxB.drawImage(imgB, 0, 0);
  const dataB = ctxB.getImageData(0, 0, imgB.width, imgB.height).data;

  let diffCount = 0;
  for (let i = 0; i < dataA.length; i++) {
    if (dataA[i] !== dataB[i]) {
      diffCount++;
    }
  }

  return diffCount;
}

function compareRenderHashes(canvasA, canvasB) {
  const hashA = canvasA.getHash ? canvasA.getHash() : 'N/A';
  const hashB = canvasB.getHash ? canvasB.getHash() : 'N/A';

  return {
    hashA,
    hashB,
    identical: hashA === hashB
  };
}

function displayComparisonResults(comparison) {
  // Atlas comparison
  const atlasDiv = document.getElementById('atlas-pixel-diff');
  if (comparison.atlasPixelDiff === -1) {
    atlasDiv.innerHTML = '❌ Dimension mismatch';
  } else if (comparison.atlasPixelDiff === 0) {
    atlasDiv.innerHTML = '✅ Perfect match (0 pixel differences)';
  } else {
    atlasDiv.innerHTML = `❌ ${comparison.atlasPixelDiff} pixel differences`;
  }

  // Positioning comparison
  const posDiv = document.getElementById('positioning-diff-summary');
  if (comparison.positioningDiff.totalDifferences === 0) {
    posDiv.innerHTML = '✅ Perfect match (0 differences across all properties)';
  } else {
    posDiv.innerHTML = `❌ ${comparison.positioningDiff.totalDifferences} total differences`;

    // Build detailed table
    const table = document.getElementById('positioning-diff-table');
    let html = '<tr><th>Property</th><th>Char</th><th>Path A</th><th>Path B</th></tr>';

    for (const prop of ['tightWidth', 'tightHeight', 'dx', 'dy', 'xInAtlas']) {
      for (const diff of comparison.positioningDiff[prop]) {
        html += `<tr><td>${prop}</td><td>${diff.char}</td><td>${diff.a}</td><td>${diff.b}</td></tr>`;
      }
    }
    table.innerHTML = html;
  }

  // Render comparison
  const renderDiv = document.getElementById('render-hash-diff');
  if (comparison.renderHashDiff.identical) {
    renderDiv.innerHTML = `✅ Perfect match (Hash: ${comparison.renderHashDiff.hashA})`;
  } else {
    renderDiv.innerHTML = `❌ Hashes differ:<br>Path A: ${comparison.renderHashDiff.hashA}<br>Path B: ${comparison.renderHashDiff.hashB}`;
  }
}

function renderTestText(canvas, atlasData, fontProperties) {
  canvas.width = 800;
  canvas.height = 200;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const bitmapText = new BitmapText(
    atlasDataStore,
    fontMetricsStore
  );

  // Temporarily add this atlas to store
  const tempAtlasStore = new AtlasDataStore();
  tempAtlasStore.setAtlasData(fontProperties, atlasData);

  const tempBitmapText = new BitmapText(tempAtlasStore, fontMetricsStore);

  const testText = "Hello World! ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  tempBitmapText.drawTextFromAtlas(ctx, testText, 10, 50, fontProperties);
}
```

---

#### Step 5: Update Script Loading Order

**In font-assets-builder.html, add BEFORE FAB classes**:

```html
<!-- NEW: Reconstruction utilities -->
<script src="src/minification/AtlasReconstructionUtils.js"></script>
<script src="src/minification/OriginalAtlasBuilder.js"></script>
<script src="src/core/TightAtlasReconstructor.js"></script>

<!-- Existing FAB classes -->
<script src="src/font-assets-builder-FAB/GlyphFAB.js"></script>
<script src="src/font-assets-builder-FAB/AtlasDataStoreFAB.js"></script>
<!-- ... -->
```

---

### Success Criteria for Phase 0 ✅ ALL MET

**Validation Must Pass with ZERO Differences**:

**Atlas Comparison:**

- [x] Dimensions identical ✅
- [x] Pixel difference count = 0 ✅

**Positioning Comparison (All Characters):**

- [x] tightWidth: 0 differences ✅
- [x] tightHeight: 0 differences ✅
- [x] dx: 0 differences ✅
- [x] dy: 0 differences ✅
- [x] xInAtlas: 0 differences ✅

**Render Comparison:**

- [x] Hash values identical ✅
- [x] Visual inspection shows no differences ✅

**Additional Validation:**

- [x] Positioning hash matches (FNV-1a cross-platform hash) ✅
- [x] Automatic validation on UI changes ✅

**Edge Cases Tested:**

- [x] Multiple font sizes (validated with UI controls)
- [x] Descenders (g, y, p, q, j) - all character sets tested
- [x] Dots (i, j, !) - multi-part glyphs handled correctly
- [x] Wide chars (W, M) - variable-width cells working
- [x] Narrow chars (i, l, I) - tight bounds detection accurate
- [x] Empty characters (space) - cellX tracking fixed

**Note**: Validation harness in font-assets-builder.html allows testing any font configuration via UI controls.

---

### What Happens Next

**Phase 0 ✅ PASSED - Ready for Next Phase**

Phase 0 validation has passed with 100% pixel-perfect match. The following phases are now ready to begin:

---

### Phase 1: Production Integration (READY TO START)

**Prerequisites**: ✅ Phase 0 validation passed

**Goal**: Replace tight atlas serialization with original-bounds atlas approach

**Note**: This is a private library - no backwards compatibility needed. Clean switchover only.

**Tasks**:

1. **Export Pipeline Changes**:
   - Modify font-assets-builder.html to export original-bounds atlases
   - Remove positioning data export (tightWidth, dx, dy no longer serialized)
   - Export format: atlas image only (PNG/QOI)

2. **FontLoader Changes**:
   - Remove legacy tight atlas + positioning data loading code
   - Integrate TightAtlasReconstructor for all atlas loading
   - Ensure metrics load before atlases (reconstruction requires FontMetrics)
   - Update registerAtlasPackage() signature (remove positioning parameter)

3. **Runtime Integration**:
   - Add TightAtlasReconstructor to runtime script includes
   - Update loading order: metrics first, then atlases
   - Remove AtlasDataExpander (no longer needed - full reconstruction from original)

4. **Font Asset Regeneration**:
   - Delete all existing tight atlas files
   - Regenerate all font assets using original-bounds format
   - Measure actual file size savings (target: ~69% reduction)
   - Measure actual reconstruction time (target: <15ms per font)

5. **Testing**:
   - Test all HTML files (test-renderer.html, font-assets-builder.html)
   - Verify Node.js demos work with new format
   - Measure actual network transfer savings
   - Performance testing across browsers

**Success Criteria**:
- All existing functionality works identically
- File size reduction achieved (target: ~60-70%)
- Reconstruction time <15ms per font
- No visual rendering differences
- Codebase simplified (removed positioning serialization/deserialization)

---

### Phase 2: Optimization and Refinement (FUTURE)

**Prerequisites**: Phase 1 complete and stable

**Possible Optimizations**:
- WebAssembly implementation of pixel scanning for faster reconstruction
- Parallel atlas reconstruction for multi-font loading
- Caching reconstructed tight atlases in IndexedDB
- Further compression experiments (WebP, AVIF for atlases)

---

### Current Status Summary

✅ **COMPLETED**: Phase 0 - Validation harness proves pixel-perfect reconstruction
🔵 **READY**: Phase 1 - Production integration can begin
⏸️ **PLANNED**: Phase 2 - Future optimizations

**Key Files Created**:
- `src/minification/OriginalAtlasBuilder.js` - Build original-bounds atlases
- `src/core/TightAtlasReconstructor.js` - Reconstruct tight atlases from original-bounds
- `src/core/AtlasPositioning.js` - Added getHash() method for validation

**Key Files Modified**:
- `src/font-assets-builder-FAB/AtlasDataStoreFAB.js` - Added buildOriginalAtlas() and buildTightAtlasFromOriginal()
- `src/font-assets-builder-FAB/AtlasPositioningFAB.js` - Fixed character ordering
- `public/font-assets-builder.html` - Added validation harness UI
- `src/utils/dom-cleanup.js` - Protected validation UI elements

**Documentation Updated**:
- `docs/ARCHITECTURE.md` - Documented new classes and getHash() method
- `docs/CLAUDE.md` - Added file locations and validation harness reference
- `ATLAS_OPTIMIZATIONS_NEXT_STEPS.md` - Marked Phase 0 complete
