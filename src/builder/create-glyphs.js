// Creates glyphs for all characters in the character set
// This is used by the font-assets-builder to generate glyph data

function createGlyphsAndAddToFullStore(fontProperties) {
  // Always create glyphs for all 204 standard characters (for minifier compatibility)
  for (const char of BitmapText.CHARACTER_SET) {
    AtlasDataStoreFAB.addGlyph(new GlyphFAB(char, fontProperties));
  }

  // If this font family has a custom character set, also create glyphs for those characters
  // This ensures symbol fonts like BitmapTextSymbols have the actual symbols in addition to standard chars
  const customCharSet = CharacterSetRegistry.getDisplayCharacterSet(fontProperties.fontFamily);
  if (customCharSet) {
    console.log(`📝 Creating additional glyphs for custom character set: ${fontProperties.fontFamily}`);
    console.log(`   Custom characters: ${customCharSet}`);
    for (const char of customCharSet) {
      // Skip if already created (though unlikely with symbol fonts)
      if (!BitmapText.CHARACTER_SET.includes(char)) {
        AtlasDataStoreFAB.addGlyph(new GlyphFAB(char, fontProperties));
      }
    }
  }
}
