function addDropdownWithFontFamilies() {
  const fontFamilySelect = document.createElement('select');
  fontFamilySelect.id = 'font-family-select';
  const fontFamilies = ['Arial', 'Courier New', 'Times New Roman', 'Verdana', 'Georgia', 'Comic Sans MS', 'Impact', 'Lucida Console', 'Lucida Sans Unicode', 'Tahoma', 'Trebuchet MS'];
  for (let i = 0; i < fontFamilies.length; i++) {
    const option = document.createElement('option');
    option.value = fontFamilies[i];
    option.textContent = fontFamilies[i];
    fontFamilySelect.appendChild(option);
  }
  document.getElementById("selectors").appendChild(fontFamilySelect);
  // run the buildAndShowGlyphs function when the user changes the value of the font family select
  fontFamilySelect.addEventListener('change', buildAndShowGlyphs);
  return fontFamilySelect;
}
