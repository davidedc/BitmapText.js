// the bitmapFontsManifest variable now contains the manifest data
// which looks like:
// bitmapFontsManifest.files = ["glyphs-sheet-density-1-arial-style-normal-weight-normal-size-18","glyphs-sheet-density-1-arial-style-normal-weight-normal-size-19"];

// Go through each filename in the manifest and load two files
// via script tag
// i.e. [filename].js and [filename].png

let loadedScripts = 0;
let bitmapFontsData;

function bitmapFontJsOrImageLoaded() {
  // if all the scripts/images have been loaded, call the buildAndShowGlyphs function
  // do the check by comparing the number of files in the manifest to the number of loaded scripts
  loadedScripts++;
  if (loadedScripts === bitmapFontsManifest.files.length * 2) {
    debugger;
    ingestBitmapFontsData();
  }
}


for (const element of bitmapFontsManifest.files) {
  let filename = element;
  let script = document.createElement('script')
  script.src = "bitmap-fonts-data/" + filename + '.js';
  document.head.appendChild(script);
  // when the script is loaded, call a "bitmapFontJsLoaded" function
  script.onload = function() {
    bitmapFontJsOrImageLoaded();
  }
  let img = new Image();
  img.src = "bitmap-fonts-data/" + filename + '.png';
  img.onload = function() {
    // create a canvas element and draw the image on it
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    let ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    // attach the canvas to the document
    document.body.appendChild(canvas);
    // and then a newline
    document.body.appendChild(document.createElement('br'));
    // extract the pixel density, font family, style, weight, size from the filename of the type:
    //   glyphs-sheet-density-1-arial-style-normal-weight-normal-size-18
    const parts = filename.split('-');
    const density = parts[3];
    const fontFamily = parts[4];
    const style = parts[6];
    const weight = parts[8];
    const size = parts[10];
    // add the canvas to the crispBitmapGlyphStore
    setNestedProperty(crispBitmapGlyphStore.glyphsSheets, [density, fontFamily, style, weight, size], canvas);
    
    bitmapFontJsOrImageLoaded();
  }
}

function ingestBitmapFontsData() {
  crispBitmapGlyphStore.glyphsSheetsMetrics = {
    tightWidth: {},
    tightHeight: {},
    dx: {},
    dy: {},
    xInGlyphSheet: {}
  };
  // the bitmapFontsData has keys that look like "glyphs_sheet_density_1_arial_style_normal_weight_normal_size_18"
  // from each key we want to extract the density, font family, style, weight, size
  for (const key in bitmapFontsData) {
    if (key.startsWith('glyphs_sheet_density_')) {
      let parts = key.split('_');
      let density = parts[3];
      let fontFamily = parts[4];
      let style = parts[6];
      let weight = parts[8];
      let size = parts[10];
      
      // now put the value of the key in the crispBitmapGlyphStore object

      // put the bitmapFontsData "kerningTable" in the crispBitmapGlyphStore "kerningTables" at [pixelDensity,fontFamily, fontStyle, fontWeight, fontSize] 
      setNestedProperty(crispBitmapGlyphStore.kerningTables, [density, fontFamily, style, weight, size], bitmapFontsData[key].kerningTable);

      // put the bitmapFontsData "glyphsSheetMetrics" in the crispBitmapGlyphStore "glyphsSheetsMetrics" at [pixelDensity, fontFamily, fontStyle, fontWeight, fontSize, letter]
      setNestedProperty(crispBitmapGlyphStore.glyphsTextMetrics, [density, fontFamily, style, weight, size], bitmapFontsData[key].glyphsTextMetrics);

      // same for glyphsSheetsMetrics
      setNestedProperty(crispBitmapGlyphStore.glyphsSheetsMetrics.tightWidth, [density, fontFamily, style, weight, size], bitmapFontsData[key].glyphsSheetsMetrics.tightWidth);
      setNestedProperty(crispBitmapGlyphStore.glyphsSheetsMetrics.tightHeight, [density, fontFamily, style, weight, size], bitmapFontsData[key].glyphsSheetsMetrics.tightHeight);
      setNestedProperty(crispBitmapGlyphStore.glyphsSheetsMetrics.dx, [density, fontFamily, style, weight, size], bitmapFontsData[key].glyphsSheetsMetrics.dx);
      setNestedProperty(crispBitmapGlyphStore.glyphsSheetsMetrics.dy, [density, fontFamily, style, weight, size], bitmapFontsData[key].glyphsSheetsMetrics.dy);
      setNestedProperty(crispBitmapGlyphStore.glyphsSheetsMetrics.xInGlyphSheet, [density, fontFamily, style, weight, size], bitmapFontsData[key].glyphsSheetsMetrics.xInGlyphSheet);

      // same for spaceAdvancementOverrideForSmallSizesInPx
      setNestedProperty(crispBitmapGlyphStore.spaceAdvancementOverrideForSmallSizesInPx, [density, fontFamily, style, weight, size], bitmapFontsData[key].spaceAdvancementOverrideForSmallSizesInPx);

    }
  }
  debugger
}