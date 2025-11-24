// Creates glyphs for all characters in the character set
// This is used by the font-assets-builder to generate glyph data

function createGlyphsAndAddToFullStore(fontProperties) {
  let characterSet;
  if (fontProperties.fontFamily === 'BitmapTextInvariant') {
    console.log(`📝 Creating glyphs for font-invariant font: ${fontProperties.fontFamily}`);
    characterSet = CharacterSets.FONT_INVARIANT_CHARS;
  } else {
    characterSet = CharacterSets.FONT_SPECIFIC_CHARS;
  }

  for (const char of characterSet) {
    AtlasDataStoreFAB.addGlyph(new GlyphFAB(char, fontProperties));
  }
}
