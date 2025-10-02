// AtlasReconstructionUtils - Shared utility for atlas positioning reconstruction
// Used by both AtlasDataMinifier (validation) and AtlasDataExpander (runtime reconstruction)
//
// ARCHITECTURAL DESIGN RATIONALE:
// This utility class contains reconstruction algorithms that are used in two contexts:
// 1. BUILD TIME: AtlasDataMinifier uses these to validate that reconstruction works correctly
// 2. RUNTIME: AtlasDataExpander uses these to reconstruct positioning data from atlas images
//
// By centralizing these algorithms here, we ensure:
// - Zero code duplication between validation and runtime reconstruction
// - Single source of truth for reconstruction logic
// - Bug fixes automatically apply to both contexts
// - Easy to unit test the algorithms independently

class AtlasReconstructionUtils {
  // Private constructor - prevent instantiation following Effective Java patterns
  constructor() {
    throw new Error('AtlasReconstructionUtils cannot be instantiated - use static methods');
  }

  /**
   * Gets ImageData from various image sources
   * Handles: HTMLImageElement (PNG), Canvas (QOI), AtlasImage wrapper
   * @param {Image|Canvas|AtlasImage} image - Image source
   * @returns {ImageData} ImageData object with pixel data
   * @throws {Error} If image is not a valid source
   */
  static getImageData(image) {
    // Unwrap AtlasImage if needed
    const actualImage = (image && image.image) ? image.image : image;

    if (!actualImage) {
      throw new Error('getImageData: Invalid image source (null or undefined)');
    }

    // If Canvas, directly get image data
    if (actualImage.getContext) {
      const ctx = actualImage.getContext('2d');
      return ctx.getImageData(0, 0, actualImage.width, actualImage.height);
    }

    // If Image element, draw to temporary canvas first
    if (actualImage.naturalWidth !== undefined || actualImage.width !== undefined) {
      // Create canvas - use Canvas class in Node.js, document.createElement in browser
      const canvas = (typeof document !== 'undefined')
        ? document.createElement('canvas')
        : new Canvas();
      canvas.width = actualImage.naturalWidth || actualImage.width;
      canvas.height = actualImage.naturalHeight || actualImage.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(actualImage, 0, 0);
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    throw new Error('getImageData: Image source is not a Canvas or Image element');
  }

  /**
   * Reconstructs xInAtlas positions from tightWidth by summation
   * Characters are positioned sequentially in the atlas in iteration order
   * @param {Object} tightWidthMap - Map of character to tightWidth
   * @returns {Object} Map of character to xInAtlas position
   */
  static reconstructXInAtlas(tightWidthMap) {
    const xInAtlas = {};
    let x = 0;

    // Iterate in the same order as atlas was built (JavaScript for...in order)
    for (let char in tightWidthMap) {
      xInAtlas[char] = x;
      x += tightWidthMap[char];
    }

    return xInAtlas;
  }

  /**
   * Reconstructs tightHeight by scanning atlas image pixels
   * Scans from bottom upward to find last non-transparent row per glyph
   *
   * ALGORITHM:
   * - All glyphs are top-aligned at y=0 in the atlas (see AtlasDataStoreFAB.buildAtlas line 140)
   * - Each glyph occupies rows 0 to (tightHeight-1) in its horizontal cell
   * - To find tightHeight, scan from bottom upward to find bottom-most non-transparent pixel
   * - Works correctly for multi-part glyphs like 'i', 'j' (dot + stem with space between)
   *
   * @param {Object} tightWidthMap - Map of character to tightWidth
   * @param {Object} xInAtlasMap - Map of character to xInAtlas position
   * @param {ImageData} imageData - Decoded atlas image data
   * @returns {Object} Map of character to reconstructed tightHeight
   */
  static reconstructTightHeight(tightWidthMap, xInAtlasMap, imageData) {
    const tightHeight = {};
    const atlasWidth = imageData.width;
    const atlasHeight = imageData.height;
    const pixels = imageData.data; // Uint8ClampedArray: [r,g,b,a, r,g,b,a, ...]

    // For each character in the atlas
    for (let char in tightWidthMap) {
      const xInAtlas = xInAtlasMap[char];
      const tightWidth = tightWidthMap[char];

      // Skip if xInAtlas is undefined (character not in atlas)
      if (xInAtlas === undefined) {
        console.warn(`AtlasReconstructionUtils: Character '${char}' has tightWidth but no xInAtlas position`);
        continue;
      }

      // Scan from BOTTOM upward to find last non-transparent row
      let found = false;
      for (let y = atlasHeight - 1; y >= 0 && !found; y--) {
        // Check all pixels in this row within glyph's horizontal cell
        for (let x = xInAtlas; x < xInAtlas + tightWidth && !found; x++) {
          // Alpha channel is every 4th byte starting at index 3
          const alphaIndex = (y * atlasWidth + x) * 4 + 3;
          if (pixels[alphaIndex] > 0) {
            // Found bottom-most non-transparent pixel
            tightHeight[char] = y + 1;  // Height is row_index + 1 (0-indexed)
            found = true;
          }
        }
      }

      if (!found) {
        // Completely transparent - shouldn't happen for valid glyphs
        console.warn(`AtlasReconstructionUtils: Character '${char}' has no visible pixels in atlas`);
        tightHeight[char] = 1; // Default to 1 to avoid division by zero
      }
    }

    return tightHeight;
  }
}
