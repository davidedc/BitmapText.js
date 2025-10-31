function downloadFontAssets(options) {
  const {
      pixelDensity,
      fontFamily,
      fontStyle,
      fontWeight,
      includeNonMinifiedMetrics = false
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
      const generatedMetrics = fontMetrics._characterMetrics;

      // Check if we have any glyphs to export
      if (Object.keys(generatedMetrics).length === 0) {
          console.warn(`No glyphs found for ${fontProperties.key}, skipping export`);
          return;
      }

      // REQUIRED: ALL 204 characters from BitmapText.CHARACTER_SET must be included
      // Create metrics for all 204 characters in BitmapText.CHARACTER_SET order
      const characterMetrics = {};

      // Get baseline metrics from first generated character for fallback
      const firstChar = Object.keys(generatedMetrics)[0];
      const fallbackMetrics = generatedMetrics[firstChar];

      // Create placeholder metrics for missing characters (zero width, invisible)
      const createPlaceholderMetrics = () => ({
          width: 0,
          actualBoundingBoxLeft: 0,
          actualBoundingBoxRight: 0,
          actualBoundingBoxAscent: 0,
          actualBoundingBoxDescent: 0,
          fontBoundingBoxAscent: fallbackMetrics.fontBoundingBoxAscent,
          fontBoundingBoxDescent: fallbackMetrics.fontBoundingBoxDescent,
          hangingBaseline: fallbackMetrics.hangingBaseline,
          alphabeticBaseline: fallbackMetrics.alphabeticBaseline,
          ideographicBaseline: fallbackMetrics.ideographicBaseline,
          pixelDensity: fallbackMetrics.pixelDensity
      });

      // Add all 204 characters from BitmapText.CHARACTER_SET
      for (const char of BitmapText.CHARACTER_SET) {
          if (generatedMetrics[char]) {
              // Use generated metrics if available
              characterMetrics[char] = generatedMetrics[char];
          } else {
              // Use placeholder for missing characters
              characterMetrics[char] = createPlaceholderMetrics();
          }
      }

      // Warn about missing characters (should not happen in normal operation)
      const missingChars = Array.from(BitmapText.CHARACTER_SET).filter(char => !generatedMetrics[char]);
      if (missingChars.length > 0) {
          console.warn(`⚠️  Generated placeholder metrics for ${missingChars.length} missing characters: ${missingChars.slice(0, 10).join('')}${missingChars.length > 10 ? '...' : ''}`);
      }

      // Verify no extra characters outside BitmapText.CHARACTER_SET
      const extraChars = Object.keys(generatedMetrics).filter(char => !BitmapText.CHARACTER_SET.includes(char));
      if (extraChars.length > 0) {
          throw new Error(
              `Font contains ${extraChars.length} characters not in BitmapText.CHARACTER_SET: ${extraChars.join(', ')}\n` +
              `Please update BitmapText.CHARACTER_SET in src/runtime/BitmapText.js to include these characters.`
          );
      }

      // Metrics data (positioning data NO LONGER exported - reconstructed at runtime)
      const metricsData = {
          kerningTable: fontMetrics._kerningTable,
          characterMetrics: characterMetrics,
          spaceAdvancementOverrideForSmallSizesInPx: fontMetrics._spaceAdvancementOverride
      };

      // Minify with automatic roundtrip verification
      // This catches compression bugs immediately during build
      // Will throw error if characterMetrics is not in BitmapText.CHARACTER_SET order
      const minified = MetricsMinifier.minifyWithVerification(metricsData);

      // TIER 6b: Decompose font ID for multi-parameter format
      const parts = IDString.split('-');
      const density = parts[1] + (parts[2] === '0' ? '' : '.' + parts[2]); // "1" or "1.5"
      const fontFamilyFromID = parts[3];
      const styleFromID = parts[5]; // "normal", "italic", "oblique"
      const weightFromID = parts[7]; // "normal", "bold", or numeric
      const sizeStr = parts[9] + (parts[10] === '0' ? '' : '.' + parts[10]); // "18" or "18.5"

      // Compress style and weight to indices
      const styleIdx = styleFromID === 'normal' ? 0 : (styleFromID === 'italic' ? 1 : 2);
      const weightIdx = weightFromID === 'normal' ? 0 : (weightFromID === 'bold' ? 1 : weightFromID);

      // Add minified metrics JS file to zip (only contains metrics, no atlas positioning)
      // TIER 1 OPTIMIZATION: Comments removed, wrapper minified for smaller file size
      // TIER 6b OPTIMIZATION: Use 'r' shorthand with multi-parameter format (saves ~10 bytes)
      // TIER 7 OPTIMIZATION: Remove safety checks - assume BitmapText exists (private library, saves ~46 bytes)
      folder.file(
          `metrics-${IDString}.js`,
          `BitmapText.r(${density},'${fontFamilyFromID}',${styleIdx},${weightIdx},${sizeStr},${JSON.stringify(minified)})`,
          { date: currentDate }
      );

      // Optionally add non-minified metrics file for debugging/development
      if (includeNonMinifiedMetrics) {
          folder.file(
              `metrics-${IDString}-full.js`,
              `// Full non-minified metrics for debugging\n// This file is NOT used by the runtime - it's for development/inspection only\nBitmapText.r(${density},'${fontFamilyFromID}',${styleIdx},${weightIdx},${sizeStr},${JSON.stringify(metricsData, null, 2)})`,
              { date: currentDate }
          );
          console.log(`✅ Added non-minified metrics file: metrics-${IDString}-full.js`);
      }

      // NO positioning JSON file - positioning will be reconstructed at runtime from Atlas image
      // This eliminates ~3.7KB per font (75% of previous serialized size)
  });


  // Generate and download zip file
  return zip.generateAsync({ type: "blob" })
      .then(content => saveAs(content, "fontAssets.zip"));
}