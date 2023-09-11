/////////////////////////////////////////////////////
//
//   add the size input and run button to the page
//   and kick-off code to show the glyphs and data
//
/////////////////////////////////////////////////////



// add a dropdown with the font family options
const fontFamilySelect = addDropdownWithFontFamilies();


// add a dropdown with the font emphasis options
const fontEmphasisSelect = addFontEmphasisDropdown();


const runButton = document.createElement('button');
runButton.id = 'run-button';
runButton.textContent = 'Build and Show Glyphs';
document.getElementById("selectors").appendChild(runButton);

// create a global USE_KERNING_FROM_SPECS boolean vailable and
var USE_KERNING_FROM_SPECS = true;

// add a checkbox that controls it
const useKerningFromSpecsCheckbox = document.createElement('input');
useKerningFromSpecsCheckbox.type = 'checkbox';
useKerningFromSpecsCheckbox.id = 'use-kerning-from-specs-checkbox';
useKerningFromSpecsCheckbox.checked = USE_KERNING_FROM_SPECS;
document.getElementById("selectors").appendChild(useKerningFromSpecsCheckbox);
// run the buildAndShowGlyphs function when the user changes the value of the font emphasis select
useKerningFromSpecsCheckbox.addEventListener('change', function() {

  USE_KERNING_FROM_SPECS = useKerningFromSpecsCheckbox.checked;
  buildAndShowGlyphs();
});
// add a label for the checkbox
const useKerningFromSpecsCheckboxLabel = document.createElement('label');
useKerningFromSpecsCheckboxLabel.textContent = 'Use kerning from specs';
useKerningFromSpecsCheckboxLabel.htmlFor = 'use-kerning-from-specs-checkbox';
document.getElementById("selectors").appendChild(useKerningFromSpecsCheckboxLabel);

addCopyChoiceRadioButtons();

document.getElementById("selectors").appendChild(document.createElement('br'));

// add to the "selectors" div a multiline textbox input where we have the specs related to the rendering.
// and buildAndShowGlyphs() when the user clicks out of it
const settingsTextarea = document.createElement('textarea');
settingsTextarea.id = 'settings-textarea';
settingsTextarea.style.float = 'left';

settingsTextarea.value = specsText;
document.getElementById("selectors").appendChild(settingsTextarea);
// settingsTextarea.addEventListener('change', buildAndShowGlyphs);
settingsTextarea.style.height = '200px';
settingsTextarea.style.width = '333px';

// add to the selectors div 81 square buttons numbered from 0 to 80,
// and when the user hovers over them, set the size input to the number

// create a new div "hoverButtons" where we will put the buttons
var hoverFontSize = null;
var selectedFontSize = 80;
hoverFontSize = addSizeButtons();



// append a line break
document.body.appendChild(document.createElement('br'));

runButton.addEventListener('click', buildAndShowGlyphs);