let specs = null;
// Keep one specsParser instance only, because it keeps some state to check
// in case the specs string has not changed from the last time it was parsed
const specsParser = new SpecsParser();

function buildAndShowGlyphs() {
  let fontSize;

  if (hoverFontSize !== null) {
    fontSize = hoverFontSize;
  }
  else {
    fontSize = selectedFontSize;
  }

  // Set the PIXEL_DENSITY variable depending on the scale radio buttons
  if (document.getElementById('pixel-density-2-radio-button').checked) {
    PIXEL_DENSITY = 2;
  }
  else {
    PIXEL_DENSITY = 1;
  }
  
  // If the contents of the specs textarea have changed, parse them, clear all the kerning tables and build
  // the one for the current size.
  // If the contents have not changed, check if the kerning table for the current size exists and if not, build it.
  specs = specsParser.parseSpecsIfChanged(settingsTextarea.value);
  buildKerningTableIfDoesntExist();

  if (isNaN(fontSize)) return;

  // Remove all canvases and divs from the page
  removeAllCanvasesAndDivs();
  createGlyphsAndAddToFullStore(fontSize, fontFamilySelect.value, fontStyleSelect.value, fontWeightSelect.value);
  drawTestText(fontStyleSelect.value, fontWeightSelect.value, fontSize, fontFamilySelect.value, crispBitmapGlyphStore_Full);
  const crispBitmapGlyphStore = crispBitmapGlyphStore_Full.extractCrispBitmapGlyphStoreInstance();
  drawTestText_withStandardClass(fontStyleSelect.value, fontWeightSelect.value, fontSize, fontFamilySelect.value, crispBitmapGlyphStore);  
  
}
