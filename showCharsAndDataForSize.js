function showCharsAndDataForSize(fontSize, fontFamily, fontStyle, fontWeight) {

  // set the PIXEL_DENSITY variable depending on the scale radio buttons
  if (document.getElementById('pixel-density-2-radio-button').checked) {
    PIXEL_DENSITY = 2;
  }
  else {
    PIXEL_DENSITY = 1;
  }

  crispBitmapGlyphStore.addGlyph(new CrispBitmapGlyph(' ', fontSize, fontFamily, fontStyle, fontWeight));
  crispBitmapGlyphStore.addGlyph(new CrispBitmapGlyph('█', fontSize, fontFamily, fontStyle, fontWeight));

  // lower case letters
  for (let i = 97; i < 123; i++) {
    const letter = String.fromCharCode(i);
    crispBitmapGlyphStore.addGlyph(new CrispBitmapGlyph(letter, fontSize, fontFamily, fontStyle, fontWeight));
  }

  // upper case letters
  for (let i = 65; i < 91; i++) {
    const letter = String.fromCharCode(i);
    crispBitmapGlyphStore.addGlyph(new CrispBitmapGlyph(letter, fontSize, fontFamily, fontStyle, fontWeight));
  }

  // numbers
  for (let i = 48; i < 58; i++) {
    const letter = String.fromCharCode(i);
    crispBitmapGlyphStore.addGlyph(new CrispBitmapGlyph(letter, fontSize, fontFamily, fontStyle, fontWeight));
  }

  // note that the special charachter ’ below is NOT the single quote character '
  const allOtherChars = 'ß!"#$%&€\'’()*+,-./:;<=>?@[\]^_`{|}~—£°²·ÀÇàç•';
  // all chars in allOtherChars
  for (const element of allOtherChars) {
    const letter = element;
    crispBitmapGlyphStore.addGlyph(new CrispBitmapGlyph(letter, fontSize, fontFamily, fontStyle, fontWeight));
  }

  //var testCopy = 'Document Hello World ÀÇ█gMffAVAWWVaWa7a9a/aTaYaPafa information is provided as part of the WorldWideWeb project responsability';
  drawTestText(fontStyle, fontWeight, fontSize, fontFamily, crispBitmapGlyphStore);

}
