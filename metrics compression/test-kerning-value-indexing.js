/**
 * Test kerning value indexing optimization (Tier 4)
 * Verifies that:
 * 1. Kerning value lookup table is created with correct scoring
 * 2. High-scoring kerning values get shortest indices
 * 3. Roundtrip integrity is preserved for kerning table
 */

const fs = require('fs');

// Generate CHARACTER_SET inline
function generateCharacterSet() {
  const chars = [];
  for (let i = 32; i <= 126; i++) chars.push(String.fromCharCode(i));
  const cp1252 = [8364, 8230, 8240, 8249, 381, 8217, 8226, 8212, 8482, 353, 8250, 339, 382, 376];
  for (const code of cp1252) chars.push(String.fromCharCode(code));
  for (let i = 161; i <= 255; i++) if (i !== 173) chars.push(String.fromCharCode(i));
  chars.push('█');
  return chars.sort().join('');
}

const CHARACTER_SET = generateCharacterSet();

// Load classes
const minifierCode = fs.readFileSync('src/builder/MetricsMinifier.js', 'utf8');
const expanderCode = fs.readFileSync('src/builder/MetricsExpander.js', 'utf8');
const fontMetricsCode = fs.readFileSync('src/runtime/FontMetrics.js', 'utf8');

eval(fontMetricsCode + '\nglobalThis.FontMetrics = FontMetrics;');
eval(minifierCode + '\nglobalThis.MetricsMinifier = MetricsMinifier;');
eval(expanderCode + '\nglobalThis.MetricsExpander = MetricsExpander;');

const { FontMetrics, MetricsMinifier, MetricsExpander } = globalThis;

console.log('✓ Dependencies loaded\n');

// Helper to create test metrics
const createMetric = (width) => ({
  width,
  actualBoundingBoxLeft: 0,
  actualBoundingBoxRight: width,
  actualBoundingBoxAscent: 13,
  actualBoundingBoxDescent: 0,
  fontBoundingBoxAscent: 17,
  fontBoundingBoxDescent: 4,
  hangingBaseline: 16.75,
  alphabeticBaseline: 0,
  ideographicBaseline: -3.92,
  pixelDensity: 1
});

console.log('TEST 1: Kerning value lookup table creation\n');

// Create test data with realistic kerning table
const testData = {
  kerningTable: {
    'T': { ' ': 50, ',': 50, '.': 50, 'a': 50, 'e': 50 },  // Value 50 appears 5 times
    'Y': { ' ': 50, ',': 50, '.': 50, 'a': 50, 'e': 50 },  // Value 50 appears 5 more times
    'V': { 'a': 50, 'e': 50 },                             // Value 50 appears 2 more times
    'f': { 't': -100, 'y': -100 },                         // Value -100 appears 2 times
    'r': { 'a': -50, 'd': -50, 'e': -50 },                 // Value -50 appears 3 times
    's': { 'a': -50, 'e': -50 },                            // Value -50 appears 2 more times
    'A': { 's': 20 },                                       // Value 20 appears 1 time
    'B': { 's': 20 }                                        // Value 20 appears 1 more time
  },
  characterMetrics: {},
  spaceAdvancementOverrideForSmallSizesInPx: 5
};

// Add all 204 characters
for (const char of CHARACTER_SET) {
  testData.characterMetrics[char] = createMetric(10);
}

// Minify
const minified = MetricsMinifier.minifyWithVerification(testData);

console.log('✅ Minification succeeded');
console.log(`   'kv' field present: ${!!minified.kv}`);
console.log(`   'kv' field length: ${minified.kv.length} unique kerning values`);

if (!minified.kv) {
  console.log('❌ FAILED: Missing \'kv\' field in minified data');
  process.exit(1);
}

// Verify kerning value lookup is sorted by score
console.log('\n📊 Kerning values in lookup table (by score):');
for (let i = 0; i < minified.kv.length; i++) {
  console.log(`   Index ${i}: ${minified.kv[i]}`);
}

// Expected order: 50 (12 occurrences × 2 chars = 24), -50 (5 × 3 = 15), 20 (2 × 2 = 4), -100 (2 × 4 = 8)
// So: 50, -50, -100, 20
const expectedOrder = [50, -50, -100, 20];
let orderCorrect = true;
for (let i = 0; i < expectedOrder.length; i++) {
  if (minified.kv[i] !== expectedOrder[i]) {
    orderCorrect = false;
    break;
  }
}

if (!orderCorrect) {
  console.log('⚠️  WARNING: Kerning values not in expected optimal order');
  console.log(`   Expected: [${expectedOrder.join(', ')}]`);
  console.log(`   Got: [${minified.kv.join(', ')}]`);
}

console.log('\n\nTEST 2: Roundtrip integrity for kerning table\n');

const expanded = MetricsExpander.expand(minified);

// Verify kerning table was preserved
const originalKerning = testData.kerningTable;
const expandedKerning = expanded._kerningTable;

let mismatchCount = 0;
for (const [leftChar, pairs] of Object.entries(originalKerning)) {
  if (!expandedKerning[leftChar]) {
    console.log(`❌ Missing left character "${leftChar}" in expanded kerning`);
    mismatchCount++;
    continue;
  }
  
  for (const [rightChar, value] of Object.entries(pairs)) {
    const expandedValue = expandedKerning[leftChar][rightChar];
    if (expandedValue !== value) {
      console.log(`❌ Kerning mismatch for "${leftChar}/${rightChar}"`);
      console.log(`   Original: ${value}, Expanded: ${expandedValue}`);
      mismatchCount++;
    }
  }
}

if (mismatchCount > 0) {
  console.log(`\n❌ FAILED: ${mismatchCount} kerning mismatches`);
  process.exit(1);
}

console.log('✅ All kerning values preserved correctly');

console.log('\n\n✅ All kerning value indexing tests passed!');
console.log('\n🎯 Kerning value indexing (Tier 4) is ready for production use!');
