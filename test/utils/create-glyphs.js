// All characters:
//
// - lower case chars
//     for (let i = 97; i < 123; i++)
//       char = String.fromCharCode(i);
// - upper case chars
//     for (let i = 65; i < 91; i++)
//       char = String.fromCharCode(i);
// - numbers
//     for (let i = 48; i < 58; i++) {
//       char = String.fromCharCode(i);
// - all others
//     ' █ß!"#$%&€\'’()*+,-./:;<=>?@[\]^_`{|}~—£°²·ÀÇàç•';

let characterSet = " █abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ß!\"#$%&€'’()*+,-./:;<=>?@[\\]^_`{|}~—£°²·ÀÇàç•";

function createGlyphsAndAddToFullStore(fontProperties) {
  for (const char of characterSet) {
    atlasDataStoreFAB.addGlyph(new GlyphFAB(char, fontProperties));
  }
}
