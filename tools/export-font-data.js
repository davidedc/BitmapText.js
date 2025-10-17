function downloadFontAssets(options) {
  const {
      pixelDensity,
      fontFamily,
      fontStyle,
      fontWeight
  } = options;

  // Note: atlasDataStoreFAB and fontMetricsStoreFAB are now static classes
  // accessed directly via AtlasDataStoreFAB.* and FontMetricsStoreFAB.*
  
  // Create FontPropertiesFAB for this font configuration (without fontSize yet)
  // We'll create specific instances for each size below

  const zip = new JSZip();
  const folder = zip.folder("fontAssets");

  // Find all available sizes by examining glyphs in atlasDataStoreFAB
  // We look at glyphs (not atlases) because that's what actually got built
  const sizes = new Set();
  const baseKeyPrefix = `${pixelDensity}:${fontFamily}:${fontStyle}:${fontWeight}:`;

  // Scan through available fonts in AtlasDataStoreFAB to find which sizes have been built
  const availableFonts = AtlasDataStoreFAB.getAvailableFonts();
  for (const fontKey of availableFonts) {
    if (fontKey.startsWith(baseKeyPrefix)) {
      // Extract fontSize from fontKey: "pixelDensity:fontFamily:fontStyle:fontWeight:fontSize"
      const fontSize = fontKey.substring(baseKeyPrefix.length);
      sizes.add(parseFloat(fontSize));
    }
  }

  if (sizes.size === 0) {
    alert('No fonts have been built yet. Please select a font configuration and wait for glyphs to render before downloading.');
    return;
  }

  console.log(`Found ${sizes.size} font size(s) to export:`, Array.from(sizes));


  sizes.forEach(size => {
      // Create FontPropertiesFAB for this specific size
      const fontProperties = new FontPropertiesFAB(pixelDensity, fontFamily, fontStyle, fontWeight, size);

      console.log(`\n=== Exporting ${fontProperties.key} ===`);

      // Check if glyphs exist for this font
      const glyphs = AtlasDataStoreFAB.getGlyphsForFont(fontProperties);
      const glyphCount = Object.keys(glyphs).length;
      console.log(`Found ${glyphCount} glyphs for ${fontProperties.key}`);

      if (glyphCount === 0) {
          console.warn(`No glyphs found for ${fontProperties.key}, skipping export`);
          return;
      }

      // Log first few glyphs to verify they have canvases
      const sampleChars = Object.keys(glyphs).slice(0, 3);
      for (const char of sampleChars) {
          const glyph = glyphs[char];
          console.log(`  Glyph '${char}': canvas=${!!glyph.canvas}, tightCanvas=${!!glyph.tightCanvas}`);
          if (glyph.canvas) {
              console.log(`    canvas dimensions: ${glyph.canvas.width}x${glyph.canvas.height}`);
          }
      }

      // Build Atlas (variable-width cells) instead of tight atlas
      // Use AtlasDataStoreFAB.buildAtlas() which properly wraps AtlasBuilder
      console.log(`Building Atlas for ${fontProperties.key}...`);
      const atlasResult = AtlasDataStoreFAB.buildAtlas(fontProperties);

      // Skip if atlas building failed
      if (!atlasResult || !atlasResult.canvas) {
          console.error(`Failed to build atlas for ${fontProperties.key}, skipping export`);
          return;
      }

      console.log(`Atlas built successfully: ${atlasResult.canvas.width}x${atlasResult.canvas.height}`);
      const canvas = atlasResult.canvas;

      if (!canvas || !canvas.getContext) {
          console.warn(`Invalid canvas from AtlasImage for ${fontProperties.key}, skipping export`);
          return;
      }

      // Skip canvases with 0x0 dimensions (nothing to export)
      if (canvas.width === 0 || canvas.height === 0) {
          console.warn(`Canvas has 0x0 dimensions for ${fontProperties.key}, skipping export`);
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

      // NO positioning data exported - will be reconstructed at runtime from Atlas image
      // The Atlas format (variable-width cells) allows runtime reconstruction of tight atlas + positioning

      // Get FontMetrics instance for this font configuration
      const fontMetrics = FontMetricsStoreFAB.getFontMetrics(fontProperties);

      if (!fontMetrics) {
          console.warn(`No FontMetrics found for ${fontProperties.key}, skipping export`);
          return;
      }

      // Extract character metrics directly from FontMetrics instance
      const characterMetrics = { ...fontMetrics._characterMetrics };

      // Metrics data (positioning data NO LONGER exported - reconstructed at runtime)
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

      // Minify with automatic roundtrip verification
      // This catches compression bugs immediately during build
      const minified = MetricsMinifier.minifyWithVerification(metricsData);

      // Add metrics JS file to zip (only contains metrics, no atlas positioning)
      // TIER 1 OPTIMIZATION: Comments removed, wrapper minified for smaller file size
      folder.file(
          `metrics-${IDString}.js`,
          `if(typeof BitmapText!=='undefined'&&BitmapText.registerMetrics){BitmapText.registerMetrics('${IDString}',${JSON.stringify(minified)})}`,
          { date: currentDate }
      );

      // NO positioning JSON file - positioning will be reconstructed at runtime from Atlas image
      // This eliminates ~3.7KB per font (75% of previous serialized size)
  });


  // Generate and download zip file
  return zip.generateAsync({ type: "blob" })
      .then(content => saveAs(content, "fontAssets.zip"));
}