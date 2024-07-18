// Note a couple of things:
//  - link to definitions of font-weight and font-style:
//    https://www.w3schools.com/tags/canvas_font.asp
//  - note that underline would be a text-decoration
//    https://developer.mozilla.org/en-US/docs/Web/CSS/text-
//    HOWEVER it's not supported by HTML5 canvas
//    so one needs to draw the underline manually.

function addFontWeightDropdown() {
  const fontWeightSelect = document.createElement('select');
  fontWeightSelect.id = 'font-weight-select';

  const fontWeights = ['normal', 'bold', 'bolder', 'lighter', '100', '200', '300', '400', '500', '600', '700', '800', '900'];
  for (const element of fontWeights) {
    const option = document.createElement('option');
    option.value = element;
    option.textContent = element;
    fontWeightSelect.appendChild(option);
  }
  document.getElementById("selectors").appendChild(fontWeightSelect);
  // run the buildAndShowGlyphs function when the user changes the value of the font weight select
  fontWeightSelect.addEventListener('change', buildAndShowGlyphs);
  return fontWeightSelect;
}
