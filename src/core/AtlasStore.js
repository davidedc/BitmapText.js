// AtlasStore - Core Runtime Class
//
// This is a CORE RUNTIME class designed for minimal bundle size (~2-3KB).
// It provides essential atlas image storage and retrieval for text rendering.
//
// DISTRIBUTION ROLE:
// - Part of "runtime-only" distribution for production applications  
// - Extended by AtlasStoreFAB for font assets building and generation
// - Contains only atlas image data structures and accessors needed at runtime
// - No font generation, validation, or optimization code
//
// ARCHITECTURE:
// - Stores pre-rendered atlas images (Canvas/Image elements)
// - Uses Map-based storage for O(1) atlas lookups by font properties
// - Provides the minimal atlas interface needed by BitmapText for glyph rendering
// - Optimized for fast atlas access during text drawing
// - Separate from FontMetricsStore to enable independent loading strategies
//
// SEPARATION RATIONALE:
// - Atlas images are large binary data loaded from atlas-*.png files
// - Can be lazy-loaded on demand to optimize memory usage
// - Independent of font metrics which are small and loaded upfront
// - Aligns with file structure: atlas-*.png vs metrics-*.js
//
// For font assets building and generation capabilities, use AtlasStoreFAB.
class AtlasStore {
  constructor() {
    // Keys are FontProperties.key strings for O(1) lookup
    
    // Atlas images (Canvas/Image elements) needed for rendering glyphs
    this.atlases = new Map(); // fontProperties.key → atlas
  }

  getAtlas(fontProperties) {
    return this.atlases.get(fontProperties.key);
  }

  setAtlas(fontProperties, atlas) {
    this.atlases.set(fontProperties.key, atlas);
  }

  // Helper method to check if an atlas is valid for rendering
  isValidAtlas(atlas) {
    return atlas && typeof atlas === 'object' && atlas.width > 0;
  }
}
