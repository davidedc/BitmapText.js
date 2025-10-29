#!/usr/bin/env node

/**
 * Test compression with magnitude-sorted vs frequency-sorted value arrays
 * to determine which leads to better overall compression
 */

const fs = require('fs');
const path = require('path');

// We need to load the actual source files to test different strategies
const CHARACTER_SET = require('../src/runtime/CHARACTER_SET.js');

// Mock BitmapText to capture data
function extractMetricsData(file) {
  const content = fs.readFileSync(file, 'utf8');
  let captured = null;

  const BitmapText = {
    r: function(density, fontFamily, styleIdx, weightIdx, size, data) {
      captured = data;
    }
  };

  eval(content);
  return captured;
}

// Encode to base64 (simplified - same as MetricsMinifier)
function encodeToBase64Bytes(integers) {
  const bytes = new Uint8Array(integers);
  return Buffer.from(bytes).toString('base64');
}

// Encode with zigzag + varint + base64
function encodeVarInts(integers) {
  const bytes = [];

  for (let value of integers) {
    // Zigzag encoding
    const zigzag = value >= 0 ? (value * 2) : ((-value * 2) - 1);

    // VarInt encoding
    let remaining = zigzag;
    while (remaining >= 0x80) {
      bytes.push((remaining & 0x7F) | 0x80);
      remaining >>>= 7;
    }
    bytes.push(remaining & 0x7F);
  }

  return encodeToBase64Bytes(bytes);
}

