// Final comprehensive compression analysis
const fs = require('fs');
const zlib = require('zlib');

// Test on multiple files
const testFiles = [
    'font-assets/metrics-density-1-0-Arial-style-normal-weight-normal-size-16-0.js',
    'font-assets/metrics-density-1-0-Arial-style-normal-weight-normal-size-37-0.js',
    'font-assets/metrics-density-1-0-Arial-style-normal-weight-normal-size-76-0.js'
];

console.log('=' .repeat(80));
console.log('COMPREHENSIVE COMPRESSION ANALYSIS');
console.log('=' .repeat(80));

let totalOriginalSize = 0;
let totalOptimized1 = 0; // Minimal changes
let totalOptimized2 = 0; // Moderate optimization
let totalOptimized3 = 0; // Aggressive optimization
let totalGzipOriginal = 0;
let totalGzipOptimized = 0;

testFiles.forEach(filepath => {
    const content = fs.readFileSync(filepath, 'utf8');
    const jsonStart = content.indexOf(', {') + 2;
    const jsonEnd = content.lastIndexOf(');');
    const jsonStr = content.substring(jsonStart, jsonEnd);
    const data = JSON.parse(jsonStr);

    const filename = filepath.split('/').pop();
    console.log(`\n${'='.repeat(80)}\n${filename}\n${'='.repeat(80)}`);

    // Original size
    const originalSize = content.length;
    totalOriginalSize += originalSize;

    // OPTIMIZATION LEVEL 1: Remove comments, minimize wrapper
    const minimalWrapper = `if(typeof BitmapText!=='undefined'&&BitmapText.registerMetrics){BitmapText.registerMetrics('${data.idString || filename.replace('metrics-', '').replace('.js', '')}',`;
    const opt1Data = data;
    const opt1Size = minimalWrapper.length + JSON.stringify(opt1Data).length + 3; // +3 for )};\n
    totalOptimized1 += opt1Size;

    // OPTIMIZATION LEVEL 2: Array encoding + precision reduction
    const opt2Data = {
        k: data.k,
        b: data.b,
        g: Object.values(data.g).map(arr => arr.map(n => Math.round(n * 100) / 100)),
        c: Object.keys(data.g).join(''),
        s: data.s
    };
    const opt2Size = minimalWrapper.length + JSON.stringify(opt2Data).length + 3;
    totalOptimized2 += opt2Size;

    // OPTIMIZATION LEVEL 3: Binary packing
    function packToBinary(glyphs) {
        const chars = Object.keys(glyphs);
        const values = [];
        chars.forEach(char => {
            glyphs[char].forEach(val => {
                values.push(Math.round(val * 100)); // 2 decimal precision
            });
        });
        const buffer = Buffer.alloc(values.length * 2);
        values.forEach((val, i) => buffer.writeInt16LE(val, i * 2));
        return { c: chars.join(''), d: buffer.toString('base64') };
    }

    const opt3Data = {
        k: data.k,
        b: data.b,
        g: packToBinary(data.g),
        s: data.s
    };
    const opt3Size = minimalWrapper.length + JSON.stringify(opt3Data).length + 3;
    totalOptimized3 += opt3Size;

    // Gzip compression comparison
    const gzipOriginal = zlib.gzipSync(content).length;
    const gzipOpt3 = zlib.gzipSync(minimalWrapper + JSON.stringify(opt3Data) + ')};\n').length;
    totalGzipOriginal += gzipOriginal;
    totalGzipOptimized += gzipOpt3;

    console.log(`Original:            ${originalSize} bytes`);
    console.log(`Opt Level 1 (min):   ${opt1Size} bytes  (${((originalSize - opt1Size) / originalSize * 100).toFixed(1)}% saved)`);
    console.log(`Opt Level 2 (mod):   ${opt2Size} bytes  (${((originalSize - opt2Size) / originalSize * 100).toFixed(1)}% saved)`);
    console.log(`Opt Level 3 (aggr):  ${opt3Size} bytes  (${((originalSize - opt3Size) / originalSize * 100).toFixed(1)}% saved)`);
    console.log(`\nWith gzip:`);
    console.log(`Original gzipped:    ${gzipOriginal} bytes  (${((originalSize - gzipOriginal) / originalSize * 100).toFixed(1)}% compression)`);
    console.log(`Opt3 gzipped:        ${gzipOpt3} bytes  (${((originalSize - gzipOpt3) / originalSize * 100).toFixed(1)}% compression)`);
});

console.log(`\n${'='.repeat(80)}`);
console.log('TOTALS FOR TEST FILES');
console.log('='.repeat(80));

console.log(`\nOriginal:            ${totalOriginalSize} bytes`);
console.log(`Opt Level 1:         ${totalOptimized1} bytes  (${((totalOriginalSize - totalOptimized1) / totalOriginalSize * 100).toFixed(1)}% saved)`);
console.log(`Opt Level 2:         ${totalOptimized2} bytes  (${((totalOriginalSize - totalOptimized2) / totalOriginalSize * 100).toFixed(1)}% saved)`);
console.log(`Opt Level 3:         ${totalOptimized3} bytes  (${((totalOriginalSize - totalOptimized3) / totalOriginalSize * 100).toFixed(1)}% saved)`);

console.log(`\nWith gzip:`);
console.log(`Original gzipped:    ${totalGzipOriginal} bytes  (${((totalOriginalSize - totalGzipOriginal) / totalOriginalSize * 100).toFixed(1)}% compression)`);
console.log(`Opt3 gzipped:        ${totalGzipOptimized} bytes  (${((totalOriginalSize - totalGzipOptimized) / totalOriginalSize * 100).toFixed(1)}% compression)`);

