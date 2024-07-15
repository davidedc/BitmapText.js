function buildAndShowGlyphs() {

  let fontSize;

  if (hoverFontSize !== null) {
    fontSize = hoverFontSize;
  }
  else {
    fontSize = selectedFontSize;
  }


  // get the contents of the settings-textarea and split the contents by the --------- separator
  parseSpecs();

  if (!isNaN(fontSize)) {
    // remove all canvases and divs from the page
    removeAllCanvasesAndDivs();
    showCharsAndDataForSize(fontSize, fontFamilySelect.value, fontEmphasisSelect.value);
  }

}
