#!/usr/bin/env node

/**
 * WebP to QOI Converter for BitmapText.js
 *
 * Re-derives atlas-*.qoi files from atlas-*.webp by piping each WebP through
 * `dwebp -pam` (system tool from `brew install webp`) to obtain raw RGBA pixels,
 * then encoding the pixels with the project's lib/QOIEncode.js.
 *
 * Used by the unminimise/rebuild-from-minimal.sh path: the published "minimum
 * set" is metrics-bundle.js + atlas-*.webp; everything else (including .qoi)
 * is regenerated locally. The forward direction (canonical full build) lives
 * in scripts/watch-font-assets.sh.
 *
 * Idempotent: existing .qoi siblings are overwritten so the run is bit-exact
 * regardless of starting state.
 *
 * Usage:
 *   node scripts/webp-to-qoi-converter.js [directory]
 *
 * Options:
 *   --help, -h    Show this help message
 *
 * Examples:
 *   node scripts/webp-to-qoi-converter.js
 *   node scripts/webp-to-qoi-converter.js font-assets
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

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
    console.log('WebP to QOI Converter for BitmapText.js');
    console.log('');
    console.log('Usage:');
    console.log('  node scripts/webp-to-qoi-converter.js [directory]');
    console.log('');
    console.log('Options:');
    console.log('  --help, -h    Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/webp-to-qoi-converter.js');
    console.log('  node scripts/webp-to-qoi-converter.js font-assets');
    process.exit(0);
}

// Load lib/QOIEncode.js inside a vm sandbox. Mirrors the loader pattern used
// by scripts/qoi-to-png-converter.js. The library is plain ES5 with no Node
// dependencies in the function body, so this works without modification.
const projectRoot = path.resolve(__dirname, '..');
const qoiEncodePath = path.join(projectRoot, 'lib', 'QOIEncode.js');

if (!fs.existsSync(qoiEncodePath)) {
    console.error('Error: QOIEncode.js not found at', qoiEncodePath);
    process.exit(1);
}

const qoiEncodeCode = fs.readFileSync(qoiEncodePath, 'utf8');
const ctx = {
    console,
    TextEncoder: global.TextEncoder || require('util').TextEncoder,
    Uint8Array,
    Uint8ClampedArray,
    ArrayBuffer,
    Math,
    String,
    Object,
    Error,
    global: {},
};
vm.createContext(ctx);

try {
    vm.runInContext(qoiEncodeCode + '\nglobal.QOIEncode = QOIEncode;', ctx);
} catch (error) {
    console.error('Error loading QOIEncode:', error.message);
    process.exit(1);
}

const QOIEncode = ctx.global.QOIEncode;
if (typeof QOIEncode !== 'function') {
    console.error('Error: QOIEncode failed to load from', qoiEncodePath);
    process.exit(1);
}

// Verify dwebp is available before iterating.
const dwebpProbe = spawnSync('dwebp', ['-version'], { encoding: 'utf8' });
if (dwebpProbe.status !== 0) {
    console.error('Error: dwebp not found in PATH. Install with: brew install webp');
    process.exit(1);
}

const fullTargetDirectory = path.resolve(targetDirectory);
if (!fs.existsSync(fullTargetDirectory)) {
    console.error(`Error: Directory '${fullTargetDirectory}' does not exist`);
    process.exit(1);
}

// Use fs.readdirSync, not a shell glob: family names contain spaces
// (e.g. "Courier New", "Times New Roman") which would break shell expansion.
const entries = fs.readdirSync(fullTargetDirectory)
    .filter(f => f.startsWith('atlas-') && f.endsWith('.webp'))
    .sort();

if (entries.length === 0) {
    console.error(`Error: no atlas-*.webp files in ${fullTargetDirectory}`);
    process.exit(1);
}

console.log(`Converting ${entries.length} WebP files to QOI...`);

const PROGRESS_INTERVAL = 200;
let converted = 0;
let failed = 0;

for (const name of entries) {
    const webpPath = path.join(fullTargetDirectory, name);
    const qoiPath = webpPath.replace(/\.webp$/, '.qoi');

    const dwebp = spawnSync('dwebp', ['-pam', webpPath, '-o', '-'], {
        encoding: 'buffer',
        maxBuffer: 256 * 1024 * 1024,
    });
    if (dwebp.status !== 0) {
        console.error(`\n[FAIL] dwebp failed for ${name}: ${dwebp.stderr ? dwebp.stderr.toString() : 'unknown error'}`);
        failed++;
        continue;
    }

    const pamBuffer = dwebp.stdout;

    // Locate end of PAM header. Header is plain ASCII, terminated by ENDHDR\n.
    const headerTerminator = Buffer.from('ENDHDR\n', 'ascii');
    const headerEndIdx = pamBuffer.indexOf(headerTerminator);
    if (headerEndIdx < 0) {
        console.error(`\n[FAIL] ${name}: missing ENDHDR in PAM output`);
        failed++;
        continue;
    }
    const bodyStart = headerEndIdx + headerTerminator.length;
    const headerText = pamBuffer.slice(0, headerEndIdx).toString('ascii');

    const widthMatch = headerText.match(/WIDTH (\d+)/);
    const heightMatch = headerText.match(/HEIGHT (\d+)/);
    if (!widthMatch || !heightMatch) {
        console.error(`\n[FAIL] ${name}: PAM header missing WIDTH/HEIGHT`);
        failed++;
        continue;
    }
    const width = parseInt(widthMatch[1], 10);
    const height = parseInt(heightMatch[1], 10);

    const expectedBodyLen = width * height * 4;
    const bodyLen = pamBuffer.length - bodyStart;
    if (bodyLen !== expectedBodyLen) {
        console.error(`\n[FAIL] ${name}: PAM body length ${bodyLen} != ${expectedBodyLen} (${width}x${height}x4)`);
        failed++;
        continue;
    }

    // Zero-copy view of the body as a Uint8Array.
    const rgba = new Uint8Array(pamBuffer.buffer, pamBuffer.byteOffset + bodyStart, expectedBodyLen);

    const qoiBuffer = QOIEncode(rgba, { width, height, channels: 4, colorspace: 0 });
    fs.writeFileSync(qoiPath, Buffer.from(qoiBuffer));

    converted++;
    if (converted % PROGRESS_INTERVAL === 0) {
        console.log(`  ${converted}/${entries.length}`);
    }
}

console.log('');
console.log(`Done: ${converted} converted, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