console.log(`\n${'='.repeat(80)}`);
console.log('PROJECTED SAVINGS FOR ALL 156 FILES (710KB)');
console.log('='.repeat(80));

const avgSavingsOpt1 = (totalOriginalSize - totalOptimized1) / testFiles.length;
const avgSavingsOpt2 = (totalOriginalSize - totalOptimized2) / testFiles.length;
const avgSavingsOpt3 = (totalOriginalSize - totalOptimized3) / testFiles.length;

console.log(`\nOptimization Level 1: ${(avgSavingsOpt1 * 156 / 1024).toFixed(1)} KB saved`);
console.log(`Optimization Level 2: ${(avgSavingsOpt2 * 156 / 1024).toFixed(1)} KB saved`);
console.log(`Optimization Level 3: ${(avgSavingsOpt3 * 156 / 1024).toFixed(1)} KB saved`);

console.log(`\n${'='.repeat(80)}`);
console.log('RECOMMENDATION MATRIX');
console.log('='.repeat(80));

const recommendations = [
    {
        level: 'TIER 1: Low-Hanging Fruit',
        changes: [
            '1. Remove comments from generated files',
            '2. Minimize wrapper code (no newlines, minimal spacing)',
            '3. Remove ID string from wrapper (already in filename)'
        ],
        effort: 'Low',
        risk: 'None',
        savings: `${(avgSavingsOpt1 * 156 / 1024).toFixed(1)} KB`,
        implementation: 'Modify export-font-data.js template'
    },
    {
        level: 'TIER 2: Safe Optimizations',
        changes: [
            '4. Convert glyph object to array (assume character order)',
            '5. Store character order as single string instead of object keys',
            '6. Reduce number precision to 2 decimals',
            '7. Optimize kerning value encoding'
        ],
        effort: 'Medium',
        risk: 'Low',
        savings: `${(avgSavingsOpt2 * 156 / 1024).toFixed(1)} KB`,
        implementation: 'Update MetricsMinifier.js and MetricsExpander.js'
    },
    {
        level: 'TIER 3: Aggressive Compression',
        changes: [
            '8. Pack glyph numbers as 16-bit integers (base64 encoded)',
            '9. Use binary format instead of JSON for glyph data',
            '10. Optional: Enable gzip compression for metrics files'
        ],
        effort: 'High',
        risk: 'Medium',
        savings: `${(avgSavingsOpt3 * 156 / 1024).toFixed(1)} KB`,
        implementation: 'Significant changes to serialization/deserialization'
    }
];

recommendations.forEach(rec => {
    console.log(`\n${rec.level}`);
    console.log('-'.repeat(80));
    console.log(`Effort: ${rec.effort} | Risk: ${rec.risk} | Savings: ~${rec.savings}`);
    console.log(`\nChanges:`);
    rec.changes.forEach(change => console.log(`  ${change}`));
    console.log(`\nImplementation: ${rec.implementation}`);
});

console.log(`\n${'='.repeat(80)}`);
console.log('SPECIFIC QUICK WINS');
console.log('='.repeat(80));

console.log(`
1. REMOVE COMMENTS (194 bytes/file = 30KB total)
   Current:
   // Font metrics registration for density-1-0-Arial...
   // Generated by font-assets-builder
   // Call BitmapText.registerMetrics() to load these metrics

   Optimized: (remove all 3 comment lines)

2. MINIFY WRAPPER CODE (50+ bytes/file = 8KB total)
   Current:
   if (typeof BitmapText !== 'undefined' && BitmapText.registerMetrics) {
     BitmapText.registerMetrics('density-1-0-Arial-style-normal-weight-normal-size-16-0', {...});
   }

   Optimized:
   if(typeof BitmapText!=='undefined'&&BitmapText.registerMetrics){BitmapText.registerMetrics('density-1-0-Arial-style-normal-weight-normal-size-16-0',{...})}

3. ARRAY-BASED GLYPH ENCODING (400+ bytes/file = 62KB total)
   Current:
   "g":{"0":[8.8984,0,8.8984,11.5,0.1875],"1":[...]}

   Optimized:
   "g":[[8.8984,0,8.8984,11.5,0.1875],[...]],"c":"01234567..."

4. REDUCE PRECISION (780 bytes/file = 121KB total)
   Current: 8.8984
   Optimized: 8.9 (or even 8.90 for consistency)

5. BINARY PACKING (2000+ bytes/file = 312KB total)
   Convert all numbers to 16-bit integers, pack as binary, encode as base64
   Risk: More complex decoder, potential precision issues
`);

console.log(`\n${'='.repeat(80)}`);
console.log('FINAL RECOMMENDATION');
console.log('='.repeat(80));

console.log(`
START WITH TIER 1 + TIER 2 (Safe, High-Impact):
- Total savings: ~${((avgSavingsOpt2 * 156 / 1024)).toFixed(0)} KB (~${((avgSavingsOpt2 * 156 / (710)) * 100).toFixed(0)}% reduction)
- Low risk, moderate effort
- Maintains readability for debugging
- Fully reversible

TIER 3 (Consider if more compression needed):
- Additional ~${((avgSavingsOpt3 - avgSavingsOpt2) * 156 / 1024).toFixed(0)} KB saved
- Higher complexity, binary format less debuggable
- Best for production builds only

ALTERNATIVE: Use gzip compression
- If files are served over HTTP, enable gzip compression
- Original files gzip to ~${(totalGzipOriginal / testFiles.length / (totalOriginalSize / testFiles.length) * 100).toFixed(0)}% of original size
- Optimized files gzip even better
- Zero code changes needed (just server configuration)
`);
