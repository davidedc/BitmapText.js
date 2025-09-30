// Generalized Image to JS Converter
// Converts PNG and QOI files to JavaScript files containing base64-encoded data
//
// This script solves cross-origin issues in browsers by embedding image data in JS files.
// When loading images from filesystem, browsers consider each as a separate domain,
// making them tainted as cross-origin. Loading the same data from JS files avoids this issue.
//
// This converter handles both:
// - PNG files (for browser usage)
// - QOI files (for Node.js usage)
//
// The generated JS files call FontLoader.registerTempAtlasData() to register the base64 data.

const fs = require('fs');
const path = require('path');

// Get directory parameter or default to 'font-assets'
const targetDir = process.argv[2] || 'font-assets';

// Parse command line options
let processQOI = false;
let processPNG = false;
let keepPositioning = false; // Whether to keep positioning JSON files after processing
let qoiSuffix = '-qoi'; // Suffix to distinguish QOI JS files from PNG JS files
let pngSuffix = '-png'; // Suffix to distinguish PNG JS files from QOI JS files

// Check command line arguments
const args = process.argv.slice(3);
for (const arg of args) {
  switch (arg) {
    case '--qoi':
      processQOI = true;
      break;
    case '--png':
      processPNG = true;
      break;
    case '--all':
      processQOI = true;
      processPNG = true;
      break;
    case '--keep-positioning':
      keepPositioning = true;
      break;
    case '--help':
    case '-h':
      console.log('Usage: node image-to-js-converter.js [directory] [options]');
      console.log('');
      console.log('Options:');
      console.log('  --png              Process PNG files only');
      console.log('  --qoi              Process QOI files only');
      console.log('  --all              Process both PNG and QOI files (default)');
      console.log('  --keep-positioning Keep positioning JSON files after processing');
      console.log('  --help             Show this help message');
      console.log('');
      console.log('Examples:');
      console.log('  node image-to-js-converter.js font-assets --all');
      console.log('  node image-to-js-converter.js font-assets --qoi');
      process.exit(0);
      break;
    default:
      console.error(`Unknown option: ${arg}`);
      console.error('Use --help for usage information');
      process.exit(1);
  }
}

// Default to processing all if no specific format specified
if (!processQOI && !processPNG) {
  processQOI = true;
  processPNG = true;
}

function log(message) {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    console.log(`[${timestamp}] ${message}`);
}

log(`Starting image to JS conversion in directory: ${targetDir}`);
log(`Processing PNG: ${processPNG}, Processing QOI: ${processQOI}, Keep positioning files: ${keepPositioning}`);

// Check dependencies
try {
    require('fs');
    require('path');
} catch (error) {
    log(`ERROR: Required Node.js modules not available: ${error.message}`);
    log('Make sure Node.js is properly installed');
    process.exit(1);
}

// Check if target directory exists
if (!fs.existsSync(targetDir)) {
    log(`ERROR: Directory ${targetDir} does not exist`);
    process.exit(1);
}

// Function to convert image file to base64
function imageToBase64(filePath) {
    const imageData = fs.readFileSync(filePath);
    return Buffer.from(imageData).toString('base64');
}

// Function to generate IDString from filename (removes atlas- prefix and file extension)
function generateIDString(filename, extension) {
    return filename.replace(extension, '').replace('atlas-', '');
}

// Function to try to read positioning data from corresponding atlas-*-positioning.json file
function tryReadPositioningData(targetDir, idString) {
    try {
        const positioningJsonPath = path.join(targetDir, `atlas-${idString}-positioning.json`);
        if (fs.existsSync(positioningJsonPath)) {
            const jsonContent = fs.readFileSync(positioningJsonPath, 'utf8');
            return JSON.parse(jsonContent);
        }
    } catch (error) {
        log(`WARNING: Could not read positioning data for ${idString}: ${error.message}`);
    }
    return null;
}

// Function to remove positioning JSON file after processing
function removePositioningFile(targetDir, idString) {
    if (!keepPositioning) {
        try {
            const positioningJsonPath = path.join(targetDir, `atlas-${idString}-positioning.json`);
            if (fs.existsSync(positioningJsonPath)) {
                fs.unlinkSync(positioningJsonPath);
                log(`Removed positioning file: atlas-${idString}-positioning.json`);
            }
        } catch (error) {
            log(`WARNING: Could not remove positioning file for ${idString}: ${error.message}`);
        }
    }
}

