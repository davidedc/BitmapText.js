// the bitmapFontsManifest variable now contains the manifest data
// which looks like:
// bitmapFontsManifest.IDs = ["density-1-arial-style-normal-weight-normal-size-18","density-1-arial-style-normal-weight-normal-size-19"];

// TODO loadedBitmapFontData should be called something different, as this is really the data loaded from the JS files
// which is then processed, put in the bitmapGlyphStore and then deleted
let loadedBitmapFontData;

// PNG loading (HTTP protocol)
function loadSheetsFromPNGs() {
  const fontLoader = new FontLoader(bitmapGlyphStore, (loaded, total) => {
    console.log(`loadedScripts: ${loaded} out of ${total}`);
  });

  fontLoader.loadFonts(bitmapFontsManifest.IDs, false)
    .then(() => {
      console.log("⏱️ loadingFontData took " + stopTiming('loadingFontData') + " milliseconds");
      startTiming('ingestingFontData');
      ingestLoadedBitmapFontData();
    });
}

// instead of loading the sheets from PNGs named
//   glyph-sheet-density-1-Arial-style-normal-weight-normal-size-18.png
//  , load them from JSs titled
//   image-glyph-sheet-density-1-Arial-style-normal-weight-normal-size-18.js
// Loading that JS file will create
// imagesFromJs['glyph-sheet-density-1-Arial-style-normal-weight-normal-size-18']
// which will contain the base64 encoded image data

// Function for JS loading (file:// protocol) 
function loadSheetsFromJSs() {
  const fontLoader = new FontLoader(bitmapGlyphStore, (loaded, total) => {
    console.log(`loadedScripts: ${loaded} out of ${total}`);
  });

  fontLoader.loadFonts(bitmapFontsManifest.IDs, true)
    .then(() => {
      console.log("⏱️ loadingFontData took " + stopTiming('loadingFontData') + " milliseconds");
      startTiming('ingestingFontData');
      ingestLoadedBitmapFontData();
    });
}

startTiming('loadingFontData');
// peek into the URL to decide whether to load the sheets from PNGs or JSs
if (window.location.href.includes("file://")) {
  // If you use the renderer from filesystem, it will load the image sheets from the filesystem
  // the problem with that is that when loading images, the browser considers each of them
  // as a separate domain, so they are tainted as cross-origin. You CAN still paint them on a canvas
  // however you can't read the pixels from the canvas, and hence you can't check the hash of the image of
  // generated text.
  //
  // Loading images from .js files instead, the browser considers all of them as the same domain (strange but true),
  // so the images are not tainted as cross-origin.
  // This way you can read the pixels from the canvas and check the hash of the image of generated text.
  loadSheetsFromJSs();
}
else {
  loadSheetsFromPNGs();
}

function ingestLoadedBitmapFontData() {
  // Reset glyph sheet metrics maps for fresh loading
  bitmapGlyphStore.glyphSheetsMetrics = {
    tightWidth: new Map(),
    tightHeight: new Map(),
    dx: new Map(),
    dy: new Map(),
    xInGlyphSheet: new Map()
  };
  
  for (const key in loadedBitmapFontData) {
    const fontProperties = FontProperties.fromIDString(key);

    // Put the loadedBitmapFontData "kerningTable" in the bitmapGlyphStore "kerningTables"
    bitmapGlyphStore.setKerningTable(fontProperties, loadedBitmapFontData[key].kerningTable);

    // Put the loadedBitmapFontData "glyphSheetMetrics" in the bitmapGlyphStore "glyphSheetsMetrics"
    bitmapGlyphStore.setGlyphsTextMetrics(fontProperties, loadedBitmapFontData[key].glyphsTextMetrics);

    // Same for glyphSheetsMetrics
    const metrics = loadedBitmapFontData[key].glyphSheetsMetrics;
    bitmapGlyphStore.setGlyphSheetMetrics(fontProperties, metrics);

    // Same for spaceAdvancementOverrideForSmallSizesInPx
    bitmapGlyphStore.setSpaceAdvancementOverrideForSmallSizesInPx(fontProperties, loadedBitmapFontData[key].spaceAdvancementOverrideForSmallSizesInPx);

    // Remove the script element from the document
    let script = document.querySelector(`script[src="../font-assets/metrics-${key.replace(/_/g, '-')}.js"]`);
    script.remove();

    // Remove the loadedBitmapFontData entry
    delete loadedBitmapFontData[key];
  }

  // Clean up global variables
  delete window.loadedBitmapFontData;

  // remove the script tag with the manifest
  let manifestScript = document.querySelector('script[src="../font-assets/manifest.js"]');
  manifestScript.remove();

  // remove the bitmapFontsManifest object from the window
  delete window.bitmapFontsManifest;

  // remove the imagesFromJs object from the window if it exists
  if (window.imagesFromJs) {
    delete window.imagesFromJs;
  }

  console.log("⏱️ ingestingFontData took " + stopTiming('ingestingFontData') + " milliseconds");

  startTiming('drawTestText');
  // Use UI's selected font properties for initial render instead of hardcoded values
  const fontProperties = getFontPropertiesFromUI();
  drawTestText_withStandardClass(fontProperties, bitmapGlyphStore);
  console.log("⏱️ drawTestText took " + stopTiming('drawTestText') + " milliseconds");
}
