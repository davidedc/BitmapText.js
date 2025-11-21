function addDropdownWithFontFamilies() {
  // Initialize CharacterSetRegistry for fonts with custom character sets
  // BitmapTextSymbols: 18 special Unicode symbols
  CharacterSetRegistry.setDisplayCharacterSet('BitmapTextSymbols', '☺☹♠♡♦♣│─├└▶▼▲◀✔✘≠↗');

  const fontFamilySelect = document.createElement('select');
  fontFamilySelect.id = 'font-family-select';
  const fontFamilies = ['Arial', 'BitmapTextSymbols', 'Courier New', 'Times New Roman', 'Verdana', 'Georgia', 'Comic Sans MS', 'Impact', 'Lucida Console', 'Lucida Sans Unicode', 'Tahoma', 'Trebuchet MS'];
  for (const element of fontFamilies) {
    const option = document.createElement('option');
    option.value = element;
    option.textContent = element;
    fontFamilySelect.appendChild(option);
  }
  document.getElementById("selectors").appendChild(fontFamilySelect);
  // run the buildAndShowGlyphs function when the user changes the value of the font family select
  fontFamilySelect.addEventListener('change', updatePageContent);
  return fontFamilySelect;
}
