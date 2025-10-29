#!/usr/bin/env node

/**
 * Analyze tuplet compression patterns in font-assets files
 * This script reads the full.js files and analyzes:
 * 1. Pattern frequencies (width===right, left===descent, both)
 * 2. Most common second element (left index)
 * 3. Optimal compression strategy ordering
 */

const fs = require('fs');
const path = require('path');

// File paths
const files = [
  'metrics-density-1-0-Arial-style-normal-weight-normal-size-18-0-full-minified.js',
  'metrics-density-1-0-Arial-style-normal-weight-normal-size-18-5-full-minified.js',
  'metrics-density-1-0-Arial-style-normal-weight-normal-size-19-0-full-minified.js'
];

function analyzeFile(filePath) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Analyzing: ${path.basename(filePath)}`);
  console.log('='.repeat(80));

  // Read and parse the file
  const content = fs.readFileSync(filePath, 'utf8');

  // Extract the data array from BitmapText.r() call
  // Format: BitmapText.r(id, [config, kerning, baselines, values, tuplets, spaceAdvancement])
  const dataMatch = content.match(/BitmapText\.r\([^,]+,(\[[\s\S]*?\])\)/);
  if (!dataMatch) {
    console.log('ERROR: Could not find BitmapText.r() call');
    return null;
  }

  let metricsData;
  try {
    metricsData = eval(dataMatch[1]);
  } catch (e) {
    console.log('ERROR: Could not parse metrics data:', e.message);
    return null;
  }

  // Extract tuplets (should be at index 4)
  if (metricsData.length < 5 || !Array.isArray(metricsData[4])) {
    console.log('ERROR: Invalid metrics data structure or missing tuplets');
    return null;
  }

  const tuplets = metricsData[4];
  console.log(`Total tuplets: ${tuplets.length}`);

  // Pattern counters
  let pattern1Count = 0; // width === right (indices[0] === indices[2])
  let pattern2Count = 0; // left === descent (indices[1] === indices[4])
  let pattern3Count = 0; // both patterns

  // Second element (left index) frequency counter
  const leftIndexFreq = {};

  // Analyze each tuplet
  tuplets.forEach(tuplet => {
    // Tuplet structure: [widthIdx, leftIdx, rightIdx, ascentIdx, descentIdx]
    const [widthIdx, leftIdx, rightIdx, ascentIdx, descentIdx] = tuplet;

    // Track second element frequency
    leftIndexFreq[leftIdx] = (leftIndexFreq[leftIdx] || 0) + 1;

    // Check patterns
    const hasPattern1 = widthIdx === rightIdx;
    const hasPattern2 = leftIdx === descentIdx;

    if (hasPattern1 && hasPattern2) {
      pattern3Count++;
    } else if (hasPattern1) {
      pattern1Count++;
    } else if (hasPattern2) {
      pattern2Count++;
    }
  });

  const noPatternCount = tuplets.length - pattern1Count - pattern2Count - pattern3Count;

  console.log('\n--- Pattern Frequency Analysis ---');
  console.log(`Pattern 1 (width === right):           ${pattern1Count.toString().padStart(6)} (${(pattern1Count / tuplets.length * 100).toFixed(2)}%)`);
  console.log(`Pattern 2 (left === descent):          ${pattern2Count.toString().padStart(6)} (${(pattern2Count / tuplets.length * 100).toFixed(2)}%)`);
  console.log(`Pattern 3 (both patterns):             ${pattern3Count.toString().padStart(6)} (${(pattern3Count / tuplets.length * 100).toFixed(2)}%)`);
  console.log(`No pattern:                            ${noPatternCount.toString().padStart(6)} (${(noPatternCount / tuplets.length * 100).toFixed(2)}%)`);

  // Calculate compression potential
  const compressible = pattern1Count + pattern2Count + pattern3Count;
  const pattern3Saves = pattern3Count * 2; // saves 2 elements
  const pattern12Saves = (pattern1Count + pattern2Count) * 1; // saves 1 element each
  const totalElementsSaved = pattern3Saves + pattern12Saves;
  const currentElements = tuplets.length * 5;
  const afterCompressionElements = currentElements - totalElementsSaved;

  console.log('\n--- Compression Savings Analysis ---');
  console.log(`Tuplets compressible:                  ${compressible.toString().padStart(6)} (${(compressible / tuplets.length * 100).toFixed(2)}%)`);
  console.log(`Current array elements:                ${currentElements.toString().padStart(6)}`);
  console.log(`Elements after compression:            ${afterCompressionElements.toString().padStart(6)}`);
  console.log(`Elements saved:                        ${totalElementsSaved.toString().padStart(6)}`);
  console.log(`Compression ratio:                     ${(afterCompressionElements / currentElements * 100).toFixed(2)}%`);
  console.log(`Size reduction:                        ${((1 - afterCompressionElements / currentElements) * 100).toFixed(2)}%`);

  // Find most common second element (left index)
  const sortedLeftIndices = Object.entries(leftIndexFreq)
    .sort((a, b) => b[1] - a[1]);

  console.log('\n--- Second Element (Left Index) Frequency ---');
  console.log('Top 10 most common values:');
  sortedLeftIndices.slice(0, 10).forEach(([idx, count], rank) => {
    console.log(`  ${(rank + 1).toString().padStart(2)}. Index ${idx.toString().padStart(3)}: ${count.toString().padStart(6)} occurrences (${(count / tuplets.length * 100).toFixed(2)}%)`);
  });

  const mostCommonLeft = sortedLeftIndices[0];
  console.log(`\nMost common left index: ${mostCommonLeft[0]} (${mostCommonLeft[1]} occurrences, ${(mostCommonLeft[1] / tuplets.length * 100).toFixed(2)}%)`);

  return {
    fileName: path.basename(filePath),
    totalTuplets: tuplets.length,
    pattern1Count,
    pattern2Count,
    pattern3Count,
    noPatternCount,
    compressible,
    currentElements,
    afterCompressionElements,
    totalElementsSaved,
    compressionRatio: afterCompressionElements / currentElements,
    mostCommonLeft: mostCommonLeft[0],
    mostCommonLeftCount: mostCommonLeft[1],
    leftIndexFreq
  };
}

// Main execution
console.log('TUPLET COMPRESSION PATTERN ANALYSIS');
console.log('====================================\n');

const results = [];
const fontAssetsDir = path.join(__dirname, '..', 'font-assets');

files.forEach(fileName => {
  const filePath = path.join(fontAssetsDir, fileName);
  if (fs.existsSync(filePath)) {
    const result = analyzeFile(filePath);
    if (result) {
      results.push(result);
    }
  } else {
    console.log(`WARNING: File not found: ${filePath}`);
  }
});

// Summary across all files
if (results.length > 0) {
  console.log('\n\n' + '='.repeat(80));
  console.log('SUMMARY ACROSS ALL FILES');
  console.log('='.repeat(80));

  const totalTuplets = results.reduce((sum, r) => sum + r.totalTuplets, 0);
  const totalPattern1 = results.reduce((sum, r) => sum + r.pattern1Count, 0);
  const totalPattern2 = results.reduce((sum, r) => sum + r.pattern2Count, 0);
  const totalPattern3 = results.reduce((sum, r) => sum + r.pattern3Count, 0);
  const totalCompressible = results.reduce((sum, r) => sum + r.compressible, 0);
  const totalCurrentElements = results.reduce((sum, r) => sum + r.currentElements, 0);
  const totalAfterElements = results.reduce((sum, r) => sum + r.afterCompressionElements, 0);
  const totalSaved = results.reduce((sum, r) => sum + r.totalElementsSaved, 0);

  console.log(`\nTotal tuplets analyzed:                ${totalTuplets.toString().padStart(6)}`);
  console.log(`Pattern 1 (width === right):           ${totalPattern1.toString().padStart(6)} (${(totalPattern1 / totalTuplets * 100).toFixed(2)}%)`);
  console.log(`Pattern 2 (left === descent):          ${totalPattern2.toString().padStart(6)} (${(totalPattern2 / totalTuplets * 100).toFixed(2)}%)`);
  console.log(`Pattern 3 (both):                      ${totalPattern3.toString().padStart(6)} (${(totalPattern3 / totalTuplets * 100).toFixed(2)}%)`);
  console.log(`Total compressible:                    ${totalCompressible.toString().padStart(6)} (${(totalCompressible / totalTuplets * 100).toFixed(2)}%)`);

  console.log(`\nTotal current elements:                ${totalCurrentElements.toString().padStart(6)}`);
  console.log(`Total after compression:               ${totalAfterElements.toString().padStart(6)}`);
  console.log(`Total elements saved:                  ${totalSaved.toString().padStart(6)}`);
  console.log(`Overall compression ratio:             ${(totalAfterElements / totalCurrentElements * 100).toFixed(2)}%`);
  console.log(`Overall size reduction:                ${((1 - totalAfterElements / totalCurrentElements) * 100).toFixed(2)}%`);

  console.log('\n--- Recommended Compression Strategy Order ---');
  console.log('\nBased on frequency analysis, the optimal order is:');

  if (totalPattern3 >= totalPattern1 && totalPattern3 >= totalPattern2) {
    console.log('1. FIRST:  Check for Pattern 3 (both width===right AND left===descent)');
    console.log('   Reason: Highest compression (saves 2 elements per tuplet)');
    console.log(`   Impact: ${totalPattern3} tuplets, saves ${totalPattern3 * 2} elements`);

    if (totalPattern1 >= totalPattern2) {
      console.log('2. SECOND: Check for Pattern 1 (width===right)');
      console.log(`   Impact: ${totalPattern1} tuplets, saves ${totalPattern1} elements`);
      console.log('3. THIRD:  Check for Pattern 2 (left===descent)');
      console.log(`   Impact: ${totalPattern2} tuplets, saves ${totalPattern2} elements`);
    } else {
      console.log('2. SECOND: Check for Pattern 2 (left===descent)');
      console.log(`   Impact: ${totalPattern2} tuplets, saves ${totalPattern2} elements`);
      console.log('3. THIRD:  Check for Pattern 1 (width===right)');
      console.log(`   Impact: ${totalPattern1} tuplets, saves ${totalPattern1} elements`);
    }
  } else {
    // Alternative ordering logic if pattern3 is not dominant
    console.log('Strategy should prioritize most frequent patterns first');
  }

  console.log('\n--- Implementation Notes ---');
  console.log('- Pattern 3 detection MUST come first (check both conditions)');
  console.log('- Use separate arrays for 2-element, 3-element, and 4-element tuplets');
  console.log('- Consider bit flags to indicate which compression was applied');
  console.log('- Store compression metadata alongside compressed tuplets');
}

console.log('\n' + '='.repeat(80));
console.log('Analysis complete!');
console.log('='.repeat(80) + '\n');
