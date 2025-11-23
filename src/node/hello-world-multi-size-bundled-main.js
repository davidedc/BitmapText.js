#!/usr/bin/env node

/**
 * BitmapText.js Node.js Demo - Hello World Multi-Size (Using Runtime Bundle)
 *
 * This demo uses the production runtime bundle (dist/bitmaptext-node.min.js)
 * to render text at three different font sizes (18, 18.5, 19).
 *
 * User provides:
 *   - Canvas implementation (canvas-mock in this case)
 *   - PNG encoder (for output to filesystem)
 *
 * Library provides:
 *   - BitmapText runtime bundle (text rendering only)
 *
 * Usage:
 *   node examples/node/dist/hello-world-multi-size-bundled.js
 *
 * Output:
 *   hello-world-multi-size-bundled-output.png (in current directory)
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

// Font sizes to demonstrate
const fontSizes = [18, 18.5, 19];

// Create font properties for each size
const fontPropertiesArray = fontSizes.map(size =>
  new FontProperties(1, "Arial", "normal", "normal", size)
);

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
    console.log('BitmapText.js Node.js Multi-Size Demo (Runtime Bundle) - Loading font data...');

    // Configure BitmapText with user-provided Canvas
    console.log('Configuring BitmapText with Canvas implementation...');
    BitmapText.configure({
      fontDirectory: './font-assets/',
      canvasFactory: () => new Canvas()
    });

    // Create IDStrings for all font configurations (Arial + BitmapTextInvariant for automatic font-invariant character fallback)
    const arialIDStrings = fontPropertiesArray.map(fp => fp.idString);

    // Create BitmapTextInvariant IDStrings for each size
    const symbolIDStrings = fontSizes.map(size => {
      const normalizedSize = size.toString().replace('.', '-') + (size.toString().includes('.') ? '' : '-0');
      return `density-1-0-BitmapTextInvariant-style-normal-weight-normal-size-${normalizedSize}`;
    });

    // Combine Arial and BitmapTextInvariant fonts
    const allIDStrings = [...arialIDStrings, ...symbolIDStrings];

    console.log('Font sizes:', fontSizes);
    console.log('Arial IDStrings:', arialIDStrings);
    console.log('Symbol IDStrings:', symbolIDStrings);

    // Load all fonts using static API (3 Arial + 3 BitmapTextInvariant = 6 fonts)
    console.log(`Loading ${allIDStrings.length} fonts (${fontSizes.length} Arial + ${fontSizes.length} BitmapTextInvariant)...`);

    await BitmapText.loadFonts(allIDStrings, {
      onProgress: (loaded, total) => console.log(`Loading progress: ${loaded}/${total}`)
    });

    console.log('All fonts loaded successfully');

    // Check which fonts loaded successfully
    console.log('\nFont loading summary:');
    for (let i = 0; i < fontSizes.length; i++) {
      const fontSize = fontSizes[i];
      const idString = arialIDStrings[i];

      const hasMetrics = BitmapText.hasMetrics(idString);
      const hasAtlas = BitmapText.hasAtlas(idString);

      if (hasMetrics && hasAtlas) {
        console.log(`  ✓ Font size ${fontSize}: ready with full atlas`);
      } else if (hasMetrics) {
        console.log(`  ✓ Font size ${fontSize}: ready with placeholder mode (no atlas)`);
      } else {
        console.log(`  ✗ Font size ${fontSize}: no metrics available`);
      }
    }

    // Create output canvas (larger to accommodate multiple text lines and columns)
    console.log('Creating canvas and rendering...');
    const canvas = new Canvas();
    canvas.width = 700;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');

    // White background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Track overall rendering status
    let allSuccessful = true;

    // Column 1: Black text (fast path)
    console.log('\n=== Column 1: Black text (fast path) ===');
    for (let i = 0; i < fontPropertiesArray.length; i++) {
      const fontProps = fontPropertiesArray[i];
      const yPosition = 50 + (i * 50);
      const text = `Hello ☺ World (size ${fontProps.fontSize}) ✔`;

      const result = BitmapText.drawTextFromAtlas(
        ctx,
        text,
        20,
        yPosition,
        fontProps,
        textProperties
      );

      const statusName = getStatusName(result.status.code);
      if (result.rendered && result.status.code === StatusCode.SUCCESS) {
        console.log(`✅ Size ${fontProps.fontSize}: ${statusName}`);
      } else {
        console.log(`⚠️ Size ${fontProps.fontSize}: ${statusName}`);
        allSuccessful = false;
      }
    }

    // Column 2: Blue text (colored slow path)
    console.log('\n=== Column 2: Blue text (colored slow path) ===');
    const blueTextProperties = new TextProperties({
      isKerningEnabled: true,
      textBaseline: 'bottom',
      textAlign: 'left',
      textColor: '#0000FF'
    });

    for (let i = 0; i < fontPropertiesArray.length; i++) {
      const fontProps = fontPropertiesArray[i];
      const yPosition = 50 + (i * 50);
      const text = `Hello ☺ World (size ${fontProps.fontSize}) ✔`;

      const result = BitmapText.drawTextFromAtlas(
        ctx,
        text,
        360,
        yPosition,
        fontProps,
        blueTextProperties
      );

      const statusName = getStatusName(result.status.code);
      if (result.rendered && result.status.code === StatusCode.SUCCESS) {
        console.log(`✅ Size ${fontProps.fontSize}: ${statusName}`);
      } else {
        console.log(`⚠️ Size ${fontProps.fontSize}: ${statusName}`);
        allSuccessful = false;
      }
    }

    // Export to PNG
    console.log('\nEncoding PNG...');
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
    const outputPath = path.resolve(process.cwd(), 'hello-world-multi-size-bundled-output.png');
    fs.writeFileSync(outputPath, Buffer.from(pngBuffer));

    console.log(`\nSuccess! 🎉`);
    console.log(`Generated: ${outputPath}`);
    console.log(`Canvas size: ${canvas.width}x${canvas.height}`);
    console.log(`File size: ${fs.statSync(outputPath).size} bytes`);
    console.log(`Fonts rendered: ${fontSizes.join(', ')}`);
    console.log(`All successful: ${allSuccessful ? 'Yes' : 'No'}`);
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
