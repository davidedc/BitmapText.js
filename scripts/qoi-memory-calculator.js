#!/usr/bin/env node

/**
 * QOI Memory Calculator for BitmapText.js
 * 
 * Calculates the total uncompressed memory required by all QOI image files
 * in a directory. For each QOI file, computes width × height × 4 bytes (RGBA).
 * 
 * Usage:
 *   node scripts/qoi-memory-calculator.js [directory]
 * 
 * Options:
 *   --help, -h      Show help message
 * 
 * Examples:
 *   node scripts/qoi-memory-calculator.js
 *   node scripts/qoi-memory-calculator.js data/
 *   node scripts/qoi-memory-calculator.js /path/to/qoi/files/
 */

const fs = require('fs');
const path = require('path');

// Parse command line arguments
let targetDirectory = 'font-assets';
let showHelp = false;

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
        showHelp = true;
    } else if (!arg.startsWith('--')) {
        targetDirectory = arg;
    }
}

if (showHelp) {
    console.log('QOI Memory Calculator for BitmapText.js');
    console.log('');
    console.log('Calculates the total uncompressed memory required by all QOI image files.');
    console.log('For each QOI file, computes width × height × 4 bytes (RGBA).');
    console.log('');
    console.log('Usage:');
    console.log('  node scripts/qoi-memory-calculator.js [directory]');
    console.log('');
    console.log('Options:');
    console.log('  --help, -h      Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/qoi-memory-calculator.js');
    console.log('  node scripts/qoi-memory-calculator.js data/');
    console.log('  node scripts/qoi-memory-calculator.js /path/to/qoi/files/');
    process.exit(0);
}

// Logging function with timestamp
function log(message, level = 'INFO') {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    console.log(`[${timestamp}] [${level}] ${message}`);
}

// Format bytes to human readable format
function formatBytes(bytes) {
    if (bytes === 0) return '0 bytes';
    
    const k = 1024;
    const sizes = ['bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// Extract width and height from QOI header
function getQoiDimensions(filePath) {
    try {
        const buffer = Buffer.alloc(14); // QOI header is 14 bytes
        const fd = fs.openSync(filePath, 'r');
        const bytesRead = fs.readSync(fd, buffer, 0, 14, 0);
        fs.closeSync(fd);
        
        if (bytesRead < 14) {
            throw new Error('File too small to contain QOI header');
        }
        
        // Verify QOI magic signature (qoif = 0x71, 0x6F, 0x69, 0x66)
        if (buffer[0] !== 0x71 || buffer[1] !== 0x6F || buffer[2] !== 0x69 || buffer[3] !== 0x66) {
            throw new Error('Invalid QOI magic signature');
        }
        
        // Extract width and height from bytes 4-11 (big-endian 32-bit integers)
        const width = ((buffer[4] << 24) | (buffer[5] << 16) | (buffer[6] << 8) | buffer[7]) >>> 0;
        const height = ((buffer[8] << 24) | (buffer[9] << 16) | (buffer[10] << 8) | buffer[11]) >>> 0;
        
        if (width === 0 || height === 0) {
            throw new Error('Invalid dimensions: width or height is 0');
        }
        
        return { width, height };
    } catch (error) {
        throw new Error(`Failed to read QOI header: ${error.message}`);
    }
}

// Resolve target directory
const fullTargetDirectory = path.resolve(targetDirectory);

if (!fs.existsSync(fullTargetDirectory)) {
    log(`Directory '${fullTargetDirectory}' does not exist`, 'ERROR');
    process.exit(1);
}

log(`Analyzing QOI files in directory: ${fullTargetDirectory}`);

// Find all QOI files in the directory
const qoiFiles = fs.readdirSync(fullTargetDirectory)
    .filter(file => path.extname(file).toLowerCase() === '.qoi')
    .map(file => path.join(fullTargetDirectory, file));

if (qoiFiles.length === 0) {
    log('No QOI files found in directory');
    process.exit(0);
}

log(`Found ${qoiFiles.length} QOI file(s) to analyze`);
console.log('');

let totalUncompressedBytes = 0;
let successCount = 0;
let errorCount = 0;
const fileStats = [];

// Analyze each QOI file
for (const qoiFile of qoiFiles) {
    const fileName = path.basename(qoiFile);
    
    try {
        const { width, height } = getQoiDimensions(qoiFile);
        const uncompressedBytes = width * height * 4; // RGBA = 4 bytes per pixel
        const fileSizeBytes = fs.statSync(qoiFile).size;
        
        totalUncompressedBytes += uncompressedBytes;
        successCount++;
        
        fileStats.push({
            fileName,
            width,
            height,
            uncompressedBytes,
            fileSizeBytes,
            compressionRatio: (fileSizeBytes / uncompressedBytes * 100).toFixed(1)
        });
        
        console.log(`${fileName}:`);
        console.log(`  Dimensions: ${width} × ${height} pixels`);
        console.log(`  Uncompressed size: ${formatBytes(uncompressedBytes)}`);
        console.log(`  File size: ${formatBytes(fileSizeBytes)} (${(fileSizeBytes / uncompressedBytes * 100).toFixed(1)}% of uncompressed)`);
        console.log('');
        
    } catch (error) {
        log(`Failed to analyze ${fileName}: ${error.message}`, 'ERROR');
        errorCount++;
        console.log('');
    }
}

// Summary
console.log('='.repeat(60));
log('SUMMARY', 'SUCCESS');
console.log(`  Files analyzed successfully: ${successCount}`);
console.log(`  Files with errors: ${errorCount}`);
console.log(`  Total uncompressed memory: ${formatBytes(totalUncompressedBytes)}`);

if (fileStats.length > 0) {
    console.log('');
    console.log('Statistics:');
    
    // Calculate total compressed size
    const totalCompressedBytes = fileStats.reduce((sum, stat) => sum + stat.fileSizeBytes, 0);
    const overallCompressionRatio = (totalCompressedBytes / totalUncompressedBytes * 100).toFixed(1);
    
    console.log(`  Total compressed size: ${formatBytes(totalCompressedBytes)}`);
    console.log(`  Overall compression ratio: ${overallCompressionRatio}%`);
    console.log(`  Memory saved: ${formatBytes(totalUncompressedBytes - totalCompressedBytes)}`);
    
    // Find largest file by uncompressed size
    const largestFile = fileStats.reduce((max, current) => 
        current.uncompressedBytes > max.uncompressedBytes ? current : max
    );
    
    console.log('');
    console.log(`  Largest uncompressed file: ${largestFile.fileName}`);
    console.log(`    Uncompressed size: ${formatBytes(largestFile.uncompressedBytes)}`);
    console.log(`    Dimensions: ${largestFile.width} × ${largestFile.height}`);
}

console.log('='.repeat(60));

if (errorCount > 0) {
    log('Some files could not be analyzed. Check error messages above.', 'WARNING');
    process.exit(1);
} else {
    log('Analysis completed successfully!', 'SUCCESS');
    process.exit(0);
}