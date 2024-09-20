let specs = null;
// Keep one specsParser instance only, because it keeps some state to check
// in case the specs string has not changed from the last time it was parsed
const specsParser = new SpecsParser();

function buildAndShowGlyphs() {
  let fontSize, pixelDensity;

  if (hoverFontSize !== null) {
    fontSize = hoverFontSize;
  }
  else {
    fontSize = selectedFontSize;
  }

  if (document.getElementById('pixel-density-2-radio-button').checked) {
    pixelDensity = 2;
  }
  else {
    pixelDensity = 1;
  }

  // Create the fontProperties object
  const fontProperties = {
    fontSize,
    fontFamily: fontFamilySelect.value,
    fontStyle: fontStyleSelect.value,
    fontWeight: fontWeightSelect.value,
    pixelDensity
  };

  // If the contents of the specs textarea have changed, parse them, clear all the kerning tables and build
  // the one for the current size.
  // If the contents have not changed, check if the kerning table for the current size exists and if not, build it.
  specs = specsParser.parseSpecsIfChanged(settingsTextarea.value);
  buildKerningTableIfDoesntExist(fontProperties);

  if (isNaN(fontSize)) return;

  // Remove all canvases and divs from the page
  removeAllCanvasesAndDivs();
  createGlyphsAndAddToFullStore(fontProperties);
  drawTestText(fontProperties, bitmapGlyphStore_Full);
  const bitmapGlyphStore = bitmapGlyphStore_Full.extractBitmapGlyphStoreInstance();
  drawTestText_withStandardClass(fontProperties, bitmapGlyphStore);
}
