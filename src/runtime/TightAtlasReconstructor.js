// TightAtlasReconstructor - Core Runtime Class
//
// This is a CORE RUNTIME class designed for reconstructing tight atlases from
// standard atlases via pixel scanning.
//
// DISTRIBUTION ROLE:
// - Used by font-assets-builder.html and also by the runtime to reconstruct tight
//   atlases for display and storage
// - Reconstructs tight atlas + positioning data from atlas image
//
// ARCHITECTURE:
// - Takes atlas image (variable-width cells) and FontMetrics
// - Scans each character cell to find tight bounding box
// - Repacks into tight atlas
// - Calculates positioning data (dx, dy) using EXACT formulas from AtlasPositioningFAB
//
// CRITICAL REQUIREMENTS:
// - MUST use sorted character order (same as AtlasBuilder)
// - dx/dy formulas MUST match AtlasPositioningFAB.js:87-88 exactly
// - MUST handle multi-part glyphs (i, j with dots) correctly
// - MUST use 4-step optimized tight bounds detection algorithm
//
class TightAtlasReconstructor {
  // Private constructor - prevent instantiation following Effective Java patterns
  constructor() {
    throw new Error('TightAtlasReconstructor cannot be instantiated - use static methods');
  }

  /**
   * Main entry point - reconstructs tight atlas from standard atlas
   *
   * PARAMETER ORDER: Standardized to (fontMetrics, data, options) for API consistency
   *
   * @param {FontMetrics} fontMetrics - Font metrics for cell dimensions (CSS pixels) and positioning
   * @param {Image|Canvas|AtlasImage} atlasImage - Atlas image (variable-width cells, already at physical pixels)
   * @param {Function} canvasFactory - Factory for creating canvases (e.g., () => document.createElement('canvas'))
   * @returns {{atlasImage: AtlasImage, atlasPositioning: AtlasPositioning}}
   */
  static reconstructFromAtlas(fontMetrics, atlasImage, canvasFactory) {
    // 1. Get ImageData from atlas for pixel scanning
    const imageData = AtlasReconstructionUtils.getImageData(atlasImage);

    // 2. Get SORTED character list (CRITICAL for determinism)
    // Must match the order used in AtlasBuilder
    const characters = fontMetrics.getAvailableCharacters().sort();

    if (characters.length === 0) {
      throw new Error('TightAtlasReconstructor: No characters found in FontMetrics');
    }

    console.debug(`TightAtlasReconstructor: Processing ${characters.length} characters`);

    // 3. Calculate cell dimensions from font metrics
    // Cell height is constant across all characters in this font
    // Character metrics contain CSS pixel values, but we need to infer physical pixel dimensions
    // from the actual atlas image by detecting pixelDensity from the ratio
    const firstChar = characters[0];
    const firstMetrics = fontMetrics.getCharacterMetrics(firstChar);

    // Infer pixelDensity from first character's metrics vs atlas dimensions
    // This works because: physical_pixels = CSS_pixels * pixelDensity
    const height_CssPx = AtlasCellDimensions.getHeight(firstMetrics);
    const pixelDensity = firstMetrics.pixelDensity || 1; // Use pixelDensity from metrics if available
    const cellHeight_PhysPx = Math.round(height_CssPx * pixelDensity);

    console.debug(`🔍 TightAtlasReconstructor: pixelDensity=${pixelDensity}, height_CssPx=${height_CssPx}, cellHeight_PhysPx=${cellHeight_PhysPx}`);

    // 4. Scan each cell to find tight bounds within the atlas cell
    let cellX_PhysPx = 0;
    const tightBounds = {};
    const cellDebugInfo = []; // Track first 5 chars for debugging

    for (const char of characters) {
      const charMetrics = fontMetrics.getCharacterMetrics(char);

      // Cell width is variable per character (scale CSS pixels to physical pixels)
      const width_CssPx = AtlasCellDimensions.getWidth(charMetrics);
      const cellWidth_PhysPx = Math.round(width_CssPx * pixelDensity);

      // Debug first few characters
      if (cellDebugInfo.length < 5) {
        cellDebugInfo.push(`${char}:css=${width_CssPx},phys=${cellWidth_PhysPx},x=${cellX_PhysPx}`);
      }

      // Find tight bounds within this cell using 4-step optimized algorithm
      const bounds = this.findTightBounds(
        imageData,
        cellX_PhysPx,
        0,
        cellWidth_PhysPx,
        cellHeight_PhysPx
      );

      if (bounds) {
        tightBounds[char] = bounds;
      }

      cellX_PhysPx += cellWidth_PhysPx;
    }

    console.debug(`🔍 Cell dimensions (first 5): ${cellDebugInfo.join(', ')}`);

    // 5. Repack into tight atlas with positioning data
    return this.packTightAtlas(
      fontMetrics,
      tightBounds,
      characters,
      atlasImage,
      canvasFactory,
      pixelDensity,
      cellHeight_PhysPx
    );
  }

