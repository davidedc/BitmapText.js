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
