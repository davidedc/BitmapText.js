// All characters:
//
// - lower case letters
//     for (let i = 97; i < 123; i++)
//       letter = String.fromCharCode(i);
// - upper case letters
//     for (let i = 65; i < 91; i++)
//       letter = String.fromCharCode(i);
// - numbers
//     for (let i = 48; i < 58; i++) {
//       letter = String.fromCharCode(i);
// - all others
//     ' █ß!"#$%&€\'’()*+,-./:;<=>?@[\]^_`{|}~—£°²·ÀÇàç•';

let characterSet = " █abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ß!\"#$%&€'’()*+,-./:;<=>?@[\\]^_`{|}~—£°²·ÀÇàç•";

function createGlyphsAndAddToFullStore(fontProperties) {
  for (const letter of characterSet) {
    atlasStoreFAB.addGlyph(new GlyphFAB(letter, fontProperties));
  }
}
