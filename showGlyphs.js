// Show-only functionality for displaying glyphs without building them
// This is used by text-render-tests.html to render pre-built font data

// Check if a font configuration is available in the bitmap glyph store
function isFontDataAvailable(fontProperties, bitmapGlyphStore) {
  try {
    // Check if the font configuration exists in the loaded data
    const { pixelDensity, fontFamily, fontStyle, fontWeight, fontSize } = fontProperties;
    
    return bitmapGlyphStore.glyphSheets &&
           bitmapGlyphStore.glyphSheets[pixelDensity] &&
           bitmapGlyphStore.glyphSheets[pixelDensity][fontFamily] &&
           bitmapGlyphStore.glyphSheets[pixelDensity][fontFamily][fontStyle] &&
           bitmapGlyphStore.glyphSheets[pixelDensity][fontFamily][fontStyle][fontWeight] &&
           bitmapGlyphStore.glyphSheets[pixelDensity][fontFamily][fontStyle][fontWeight][fontSize];
  } catch (error) {
    return false;
  }
}

// Show user-friendly error message
function showFontError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = 'color: red; font-weight: bold; padding: 10px; background-color: #ffe6e6; border: 1px solid red; margin: 5px;';
  errorDiv.textContent = message;
  document.getElementById('testCopyCanvases').appendChild(errorDiv);
}

// Show glyphs using pre-built data (for text-render-tests.html)
function showGlyphs() {
  const fontProperties = getFontPropertiesFromUI();
  
  if (isNaN(fontProperties.fontSize)) {
    showFontError('Invalid font size');
    return;
  }

  // Clear the DOM
  removeAllCanvasesAndDivs();
  
  // Check if font data is available
  if (!isFontDataAvailable(fontProperties, bitmapGlyphStore)) {
    showFontError(`Font size ${fontProperties.fontSize}px is not available for ${fontProperties.fontFamily} ${fontProperties.fontStyle} ${fontProperties.fontWeight}. Available sizes may be limited.`);
    return;
  }
  
  try {
    // Render using standard classes only (no building required)
    drawTestText_withStandardClass(fontProperties, bitmapGlyphStore);
  } catch (error) {
    showFontError(`Error rendering text: ${error.message}`);
    console.error('Error in showGlyphs:', error);
  }
}