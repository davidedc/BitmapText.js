// Generalized Image to JS Converter
// Converts WebP, PNG, and QOI files to JavaScript files containing base64-encoded data
//
// This script solves cross-origin issues in browsers by embedding image data in JS files.
// When loading images from filesystem, browsers consider each as a separate domain,
// making them tainted as cross-origin. Loading the same data from JS files avoids this issue.
//
// This converter handles:
// - WebP files (for browser usage - lossless, best compression)
// - PNG files (legacy browser format)
// - QOI files (for Node.js usage)
//
// The generated JS files call BitmapText.registerAtlas() to register the base64 data.
// Atlas positioning data is NOT included - it will be reconstructed at runtime by TightAtlasReconstructor.

const fs = require('fs');
const path = require('path');

// Check for help flag first (before processing directory argument)
const allArgs = process.argv.slice(2);
if (allArgs.includes('--help') || allArgs.includes('-h')) {
  console.log('Image to JS Converter');
  console.log('');
  console.log('Converts WebP, PNG, and QOI files to JavaScript files containing base64 data.');
  console.log('Solves cross-origin issues when loading images from the filesystem.');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/image-to-js-converter.js [directory] [options]');
  console.log('');
  console.log('Arguments:');
  console.log('  directory          Target directory (default: font-assets)');
  console.log('');
  console.log('Options:');
  console.log('  --webp             Process WebP files only');
  console.log('  --png              Process PNG files only');
  console.log('  --qoi              Process QOI files only');
  console.log('  --all              Process WebP and QOI files (default)');
  console.log('  --help, -h         Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  # Process all WebP and QOI files');
  console.log('  node scripts/image-to-js-converter.js font-assets --all');
  console.log('');
  console.log('  # Process only WebP files');
  console.log('  node scripts/image-to-js-converter.js font-assets --webp');
  console.log('');
  console.log('  # Process only QOI files');
  console.log('  node scripts/image-to-js-converter.js font-assets --qoi');
  console.log('');
  console.log('Notes:');
  console.log('  - Generated JS files call BitmapText.registerAtlas()');
  console.log('  - Positioning data is NOT included (reconstructed at runtime)');
  console.log('  - WebP files: Best for browsers (lossless, smaller than PNG)');
  console.log('  - QOI files: Best for Node.js usage');
  console.log('');
  process.exit(0);
}

// Get directory parameter or default to 'font-assets'
const targetDir = process.argv[2] || 'font-assets';

// Parse command line options
let processQOI = false;
let processPNG = false;
let processWebP = false;
let qoiSuffix = '-qoi'; // Suffix to distinguish QOI JS files from other formats
let pngSuffix = '-png'; // Suffix to distinguish PNG JS files from other formats
let webpSuffix = '-webp'; // Suffix to distinguish WebP JS files from other formats

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
    case '--webp':
      processWebP = true;
      break;
    case '--all':
      processQOI = true;
      processWebP = true;
      break;
    default:
      console.error(`Unknown option: ${arg}`);
      console.error('Use --help for usage information');
      process.exit(1);
  }
}

// Default to processing all if no specific format specified
if (!processQOI && !processPNG && !processWebP) {
  processQOI = true;
  processWebP = true;
}

function log(message) {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    console.log(`[${timestamp}] ${message}`);
}

log(`Starting image to JS conversion in directory: ${targetDir}`);
log(`Processing WebP: ${processWebP}, Processing PNG: ${processPNG}, Processing QOI: ${processQOI}`);

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

// Function to parse ID string into individual parameters
// Parses: density-1-0-Arial-style-normal-weight-normal-size-19-0
// Returns: { density, fontFamily, styleIdx, weightIdx, size }
function parseIDString(idString) {
    const parts = idString.split('-');

    // Helper to format numeric parts (1-0 → "1", 1-5 → "1.5")
    const formatNumericPart = (integerPart, decimalPart) => {
        if (!decimalPart || decimalPart === '0') {
            return integerPart;
        }
        return `${integerPart}.${decimalPart}`;
    };

    // Extract and format numeric values (handling decimal parts)
    const density = parseFloat(formatNumericPart(parts[1], parts[2]));
    const size = parseFloat(formatNumericPart(parts[9], parts[10]));
    const fontFamily = parts[3];
    const style = parts[5];
    const weight = parts[7];

    // Convert style to index (0=normal, 1=italic, 2=oblique)
    const styleIdx = style === 'normal' ? 0 : (style === 'italic' ? 1 : 2);

    // Convert weight to index (0=normal, 1=bold, or numeric value)
    let weightIdx;
    if (weight === 'normal') {
        weightIdx = 0;
    } else if (weight === 'bold') {
        weightIdx = 1;
    } else {
        weightIdx = parseInt(weight, 10);
    }

    return { density, fontFamily, styleIdx, weightIdx, size };
}

// Function to generate optimized JS content for atlas image data
// Uses short alias and individual parameters to minimize file size
function generateJSContent(idString, base64Data, imageType, originalFilename) {
    const { density, fontFamily, styleIdx, weightIdx, size } = parseIDString(idString);

    return `BitmapText.a(${density},"${fontFamily}",${styleIdx},${weightIdx},${size},'${base64Data}');
`;
}

let totalProcessed = 0;

// Process WebP files if requested
if (processWebP) {
    const webpFiles = fs.readdirSync(targetDir).filter(file =>
        path.extname(file).toLowerCase() === '.webp' &&
        file.startsWith('atlas-')
    );

    log(`Found ${webpFiles.length} WebP atlas files to process`);

    webpFiles.forEach(webpFile => {
        const webpPath = path.join(targetDir, webpFile);
        const base64Data = imageToBase64(webpPath);
        const idString = generateIDString(webpFile, '.webp');
        const jsFileName = webpFile.replace('.webp', `${webpSuffix}.js`);
        const jsFilePath = path.join(targetDir, jsFileName);

        const jsContent = generateJSContent(idString, base64Data, 'webp', webpFile);

        fs.writeFileSync(jsFilePath, jsContent);
        log(`Processed WebP: ${webpFile} -> ${jsFileName}`);

        totalProcessed++;
    });
}

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

        const jsContent = generateJSContent(idString, base64Data, 'png', pngFile);

        fs.writeFileSync(jsFilePath, jsContent);
        log(`Processed PNG: ${pngFile} -> ${jsFileName}`);

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

        const jsContent = generateJSContent(idString, base64Data, 'qoi', qoiFile);

        fs.writeFileSync(jsFilePath, jsContent);
        log(`Processed QOI: ${qoiFile} -> ${jsFileName}`);

        totalProcessed++;
    });
}

if (totalProcessed === 0) {
    log('No atlas image files found to process');
} else {
    log(`Successfully converted ${totalProcessed} image files to JS format.`);
}
