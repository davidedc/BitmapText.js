function drawTestText(fontEmphasis, fontSize, fontFamily, crispBitmapGlyphStore) {
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
  crispBitmapText.drawText(ctx, testText, 0, Math.round(canvas.height - 6 * crispTestTextMeasures.height - 1), fontSize, fontFamily, fontEmphasis);
  crispBitmapText.drawText(ctx, testText2, 0, Math.round(canvas.height - 5 * crispTestTextMeasures.height - 1), fontSize, fontFamily, fontEmphasis);
  crispBitmapText.drawText(ctx, testText3, 0, Math.round(canvas.height - 4 * crispTestTextMeasures.height - 1), fontSize, fontFamily, fontEmphasis);
  crispBitmapText.drawText(ctx, testText4, 0, Math.round(canvas.height - 3 * crispTestTextMeasures.height - 1), fontSize, fontFamily, fontEmphasis);
  crispBitmapText.drawText(ctx, testText5, 0, Math.round(canvas.height - 2 * crispTestTextMeasures.height - 1), fontSize, fontFamily, fontEmphasis);
  crispBitmapText.drawText(ctx, testText6, 0, Math.round(canvas.height - 1 * crispTestTextMeasures.height - 1), fontSize, fontFamily, fontEmphasis);
  crispBitmapText.drawText(ctx, testText7, 0, Math.round(canvas.height - 0 * crispTestTextMeasures.height - 1), fontSize, fontFamily, fontEmphasis);


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
  ctx2.fillText(testText, 0, canvas2.height - 1);



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
  ctx6.fillText('|||||||||||||||||||||||||||||||||||||', 0, canvas6.height - 1);




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

  ctx3.fillText(testText, 0, canvas3.height - 1);
  // add to DOM after drawing the text so
  // the CSS property to make it crisp doesn't work
  document.getElementById("testTextCanvases").appendChild(canvas3);
}
