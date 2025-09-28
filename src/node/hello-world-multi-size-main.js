// MAIN EXECUTION - Node.js Hello World Multi-Size Demo

// Node.js modules
const fs = require('fs');
const path = require('path');

// Font sizes to demonstrate
const fontSizes = [18, 18.5, 19];

// Create font properties for each size using FontProperties class
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
    [StatusCode.PARTIAL_SUCCESS]: 'PARTIAL_SUCCESS',
    [StatusCode.FAILURE]: 'FAILURE'
  };
  return statusNames[code] || `UNKNOWN(${code})`;
}

function main() {
  try {
    console.log('BitmapText.js Node.js Multi-Size Demo - Loading font data...');

    // Setup BitmapText system FIRST (so stores are available)
    console.log('Setting up BitmapText system...');
    const atlasStore = new AtlasStore();
    const fontMetricsStore = new FontMetricsStore();
    const bitmapText = new BitmapText(atlasStore, fontMetricsStore, () => new Canvas());

    // Create IDStrings for all font configurations
    const IDStrings = fontPropertiesArray.map(createIDString);
    console.log('Font sizes:', fontSizes);
    console.log('IDStrings:', IDStrings);

    // Load metrics for all font sizes (will auto-install to store)
    for (let i = 0; i < fontSizes.length; i++) {
      const fontSize = fontSizes[i];
      const IDString = IDStrings[i];

      console.log(`Loading metrics for size ${fontSize}...`);

      // Load font metrics (JS file) - will auto-install to fontMetricsStore
      const fontMetricsPath = path.resolve(__dirname, `font-assets/metrics-${IDString}.js`);
      if (!fs.existsSync(fontMetricsPath)) {
        throw new Error(`Font metrics file not found: ${fontMetricsPath}`);
      }

      // Execute the font metrics JS file (will populate store directly)
      const fontMetricsCode = fs.readFileSync(fontMetricsPath, 'utf8');
      eval(fontMetricsCode);
      console.log(`✓ Metrics loaded for size ${fontSize}`);
    }
    
    // Load FontLoader to make registerTempAtlasData available
    // Check if FontLoader is already available (bundled mode) or needs to be required (standalone mode)
    let FontLoader;
    if (typeof global !== 'undefined' && global.FontLoader) {
      FontLoader = global.FontLoader;
    } else {
      FontLoader = require('./font-loader-node.js');
    }

    // Load atlases from JS files containing base64-encoded QOI data
    const atlasMap = new Map();

    for (let i = 0; i < fontSizes.length; i++) {
      const fontSize = fontSizes[i];
      const IDString = IDStrings[i];
      const fontProperties = fontPropertiesArray[i];

      console.log(`Loading atlas from JS file for size ${fontSize}...`);

      // Load atlas from JS file
      const atlasJSPath = path.resolve(__dirname, `font-assets/atlas-${IDString}-qoi.js`);

      if (fs.existsSync(atlasJSPath)) {
        try {
          console.log(`  ↳ Loading: ${path.basename(atlasJSPath)}`);

          // Execute the atlas JS file (which calls FontLoader.registerTempAtlasData)
          const atlasJSCode = fs.readFileSync(atlasJSPath, 'utf8');
          eval(atlasJSCode);

          // Get the IDString for this font configuration
          const expectedIDString = fontProperties.idString;

          // Retrieve the base64 data
          const base64Data = FontLoader.getTempAtlasData(expectedIDString);
          if (!base64Data) {
            console.warn(`  ↳ Atlas data not found for ${expectedIDString}, will use placeholder rectangles`);
            atlasMap.set(fontSize, null);
            continue;
          }

          // Convert base64 to QOI buffer and decode
          const qoiBuffer = FontLoader.base64ToBuffer(base64Data);
          const qoiData = QOIDecode(qoiBuffer.buffer, 0, null, 4); // Force RGBA output

          if (qoiData.error) {
            console.warn(`  ↳ Failed to decode QOI data from base64 for size ${fontSize}, will use placeholder rectangles`);
            atlasMap.set(fontSize, null);
          } else {
            console.log(`  ↳ QOI decoded: ${qoiData.width}x${qoiData.height}, ${qoiData.channels} channels`);
            const atlasImage = new Image(qoiData.width, qoiData.height, new Uint8ClampedArray(qoiData.data));

            // Get positioning data and create AtlasData object
            const positioningData = FontLoader._tempAtlasPositioning[expectedIDString];
            let atlasData;

            if (positioningData) {
              // Expand positioning data and create AtlasData object
              const atlasPositioning = AtlasExpander.expand(positioningData);
              atlasData = new AtlasData(atlasImage, atlasPositioning);
            } else {
              // Fallback to raw image if no positioning data
              console.warn(`  ↳ No positioning data found for size ${fontSize}, using raw image`);
              atlasData = atlasImage;
            }

            atlasMap.set(fontSize, atlasData);
          }
        } catch (error) {
          console.warn(`  ↳ Failed to load atlas for size ${fontSize}: ${error.message}, will use placeholder rectangles`);
          atlasMap.set(fontSize, null);
        }
      } else {
        console.warn(`  ↳ Atlas JS file not found for size ${fontSize}, will use placeholder rectangles`);
        atlasMap.set(fontSize, null);
      }
    }
    
    // Process font atlases and populate atlas store for all sizes
    for (let i = 0; i < fontSizes.length; i++) {
      const fontSize = fontSizes[i];
      const fontProperties = fontPropertiesArray[i];
      const atlasData = atlasMap.get(fontSize);

      console.log(`Setting up atlas for size ${fontSize}...`);

      if (atlasData) {
        atlasStore.setAtlas(fontProperties, atlasData);
        console.log(`  ✓ Font size ${fontSize} ready with atlas`);
      } else {
        console.log(`  ✓ Font size ${fontSize} ready with placeholder mode (no atlas)`);
      }
    }
    
    // Create output canvas (larger to accommodate multiple text lines)
    console.log('Creating canvas and rendering...');
    const canvas = new Canvas();
    canvas.width = 400;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    
    // White background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Render "Hello World" at each font size
    let allSuccess = true;
    let actualGlyphsDrawn = 0;

    fontPropertiesArray.forEach((fontProperties, index) => {
      const yPosition = 50 + (index * 50); // Space lines 50px apart
      const text = `Hello World (size ${fontProperties.fontSize})`;

      console.log(`Rendering "${text}" at y=${yPosition}`);

      const result = bitmapText.drawTextFromAtlas(
        ctx,
        text,
        20,  // x position
        yPosition,
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
    console.log(`\nThe PNG contains "Hello World" rendered at ${fontSizes.join(', ')} sizes using bitmap fonts.`);
    console.log(`Note: Sizes with missing atlas JS files will show black placeholder rectangles.`);

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