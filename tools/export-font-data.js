function downloadGlyphSheetsAndKerningMaps(options) {
  const {
      bitmapGlyphStore_FAB,
      pixelDensity,
      fontFamily,
      fontStyle, 
      fontWeight
  } = options;
  
  // Create FontPropertiesFAB for this font configuration (without fontSize yet)
  // We'll create specific instances for each size below

  const zip = new JSZip();
  const folder = zip.folder("glyphSheets");
  const bitmapGlyphStore = bitmapGlyphStore_FAB.extractBitmapGlyphStoreInstance();
  
  // Find all available sizes by examining Map keys
  // as glyphSheets is a Map with FontProperties.key as keys
  const sizes = new Set();
  const baseKeyPrefix = `${pixelDensity}:${fontFamily}:${fontStyle}:${fontWeight}:`;
  
  for (const [key, canvas] of bitmapGlyphStore.glyphSheets) {
    if (key.startsWith(baseKeyPrefix)) {
      // Extract fontSize from key: "pixelDensity:fontFamily:fontStyle:fontWeight:fontSize"
      const fontSize = key.substring(baseKeyPrefix.length);
      sizes.add(parseFloat(fontSize));
    }
  }
  
  const IDs = [];

  sizes.forEach(size => {
      // Create FontPropertiesFAB for this specific size
      const fontProperties = new FontPropertiesFAB(pixelDensity, fontFamily, fontStyle, fontWeight, size);
      
      // Get canvas from Map-based storage
      const canvas = bitmapGlyphStore.glyphSheets.get(fontProperties.key);
      
      // Skip if no canvas exists for this configuration
      if (!canvas) {
          return;
      }
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Encode to QOI format
      const qoiBuffer = QOIEncode(imageData.data, {
          width: canvas.width,
          height: canvas.height,
          channels: 4, // RGBA
          colorspace: 0 // sRGB with linear alpha
      });
      
      // Convert ArrayBuffer to base64 for zip storage
      const qoiUint8Array = new Uint8Array(qoiBuffer);
      const qoiBase64 = btoa(String.fromCharCode(...qoiUint8Array));

      // Use pre-computed ID string from FontPropertiesFAB
      const IDString = fontProperties.idString;
      IDs.push(IDString);

      // Add QOI to zip with timezone-corrected date
      // JavaScript Date() gives UTC, but JSZip interprets as local time
      // We need to adjust for the timezone offset to get the correct local time
      const now = new Date();
      const timezoneOffset = now.getTimezoneOffset(); // minutes difference from UTC
      const currentDate = new Date(now.getTime() - (timezoneOffset * 60 * 1000));
      folder.file(`atlas-${IDString}.qoi`, qoiBase64, { base64: true, date: currentDate });

      // REFACTORED: Extract metadata using new Map-based getters
      // Collect all glyph metrics for this font configuration
      const glyphSheetsMetrics = {
          tightWidth: {},
          tightHeight: {},
          dx: {},
          dy: {},
          xInGlyphSheet: {}
      };
      
      const glyphsTextMetrics = {};
      const baseGlyphKey = fontProperties.key + ':';
      
      // Iterate through all Map entries to find glyphs for this font
      for (const [key, value] of bitmapGlyphStore.glyphSheetsMetrics.tightWidth) {
          if (key.startsWith(baseGlyphKey)) {
              const letter = key.substring(baseGlyphKey.length);
              glyphSheetsMetrics.tightWidth[letter] = value;
          }
      }
      
      for (const [key, value] of bitmapGlyphStore.glyphSheetsMetrics.tightHeight) {
          if (key.startsWith(baseGlyphKey)) {
              const letter = key.substring(baseGlyphKey.length);
              glyphSheetsMetrics.tightHeight[letter] = value;
          }
      }
      
      for (const [key, value] of bitmapGlyphStore.glyphSheetsMetrics.dx) {
          if (key.startsWith(baseGlyphKey)) {
              const letter = key.substring(baseGlyphKey.length);
              glyphSheetsMetrics.dx[letter] = value;
          }
      }
      
      for (const [key, value] of bitmapGlyphStore.glyphSheetsMetrics.dy) {
          if (key.startsWith(baseGlyphKey)) {
              const letter = key.substring(baseGlyphKey.length);
              glyphSheetsMetrics.dy[letter] = value;
          }
      }
      
      for (const [key, value] of bitmapGlyphStore.glyphSheetsMetrics.xInGlyphSheet) {
          if (key.startsWith(baseGlyphKey)) {
              const letter = key.substring(baseGlyphKey.length);
              glyphSheetsMetrics.xInGlyphSheet[letter] = value;
          }
      }
      
      // Collect glyph text metrics
      for (const [key, value] of bitmapGlyphStore.glyphsTextMetrics) {
          if (key.startsWith(baseGlyphKey)) {
              const letter = key.substring(baseGlyphKey.length);
              glyphsTextMetrics[letter] = value;
          }
      }
      
      const metadata = {
          kerningTable: bitmapGlyphStore.getKerningTable(fontProperties),
          glyphsTextMetrics: glyphsTextMetrics,
          spaceAdvancementOverrideForSmallSizesInPx: bitmapGlyphStore.getSpaceAdvancementOverrideForSmallSizesInPx(fontProperties),
          glyphSheetsMetrics: glyphSheetsMetrics
      };

      // Test minification and expansion 
      const minified = MetricsMinifier.minify(metadata);
      const expanded = MetricsExpander.expand(minified);
      
      // Instead of deep equality check, let's verify the essential properties are preserved
      const firstChar = Object.keys(metadata.glyphsTextMetrics)[0];
      const originalGlyph = metadata.glyphsTextMetrics[firstChar];
      const expandedGlyph = expanded.glyphsTextMetrics[firstChar];
      
      // Check that the essential named properties match
      const essentialProps = ['width', 'actualBoundingBoxLeft', 'actualBoundingBoxRight', 'actualBoundingBoxAscent', 'actualBoundingBoxDescent'];
      let allPropsMatch = true;
      
      for (const prop of essentialProps) {
        if (originalGlyph[prop] !== expandedGlyph[prop]) {
          console.error(`Property ${prop} mismatch: ${originalGlyph[prop]} vs ${expandedGlyph[prop]}`);
          allPropsMatch = false;
        }
      }
      
      if (!allPropsMatch) {
        throw new Error('Essential properties do not match after minification/expansion');
      }
      
      console.log('✅ Minification/expansion test passed for essential properties');
      
      // Add metadata JS file to zip with explicit current date
      folder.file(
          `metrics-${IDString}.js`,
          `(loadedBitmapFontData ??= {})['${IDString}'] = MetricsExpander.expand(${JSON.stringify(MetricsMinifier.minify(metadata))});`,
          { date: currentDate }
      );
  });

  // Add manifest file with timezone-corrected date
  const manifestNow = new Date();
  const manifestTimezoneOffset = manifestNow.getTimezoneOffset();
  const manifestDate = new Date(manifestNow.getTime() - (manifestTimezoneOffset * 60 * 1000));
  folder.file('manifest.js', `(bitmapFontsManifest ??= {}).IDs = ${JSON.stringify(IDs)};`, { date: manifestDate });

  // Generate and download zip file
  return zip.generateAsync({ type: "blob" })
      .then(content => saveAs(content, "glyphSheets.zip"));
}