// MAIN EXECUTION - Node.js Hello World Demo

// Node.js modules
const fs = require('fs');
const path = require('path');

// Set global variables (required by BitmapText)
global.loadedBitmapFontData = {};
global.isKerningEnabled = true;

// Font properties for Arial normal normal 19 with pixel density 1
const fontProperties = new FontProperties(1, "Arial", "normal", "normal", 19); // pixelDensity, fontFamily, fontStyle, fontWeight, fontSize

function main() {
  try {
    console.log('BitmapText.js Node.js Demo - Loading font data...');
    
    // Load font metrics (JS file)
    const fontMetricsPath = path.resolve(__dirname, 'font-assets/metrics-density-1-0-Arial-style-normal-weight-normal-size-19-0.js');
    if (!fs.existsSync(fontMetricsPath)) {
      throw new Error(`Font metrics file not found: ${fontMetricsPath}`);
    }
    
    // Execute the font metrics JS file to populate global.loadedBitmapFontData
    const fontMetricsCode = fs.readFileSync(fontMetricsPath, 'utf8');
    eval(fontMetricsCode);
    
    const IDString = "density-1-0-Arial-style-normal-weight-normal-size-19-0";
    const fontMetricsData = global.loadedBitmapFontData[IDString];
    if (!fontMetricsData) {
      throw new Error(`Font metrics not found for ID: ${IDString}`);
    }
    
    // Check if it's already a FontMetrics instance (metrics files call MetricsExpander.expand)
    const fontMetrics = fontMetricsData instanceof FontMetrics 
      ? fontMetricsData 
      : new FontMetrics(fontMetricsData);
    
    console.log('Font metrics loaded successfully');
    
    // Load and decode QOI atlas
    const qoiPath = path.resolve(__dirname, 'font-assets/atlas-density-1-0-Arial-style-normal-weight-normal-size-19-0.qoi');
    if (!fs.existsSync(qoiPath)) {
      throw new Error(`QOI file not found: ${qoiPath}`);
    }
    
    console.log('Loading QOI atlas...');
    const qoiBuffer = fs.readFileSync(qoiPath);
    const qoiData = QOIDecode(qoiBuffer.buffer, 0, null, 4); // Force RGBA output
    
    if (qoiData.error) {
      throw new Error('Failed to decode QOI file');
    }
    
    console.log(`QOI decoded: ${qoiData.width}x${qoiData.height}, ${qoiData.channels} channels`);
    
    // Create Image from QOI data
    const atlasImage = new Image(qoiData.width, qoiData.height, new Uint8ClampedArray(qoiData.data));
    
    // Setup BitmapText system
    console.log('Setting up BitmapText system...');
    const atlasStore = new AtlasStore();
    const fontMetricsStore = new FontMetricsStore();
    const bitmapText = new BitmapText(atlasStore, fontMetricsStore, () => new Canvas());
    
    // Process font data and populate stores
    fontMetricsStore.setFontMetrics(fontProperties, fontMetrics);
    atlasStore.setAtlas(fontProperties, atlasImage);
    
    // Create output canvas
    console.log('Creating canvas and rendering...');
    const canvas = new Canvas();
    canvas.width = 300;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    
    // White background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 300, 100);
    
    // Render "Hello World" using bitmap text
    bitmapText.drawTextFromAtlas(
      ctx,
      "Hello World",
      10,  // x position
      50,  // y position
      fontProperties,
      '#000000'  // black color
    );
    
    console.log('Text rendered successfully');
    
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
    console.error('2. Ensure font data exists: font-assets/metrics-density-1-0-Arial-style-normal-weight-normal-size-19-0.js and font-assets/atlas-density-1-0-Arial-style-normal-weight-normal-size-19-0.qoi');
    console.error('3. Build font assets using public/font-assets-builder.html if needed');
    process.exit(1);
  }
}

// Run the demo
if (require.main === module) {
  main();
}