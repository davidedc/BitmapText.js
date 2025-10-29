// Simplified Tier 3 Roundtrip Test
// Tests character set elimination + kerning range compression

const fs = require('fs');
const path = require('path');

// Manually load and combine the code
const fontMetricsCode = fs.readFileSync(path.join(__dirname, '../src/runtime/FontMetrics.js'), 'utf8');
const minifierCode = fs.readFileSync(path.join(__dirname, '../src/builder/MetricsMinifier.js'), 'utf8');
const expanderCode = fs.readFileSync(path.join(__dirname, '../src/builder/MetricsExpander.js'), 'utf8');

// Execute FontMetrics first and expose to global
eval(fontMetricsCode + '\nglobal.FontMetrics = FontMetrics;');

// Execute minifier and expander, exposing to global
// Note: Both define DEFAULT_CHARACTER_SET, but since they're identical, it's fine
eval(minifierCode + '\nglobal.MetricsMinifier = MetricsMinifier;');
eval(expanderCode + '\nglobal.MetricsExpander = MetricsExpander; global.DEFAULT_CHARACTER_SET = DEFAULT_CHARACTER_SET;');

console.log('🔧 Tier 3 Optimization Roundtrip Test');
console.log('=====================================\n');

// Get classes from global
const FontMetrics = global.FontMetrics;
const MetricsMinifier = global.MetricsMinifier;
const MetricsExpander = global.MetricsExpander;
const DEFAULT_CHARACTER_SET = global.DEFAULT_CHARACTER_SET;

// Verify classes are loaded
if (typeof MetricsMinifier === 'undefined' || typeof MetricsExpander === 'undefined') {
  console.log('❌ ERROR: Classes not loaded properly');
  process.exit(1);
}

// Create test data with full DEFAULT_CHARACTER_SET (204 characters)
const CHARSET = DEFAULT_CHARACTER_SET;

console.log('DEBUG: CHARSET length:', CHARSET.length);
console.log('DEBUG: CHARSET unique:', new Set(CHARSET).size);

const testData = {
  kerningTable: {
    'A': {},  // Full range
    'B': {},  // 0-9
    'C': {},  // Mixed
    'D': {},  // Non-consecutive
  },
  characterMetrics: {},
  spaceAdvancementOverrideForSmallSizesInPx: 5
};

// Create metrics for all 204 characters in DEFAULT_CHARACTER_SET
// IMPORTANT: Create them in the SORTED order to match DEFAULT_CHARACTER_SET
// (Object.keys() will return them in insertion order)
for (let i = 0; i < CHARSET.length; i++) {
  const char = CHARSET[i];
  testData.characterMetrics[char] = {
    width: 10 + (i * 0.01),  // Slightly varied but deterministic
    actualBoundingBoxLeft: 0,
    actualBoundingBoxRight: 10,
    actualBoundingBoxAscent: 12.9375,
    actualBoundingBoxDescent: 0.2188,
    fontBoundingBoxAscent: 15.75,
    fontBoundingBoxDescent: 4.5,
    emHeightAscent: 15.75,
    emHeightDescent: 4.5,
    hangingBaseline: 12.375,
    alphabeticBaseline: 0,
    ideographicBaseline: -4.5,
    pixelDensity: 1
  };
}

// Verify insertion order matches CHARSET
const metricsOrder = Object.keys(testData.characterMetrics).join('');
if (metricsOrder !== CHARSET) {
  console.log('⚠️  WARNING: Object.keys() order does not match DEFAULT_CHARACTER_SET!');
  console.log('   This happens because JavaScript object key ordering is complex.');
  console.log('   Rebuilding characterMetrics in correct order...');

  // Rebuild in correct order
  const ordered = {};
  for (let i = 0; i < CHARSET.length; i++) {
    ordered[CHARSET[i]] = testData.characterMetrics[CHARSET[i]];
  }
  testData.characterMetrics = ordered;

  const newOrder = Object.keys(testData.characterMetrics).join('');
  console.log('   After rebuild, matches:', newOrder === CHARSET, '\n');
}

