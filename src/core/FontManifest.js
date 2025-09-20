// FontManifest - Core Runtime Class
//
// This is a CORE RUNTIME class designed for minimal bundle size (~1-2KB).
// It provides centralized font registry management for test and development environments.
//
// DISTRIBUTION ROLE:
// - Part of "runtime-only" distribution for production applications
// - Manages available font IDs without polluting global namespace
// - Provides clean API for font registry operations
// - Designed for use in test-renderer and development tools
//
// ARCHITECTURE:
// - Static-only class for singleton behavior
// - Modern private fields for encapsulation
// - Returns copies of arrays to prevent external modification
// - Simple, focused API for font ID management
//
// This class replaces the global bitmapTextManifest variable and provides
// better encapsulation and a cleaner API for managing font registrations.
class FontManifest {
  // Private static field to store font IDs
  static #fontIDs = [];

  // Add one or more font IDs to the registry
  // Accepts either a single string ID or an array of IDs
  static addFontIDs(ids) {
    // Handle both single ID and array inputs
    const idsArray = Array.isArray(ids) ? ids : [ids];

    // Add IDs, avoiding duplicates
    for (const id of idsArray) {
      if (typeof id === 'string' && !this.#fontIDs.includes(id)) {
        this.#fontIDs.push(id);
      }
    }
  }

  // Get all registered font IDs
  // Returns a shallow copy to prevent external modification
  static allFontIDs() {
    return [...this.#fontIDs];
  }

  // Check if a specific font ID is registered
  static hasFontID(id) {
    return this.#fontIDs.includes(id);
  }

  // Get the count of registered font IDs
  static count() {
    return this.#fontIDs.length;
  }

  // Clear all registered font IDs
  // Useful for testing and resetting state
  static clear() {
    this.#fontIDs.length = 0;
  }

  // Get font IDs as a sorted array
  // Useful for consistent iteration order
  static allFontIDsSorted() {
    return [...this.#fontIDs].sort();
  }

  // Add multiple font IDs from a manifest-style object
  // Supports legacy format: { IDs: [...] }
  static addFromManifest(manifest) {
    if (manifest && Array.isArray(manifest.IDs)) {
      this.addFontIDs(manifest.IDs);
    }
  }
}