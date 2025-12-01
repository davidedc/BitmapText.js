// MAIN EXECUTION - Node.js Small Font Sizes Demo

// Node.js modules
// Check if modules are already available (for bundle context) before requiring
if (typeof fs === 'undefined') {
  var fs = require('fs');
}
if (typeof path === 'undefined') {
  var path = require('path');
}

// Test sizes: all small sizes that will use interpolation, plus 8.5px base
const testSizes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 8.4, 8.5];

// Load only 8.5px - all smaller sizes will interpolate from this
const fontProps8_5 = new FontProperties(1, "Arial", "normal", "normal", 8.5);

// Text properties for rendering configuration
const textProperties = new TextProperties({
  isKerningEnabled: true,      // Enable kerning for better text rendering
  textBaseline: 'bottom',      // BitmapText uses bottom baseline positioning
  textAlign: 'left',           // Standard left alignment
  textColor: '#000000'         // Black color
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
    console.log('BitmapText.js Node.js Small Sizes Demo');
    console.log('=======================================\n');

    // Configure BitmapText for Node.js environment
    console.log('Configuring BitmapText for Node.js...');
    // When built, this file is in examples/node/dist/, so go up 3 levels to project root
    BitmapText.configure({
      fontDirectory: path.resolve(__dirname, '../../../font-assets/'),
      canvasFactory: () => new Canvas()
    });

    // Load only size 8.5px - all smaller sizes will interpolate from this (Arial + BitmapTextInvariant for automatic font-invariant character fallback)
    const arialIDString = fontProps8_5.idString;
    const symbolsIDString = 'density-1-0-BitmapTextInvariant-style-normal-weight-normal-size-8-5';
    console.log(`Loading size 8.5px fonts: ${arialIDString} + ${symbolsIDString}...`);

    await BitmapText.loadFonts([arialIDString, symbolsIDString], {
      onProgress: (loaded, total) => console.log(`Loading progress: ${loaded}/${total}`)
    });

    console.log('✅ Size 8.5px loaded successfully\n');

    // Verify font loaded
    const hasMetrics = BitmapText.hasMetrics(fontProps8_5.idString);
    const hasAtlas = BitmapText.hasAtlas(fontProps8_5.idString);

    if (hasMetrics && hasAtlas) {
      console.log('Font size 8.5px: ready with full atlas');
    } else if (hasMetrics) {
      console.log('Font size 8.5px: ready with placeholder mode (no atlas)');
    } else {
      throw new Error('Font size 8.5px: no metrics available');
    }

    // Create output canvas (large enough for both sections)
    console.log('\nCreating canvas...');
    const canvas = new Canvas();
    canvas.width = 800;
    canvas.height = 1100;  // Enough for two sections of 11 sizes each
    const ctx = canvas.getContext('2d');

    // White background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // SECTION 1: Visual rendering of small sizes
    console.log('\n=== Section 1: Visual Rendering ===\n');

    const testText = "The quick brown 😊 fox jumps over the lazy dog. ✔";
    let yPos = 40;
    let renderedCount = 0;

    testSizes.forEach(size => {
      const fontProps = new FontProperties(1, "Arial", "normal", "normal", size);

      const result = BitmapText.drawTextFromAtlas(
        ctx,
        testText,
        120,  // x position for text (leaving space for labels in console)
        yPos + 10,
        fontProps,
        textProperties
      );

      // Console annotation: size label and status
      if (result.rendered) {
        if (size === 8.5) {
          console.log(`Size ${size}px: ✅ Rendered from atlas`);
        } else {
          const statusInfo = result.status.placeholdersUsed ? '(interpolated, placeholders)' : '(interpolated)';
          console.log(`Size ${size}px: ✅ Rendered ${statusInfo}`);
        }
        renderedCount++;
      } else {
        console.log(`Size ${size}px: ❌ Failed - ${getStatusName(result.status.code)}`);
      }

      yPos += 45;  // Same spacing as HTML demo
    });

    console.log(`\nSection 1 complete: ${renderedCount}/${testSizes.length} sizes rendered`);

    // SECTION 2: Measurements with boxes
    console.log('\n=== Section 2: Measurements ===\n');

    yPos = 40 + (testSizes.length * 45) + 40;  // Start after section 1 plus gap
    let measurementCount = 0;

    testSizes.forEach(size => {
      const fontProps = new FontProperties(1, "Arial", "normal", "normal", size);

      // Measure text
      const measureResult = BitmapText.measureText(testText, fontProps, textProperties);

      if (measureResult.status.code === StatusCode.SUCCESS) {
        const metrics = measureResult.metrics;

        // Draw the text
        const xPos = 120;
        const result = BitmapText.drawTextFromAtlas(
          ctx,
          testText,
          xPos,
          yPos + 10,
          fontProps,
          textProperties
        );

        // Draw measurement box (blue stroke)
        ctx.strokeStyle = '#2196F3';
        ctx.lineWidth = 1;
        ctx.strokeRect(
          xPos,
          yPos + 10 - metrics.fontBoundingBoxAscent,
          metrics.width,
          metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent
        );

        // Console annotation: measurements on one line
        console.log(`Size ${size}px: width: ${metrics.width.toFixed(2)}px  ascent: ${metrics.fontBoundingBoxAscent.toFixed(2)}px  descent: ${metrics.fontBoundingBoxDescent.toFixed(2)}px`);

        measurementCount++;
      } else {
        console.log(`Size ${size}px: ❌ Measurement failed - ${getStatusName(measureResult.status.code)}`);
      }

      yPos += 45;
    });

    console.log(`\nSection 2 complete: ${measurementCount}/${testSizes.length} measurements`);

    // Export to PNG
    console.log('\n=== Exporting PNG ===\n');
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
    const outputPath = path.resolve(process.cwd(), 'small-sizes-output.png');
    fs.writeFileSync(outputPath, Buffer.from(pngBuffer));

    console.log('\n✅ Success! 🎉\n');
    console.log(`Generated: ${outputPath}`);
    console.log(`Canvas size: ${canvas.width}x${canvas.height}`);
    console.log(`File size: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);
    console.log('\nThe PNG contains two sections:');
    console.log('  - Section 1: Visual rendering of sizes 0px through 8.5px (placeholder rectangles)');
    console.log('  - Section 2: Same sizes with blue measurement boxes showing bounding boxes');
    console.log('\nKey features:');
    console.log('  ✓ Only size 8.5px metrics loaded (all smaller sizes interpolate)');
    console.log('  ✓ Sizes < 8.5px use interpolated metrics and render as placeholders');
    console.log('  ✓ Measurements work correctly with scaled metrics');
    console.log('  ✓ No atlas needed for small sizes (placeholder mode always used)');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure you run this from the project root directory');
    console.error('2. Ensure font metrics exist for size 8.5px: metrics-density-1-0-Arial-style-normal-weight-normal-size-8-5.js');
    console.error('3. Atlas JS file is optional - missing atlas will show placeholder rectangles');
    console.error('4. Build font assets using public/font-assets-builder.html if needed');
    console.error('\nStack trace:');
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the demo
if (require.main === module) {
  main();
}
