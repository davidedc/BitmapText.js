// Creates glyphs for all characters in the character set
// This is used by the font-assets-builder to generate glyph data

function createGlyphsAndAddToFullStore(fontProperties) {
  for (const char of BitmapText.CHARACTER_SET) {
    AtlasDataStoreFAB.addGlyph(new GlyphFAB(char, fontProperties));
  }
}
