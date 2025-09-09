// Show-only functionality for displaying glyphs without building them
// This is used by text-render-tests.html to render pre-built font data

// Check if font metrics and kerning data are available (needed for text measurement and positioning)
function isFontMetricsAvailable(fontProperties, bitmapGlyphStore) {
  try {
    // Use BitmapGlyphStore's getter
    const kerningTable = bitmapGlyphStore.getKerningTable(fontProperties);
    const hasKerningTables = kerningTable !== undefined && kerningTable !== null;
    
    // Check if any glyphs exist for this font by looking for keys that start with the base key
    const baseKey = fontProperties.key;
    const hasGlyphsTextMetrics = [...bitmapGlyphStore.glyphsTextMetrics.keys()]
      .some(key => key.startsWith(baseKey + ':'));
    
    // Check if any glyph sheet metrics exist for this font
    const hasGlyphSheetMetrics = [...bitmapGlyphStore.glyphSheetsMetrics.tightWidth.keys()]
      .some(key => key.startsWith(baseKey + ':'));
    
    return hasKerningTables && hasGlyphsTextMetrics && hasGlyphSheetMetrics;
  } catch (error) {
    return false;
  }
}

// Check if glyph sheet images are available (needed for actual glyph rendering)
function isGlyphSheetAvailable(fontProperties, bitmapGlyphStore) {
  try {
    const glyphSheet = bitmapGlyphStore.getGlyphSheet(fontProperties);
    return bitmapGlyphStore.isValidGlyphSheet(glyphSheet);
  } catch (error) {
    return false;
  }
}


// Clear error messages explicitly
function clearErrors() {
  const errors = document.querySelectorAll('#testCopyCanvases > div[style*="color: red"]');
  errors.forEach(error => error.remove());
}

// Show user-friendly error message
function showFontError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = 'color: red; font-weight: bold; padding: 10px; background-color: #ffe6e6; border: 1px solid red; margin: 5px;';
  errorDiv.textContent = message;
  document.getElementById('testCopyCanvases').appendChild(errorDiv);
}

// Show user-friendly warning message
function showFontWarning(message) {
  const warningDiv = document.createElement('div');
  warningDiv.style.cssText = 'color: #cc6600; font-weight: bold; padding: 10px; background-color: #fff5e6; border: 1px solid #cc6600; margin: 5px;';
  warningDiv.textContent = message;
  document.getElementById('testCopyCanvases').appendChild(warningDiv);
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
  clearErrors();  // Also explicitly clear any lingering error messages
  
  // Check availability levels
  const hasMetrics = isFontMetricsAvailable(fontProperties, bitmapGlyphStore);
  const hasGlyphSheets = isGlyphSheetAvailable(fontProperties, bitmapGlyphStore);
  
  if (!hasMetrics) {
    showFontError(`Font metrics not available for ${fontProperties.fontSize}px ${fontProperties.fontFamily} ${fontProperties.fontStyle} ${fontProperties.fontWeight}. Available sizes may be limited.`);
    return;
  }
  
  // If metrics are available but glyph sheets are not, show warning about placeholder mode
  if (hasMetrics && !hasGlyphSheets) {
    showFontWarning(`Glyph sheets not loaded for ${fontProperties.fontSize}px ${fontProperties.fontFamily} ${fontProperties.fontStyle} ${fontProperties.fontWeight}. Rendering placeholder rectangles with correct dimensions and spacing.`);
  }
  
  try {
    // Render using standard classes - will automatically use placeholder mode if glyph sheets missing
    drawTestText_withStandardClass(fontProperties, bitmapGlyphStore);
  } catch (error) {
    showFontError(`Error rendering text: ${error.message}`);
    console.error('Error in showGlyphs:', error);
  }
}