  /**
   * Find tight bounds within a cell using 4-step optimized algorithm
   * This scans for the minimal bounding box of non-transparent pixels
   *
   * @param {ImageData} imageData - Image data from original atlas
   * @param {number} cellX_PhysPx - X position of cell in atlas (physical pixels)
   * @param {number} cellY_PhysPx - Y position of cell in atlas (physical pixels, always 0)
   * @param {number} cellWidth_PhysPx - Width of this character's cell (physical pixels)
   * @param {number} cellHeight_PhysPx - Height of cell (physical pixels, constant for font)
   * @returns {{left, top, width, height} | null} - Tight bounds relative to cell origin, or null if empty
   */
  static findTightBounds(imageData, cellX_PhysPx, cellY_PhysPx, cellWidth_PhysPx, cellHeight_PhysPx) {
    const pixels = imageData.data;
    const atlasWidth_PhysPx = imageData.width;

    // Helper to get alpha value at position
    // Optimized: pre-calculate stride and use bit shift for x*4
    const stride = atlasWidth_PhysPx * 4;
    const getAlpha = (x, y) => pixels[y * stride + (x << 2) + 3];

    // STEP 1: Find bottom edge (scan UP from bottom) - early exit
    // This finds the bottommost row with any non-transparent pixel
    let bottom_PhysPx = -1;
    for (let y = cellY_PhysPx + cellHeight_PhysPx - 1; y >= cellY_PhysPx && bottom_PhysPx === -1; y--) {
      for (let x = cellX_PhysPx; x < cellX_PhysPx + cellWidth_PhysPx && bottom_PhysPx === -1; x++) {
        if (getAlpha(x, y) > 0) {
          bottom_PhysPx = y;
        }
      }
    }

    // Empty cell (no visible pixels)
    if (bottom_PhysPx === -1) return null;

    // STEP 2: Find top edge (scan DOWN, only to bottom) - early exit
    // This finds the topmost row with any non-transparent pixel
    let top_PhysPx = cellY_PhysPx;
    for (let y = cellY_PhysPx; y <= bottom_PhysPx; y++) {
      let found = false;
      for (let x = cellX_PhysPx; x < cellX_PhysPx + cellWidth_PhysPx; x++) {
        if (getAlpha(x, y) > 0) {
          top_PhysPx = y;
          found = true;
          break;
        }
      }
      if (found) break;
    }

    // STEP 3: Find left edge (scan columns, only vertical range found above) - early exit
    // This finds the leftmost column with any non-transparent pixel
    let left_PhysPx = cellX_PhysPx;
    for (let x = cellX_PhysPx; x < cellX_PhysPx + cellWidth_PhysPx; x++) {
      let found = false;
      for (let y = top_PhysPx; y <= bottom_PhysPx; y++) {
        if (getAlpha(x, y) > 0) {
          left_PhysPx = x;
          found = true;
          break;
        }
      }
      if (found) break;
    }

    // STEP 4: Find right edge (scan right→left, only vertical range) - early exit
    // This finds the rightmost column with any non-transparent pixel
    let right_PhysPx = cellX_PhysPx + cellWidth_PhysPx - 1;
    for (let x = cellX_PhysPx + cellWidth_PhysPx - 1; x >= cellX_PhysPx; x--) {
      let found = false;
      for (let y = top_PhysPx; y <= bottom_PhysPx; y++) {
        if (getAlpha(x, y) > 0) {
          right_PhysPx = x;
          found = true;
          break;
        }
      }
      if (found) break;
    }

    // Return bounds relative to cell origin (not absolute atlas coordinates)
    return {
      left: left_PhysPx - cellX_PhysPx,        // Relative to cell left edge (physical pixels)
      top: top_PhysPx - cellY_PhysPx,          // Relative to cell top edge (physical pixels)
      width: right_PhysPx - left_PhysPx + 1,   // Inclusive width (physical pixels)
      height: bottom_PhysPx - top_PhysPx + 1   // Inclusive height (physical pixels)
    };
  }

