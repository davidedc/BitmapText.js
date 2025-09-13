// MAIN EXECUTION - Node.js Hello World Multi-Size Demo

// Node.js modules
const fs = require('fs');
const path = require('path');

// Set global variables (required by BitmapText)
global.loadedBitmapFontData = {};
global.isKerningEnabled = true;

// Font sizes to demonstrate
const fontSizes = [18, 18.5, 19];

// Create font properties for each size using FontProperties class
const fontPropertiesArray = fontSizes.map(size => 
  new FontProperties(1, "Arial", "normal", "normal", size) // pixelDensity, fontFamily, fontStyle, fontWeight, fontSize
);

// Function to create IDString from FontProperties (uses pre-computed idString)
function createIDString(fontProperties) {
  return fontProperties.idString;
}

function main() {
  try {
    console.log('BitmapText.js Node.js Multi-Size Demo - Loading font data...');
    
    // Create IDStrings for all font configurations
    const IDStrings = fontPropertiesArray.map(createIDString);
    console.log('Font sizes:', fontSizes);
    console.log('IDStrings:', IDStrings);
    
    // Load metrics for all font sizes
    const fontMetricsMap = new Map();
    
    for (let i = 0; i < fontSizes.length; i++) {
      const fontSize = fontSizes[i];
      const IDString = IDStrings[i];
      
      console.log(`Loading metrics for size ${fontSize}...`);
      
      // Load font metrics (JS file)
      const fontMetricsPath = path.resolve(__dirname, `font-assets/metrics-${IDString}.js`);
      if (!fs.existsSync(fontMetricsPath)) {
        throw new Error(`Font metrics file not found: ${fontMetricsPath}`);
      }
      
      // Execute the font metrics JS file to populate global.loadedBitmapFontData
      const fontMetricsCode = fs.readFileSync(fontMetricsPath, 'utf8');
      eval(fontMetricsCode);
      
      const fontMetricsData = global.loadedBitmapFontData[IDString];
      if (!fontMetricsData) {
        throw new Error(`Font metrics not found for ID: ${IDString}`);
      }
      
      // Check if it's already a FontMetrics instance (metrics files call MetricsExpander.expand)
      const fontMetrics = fontMetricsData instanceof FontMetrics
        ? fontMetricsData
        : new FontMetrics(fontMetricsData);
      fontMetricsMap.set(fontSize, fontMetrics);
      console.log(`✓ Metrics loaded for size ${fontSize}`);
    }
    
    // Load QOI atlases (check both main directory and removed-for-testing)
    const atlasMap = new Map();
    
    for (let i = 0; i < fontSizes.length; i++) {
      const fontSize = fontSizes[i];
      const IDString = IDStrings[i];
      
      console.log(`Loading QOI atlas for size ${fontSize}...`);
      
      // Only check main directory (like browser version)
      const qoiPath = path.resolve(__dirname, `font-assets/atlas-${IDString}.qoi`);
      
      if (fs.existsSync(qoiPath)) {
        console.log(`  ↳ Loading: ${path.basename(qoiPath)}`);
        const qoiBuffer = fs.readFileSync(qoiPath);
        const qoiData = QOIDecode(qoiBuffer.buffer, 0, null, 4); // Force RGBA output
        
        if (qoiData.error) {
          console.warn(`  ↳ Failed to decode QOI for size ${fontSize}, will use placeholder rectangles`);
          atlasMap.set(fontSize, null);
        } else {
          console.log(`  ↳ QOI decoded: ${qoiData.width}x${qoiData.height}, ${qoiData.channels} channels`);
          const atlasImage = new Image(qoiData.width, qoiData.height, new Uint8ClampedArray(qoiData.data));
          atlasMap.set(fontSize, atlasImage);
        }
      } else {
        console.warn(`  ↳ QOI file not found for size ${fontSize}, will use placeholder rectangles`);
        atlasMap.set(fontSize, null);
      }
    }
    
    // Setup BitmapText system
    console.log('Setting up BitmapText system...');
    const atlasStore = new AtlasStore();
    const fontMetricsStore = new FontMetricsStore();
    const bitmapText = new BitmapText(atlasStore, fontMetricsStore, () => new Canvas());
    
    // Process font atlases and populate atlas store for all sizes
    for (let i = 0; i < fontSizes.length; i++) {
      const fontSize = fontSizes[i];
      const fontProperties = fontPropertiesArray[i];
      const atlasImage = atlasMap.get(fontSize);
      
      console.log(`Setting up font data for size ${fontSize}...`);
      
      const fontMetrics = fontMetricsMap.get(fontSize);
      fontMetricsStore.setFontMetrics(fontProperties, fontMetrics);
      
      if (atlasImage) {
        atlasStore.setAtlas(fontProperties, atlasImage);
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
    fontPropertiesArray.forEach((fontProperties, index) => {
      const yPosition = 50 + (index * 50); // Space lines 50px apart
      const text = `Hello World (size ${fontProperties.fontSize})`;
      
      console.log(`Rendering "${text}" at y=${yPosition}`);
      
      bitmapText.drawTextFromAtlas(
        ctx,
        text,
        20,  // x position
        yPosition,
        fontProperties,
        '#000000'  // black color
      );
    });
    
    console.log('Multi-size text rendered successfully');
    
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
    console.log(`Note: Sizes with missing QOI files will show black placeholder rectangles.`);
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure you run this from the project root directory');
    console.error('2. Ensure font metrics exist for all sizes:', fontSizes.map(s => `metrics-density-1-0-Arial-style-normal-weight-normal-size-${s.toString().replace('.', '-')}${s.toString().includes('.') ? '' : '-0'}.js`).join(', '));
    console.error('3. QOI files are optional - missing ones will show placeholder rectangles');
    console.error('4. Build font assets using public/font-assets-builder.html if needed');
    process.exit(1);
  }
}

// Run the demo
if (require.main === module) {
  main();
}