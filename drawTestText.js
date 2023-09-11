  function drawTestText(fontEmphasis, fontSize, fontFamily, crispBitmapGlyphStore) {
  
  // depending on the radio button selected, choose the test text form the
  // testCopy1, kernKingCopyPart1, or kernKingCopyPart2 variables defined in test-copy.js
  // and put it in the testCopy variable
  let testCopy = '';
  if (document.getElementById('test-copy-1-radio-button').checked) {
    testCopy = testCopy1;
  } else if (document.getElementById('kern-king-copy-part-1-radio-button').checked) {
    testCopy = kernKingCopyPart1;
  } else if (document.getElementById('kern-king-copy-part-2-radio-button').checked) {
    testCopy = kernKingCopyPart2;
  }

  // put the test Text into an array of lines
  const testCopyLines = testCopy.split("\n");

  //var testCopy = 'project does not take responsability for the accuracy of information provided by others.';
  // create a canvas just to find the text measures for the antialiased version (easy: don't add it to the DOM)
  const canvas4 = document.createElement('canvas');
  const ctx4 = canvas4.getContext('2d');
  ctx4.font = fontEmphasis + " " + fontSize + 'px ' + fontFamily;

  //const testCopyMeasures = ctx4.measureText(testCopy);
  // get the testCopyMeasures by going through the testCopyLines
  // (take the width of the longest line and the sum of the heights of all the lines)
  let testCopyMeasures = {width: 0, height: 0};
  for (let i = 0; i < testCopyLines.length; i++) {
    const testCopyLineMeasures = ctx4.measureText(testCopyLines[i]);
    if (testCopyLineMeasures.width > testCopyMeasures.width)
      testCopyMeasures.width = testCopyLineMeasures.width;
    testCopyMeasures.height += testCopyLineMeasures.actualBoundingBoxAscent + testCopyLineMeasures.actualBoundingBoxDescent;
  }
  console.log('testCopyMeasures.width: ' + testCopyMeasures.width);
  console.log('testCopyMeasures.height: ' + testCopyMeasures.height);


  // create a canvas to find the text measures for the crisp version (we need to add it to the DOM for the CSS properties to be applied)
  const canvas5 = document.createElement('canvas');
  canvas5.width = 1;
  canvas5.height = 1;
  document.getElementById("testCopyCanvases").appendChild(canvas5);
  const ctx5 = canvas5.getContext('2d');
  ctx5.font = fontEmphasis + " " + fontSize + 'px ' + fontFamily;
  // get the testCopyMeasuresCrisp by going through the testCopyLines
  // (take the width of the longest line and the sum of the heights of all the lines)
  // TODO we should rather use the height of one line to calculate the height of all lines
  // (checking that the height represents all lines correctly i.e. ascents and descents are not specific to the chars in the line)
  let testCopyMeasuresCrisp = {width: 0, height: 0};
  for (let i = 0; i < testCopyLines.length; i++) {
    const testCopyLineMeasuresCrisp = ctx5.measureText(testCopyLines[i]);
    if (testCopyLineMeasuresCrisp.width > testCopyMeasuresCrisp.width)
      testCopyMeasuresCrisp.width = testCopyLineMeasuresCrisp.width;
    testCopyMeasuresCrisp.height += testCopyLineMeasuresCrisp.actualBoundingBoxAscent + testCopyLineMeasuresCrisp.actualBoundingBoxDescent;
  }
  console.log('testCopyMeasuresCrisp.width: ' + testCopyMeasuresCrisp.width);
  console.log('testCopyMeasuresCrisp.height: ' + testCopyMeasuresCrisp.height);
  


  // add another canvas at the top of the page and draw "Hello World" on it using the CrispBitmapText
  // add some text above the canvas to say what it is
  const div = document.createElement('div');
  div.textContent = 'Crisp Bitmap Text Drawing:';
  document.getElementById("testCopyCanvases").appendChild(div);
  const canvas = document.createElement('canvas');
  // TODO need to use own measureText method of the Crisp kind
  // get the measures of the text from the CrispBitmapText measureText method
  const crispBitmapText = new CrispBitmapText(crispBitmapGlyphStore);

  //const crispTestTextMeasures = crispBitmapText.measureText(testCopy, fontSize, fontFamily, fontEmphasis);
  // get the crispTestTextMeasures by going through the testCopyLines
  // (take the width of the longest line and the sum of the heights of all the lines)
  // TODO we should rather use the height of one line to calculate the height of all lines
  // (checking that the height represents all lines correctly i.e. ascents and descents are not specific to the chars in the line)
  let crispTestTextMeasures = {width: 0, height: 0};
  for (let i = 0; i < testCopyLines.length; i++) {
    const crispTestTextLineMeasures = crispBitmapText.measureText(testCopyLines[i], fontSize, fontFamily, fontEmphasis);
    if (crispTestTextLineMeasures.width > crispTestTextMeasures.width)
      crispTestTextMeasures.width = crispTestTextLineMeasures.width;
    crispTestTextMeasures.height += crispTestTextLineMeasures.height;
  }
  
  canvas.width = crispTestTextMeasures.width;
  canvas.height = crispTestTextMeasures.height;
  document.getElementById("testCopyCanvases").appendChild(canvas);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // draw the testCopyLines
  for (let i = 0; i < testCopyLines.length; i++) {
    // TODO here we are just assuming the same height for all lines
    // which is not quite right, we should rather use the height of the line, considering ascent and descent
    crispBitmapText.drawText(ctx, testCopyLines[i], 0, Math.round((i+1) * crispTestTextMeasures.height / testCopyLines.length), fontSize, fontFamily, fontEmphasis);
  }


  // add another canvas at the top of the page and draw "Hello World" on it using the standard canvas text drawing methods
  // add some text above the canvas to say what it is
  const div2 = document.createElement('div');
  div2.textContent = 'Standard Canvas Text Drawing with no smoothing:';
  document.getElementById("testCopyCanvases").appendChild(div2);
  const canvas2 = document.createElement('canvas');

  // TODO here below the width should rather be  testCopyMeasuresCrisp.actualBoundingBoxLeft + testCopyMeasuresCrisp.actualBoundingBoxRight
  // and the height should rather be testCopyMeasuresCrisp.fontBoundingBoxAscent + testCopyMeasuresCrisp.fontBoundingBoxDescent
  canvas2.width = Math.round(testCopyMeasuresCrisp.width);
  canvas2.height = Math.round(testCopyMeasuresCrisp.height);

  // add to DOM before drawing the text otherwise
  // the CSS property to make it crisp doesn't work
  document.getElementById("testCopyCanvases").appendChild(canvas2);
  const ctx2 = canvas2.getContext('2d');
  ctx2.fillStyle = 'white';
  ctx2.fillRect(0, 0, canvas2.width, canvas2.height);
  ctx2.fillStyle = 'black';
  ctx2.font = fontEmphasis + " " + fontSize + 'px ' + fontFamily;
  ctx2.textBaseline = 'bottom';
  // ctx2.fillText(testCopy, 0, canvas2.height - 1);
  // draw the testCopyLines
  for (let i = 0; i < testCopyLines.length; i++) {
    ctx2.fillText(testCopyLines[i], 0, Math.round((i+1) * testCopyMeasuresCrisp.height /  testCopyLines.length));
  }



  // add another canvas at the top of the page and draw "xxxxxxxxxxxx" on it using the standard canvas text drawing methods
  // add some text above the canvas to say what it is
  const div6 = document.createElement('div');
  div6.textContent = 'Standard Canvas Text Drawing with no smoothing - thin characters to see monospaced fonts:';
  document.getElementById("testCopyCanvases").appendChild(div6);
  const canvas6 = document.createElement('canvas');
  
  // TODO here below the width should rather be  testCopyMeasures.actualBoundingBoxLeft + testCopyMeasures.actualBoundingBoxRight
  // and the height should rather be testCopyMeasures.fontBoundingBoxAscent + testCopyMeasures.fontBoundingBoxDescent
  canvas6.width = Math.round(testCopyMeasuresCrisp.width);
  canvas6.height = Math.round(testCopyMeasuresCrisp.height /  testCopyLines.length);

  // add to DOM before drawing the text otherwise
  // the CSS property to make it crisp doesn't work
  document.getElementById("testCopyCanvases").appendChild(canvas6);
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
  // add inside the testCopyCanvases div
  document.getElementById("testCopyCanvases").appendChild(div3);
  const canvas3 = document.createElement('canvas');
  //canvas3.width = Math.round(testCopyMeasures.actualBoundingBoxLeft + testCopyMeasures.actualBoundingBoxRight);
  //canvas3.height = Math.round(testCopyMeasures.fontBoundingBoxAscent + testCopyMeasures.fontBoundingBoxDescent);
  canvas3.width = Math.round(testCopyMeasures.width);
  canvas3.height = Math.round(testCopyMeasures.height);

  const ctx3 = canvas3.getContext('2d');
  ctx3.fillStyle = 'white';
  ctx3.fillRect(0, 0, canvas3.width, canvas3.height);
  ctx3.fillStyle = 'black';
  ctx3.font = fontEmphasis + " " + fontSize + 'px ' + fontFamily;
  ctx3.textBaseline = 'bottom';

  //ctx3.fillText(testCopy, 0, canvas3.height - 1);
  // draw the testCopyLines
  for (let i = 0; i < testCopyLines.length; i++) {
    ctx3.fillText(testCopyLines[i], 0, Math.round((i+1) * testCopyMeasures.height /  testCopyLines.length));
  }


  // add to DOM after drawing the text so
  // the CSS property to make it crisp doesn't work
  document.getElementById("testCopyCanvases").appendChild(canvas3);
}
