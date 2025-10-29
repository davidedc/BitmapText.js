// Compression experiments for metrics files
// This script tests various compression strategies

const fs = require('fs');

// Load a sample metrics file
const content = fs.readFileSync('font-assets/metrics-density-1-0-Arial-style-normal-weight-normal-size-16-0.js', 'utf8');

// Extract JSON
const jsonStart = content.indexOf(', {') + 2;
const jsonEnd = content.lastIndexOf(');');
const jsonStr = content.substring(jsonStart, jsonEnd);
const data = JSON.parse(jsonStr);

console.log('=' .repeat(80));
console.log('COMPRESSION EXPERIMENTS');
console.log('=' .repeat(80));

// Baseline
const baselineSize = JSON.stringify(data).length;
console.log(`\nBASELINE: ${baselineSize} bytes`);

// ============================================================================
// EXPERIMENT 1: Remove comments and minimize wrapper
// ============================================================================
console.log('\n' + '='.repeat(80));
console.log('EXPERIMENT 1: Minimize comments and wrapper');
console.log('='.repeat(80));

const currentWrapper = content.length - jsonStr.length;
const minimalWrapper = `if(typeof BitmapText!=='undefined'&&BitmapText.registerMetrics){BitmapText.registerMetrics('density-1-0-Arial-style-normal-weight-normal-size-16-0',`.length + 3; // +3 for )};\n

console.log(`Current wrapper: ${currentWrapper} bytes`);
console.log(`Minimal wrapper: ${minimalWrapper} bytes`);
console.log(`Savings: ${currentWrapper - minimalWrapper} bytes per file`);

// ============================================================================
// EXPERIMENT 2: Sparse array encoding for glyphs (omit zeros)
// ============================================================================
console.log('\n' + '='.repeat(80));
console.log('EXPERIMENT 2: Sparse array encoding (omit common zeros)');
console.log('='.repeat(80));

function encodeGlyphsSparse(glyphs) {
    const encoded = {};
    for (const [char, metrics] of Object.entries(glyphs)) {
        // Only include non-zero values
        const sparse = [];
        metrics.forEach((val, i) => {
            if (val !== 0) {
                sparse.push(val);
            }
        });
        encoded[char] = sparse;
    }
    return encoded;
}

const sparseGlyphs = encodeGlyphsSparse(data.g);
const sparseSize = JSON.stringify(sparseGlyphs).length;
const originalGlyphSize = JSON.stringify(data.g).length;

console.log(`Original glyph data: ${originalGlyphSize} bytes`);
console.log(`Sparse encoding: ${sparseSize} bytes`);
console.log(`Savings: ${originalGlyphSize - sparseSize} bytes (${((originalGlyphSize - sparseSize) / originalGlyphSize * 100).toFixed(1)}%)`);
console.log(`\nNote: This requires position tracking or flag bits to decode`);

// ============================================================================
// EXPERIMENT 3: Variable-length integer encoding simulation
// ============================================================================
console.log('\n' + '='.repeat(80));
console.log('EXPERIMENT 3: Delta encoding for similar values');
console.log('='.repeat(80));

// Many glyphs have similar widths - encode deltas
function encodeDeltaGlyphs(glyphs) {
    const chars = Object.keys(glyphs);
    const encoded = {};
    let prevWidth = 0;

    for (const char of chars) {
        const metrics = glyphs[char];
        const deltaWidth = metrics[0] - prevWidth;
        encoded[char] = [deltaWidth, ...metrics.slice(1)];
        prevWidth = metrics[0];
    }
    return encoded;
}

const deltaGlyphs = encodeDeltaGlyphs(data.g);
const deltaSize = JSON.stringify(deltaGlyphs).length;

console.log(`Original glyph data: ${originalGlyphSize} bytes`);
console.log(`Delta encoding: ${deltaSize} bytes`);
console.log(`Savings: ${originalGlyphSize - deltaSize} bytes (${((originalGlyphSize - deltaSize) / originalGlyphSize * 100).toFixed(1)}%)`);
console.log(`\nNote: Minimal savings because JavaScript numbers are strings in JSON`);

