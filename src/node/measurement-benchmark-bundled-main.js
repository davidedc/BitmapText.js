#!/usr/bin/env node

/**
 * BitmapText.js Measurement Performance Benchmark (Bundled Version)
 *
 * Tests measureText() performance with adaptive timing.
 * This version uses the production runtime bundle (dist/bitmaptext-node.min.js).
 *
 * Usage: node measurement-benchmark-bundled.js
 * Output: JSON results to stdout
 */

// ============================================================================
// USER-PROVIDED DEPENDENCIES
// ============================================================================

// Canvas implementation (canvas-mock)
const { Canvas } = require('../../../src/platform/canvas-mock.js');

// Node.js built-in modules
const fs = require('fs');
const path = require('path');

// ============================================================================
// LIBRARY RUNTIME BUNDLE (Production)
// ============================================================================

// Import BitmapText runtime bundle (contains all rendering classes)
require('../../../dist/bitmaptext-node.min.js');

// ============================================================================
// TEST DATA
// ============================================================================

// Test data will be concatenated from test-data.js

// ============================================================================
// BENCHMARK LOGIC
// ============================================================================

/**
 * Measure execution time with high iteration count
 */
function measurePerformance(fn, iterations = 10000) {
  // Warm up (avoid JIT compilation effects)
  for (let i = 0; i < 100; i++) fn();

  // Actual measurement
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const elapsed = performance.now() - start;

  return {
    totalTime: elapsed,
    avgTime: elapsed / iterations,
    opsPerSec: (1000 * iterations) / elapsed,
    iterations
  };
}

// ============================================================
// Main Benchmark Function
// ============================================================

async function main() {
  console.log('🚀 BitmapText.js Measurement Performance Benchmark (BUNDLED)');
  console.log(`Platform: ${process.platform}`);
  console.log(`Node version: ${process.version}`);
  console.log(`Architecture: ${process.arch}`);
  console.log('');

  // Configure BitmapText
  // path module already imported at top of file
  const fontDirectory = path.resolve(__dirname, '../../../font-assets/');

  BitmapText.configure({
    fontDirectory: fontDirectory,
    canvasFactory: () => new Canvas()
  });

  // Create font properties
  const fontProperties = new FontProperties(1, 'Arial', 'normal', 'normal', 19);

  // Load font
  console.log('⏳ Loading font...');
  const loadStart = performance.now();
  await BitmapText.loadFont(fontProperties.idString);
  const loadTime = performance.now() - loadStart;
  console.log(`✅ Font loaded in ${loadTime.toFixed(2)}ms`);
  console.log('');

  const results = {
    version: 'bundled',
    platform: {
      os: process.platform,
      nodeVersion: process.version,
      arch: process.arch
    },
    timestamp: new Date().toISOString(),
    fontLoading: {
      loadTime,
      fontId: fontProperties.idString
    },
    tests: []
  };

  const textPropsKerning = new TextProperties({ isKerningEnabled: true });
  const textPropsNoKerning = new TextProperties({ isKerningEnabled: false });

  // Test 1: Text Length Scaling
  console.log('📊 Test 1/3: Text length scaling');
  const lengths = [5, 10, 25, 50, 100, 250, 500];

  lengths.forEach(length => {
    const text = TEST_LONG_LINE.substring(0, length);
    const result = measurePerformance(() => {
      BitmapText.measureText(text, fontProperties, textPropsKerning);
    });

    console.log(`   ${length} chars: ${(result.avgTime * 1000).toFixed(3)}μs avg, ${result.opsPerSec.toFixed(0)} ops/sec`);

    results.tests.push({
      category: 'Text Length Scaling',
      test: `${length} characters`,
      textLength: length,
      ...result
    });
  });
  console.log('');

  // Test 2: Kerning Overhead
  console.log('📊 Test 2/3: Kerning overhead');
  const testText = TEST_LONG_LINE.substring(0, 50);

  const kerningOn = measurePerformance(() => {
    BitmapText.measureText(testText, fontProperties, textPropsKerning);
  });

  const kerningOff = measurePerformance(() => {
    BitmapText.measureText(testText, fontProperties, textPropsNoKerning);
  });

  const overhead = ((kerningOn.avgTime - kerningOff.avgTime) / kerningOff.avgTime * 100).toFixed(1);

  console.log(`   Kerning ON:  ${(kerningOn.avgTime * 1000).toFixed(3)}μs avg`);
  console.log(`   Kerning OFF: ${(kerningOff.avgTime * 1000).toFixed(3)}μs avg`);
  console.log(`   Overhead: ${overhead}%`);
  console.log('');

  results.tests.push({
    category: 'Kerning Overhead',
    test: 'Kerning ON',
    textLength: 50,
    ...kerningOn
  });

  results.tests.push({
    category: 'Kerning Overhead',
    test: 'Kerning OFF',
    textLength: 50,
    ...kerningOff
  });

  // Test 3: Repeated Measurements (60fps pattern)
  console.log('📊 Test 3/3: Repeated measurements (60fps pattern)');
  const repeatText = "Hello World";

  const repeated60x = measurePerformance(() => {
    for (let i = 0; i < 60; i++) {
      BitmapText.measureText(repeatText, fontProperties, textPropsKerning);
    }
  }, 1000);  // Lower outer iterations since we're doing 60 inside

  const perFrame = repeated60x.avgTime;
  const perMeasurement = repeated60x.avgTime / 60;

  console.log(`   Per frame (60 measurements): ${perFrame.toFixed(3)}ms`);
  console.log(`   Per measurement: ${(perMeasurement * 1000).toFixed(3)}μs`);
  console.log(`   Frames per second: ${(1000 / perFrame).toFixed(1)} fps`);
  console.log('');

  results.tests.push({
    category: 'Repeated Measurements',
    test: '60 measurements per frame',
    textLength: repeatText.length,
    totalTime: repeated60x.totalTime,
    avgTime: repeated60x.avgTime,
    opsPerSec: repeated60x.opsPerSec / 60,  // Per batch
    iterations: repeated60x.iterations,
    perMeasurement: perMeasurement,
    framesPerSecond: 1000 / perFrame
  });

  // Output JSON to stdout
  console.log('JSON_RESULTS_START');
  console.log(JSON.stringify(results, null, 2));
  console.log('JSON_RESULTS_END');

  console.log('✅ Benchmark complete');
}

// Run main function
main().catch(error => {
  console.error('❌ Benchmark error:', error);
  process.exit(1);
});
