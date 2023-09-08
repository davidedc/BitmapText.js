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

  allOtherChars = '!"#$%&€\'()*+,-./:;<=>?@[\]^_`{|}~—£°²·ÀÇàç•';
  // all chars in allOtherChars
  for (let i = 0; i < allOtherChars.length; i++) {
    const letter = allOtherChars[i];
    crispBitmapGlyphStore.addGlyph(new CrispBitmapGlyph(letter, fontSize, fontFamily, fontEmphasis));
  }

  //var testText = 'Document Hello World ÀÇ█gMffAVAWWVaWa7a9a/aTaYaPafa information is provided as part of the WorldWideWeb project responsability';
  var testText = 'Access to this information is provided as part of the WorldWideWeb project. The WWW';
  var testText2 = 'project does not take responsability for the accuracy of information provided by others';
  var testText3 = 'References to other information are represented like this. Double-click on it to jump to';
  var testText4 = 'related information.';
  var testText5 = 'Now choose an area in which you would like to start browsing. The system currently has';
  var testText6 = 'access to three sources of information. With the indexes, you should use the keyword';
  var testText7 = 'f to check actualBoundingBoxLeft doesn\'t cause f to be drawn outside the canvas.';

  //var testText = 'project does not take responsability for the accuracy of information provided by others.';
  

  // create a canvas just to find the text measures for the antialiased version (easy: don't add it to the DOM)
  const canvas4 = document.createElement('canvas');
  const ctx4 = canvas4.getContext('2d');
  ctx4.font = fontEmphasis + " " + fontSize + 'px ' + fontFamily;
  const testTextMeasures = ctx4.measureText(testText);

  // create a canvas to find the text measures for the crisp version (we need to add it to the DOM for the CSS properties to be applied)
  const canvas5 = document.createElement('canvas');
  canvas5.width = 1;
  canvas5.height = 1;
  document.getElementById("testTextCanvases").appendChild(canvas5);
  const ctx5 = canvas5.getContext('2d');
  ctx5.font = fontEmphasis + " " + fontSize + 'px ' + fontFamily;
  const testTextMeasuresCrisp = ctx5.measureText(testText);




  // add another canvas at the top of the page and draw "Hello World" on it using the CrispBitmapText
  // add some text above the canvas to say what it is
  const div = document.createElement('div');
  div.textContent = 'Crisp Bitmap Text Drawing:';
  document.getElementById("testTextCanvases").appendChild(div);
  const canvas = document.createElement('canvas');
  // TODO need to use own measureText method of the Crisp kind
  // get the measures of the text from the CrispBitmapText measureText method
  const crispBitmapText = new CrispBitmapText(crispBitmapGlyphStore);
  const crispTestTextMeasures = crispBitmapText.measureText(testText, fontSize, fontFamily, fontEmphasis);
  canvas.width = crispTestTextMeasures.width;
  canvas.height = crispTestTextMeasures.height * 7;
  document.getElementById("testTextCanvases").appendChild(canvas);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  crispBitmapText.drawText(ctx, testText, 0, Math.round(canvas.height - 6 * crispTestTextMeasures.height -1), fontSize, fontFamily, fontEmphasis);
  crispBitmapText.drawText(ctx, testText2, 0, Math.round(canvas.height - 5 * crispTestTextMeasures.height -1), fontSize, fontFamily, fontEmphasis);
  crispBitmapText.drawText(ctx, testText3, 0, Math.round(canvas.height - 4 * crispTestTextMeasures.height -1), fontSize, fontFamily, fontEmphasis);
  crispBitmapText.drawText(ctx, testText4, 0, Math.round(canvas.height - 3 * crispTestTextMeasures.height -1), fontSize, fontFamily, fontEmphasis);
  crispBitmapText.drawText(ctx, testText5, 0, Math.round(canvas.height - 2 * crispTestTextMeasures.height -1), fontSize, fontFamily, fontEmphasis);
  crispBitmapText.drawText(ctx, testText6, 0, Math.round(canvas.height - 1 * crispTestTextMeasures.height -1), fontSize, fontFamily, fontEmphasis);
  crispBitmapText.drawText(ctx, testText7, 0, Math.round(canvas.height - 0 * crispTestTextMeasures.height -1), fontSize, fontFamily, fontEmphasis);


  // add another canvas at the top of the page and draw "Hello World" on it using the standard canvas text drawing methods
  // add some text above the canvas to say what it is
  const div2 = document.createElement('div');
  div2.textContent = 'Standard Canvas Text Drawing with no smoothing:';
  document.getElementById("testTextCanvases").appendChild(div2);
  const canvas2 = document.createElement('canvas');
  canvas2.width = Math.round(testTextMeasuresCrisp.actualBoundingBoxLeft + testTextMeasuresCrisp.actualBoundingBoxRight);
  canvas2.height = Math.round(testTextMeasuresCrisp.fontBoundingBoxAscent + testTextMeasures.fontBoundingBoxDescent);
  // add to DOM before drawing the text otherwise
  // the CSS property to make it crisp doesn't work
  document.getElementById("testTextCanvases").appendChild(canvas2);
  const ctx2 = canvas2.getContext('2d');
  ctx2.fillStyle = 'white';
  ctx2.fillRect(0, 0, canvas2.width, canvas2.height);
  ctx2.fillStyle = 'black';
  ctx2.font = fontEmphasis + " " + fontSize + 'px ' + fontFamily;
  ctx2.textBaseline = 'bottom';
  ctx2.fillText( testText , 0, canvas2.height-1);


  
  // add another canvas at the top of the page and draw "xxxxxxxxxxxx" on it using the standard canvas text drawing methods
  // add some text above the canvas to say what it is
  const div6 = document.createElement('div');
  div6.textContent = 'Standard Canvas Text Drawing with no smoothing - thin characters to see monospaced fonts:';
  document.getElementById("testTextCanvases").appendChild(div6);
  const canvas6 = document.createElement('canvas');
  canvas6.width = Math.round(testTextMeasuresCrisp.actualBoundingBoxLeft + testTextMeasuresCrisp.actualBoundingBoxRight);
  canvas6.height = Math.round(testTextMeasuresCrisp.fontBoundingBoxAscent + testTextMeasures.fontBoundingBoxDescent);
  // add to DOM before drawing the text otherwise
  // the CSS property to make it crisp doesn't work
  document.getElementById("testTextCanvases").appendChild(canvas6);
  const ctx6 = canvas6.getContext('2d');
  ctx6.fillStyle = 'white';
  ctx6.fillRect(0, 0, canvas6.width, canvas6.height);
  ctx6.fillStyle = 'black';
  ctx6.font = fontEmphasis + " " + fontSize + 'px ' + fontFamily;
  ctx6.textBaseline = 'bottom';
  ctx6.fillText( '|||||||||||||||||||||||||||||||||||||' , 0, canvas6.height-1);




  // add a canvas at the top of the page and draw "Hello World" on it using the standard canvas text drawing methods
  // add some text above the canvas to say what it is
  const div3 = document.createElement('div');
  div3.textContent = 'Standard Canvas Text Drawing with smoothing:';
  // add inside the testTextCanvases div
  document.getElementById("testTextCanvases").appendChild(div3);
  const canvas3 = document.createElement('canvas');
  canvas3.width = Math.round(testTextMeasures.actualBoundingBoxLeft + testTextMeasures.actualBoundingBoxRight);
  canvas3.height = Math.round(testTextMeasures.fontBoundingBoxAscent + testTextMeasures.fontBoundingBoxDescent);

  const ctx3 = canvas3.getContext('2d');
  ctx3.fillStyle = 'white';
  ctx3.fillRect(0, 0, canvas3.width, canvas3.height);
  ctx3.fillStyle = 'black';
  ctx3.font = fontEmphasis + " " + fontSize + 'px ' + fontFamily;
  ctx3.textBaseline = 'bottom';

  ctx3.fillText( testText , 0, canvas3.height-1);
  // add to DOM after drawing the text so
  // the CSS property to make it crisp doesn't work
  document.getElementById("testTextCanvases").appendChild(canvas3);

}