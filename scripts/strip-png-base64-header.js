// PNG Base64 Header Stripper
// Strips the predictable PNG header prefix from atlas-*-png.js files to reduce file sizes
//
// WHY THIS WORKS:
// All valid PNG files start with an 8-byte signature followed by the IHDR chunk header.
// For images with width < 65,536 pixels (essentially all font atlases), the first 18 bytes
// are predictable and encode to "iVBORw0KGgoAAAANSUhEUgAA" in base64 (24 characters).
//
// WHAT IT DOES:
// 1. Scans font-assets/ for atlas-*-png.js files
// 2. Extracts the base64 string from each file
// 3. Verifies it starts with the expected PNG header
// 4. Removes the 24-character prefix
// 5. Adds a marker comment for debugging
// 6. Writes the modified file back
//
// SAFETY:
// - Only processes atlas-*-png.js files (not QOI files)
// - Verifies header exists before stripping (won't double-strip)
// - Backwards compatible (runtime prepends header if missing)
// - Comprehensive error handling and logging

const fs = require('fs');
const path = require('path');

// PNG header constants
const PNG_HEADER_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAA';
const PNG_HEADER_LENGTH = 24;

// Get directory parameter or default to 'font-assets'
const targetDir = process.argv[2] || 'font-assets';

// Logging utility
function log(level, message) {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    console.log(`[${timestamp}] [${level}] ${message}`);
}

// Check if target directory exists
if (!fs.existsSync(targetDir)) {
    log('ERROR', `Directory ${targetDir} does not exist`);
    process.exit(1);
}

log('INFO', `Starting PNG base64 header stripping in directory: ${targetDir}`);

// Find all atlas-*-png.js files
const files = fs.readdirSync(targetDir).filter(file =>
    file.startsWith('atlas-') &&
    file.endsWith('-png.js')
);

if (files.length === 0) {
    log('INFO', 'No atlas-*-png.js files found to process');
    process.exit(0);
}

log('INFO', `Found ${files.length} atlas-*-png.js files to process`);

let processed = 0;
let skipped = 0;
let totalBytesSaved = 0;
let errors = 0;

// Process each file
files.forEach(filename => {
    const filePath = path.join(targetDir, filename);

    try {
        // Read file content
        const originalContent = fs.readFileSync(filePath, 'utf8');
        const originalSize = Buffer.byteLength(originalContent, 'utf8');

        // Extract base64 string using regex
        // Looking for pattern: BitmapText.registerAtlas('idString', 'base64data');
        const regex = /BitmapText\.registerAtlas\(\s*'([^']+)',\s*'([^']+)'\s*\)/;
        const match = originalContent.match(regex);

        if (!match) {
            log('WARNING', `Could not find registerAtlas call in ${filename} - skipping`);
            skipped++;
            return;
        }

        const idString = match[1];
        const base64Data = match[2];

        // Check if already stripped (doesn't start with PNG signature)
        if (!base64Data.startsWith('iVBOR')) {
            log('INFO', `${filename} already has header stripped - skipping`);
            skipped++;
            return;
        }

        // Verify it starts with the expected 24-character PNG header
        if (!base64Data.startsWith(PNG_HEADER_BASE64)) {
            log('WARNING', `${filename} has unexpected PNG header (possibly width ≥ 65536) - skipping for safety`);
            log('WARNING', `  Header starts with: ${base64Data.substring(0, 30)}...`);
            skipped++;
            return;
        }

        // Strip the header
        const strippedBase64 = base64Data.substring(PNG_HEADER_LENGTH);

        // Create new content with marker comment
        const markerComment = '// PNG header stripped\n';
        const newContent = originalContent.replace(
            match[0],
            `${markerComment}    BitmapText.registerAtlas(\n        '${idString}',\n        '${strippedBase64}'\n    )`
        );

        // Calculate savings
        const newSize = Buffer.byteLength(newContent, 'utf8');
        const bytesSaved = originalSize - newSize;

        // Write back to file
        fs.writeFileSync(filePath, newContent, 'utf8');

        processed++;
        totalBytesSaved += bytesSaved;

        log('SUCCESS', `${filename}: stripped ${PNG_HEADER_LENGTH} base64 chars, saved ${bytesSaved} bytes`);

    } catch (error) {
        log('ERROR', `Failed to process ${filename}: ${error.message}`);
        errors++;
    }
});

// Summary
log('INFO', '='.repeat(70));
log('INFO', 'PNG Base64 Header Stripping Summary:');
log('INFO', `  Files processed: ${processed}`);
log('INFO', `  Files skipped: ${skipped}`);
log('INFO', `  Errors: ${errors}`);
log('INFO', `  Total bytes saved: ${totalBytesSaved} bytes`);

if (processed > 0) {
    const avgSavings = (totalBytesSaved / processed).toFixed(1);
    log('INFO', `  Average savings per file: ${avgSavings} bytes`);
}

log('INFO', '='.repeat(70));

// Exit with error if any errors occurred
if (errors > 0) {
    log('ERROR', `Completed with ${errors} error(s)`);
    process.exit(1);
}

if (processed === 0 && skipped === 0) {
    log('WARNING', 'No files were processed');
    process.exit(0);
}

log('SUCCESS', 'PNG base64 header stripping completed successfully!');
process.exit(0);
