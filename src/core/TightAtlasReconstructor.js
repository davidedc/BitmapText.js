// TightAtlasReconstructor - Core Runtime Class
//
// This is a CORE RUNTIME class designed for reconstructing tight atlases from
// original-bounds atlases via pixel scanning.
//
// DISTRIBUTION ROLE:
// - Part of validation harness (Phase 0) in font-assets-builder.html
// - Will be part of runtime distribution if Phase 0 validation succeeds
// - Reconstructs tight atlas + positioning data from original-bounds atlas
//
// ARCHITECTURE:
// - Takes original-bounds atlas image and FontMetrics
// - Scans each character cell to find tight bounding box
// - Repacks into tight atlas (same as current system)
// - Calculates positioning data (dx, dy) using EXACT formulas from AtlasPositioningFAB
//
// CRITICAL REQUIREMENTS:
// - MUST use sorted character order (same as OriginalAtlasBuilder)
// - dx/dy formulas MUST match AtlasPositioningFAB.js:87-88 exactly
// - MUST handle multi-part glyphs (i, j with dots) correctly
// - MUST use 4-step optimized tight bounds detection algorithm

class TightAtlasReconstructor {
  // Private constructor - prevent instantiation following Effective Java patterns
  constructor() {
    throw new Error('TightAtlasReconstructor cannot be instantiated - use static methods');
  }

  /**
   * Main entry point - reconstructs tight atlas from original-bounds atlas
   * @param {Image|Canvas|AtlasImage} originalAtlasImage - Original-bounds atlas image
   * @param {FontMetrics} fontMetrics - Font metrics for cell dimensions and positioning
   * @param {Function} canvasFactory - Factory for creating canvases (e.g., () => document.createElement('canvas'))
   * @returns {{atlasImage: AtlasImage, atlasPositioning: AtlasPositioning}}
   */
  static reconstructFromOriginalAtlas(originalAtlasImage, fontMetrics, canvasFactory) {
    // 1. Get ImageData from original atlas for pixel scanning
    const imageData = AtlasReconstructionUtils.getImageData(originalAtlasImage);

    // 2. Get SORTED character list (CRITICAL for determinism)
    // Must match the order used in OriginalAtlasBuilder
    const characters = fontMetrics.getAvailableCharacters().sort();

    if (characters.length === 0) {
      throw new Error('TightAtlasReconstructor: No characters found in FontMetrics');
    }

    // 3. Calculate cell dimensions from font metrics
    // Cell height is constant across all characters in this font
    const firstChar = characters[0];
    const firstMetrics = fontMetrics.getCharacterMetrics(firstChar);
    const cellHeight = Math.ceil(
      firstMetrics.fontBoundingBoxAscent +
      firstMetrics.fontBoundingBoxDescent
    );

    // 4. Scan each cell to find tight bounds within the original-bounds cell
    let cellX = 0;
    const tightBounds = {};

    for (const char of characters) {
      const charMetrics = fontMetrics.getCharacterMetrics(char);

      // Cell width is variable per character
      const cellWidth = Math.ceil(
        charMetrics.actualBoundingBoxLeft +
        charMetrics.actualBoundingBoxRight
      );

      // Find tight bounds within this cell using 4-step optimized algorithm
      const bounds = this.findTightBounds(
        imageData,
        cellX,
        0,
        cellWidth,
        cellHeight
      );

      if (bounds) {
        tightBounds[char] = bounds;
      }

      cellX += cellWidth;
    }

    // 5. Repack into tight atlas with positioning data
    return this.packTightAtlas(
      tightBounds,
      characters,
      fontMetrics,
      originalAtlasImage,
      canvasFactory
    );
  }