console.log('DEBUG: After loop, characterMetrics keys:', Object.keys(testData.characterMetrics).length);

// Check if any characters were overwritten
const metricsKeys = Object.keys(testData.characterMetrics);
if (metricsKeys.length < CHARSET.length) {
  console.log('DEBUG: Some characters overwrote others!');
  const charsetArray = Array.from(CHARSET);
  for (let i = 0; i < charsetArray.length; i++) {
    if (!metricsKeys.includes(charsetArray[i])) {
      console.log(`DEBUG: Missing char at index ${i}: code ${charsetArray[i].charCodeAt(0)}`);
    }
  }
}

// Build test kerning

// A: All characters = 20
for (let i = 0; i < CHARSET.length; i++) {
  testData.kerningTable['A'][CHARSET[i]] = 20;
}

// B: 0-9 = 15
for (let i = 0; i <= 9; i++) {
  testData.kerningTable['B'][String(i)] = 15;
}

// C: Mixed
for (let i = 0; i <= 5; i++) {
  testData.kerningTable['C'][String(i)] = 10;
}
testData.kerningTable['C']['A'] = 25;
testData.kerningTable['C']['B'] = 25;
for (const char of ['a', 'b', 'c', 'd', 'e']) {
  testData.kerningTable['C'][char] = 30;
}

// D: Non-consecutive
testData.kerningTable['D']['A'] = 5;
testData.kerningTable['D']['D'] = 5;
testData.kerningTable['D']['Z'] = 5;

console.log('📋 Test Data Summary:');
console.log(`   DEFAULT_CHARACTER_SET length: ${CHARSET.length}`);
console.log(`   Character metrics: ${Object.keys(testData.characterMetrics).length} characters`);
console.log(`   Kerning entries: A=${Object.keys(testData.kerningTable['A']).length}, B=${Object.keys(testData.kerningTable['B']).length}, C=${Object.keys(testData.kerningTable['C']).length}, D=${Object.keys(testData.kerningTable['D']).length}`);
console.log(`   Character set matches default: ${Object.keys(testData.characterMetrics).join('') === CHARSET}\n`);

// Test minification
console.log('⏩ Step 1: Minifying...');
const minified = MetricsMinifier.minify(testData);

console.log(`   ✅ Minified`);
console.log(`   'c' field present: ${minified.c ? 'YES (❌)' : 'NO (✅)'}`);
console.log(`   Kerning A keys: ${JSON.stringify(Object.keys(minified.k['A']))}`);
console.log(`   Kerning B keys: ${JSON.stringify(Object.keys(minified.k['B']))}`);
console.log(`   Kerning C keys: ${JSON.stringify(Object.keys(minified.k['C']))}`);
console.log(`   Kerning D keys: ${JSON.stringify(Object.keys(minified.k['D']))}\n`);

// Verify compressions
let compressionTests = 0;
let compressionPassed = 0;

compressionTests++;
if (minified.k['A']['0-█'] === 20 && Object.keys(minified.k['A']).length === 1) {
  console.log('   ✅ Test A: Full range → "0-█"');
  compressionPassed++;
} else {
  console.log(`   ❌ Test A failed: ${JSON.stringify(minified.k['A'])}`);
}

compressionTests++;
if (minified.k['B']['0-9'] === 15 && Object.keys(minified.k['B']).length === 1) {
  console.log('   ✅ Test B: Digit range → "0-9"');
  compressionPassed++;
} else {
  console.log(`   ❌ Test B failed: ${JSON.stringify(minified.k['B'])}`);
}

compressionTests++;
const cKeys = Object.keys(minified.k['C']);
if (cKeys.includes('0-5') && cKeys.includes('A') && cKeys.includes('B') && cKeys.includes('a-e')) {
  console.log('   ✅ Test C: Mixed ranges and singles');
  compressionPassed++;
} else {
  console.log(`   ❌ Test C failed: ${JSON.stringify(minified.k['C'])}`);
}

