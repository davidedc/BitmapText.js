// Note a couple of things:
//  - link to definitions of font-weight and font-style:
//    https://www.w3schools.com/tags/canvas_font.asp
//  - note that underline would be a text-decoration
//    https://developer.mozilla.org/en-US/docs/Web/CSS/text-
//    HOWEVER it's not supported by HTML5 canvas
//    so one needs to draw the underline manually.

function addFontStyleDropdown() {
  const fontStyleSelect = document.createElement('select');
  fontStyleSelect.id = 'font-style-select';

  const fontStyles = ['normal', 'italic', 'oblique'];
  for (const element of fontStyles) {
    const option = document.createElement('option');
    option.value = element;
    option.textContent = element;
    fontStyleSelect.appendChild(option);
  }
  document.getElementById("selectors").appendChild(fontStyleSelect);
  // run the buildAndShowGlyphs function when the user changes the value of the font style select
  fontStyleSelect.addEventListener('change', buildAndShowGlyphs);
  return fontStyleSelect;
}
