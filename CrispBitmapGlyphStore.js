// a class to store all the crispBitmapGlyphs
// so that we can retrieve them by font family, font size and letter
class CrispBitmapGlyphStore {
  constructor() {
    this.glyphs = {};
  }

  addGlyph(glyph) {
    if (!this.glyphs[glyph.fontFamily]) {
      this.glyphs[glyph.fontFamily] = {};
    }
    if (!this.glyphs[glyph.fontFamily][glyph.fontEmphasis]) {
      this.glyphs[glyph.fontFamily][glyph.fontEmphasis] = {};
    }
    if (!this.glyphs[glyph.fontFamily][glyph.fontEmphasis][glyph.fontSize]) {
      this.glyphs[glyph.fontFamily][glyph.fontEmphasis][glyph.fontSize] = {};
    }
    if (!this.glyphs[glyph.fontFamily][glyph.fontEmphasis][glyph.fontSize][glyph.letter]) {
      this.glyphs[glyph.fontFamily][glyph.fontEmphasis][glyph.fontSize][glyph.letter] = glyph;
    }
  }

  getGlyph(fontFamily, fontSize, letter, fontEmphasis) {
    if (this.glyphs[fontFamily] && this.glyphs[fontFamily][fontEmphasis] && this.glyphs[fontFamily][fontEmphasis][fontSize] && this.glyphs[fontFamily][fontEmphasis][fontSize][letter]) {
      return this.glyphs[fontFamily][fontEmphasis][fontSize][letter];
    }
    return null;
  }
}