// ============================================================================
// EXPERIMENT 4: Kerning value mapping (most values are 50, -50, 100)
// ============================================================================
console.log('\n' + '='.repeat(80));
console.log('EXPERIMENT 4: Kerning value mapping');
console.log('='.repeat(80));

function encodeKerningWithMapping(kerning) {
    // Map common values to short codes
    const valueMap = { '50': 0, '-50': 1, '100': 2 };
    const encoded = {};

    for (const [char1, targets] of Object.entries(kerning)) {
        const encodedTargets = {};
        for (const [char2, value] of Object.entries(targets)) {
            encodedTargets[char2] = valueMap[value] !== undefined ? valueMap[value] : value;
        }
        encoded[char1] = encodedTargets;
    }

    return { m: valueMap, k: encoded };
}

const encodedKerning = encodeKerningWithMapping(data.k);
const kerningOriginalSize = JSON.stringify(data.k).length;
const kerningEncodedSize = JSON.stringify(encodedKerning).length;

console.log(`Original kerning: ${kerningOriginalSize} bytes`);
console.log(`With value mapping: ${kerningEncodedSize} bytes`);
console.log(`Savings: ${kerningOriginalSize - kerningEncodedSize} bytes (${((kerningOriginalSize - kerningEncodedSize) / kerningOriginalSize * 100).toFixed(1)}%)`);

// ============================================================================
// EXPERIMENT 5: Convert character-keyed objects to arrays (assume ordering)
// ============================================================================
console.log('\n' + '='.repeat(80));
console.log('EXPERIMENT 5: Array-based encoding (assumes character order)');
console.log('='.repeat(80));

// Define standard character set order
const standardCharset = '0123456789 █abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZß!"#$%&€\'\'()*+,-./:;<=>?@[\\]^_`{|}~—£°²·ÀÇàç•';

function encodeGlyphsAsArray(glyphs, charset) {
    const arr = [];
    for (const char of charset) {
        if (glyphs[char]) {
            arr.push(glyphs[char]);
        }
    }
    return arr;
}

const glyphArray = encodeGlyphsAsArray(data.g, standardCharset);
const arraySize = JSON.stringify(glyphArray).length;

console.log(`Original glyph data: ${originalGlyphSize} bytes`);
console.log(`Array encoding: ${arraySize} bytes`);
console.log(`Savings: ${originalGlyphSize - arraySize} bytes (${((originalGlyphSize - arraySize) / originalGlyphSize * 100).toFixed(1)}%)`);
console.log(`\nNote: Requires predefined character order`);

// ============================================================================
// EXPERIMENT 6: Combined approach
// ============================================================================
console.log('\n' + '='.repeat(80));
console.log('EXPERIMENT 6: Combined optimizations');
console.log('='.repeat(80));

const optimizedData = {
    k: data.k, // Keep kerning as-is for now (or empty in many files)
    b: data.b, // Keep baseline as-is
    g: glyphArray, // Use array encoding
    s: data.s
};

const optimizedSize = JSON.stringify(optimizedData).length;

console.log(`Baseline JSON: ${baselineSize} bytes`);
console.log(`Optimized JSON: ${optimizedSize} bytes`);
console.log(`Savings: ${baselineSize - optimizedSize} bytes (${((baselineSize - optimizedSize) / baselineSize * 100).toFixed(1)}%)`);

// ============================================================================
// SUMMARY
// ============================================================================
console.log('\n' + '='.repeat(80));
console.log('SUMMARY OF SAVINGS PER FILE');
console.log('='.repeat(80));

const totalCurrentSize = content.length;
const estimatedOptimizedSize = minimalWrapper + optimizedSize;

console.log(`\nCurrent file size: ${totalCurrentSize} bytes`);
console.log(`Estimated optimized size: ${estimatedOptimizedSize} bytes`);
console.log(`Total savings: ${totalCurrentSize - estimatedOptimizedSize} bytes (${((totalCurrentSize - estimatedOptimizedSize) / totalCurrentSize * 100).toFixed(1)}%)`);
console.log(`\nFor 156 files at 710KB total:`);
console.log(`Estimated savings: ${((totalCurrentSize - estimatedOptimizedSize) * 156 / 1024).toFixed(1)} KB`);
