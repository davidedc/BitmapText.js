// MAIN EXECUTION - Node.js Hello World Demo

// Node.js modules
const fs = require('fs');
const path = require('path');

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
    [StatusCode.PARTIAL_SUCCESS]: 'PARTIAL_SUCCESS',
    [StatusCode.FAILURE]: 'FAILURE'
  };
  return statusNames[code] || `UNKNOWN(${code})`;
}

function main() {
  try {
    console.log('BitmapText.js Node.js Demo - Loading font data...');

    // Setup BitmapText system FIRST (so stores are available)
    console.log('Setting up BitmapText system...');
    const atlasDataStore = new AtlasDataStore();
    const fontMetricsStore = new FontMetricsStore();
    const bitmapText = new BitmapText(atlasDataStore, fontMetricsStore, () => new Canvas());

    // Load and execute font metrics (will auto-install to store)
    const fontMetricsPath = path.resolve(__dirname, 'font-assets/metrics-density-1-0-Arial-style-normal-weight-normal-size-19-0.js');
    if (!fs.existsSync(fontMetricsPath)) {
      throw new Error(`Font metrics file not found: ${fontMetricsPath}`);
    }
    const fontMetricsCode = fs.readFileSync(fontMetricsPath, 'utf8');
    eval(fontMetricsCode);

    console.log('Font metrics loaded successfully');
    
    // Load atlas from JS file containing base64-encoded QOI data AND positioning data
    const atlasJSPath = path.resolve(__dirname, 'font-assets/atlas-density-1-0-Arial-style-normal-weight-normal-size-19-0-qoi.js');
    if (!fs.existsSync(atlasJSPath)) {
      throw new Error(`Atlas JS file not found: ${atlasJSPath}`);
    }

    console.log('Loading atlas from JS file...');

    // Load FontLoader to make registerTempAtlasData available
    // Check if FontLoader is already available (bundled mode) or needs to be required (standalone mode)
    let FontLoader;
    if (typeof global !== 'undefined' && global.FontLoader) {
      FontLoader = global.FontLoader;
    } else {
      FontLoader = require('./font-loader-node.js');
    }

    // Execute the atlas JS file (which calls FontLoader.registerTempAtlasData and stores positioning)
    const atlasJSCode = fs.readFileSync(atlasJSPath, 'utf8');
    eval(atlasJSCode);

    // Get the IDString for this font configuration
    const expectedIDString = fontProperties.idString;

    // Retrieve the base64 data
    const base64Data = FontLoader.getTempAtlasData(expectedIDString);
    if (!base64Data) {
      throw new Error(`Atlas data not found for ${expectedIDString}`);
    }

    console.log('Converting base64 to QOI buffer...');
    const qoiBuffer = FontLoader.base64ToBuffer(base64Data);
    const qoiData = QOIDecode(qoiBuffer.buffer, 0, null, 4); // Force RGBA output

    if (qoiData.error) {
      throw new Error('Failed to decode QOI data from base64');
    }

    console.log(`QOI decoded: ${qoiData.width}x${qoiData.height}, ${qoiData.channels} channels`);

    // Create Image from QOI data
    const atlasImage = new Image(qoiData.width, qoiData.height, new Uint8ClampedArray(qoiData.data));

    // Get positioning data and create AtlasData object
    const positioningData = FontLoader._tempAtlasPositioning[expectedIDString];
    let atlasData;

    if (positioningData) {
      // Expand positioning data and create AtlasData object
      const atlasPositioning = AtlasDataExpander.expand(positioningData);
      atlasData = new AtlasData(new AtlasImage(atlasImage), atlasPositioning);
    } else {
      // Fallback to raw image if no positioning data
      console.warn('No positioning data found, using raw image');
      atlasData = atlasImage;
    }

    // Set atlas in store
    atlasDataStore.setAtlasData(fontProperties, atlasData);
    
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
    const result = bitmapText.drawTextFromAtlas(
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