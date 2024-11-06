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

      // Generate PNG from canvas
      const canvas = glyphSheets[pixelDensity][fontFamily][fontStyle][fontWeight][size];
      const dataUrl = canvas.toDataURL('image/png');
      const data = dataUrl.split(',')[1];

      // Generate ID string for the current configuration
      const properties = { pixelDensity, fontFamily, fontStyle, fontWeight, fontSize: size };
      const IDString = GlyphIDString_Editor.getIDString(properties);
      IDs.push(IDString);

      // Add PNG to zip
      folder.file(`glyph-sheet-${IDString}.png`, data, { base64: true });

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
      // and save them in a JSON file
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

      // do a little test, check if compression and decompression lead to the same result as the original data
      const decompressed = decompressFontMetrics(compressFontMetrics(metadata));
      if (!deepEqual(decompressed,metadata)) {
        console.error('Compression and decompression failed for metadata:', metadata);
        debugger
        throw new Error('Compression and decompression failed');
     }
      
      // Add metadata JS file to zip
      folder.file(
          `glyph-sheet-${IDString}.js`,
          `(loadedBitmapFontData ??= {})['${IDString}'] = decompressFontMetrics(${JSON.stringify(compressFontMetrics(metadata))});`
      );
  });

  // Add manifest file
  folder.file('manifest.js', `(bitmapFontsManifest ??= {}).IDs = ${JSON.stringify(IDs)};`);

  // Generate and download zip file
  return zip.generateAsync({ type: "blob" })
      .then(content => saveAs(content, "glyphSheets.zip"));
}