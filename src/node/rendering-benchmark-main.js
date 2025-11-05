#!/usr/bin/env node

/**
 * BitmapText.js Performance Benchmark (Unbundled Version)
 *
 * Tests BitmapText rendering performance with adaptive timing.
 * This is the unbundled standalone version - all dependencies concatenated.
 *
 * Usage: node rendering-benchmark-unbundled.bundle.js
 * Output: JSON results file
 */

// ============================================================
// Performance Measurement Functions
// ============================================================

/**
 * Measure execution time with adaptive iteration count
 */
function measureTime(fn, minDuration = 100) {
  let iterations = 1;
  let duration = 0;

  // Find appropriate iteration count
  while (duration < minDuration && iterations < 10000) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      fn();
    }
    duration = performance.now() - start;

    if (duration < minDuration) {
      iterations *= 10;
    }
  }

  // Perform final measurement
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const totalTime = performance.now() - start;
  const avgTime = totalTime / iterations;

  return {
    iterations,
    totalTime,
    avgTime,
    opsPerSecond: 1000 / avgTime
  };
}

/**
 * Test BitmapText rendering
 */
function testBitmapText(blockCount, textColor) {
  return () => {
    const canvas = new Canvas();
    canvas.width = 1200;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');

    // Clear canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Create properties
    const fontProperties = new FontProperties(1, 'Arial', 'normal', 'normal', 19);
    const textProperties = new TextProperties({
      textColor: textColor,
      textBaseline: 'top',
      textAlign: 'left',
      kerning: true
    });

    // Render blocks
    let yOffset = 10;
    const lineHeight = 25;
    const blockHeight = TEST_BLOCK_5_LINES.length * lineHeight;

    for (let i = 0; i < blockCount; i++) {
      TEST_BLOCK_5_LINES.forEach((line, lineIndex) => {
        const y = yOffset + (lineIndex * lineHeight);
        BitmapText.drawTextFromAtlas(ctx, line, 10, y, fontProperties, textProperties);
      });

      yOffset += blockHeight + 10;

      if (yOffset > canvas.height - blockHeight) {
        yOffset = 10;
      }
    }
  };
}

// ============================================================
// Main Benchmark Function
// ============================================================

async function main() {
  console.log('🚀 BitmapText.js Performance Benchmark (UNBUNDLED)');
  console.log(`Platform: ${process.platform}`);
  console.log(`Node version: ${process.version}`);
  console.log(`Architecture: ${process.arch}`);
  console.log('');

  // Configure BitmapText
  // Use path module (available in Node.js built-ins)
  const path = require('path');
  // When built, this file is in perf/node/dist/, so go up 3 levels to project root
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
    version: 'unbundled',
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

  // Test cases
  const testCases = [
    { name: 'Single block (black)', color: '#000000', blockCount: 1 },
    { name: 'Single block (colored)', color: '#0000FF', blockCount: 1 },
    { name: '10 blocks (black)', color: '#000000', blockCount: 10 },
    { name: '10 blocks (colored)', color: '#0000FF', blockCount: 10 },
    { name: '50 blocks (black)', color: '#000000', blockCount: 50 },
    { name: '50 blocks (colored)', color: '#0000FF', blockCount: 50 }
  ];

  for (const testCase of testCases) {
    console.log(`📊 Testing: ${testCase.name}`);

    const result = measureTime(
      testBitmapText(testCase.blockCount, testCase.color),
      100 // minimum 100ms test duration
    );

    console.log(`   Iterations: ${result.iterations}`);
    console.log(`   Average time: ${result.avgTime.toFixed(3)}ms`);
    console.log(`   Operations/sec: ${result.opsPerSecond.toFixed(0)}`);
    console.log('');

    results.tests.push({
      name: testCase.name,
      color: testCase.color,
      blockCount: testCase.blockCount,
      ...result
    });
  }

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
