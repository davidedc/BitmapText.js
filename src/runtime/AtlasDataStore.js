// AtlasDataStore - Core Runtime Static Class
//
// This is a CORE RUNTIME static class designed for minimal bundle size (~2-3KB).
// It provides essential atlas data storage and retrieval for text rendering.
//
// DISTRIBUTION ROLE:
// - Part of "runtime-only" distribution for production applications
// - Extended by AtlasDataStoreFAB for font assets building and generation
// - Contains only atlas data structures and accessors needed at runtime
// - No font generation, validation, or optimization code
//
// ARCHITECTURE:
// - Static class with private storage for AtlasData objects
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
  // Private static storage
  // Keys are FontProperties.key strings for O(1) lookup
  static #atlases = new Map(); // fontProperties.key → AtlasData

  static getAtlasData(fontProperties) {
    return AtlasDataStore.#atlases.get(fontProperties.key);
  }

  static setAtlasData(fontProperties, atlasData) {
    // Only accept AtlasData instances
    if (!(atlasData instanceof AtlasData)) {
      throw new Error('AtlasDataStore.setAtlasData requires AtlasData instance (not raw images)');
    }
    AtlasDataStore.#atlases.set(fontProperties.key, atlasData);
  }

  // Helper method to check if an atlas is valid for rendering
  static isValidAtlas(atlas) {
    // Only work with AtlasData instances
    if (!(atlas instanceof AtlasData)) {
      return false;
    }
    return atlas.isValid();
  }

  // Get all available font properties keys
  static getAvailableFonts() {
    return Array.from(AtlasDataStore.#atlases.keys());
  }

  // Check if atlas exists for font properties
  static hasAtlas(fontProperties) {
    return AtlasDataStore.#atlases.has(fontProperties.key);
  }

  // Remove atlas for font properties
  static deleteAtlas(fontProperties) {
    return AtlasDataStore.#atlases.delete(fontProperties.key);
  }

  // Clear all atlases
  static clear() {
    AtlasDataStore.#atlases.clear();
  }

  // Get count of stored atlases
  static size() {
    return AtlasDataStore.#atlases.size;
  }
}
