// Note a couple of things:
//  - this notion of emphasis is not a CSS thing, or actually
//    it is a CSS thing but it's something entirely different, see
//    https://developer.mozilla.org/en-US/docs/Web/CSS/text-emphasis
//  - this notion of emphasis is a combination of weight and style
//  - 'bold' is a weight
//  - the others i.e. 'italic' and 'normal' are styles
//  - link to definitions of font-weight and font-style:
//    https://www.w3schools.com/tags/canvas_font.asp
//  - note that underline would be a text-decoration
//    https://developer.mozilla.org/en-US/docs/Web/CSS/text-
//    HOWEVER it's not supported by HTML5 canvas
//    so one needs to draw the underline manually.

function addFontEmphasisDropdown() {
  const fontEmphasisSelect = document.createElement('select');
  fontEmphasisSelect.id = 'font-emphasis-select';

  const fontEmphases = ['normal', 'bold', 'italic', 'bold italic'];
  for (const element of fontEmphases) {
    const option = document.createElement('option');
    option.value = element;
    option.textContent = element;
    fontEmphasisSelect.appendChild(option);
  }
  document.getElementById("selectors").appendChild(fontEmphasisSelect);
  // run the buildAndShowGlyphs function when the user changes the value of the font emphasis select
  fontEmphasisSelect.addEventListener('change', buildAndShowGlyphs);
  return fontEmphasisSelect;
}
