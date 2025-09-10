let specs = null;
// Keep one specsParser instance only, because it keeps some state to check
// in case the specs string has not changed from the last time it was parsed
const specsParser = new SpecsParser();

function buildAndShowGlyphs() {
  const fontProperties = getFontPropertiesFromUI();

  // If the contents of the specs textarea have changed, parse them, clear all the kerning tables and build
  // the one for the current size.
  // If the contents have not changed, check if the kerning table for the current size exists and if not, build it.
  specs = specsParser.parseSpecsIfChanged(settingsTextarea.value);
  ensureKerningTable();

  if (isNaN(fontProperties.fontSize)) return;

  // Clear the DOM
  removeAllCanvasesAndDivs();
  
  // BUILD operations - generate glyphs
  createGlyphsAndAddToFullStore(fontProperties);
  
  // SHOW operations - display the built glyphs
  drawTestText(fontProperties, bitmapGlyphStore_FAB);
  const bitmapGlyphStore = bitmapGlyphStore_FAB.extractBitmapGlyphStoreInstance();
  drawTestText_withStandardClass(fontProperties, bitmapGlyphStore);
}
