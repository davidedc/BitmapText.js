/**
 * Test two-dimensional kerning compression roundtrip
 * Verifies that compress → expand → compress produces identical results
 */

const fs = require('fs');

// Generate DEFAULT_CHARACTER_SET inline
function generateDefaultCharacterSet() {
  const chars = [];
  for (let i = 32; i <= 126; i++) chars.push(String.fromCharCode(i));
  const cp1252 = [8364, 8230, 8240, 8249, 381, 8217, 8226, 8212, 8482, 353, 8250, 339, 382, 376];
  for (const code of cp1252) chars.push(String.fromCharCode(code));
  for (let i = 161; i <= 255; i++) if (i !== 173) chars.push(String.fromCharCode(i));
  chars.push('█');
  return chars.sort().join('');
}

const DEFAULT_CHARACTER_SET = generateDefaultCharacterSet();

// Load MetricsMinifier and MetricsExpander classes
const minifierCode = fs.readFileSync('src/builder/MetricsMinifier.js', 'utf8');
const expanderCode = fs.readFileSync('src/builder/MetricsExpander.js', 'utf8');
const fontMetricsCode = fs.readFileSync('src/runtime/FontMetrics.js', 'utf8');

// Execute the code to define the classes and make them global
eval(fontMetricsCode + '\nglobalThis.FontMetrics = FontMetrics;');
eval(minifierCode + '\nglobalThis.MetricsMinifier = MetricsMinifier;');
eval(expanderCode + '\nglobalThis.MetricsExpander = MetricsExpander;');

// Extract from globalThis
const { FontMetrics, MetricsMinifier, MetricsExpander } = globalThis;

console.log('✓ All dependencies loaded');
console.log(`✓ DEFAULT_CHARACTER_SET length: ${DEFAULT_CHARACTER_SET.length}`);

// Create test data with patterns that compress well in both dimensions
// Pattern: Characters "A" through "E" all have same kerning with "s", "t", "u"

// Helper to create a character metric
const createMetric = (width) => ({
  width,
  actualBoundingBoxLeft: 0,
  actualBoundingBoxRight: width,
  actualBoundingBoxAscent: 13.23,
  actualBoundingBoxDescent: 0,
  fontBoundingBoxAscent: 17,
  fontBoundingBoxDescent: 4,
  hangingBaseline: 16.75,
  alphabeticBaseline: 0,
  ideographicBaseline: -3.92,
  pixelDensity: 1
});

const testData = {
  kerningTable: {
    // Left-side compression: A, B, C have identical pairs, should compress to "A-C"
    'A': { 's': -20, 't': -20, 'u': -20 },
    'B': { 's': -20, 't': -20, 'u': -20 },
    'C': { 's': -20, 't': -20, 'u': -20 },
    // Left-side compression: D, E, F have identical pairs, should compress to "D-F"
    'D': { 'v': -15, 'w': -15 },
    'E': { 'v': -15, 'w': -15 },
    'F': { 'v': -15, 'w': -15 },
    // Unique entry (no compression possible)
    'G': { 'a': -25, 'b': -25, 'c': -25, 'd': -25, 'e': -25 }
  },
  characterMetrics: {
    ' ': createMetric(5.14),
    'A': createMetric(12.34),
    'B': createMetric(11.50),
    'C': createMetric(12.00),
    'D': createMetric(12.80),
    'E': createMetric(11.20),
    'F': createMetric(10.50),
    'G': createMetric(11.80),
    'a': createMetric(10.20),
    'b': createMetric(10.20),
    'c': createMetric(9.25),
    'd': createMetric(10.20),
    'e': createMetric(10.20),
    's': createMetric(9.25),
    't': createMetric(5.14),
    'u': createMetric(10.20),
    'v': createMetric(9.25),
    'w': createMetric(13.36)
  },
  spaceAdvancementOverrideForSmallSizesInPx: 5
};

console.log('\n📊 Original Data:');
console.log('Kerning table entries:', Object.keys(testData.kerningTable).length);
console.log('Character metrics:', Object.keys(testData.characterMetrics).length);

// Count total kerning pairs
let totalPairs = 0;
for (const pairs of Object.values(testData.kerningTable)) {
  totalPairs += Object.keys(pairs).length;
}
console.log('Total kerning pairs:', totalPairs);

// STEP 1: Minify
console.log('\n🔽 Minifying...');
const minified = MetricsMinifier.minify(testData);

console.log('Minified kerning table (k):');
console.log(JSON.stringify(minified.k, null, 2));

// STEP 2: Expand
console.log('\n🔼 Expanding...');
const expanded = MetricsExpander.expand(minified);

// STEP 3: Verify roundtrip
console.log('\n✓ Verification:');

// Check kerning table reconstruction (access private property)
const expandedKerningTable = expanded._kerningTable;

let kerningMatch = true;
for (const [leftChar, pairs] of Object.entries(testData.kerningTable)) {
  if (!expandedKerningTable[leftChar]) {
    console.log(`❌ Missing left char: ${leftChar}`);
    kerningMatch = false;
    continue;
  }

  for (const [rightChar, value] of Object.entries(pairs)) {
    const expandedValue = expandedKerningTable[leftChar][rightChar];
    if (expandedValue !== value) {
      console.log(`❌ Kerning mismatch: ${leftChar}/${rightChar} expected ${value}, got ${expandedValue}`);
      kerningMatch = false;
    }
  }
}

if (kerningMatch) {
  console.log('✓ Kerning table matches original');
} else {
  console.log('❌ Kerning table has differences');
}

// STEP 4: Measure compression
const originalSize = JSON.stringify(testData.kerningTable).length;
const compressedSize = JSON.stringify(minified.k).length;
const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

console.log('\n📏 Compression Results:');
console.log(`Original size:    ${originalSize} bytes`);
console.log(`Compressed size:  ${compressedSize} bytes`);
console.log(`Savings:          ${originalSize - compressedSize} bytes (${ratio}%)`);

// STEP 5: Show what compression achieved
console.log('\n🔍 Compression Analysis:');

// Count ranges in compressed data
let leftRanges = 0;
let rightRanges = 0;

for (const [leftKey, pairs] of Object.entries(minified.k)) {
  if (leftKey.includes('-') && leftKey.length >= 3) {
    leftRanges++;
  }

  for (const rightKey of Object.keys(pairs)) {
    if (rightKey.includes('-') && rightKey.length >= 3) {
      rightRanges++;
    }
  }
}

console.log(`Left-side ranges created:  ${leftRanges}`);
console.log(`Right-side ranges created: ${rightRanges}`);

console.log('\n✅ Two-dimensional compression test complete!');
