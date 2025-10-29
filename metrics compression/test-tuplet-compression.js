/**
 * Test tuplet compression optimization (Tier 5)
 * Verifies that:
 * 1. Case A (no compression) - 5 elements when w ≠ r
 * 2. Case B (w===r only) - 4 elements
 * 3. Case C (w===r AND l===d) - 3 elements
 * 4. Decompression logic works correctly for all cases
 * 5. Roundtrip integrity is preserved
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

// Helper to create test metrics with specific patterns
const createMetric = (width, left, right, ascent, descent) => ({
  width,
  actualBoundingBoxLeft: left,
  actualBoundingBoxRight: right,
  actualBoundingBoxAscent: ascent,
  actualBoundingBoxDescent: descent,
  fontBoundingBoxAscent: 17,
  fontBoundingBoxDescent: 4,
  hangingBaseline: 16.75,
  alphabeticBaseline: 0,
  ideographicBaseline: -3.92,
  pixelDensity: 1
});

// Test 1: Verify all three compression cases
console.log('TEST 1: Three compression cases\n');

const testData = {
  kerningTable: {},
  characterMetrics: {},
  spaceAdvancementOverrideForSmallSizesInPx: 5
};

const chars = Array.from(CHARACTER_SET);

// Create specific test patterns for each case
// Case C (60 chars): w===r AND l===d (both 0)
for (let i = 0; i < 60; i++) {
  testData.characterMetrics[chars[i]] = createMetric(
    10.5, 0, 10.5, 13.5, 0  // w===r (10.5), l===d (0)
  );
}

// Case B (70 chars): w===r only, l≠d
for (let i = 60; i < 130; i++) {
  testData.characterMetrics[chars[i]] = createMetric(
    8.2, 0, 8.2, 12.3, 0.5  // w===r (8.2), l≠d (0 vs 0.5)
  );
}

// Case A (74 chars): w≠r
for (let i = 130; i < 204; i++) {
  testData.characterMetrics[chars[i]] = createMetric(
    7.1, 0.2, 9.8, 11.5, 0  // w≠r (7.1 vs 9.8)
  );
}

// Minify
const minified = MetricsMinifier.minifyWithVerification(testData);

console.log('✅ Minification succeeded');
console.log(`   'v' field length: ${minified.v.length} unique values`);
console.log(`   'g' field length: ${minified.g.length} glyphs\n`);

// Verify tuplet lengths
let case_c = 0, case_b = 0, case_a = 0;

for (let i = 0; i < minified.g.length; i++) {
  const tuplet = minified.g[i];
  if (tuplet.length === 3) case_c++;
  else if (tuplet.length === 4) case_b++;
  else if (tuplet.length === 5) case_a++;
  else {
    console.log(`❌ FAILED: Invalid tuplet length ${tuplet.length} at index ${i}`);
    process.exit(1);
  }
}

console.log('📊 Compression distribution:');
console.log(`   Case C (3 elements): ${case_c} glyphs`);
console.log(`   Case B (4 elements): ${case_b} glyphs`);
console.log(`   Case A (5 elements): ${case_a} glyphs`);

// Verify expected distribution
if (case_c !== 60 || case_b !== 70 || case_a !== 74) {
  console.log('❌ FAILED: Compression distribution incorrect');
  console.log(`   Expected: C=60, B=70, A=74`);
  console.log(`   Got: C=${case_c}, B=${case_b}, A=${case_a}`);
  process.exit(1);
}

console.log('✅ Compression distribution matches expectations\n');

// Test 2: Calculate savings
const current_indices = 204 * 5;
const compressed_indices = case_c * 3 + case_b * 4 + case_a * 5;
const saved = current_indices - compressed_indices;
const percent = ((saved / current_indices) * 100).toFixed(1);

console.log('TEST 2: Savings calculation\n');
console.log(`   Current indices: ${current_indices}`);
console.log(`   Compressed indices: ${compressed_indices}`);
console.log(`   Saved: ${saved} indices (${percent}%)\n`);

if (saved !== 60 * 2 + 70 * 1) {
  console.log('❌ FAILED: Savings calculation incorrect');
  process.exit(1);
}

console.log('✅ Savings calculation correct (190 indices saved)\n');

// Test 3: Roundtrip integrity
console.log('TEST 3: Roundtrip integrity\n');

const expanded = MetricsExpander.expand(minified);

// Verify all characters
for (const char of CHARACTER_SET) {
  const original = testData.characterMetrics[char];
  const reconstructed = expanded._characterMetrics[char];
  
  if (original.width !== reconstructed.width) {
    console.log(`❌ FAILED: Width mismatch for "${char}"`);
    console.log(`   Original: ${original.width}`);
    console.log(`   Reconstructed: ${reconstructed.width}`);
    process.exit(1);
  }
  
  if (original.actualBoundingBoxLeft !== reconstructed.actualBoundingBoxLeft) {
    console.log(`❌ FAILED: Left mismatch for "${char}"`);
    process.exit(1);
  }
  
  if (original.actualBoundingBoxRight !== reconstructed.actualBoundingBoxRight) {
    console.log(`❌ FAILED: Right mismatch for "${char}"`);
    process.exit(1);
  }
  
  if (original.actualBoundingBoxAscent !== reconstructed.actualBoundingBoxAscent) {
    console.log(`❌ FAILED: Ascent mismatch for "${char}"`);
    process.exit(1);
  }
  
  if (original.actualBoundingBoxDescent !== reconstructed.actualBoundingBoxDescent) {
    console.log(`❌ FAILED: Descent mismatch for "${char}"`);
    process.exit(1);
  }
}

console.log('✅ Roundtrip integrity verified for all 204 characters\n');

// Test 4: Invalid tuplet length
console.log('TEST 4: Invalid tuplet length rejection\n');

const invalidFormat = {
  kv: minified.kv,   // Include kerning value lookup table
  k: {},
  b: minified.b,
  v: minified.v,
  g: [
    [1, 2],        // Invalid: 2 elements
    ...minified.g.slice(1)
  ],
  s: 5
};

try {
  MetricsExpander.expand(invalidFormat);
  console.log('❌ FAILED: Should reject invalid tuplet length');
  process.exit(1);
} catch (error) {
  if (error.message.includes('Invalid glyph tuplet length')) {
    console.log('✅ Correctly rejected invalid tuplet length');
    console.log(`   Error: "${error.message.split('\n')[0]}"`);
  } else {
    console.log('❌ FAILED: Wrong error message');
    console.log(`   Got: "${error.message}"`);
    process.exit(1);
  }
}

console.log('\n\n✅ All tuplet compression tests passed!');
console.log('\n📋 Summary:');
console.log('   ✓ Case A (5 elements): 74 glyphs');
console.log('   ✓ Case B (4 elements): 70 glyphs');
console.log('   ✓ Case C (3 elements): 60 glyphs');
console.log('   ✓ Savings: 190 indices (18.6%)');
console.log('   ✓ Roundtrip integrity verified');
console.log('   ✓ Invalid tuplet length rejected');
console.log('\n🎯 Tuplet compression (Tier 5) is ready for production use!');
