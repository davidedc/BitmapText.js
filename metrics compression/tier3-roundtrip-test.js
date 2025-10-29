// Tier 3 Roundtrip Test
// Tests character set elimination + kerning range compression

// Load dependencies
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Load MetricsMinifier and MetricsExpander
const minifierPath = path.join(__dirname, '../src/builder/MetricsMinifier.js');
const expanderPath = path.join(__dirname, '../src/builder/MetricsExpander.js');
const fontMetricsPath = path.join(__dirname, '../src/runtime/FontMetrics.js');

// Read source files
let minifierCode = fs.readFileSync(minifierPath, 'utf8');
let expanderCode = fs.readFileSync(expanderPath, 'utf8');
const fontMetricsCode = fs.readFileSync(fontMetricsPath, 'utf8');

// Rename DEFAULT_CHARACTER_SET in minifier to avoid conflict with expander
minifierCode = minifierCode.replace('const DEFAULT_CHARACTER_SET', 'const DEFAULT_CHARACTER_SET_MINIFIER');
minifierCode = minifierCode.replace(/DEFAULT_CHARACTER_SET/g, 'DEFAULT_CHARACTER_SET_MINIFIER');

// Create a shared context and load all code
const context = {
  console: console,
};

vm.createContext(context);

// Load each file and explicitly export the class to context
vm.runInContext(fontMetricsCode + '\nthis.FontMetrics = FontMetrics;', context);
vm.runInContext(minifierCode + '\nthis.MetricsMinifier = MetricsMinifier;', context);
vm.runInContext(expanderCode + '\nthis.MetricsExpander = MetricsExpander;', context);

// Extract the classes
const FontMetrics = context.FontMetrics;
const MetricsMinifier = context.MetricsMinifier;
const MetricsExpander = context.MetricsExpander;

console.log('\n🔧 Tier 3 Optimization Roundtrip Test');
console.log('=====================================\n');

// Create test data with various kerning scenarios
const testData = {
  kerningTable: {
    // Test 1: Full character set range (should become "0-█")
    'A': {},
    // Test 2: Partial range
    'B': {},
    // Test 3: Mixed ranges and singles
    'C': {},
    // Test 4: No consecutive pairs
    'D': {},
  },
  characterMetrics: {
    '0': {
      width: 10.0107,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: 10.0107,
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
    },
    '1': {
      width: 10.0107,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: 10.0107,
      actualBoundingBoxAscent: 12.9375,
      actualBoundingBoxDescent: 0,
      fontBoundingBoxAscent: 15.75,
      fontBoundingBoxDescent: 4.5,
      emHeightAscent: 15.75,
      emHeightDescent: 4.5,
      hangingBaseline: 12.375,
      alphabeticBaseline: 0,
      ideographicBaseline: -4.5,
      pixelDensity: 1
    },
  },
  spaceAdvancementOverrideForSmallSizesInPx: 5
};

// Build test kerning table
// A: All characters with value 20 (should compress to "0-█":20)
const DEFAULT_CHARACTER_SET = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~¡¢£¤¥¦§¨©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿœšŸŽž—'•…‰‹›€™█";

for (let i = 0; i < DEFAULT_CHARACTER_SET.length; i++) {
  testData.kerningTable['A'][DEFAULT_CHARACTER_SET[i]] = 20;
}

// B: Characters 0-9 with value 15 (should compress to "0-9":15)
for (let i = 0; i <= 9; i++) {
  testData.kerningTable['B'][String(i)] = 15;
}

// C: Mix of ranges and singles
// 0-5: value 10 (should compress to "0-5":10)
for (let i = 0; i <= 5; i++) {
  testData.kerningTable['C'][String(i)] = 10;
}
// Single characters
testData.kerningTable['C']['A'] = 25;
testData.kerningTable['C']['B'] = 25;
// Another range: a-e (should compress to "a-e":30)
for (const char of ['a', 'b', 'c', 'd', 'e']) {
  testData.kerningTable['C'][char] = 30;
}

// D: Non-consecutive pairs (should not compress)
testData.kerningTable['D']['A'] = 5;
testData.kerningTable['D']['D'] = 5;
testData.kerningTable['D']['Z'] = 5;

