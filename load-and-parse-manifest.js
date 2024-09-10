// the bitmapFontsManifest variable now contains the manifest data
// which looks like:
// bitmapFontsManifest.files = ["glyphs-sheet-density-1-arial-style-normal-weight-normal-size-18","glyphs-sheet-density-1-arial-style-normal-weight-normal-size-19"];

// Go through each filename in the manifest and load two files
// via script tag
// i.e. [filename].js and [filename].png

let loadedScripts = 0;

// TODO bitmapFontsData should be called something different, as this is really the data loaded from the JS files
// which is then processed, put in the crispBitmapGlyphStore and then deleted
let bitmapFontsData;

function bitmapFontJsOrImageLoaded() {
  // if all the scripts/images have been loaded, call the buildAndShowGlyphs function
  // do the check by comparing the number of files in the manifest to the number of loaded scripts
  loadedScripts++;
  console.log(`loadedScripts: ${loadedScripts} out of ${bitmapFontsManifest.files.length * 2}`);
  if (loadedScripts === bitmapFontsManifest.files.length * 2) {
    console.log("⏱️ loadingFontData took " + stopTiming('loadingFontData') + " milliseconds");
    startTiming('ingestingFontData');
    ingestBitmapFontsData();
  }
}

function loadSheetsFromPNGs() {
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
      
      // TODO we create a Canvas element and draw the image on it HOWEVER
      // we could just use the image directly in the drawImage function.
      // (note that in the editor we indeed use the canvas, we can't use the image directly because
      // it's tricky to wait for the image to be created from the canvas as it's an async operation).
  
      // attach the image to the document
      document.body.appendChild(img);
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
      setNestedProperty(crispBitmapGlyphStore.glyphsSheets, [density, fontFamily, style, weight, size], img);
      
      bitmapFontJsOrImageLoaded();
    }
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
    
    // when the script is loaded, call a "bitmapFontJsLoaded" function
    script.onload = function() {
      // now we have to load the JS file that contains the image data
      let imageScript = document.createElement('script');
      imageScript.src = `bitmap-fonts-data/image-${filename}.js`;
      console.log(`loading image-${filename}.js ...`);
      document.head.appendChild(imageScript);
      
      imageScript.onload = function() {
        bitmapFontJsOrImageLoaded();
        console.log(`...loaded image-${filename}.js`);
        // now take the image data from the imagesFromJs object
        let imageData = imagesFromJs[filename];
        // print the image data length
        console.log(`image data length: ${imageData.length}`);
        // create an image from the image data
        let img = new Image();
        img.src = `data:image/png;base64,${imageData}`;
        img.onload = function() {
          // remove the script with the image data from the document
          imageScript.remove();

          // remove the image data from the imagesFromJs object
          delete imagesFromJs[filename];

          console.log("image loaded from JS base64 data");
          // attach the glyphs sheet to the document, for debugging purposes only
          document.body.appendChild(img);
          // and then a newline
          document.body.appendChild(document.createElement('br'));
          // extract the pixel density, font family, style, weight, size from the filename of the type:
          // glyphs-sheet-density-1-arial-style-normal-weight-normal-size-18
          const [, , , density, fontFamily, , style, , weight, , size] = filename.split('-');
          // add the canvas to the crispBitmapGlyphStore
          setNestedProperty(crispBitmapGlyphStore.glyphsSheets, [density, fontFamily, style, weight, size], img);
          bitmapFontJsOrImageLoaded();
        }
      }
    }
  }
}

// peek into the URL to decide whether to load the sheets from PNGs or JSs
startTiming('loadingFontData');
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
} else {
  loadSheetsFromPNGs();
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

      // remove the script element from the document
      // the source of the script follows the format "bitmap-fonts-data/glyphs-sheet-density-1-arial-style-normal-weight-normal-size-18.js"
      // so from the key we have to replace the underscores with dashes
      let script = document.querySelector(`script[src="bitmap-fonts-data/${key.replace(/_/g, '-')}.js"]`);
      script.remove();

      // remove the  bitmapFontsData entry
      delete bitmapFontsData[key];      
    }
  }

  // remove the bitmapFontsData object from the window
  delete window.bitmapFontsData;

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
  PIXEL_DENSITY = 1;
  drawTestText_withStandardClass("normal", "normal", 18, "Arial", crispBitmapGlyphStore);
  console.log("⏱️ drawTestText took " + stopTiming('drawTestText') + " milliseconds");
}