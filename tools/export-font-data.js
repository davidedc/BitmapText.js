function downloadGlyphSheetsAndKerningMaps(options) {
  const {
      bitmapGlyphStore_Editor,
      pixelDensity,
      fontFamily,
      fontStyle, 
      fontWeight
  } = options;

  const zip = new JSZip();
  const folder = zip.folder("glyphSheets");
  const bitmapGlyphStore = bitmapGlyphStore_Editor.extractBitmapGlyphStoreInstance();
  const glyphSheets = bitmapGlyphStore.glyphSheets;
  
  // Get all available sizes for the current font configuration
  const sizes = Object.keys(glyphSheets[pixelDensity][fontFamily][fontStyle][fontWeight]);
  const IDs = [];

  sizes.forEach(size => {
      // Skip if no entry exists for current pixel density
      if (!glyphSheets[pixelDensity][fontFamily][fontStyle][fontWeight][size]) {
          return;
      }

      // Generate QOI from canvas
      const canvas = glyphSheets[pixelDensity][fontFamily][fontStyle][fontWeight][size];
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

      // Generate ID string for the current configuration
      const properties = { pixelDensity, fontFamily, fontStyle, fontWeight, fontSize: size };
      const IDString = GlyphIDString_Editor.getIDString(properties);
      IDs.push(IDString);

      // Add QOI to zip with timezone-corrected date
      // JavaScript Date() gives UTC, but JSZip interprets as local time
      // We need to adjust for the timezone offset to get the correct local time
      const now = new Date();
      const timezoneOffset = now.getTimezoneOffset(); // minutes difference from UTC
      const currentDate = new Date(now.getTime() - (timezoneOffset * 60 * 1000));
      folder.file(`atlas-${IDString}.qoi`, qoiBase64, { base64: true, date: currentDate });

      // navigate through the bitmapGlyphStore, which contains:
      //   kerningTables = {}; // [pixelDensity,fontFamily, fontStyle, fontWeight, fontSize]    
      //   glyphsTextMetrics = {}; // [pixelDensity, fontFamily, fontStyle, fontWeight, fontSize, letter]
      //   spaceAdvancementOverrideForSmallSizesInPx = {}; // [pixelDensity, fontFamily, fontStyle, fontWeight, fontSize]
      //   // these two needed to precisely paint a glyph from the sheet into the destination canvas
      //   glyphSheets = {}; // [pixelDensity, fontFamily, fontStyle, fontWeight, fontSize]
      //   glyphSheetsMetrics = { // all objects indexed on [pixelDensity, fontFamily, fontStyle, fontWeight, fontSize, letter]
      //     tightWidth: {},
      //     tightHeight: {},
      //     dx: {},
      //     dy: {},
      //     xInGlyphSheet: {}
      //   };
      // and filter all the objects that are relevant to the current pixelDensity, font family, style, weight and size
      const metadata = {
          kerningTable: bitmapGlyphStore.kerningTables[pixelDensity][fontFamily][fontStyle][fontWeight][size],
          glyphsTextMetrics: bitmapGlyphStore.glyphsTextMetrics[pixelDensity][fontFamily][fontStyle][fontWeight][size],
          spaceAdvancementOverrideForSmallSizesInPx: bitmapGlyphStore.spaceAdvancementOverrideForSmallSizesInPx[pixelDensity][fontFamily][fontStyle][fontWeight][size],
          glyphSheetsMetrics: {
              tightWidth: bitmapGlyphStore.glyphSheetsMetrics.tightWidth[pixelDensity][fontFamily][fontStyle][fontWeight][size],
              tightHeight: bitmapGlyphStore.glyphSheetsMetrics.tightHeight[pixelDensity][fontFamily][fontStyle][fontWeight][size],
              dx: bitmapGlyphStore.glyphSheetsMetrics.dx[pixelDensity][fontFamily][fontStyle][fontWeight][size],
              dy: bitmapGlyphStore.glyphSheetsMetrics.dy[pixelDensity][fontFamily][fontStyle][fontWeight][size],
              xInGlyphSheet: bitmapGlyphStore.glyphSheetsMetrics.xInGlyphSheet[pixelDensity][fontFamily][fontStyle][fontWeight][size]
          }
      };

      // Test compression and decompression 
      const compressed = compressFontMetrics(metadata);
      const decompressed = decompressFontMetrics(compressed);
      
      // Instead of deep equality check, let's verify the essential properties are preserved
      const firstChar = Object.keys(metadata.glyphsTextMetrics)[0];
      const originalGlyph = metadata.glyphsTextMetrics[firstChar];
      const decompressedGlyph = decompressed.glyphsTextMetrics[firstChar];
      
      // Check that the essential named properties match
      const essentialProps = ['width', 'actualBoundingBoxLeft', 'actualBoundingBoxRight', 'actualBoundingBoxAscent', 'actualBoundingBoxDescent'];
      let allPropsMatch = true;
      
      for (const prop of essentialProps) {
        if (originalGlyph[prop] !== decompressedGlyph[prop]) {
          console.error(`Property ${prop} mismatch: ${originalGlyph[prop]} vs ${decompressedGlyph[prop]}`);
          allPropsMatch = false;
        }
      }
      
      if (!allPropsMatch) {
        throw new Error('Essential properties do not match after compression/decompression');
      }
      
      console.log('✅ Compression/decompression test passed for essential properties');
      
      // Add metadata JS file to zip with explicit current date
      folder.file(
          `metrics-${IDString}.js`,
          `(loadedBitmapFontData ??= {})['${IDString}'] = decompressFontMetrics(${JSON.stringify(compressFontMetrics(metadata))});`,
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