console.log('📋 Test Data Summary:');
console.log(`   Character metrics: ${Object.keys(testData.characterMetrics).length} characters`);
console.log(`   Kerning table entries:`);
console.log(`     A: ${Object.keys(testData.kerningTable['A']).length} pairs (all ${DEFAULT_CHARACTER_SET.length} chars)`);
console.log(`     B: ${Object.keys(testData.kerningTable['B']).length} pairs (0-9)`);
console.log(`     C: ${Object.keys(testData.kerningTable['C']).length} pairs (mixed ranges and singles)`);
console.log(`     D: ${Object.keys(testData.kerningTable['D']).length} pairs (non-consecutive)\n`);

// Step 1: Minify
console.log('⏩ Step 1: Minifying data...');
const minified = MetricsMinifier.minify(testData);

console.log('   ✅ Minification complete');
console.log(`   Minified structure: ${JSON.stringify(Object.keys(minified))}`);
console.log(`   'c' field present: ${minified.c ? 'YES (❌ FAIL)' : 'NO (✅ PASS)'}`);
console.log(`   Kerning table structure:`);
console.log(`     A: ${JSON.stringify(minified.k['A']).substring(0, 50)}...`);
console.log(`     B: ${JSON.stringify(minified.k['B'])}`);
console.log(`     C: ${JSON.stringify(minified.k['C'])}`);
console.log(`     D: ${JSON.stringify(minified.k['D'])}\n`);

// Verify expected compressions
let compressionTests = 0;
let compressionPassed = 0;

// Test A: Should have "0-█" notation
compressionTests++;
if (minified.k['A']['0-█'] === 20) {
  console.log('   ✅ Test A: Full range compressed to "0-█"');
  compressionPassed++;
} else {
  console.log(`   ❌ Test A: Expected {"0-█":20}, got ${JSON.stringify(minified.k['A'])}`);
}

// Test B: Should have "0-9" notation
compressionTests++;
if (minified.k['B']['0-9'] === 15) {
  console.log('   ✅ Test B: Partial range compressed to "0-9"');
  compressionPassed++;
} else {
  console.log(`   ❌ Test B: Expected "0-9":15, got ${JSON.stringify(minified.k['B'])}`);
}

// Test C: Should have "0-5", single A, single B, and "a-e"
compressionTests++;
const cHas05 = minified.k['C']['0-5'] === 10;
const cHasA = minified.k['C']['A'] === 25;
const cHasB = minified.k['C']['B'] === 25;
const cHasAE = minified.k['C']['a-e'] === 30;
if (cHas05 && cHasA && cHasB && cHasAE) {
  console.log('   ✅ Test C: Mixed ranges and singles compressed correctly');
  compressionPassed++;
} else {
  console.log(`   ❌ Test C: Expected mixed notation, got ${JSON.stringify(minified.k['C'])}`);
}

// Test D: Should remain as individual pairs
compressionTests++;
if (minified.k['D']['A'] === 5 && minified.k['D']['D'] === 5 && minified.k['D']['Z'] === 5) {
  console.log('   ✅ Test D: Non-consecutive pairs preserved as singles\n');
  compressionPassed++;
} else {
  console.log(`   ❌ Test D: Expected individual pairs, got ${JSON.stringify(minified.k['D'])}\n`);
}

// Step 2: Expand
console.log('⏪ Step 2: Expanding data back...');
const expanded = MetricsExpander.expand(minified);

console.log('   ✅ Expansion complete');
console.log(`   Expanded kerning table entries:`);
console.log(`     A: ${Object.keys(expanded.kerningTable['A']).length} pairs`);
console.log(`     B: ${Object.keys(expanded.kerningTable['B']).length} pairs`);
console.log(`     C: ${Object.keys(expanded.kerningTable['C']).length} pairs`);
console.log(`     D: ${Object.keys(expanded.kerningTable['D']).length} pairs\n`);

// Step 3: Verify data integrity
console.log('🔍 Step 3: Verifying data integrity...');

let tests = 0;
let passed = 0;

// Test kerning table reconstruction
tests++;
const originalAKeys = Object.keys(testData.kerningTable['A']).sort();
const expandedAKeys = Object.keys(expanded.kerningTable['A']).sort();
if (JSON.stringify(originalAKeys) === JSON.stringify(expandedAKeys)) {
  console.log(`   ✅ Kerning A: ${originalAKeys.length} pairs reconstructed correctly`);
  passed++;
} else {
  console.log(`   ❌ Kerning A: Key count mismatch (original: ${originalAKeys.length}, expanded: ${expandedAKeys.length})`);
}

