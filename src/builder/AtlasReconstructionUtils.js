// AtlasReconstructionUtils - Shared utility for image data extraction
// Used by TightAtlasReconstructor for atlas image processing
//
// ARCHITECTURAL DESIGN RATIONALE:
// This utility class provides cross-platform image data extraction that works
// in both browser and Node.js environments. It handles different image sources
// (HTMLImageElement, Canvas, AtlasImage wrapper) and creates temporary canvases
// as needed for pixel data access.
//
// By centralizing this logic here, we ensure:
// - Zero code duplication across different reconstruction contexts
// - Single source of truth for image data extraction
// - Consistent cross-platform behavior (browser vs Node.js)
// - Easy to unit test independently

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
    const actualImage = image?.image ? image.image : image;

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
      // Create canvas using explicit double invocation
      const canvas = BitmapText.getCanvasFactory()();
      canvas.width = actualImage.naturalWidth || actualImage.width;
      canvas.height = actualImage.naturalHeight || actualImage.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(actualImage, 0, 0);
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    throw new Error('getImageData: Image source is not a Canvas or Image element');
  }
}