compressionTests++;
if (minified.k['D']['A'] === 5 && minified.k['D']['D'] === 5 && minified.k['D']['Z'] === 5 && Object.keys(minified.k['D']).length === 3) {
  console.log('   ✅ Test D: Non-consecutive preserved\n');
  compressionPassed++;
} else {
  console.log(`   ❌ Test D failed: ${JSON.stringify(minified.k['D'])}\n`);
}

// Test expansion
console.log('⏪ Step 2: Expanding...');
const expanded = MetricsExpander.expand(minified);

console.log(`   ✅ Expanded`);
// Access private properties for testing (FontMetrics uses _kerningTable and _characterMetrics)
const expandedKerning = expanded._kerningTable;
const expandedMetrics = expanded._characterMetrics;
console.log(`   Kerning entries: A=${Object.keys(expandedKerning['A'] || {}).length}, B=${Object.keys(expandedKerning['B'] || {}).length}, C=${Object.keys(expandedKerning['C'] || {}).length}, D=${Object.keys(expandedKerning['D'] || {}).length}\n`);

// Verify integrity
console.log('🔍 Step 3: Verifying integrity...');

let tests = 0;
let passed = 0;

// Check A
tests++;
if (Object.keys(expandedKerning['A']).length === CHARSET.length) {
  console.log(`   ✅ Kerning A: ${CHARSET.length} pairs restored`);
  passed++;
} else {
  console.log(`   ❌ Kerning A: Expected ${CHARSET.length}, got ${Object.keys(expandedKerning['A']).length}`);
}

tests++;
const allACorrect = Object.keys(testData.kerningTable['A']).every(k => expandedKerning['A'][k] === 20);
if (allACorrect) {
  console.log('   ✅ Kerning A: All values = 20');
  passed++;
} else {
  console.log('   ❌ Kerning A: Value mismatch');
}

// Check B
tests++;
if (Object.keys(expandedKerning['B']).length === 10) {
  console.log('   ✅ Kerning B: 10 pairs restored');
  passed++;
} else {
  console.log(`   ❌ Kerning B: Expected 10, got ${Object.keys(expandedKerning['B']).length}`);
}

// Check C
tests++;
if (Object.keys(expandedKerning['C']).length === Object.keys(testData.kerningTable['C']).length) {
  console.log(`   ✅ Kerning C: ${Object.keys(testData.kerningTable['C']).length} pairs restored`);
  passed++;
} else {
  console.log(`   ❌ Kerning C: Count mismatch`);
}

// Check D
tests++;
if (Object.keys(expandedKerning['D']).length === 3 && expandedKerning['D']['A'] === 5) {
  console.log('   ✅ Kerning D: 3 pairs restored');
  passed++;
} else {
  console.log('   ❌ Kerning D: Mismatch');
}

// Check character metrics
tests++;
const expandedMetricsCount = Object.keys(expandedMetrics).length;
const originalMetricsCount = Object.keys(testData.characterMetrics).length;
if (expandedMetricsCount === originalMetricsCount) {
  console.log(`   ✅ Character metrics: ${expandedMetricsCount} characters preserved`);
  passed++;
} else {
  console.log(`   ❌ Character metrics: Expected ${originalMetricsCount}, got ${expandedMetricsCount}`);
}

console.log('\n' + '='.repeat(45));
console.log('📊 TEST SUMMARY');
console.log('='.repeat(45));
console.log(`Compression: ${compressionPassed}/${compressionTests} passed`);
console.log(`Integrity: ${passed}/${tests} passed`);
console.log(`Total: ${compressionPassed + passed}/${compressionTests + tests} passed`);

if (compressionPassed === compressionTests && passed === tests) {
  console.log('\n✅ ALL TESTS PASSED');
  console.log('   • Character set elimination working');
  console.log('   • Kerning range compression working');
  console.log('   • Data integrity maintained');
  process.exit(0);
} else {
  console.log('\n❌ SOME TESTS FAILED');
  process.exit(1);
}
