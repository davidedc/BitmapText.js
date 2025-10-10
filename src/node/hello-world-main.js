// MAIN EXECUTION - Node.js Hello World Demo

// Node.js modules
// Check if modules are already available (for bundle context) before requiring
if (typeof fs === 'undefined') {
  var fs = require('fs');
}
if (typeof path === 'undefined') {
  var path = require('path');
}

// Font properties for Arial normal normal 19 with pixel density 1
const fontProperties = new FontProperties(1, "Arial", "normal", "normal", 19); // pixelDensity, fontFamily, fontStyle, fontWeight, fontSize

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
    console.log('BitmapText.js Node.js Demo - Loading font data...');

    // Configure BitmapText for Node.js environment
    console.log('Configuring BitmapText for Node.js...');
    BitmapText.configure({
      dataDir: './font-assets/',
      canvasFactory: () => new Canvas()
    });

    // Load font using static API
    const expectedIDString = fontProperties.idString;
    console.log(`Loading font: ${expectedIDString}...`);

    // Wait for font loading to complete
    await BitmapText.loadFont(expectedIDString, {
      onProgress: (loaded, total) => console.log(`Loading progress: ${loaded}/${total}`)
    });

    console.log('Font loaded successfully');
    
    // Create output canvas
    console.log('Creating canvas and rendering...');
    const canvas = new Canvas();
    canvas.width = 300;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    
    // White background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 300, 100);
    
    // Render "Hello World" using bitmap text - API returns status info
    const result = BitmapText.drawTextFromAtlas(
      ctx,
      "Hello World",
      10,  // x position
      50,  // y position
      fontProperties,
      textProperties  // text rendering properties including color and kerning
    );

    // Log detailed rendering results
    console.log('DrawText result:', {
      rendered: result.rendered,
      statusCode: result.status.code,
      statusName: getStatusName(result.status.code),
      placeholdersUsed: result.status.placeholdersUsed,
      missingChars: result.status.missingChars ? [...result.status.missingChars].join('') : 'none',
      missingAtlasChars: result.status.missingAtlasChars ? [...result.status.missingAtlasChars].join('') : 'none'
    });

    if (result.rendered) {
      if (result.status.code === StatusCode.SUCCESS) {
        console.log('✅ Text rendered successfully with actual glyphs!');
      } else {
        console.log('⚠️ Text rendered with issues (may show placeholders)');
        if (result.status.placeholdersUsed) {
          console.log('📦 Some glyphs rendered as placeholder rectangles');
        }
      }
    } else {
      console.log('❌ Text rendering failed completely');
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
    const outputPath = path.resolve(process.cwd(), 'hello-world-output.png');
    fs.writeFileSync(outputPath, Buffer.from(pngBuffer));
    
    console.log(`\nSuccess! 🎉`);
    console.log(`Generated: ${outputPath}`);
    console.log(`Canvas size: ${canvas.width}x${canvas.height}`);
    console.log(`File size: ${fs.statSync(outputPath).size} bytes`);
    console.log(`\nThe PNG contains "Hello World" rendered using bitmap fonts from QOI data.`);
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure you run this from the project root directory');
    console.error('2. Ensure font data exists: font-assets/metrics-density-1-0-Arial-style-normal-weight-normal-size-19-0.js and font-assets/atlas-density-1-0-Arial-style-normal-weight-normal-size-19-0-qoi.js');
    console.error('3. Build font assets using public/font-assets-builder.html if needed');
    process.exit(1);
  }
}

// Run the demo
if (require.main === module) {
  main();
}