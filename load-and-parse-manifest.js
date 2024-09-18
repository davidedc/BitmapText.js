// the bitmapFontsManifest variable now contains the manifest data
// which looks like:
// bitmapFontsManifest.files = ["glyphs-sheet-density-1-arial-style-normal-weight-normal-size-18","glyphs-sheet-density-1-arial-style-normal-weight-normal-size-19"];

// Go through each filename in the manifest and load two files
// via script tag
// i.e. [filename].js and [filename].png

let loadedScripts = 0;

// TODO loadedBitmapFontData should be called something different, as this is really the data loaded from the JS files
// which is then processed, put in the crispBitmapGlyphStore and then deleted
let loadedBitmapFontData;

function bitmapFontJsOrImageLoaded() {
  // If all the scripts/images have been loaded, call the buildAndShowGlyphs function
  // Do the check by comparing the number of files in the manifest to the number of loaded scripts
  loadedScripts++;
  console.log(`loadedScripts: ${loadedScripts} out of ${bitmapFontsManifest.files.length * 2}`);
  if (loadedScripts === bitmapFontsManifest.files.length * 2) {
    console.log("⏱️ loadingFontData took " + stopTiming('loadingFontData') + " milliseconds");
    startTiming('ingestingFontData');
    ingestLoadedBitmapFontData();
  }
}

function loadSheetsFromPNGs() {
  for (const filename of bitmapFontsManifest.files) {
    let script = document.createElement('script');
    script.src = `bitmap-fonts-data/${filename}.js`;
    document.head.appendChild(script);
    script.onload = function () {
      bitmapFontJsOrImageLoaded();
    };
    let img = new Image();
    img.src = `bitmap-fonts-data/${filename}.png`;
    img.onload = function () {
      // Attach the image to the document
      document.body.appendChild(img);
      document.body.appendChild(document.createElement('br'));

      // Extract font properties from the filename
      const parts = filename.split('-');
      const fontProperties = {
        pixelDensity: parts[3],
        fontFamily: parts[4],
        fontStyle: parts[6],
        fontWeight: parts[8],
        fontSize: parts[10]
      };

      // Add the canvas to the crispBitmapGlyphStore
      crispBitmapGlyphStore.setGlyphsSheet(fontProperties, img);

      bitmapFontJsOrImageLoaded();
    };
  }
}

// instead of loading the sheets from PNGs named
//   glyphs-sheet-density-1-Arial-style-normal-weight-normal-size-18.png
//  , load them from JSs titled
//   image-glyphs-sheet-density-1-Arial-style-normal-weight-normal-size-18.js
// Loading that JS file will create
// imagesFromJs['glyphs-sheet-density-1-Arial-style-normal-weight-normal-size-18']
// which will contain the base64 encoded image data

// TODO this function and the one above are very similar, should be refactored
function loadSheetsFromJSs() {
  for (const filename of bitmapFontsManifest.files) {
    let script = document.createElement('script');
    script.src = `bitmap-fonts-data/${filename}.js`;
    document.head.appendChild(script);

    script.onload = function () {
      let imageScript = document.createElement('script');
      imageScript.src = `bitmap-fonts-data/image-${filename}.js`;
      console.log(`loading image-${filename}.js ...`);
      document.head.appendChild(imageScript);

      imageScript.onload = function () {
        bitmapFontJsOrImageLoaded();
        console.log(`...loaded image-${filename}.js`);

        // now take the image data from the imagesFromJs object
        let imageData = imagesFromJs[filename];

        // create an Image from the base64 data
        let img = new Image();
        img.src = `data:image/png;base64,${imageData}`;
        img.onload = function () {
          imageScript.remove();
          delete imagesFromJs[filename];

          console.log("image loaded from JS base64 data");
          document.body.appendChild(img);
          document.body.appendChild(document.createElement('br'));

          // Extract font properties from the filename
          const parts = filename.split('-');
          const fontProperties = {
            pixelDensity: parts[3],
            fontFamily: parts[4],
            fontStyle: parts[6],
            fontWeight: parts[8],
            fontSize: parts[10]
          };

          // Add the canvas to the crispBitmapGlyphStore
          crispBitmapGlyphStore.setGlyphsSheet(fontProperties, img);
          bitmapFontJsOrImageLoaded();
        };
      };
    };
  }
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
  crispBitmapGlyphStore.glyphsSheetsMetrics = {
    tightWidth: {},
    tightHeight: {},
    dx: {},
    dy: {},
    xInGlyphSheet: {}
  };
  for (const key in loadedBitmapFontData) {
    if (key.startsWith('glyphs_sheet_density_')) {
      const parts = key.split('_');
      const fontProperties = {
        pixelDensity: parts[3],
        fontFamily: parts[4],
        fontStyle: parts[6],
        fontWeight: parts[8],
        fontSize: parts[10]
      };

      // Put the loadedBitmapFontData "kerningTable" in the crispBitmapGlyphStore "kerningTables"
      crispBitmapGlyphStore.setKerningTable(fontProperties, loadedBitmapFontData[key].kerningTable);

      // Put the loadedBitmapFontData "glyphsSheetMetrics" in the crispBitmapGlyphStore "glyphsSheetsMetrics"
      crispBitmapGlyphStore.setGlyphsTextMetrics(fontProperties, loadedBitmapFontData[key].glyphsTextMetrics);

      // Same for glyphsSheetsMetrics
      const metrics = loadedBitmapFontData[key].glyphsSheetsMetrics;
      crispBitmapGlyphStore.setGlyphsSheetMetrics(fontProperties, metrics);

      // Same for spaceAdvancementOverrideForSmallSizesInPx
      crispBitmapGlyphStore.setSpaceAdvancementOverrideForSmallSizesInPx(fontProperties, loadedBitmapFontData[key].spaceAdvancementOverrideForSmallSizesInPx);

      // Remove the script element from the document
      let script = document.querySelector(`script[src="bitmap-fonts-data/${key.replace(/_/g, '-')}.js"]`);
      script.remove();

      // Remove the loadedBitmapFontData entry
      delete loadedBitmapFontData[key];
    }
  }

  // Clean up global variables
  delete window.loadedBitmapFontData;

  // remove the script tag with the manifest
  let manifestScript = document.querySelector('script[src="bitmap-fonts-data/manifest.js"]');
  manifestScript.remove();

  // remove the bitmapFontsManifest object from the window
  delete window.bitmapFontsManifest;

  // remove the imagesFromJs object from the window if it exists
  if (window.imagesFromJs) {
    delete window.imagesFromJs;
  }

  console.log("⏱️ ingestingFontData took " + stopTiming('ingestingFontData') + " milliseconds");

  startTiming('drawTestText');
  const fontProperties = {
    fontSize: 18,
    fontFamily: "Arial",
    fontStyle: "normal",
    fontWeight: "normal",
    pixelDensity: 1
  };
  drawTestText_withStandardClass(fontProperties, crispBitmapGlyphStore);
  console.log("⏱️ drawTestText took " + stopTiming('drawTestText') + " milliseconds");
}
