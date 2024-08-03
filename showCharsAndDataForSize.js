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

function showCharsAndDataForSize(fontSize, fontFamily, fontStyle, fontWeight) {

  for (const letter of characterSet) {
    crispBitmapGlyphStore_Full.addGlyph(new CrispBitmapGlyph_Full(letter, fontSize, fontFamily, fontStyle, fontWeight));
  }

  drawTestText(fontStyle, fontWeight, fontSize, fontFamily, crispBitmapGlyphStore_Full);
}
