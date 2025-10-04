// FontLoaderShared - Shared Logic for Browser and Node.js FontLoader
//
// This module contains the shared logic that is identical between:
// - src/core/FontLoader.js (browser implementation)
// - src/node/FontLoader-node.js (Node.js implementation)
//
// PURPOSE:
// - Eliminate code duplication by extracting common methods
// - Maintain identical behavior across both environments
// - Reduce maintenance burden when updating shared logic
//
// EXTRACTED METHODS:
// 1. registerAtlasPackage() - Validates and stores atlas package data
// 2. loadAtlasFromPackage() - Reconstructs tight atlas from Atlas image
// 3. incrementProgress() - Updates progress counter and calls callback
// 4. isComplete() - Checks if loading is complete
//
// USAGE:
// Both FontLoader implementations delegate to these static methods while
// maintaining their own _tempAtlasPackages storage and environment-specific
// loading methods.

class FontLoaderShared {
  // Static method for atlas JS files to register packages
  // Only takes base64 data (NO positioning data)
  // @param {string} IDString - Font ID string
  // @param {string} base64Data - Base64-encoded atlas data
  // @param {Object} tempPackagesMap - The packages storage map to write to
  static registerAtlasPackage(IDString, base64Data, tempPackagesMap) {
    if (typeof IDString !== 'string' || typeof base64Data !== 'string') {
      console.warn('FontLoader.registerAtlasPackage: Invalid arguments - IDString and base64Data must be strings');
      return;
    }

    tempPackagesMap[IDString] = {
      base64Data: base64Data
    };
  }

  // Loads AtlasData from Atlas image and stores in AtlasDataStore
  // Uses TightAtlasReconstructor to convert Atlas → Tight Atlas + positioning
  // @param {string} IDString - Font ID string
  // @param {Image|Canvas} atlasImage - Loaded Atlas image (variable-width cells format)
  // @param {Object} options - Configuration object with:
  //   - atlasDataStore: Store for atlas data
  //   - fontMetricsStore: Store for font metrics
  //   - canvasFactory: Factory function for creating canvas elements
  //   - tempPackagesMap: The packages storage map to read from
  // @returns {boolean} - True if successful, false if metrics not available
  static loadAtlasFromPackage(IDString, atlasImage, options) {
    const { atlasDataStore, fontMetricsStore, canvasFactory, tempPackagesMap } = options;
    const fontProperties = FontProperties.fromIDString(IDString);

    // Clean up immediately
    delete tempPackagesMap[IDString];

    // Reconstruct tight atlas from Atlas image using TightAtlasReconstructor
    // This requires FontMetrics to be loaded first (for cell dimensions)
    const fontMetrics = fontMetricsStore.getFontMetrics(fontProperties);

    if (!fontMetrics) {
      console.warn(`FontLoader: Metrics not loaded for ${IDString} - cannot reconstruct tight atlas`);
      console.warn('Make sure metrics are loaded before atlases');
      return false;
    }

    // Check if TightAtlasReconstructor is available
    if (typeof TightAtlasReconstructor === 'undefined') {
      throw new Error(`TightAtlasReconstructor required for font loading - not available for ${IDString}`);
    }

    // Reconstruct tight atlas + positioning from Atlas image
    const { atlasImage: tightAtlasImage, atlasPositioning } =
      TightAtlasReconstructor.reconstructFromAtlas(atlasImage, fontMetrics, canvasFactory);

    // Create AtlasData instance
    const atlasData = new AtlasData(tightAtlasImage, atlasPositioning);

    // Store in atlas data store
    atlasDataStore.setAtlasData(fontProperties, atlasData);

    return true;
  }

  // Increment progress counter and call callback
  // @param {Object} state - State object containing:
  //   - loadedCount: Current count (will be incremented)
  //   - totalCount: Total count
  //   - onProgress: Optional callback function
  static incrementProgress(state) {
    state.loadedCount++;
    if (state.onProgress) {
      state.onProgress(state.loadedCount, state.totalCount);
    }
  }

  // Check if loading is complete
  // @param {number} loadedCount - Number of items loaded
  // @param {number} totalCount - Total number of items
  // @returns {boolean} - True if loading is complete
  static isComplete(loadedCount, totalCount) {
    return loadedCount >= totalCount;
  }
}
