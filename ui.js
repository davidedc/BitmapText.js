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

// create a global ENABLE_KERNING boolean vailable and
var ENABLE_KERNING = true;

var PIXEL_DENSITY = null;

// add a checkbox that controls it
const enableKerningCheckbox = document.createElement('input');
enableKerningCheckbox.type = 'checkbox';
enableKerningCheckbox.id = 'enable-kerning-checkbox';
enableKerningCheckbox.checked = ENABLE_KERNING;
document.getElementById("selectors").appendChild(enableKerningCheckbox);
// run the buildAndShowGlyphs function when the user changes the value of the font emphasis select
enableKerningCheckbox.addEventListener('change', function() {

  ENABLE_KERNING = enableKerningCheckbox.checked;
  buildAndShowGlyphs();
});
// add a label for the checkbox
const enableKerningCheckboxLabel = document.createElement('label');
enableKerningCheckboxLabel.textContent = 'Enable kerning';
enableKerningCheckboxLabel.htmlFor = 'enable-kerning-checkbox';
document.getElementById("selectors").appendChild(enableKerningCheckboxLabel);

addCopyChoiceRadioButtons();
addPixelDensityChoiceRadioButtons();

// add a button that when clicked copied to clipboard the JSON of the thisRunsHashes object
const copyToClipboardButton = document.createElement('button');
copyToClipboardButton.id = 'copy-to-clipboard-button';
copyToClipboardButton.textContent = 'Copy collected hashes to clipboard';
document.getElementById("selectors").appendChild(copyToClipboardButton);
copyToClipboardButton.addEventListener('click', function() {
    const thisRunsHashesJSON = JSON.stringify(thisRunsHashes);
    navigator.clipboard.writeText(thisRunsHashesJSON);
  }
);


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