function downloadGlyphSheetsAndKerningMaps(options) {
  const {
      bitmapGlyphStore_Full,
      pixelDensity,
      fontFamily,
      fontStyle, 
      fontWeight
  } = options;

  const zip = new JSZip();
  const folder = zip.folder("glyphsSheets");
  const bitmapGlyphStore = bitmapGlyphStore_Full.extractBitmapGlyphStoreInstance();
  const glyphsSheets = bitmapGlyphStore.glyphsSheets;
  
  // Get all available sizes for the current font configuration
  const sizes = Object.keys(glyphsSheets[pixelDensity][fontFamily][fontStyle][fontWeight]);
  const IDs = [];

  sizes.forEach(size => {
      // Skip if no entry exists for current pixel density
      if (!glyphsSheets[pixelDensity][fontFamily][fontStyle][fontWeight][size]) {
          return;
      }

      // Generate PNG from canvas
      const canvas = glyphsSheets[pixelDensity][fontFamily][fontStyle][fontWeight][size];
      const dataUrl = canvas.toDataURL('image/png');
      const data = dataUrl.split(',')[1];

      // Generate ID string for the current configuration
      const properties = { pixelDensity, fontFamily, fontStyle, fontWeight, fontSize: size };
      const IDString = GlyphIDString_Full.getIDString(properties);
      IDs.push(IDString);

      // Add PNG to zip
      folder.file(`glyphs-sheet-${IDString}.png`, data, { base64: true });

      // navigate through the bitmapGlyphStore, which contains:
      //   kerningTables = {}; // [pixelDensity,fontFamily, fontStyle, fontWeight, fontSize]    
      //   glyphsTextMetrics = {}; // [pixelDensity, fontFamily, fontStyle, fontWeight, fontSize, letter]
      //   spaceAdvancementOverrideForSmallSizesInPx = {}; // [pixelDensity, fontFamily, fontStyle, fontWeight, fontSize]
      //   // these two needed to precisely paint a glyph from the sheet into the destination canvas
      //   glyphsSheets = {}; // [pixelDensity, fontFamily, fontStyle, fontWeight, fontSize]
      //   glyphsSheetsMetrics = { // all objects indexed on [pixelDensity, fontFamily, fontStyle, fontWeight, fontSize, letter]
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
          glyphsSheetsMetrics: {
              tightWidth: bitmapGlyphStore.glyphsSheetsMetrics.tightWidth[pixelDensity][fontFamily][fontStyle][fontWeight][size],
              tightHeight: bitmapGlyphStore.glyphsSheetsMetrics.tightHeight[pixelDensity][fontFamily][fontStyle][fontWeight][size],
              dx: bitmapGlyphStore.glyphsSheetsMetrics.dx[pixelDensity][fontFamily][fontStyle][fontWeight][size],
              dy: bitmapGlyphStore.glyphsSheetsMetrics.dy[pixelDensity][fontFamily][fontStyle][fontWeight][size],
              xInGlyphSheet: bitmapGlyphStore.glyphsSheetsMetrics.xInGlyphSheet[pixelDensity][fontFamily][fontStyle][fontWeight][size]
          }
      };

      // Add metadata JS file to zip
      folder.file(
          `glyphs-sheet-${IDString}.js`,
          `(loadedBitmapFontData ??= {})['${IDString}'] = ${JSON.stringify(metadata)};`
      );
  });

  // Add manifest file
  folder.file('manifest.js', `(bitmapFontsManifest ??= {}).IDs = ${JSON.stringify(IDs)};`);

  // Generate and download zip file
  return zip.generateAsync({ type: "blob" })
      .then(content => saveAs(content, "glyphsSheets.zip"));
}