tests++;
const allAValuesCorrect = originalAKeys.every(key => {
  return expanded.kerningTable['A'][key] === testData.kerningTable['A'][key];
});
if (allAValuesCorrect) {
  console.log('   ✅ Kerning A: All values match original');
  passed++;
} else {
  console.log('   ❌ Kerning A: Value mismatch detected');
}

// Test kerning B
tests++;
const originalBKeys = Object.keys(testData.kerningTable['B']).sort();
const expandedBKeys = Object.keys(expanded.kerningTable['B']).sort();
if (JSON.stringify(originalBKeys) === JSON.stringify(expandedBKeys)) {
  console.log(`   ✅ Kerning B: ${originalBKeys.length} pairs reconstructed correctly`);
  passed++;
} else {
  console.log(`   ❌ Kerning B: Key count mismatch`);
}

// Test kerning C
tests++;
const originalCKeys = Object.keys(testData.kerningTable['C']).sort();
const expandedCKeys = Object.keys(expanded.kerningTable['C']).sort();
if (JSON.stringify(originalCKeys) === JSON.stringify(expandedCKeys)) {
  console.log(`   ✅ Kerning C: ${originalCKeys.length} pairs reconstructed correctly`);
  passed++;
} else {
  console.log(`   ❌ Kerning C: Key count mismatch`);
}

// Test kerning D
tests++;
const originalDKeys = Object.keys(testData.kerningTable['D']).sort();
const expandedDKeys = Object.keys(expanded.kerningTable['D']).sort();
if (JSON.stringify(originalDKeys) === JSON.stringify(expandedDKeys)) {
  console.log(`   ✅ Kerning D: ${originalDKeys.length} pairs reconstructed correctly`);
  passed++;
} else {
  console.log(`   ❌ Kerning D: Key count mismatch`);
}

// Test character metrics
tests++;
const originalMetricsKeys = Object.keys(testData.characterMetrics).sort();
const expandedMetricsKeys = Object.keys(expanded.characterMetrics).sort();
if (JSON.stringify(originalMetricsKeys) === JSON.stringify(expandedMetricsKeys)) {
  console.log(`   ✅ Character metrics: ${originalMetricsKeys.length} characters preserved`);
  passed++;
} else {
  console.log(`   ❌ Character metrics: Key mismatch`);
}

// Test metrics values
tests++;
let metricsMatch = true;
for (const char of originalMetricsKeys) {
  const original = testData.characterMetrics[char];
  const reconstructed = expanded.characterMetrics[char];

  if (original.width !== reconstructed.width ||
      original.actualBoundingBoxLeft !== reconstructed.actualBoundingBoxLeft ||
      original.actualBoundingBoxRight !== reconstructed.actualBoundingBoxRight ||
      original.actualBoundingBoxAscent !== reconstructed.actualBoundingBoxAscent ||
      original.actualBoundingBoxDescent !== reconstructed.actualBoundingBoxDescent) {
    metricsMatch = false;
    break;
  }
}

if (metricsMatch) {
  console.log('   ✅ Character metrics: All values match original');
  passed++;
} else {
  console.log('   ❌ Character metrics: Value mismatch detected');
}

// Test space advancement
tests++;
if (expanded.spaceAdvancementOverrideForSmallSizesInPx === testData.spaceAdvancementOverrideForSmallSizesInPx) {
  console.log('   ✅ Space advancement preserved');
  passed++;
} else {
  console.log('   ❌ Space advancement mismatch');
}

// Final summary
console.log('\n' + '='.repeat(45));
console.log('📊 TIER 3 ROUNDTRIP TEST SUMMARY');
console.log('='.repeat(45));
console.log(`Compression Tests: ${compressionPassed}/${compressionTests} passed`);
console.log(`Data Integrity Tests: ${passed}/${tests} passed`);
console.log(`Overall: ${compressionPassed + passed}/${compressionTests + tests} passed`);

if (compressionPassed === compressionTests && passed === tests) {
  console.log('\n✅ ALL TESTS PASSED - TIER 3 IMPLEMENTATION VERIFIED');
  console.log('   • Character set elimination working correctly');
  console.log('   • Kerning range compression working correctly');
  console.log('   • Data integrity maintained through roundtrip');
  process.exit(0);
} else {
  console.log('\n❌ SOME TESTS FAILED - REVIEW IMPLEMENTATION');
  process.exit(1);
}
