// Creates glyphs for all characters in the character set
// This is used by the font-assets-builder to generate glyph data

function createGlyphsAndAddToFullStore(fontProperties) {
  let characterSet;
  if (fontProperties.fontFamily === 'BitmapTextSymbols') {
    console.log(`📝 Creating glyphs for symbol font: ${fontProperties.fontFamily}`);
    characterSet = BitmapText.SYMBOL_CHARACTERS_STRING;
  } else {
    characterSet = BitmapText.CHARACTER_SET;
  }

  for (const char of characterSet) {
    AtlasDataStoreFAB.addGlyph(new GlyphFAB(char, fontProperties));
  }
}
