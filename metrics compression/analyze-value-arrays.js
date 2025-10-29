#!/usr/bin/env node

/**
 * Deep analysis of the large integer arrays in minified metrics files
 * to identify compression opportunities
 */

const fs = require('fs');
const path = require('path');

// Extract value arrays from minified files
function extractValueArrays() {
  const files = [
    'font-assets/metrics-density-1-0-Arial-style-normal-weight-normal-size-18-0.js',
    'font-assets/metrics-density-1-0-Arial-style-normal-weight-normal-size-18-5.js',
    'font-assets/metrics-density-1-0-Arial-style-normal-weight-normal-size-19-0.js'
  ];

  const results = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');

    // Parse as actual JavaScript to extract the array
    // The file contains: BitmapText.r(1,"Arial",0,0,18,[...])
    // We need element [3] from the last parameter array

    // Create a mock BitmapText object to capture the data
    const BitmapText = {
      r: function(density, fontFamily, styleIdx, weightIdx, size, data) {
        // data is the array we want
        // data[3] is the value lookup table
        results.push({
          file: path.basename(file),
          values: data[3],
          count: data[3].length
        });
      }
    };

    // Execute the file content to trigger the capture
    eval(content);
  }

  return results;
}

// Analyze characteristics
function analyzeData(datasets) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('LARGE INTEGER ARRAY ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════\n');

  for (const dataset of datasets) {
    const { file, values } = dataset;

    console.log(`\n📊 ${file}`);
    console.log(`   Count: ${values.length} values`);

    // Basic stats
    const min = Math.min(...values);
    const max = Math.max(...values);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;

    console.log(`   Range: ${min} to ${max}`);
    console.log(`   Average: ${avg.toFixed(2)}`);

    // Calculate GCD of all values
    const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
    const arrayGcd = values.reduce((a, b) => gcd(a, b));
    console.log(`   GCD: ${arrayGcd}`);

    // Divisibility analysis
    const divisors = [31, 156, 1563, 10, 100, 1000];
    for (const div of divisors) {
      const divisible = values.filter(v => v % div === 0).length;
      const pct = (divisible / values.length * 100).toFixed(1);
      if (divisible > values.length * 0.3) {
        console.log(`   Divisible by ${div}: ${divisible}/${values.length} (${pct}%)`);
      }
    }

    // Delta analysis (if sorted)
    const sorted = [...values].sort((a, b) => a - b);
    const deltas = [];
    for (let i = 1; i < sorted.length; i++) {
      deltas.push(sorted[i] - sorted[i-1]);
    }
    const maxDelta = Math.max(...deltas);
    const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    console.log(`   Sorted deltas: avg=${avgDelta.toFixed(2)}, max=${maxDelta}`);

    // Small values (< 10000)
    const smallValues = values.filter(v => v < 10000);
    console.log(`   Small values (<10k): ${smallValues.length} (${(smallValues.length/values.length*100).toFixed(1)}%)`);

    // Digit analysis - last digit distribution
    const lastDigits = {};
    values.forEach(v => {
      const last = v % 10;
      lastDigits[last] = (lastDigits[last] || 0) + 1;
    });
    console.log(`   Last digit distribution:`, lastDigits);

    // Zero count
    const zeros = values.filter(v => v === 0).length;
    if (zeros > 0) {
      console.log(`   Zero values: ${zeros}`);
    }

    // Current byte size as JSON
    const currentSize = JSON.stringify(values).length;
    console.log(`   Current JSON size: ${currentSize} bytes`);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('COMPRESSION STRATEGY ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Test various compression ideas on first dataset
  const testData = datasets[0].values;

  console.log('Testing on:', datasets[0].file);
  console.log(`Baseline: ${JSON.stringify(testData).length} bytes\n`);

  // 1. Delta encoding (sorted)
  const sorted = [...testData].sort((a, b) => a - b);
  const deltas = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    deltas.push(sorted[i] - sorted[i-1]);
  }
  const deltaSize = JSON.stringify(deltas).length;
  console.log(`1. Delta encoding (sorted): ${deltaSize} bytes (${((1-deltaSize/JSON.stringify(testData).length)*100).toFixed(1)}% savings)`);

  // 2. GCD division
  const gcdFunc = (a, b) => b === 0 ? a : gcdFunc(b, a % b);
  const arrayGcd = testData.reduce((a, b) => gcdFunc(a, b));
  const divided = testData.map(v => v / arrayGcd);
  const gcdSize = JSON.stringify(divided).length + String(arrayGcd).length + 3; // +3 for array notation
  console.log(`2. GCD division (GCD=${arrayGcd}): ${gcdSize} bytes (${((1-gcdSize/JSON.stringify(testData).length)*100).toFixed(1)}% savings)`);

  // 3. Base36 encoding
  const base36 = testData.map(v => v.toString(36));
  const base36Size = JSON.stringify(base36).length;
  console.log(`3. Base36 encoding: ${base36Size} bytes (${((1-base36Size/JSON.stringify(testData).length)*100).toFixed(1)}% savings)`);

  // 4. Base64 + Delta (like tuplets)
  // Simulate by just counting digits needed
  const maxDelta = Math.max(...deltas);
  const bitsNeeded = Math.ceil(Math.log2(maxDelta + 1));
  const totalBits = bitsNeeded * deltas.length;
  const base64Chars = Math.ceil(totalBits / 6); // 6 bits per base64 char
  console.log(`4. Base64 + Delta: ~${base64Chars} chars (estimated ${((1-base64Chars/JSON.stringify(testData).length)*100).toFixed(1)}% savings)`);

  // 5. Two-array split (small vs large)
  const threshold = 10000;
  const small = testData.filter(v => v < threshold);
  const large = testData.filter(v => v >= threshold);
  const splitSize = JSON.stringify(small).length + JSON.stringify(large).length + 10; // +10 for structure
  console.log(`5. Split arrays (<10k / >=10k): ${splitSize} bytes (${((1-splitSize/JSON.stringify(testData).length)*100).toFixed(1)}% savings)`);

  // 6. String concatenation with delimiter
  const strConcat = testData.join(',');
  const strSize = strConcat.length + 2; // +2 for quotes
  console.log(`6. String concatenation: ${strSize} bytes (${((1-strSize/JSON.stringify(testData).length)*100).toFixed(1)}% savings)`);

  console.log('\n');
}

// Run analysis
const datasets = extractValueArrays();
analyzeData(datasets);

console.log('💡 RECOMMENDATIONS:\n');
console.log('Based on the analysis, the most promising strategies are:');
console.log('1. Delta encoding after sorting (significant reduction in value range)');
console.log('2. Base64 encoding with variable-length integers');
console.log('3. GCD optimization (if GCD > 1)');
console.log('4. Hybrid: Combine delta + base64 (like current tuplet encoding)');
console.log('\nNext steps: Implement and test the top strategies in MetricsMinifier.js');
