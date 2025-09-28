function downloadFontAssets(options) {
  const {
      atlasDataStoreFAB,
      fontMetricsStoreFAB,
      pixelDensity,
      fontFamily,
      fontStyle, 
      fontWeight
  } = options;
  
  // Create FontPropertiesFAB for this font configuration (without fontSize yet)
  // We'll create specific instances for each size below

  const zip = new JSZip();
  const folder = zip.folder("fontAssets");
  const atlasDataStore = atlasDataStoreFAB.extractAtlasDataStoreInstance();
  const fontMetricsStore = fontMetricsStoreFAB.extractFontMetricsStoreInstance();
  
  // Find all available sizes by examining Map keys
  // as atlases is a Map with FontProperties.key as keys
  const sizes = new Set();
  const baseKeyPrefix = `${pixelDensity}:${fontFamily}:${fontStyle}:${fontWeight}:`;
  
  for (const [key, canvas] of atlasDataStore.atlases) {
    if (key.startsWith(baseKeyPrefix)) {
      // Extract fontSize from key: "pixelDensity:fontFamily:fontStyle:fontWeight:fontSize"
      const fontSize = key.substring(baseKeyPrefix.length);
      sizes.add(parseFloat(fontSize));
    }
  }
  

  sizes.forEach(size => {
      // Create FontPropertiesFAB for this specific size
      const fontProperties = new FontPropertiesFAB(pixelDensity, fontFamily, fontStyle, fontWeight, size);
      
      // Get atlas data from Map-based storage
      const atlasData = atlasDataStore.atlases.get(fontProperties.key);

      // Skip if no atlas data exists for this configuration
      if (!atlasData) {
          return;
      }

      // Extract canvas from AtlasData object or use directly if it's a raw canvas
      const canvas = atlasData.image || atlasData;

      if (!canvas || !canvas.getContext) {
          console.warn(`Invalid canvas for ${fontProperties.key}, skipping export`);
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

      // Add QOI to zip with timezone-corrected date
      // JavaScript Date() gives UTC, but JSZip interprets as local time
      // We need to adjust for the timezone offset to get the correct local time
      const now = new Date();
      const timezoneOffset = now.getTimezoneOffset(); // minutes difference from UTC
      const currentDate = new Date(now.getTime() - (timezoneOffset * 60 * 1000));
      folder.file(`atlas-${IDString}.qoi`, qoiBase64, { base64: true, date: currentDate });

      // Extract metadata using FontMetricsFAB instance
      // Get FontMetricsFAB instance for this font configuration
      const fontMetrics = fontMetricsStoreFAB.getFontMetrics(fontProperties);

      if (!fontMetrics) {
          console.warn(`No FontMetrics found for ${fontProperties.key}, skipping export`);
          return;
      }

      // Extract atlas positioning using new extraction method
      const atlasPositioning = fontMetrics.extractAtlasPositioning();
      const atlasPositioningData = atlasPositioning.getRawData ? atlasPositioning.getRawData() : atlasPositioning;

      // Extract character metrics directly from FontMetrics instance
      const characterMetrics = { ...fontMetrics._characterMetrics };

      // Split data: metrics data (for metrics files) and atlas positioning data (for atlas files)
      const metricsData = {
          kerningTable: fontMetrics._kerningTable,
          characterMetrics: characterMetrics,
          spaceAdvancementOverrideForSmallSizesInPx: fontMetrics._spaceAdvancementOverride
      };


      // Check if we have any glyphs to export
      if (Object.keys(characterMetrics).length === 0) {
          console.warn(`No glyphs found for ${fontProperties.key}, skipping export`);
          return;
      }

      // Test minification and expansion for metrics data
      const minified = MetricsMinifier.minify(metricsData);
      const expanded = MetricsExpander.expand(minified);

      // Instead of deep equality check, let's verify the essential properties are preserved
      // Note: expanded is a FontMetrics instance, not a plain object
      const firstChar = Object.keys(metricsData.characterMetrics)[0];
      const originalGlyph = metricsData.characterMetrics[firstChar];
      
      // Use FontMetrics API to get the expanded glyph data
      const expandedGlyph = expanded.getCharacterMetrics(firstChar);
      
      if (!expandedGlyph) {
          console.error('Expanded glyph is undefined:', {
              firstChar,
              originalGlyph,
              expandedType: typeof expanded,
              expandedConstructor: expanded.constructor.name,
              hasGlyph: expanded.hasGlyph(firstChar)
          });
          throw new Error(`Expanded glyph data is missing for character '${firstChar}'`);
      }
      
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

      // Add metrics JS file to zip (only contains metrics, no atlas positioning)
      folder.file(
          `metrics-${IDString}.js`,
          `// Direct store population - no intermediate storage
if (typeof fontMetricsStore !== 'undefined' && typeof FontProperties !== 'undefined' && typeof MetricsExpander !== 'undefined') {
  const fontProperties = FontProperties.fromIDString('${IDString}');
  const fontMetrics = MetricsExpander.expand(${JSON.stringify(MetricsMinifier.minify(metricsData))});
  fontMetricsStore.setFontMetrics(fontProperties, fontMetrics);
}`,
          { date: currentDate }
      );

      // Add positioning JSON file to zip
      const minifiedAtlasPositioning = AtlasMinifier.minify(atlasPositioningData);
      folder.file(
          `atlas-${IDString}-positioning.json`,
          JSON.stringify(minifiedAtlasPositioning, null, 2), // Pretty-printed JSON for debugging
          { date: currentDate }
      );
  });


  // Generate and download zip file
  return zip.generateAsync({ type: "blob" })
      .then(content => saveAs(content, "fontAssets.zip"));
}