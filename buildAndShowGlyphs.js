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
  specsParser.parseSpecsIfChangedAndCalculateKerningsIfNeeded(settingsTextarea.value);

  if (!isNaN(fontSize)) {
    // remove all canvases and divs from the page
    removeAllCanvasesAndDivs();
    showCharsAndDataForSize(fontSize, fontFamilySelect.value, fontStyleSelect.value, fontWeightSelect.value);
  }

}
