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

addRadioButtonsToSelectText();

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

function buildAndShowGlyphs() {

  var fontSize;

  if (hoverFontSize !== null) {
    fontSize = hoverFontSize;
  }
  else {
    fontSize = selectedFontSize;
  }


  // get the contents of the settings-textarea and split the contents by the --------- separator
  parseSpecs();
  

  if (!isNaN(fontSize)) {
    // remove all canvases and divs from the page
    removeAllCanvasesAndDivs();
    showCharsAndDataForSize(fontSize, fontFamilySelect.value, fontEmphasisSelect.value);
  }

  function removeAllCanvasesAndDivs() {
    const canvases = document.querySelectorAll('canvas');
    for (let i = 0; i < canvases.length; i++) {
      canvases[i].remove();
    }
    const divs = document.querySelectorAll('div');
    for (let i = 0; i < divs.length; i++) {
      // remove all divs that don't have the id "selectors"
      if (divs[i].id !== 'selectors' && divs[i].id !== 'testTextCanvases' && divs[i].id !== 'hoverButtons')
        divs[i].remove();
    }
  }
}

runButton.addEventListener('click', buildAndShowGlyphs);


function showCharsAndDataForSize(fontSize, fontFamily, fontEmphasis) {
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

  //var testText = 'Document Hello World ÀÇ█gMffAVAWWVaWa7a9a/aTaYaPafa information is provided as part of the WorldWideWeb project responsability';
  drawTestText(fontEmphasis, fontSize, fontFamily, crispBitmapGlyphStore);

}


