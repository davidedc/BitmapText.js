// If you use the renderer from filesystem, it will load the image atlases from the filesystem
// the problem with that is that when loading images, the browser considers each of them
// as a separate domain, so they are tainted as cross-origin. You CAN still paint them on a canvas
// however you can't read the pixels from the canvas, and hence you can't check the hash of the image of
// generated text.
//
// With this script you put the image data in a JS file, and load the image from the JS file.
// When loading .js files, the browser considers all of them as the same domain (strange but true),
// so the images are not tainted as cross-origin.
// This way you can read the pixels from the canvas and check the hash of the image of generated text.

const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);

// Check for help flag
const showHelp = args.includes('--help') || args.includes('-h');

if (showHelp) {
  console.log('PNG to JS Converter');
  console.log('');
  console.log('Converts PNG atlas images to JavaScript files containing base64 data.');
  console.log('Solves CORS issues when loading images from the filesystem.');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/png-to-js-converter.js [directory] [options]');
  console.log('');
  console.log('Arguments:');
  console.log('  directory            Target directory (default: font-assets)');
  console.log('');
  console.log('Options:');
  console.log('  --help, -h           Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/png-to-js-converter.js');
  console.log('  node scripts/png-to-js-converter.js data/');
  console.log('  node scripts/png-to-js-converter.js /path/to/pngs/');
  console.log('');
  console.log('Notes:');
  console.log('  - Only processes files named "*.png"');
  console.log('  - Generates JS files that call FontLoader.registerTempAtlasData()');
  console.log('  - Output files are named {input}-png.js');
  console.log('  - Enables pixel reading from canvas for hash verification');
  console.log('');
  process.exit(0);
}

// Get directory parameter (first non-flag argument) or default
let targetDir = 'font-assets';
for (const arg of args) {
  if (!arg.startsWith('--') && !arg.startsWith('-')) {
    targetDir = arg;
    break;
  }
}

function log(message) {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    console.log(`[${timestamp}] ${message}`);
}

log(`Starting PNG to JS conversion in directory: ${targetDir}`);

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

// Function to convert PNG to base64
function pngToBase64(filePath) {
    const png = fs.readFileSync(filePath);
    return Buffer.from(png).toString('base64');
}

// Get all PNG files in the target directory
const pngFiles = fs.readdirSync(targetDir).filter(file => path.extname(file).toLowerCase() === '.png');

log(`Found ${pngFiles.length} PNG files to process`);

// Process each PNG file
pngFiles.forEach(pngFile => {
    const pngPath = path.join(targetDir, pngFile);
    const base64Data = pngToBase64(pngPath);
    const jsFileName = pngFile.replace('.png', '.js');
    const jsFilePath = path.join(targetDir, jsFileName);
    const jsContent = `
if (typeof FontLoader !== 'undefined' && FontLoader.registerTempAtlasData) {
    FontLoader.registerTempAtlasData('${pngFile.replace('.png', '').replace('atlas-','')}', '${base64Data}');
} else {
    console.warn('FontLoader not available - atlas data for ${pngFile.replace('.png', '').replace('atlas-','')} not registered');
}
`;

    fs.writeFileSync(jsFilePath, jsContent);
    log(`Processed ${pngFile} -> ${jsFileName}`);
});

log('All PNG files have been converted to JS files.');
