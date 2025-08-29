// Show-only functionality for displaying glyphs without building them
// This is used by text-render-tests.html to render pre-built font data

function getFontPropertiesFromUI() {
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

  return {
    fontSize,
    fontFamily: fontFamilySelect.value,
    fontStyle: fontStyleSelect.value,
    fontWeight: fontWeightSelect.value,
    pixelDensity
  };
}

// Show glyphs using pre-built data (for text-render-tests.html)
function showGlyphs() {
  const fontProperties = getFontPropertiesFromUI();
  
  if (isNaN(fontProperties.fontSize)) return;

  // Clear the DOM
  removeAllCanvasesAndDivs();
  
  // Render using standard classes only (no building required)
  drawTestText_withStandardClass(fontProperties, bitmapGlyphStore);
}

// Show glyphs with editor functionality (for font-builder.html)
function showGlyphs_withEditor(fontProperties) {
  // Clear the DOM
  removeAllCanvasesAndDivs();
  
  // Draw with Editor classes
  drawTestText(fontProperties, bitmapGlyphStore_Editor);
  
  // Extract standard store and draw with it too
  const bitmapGlyphStore = bitmapGlyphStore_Editor.extractBitmapGlyphStoreInstance();
  drawTestText_withStandardClass(fontProperties, bitmapGlyphStore);
}