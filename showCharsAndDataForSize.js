function showCharsAndDataForSize(fontSize, fontFamily, fontEmphasis) {

  // set the SCALE variable depending on the scale radio buttons
  if (document.getElementById('scale-2-radio-button').checked) {
    SCALE = 2;
  }
  else {
    SCALE = 1;
  }


  // create a new CrispBitmapGlyph object
  var crispBitmapGlyphStore = new CrispBitmapGlyphStore();

  crispBitmapGlyphStore.addGlyph(new CrispBitmapGlyph(' ', fontSize, fontFamily, fontEmphasis));
  crispBitmapGlyphStore.addGlyph(new CrispBitmapGlyph('█', fontSize, fontFamily, fontEmphasis));

  // lower case letters
  for (let i = 97; i < 123; i++) {
    const letter = String.fromCharCode(i);
    crispBitmapGlyphStore.addGlyph(new CrispBitmapGlyph(letter, fontSize, fontFamily, fontEmphasis));
  }

  // upper case letters
  for (let i = 65; i < 91; i++) {
    const letter = String.fromCharCode(i);
    crispBitmapGlyphStore.addGlyph(new CrispBitmapGlyph(letter, fontSize, fontFamily, fontEmphasis));
  }

  // numbers
  for (let i = 48; i < 58; i++) {
    const letter = String.fromCharCode(i);
    crispBitmapGlyphStore.addGlyph(new CrispBitmapGlyph(letter, fontSize, fontFamily, fontEmphasis));
  }

  // note that the special charachter ’ below is NOT the single quote character '
  allOtherChars = 'ß!"#$%&€\'’()*+,-./:;<=>?@[\]^_`{|}~—£°²·ÀÇàç•';
  // all chars in allOtherChars
  for (let i = 0; i < allOtherChars.length; i++) {
    const letter = allOtherChars[i];
    crispBitmapGlyphStore.addGlyph(new CrispBitmapGlyph(letter, fontSize, fontFamily, fontEmphasis));
  }

  //var testCopy = 'Document Hello World ÀÇ█gMffAVAWWVaWa7a9a/aTaYaPafa information is provided as part of the WorldWideWeb project responsability';
  drawTestText(fontEmphasis, fontSize, fontFamily, crispBitmapGlyphStore);

}