  /**
   * Pack tight glyphs and calculate positioning data
   *
   * PARAMETER ORDER: Standardized to (fontMetrics, data, options) for API consistency
   *
   * @param {FontMetrics} fontMetrics - Font metrics for positioning calculations
   * @param {Object} tightBounds - Map of char → {left, top, width, height} within cells
   * @param {Array<string>} characters - Sorted array of characters
   * @param {Image|Canvas} sourceAtlasImage - Source Atlas image for extraction
   * @param {Function} canvasFactory - Factory for creating canvases
   * @param {number} pixelDensity - Pixel density multiplier for positioning calculations
   * @param {number} cellHeight_PhysPx - Cell height in physical pixels (for distanceBetweenBottomAndBottomOfCanvas calculation)
   * @returns {{atlasImage: AtlasImage, atlasPositioning: AtlasPositioning}}
   */
  static packTightAtlas(fontMetrics, tightBounds, characters, sourceAtlasImage, canvasFactory, pixelDensity, cellHeight_PhysPx) {
    // Calculate tight atlas dimensions (all in physical pixels)
    let totalWidth_PhysPx = 0;
    let maxHeight_PhysPx = 0;

    for (const char of characters) {
      if (tightBounds[char]) {
        totalWidth_PhysPx += tightBounds[char].width;
        maxHeight_PhysPx = Math.max(maxHeight_PhysPx, tightBounds[char].height);
      }
    }

    // Create tight atlas canvas
    const tightCanvas = canvasFactory();
    tightCanvas.width = totalWidth_PhysPx;
    tightCanvas.height = maxHeight_PhysPx;
    const ctx = tightCanvas.getContext('2d');

    // Initialize positioning data structure
    let xInTightAtlas_PhysPx = 0;
    const positioning = {
      tightWidth: {},
      tightHeight: {},
      dx: {},
      dy: {},
      xInAtlas: {}
    };

    // Extract and pack each tight glyph
    let cellX_PhysPx = 0;

    for (const char of characters) {
      const charMetrics = fontMetrics.getCharacterMetrics(char);

      // Calculate cell width in physical pixels (CSS pixels * pixelDensity)
      // MUST be calculated for ALL characters to track cellX_PhysPx correctly
      const width_CssPx = AtlasCellDimensions.getWidth(charMetrics);
      const cellWidth_PhysPx = Math.round(width_CssPx * pixelDensity);
      // cellHeight_PhysPx is passed as parameter (already in physical pixels)

      const bounds = tightBounds[char];
      if (!bounds) {
        // No visible pixels, but still need to advance cellX_PhysPx for next character
        cellX_PhysPx += cellWidth_PhysPx;
        continue;
      }

      // Extract tight glyph from original atlas
      const tempCanvas = canvasFactory();
      tempCanvas.width = bounds.width;
      tempCanvas.height = bounds.height;
      const tempCtx = tempCanvas.getContext('2d');

      // Copy tight region from atlas to temp canvas
      const srcX_PhysPx = Math.floor(cellX_PhysPx + bounds.left);
      const srcY_PhysPx = Math.floor(bounds.top);
      const srcWidth_PhysPx = Math.floor(bounds.width);
      const srcHeight_PhysPx = Math.floor(bounds.height);

      tempCtx.drawImage(
        sourceAtlasImage,
        srcX_PhysPx, srcY_PhysPx,      // Source position in atlas (physical pixels)
        srcWidth_PhysPx, srcHeight_PhysPx,  // Source dimensions (physical pixels)
        0, 0,                           // Dest position in temp canvas
        srcWidth_PhysPx, srcHeight_PhysPx   // Dest dimensions (physical pixels)
      );

      // Draw to tight atlas at sequential position
      ctx.drawImage(tempCanvas, xInTightAtlas_PhysPx, 0);

      // ═══════════════════════════════════════════════════════════════════════
      // POSITIONING CALCULATION
      // ═══════════════════════════════════════════════════════════════════════
      //
      // We need to calculate dx/dy offsets for rendering the tight glyph.
      // These formulas MUST match AtlasPositioningFAB.js:91-92 exactly.
      //
      // Coordinate System Overview:
      //
      //   Atlas Cell (variable-width):        Tight Bounds:
      //   ┌──────────────────────────┐
      //   │ actualBoundingBox        │        ┌──────────┐
      //   │ ┌──────────────────┐     │        │  ████    │  ← Minimal box
      //   │ │                  │     │   →    │  ████    │     around pixels
      //   │ │    ████          │     │        └──────────┘
      //   │ │    ████          │     │
      //   │ └──────────────────┘     │        dx = horizontal offset to align
      //   │ fontBoundingBox          │        dy = vertical offset from baseline
      //   └──────────────────────────┘
      //     ↑                          ↑
      //     cellX_PhysPx             cellX_PhysPx + cellWidth_PhysPx
      //
      // dx: Horizontal offset from rendering position to tight glyph position
      //     Components:
      //     - actualBoundingBoxLeft: Distance from text baseline to left edge of actual glyph
      //     - bounds.left: Left edge of tight bounds within cell
      //     Formula: -actualBoundingBoxLeft * pixelDensity + bounds.left
      //
      // dy: Vertical offset from baseline to top of tight glyph
      //     Components:
      //     - bounds.height: Height of tight glyph
      //     - distanceBetweenBottomAndBottomOfCanvas: Gap below glyph (accounts for descenders)
      //     - pixelDensity: Scale factor for high-DPI displays
      //     Formula: -bounds.height - distanceBetweenBottomAndBottomOfCanvas + pixelDensity
      //
      //     The distanceBetweenBottomAndBottomOfCanvas accounts for descenders (like 'g', 'y')
      //     and ensures proper vertical alignment relative to the text baseline.
      //
      // Note: pixelDensity is passed as a parameter (charMetrics only contains CSS pixel measurements)

      // Calculate distance from bottom of tight bounds to bottom of character canvas
      // This is used in the dy calculation
      // Note: bounds.top + bounds.height - 1 gives the Y coordinate of the bottom pixel (like bottomRightCorner.y)
      const distanceBetweenBottomAndBottomOfCanvas_PhysPx =
        cellHeight_PhysPx - (bounds.top + bounds.height - 1) - 1;

      // Store positioning data (all in physical pixels)
      positioning.tightWidth[char] = bounds.width;    // Physical pixels
      positioning.tightHeight[char] = bounds.height;  // Physical pixels
      positioning.xInAtlas[char] = xInTightAtlas_PhysPx;  // Physical pixels

      // EXACT dx formula from AtlasPositioningFAB.js:91 (physical pixels)
      positioning.dx[char] =
        - Math.round(charMetrics.actualBoundingBoxLeft) * pixelDensity
        + bounds.left;

      // EXACT dy formula from AtlasPositioningFAB.js:92 (physical pixels)
      positioning.dy[char] =
        - bounds.height
        - distanceBetweenBottomAndBottomOfCanvas_PhysPx
        + 1 * pixelDensity;

      xInTightAtlas_PhysPx += bounds.width;
      cellX_PhysPx += cellWidth_PhysPx;
    }

    // Create domain objects
    const tightAtlasImage = new AtlasImage(tightCanvas);
    const atlasPositioning = new AtlasPositioning(positioning);

    console.debug(`TightAtlasReconstructor: Packed ${Object.keys(positioning.xInAtlas).length} glyphs into ${totalWidth_PhysPx}×${maxHeight_PhysPx} atlas`);

    return { atlasImage: tightAtlasImage, atlasPositioning };
  }
}
