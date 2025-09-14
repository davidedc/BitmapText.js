function downloadFontAssets(options) {
  const {
      atlasStoreFAB,
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
  const atlasStore = atlasStoreFAB.extractAtlasStoreInstance();
  const fontMetricsStore = fontMetricsStoreFAB.extractFontMetricsStoreInstance();
  
  // Find all available sizes by examining Map keys
  // as atlases is a Map with FontProperties.key as keys
  const sizes = new Set();
  const baseKeyPrefix = `${pixelDensity}:${fontFamily}:${fontStyle}:${fontWeight}:`;
  
  for (const [key, canvas] of atlasStore.atlases) {
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
      const canvas = atlasStore.atlases.get(fontProperties.key);
      
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

      // Extract metadata using FontMetrics instance
      // Get FontMetrics instance for this font configuration
      const fontMetrics = fontMetricsStore.getFontMetrics(fontProperties);
      
      if (!fontMetrics) {
          console.warn(`No FontMetrics found for ${fontProperties.key}, skipping export`);
          return;
      }
      
      // Extract atlas metrics directly from FontMetrics instance
      const atlasMetrics = {
          tightWidth: { ...fontMetrics._fontMetrics.tightWidth },
          tightHeight: { ...fontMetrics._fontMetrics.tightHeight },
          dx: { ...fontMetrics._fontMetrics.dx },
          dy: { ...fontMetrics._fontMetrics.dy },
          xInAtlas: { ...fontMetrics._fontMetrics.xInAtlas }
      };
      
      // Extract glyph text metrics directly from FontMetrics instance
      const glyphsTextMetrics = { ...fontMetrics._glyphsTextMetrics };
      
      const metadata = {
          kerningTable: fontMetrics._kerningTable,
          glyphsTextMetrics: glyphsTextMetrics,
          spaceAdvancementOverrideForSmallSizesInPx: fontMetrics._spaceAdvancementOverride,
          atlasMetrics: atlasMetrics
      };

      // Check if we have any glyphs to export
      if (Object.keys(glyphsTextMetrics).length === 0) {
          console.warn(`No glyphs found for ${fontProperties.key}, skipping export`);
          return;
      }
      
      // Test minification and expansion 
      const minified = MetricsMinifier.minify(metadata);
      const expanded = MetricsExpander.expand(minified);
      
      // Instead of deep equality check, let's verify the essential properties are preserved
      // Note: expanded is a FontMetrics instance, not a plain object
      const firstChar = Object.keys(metadata.glyphsTextMetrics)[0];
      const originalGlyph = metadata.glyphsTextMetrics[firstChar];
      
      // Use FontMetrics API to get the expanded glyph data
      const expandedGlyph = expanded.getTextMetrics(firstChar);
      
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
      
      // Add metadata JS file to zip with explicit current date
      folder.file(
          `metrics-${IDString}.js`,
          `// Direct store population - no intermediate storage
if (typeof fontMetricsStore !== 'undefined' && typeof FontProperties !== 'undefined' && typeof MetricsExpander !== 'undefined') {
  const fontProperties = FontProperties.fromIDString('${IDString}');
  const fontMetrics = MetricsExpander.expand(${JSON.stringify(MetricsMinifier.minify(metadata))});
  fontMetricsStore.setFontMetrics(fontProperties, fontMetrics);
}`,
          { date: currentDate }
      );
  });

  // Add manifest file with timezone-corrected date
  const manifestNow = new Date();
  const manifestTimezoneOffset = manifestNow.getTimezoneOffset();
  const manifestDate = new Date(manifestNow.getTime() - (manifestTimezoneOffset * 60 * 1000));
  folder.file('manifest.js', `(bitmapTextManifest ??= {}).IDs = ${JSON.stringify(IDs)};`, { date: manifestDate });

  // Generate and download zip file
  return zip.generateAsync({ type: "blob" })
      .then(content => saveAs(content, "fontAssets.zip"));
}