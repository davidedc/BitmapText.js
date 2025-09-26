// FontLoader Node.js Implementation
//
// This is a minimal Node.js-compatible implementation of FontLoader
// that provides the registerTempAtlasData functionality needed for
// loading atlas data from JavaScript files in Node.js environment.
//
// This allows the Node.js demos to use the same .js atlas files
// as the browser version, maintaining consistency between platforms.
//
// USAGE:
// 1. Load this module to make FontLoader available globally
// 2. Execute atlas .js files (which call FontLoader.registerTempAtlasData)
// 3. Retrieve base64 data using FontLoader.getTempAtlasData
// 4. Convert base64 to Buffer and decode as needed

// Node.js modules
const fs = require('fs');

// FontLoader class for Node.js environment
class FontLoader {
  // Static storage for temporary atlas data from JS files
  static _tempAtlasData = {};

  // Static method for atlas JS files to register their temporary base64 data
  // This method name conveys that these are temporary data strings
  // that will be deleted once processed
  static registerTempAtlasData(IDString, base64Data) {
    if (typeof IDString !== 'string' || typeof base64Data !== 'string') {
      console.warn('FontLoader.registerTempAtlasData: Invalid arguments - both IDString and base64Data must be strings');
      return;
    }
    FontLoader._tempAtlasData[IDString] = base64Data;
  }

  // Get and remove temporary atlas data (cleanup after use)
  static getTempAtlasData(IDString) {
    const data = FontLoader._tempAtlasData[IDString];
    if (data) {
      delete FontLoader._tempAtlasData[IDString]; // Clean up temporary data
    }
    return data;
  }

  // Check if temporary atlas data exists for an IDString
  static hasTempAtlasData(IDString) {
    return IDString in FontLoader._tempAtlasData;
  }

  // Clear all temporary atlas data (useful for cleanup)
  static clearTempAtlasData() {
    FontLoader._tempAtlasData = {};
  }

  // Load and execute an atlas JS file, returning the base64 data
  static loadAtlasJS(jsFilePath, expectedIDString = null) {
    try {
      if (!fs.existsSync(jsFilePath)) {
        throw new Error(`Atlas JS file not found: ${jsFilePath}`);
      }

      // Execute the JS file (which should call registerTempAtlasData)
      const jsCode = fs.readFileSync(jsFilePath, 'utf8');
      eval(jsCode);

      // If expectedIDString provided, return that specific data
      if (expectedIDString) {
        const data = FontLoader.getTempAtlasData(expectedIDString);
        if (!data) {
          throw new Error(`Expected atlas data for '${expectedIDString}' not found in ${jsFilePath}`);
        }
        return data;
      }

      // Otherwise return all available data
      const allData = { ...FontLoader._tempAtlasData };
      FontLoader.clearTempAtlasData();
      return allData;

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