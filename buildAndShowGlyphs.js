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

  // If the contents of the specs textarea have changed, parse them, clear all the kerning tables and build
  // the one for the current size.
  // If the contents have not changed, check if the kerning table for the current size exists and if not, build it.
  specs = specsParser.parseSpecsIfChanged(settingsTextarea.value);
  buildKerningTableIfDoesntExist();

  if (!isNaN(fontSize)) {
    // remove all canvases and divs from the page
    removeAllCanvasesAndDivs();
    showCharsAndDataForSize(fontSize, fontFamilySelect.value, fontStyleSelect.value, fontWeightSelect.value);
  }

}
