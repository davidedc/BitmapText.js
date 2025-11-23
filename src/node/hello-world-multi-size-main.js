// MAIN EXECUTION - Node.js Hello World Multi-Size Demo

// Node.js modules
// Check if modules are already available (for bundle context) before requiring
if (typeof fs === 'undefined') {
  var fs = require('fs');
}
if (typeof path === 'undefined') {
  var path = require('path');
}

// Font sizes to demonstrate
const fontSizes = [18, 18.5, 19];

// Create font properties for each size using FontProperties class
// Node.js pixel density: Use 1.0 for standard rendering, 2.0+ for HiDPI pre-rendering
// See README.md "Node.js Pixel Density" section for details
const fontPropertiesArray = fontSizes.map(size =>
  new FontProperties(1, "Arial", "normal", "normal", size) // pixelDensity, fontFamily, fontStyle, fontWeight, fontSize
);

// Text properties for rendering configuration
const textProperties = new TextProperties({
  isKerningEnabled: true,      // Enable kerning for better text rendering
  textBaseline: 'bottom',      // BitmapText uses bottom baseline positioning
  textAlign: 'left',           // Standard left alignment
  textColor: '#000000'         // Black color
});

// Function to create IDString from FontProperties (uses pre-computed idString)
function createIDString(fontProperties) {
  return fontProperties.idString;
}

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
    console.log('BitmapText.js Node.js Multi-Size Demo - Loading font data...');

    // Configure BitmapText for Node.js environment
    console.log('Configuring BitmapText for Node.js...');
    BitmapText.configure({
      fontDirectory: './font-assets/',
      canvasFactory: () => new Canvas()
    });

    // Create IDStrings for all font configurations (Arial + BitmapTextInvariant for automatic font-invariant character fallback)
    const arialIDStrings = fontPropertiesArray.map(createIDString);

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

    // Wait for all fonts to load
    await BitmapText.loadFonts(allIDStrings, {
      onProgress: (loaded, total) => console.log(`Loading progress: ${loaded}/${total}`)
    });

    console.log('All fonts loaded successfully');

    // Check which fonts loaded successfully (for reporting purposes)
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
    canvas.width = 700;  // Increased to fit both black and blue text columns
    canvas.height = 200;
    const ctx = canvas.getContext('2d');

    // White background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // IMPORTANT: Coordinates are ABSOLUTE from canvas origin (0,0)
    // BitmapText ignores context transforms

    // Render "Hello World" at each font size
    let allSuccess = true;
    let actualGlyphsDrawn = 0;

    fontPropertiesArray.forEach((fontProperties, index) => {
      const yPosition = 50 + (index * 50); // Space lines 50px apart
      const text = `Hello ☺ World (size ${fontProperties.fontSize}) ✔`;

      console.log(`Rendering "${text}" at y=${yPosition}`);

      const result = BitmapText.drawTextFromAtlas(
        ctx,
        text,
        20,  // x position in CSS pixels (absolute from origin)
        yPosition,  // y position in CSS pixels (absolute from origin)
        fontProperties,
        textProperties  // text rendering properties including color and kerning
      );

      // Log detailed rendering results for each size
      console.log(`  Result for size ${fontProperties.fontSize}:`, {
        rendered: result.rendered,
        statusCode: result.status.code,
        statusName: getStatusName(result.status.code),
        placeholdersUsed: result.status.placeholdersUsed,
        missingChars: result.status.missingChars ? [...result.status.missingChars].join('') : 'none',
        missingAtlasChars: result.status.missingAtlasChars ? [...result.status.missingAtlasChars].join('') : 'none'
      });

      if (result.rendered && result.status.code === StatusCode.SUCCESS) {
        actualGlyphsDrawn++;
      } else {
        allSuccess = false;
      }
    });

    console.log(`Multi-size rendering complete: ${actualGlyphsDrawn}/${fontSizes.length} sizes rendered with actual glyphs`);
    if (allSuccess) {
      console.log('✅ All sizes rendered successfully with actual glyphs!');
    } else {
      console.log('⚠️ Some sizes used placeholders or failed to render');
    }

    // Render blue text column to demonstrate colored slow path
    console.log('\nRendering blue text column (colored slow path)...');
    const blueTextProperties = new TextProperties({
      isKerningEnabled: true,
      textBaseline: 'bottom',
      textAlign: 'left',
      textColor: '#0000FF'  // Blue color
    });

    let blueSuccess = true;
    let blueGlyphsDrawn = 0;

    fontPropertiesArray.forEach((fontProperties, index) => {
      const yPosition = 50 + (index * 50); // Same y positions as black text
      const text = `Hello ☺ World (size ${fontProperties.fontSize}) ✔`;

      console.log(`Rendering blue "${text}" at x=220, y=${yPosition}`);

      const blueResult = BitmapText.drawTextFromAtlas(
        ctx,
        text,
        220,  // x position in CSS pixels (right column)
        yPosition,  // y position in CSS pixels
        fontProperties,
        blueTextProperties
      );

      console.log(`  Blue result for size ${fontProperties.fontSize}:`, {
        rendered: blueResult.rendered,
        statusCode: blueResult.status.code,
        statusName: getStatusName(blueResult.status.code)
      });

      if (blueResult.rendered && blueResult.status.code === StatusCode.SUCCESS) {
        blueGlyphsDrawn++;
      } else {
        blueSuccess = false;
      }
    });

    console.log(`Blue text rendering complete: ${blueGlyphsDrawn}/${fontSizes.length} sizes rendered`);
    if (blueSuccess) {
      console.log('✅ All blue text rendered successfully!');
    }

    // Export to PNG
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
    const outputPath = path.resolve(process.cwd(), 'hello-world-multi-size-output.png');
    fs.writeFileSync(outputPath, Buffer.from(pngBuffer));
    
    console.log(`\nSuccess! 🎉`);
    console.log(`Generated: ${outputPath}`);
    console.log(`Canvas size: ${canvas.width}x${canvas.height}`);
    console.log(`File size: ${fs.statSync(outputPath).size} bytes`);
    console.log(`\nThe PNG contains "Hello World" in two columns:`);
    console.log(`  - Left column (x=20): Black text (fast path) at ${fontSizes.join(', ')} sizes`);
    console.log(`  - Right column (x=220): Blue text (colored slow path) at ${fontSizes.join(', ')} sizes`);
    console.log(`Note: Sizes with missing atlas JS files will show placeholder rectangles.`);

  } catch (error) {
    console.error('Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure you run this from the project root directory');
    console.error('2. Ensure font metrics exist for all sizes:', fontSizes.map(s => `metrics-density-1-0-Arial-style-normal-weight-normal-size-${s.toString().replace('.', '-')}${s.toString().includes('.') ? '' : '-0'}.js`).join(', '));
    console.error('3. Atlas JS files are optional - missing ones will show placeholder rectangles');
    console.error('4. Build font assets using public/font-assets-builder.html if needed');
    process.exit(1);
  }
}

// Run the demo
if (require.main === module) {
  main();
}