// Test both strategies
function testStrategies() {
  // Use Tier 6c production files which have frequency-sorted arrays
  const files = [
    'font-assets/metrics-density-1-0-Arial-style-normal-weight-normal-size-18-0.js',
    'font-assets/metrics-density-1-0-Arial-style-normal-weight-normal-size-18-5.js',
    'font-assets/metrics-density-1-0-Arial-style-normal-weight-normal-size-19-0.js',
  ];

  console.log('═══════════════════════════════════════════════════════════');
  console.log('SORTING STRATEGY COMPARISON');
  console.log('═══════════════════════════════════════════════════════════\n');

  for (const file of files) {
    console.log(`Testing: ${path.basename(file)}\n`);

    // Extract the Tier 6c/7 data
    const tierData = extractMetricsData(file);

    // tierData[3] = value lookup array (currently frequency-sorted in -full.js)
    // tierData[4] = flattened tuplets (encoded as base64 in Tier 6c)
    // tierData[5] = tuplet indices (encoded as base64 in Tier 6c)

    // For -full.js files, the data is already in full format
    // We need to look at the original full metrics

    console.log('  Current data format check:');
    console.log(`    Element [3] type: ${Array.isArray(tierData[3]) ? 'array' : 'string'}`);
    console.log(`    Element [3] length: ${tierData[3].length}`);
    console.log(`    Element [4] type: ${typeof tierData[4]}`);
    console.log(`    Element [5] type: ${typeof tierData[5]}`);

    // Strategy 1: Magnitude-sorted (current Tier 7)
    console.log('\n  Strategy 1: MAGNITUDE-SORTED value array');

    const valuesMagnitudeSorted = [...tierData[3]].sort((a, b) => a - b);
    const deltasMagnitude = [valuesMagnitudeSorted[0]];
    for (let i = 1; i < valuesMagnitudeSorted.length; i++) {
      deltasMagnitude.push(valuesMagnitudeSorted[i] - valuesMagnitudeSorted[i-1]);
    }

    const encodedMagnitude = encodeVarInts(deltasMagnitude);

    console.log(`    Delta range: ${Math.min(...deltasMagnitude)} to ${Math.max(...deltasMagnitude)}`);
    console.log(`    Avg delta: ${(deltasMagnitude.reduce((a,b) => a+b, 0) / deltasMagnitude.length).toFixed(1)}`);
    console.log(`    Encoded size: ${encodedMagnitude.length} chars`);

    // For magnitude sorting, we need to remap tuplet indices!
    // This is the KEY INSIGHT - we need to measure the impact on tuplets

    // Strategy 2: Frequency-sorted (preserve original ordering)
    console.log('\n  Strategy 2: FREQUENCY-SORTED value array (original order)');

    const valuesFrequencySorted = tierData[3]; // Keep original frequency-based order
    const deltasFrequency = [valuesFrequencySorted[0]];
    for (let i = 1; i < valuesFrequencySorted.length; i++) {
      deltasFrequency.push(valuesFrequencySorted[i] - valuesFrequencySorted[i-1]);
    }

    const encodedFrequency = encodeVarInts(deltasFrequency);

    console.log(`    Delta range: ${Math.min(...deltasFrequency)} to ${Math.max(...deltasFrequency)}`);
    console.log(`    Avg delta: ${(deltasFrequency.reduce((a,b) => a+b, 0) / deltasFrequency.length).toFixed(1)}`);
    console.log(`    Encoded size: ${encodedFrequency.length} chars`);

    // Analysis
    console.log('\n  COMPARISON:');
    const diff = encodedMagnitude.length - encodedFrequency.length;
    if (diff > 0) {
      console.log(`    ✅ Frequency-sorted is BETTER by ${diff} chars (${(diff/encodedMagnitude.length*100).toFixed(1)}%)`);
    } else if (diff < 0) {
      console.log(`    ✅ Magnitude-sorted is BETTER by ${-diff} chars (${(-diff/encodedFrequency.length*100).toFixed(1)}%)`);
    } else {
      console.log(`    ⚖️  Both strategies are EQUAL`);
    }

    // IMPORTANT: Check impact on tuplets
    console.log('\n  TUPLET INDEX ANALYSIS:');

    // Decode the tuplet indices from base64
    const tupletIndicesBase64 = tierData[5];
    const tupletIndicesBytes = Buffer.from(tupletIndicesBase64, 'base64');
    const tupletIndices = Array.from(tupletIndicesBytes);

    console.log(`    Number of index references in tuplets: ${tupletIndices.length}`);
    console.log(`    Index range: ${Math.min(...tupletIndices)} to ${Math.max(...tupletIndices)}`);
    console.log(`    Avg index value: ${(tupletIndices.reduce((a,b) => a+b, 0) / tupletIndices.length).toFixed(2)}`);

    // If we magnitude-sort, we need to create a remapping
    // The NEW index of value V is: valuesMagnitudeSorted.indexOf(V)
    const remappedIndices = tupletIndices.map(oldIdx => {
      const value = valuesFrequencySorted[oldIdx];
      return valuesMagnitudeSorted.indexOf(value);
    });

    console.log('\n  After magnitude-sorting (remapped indices):');
    console.log(`    Index range: ${Math.min(...remappedIndices)} to ${Math.max(...remappedIndices)}`);
    console.log(`    Avg index value: ${(remappedIndices.reduce((a,b) => a+b, 0) / remappedIndices.length).toFixed(2)}`);

    // Encode both versions
    const tupletOriginal = encodeToBase64Bytes(tupletIndices);
    const tupletRemapped = encodeToBase64Bytes(remappedIndices);

    console.log(`    Original (frequency) size: ${tupletOriginal.length} chars`);
    console.log(`    Remapped (magnitude) size: ${tupletRemapped.length} chars`);

    const tupletDiff = tupletRemapped.length - tupletOriginal.length;
    if (tupletDiff !== 0) {
      console.log(`    Impact: ${tupletDiff > 0 ? '+' : ''}${tupletDiff} chars ${tupletDiff > 0 ? '(WORSE)' : '(BETTER)'}`);
    }

    // TOTAL IMPACT
    console.log('\n  📊 TOTAL IMPACT:');
    const valueDiff = encodedMagnitude.length - encodedFrequency.length;
    const totalDiff = valueDiff + tupletDiff;

    console.log(`    Value array:  ${valueDiff > 0 ? '+' : ''}${valueDiff} chars`);
    console.log(`    Tuplet array: ${tupletDiff > 0 ? '+' : ''}${tupletDiff} chars`);
    console.log(`    ─────────────────────────────`);
    console.log(`    TOTAL:        ${totalDiff > 0 ? '+' : ''}${totalDiff} chars`);

    if (totalDiff > 0) {
      console.log(`\n  ✅ RECOMMENDATION: Keep FREQUENCY-sorted (save ${totalDiff} chars)`);
    } else if (totalDiff < 0) {
      console.log(`\n  ✅ RECOMMENDATION: Use MAGNITUDE-sorted (save ${-totalDiff} chars)`);
    } else {
      console.log(`\n  ⚖️  RECOMMENDATION: Both strategies are equivalent`);
    }

    console.log('\n');
  }

  console.log('═══════════════════════════════════════════════════════════');
}

testStrategies();
