#!/usr/bin/env node

/**
 * QOI to PNG Converter for BitmapText.js
 * 
 * Converts QOI image files to uncompressed PNG format using the project's
 * built-in QOI decoder and PNG encoder libraries.
 * 
 * Usage:
 *   node scripts/qoi-to-png-converter.js [directory]
 *   node scripts/qoi-to-png-converter.js [directory] --remove-qoi
 * 
 * Options:
 *   --remove-qoi    Remove QOI files after successful conversion
 *   --help          Show help message
 */

const fs = require('fs');
const path = require('path');

// Parse command line arguments
let targetDirectory = 'data';
let removeQoiFiles = false;
let showHelp = false;

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--remove-qoi') {
        removeQoiFiles = true;
    } else if (arg === '--help' || arg === '-h') {
        showHelp = true;
    } else if (!arg.startsWith('--')) {
        targetDirectory = arg;
    }
}

if (showHelp) {
    console.log('QOI to PNG Converter for BitmapText.js');
    console.log('');
    console.log('Usage:');
    console.log('  node scripts/qoi-to-png-converter.js [directory] [options]');
    console.log('');
    console.log('Options:');
    console.log('  --remove-qoi    Remove QOI files after successful conversion');
    console.log('  --help, -h      Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/qoi-to-png-converter.js');
    console.log('  node scripts/qoi-to-png-converter.js data/');
    console.log('  node scripts/qoi-to-png-converter.js --remove-qoi');
    console.log('  node scripts/qoi-to-png-converter.js data/ --remove-qoi');
    process.exit(0);
}

// Load QOI decoder and PNG encoder
const projectRoot = path.resolve(__dirname, '..');
const qoiDecodePath = path.join(projectRoot, 'lib', 'QOIDecode.js');
const pngEncoderPath = path.join(projectRoot, 'lib', 'PngEncoder.js');
const pngEncodingOptionsPath = path.join(projectRoot, 'lib', 'PngEncodingOptions.js');

// Load the libraries
if (!fs.existsSync(qoiDecodePath)) {
    console.error('Error: QOIDecode.js not found at', qoiDecodePath);
    process.exit(1);
}

if (!fs.existsSync(pngEncoderPath)) {
    console.error('Error: PngEncoder.js not found at', pngEncoderPath);
    process.exit(1);
}

if (!fs.existsSync(pngEncodingOptionsPath)) {
    console.error('Error: PngEncodingOptions.js not found at', pngEncodingOptionsPath);
    process.exit(1);
}

// Load the libraries in Node.js context
const qoiDecodeCode = fs.readFileSync(qoiDecodePath, 'utf8');
const pngEncoderCode = fs.readFileSync(pngEncoderPath, 'utf8');
const pngEncodingOptionsCode = fs.readFileSync(pngEncodingOptionsPath, 'utf8');

// Create a more robust evaluation context
const vm = require('vm');
const context = {
    console,
    TextEncoder: global.TextEncoder || require('util').TextEncoder,
    Uint8Array,
    Uint8ClampedArray,
    ArrayBuffer,
    Math,
    String,
    Object,
    global: {}
};

// Load libraries with explicit global assignment
vm.createContext(context);

try {
    // Load with explicit global assignment
    vm.runInContext(pngEncodingOptionsCode + '\nglobal.PngEncodingOptions = PngEncodingOptions;', context);
} catch (error) {
    console.error('Error loading PngEncodingOptions:', error.message);
    process.exit(1);
}

try {
    // Load with explicit global assignment
    vm.runInContext(pngEncoderCode + '\nglobal.PngEncoder = PngEncoder;', context);
} catch (error) {
    console.error('Error loading PngEncoder:', error.message);
    process.exit(1);
}

try {
    // Load with explicit global assignment
    vm.runInContext(qoiDecodeCode + '\nglobal.QOIDecode = QOIDecode;', context);
} catch (error) {
    console.error('Error loading QOIDecode:', error.message);
    process.exit(1);
}

// Extract the classes from context
const PngEncodingOptions = context.global.PngEncodingOptions;
const PngEncoder = context.global.PngEncoder;
const QOIDecode = context.global.QOIDecode;

// Verify classes were loaded successfully
if (!PngEncodingOptions || !PngEncoder || !QOIDecode) {
    console.error('Error: Failed to load required libraries');
    process.exit(1);
}

// Resolve target directory
const fullTargetDirectory = path.resolve(targetDirectory);

if (!fs.existsSync(fullTargetDirectory)) {
    console.error(`Error: Directory '${fullTargetDirectory}' does not exist`);
    process.exit(1);
}

console.log(`[INFO] Converting QOI files to PNG in directory: ${fullTargetDirectory}`);
if (removeQoiFiles) {
    console.log('[INFO] QOI files will be removed after successful conversion');
} else {
    console.log('[INFO] QOI files will be preserved after conversion');
}

// Find all QOI files in the directory
const qoiFiles = fs.readdirSync(fullTargetDirectory)
    .filter(file => path.extname(file).toLowerCase() === '.qoi')
    .map(file => path.join(fullTargetDirectory, file));

if (qoiFiles.length === 0) {
    console.log('[INFO] No QOI files found in directory');
    process.exit(0);
}

console.log(`[INFO] Found ${qoiFiles.length} QOI file(s) to convert`);

let successCount = 0;
let errorCount = 0;

// Convert each QOI file to PNG
for (const qoiFile of qoiFiles) {
    const baseName = path.basename(qoiFile, '.qoi');
    const pngFile = path.join(fullTargetDirectory, baseName + '.png');
    
    try {
        console.log(`[INFO] Converting: ${path.basename(qoiFile)} → ${baseName}.png`);
        
        // Read QOI file
        const qoiBuffer = fs.readFileSync(qoiFile);
        
        // Decode QOI - Create a properly sized ArrayBuffer
        // qoiBuffer.buffer may contain extra padding beyond the actual data
        const properArrayBuffer = qoiBuffer.buffer.slice(qoiBuffer.byteOffset, qoiBuffer.byteOffset + qoiBuffer.length);
        
        const qoiData = QOIDecode(properArrayBuffer);
        
        if (qoiData.error) {
            throw new Error('QOI decode error');
        }
        
        // Create surface object for PNG encoder
        const surface = {
            width: qoiData.width,
            height: qoiData.height,
            data: qoiData.data
        };
        
        // Validate surface
        if (!PngEncoder.canEncode(surface)) {
            throw new Error('Surface cannot be encoded to PNG');
        }
        
        // Encode to PNG
        const pngBuffer = PngEncoder.encode(surface, PngEncodingOptions.DEFAULT);
        
        // Write PNG file
        fs.writeFileSync(pngFile, Buffer.from(pngBuffer));
        
        console.log(`[SUCCESS] Created: ${baseName}.png (${pngBuffer.byteLength} bytes)`);
        
        // Remove QOI file if requested
        if (removeQoiFiles) {
            fs.unlinkSync(qoiFile);
            console.log(`[INFO] Removed: ${path.basename(qoiFile)}`);
        }
        
        successCount++;
        
    } catch (error) {
        console.error(`[ERROR] Failed to convert ${path.basename(qoiFile)}: ${error.message}`);
        errorCount++;
    }
}

// Summary
console.log('');
console.log('[SUMMARY]');
console.log(`  Successfully converted: ${successCount} file(s)`);
console.log(`  Failed conversions: ${errorCount} file(s)`);

if (errorCount > 0) {
    console.log('[WARNING] Some conversions failed. Check error messages above.');
    process.exit(1);
} else {
    console.log('[SUCCESS] All QOI files converted successfully!');
    process.exit(0);
}