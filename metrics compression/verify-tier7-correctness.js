#!/usr/bin/env node

/**
 * Verify that Tier 7 compression actually produces correct output
 * by checking if decoded values match original values
 */

const fs = require('fs');
const MetricsMinifier = require('../src/builder/MetricsMinifier.js');
const MetricsExpander = require('../src/builder/MetricsExpander.js');
const CHARACTER_SET = require('../src/runtime/CHARACTER_SET.js');

// Load full metrics
const fullFile = 'font-assets/metrics-density-1-0-Arial-style-normal-weight-normal-size-18-0-full.js';
const fullContent = fs.readFileSync(fullFile, 'utf8');

let originalData = null;
const BitmapText1 = {
  r: (a, b, c, d, e, data) => { originalData = data; }
};
eval('const BitmapText = BitmapText1;' + fullContent);

// Load Tier 7 minified
const tier7File = 'font-assets/metrics-density-1-0-Arial-style-normal-weight-normal-size-18-0-full-minified.js';
const tier7Content = fs.readFileSync(tier7File, 'utf8');

let tier7Data = null;
const BitmapText2 = {
  r: (a, b, c, d, e, data) => { tier7Data = data; }
};
eval('const BitmapText = BitmapText2;' + tier7Content);

console.log('═══════════════════════════════════════════════════════════');
console.log('TIER 7 CORRECTNESS VERIFICATION');
console.log('═══════════════════════════════════════════════════════════\n');

// Check value array ordering
console.log('ORIGINAL (Full metrics):');
console.log('  Value array type:', Array.isArray(originalData[3]) ? 'array' : typeof originalData[3]);
console.log('  First 10 values:', originalData[3].slice(0, 10));

console.log('\nTIER 7 (Minified):');
console.log('  Value array type:', typeof tier7Data[3]);
console.log('  Value array length:', tier7Data[3].length, 'chars (base64)');

// Manually decode to check ordering
const Buffer = require('buffer').Buffer;

// Decode base64 -> varint -> deltas
function decodeVarInts(base64) {
  const bytes = Buffer.from(base64, 'base64');
  const integers = [];
  let i = 0;

  while (i < bytes.length) {
    let value = 0;
    let shift = 0;
    let byte;

    do {
      byte = bytes[i++];
      value |= (byte & 0x7F) << shift;
      shift += 7;
    } while (byte & 0x80);

    // Zigzag decode
    const signed = (value & 1) ? -(value + 1) / 2 : value / 2;
    integers.push(signed);
  }

  return integers;
}

const deltas = decodeVarInts(tier7Data[3]);
const decodedValues = [deltas[0]];
for (let i = 1; i < deltas.length; i++) {
  decodedValues.push(decodedValues[i - 1] + deltas[i]);
}

console.log('\nDECODED Tier 7 values:');
console.log('  Count:', decodedValues.length);
console.log('  First 10 values:', decodedValues.slice(0, 10));
console.log('  Is sorted:', decodedValues.every((v, i, arr) => i === 0 || arr[i-1] <= v) ? 'YES (magnitude)' : 'NO');

// Check if original is frequency-sorted
const originalSorted = [...originalData[3]].sort((a, b) => a - b);
const isOriginalMagnitudeSorted = originalData[3].every((v, i) => v === originalSorted[i]);
console.log('\nORIGINAL ordering:');
console.log('  Is magnitude-sorted:', isOriginalMagnitudeSorted ? 'YES' : 'NO (frequency-sorted)');

// The CRITICAL test: check if index mappings are correct
console.log('\n═══════════════════════════════════════════════════════════');
console.log('INDEX MAPPING VERIFICATION');
console.log('═══════════════════════════════════════════════════════════\n');

// In the original, index 0 should point to value originalData[3][0]
// After Tier 7 compression, index 0 points to decodedValues[0]
// These should be THE SAME if everything is correct!

console.log('Testing index mapping:');
for (let i = 0; i < 5; i++) {
  const originalValue = originalData[3][i];
  const tier7Value = decodedValues[i];
  const match = originalValue === tier7Value;
  console.log(`  Index ${i}: original=${originalValue}, tier7=${tier7Value} ${match ? '✅' : '❌ MISMATCH!'}`);
}

if (!decodedValues.every((v, i) => v === originalData[3][i])) {
  console.log('\n❌ CRITICAL BUG DETECTED!');
  console.log('   The Tier 7 value array is magnitude-sorted,');
  console.log('   but the tuplet indices still refer to frequency-sorted positions!');
  console.log('   This will cause incorrect values to be looked up at runtime.');
} else {
  console.log('\n✅ Index mapping is correct (arrays are in same order)');
}
