#!/usr/bin/env node

/**
 * BitmapText.js Node.js Demo - Hello World (Using Runtime Bundle)
 *
 * This demo uses the production runtime bundle (dist/bitmaptext-node.min.js)
 * instead of bundling all source files together.
 *
 * User provides:
 *   - Canvas implementation (canvas-mock in this case)
 *   - PNG encoder (for output to filesystem)
 *
 * Library provides:
 *   - BitmapText runtime bundle (text rendering only)
 *
 * Usage:
 *   node examples/node/dist/hello-world-bundled.js
 *
 * Output:
 *   hello-world-bundled-output.png (in current directory)
 */

// ============================================================================
// USER-PROVIDED DEPENDENCIES
// ============================================================================

// Canvas implementation (user's choice: node-canvas, skia-canvas, canvas-mock, etc.)
const { Canvas } = require('../../../src/platform/canvas-mock.js');

// PNG encoder (optional, for file output - not part of core library)
const { PngEncoder } = require('../../../lib/PngEncoder.js');
const { PngEncodingOptions } = require('../../../lib/PngEncodingOptions.js');

// Node.js built-in modules
const fs = require('fs');
const path = require('path');

// ============================================================================
// LIBRARY RUNTIME BUNDLE (Production)
// ============================================================================

// Import BitmapText runtime bundle (contains all rendering classes)
require('../../../dist/bitmaptext-node.min.js');

// ============================================================================
// DEMO LOGIC
// ============================================================================

// Font properties for Arial normal normal 19 with pixel density 1
const fontProperties = new FontProperties(1, "Arial", "normal", "normal", 19);

// Text properties for rendering configuration
const textProperties = new TextProperties({
  isKerningEnabled: true,
  textBaseline: 'bottom',
  textAlign: 'left',
  textColor: '#000000'
});

// Helper function to get status name from code
function getStatusName(code) {
  const statusNames = {
    [StatusCode.SUCCESS]: 'SUCCESS',
    [StatusCode.NO_METRICS]: 'NO_METRICS',
    [StatusCode.PARTIAL_METRICS]: 'PARTIAL_METRICS',
    [StatusCode.NO_ATLAS]: 'NO_ATLAS',
    [StatusCode.PARTIAL_ATLAS]: 'PARTIAL_ATLAS'
  };
  return statusNames[code] || `UNKNOWN(${code})`;
}

async function main() {
  try {
    console.log('BitmapText.js Node.js Demo (Runtime Bundle) - Loading font data...');

    // Configure BitmapText with user-provided Canvas
    console.log('Configuring BitmapText with Canvas implementation...');
    BitmapText.configure({
      fontDirectory: './font-assets/',
      canvasFactory: () => new Canvas()
    });

    // Load fonts using static API (Arial + BitmapTextInvariant for automatic font-invariant character fallback)
    const expectedIDString = fontProperties.idString;
    const symbolsIDString = 'density-1-0-BitmapTextInvariant-style-normal-weight-normal-size-19-0';
    console.log(`Loading fonts: ${expectedIDString} + ${symbolsIDString}...`);

    await BitmapText.loadFonts([expectedIDString, symbolsIDString], {
      onProgress: (loaded, total) => console.log(`Loading progress: ${loaded}/${total}`)
    });

    console.log('Font loaded successfully');

    // Create output canvas (using user-provided Canvas)
    console.log('Creating canvas and rendering...');
    const canvas = new Canvas();
    canvas.width = 300;
    canvas.height = 120;
    const ctx = canvas.getContext('2d');

    // White background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render "Hello World" in black (fast path)
    const result = BitmapText.drawTextFromAtlas(
      ctx,
      "Hello ☺ World ✔",
      10,
      50,
      fontProperties,
      textProperties
    );

    console.log('DrawText result:', {
      rendered: result.rendered,
      statusCode: result.status.code,
      statusName: getStatusName(result.status.code),
      placeholdersUsed: result.status.placeholdersUsed
    });

    if (result.rendered && result.status.code === StatusCode.SUCCESS) {
      console.log('✅ Black text rendered successfully!');
    }

    // Render blue text (colored slow path)
    console.log('\nRendering blue text (colored slow path)...');
    const blueTextProperties = new TextProperties({
      isKerningEnabled: true,
      textBaseline: 'bottom',
      textAlign: 'left',
      textColor: '#0000FF'
    });

    const blueResult = BitmapText.drawTextFromAtlas(
      ctx,
      "Hello ☺ World ✔",
      10,
      80,
      fontProperties,
      blueTextProperties
    );

    if (blueResult.rendered && blueResult.status.code === StatusCode.SUCCESS) {
      console.log('✅ Blue text rendered successfully!');
    }

    // Export to PNG (using user-provided PNG encoder)
    console.log('Encoding PNG...');
    const surface = {
      width: canvas.width,
      height: canvas.height,
      data: canvas.data
    };

    if (!PngEncoder.canEncode(surface)) {
      throw new Error('Surface cannot be encoded to PNG');
    }

    const pngBuffer = PngEncoder.encode(surface, PngEncodingOptions.DEFAULT);

    // Write PNG file
    const outputPath = path.resolve(process.cwd(), 'hello-world-bundled-output.png');
    fs.writeFileSync(outputPath, Buffer.from(pngBuffer));

    console.log(`\nSuccess! 🎉`);
    console.log(`Generated: ${outputPath}`);
    console.log(`Canvas size: ${canvas.width}x${canvas.height}`);
    console.log(`File size: ${fs.statSync(outputPath).size} bytes`);
    console.log(`\nBundle info:`);
    console.log(`  - Runtime bundle: dist/bitmaptext-node.min.js (~33KB)`);
    console.log(`  - User provides: Canvas + PNG encoder`);
    console.log(`  - Clean separation: Rendering (library) vs I/O (demo)`);

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure you run this from the project root directory');
    console.error('2. Ensure runtime bundle exists: dist/bitmaptext-node.min.js');
    console.error('3. Ensure font data exists in font-assets/ directory');
    process.exit(1);
  }
}

// Run the demo
if (require.main === module) {
  main();
}
