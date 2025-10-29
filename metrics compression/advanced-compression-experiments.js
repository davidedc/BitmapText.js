// Advanced compression experiments for metrics files
const fs = require('fs');

// Load sample metrics file
const content = fs.readFileSync('font-assets/metrics-density-1-0-Arial-style-normal-weight-normal-size-16-0.js', 'utf8');

// Extract JSON
const jsonStart = content.indexOf(', {') + 2;
const jsonEnd = content.lastIndexOf(');');
const jsonStr = content.substring(jsonStart, jsonEnd);
const data = JSON.parse(jsonStr);

console.log('=' .repeat(80));
console.log('ADVANCED COMPRESSION EXPERIMENTS');
console.log('=' .repeat(80));

const baselineSize = jsonStr.length;
console.log(`\nBASELINE (raw JSON string): ${baselineSize} bytes`);
console.log(`BASELINE (stringified): ${JSON.stringify(data).length} bytes`);

// ============================================================================
// EXPERIMENT 7: Number precision reduction
// ============================================================================
console.log('\n' + '='.repeat(80));
console.log('EXPERIMENT 7: Reduce number precision');
console.log('='.repeat(80));

function roundNumber(num, decimals = 2) {
    return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

function reduceGlyphPrecision(glyphs, decimals = 2) {
    const rounded = {};
    for (const [char, metrics] of Object.entries(glyphs)) {
        rounded[char] = metrics.map(m => roundNumber(m, decimals));
    }
    return rounded;
}

const precision3 = reduceGlyphPrecision(data.g, 3);
const precision2 = reduceGlyphPrecision(data.g, 2);
const precision1 = reduceGlyphPrecision(data.g, 1);

console.log(`Original glyphs: ${JSON.stringify(data.g).length} bytes`);
console.log(`3 decimals: ${JSON.stringify(precision3).length} bytes (${JSON.stringify(data.g).length - JSON.stringify(precision3).length} saved)`);
console.log(`2 decimals: ${JSON.stringify(precision2).length} bytes (${JSON.stringify(data.g).length - JSON.stringify(precision2).length} saved)`);
console.log(`1 decimal: ${JSON.stringify(precision1).length} bytes (${JSON.stringify(data.g).length - JSON.stringify(precision1).length} saved)`);

// Check sample values
console.log(`\nSample comparison:`);
const sampleChar = '0';
console.log(`Original: ${JSON.stringify(data.g[sampleChar])}`);
console.log(`2 decimals: ${JSON.stringify(precision2[sampleChar])}`);

// ============================================================================
// EXPERIMENT 8: Pack numbers as hex or base64
// ============================================================================
console.log('\n' + '='.repeat(80));
console.log('EXPERIMENT 8: Binary packing with base64');
console.log('='.repeat(80));

function packGlyphsToBinary(glyphs) {
    // Pack each number as a 16-bit fixed-point value (multiply by 100 to preserve 2 decimals)
    const chars = Object.keys(glyphs);
    const buffer = Buffer.alloc(chars.length * 5 * 2); // 5 numbers per glyph, 2 bytes each

    let offset = 0;
    for (const char of chars) {
        for (const value of glyphs[char]) {
            const scaled = Math.round(value * 100); // 2 decimal precision
            buffer.writeInt16LE(scaled, offset);
            offset += 2;
        }
    }

    return {
        chars: chars.join(''),
        data: buffer.toString('base64')
    };
}

const packed = packGlyphsToBinary(data.g);
const packedSize = JSON.stringify(packed).length;

console.log(`Original glyphs: ${JSON.stringify(data.g).length} bytes`);
console.log(`Binary packed (base64): ${packedSize} bytes`);
console.log(`Savings: ${JSON.stringify(data.g).length - packedSize} bytes (${((JSON.stringify(data.g).length - packedSize) / JSON.stringify(data.g).length * 100).toFixed(1)}%)`);

// ============================================================================
// EXPERIMENT 9: Dictionary compression for repeated sequences
// ============================================================================
console.log('\n' + '='.repeat(80));
console.log('EXPERIMENT 9: Dictionary compression');
console.log('='.repeat(80));

// Find repeated number patterns in glyph data
const numberPatterns = new Map();

for (const [char, metrics] of Object.entries(data.g)) {
    for (let i = 0; i < metrics.length - 1; i++) {
        const pattern = `${metrics[i]},${metrics[i+1]}`;
        numberPatterns.set(pattern, (numberPatterns.get(pattern) || 0) + 1);
    }
}

// Find most common patterns
const sortedPatterns = Array.from(numberPatterns.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

console.log('Most repeated number pairs:');
sortedPatterns.forEach(([pattern, count]) => {
    console.log(`  "${pattern}": ${count} times`);
});

// ============================================================================
// EXPERIMENT 10: Use integer scaling
// ============================================================================
console.log('\n' + '='.repeat(80));
console.log('EXPERIMENT 10: Integer scaling (multiply by 10000)');
console.log('='.repeat(80));

function scaleToIntegers(glyphs, scale = 10000) {
    const scaled = {};
    for (const [char, metrics] of Object.entries(glyphs)) {
        scaled[char] = metrics.map(m => Math.round(m * scale));
    }
    return scaled;
}

const scaledGlyphs = scaleToIntegers(data.g);
const scaledSize = JSON.stringify(scaledGlyphs).length;

console.log(`Original glyphs: ${JSON.stringify(data.g).length} bytes`);
console.log(`Integer scaled: ${scaledSize} bytes`);
console.log(`Difference: ${scaledSize - JSON.stringify(data.g).length} bytes`);
console.log(`Note: Longer because integers can be 5+ digits, but easier to work with`);

// ============================================================================
// EXPERIMENT 11: Terser/minification simulation
// ============================================================================
console.log('\n' + '='.repeat(80));
console.log('EXPERIMENT 11: Aggressive minification');
console.log('='.repeat(80));

// Remove all whitespace
const minifiedJson = JSON.stringify(data);
const prettyJson = JSON.stringify(data, null, 2);

console.log(`Pretty printed: ${prettyJson.length} bytes`);
console.log(`Minified (no spaces): ${minifiedJson.length} bytes`);
console.log(`Already minified difference: ${prettyJson.length - minifiedJson.length} bytes`);

// ============================================================================
// EXPERIMENT 12: Shared baseline extraction + array encoding
// ============================================================================
console.log('\n' + '='.repeat(80));
console.log('EXPERIMENT 12: Optimized structure (SHORT KEYS + ARRAY)');
console.log('='.repeat(80));

// Use shortest possible keys
const optimized = {
    k: data.k,
    b: data.b,
    g: Object.values(data.g), // Just values, assume order
    c: Object.keys(data.g).join(''), // Character string
    s: data.s
};

const optimizedSize = JSON.stringify(optimized).length;

console.log(`Original: ${JSON.stringify(data).length} bytes`);
console.log(`Optimized: ${optimizedSize} bytes`);
console.log(`Savings: ${JSON.stringify(data).length - optimizedSize} bytes (${((JSON.stringify(data).length - optimizedSize) / JSON.stringify(data).length * 100).toFixed(1)}%)`);

// ============================================================================
// EXPERIMENT 13: Analyze actual JSON string representation
// ============================================================================
console.log('\n' + '='.repeat(80));
console.log('EXPERIMENT 13: Character frequency analysis');
console.log('='.repeat(80));

const charFreq = {};
for (const char of jsonStr) {
    charFreq[char] = (charFreq[char] || 0) + 1;
}

const topChars = Object.entries(charFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

console.log('Most frequent characters in JSON:');
topChars.forEach(([char, count]) => {
    const display = char === ' ' ? 'SPACE' : char === '\n' ? 'NEWLINE' : char;
    const pct = (count / jsonStr.length * 100).toFixed(1);
    console.log(`  "${display}": ${count} times (${pct}%)`);
});

// ============================================================================
// SUMMARY
// ============================================================================
console.log('\n' + '='.repeat(80));
console.log('COMPRESSION STRATEGY RANKING');
console.log('='.repeat(80));

const strategies = [
    { name: 'Remove comments/wrapper', savings: 194, complexity: 'Low', risk: 'None' },
    { name: 'Array encoding (vs object keys)', savings: 438, complexity: 'Low', risk: 'Low' },
    { name: 'Kerning value mapping', savings: 184, complexity: 'Medium', risk: 'Low' },
    { name: 'Binary packing (base64)', savings: JSON.stringify(data.g).length - packedSize, complexity: 'High', risk: 'Medium' },
    { name: 'Sparse array encoding', savings: 326, complexity: 'Medium', risk: 'Medium' },
    { name: 'Number precision reduction', savings: JSON.stringify(data.g).length - JSON.stringify(precision2).length, complexity: 'Low', risk: 'Medium' }
];

console.log('\nRanked by savings:');
strategies.sort((a, b) => b.savings - a.savings).forEach((s, i) => {
    console.log(`${i+1}. ${s.name}: ${s.savings} bytes/file (Complexity: ${s.complexity}, Risk: ${s.risk})`);
});

console.log('\n' + '='.repeat(80));
console.log('BEST COMBINED APPROACH');
console.log('='.repeat(80));

const bestCombined = {
    k: data.k,
    b: data.b,
    g: Object.values(data.g),
    c: Object.keys(data.g).join(''),
    s: data.s
};

const bestSize = JSON.stringify(bestCombined).length;
const wrapperSavings = 194;
const totalSavings = (jsonStr.length - bestSize) + wrapperSavings;

console.log(`Current file: ${content.length} bytes`);
console.log(`  - Wrapper: 345 bytes`);
console.log(`  - JSON: ${jsonStr.length} bytes`);
console.log(`\nOptimized file: ${151 + bestSize} bytes`);
console.log(`  - Minimal wrapper: 151 bytes`);
console.log(`  - Optimized JSON: ${bestSize} bytes`);
console.log(`\nTotal savings: ${totalSavings} bytes (${(totalSavings / content.length * 100).toFixed(1)}%)`);
console.log(`\nFor all 156 files (710KB total):`);
console.log(`Estimated total savings: ${(totalSavings * 156 / 1024).toFixed(1)} KB`);
