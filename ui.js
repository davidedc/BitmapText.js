/////////////////////////////////////////////////////
//
//   add the size input and run button to the page
//   and kick-off code to show the glyphs and data
//
/////////////////////////////////////////////////////

var selectedFontSize = 80;


// add a dropdown with the font family options
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


// add a dropdown with the font emphasis options
const fontEmphasisSelect = document.createElement('select');
fontEmphasisSelect.id = 'font-emphasis-select';
const fontEmphases = ['normal', 'bold', 'italic', 'bold italic'];
for (let i = 0; i < fontEmphases.length; i++) {
  const option = document.createElement('option');
  option.value = fontEmphases[i];
  option.textContent = fontEmphases[i];
  fontEmphasisSelect.appendChild(option);
}
document.getElementById("selectors").appendChild(fontEmphasisSelect);
// run the buildAndShowGlyphs function when the user changes the value of the font emphasis select
fontEmphasisSelect.addEventListener('change', buildAndShowGlyphs);


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

// add to the "selectors" div a multiline textbox input where we have some settings related to the rendering.
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
const hoverButtonsDiv = document.createElement('div');
hoverButtonsDiv.id = 'hoverButtons';
document.getElementById("selectors").appendChild(hoverButtonsDiv);

var hoverFontSize = null;

for (let i = 0; i < 81; i++) {
  const button = document.createElement('button');
  // set the id to "button-size-<i>"
  button.id = 'button-size-' + i;
  button.textContent = i;
  button.style.width = '30px';
  button.style.height = '30px';
  button.style.margin = '2px';
  button.style.padding = '0px';
  button.style.border = '0px';
  button.style.backgroundColor = 'white';
  button.style.color = 'black';
  button.style.fontSize = '12px';
  button.style.fontWeight = 'normal';
  button.style.fontStyle = 'normal';
  button.style.fontFamily = 'Arial';
  button.style.textAlign = 'center';
  button.style.verticalAlign = 'middle';
  button.style.lineHeight = '30px';
  button.style.cursor = 'pointer';

  button.addEventListener('mouseover', function() {
    hoverFontSize = i;
    // set the button background color to light gray
    if (selectedFontSize !== i) {
      button.style.backgroundColor = 'lightgray';
    }
    buildAndShowGlyphs();
  });

  // when the mouse exits the button, set the hoverFontSize to null
  button.addEventListener('mouseout', function() {
    hoverFontSize = null;
    // set the button background color to white unless it is the selectedFontSize
    if (selectedFontSize !== i) {
      button.style.backgroundColor = 'white';
    }
    buildAndShowGlyphs();
  });


  // when you click on the button, you set the selectedFontSize to the number of the button
  // and color the button dark gray
  button.addEventListener('click', function() {

    if (selectedFontSize !== null) {
      const oldButton = document.getElementById('button-size-' + selectedFontSize);
      oldButton.style.backgroundColor = 'white';
    }

    selectedFontSize = i;
    button.style.backgroundColor = 'darkgray';
  });


  hoverButtonsDiv.appendChild(button);
}

// make the button of the default selectedFontSize dark gray
const defaultSizeButton = document.getElementById('button-size-' + selectedFontSize);
defaultSizeButton.style.backgroundColor = 'darkgray';



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


