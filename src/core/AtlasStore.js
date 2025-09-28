// AtlasStore - Core Runtime Class
//
// This is a CORE RUNTIME class designed for minimal bundle size (~2-3KB).
// It provides essential atlas data storage and retrieval for text rendering.
//
// DISTRIBUTION ROLE:
// - Part of "runtime-only" distribution for production applications
// - Extended by AtlasStoreFAB for font assets building and generation
// - Contains only atlas data structures and accessors needed at runtime
// - No font generation, validation, or optimization code
//
// ARCHITECTURE:
// - Stores AtlasData objects containing both images and positioning data
// - Uses Map-based storage for O(1) atlas lookups by font properties
// - Provides the minimal atlas interface needed by BitmapText for glyph rendering
// - Optimized for fast atlas access during text drawing
// - Separate from FontMetricsStore to enable independent loading strategies
//
// SEPARATION RATIONALE:
// - Atlas data contains both large binary images and positioning data loaded from atlas-*.js files
// - Can be lazy-loaded on demand to optimize memory usage
// - Independent of font metrics which are small and loaded upfront
// - Aligns with file structure: atlas-*.js vs metrics-*.js
//
// For font assets building and generation capabilities, use AtlasStoreFAB.
class AtlasStore {
  constructor() {
    // Keys are FontProperties.key strings for O(1) lookup

    // Atlas data (AtlasData objects) containing images and positioning needed for rendering glyphs
    this.atlases = new Map(); // fontProperties.key → AtlasData
  }

  getAtlas(fontProperties) {
    return this.atlases.get(fontProperties.key);
  }

  setAtlas(fontProperties, atlasData) {
    this.atlases.set(fontProperties.key, atlasData);
  }

  // Convenience method to get just the image from AtlasData
  getAtlasImage(fontProperties) {
    const atlasData = this.atlases.get(fontProperties.key);
    if (!atlasData) return undefined;

    // Handle both AtlasData objects and raw images for compatibility
    if (atlasData.image) {
      return atlasData.image;
    }

    // Raw image/canvas - return directly
    return atlasData;
  }

  // Convenience method to get positioning from AtlasData
  getAtlasPositioning(fontProperties, letter) {
    const atlasData = this.atlases.get(fontProperties.key);
    if (!atlasData) return undefined;

    // Handle both AtlasData objects and raw images for compatibility
    if (atlasData.getPositioning) {
      return atlasData.getPositioning(letter);
    }

    // Raw image/canvas - no positioning data available
    return undefined;
  }

  // Check if positioning data exists for a character
  hasAtlasPositioning(fontProperties, letter) {
    const atlasData = this.atlases.get(fontProperties.key);
    if (!atlasData) return false;

    // Handle both AtlasData objects and raw images for compatibility
    if (atlasData.hasPositioning) {
      return atlasData.hasPositioning(letter);
    }

    // Raw image/canvas - no positioning data available
    return false;
  }

  // Helper method to check if an atlas is valid for rendering
  isValidAtlas(atlas) {
    // Handle both AtlasData objects and raw images for compatibility
    if (atlas && atlas.isValid) {
      return atlas.isValid();
    }
    // Fallback for raw images
    return atlas && typeof atlas === 'object' && atlas.width > 0;
  }
}
