// AtlasDataStore - Core Runtime Class
//
// This is a CORE RUNTIME class designed for minimal bundle size (~2-3KB).
// It provides essential atlas data storage and retrieval for text rendering.
//
// DISTRIBUTION ROLE:
// - Part of "runtime-only" distribution for production applications
// - Extended by AtlasDataStoreFAB for font assets building and generation
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
// For font assets building and generation capabilities, use AtlasDataStoreFAB.
class AtlasDataStore {
  constructor() {
    // Keys are FontProperties.key strings for O(1) lookup

    // Atlas data (AtlasData objects) containing images and positioning needed for rendering glyphs
    this.atlases = new Map(); // fontProperties.key → AtlasData
  }

  getAtlas(fontProperties) {
    return this.atlases.get(fontProperties.key);
  }

  setAtlas(fontProperties, atlasData) {
    // Only accept AtlasData instances
    if (!(atlasData instanceof AtlasData)) {
      throw new Error('AtlasDataStore.setAtlas requires AtlasData instance (not raw images)');
    }
    this.atlases.set(fontProperties.key, atlasData);
  }

  // Convenience method to get just the image element from AtlasData
  getAtlasImage(fontProperties) {
    const atlasData = this.atlases.get(fontProperties.key);
    if (!atlasData) return undefined;

    // AtlasData always contains AtlasImage instance
    return atlasData.atlasImage.image;
  }

  // Convenience method to get positioning from AtlasData
  getAtlasPositioning(fontProperties, letter) {
    const atlasData = this.atlases.get(fontProperties.key);
    if (!atlasData) return undefined;

    // AtlasData always contains AtlasPositioning instance
    return atlasData.getPositioning(letter);
  }

  // Check if positioning data exists for a character
  hasAtlasPositioning(fontProperties, letter) {
    const atlasData = this.atlases.get(fontProperties.key);
    if (!atlasData) return false;

    // AtlasData always contains AtlasPositioning instance
    return atlasData.hasPositioning(letter);
  }

  // Helper method to check if an atlas is valid for rendering
  isValidAtlas(atlas) {
    // Only work with AtlasData instances
    if (!(atlas instanceof AtlasData)) {
      return false;
    }
    return atlas.isValid();
  }

  // Get all available font properties keys
  getAvailableFonts() {
    return Array.from(this.atlases.keys());
  }

  // Check if atlas exists for font properties
  hasAtlas(fontProperties) {
    return this.atlases.has(fontProperties.key);
  }

  // Remove atlas for font properties
  deleteAtlas(fontProperties) {
    return this.atlases.delete(fontProperties.key);
  }

  // Clear all atlases
  clear() {
    this.atlases.clear();
  }

  // Get count of stored atlases
  size() {
    return this.atlases.size;
  }
}
