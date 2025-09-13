// the bitmapFontsManifest variable contains the manifest data
// which looks like:
// bitmapFontsManifest.IDs = ["density-1-arial-style-normal-weight-normal-size-18","density-1-arial-style-normal-weight-normal-size-19"];

// TODO loadedFontMetrics should be called something different, as this is really the data loaded from the JS files
// which is then processed, put in the atlasStore and then deleted
let loadedFontMetrics;

// PNG loading (HTTP protocol)
function loadAtlasesFromPNGsAndLoadAndIngestMetrics() {
  const fontLoader = new FontLoader(atlasStore, fontMetricsStore, (loaded, total) => {
    console.log(`loadedScripts: ${loaded} out of ${total}`);
  });

  fontLoader.loadFonts(bitmapFontsManifest.IDs, false)
    .then(() => {
      console.log("⏱️ loadingFontData took " + stopTiming('loadingFontData') + " milliseconds");
      startTiming('ingestingFontData');
      ingestLoadedFontMetrics();
    });
}

// instead of loading the atlases from PNGs named
//   atlas-density-1-Arial-style-normal-weight-normal-size-18.png
//  , load them from JSs titled
//   image-atlas-density-1-Arial-style-normal-weight-normal-size-18.js
// Loading that JS file will create
// imagesFromJs['atlas-density-1-Arial-style-normal-weight-normal-size-18']
// which will contain the base64 encoded image data

// Function for JS loading (file:// protocol) 
function loadAtlasesFromJSsAndLoadAndIngestMetrics() {
  const fontLoader = new FontLoader(atlasStore, fontMetricsStore, (loaded, total) => {
    console.log(`loadedScripts: ${loaded} out of ${total}`);
  });

  fontLoader.loadFonts(bitmapFontsManifest.IDs, true)
    .then(() => {
      console.log("⏱️ loadingFontData took " + stopTiming('loadingFontData') + " milliseconds");
      startTiming('ingestingFontData');
      ingestLoadedFontMetrics();
    });
}

startTiming('loadingFontData');
// peek into the URL to decide whether to load the atlases from PNGs or JSs
if (window.location.href.includes("file://")) {
  // If you use the renderer from filesystem, it will load the image atlases from the filesystem
  // the problem with that is that when loading images, the browser considers each of them
  // as a separate domain, so they are tainted as cross-origin. You CAN still paint them on a canvas
  // however you can't read the pixels from the canvas, and hence you can't check the hash of the image of
  // generated text.
  //
  // Loading images from .js files instead, the browser considers all of them as the same domain (strange but true),
  // so the images are not tainted as cross-origin.
  // This way you can read the pixels from the canvas and check the hash of the image of generated text.
  loadAtlasesFromJSsAndLoadAndIngestMetrics();
}
else {
  loadAtlasesFromPNGsAndLoadAndIngestMetrics();
}

function ingestLoadedFontMetrics() {
  // Clear existing font metrics for fresh loading
  fontMetricsStore.clear();
  
  for (const key in loadedFontMetrics) {
    const fontProperties = FontProperties.fromIDString(key);
    
    // loadedFontMetrics[key] is a FontMetrics instance (from MetricsExpander.expand)
    const fontMetrics = loadedFontMetrics[key];
    
    // Store the FontMetrics instance directly
    fontMetricsStore.setFontMetrics(fontProperties, fontMetrics);

    // Remove the script element from the document
    let script = document.querySelector(`script[src="../font-assets/metrics-${key.replace(/_/g, '-')}.js"]`);
    if (script) {
      script.remove();
    }

    // Remove the loadedFontMetrics entry
    delete loadedFontMetrics[key];
  }

  // Clean up global variables
  delete window.loadedFontMetrics;

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
  drawTestText_withStandardClass(fontProperties, atlasStore, fontMetricsStore);
  console.log("⏱️ drawTestText took " + stopTiming('drawTestText') + " milliseconds");
}