// Function to generate JS content for image data with positioning
function generateJSContent(idString, base64Data, imageType, originalFilename, positioningData) {
    const mimeType = imageType === 'png' ? 'image/png' : 'application/qoi';

    // Positioning data should ALWAYS be present - if missing, that's a build error
    if (!positioningData) {
        throw new Error(`Missing positioning data for ${idString} - this indicates a build pipeline error`);
    }

    return `// Atlas data for ${originalFilename}
// Generated by image-to-js-converter.js
// MIME type: ${mimeType}
// Encoding: base64
// Contains positioning data from corresponding atlas file

// Register complete atlas package (base64 + positioning together)
if (typeof FontLoader !== 'undefined' && FontLoader.registerAtlasPackage) {
    FontLoader.registerAtlasPackage(
        '${idString}',
        '${base64Data}',
        ${JSON.stringify(positioningData)}
    );
} else {
    console.warn('FontLoader.registerAtlasPackage not available - atlas data for ${idString} not registered');
}
`;
}

let totalProcessed = 0;
let processedIDStrings = new Set(); // Track IDStrings that have been processed

// Process PNG files if requested
if (processPNG) {
    const pngFiles = fs.readdirSync(targetDir).filter(file =>
        path.extname(file).toLowerCase() === '.png' &&
        file.startsWith('atlas-')
    );

    log(`Found ${pngFiles.length} PNG atlas files to process`);

    pngFiles.forEach(pngFile => {
        const pngPath = path.join(targetDir, pngFile);
        const base64Data = imageToBase64(pngPath);
        const idString = generateIDString(pngFile, '.png');
        const jsFileName = pngFile.replace('.png', `${pngSuffix}.js`);
        const jsFilePath = path.join(targetDir, jsFileName);

        // Read corresponding positioning data (REQUIRED)
        const positioningData = tryReadPositioningData(targetDir, idString);
        if (!positioningData) {
            log(`ERROR: No positioning data found for ${idString} - skipping file`);
            return; // Skip this file
        }

        log(`Found positioning data for ${idString}`);

        const jsContent = generateJSContent(idString, base64Data, 'png', pngFile, positioningData);

        fs.writeFileSync(jsFilePath, jsContent);
        log(`Processed PNG: ${pngFile} -> ${jsFileName} (with positioning data)`);

        // Track that this IDString has been processed (but don't remove JSON yet)
        processedIDStrings.add(idString);

        totalProcessed++;
    });
}

// Process QOI files if requested
if (processQOI) {
    const qoiFiles = fs.readdirSync(targetDir).filter(file =>
        path.extname(file).toLowerCase() === '.qoi' &&
        file.startsWith('atlas-')
    );

    log(`Found ${qoiFiles.length} QOI atlas files to process`);

    qoiFiles.forEach(qoiFile => {
        const qoiPath = path.join(targetDir, qoiFile);
        const base64Data = imageToBase64(qoiPath);
        const idString = generateIDString(qoiFile, '.qoi');
        const jsFileName = qoiFile.replace('.qoi', `${qoiSuffix}.js`);
        const jsFilePath = path.join(targetDir, jsFileName);

        // Read corresponding positioning data (REQUIRED)
        const positioningData = tryReadPositioningData(targetDir, idString);
        if (!positioningData) {
            log(`ERROR: No positioning data found for ${idString} - skipping file`);
            return; // Skip this file
        }

        log(`Found positioning data for ${idString}`);

        const jsContent = generateJSContent(idString, base64Data, 'qoi', qoiFile, positioningData);

        fs.writeFileSync(jsFilePath, jsContent);
        log(`Processed QOI: ${qoiFile} -> ${jsFileName} (with positioning data)`);

        // Track that this IDString has been processed (but don't remove JSON yet)
        processedIDStrings.add(idString);

        totalProcessed++;
    });
}

// Clean up positioning JSON files at the end (only for processed IDStrings)
if (!keepPositioning && processedIDStrings.size > 0) {
    log(`Cleaning up positioning JSON files for ${processedIDStrings.size} processed fonts...`);
    for (const idString of processedIDStrings) {
        removePositioningFile(targetDir, idString);
    }
}

if (totalProcessed === 0) {
    log('No atlas image files found to process');
} else {
    log(`Successfully converted ${totalProcessed} image files to JS format.`);
}