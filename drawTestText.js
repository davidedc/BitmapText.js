  function drawTestText(fontEmphasis, fontSize, fontFamily, crispBitmapGlyphStore) {
  var testText = testText1;

  // put the test Text into an array of lines
  const testTextLines = testText.split("\n");

  //var testText = 'project does not take responsability for the accuracy of information provided by others.';
  // create a canvas just to find the text measures for the antialiased version (easy: don't add it to the DOM)
  const canvas4 = document.createElement('canvas');
  const ctx4 = canvas4.getContext('2d');
  ctx4.font = fontEmphasis + " " + fontSize + 'px ' + fontFamily;

  //const testTextMeasures = ctx4.measureText(testText);
  // get the testTextMeasures by going through the testTextLines
  // (take the width of the longest line and the sum of the heights of all the lines)
  let testTextMeasures = {width: 0, height: 0};
  for (let i = 0; i < testTextLines.length; i++) {
    const testTextLineMeasures = ctx4.measureText(testTextLines[i]);
    if (testTextLineMeasures.width > testTextMeasures.width)
      testTextMeasures.width = testTextLineMeasures.width;
    testTextMeasures.height += testTextLineMeasures.actualBoundingBoxAscent + testTextLineMeasures.actualBoundingBoxDescent;
  }
  console.log('testTextMeasures.width: ' + testTextMeasures.width);
  console.log('testTextMeasures.height: ' + testTextMeasures.height);


  // create a canvas to find the text measures for the crisp version (we need to add it to the DOM for the CSS properties to be applied)
  const canvas5 = document.createElement('canvas');
  canvas5.width = 1;
  canvas5.height = 1;
  document.getElementById("testTextCanvases").appendChild(canvas5);
  const ctx5 = canvas5.getContext('2d');
  ctx5.font = fontEmphasis + " " + fontSize + 'px ' + fontFamily;
  // get the testTextMeasuresCrisp by going through the testTextLines
  // (take the width of the longest line and the sum of the heights of all the lines)
  // TODO we should rather use the height of one line to calculate the height of all lines
  // (checking that the height represents all lines correctly i.e. ascents and descents are not specific to the chars in the line)
  let testTextMeasuresCrisp = {width: 0, height: 0};
  for (let i = 0; i < testTextLines.length; i++) {
    const testTextLineMeasuresCrisp = ctx5.measureText(testTextLines[i]);
    if (testTextLineMeasuresCrisp.width > testTextMeasuresCrisp.width)
      testTextMeasuresCrisp.width = testTextLineMeasuresCrisp.width;
    testTextMeasuresCrisp.height += testTextLineMeasuresCrisp.actualBoundingBoxAscent + testTextLineMeasuresCrisp.actualBoundingBoxDescent;
  }
  console.log('testTextMeasuresCrisp.width: ' + testTextMeasuresCrisp.width);
  console.log('testTextMeasuresCrisp.height: ' + testTextMeasuresCrisp.height);
  


  // add another canvas at the top of the page and draw "Hello World" on it using the CrispBitmapText
  // add some text above the canvas to say what it is
  const div = document.createElement('div');
  div.textContent = 'Crisp Bitmap Text Drawing:';
  document.getElementById("testTextCanvases").appendChild(div);
  const canvas = document.createElement('canvas');
  // TODO need to use own measureText method of the Crisp kind
  // get the measures of the text from the CrispBitmapText measureText method
  const crispBitmapText = new CrispBitmapText(crispBitmapGlyphStore);

  //const crispTestTextMeasures = crispBitmapText.measureText(testText, fontSize, fontFamily, fontEmphasis);
  // get the crispTestTextMeasures by going through the testTextLines
  // (take the width of the longest line and the sum of the heights of all the lines)
  // TODO we should rather use the height of one line to calculate the height of all lines
  // (checking that the height represents all lines correctly i.e. ascents and descents are not specific to the chars in the line)
  let crispTestTextMeasures = {width: 0, height: 0};
  for (let i = 0; i < testTextLines.length; i++) {
    const crispTestTextLineMeasures = crispBitmapText.measureText(testTextLines[i], fontSize, fontFamily, fontEmphasis);
    if (crispTestTextLineMeasures.width > crispTestTextMeasures.width)
      crispTestTextMeasures.width = crispTestTextLineMeasures.width;
    crispTestTextMeasures.height += crispTestTextLineMeasures.height;
  }
  
  canvas.width = crispTestTextMeasures.width;
  canvas.height = crispTestTextMeasures.height;
  document.getElementById("testTextCanvases").appendChild(canvas);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // draw the testTextLines
  for (let i = 0; i < testTextLines.length; i++) {
    // TODO here we are just assuming the same height for all lines
    // which is not quite right, we should rather use the height of the line, considering ascent and descent
    crispBitmapText.drawText(ctx, testTextLines[i], 0, Math.round((i+1) * crispTestTextMeasures.height / testTextLines.length), fontSize, fontFamily, fontEmphasis);
  }


  // add another canvas at the top of the page and draw "Hello World" on it using the standard canvas text drawing methods
  // add some text above the canvas to say what it is
  const div2 = document.createElement('div');
  div2.textContent = 'Standard Canvas Text Drawing with no smoothing:';
  document.getElementById("testTextCanvases").appendChild(div2);
  const canvas2 = document.createElement('canvas');

  // TODO here below the width should rather be  testTextMeasuresCrisp.actualBoundingBoxLeft + testTextMeasuresCrisp.actualBoundingBoxRight
  // and the height should rather be testTextMeasuresCrisp.fontBoundingBoxAscent + testTextMeasuresCrisp.fontBoundingBoxDescent
  canvas2.width = Math.round(testTextMeasuresCrisp.width);
  canvas2.height = Math.round(testTextMeasuresCrisp.height);

  // add to DOM before drawing the text otherwise
  // the CSS property to make it crisp doesn't work
  document.getElementById("testTextCanvases").appendChild(canvas2);
  const ctx2 = canvas2.getContext('2d');
  ctx2.fillStyle = 'white';
  ctx2.fillRect(0, 0, canvas2.width, canvas2.height);
  ctx2.fillStyle = 'black';
  ctx2.font = fontEmphasis + " " + fontSize + 'px ' + fontFamily;
  ctx2.textBaseline = 'bottom';
  // ctx2.fillText(testText, 0, canvas2.height - 1);
  // draw the testTextLines
  for (let i = 0; i < testTextLines.length; i++) {
    ctx2.fillText(testTextLines[i], 0, Math.round((i+1) * testTextMeasuresCrisp.height /  testTextLines.length));
  }



  // add another canvas at the top of the page and draw "xxxxxxxxxxxx" on it using the standard canvas text drawing methods
  // add some text above the canvas to say what it is
  const div6 = document.createElement('div');
  div6.textContent = 'Standard Canvas Text Drawing with no smoothing - thin characters to see monospaced fonts:';
  document.getElementById("testTextCanvases").appendChild(div6);
  const canvas6 = document.createElement('canvas');
  
  // TODO here below the width should rather be  testTextMeasures.actualBoundingBoxLeft + testTextMeasures.actualBoundingBoxRight
  // and the height should rather be testTextMeasures.fontBoundingBoxAscent + testTextMeasures.fontBoundingBoxDescent
  canvas6.width = Math.round(testTextMeasuresCrisp.width);
  canvas6.height = Math.round(testTextMeasuresCrisp.height /  testTextLines.length);

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
  //canvas3.width = Math.round(testTextMeasures.actualBoundingBoxLeft + testTextMeasures.actualBoundingBoxRight);
  //canvas3.height = Math.round(testTextMeasures.fontBoundingBoxAscent + testTextMeasures.fontBoundingBoxDescent);
  canvas3.width = Math.round(testTextMeasures.width);
  canvas3.height = Math.round(testTextMeasures.height);

  const ctx3 = canvas3.getContext('2d');
  ctx3.fillStyle = 'white';
  ctx3.fillRect(0, 0, canvas3.width, canvas3.height);
  ctx3.fillStyle = 'black';
  ctx3.font = fontEmphasis + " " + fontSize + 'px ' + fontFamily;
  ctx3.textBaseline = 'bottom';

  //ctx3.fillText(testText, 0, canvas3.height - 1);
  // draw the testTextLines
  for (let i = 0; i < testTextLines.length; i++) {
    ctx3.fillText(testTextLines[i], 0, Math.round((i+1) * testTextMeasures.height /  testTextLines.length));
  }


  // add to DOM after drawing the text so
  // the CSS property to make it crisp doesn't work
  document.getElementById("testTextCanvases").appendChild(canvas3);
}
