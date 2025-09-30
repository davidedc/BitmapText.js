// FontLoader Node.js Implementation
//
// This is a minimal Node.js-compatible implementation of FontLoader
// that provides the registerAtlasPackage functionality needed for
// loading atlas data from JavaScript files in Node.js environment.
//
// This allows the Node.js demos to use the same .js atlas files
// as the browser version, maintaining consistency between platforms.
//
// USAGE:
// 1. Load this module to make FontLoader available globally
// 2. Execute atlas .js files (which call FontLoader.registerAtlasPackage)
// 3. Access package data using FontLoader._tempAtlasPackages[IDString]
// 4. Convert base64 to Buffer and decode as needed

// Node.js modules
const fs = require('fs');

// FontLoader class for Node.js environment
class FontLoader {
  // Static storage for atlas packages (base64 + positioning) from JS files
  // Each package contains both image data and positioning data as an atomic unit
  static _tempAtlasPackages = {};

  // Static method for atlas JS files to register complete packages
  // Takes BOTH base64 image data and positioning data together since they're always paired
  static registerAtlasPackage(IDString, base64Data, positioningData) {
    if (typeof IDString !== 'string' || typeof base64Data !== 'string') {
      console.warn('FontLoader.registerAtlasPackage: Invalid arguments - IDString and base64Data must be strings');
      return;
    }
    if (positioningData !== null && positioningData !== undefined && typeof positioningData !== 'object') {
      console.warn('FontLoader.registerAtlasPackage: Invalid positioningData - must be object, null, or undefined');
      return;
    }

    FontLoader._tempAtlasPackages[IDString] = {
      base64Data: base64Data,
      positioningData: positioningData
    };
  }

  // Get and remove temporary atlas package (cleanup after use)
  static getTempAtlasPackage(IDString) {
    const pkg = FontLoader._tempAtlasPackages[IDString];
    if (pkg) {
      delete FontLoader._tempAtlasPackages[IDString]; // Clean up temporary package
    }
    return pkg;
  }

  // Check if temporary atlas package exists for an IDString
  static hasTempAtlasPackage(IDString) {
    return IDString in FontLoader._tempAtlasPackages;
  }

  // Clear all temporary atlas packages (useful for cleanup)
  static clearTempAtlasPackages() {
    FontLoader._tempAtlasPackages = {};
  }

  // Load and execute an atlas JS file, returning the atlas package
  static loadAtlasJS(jsFilePath, expectedIDString = null) {
    try {
      if (!fs.existsSync(jsFilePath)) {
        throw new Error(`Atlas JS file not found: ${jsFilePath}`);
      }

      // Execute the JS file (which should call registerAtlasPackage)
      const jsCode = fs.readFileSync(jsFilePath, 'utf8');
      eval(jsCode);

      // If expectedIDString provided, return that specific package
      if (expectedIDString) {
        const pkg = FontLoader.getTempAtlasPackage(expectedIDString);
        if (!pkg) {
          throw new Error(`Expected atlas package for '${expectedIDString}' not found in ${jsFilePath}`);
        }
        return pkg;
      }

      // Otherwise return all available packages
      const allPackages = { ...FontLoader._tempAtlasPackages };
      FontLoader.clearTempAtlasPackages();
      return allPackages;

    } catch (error) {
      console.error('FontLoader.loadAtlasJS failed:', error.message);
      throw error;
    }
  }

  // Convert base64 data to Buffer (useful for QOI decoding)
  static base64ToBuffer(base64Data) {
    try {
      return Buffer.from(base64Data, 'base64');
    } catch (error) {
      throw new Error(`Failed to decode base64 data: ${error.message}`);
    }
  }
}

// Make FontLoader available globally (mimics browser environment)
if (typeof global !== 'undefined') {
  global.FontLoader = FontLoader;
}

// Export for module usage
module.exports = FontLoader;