  /**
   * Find tight bounds within a cell using 4-step optimized algorithm
   * This scans for the minimal bounding box of non-transparent pixels
   *
   * @param {ImageData} imageData - Image data from original atlas
   * @param {number} cellX - X position of cell in atlas
   * @param {number} cellY - Y position of cell in atlas (always 0)
   * @param {number} cellWidth - Width of this character's cell
   * @param {number} cellHeight - Height of cell (constant for font)
   * @returns {{left, top, width, height} | null} - Tight bounds relative to cell origin, or null if empty
   */
  static findTightBounds(imageData, cellX, cellY, cellWidth, cellHeight) {
    const pixels = imageData.data;
    const atlasWidth = imageData.width;

    // Helper to get alpha value at position
    const getAlpha = (x, y) => pixels[(y * atlasWidth + x) * 4 + 3];

    // STEP 1: Find bottom edge (scan UP from bottom) - early exit
    // This finds the bottommost row with any non-transparent pixel
    let bottom = -1;
    for (let y = cellY + cellHeight - 1; y >= cellY && bottom === -1; y--) {
      for (let x = cellX; x < cellX + cellWidth && bottom === -1; x++) {
        if (getAlpha(x, y) > 0) {
          bottom = y;
        }
      }
    }

    // Empty cell (no visible pixels)
    if (bottom === -1) return null;

    // STEP 2: Find top edge (scan DOWN, only to bottom) - early exit
    // This finds the topmost row with any non-transparent pixel
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

    // STEP 3: Find left edge (scan columns, only vertical range found above) - early exit
    // This finds the leftmost column with any non-transparent pixel
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

    // STEP 4: Find right edge (scan right→left, only vertical range) - early exit
    // This finds the rightmost column with any non-transparent pixel
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

    // Return bounds relative to cell origin (not absolute atlas coordinates)
    return {
      left: left - cellX,      // Relative to cell left edge
      top: top - cellY,        // Relative to cell top edge
      width: right - left + 1, // Inclusive width
      height: bottom - top + 1 // Inclusive height
    };
  }

  /**
   * Pack tight glyphs and calculate positioning data
   *
   * @param {Object} tightBounds - Map of char → {left, top, width, height} within cells
   * @param {Array<string>} characters - Sorted array of characters
   * @param {FontMetrics} fontMetrics - Font metrics for positioning calculations
   * @param {Image|Canvas} originalAtlasImage - Original atlas image for extraction
   * @param {Function} canvasFactory - Factory for creating canvases
   * @returns {{atlasImage: AtlasImage, atlasPositioning: AtlasPositioning}}
   */
  static packTightAtlas(tightBounds, characters, fontMetrics, originalAtlasImage, canvasFactory) {
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

    // Initialize positioning data structure
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
      const charMetrics = fontMetrics.getCharacterMetrics(char);

      // Calculate cell dimensions (same as OriginalAtlasBuilder)
      // MUST be calculated for ALL characters to track cellX correctly
      const cellWidth = Math.ceil(
        charMetrics.actualBoundingBoxLeft +
        charMetrics.actualBoundingBoxRight
      );
      const cellHeight = Math.ceil(
        charMetrics.fontBoundingBoxAscent +
        charMetrics.fontBoundingBoxDescent
      );

      const bounds = tightBounds[char];
      if (!bounds) {
        // No visible pixels, but still need to advance cellX for next character
        cellX += cellWidth;
        continue;
      }

      // Extract tight glyph from original atlas
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = bounds.width;
      tempCanvas.height = bounds.height;
      const tempCtx = tempCanvas.getContext('2d');

      // Copy tight region from original atlas to temp canvas
      const srcX = Math.floor(cellX + bounds.left);
      const srcY = Math.floor(bounds.top);
      const srcW = Math.floor(bounds.width);
      const srcH = Math.floor(bounds.height);

      tempCtx.drawImage(
        originalAtlasImage,
        srcX, srcY,  // Source position in original atlas
        srcW, srcH,  // Source dimensions
        0, 0,        // Dest position in temp canvas
        srcW, srcH   // Dest dimensions
      );

      // Draw to tight atlas at sequential position
      ctx.drawImage(tempCanvas, xInTightAtlas, 0);

      // ⚠️ CRITICAL: Calculate positioning using EXACT formulas from AtlasPositioningFAB.js:87-88
      // These formulas must match exactly for pixel-perfect rendering

      const pixelDensity = charMetrics.pixelDensity || 1;

      // Calculate distance from bottom of tight bounds to bottom of original canvas
      // This is used in the dy calculation
      // Note: bounds.top + bounds.height - 1 gives the Y coordinate of the bottom pixel (like bottomRightCorner.y)
      const distanceBetweenBottomAndBottomOfCanvas =
        cellHeight - (bounds.top + bounds.height - 1) - 1;

      // Store positioning data
      positioning.tightWidth[char] = bounds.width;
      positioning.tightHeight[char] = bounds.height;
      positioning.xInAtlas[char] = xInTightAtlas;

      // EXACT dx formula from AtlasPositioningFAB.js:87
      positioning.dx[char] =
        - Math.round(charMetrics.actualBoundingBoxLeft) * pixelDensity
        + bounds.left;

      // EXACT dy formula from AtlasPositioningFAB.js:88
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
