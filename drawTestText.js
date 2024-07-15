  function drawTestText(fontEmphasis, fontSize, fontFamily, crispBitmapGlyphStore) {
  
  // depending on the radio button selected, choose the test text from the
  // testCopy1, kernKingCopyPart1, or kernKingCopyPart2 variables defined in test-copy.js
  // and put it in the testCopy variable
  let testCopy = '';
  let testCopyChoiceNumber = 0;
  if (document.getElementById('test-copy-1-radio-button').checked) {
    testCopy = testCopy1;
    testCopyChoiceNumber = 1;
  } else if (document.getElementById('kern-king-copy-part-1-radio-button').checked) {
    testCopy = kernKingCopyPart1;
    testCopyChoiceNumber = 2;
  } else if (document.getElementById('kern-king-copy-part-2-radio-button').checked) {
    testCopy = kernKingCopyPart2;
    testCopyChoiceNumber = 3;
  }
  

  // put the test Text into an array of lines
  const testCopyLines = testCopy.split("\n");

  // create a canvas just to find the text measures for the antialiased version (easy: don't add it to the DOM)
  const canvas4 = document.createElement('canvas');
  const ctx4 = canvas4.getContext('2d');
  ctx4.font = fontEmphasis + " " + fontSize + 'px ' + fontFamily;

  //const testCopyMeasuresCSSPx = ctx4.measureText(testCopy);
  // get the testCopyMeasuresCSSPx by going through the testCopyLines
  // (take the width of the longest line and the sum of the heights of all the lines)
  let testCopyMeasuresCSSPx = {width: 0, height: 0};
  for (const element of testCopyLines) {
    const testCopyLineMeasures = ctx4.measureText(element);
    if (testCopyLineMeasures.width > testCopyMeasuresCSSPx.width)
      testCopyMeasuresCSSPx.width = testCopyLineMeasures.width;
    testCopyMeasuresCSSPx.height += testCopyLineMeasures.actualBoundingBoxAscent + testCopyLineMeasures.actualBoundingBoxDescent;
  }
  console.log('testCopyMeasuresCSSPx.width: ' + testCopyMeasuresCSSPx.width);
  console.log('testCopyMeasuresCSSPx.height: ' + testCopyMeasuresCSSPx.height);


  // create a canvas to find the text measures for the crisp version (we need to add it to the DOM for the CSS properties to be applied)
  const canvas5 = document.createElement('canvas');
  canvas5.width = 1;
  canvas5.height = 1;
  document.getElementById("testCopyCanvases").appendChild(canvas5);
  const ctx5 = canvas5.getContext('2d');
  ctx5.font = fontEmphasis + " " + fontSize + 'px ' + fontFamily;
  // get the testCopyMeasures_CSS_Px by going through the testCopyLines
  // (take the width of the longest line and the sum of the heights of all the lines)
  // TODO we should rather use the height of one line to calculate the height of all lines
  // (checking that the height represents all lines correctly i.e. ascents and descents are not specific to the chars in the line)
  let testCopyMeasures_CSS_Px = {width: 0, height: 0};
  for (const element of testCopyLines) {
    const testCopyLineMeasuresCrisp = ctx5.measureText(element);
    if (testCopyLineMeasuresCrisp.width > testCopyMeasures_CSS_Px.width)
      testCopyMeasures_CSS_Px.width = testCopyLineMeasuresCrisp.width;
    testCopyMeasures_CSS_Px.height += testCopyLineMeasuresCrisp.actualBoundingBoxAscent + testCopyLineMeasuresCrisp.actualBoundingBoxDescent;
  }
  console.log('testCopyMeasures_CSS_Px.width: ' + testCopyMeasures_CSS_Px.width);
  console.log('testCopyMeasures_CSS_Px.height: ' + testCopyMeasures_CSS_Px.height);
  
  // add another canvas at the top of the page and draw "Hello World" on it using the CrispBitmapText
  // add some text above the canvas to say what it is
  const div = document.createElement('div');
  div.textContent = 'Crisp Bitmap Text Drawing:';
  document.getElementById("testCopyCanvases").appendChild(div);
  const canvas = document.createElement('canvas');
  // TODO need to use own measureText method of the Crisp kind
  // get the measures of the text from the CrispBitmapText measureText method
  const crispBitmapText = new CrispBitmapText(crispBitmapGlyphStore);

  //const crispTestTextMeasures_CSS_Px = crispBitmapText.measureText(testCopy, fontSize, fontFamily, fontEmphasis);
  // get the crispTestTextMeasures_CSS_Px by going through the testCopyLines
  // (take the width of the longest line and the sum of the heights of all the lines)
  // TODO we should rather use the height of one line to calculate the height of all lines
  // (checking that the height represents all lines correctly i.e. ascents and descents are not specific to the chars in the line)
  let crispTestTextMeasures_CSS_Px = {width: 0, height: 0};
  for (const element of testCopyLines) {
    const crispTestTextLineMeasures_CSS_Px = crispBitmapText.measureText(element, fontSize, fontFamily, fontEmphasis);
    if (crispTestTextLineMeasures_CSS_Px.width > crispTestTextMeasures_CSS_Px.width)
      crispTestTextMeasures_CSS_Px.width = crispTestTextLineMeasures_CSS_Px.width;
    crispTestTextMeasures_CSS_Px.height += crispTestTextLineMeasures_CSS_Px.height;
  }
  
  
  canvas.style.width = crispTestTextMeasures_CSS_Px.width + 'px';
  canvas.width = crispTestTextMeasures_CSS_Px.width * PIXEL_DENSITY;
  
  canvas.style.height = crispTestTextMeasures_CSS_Px.height + 'px';
  canvas.height = crispTestTextMeasures_CSS_Px.height * PIXEL_DENSITY;
  
  document.getElementById("testCopyCanvases").appendChild(canvas);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // draw the testCopyLines
  for (let i = 0; i < testCopyLines.length; i++) {
    // TODO here we are just assuming the same height for all lines
    // which is not quite right, we should rather use the height of the line, considering ascent and descent
    crispBitmapText.drawText(ctx, testCopyLines[i], 0, Math.round((i+1) * crispTestTextMeasures_CSS_Px.height / testCopyLines.length), fontSize, fontFamily, fontEmphasis);
  }
  // add a div with the hash of the canvas
  const divHash = document.createElement('div');
  const crispTextHashString = ctx.getHashString();
  divHash.textContent = 'hash: ' + crispTextHashString;
  // add the hash to this run's hashes (thisRunsHashes) indexed on the font , fontEmphasis, fontSize, testCopy, pixelDensity
  const hashKey = "fontFamily " + fontFamily + " // fontEmphasis " + fontEmphasis + " // fontSize " + fontSize + " // testCopyChoiceNumber " + testCopyChoiceNumber  + " // pixelDensity " + PIXEL_DENSITY;
  thisRunsHashes[hashKey] = crispTextHashString;
  // use the same key and check if the hash is the same as the one previously stored as reference in storedReferenceCrispTextRendersHashes
  // if it is add to textContent " ✔ same hash as stored one", otherwise add " ✘ different hash from stored one"
  if (storedReferenceCrispTextRendersHashes[hashKey] === crispTextHashString) {
    divHash.textContent += " ✔ same hash as stored one";
  }
  else {
    divHash.textContent += " ✘ different hash from stored one";
  }

  document.getElementById("testCopyCanvases").appendChild(divHash);

  // add a newline
  document.getElementById("testCopyCanvases").appendChild(document.createElement('br'));


  // add a canvas with the glyph sheet for the font family, font size and font emphasis
  // add some text above the canvas to say what it is
  const div4 = document.createElement('div');
  div4.textContent = "Glyphs' Sheet:";
  document.getElementById("testCopyCanvases").appendChild(div4);
  debugger
  const canvas4GlyphSheet = crispBitmapGlyphStore.getGlyphsSheet(fontFamily, fontSize, fontEmphasis);
  if (canvas4GlyphSheet) {
    document.getElementById("testCopyCanvases").appendChild(canvas4GlyphSheet);
  } else {
    const div4GlyphSheet = document.createElement('div');
    div4GlyphSheet.textContent = 'No glyph sheet available for this font family, font size and font emphasis.';
    document.getElementById("testCopyCanvases").appendChild(div4GlyphSheet);
  }



  // add another canvas at the top of the page and draw "Hello World" on it using the standard canvas text drawing methods
  // add some text above the canvas to say what it is
  const div2 = document.createElement('div');
  div2.textContent = 'Standard Canvas Text Drawing with no smoothing:';
  document.getElementById("testCopyCanvases").appendChild(div2);
  const canvas2 = document.createElement('canvas');

  // TODO here below the width should rather be  testCopyMeasures_CSS_Px.actualBoundingBoxLeft + testCopyMeasures_CSS_Px.actualBoundingBoxRight
  // and the height should rather be testCopyMeasures_CSS_Px.fontBoundingBoxAscent + testCopyMeasures_CSS_Px.fontBoundingBoxDescent

  var canvas2Width = Math.round(testCopyMeasures_CSS_Px.width);
  canvas2.style.width = canvas2Width + 'px';
  canvas2.width = canvas2Width * PIXEL_DENSITY;
  
  var canvas2Height = Math.round(testCopyMeasures_CSS_Px.height);
  canvas2.style.height = canvas2Height + 'px';
  canvas2.height = canvas2Height * PIXEL_DENSITY;

  // add to DOM before drawing the text otherwise
  // the CSS property to make it crisp doesn't work
  document.getElementById("testCopyCanvases").appendChild(canvas2);
  const ctx2 = canvas2.getContext('2d');
  ctx2.scale(PIXEL_DENSITY, PIXEL_DENSITY);
  ctx2.fillStyle = 'white';
  ctx2.fillRect(0, 0, canvas2.width / PIXEL_DENSITY, canvas2.height / PIXEL_DENSITY);
  ctx2.fillStyle = 'black';
  ctx2.font = fontEmphasis + " " + fontSize + 'px ' + fontFamily;
  ctx2.textBaseline = 'bottom';
  // ctx2.fillText(testCopy, 0, canvas2.height - 1);
  // draw the testCopyLines
  for (let i = 0; i < testCopyLines.length; i++) {
    ctx2.fillText(testCopyLines[i], 0, Math.round((i+1) * testCopyMeasures_CSS_Px.height /  testCopyLines.length));
  }

  // add a div with the hash of the canvas
  const divHash2 = document.createElement('div');
  divHash2.textContent = 'hash: ' + ctx2.getHashString();
  document.getElementById("testCopyCanvases").appendChild(divHash2);


  // add another canvas at the top of the page and draw "xxxxxxxxxxxx" on it using the standard canvas text drawing methods
  // add some text above the canvas to say what it is
  const div6 = document.createElement('div');
  div6.textContent = 'Standard Canvas Text Drawing with no smoothing - thin characters to see monospaced fonts:';
  document.getElementById("testCopyCanvases").appendChild(div6);
  const canvas6 = document.createElement('canvas');
  
  // TODO here below the width should rather be  testCopyMeasuresCSSPx.actualBoundingBoxLeft + testCopyMeasuresCSSPx.actualBoundingBoxRight
  // and the height should rather be testCopyMeasuresCSSPx.fontBoundingBoxAscent + testCopyMeasuresCSSPx.fontBoundingBoxDescent
  var canvas6Width = Math.round(testCopyMeasures_CSS_Px.width);
  canvas6.style.width = canvas6Width + 'px';
  canvas6.width = canvas6Width * PIXEL_DENSITY;

  var canvas6Height = Math.round(testCopyMeasures_CSS_Px.height /  testCopyLines.length);
  canvas6.style.height = canvas6Height + 'px';
  canvas6.height = canvas6Height * PIXEL_DENSITY;

  // add to DOM before drawing the text otherwise
  // the CSS property to make it crisp doesn't work
  document.getElementById("testCopyCanvases").appendChild(canvas6);
  const ctx6 = canvas6.getContext('2d');
  ctx6.scale(PIXEL_DENSITY, PIXEL_DENSITY);
  ctx6.fillStyle = 'white';
  ctx6.fillRect(0, 0, canvas6.width / PIXEL_DENSITY, canvas6.height / PIXEL_DENSITY);
  ctx6.fillStyle = 'black';
  ctx6.font = fontEmphasis + " " + fontSize + 'px ' + fontFamily;
  ctx6.textBaseline = 'bottom';
  ctx6.fillText('|||||||||||||||||||||||||||||||||||||', 0, canvas6.height / PIXEL_DENSITY - 1);




  // add a canvas at the top of the page and draw "Hello World" on it using the standard canvas text drawing methods
  // add some text above the canvas to say what it is
  const div3 = document.createElement('div');
  div3.textContent = 'Standard Canvas Text Drawing with smoothing:';
  // add inside the testCopyCanvases div
  document.getElementById("testCopyCanvases").appendChild(div3);
  const canvas3 = document.createElement('canvas');
  //canvas3.width = Math.round(testCopyMeasuresCSSPx.actualBoundingBoxLeft + testCopyMeasuresCSSPx.actualBoundingBoxRight);
  //canvas3.height = Math.round(testCopyMeasuresCSSPx.fontBoundingBoxAscent + testCopyMeasuresCSSPx.fontBoundingBoxDescent);
  
  var canvas3Width =  Math.round(testCopyMeasuresCSSPx.width);
  canvas3.style.width = canvas3Width + 'px';
  canvas3.width = canvas3Width * PIXEL_DENSITY;

  
  var canvas3Height = Math.round(testCopyMeasuresCSSPx.height);
  canvas3.style.height = canvas3Height + 'px';
  canvas3.height = canvas3Height * PIXEL_DENSITY;


  const ctx3 = canvas3.getContext('2d');
  ctx3.scale(PIXEL_DENSITY, PIXEL_DENSITY);
  ctx3.fillStyle = 'white';
  ctx3.fillRect(0, 0, canvas3.width / PIXEL_DENSITY, canvas3.height / PIXEL_DENSITY);
  ctx3.fillStyle = 'black';
  ctx3.font = fontEmphasis + " " + fontSize + 'px ' + fontFamily;
  ctx3.textBaseline = 'bottom';

  //ctx3.fillText(testCopy, 0, canvas3.height - 1);
  // draw the testCopyLines
  for (let i = 0; i < testCopyLines.length; i++) {
    ctx3.fillText(testCopyLines[i], 0, Math.round((i+1) * testCopyMeasuresCSSPx.height /  testCopyLines.length));
  }


  // add to DOM after drawing the text so
  // the CSS property to make it crisp doesn't work
  document.getElementById("testCopyCanvases").appendChild(canvas3);

  // add a div with the hash of the canvas
  const divHash3 = document.createElement('div');
  divHash3.textContent = 'hash: ' + ctx3.getHashString();
  document.getElementById("testCopyCanvases").appendChild(divHash3);

}
