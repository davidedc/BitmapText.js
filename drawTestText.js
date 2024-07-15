function createCanvas(width, height, pixelDensity = PIXEL_DENSITY) {
  const canvas = document.createElement('canvas');
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = width * pixelDensity;
  canvas.height = height * pixelDensity;
  return canvas;
}

function addElementToDOM(element, parentId = "testCopyCanvases") {
  document.getElementById(parentId).appendChild(element);
}

function createDivWithText(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div;
}

function drawTestText(fontEmphasis, fontSize, fontFamily, crispBitmapGlyphStore) {
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

  const testCopyLines = testCopy.split("\n");

  const canvas4 = createCanvas(1, 1);
  const ctx4 = canvas4.getContext('2d');
  ctx4.font = `${fontEmphasis} ${fontSize}px ${fontFamily}`;

  let testCopyMeasuresCSSPx = {width: 0, height: 0};
  for (const element of testCopyLines) {
    const testCopyLineMeasures = ctx4.measureText(element);
    if (testCopyLineMeasures.width > testCopyMeasuresCSSPx.width)
      testCopyMeasuresCSSPx.width = testCopyLineMeasures.width;
    testCopyMeasuresCSSPx.height += testCopyLineMeasures.actualBoundingBoxAscent + testCopyLineMeasures.actualBoundingBoxDescent;
  }
  console.log('testCopyMeasuresCSSPx.width: ' + testCopyMeasuresCSSPx.width);
  console.log('testCopyMeasuresCSSPx.height: ' + testCopyMeasuresCSSPx.height);

  const canvas5 = createCanvas(1, 1);
  addElementToDOM(canvas5);
  const ctx5 = canvas5.getContext('2d');
  ctx5.font = `${fontEmphasis} ${fontSize}px ${fontFamily}`;

  let testCopyMeasures_CSS_Px = {width: 0, height: 0};
  for (const element of testCopyLines) {
    const testCopyLineMeasuresCrisp = ctx5.measureText(element);
    if (testCopyLineMeasuresCrisp.width > testCopyMeasures_CSS_Px.width)
      testCopyMeasures_CSS_Px.width = testCopyLineMeasuresCrisp.width;
    testCopyMeasures_CSS_Px.height += testCopyLineMeasuresCrisp.actualBoundingBoxAscent + testCopyLineMeasuresCrisp.actualBoundingBoxDescent;
  }
  console.log('testCopyMeasures_CSS_Px.width: ' + testCopyMeasures_CSS_Px.width);
  console.log('testCopyMeasures_CSS_Px.height: ' + testCopyMeasures_CSS_Px.height);

  addElementToDOM(createDivWithText('Crisp Bitmap Text Drawing:'));
  
  const crispBitmapText = new CrispBitmapText(crispBitmapGlyphStore);

  let crispTestTextMeasures_CSS_Px = {width: 0, height: 0};
  for (const element of testCopyLines) {
    const crispTestTextLineMeasures_CSS_Px = crispBitmapText.measureText(element, fontSize, fontFamily, fontEmphasis);
    if (crispTestTextLineMeasures_CSS_Px.width > crispTestTextMeasures_CSS_Px.width)
      crispTestTextMeasures_CSS_Px.width = crispTestTextLineMeasures_CSS_Px.width;
    crispTestTextMeasures_CSS_Px.height += crispTestTextLineMeasures_CSS_Px.height;
  }

  const canvas = createCanvas(crispTestTextMeasures_CSS_Px.width, crispTestTextMeasures_CSS_Px.height);
  addElementToDOM(canvas);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < testCopyLines.length; i++) {
    crispBitmapText.drawText(ctx, testCopyLines[i], 0, Math.round((i+1) * crispTestTextMeasures_CSS_Px.height / testCopyLines.length), fontSize, fontFamily, fontEmphasis);
  }

  const crispTextHashString = ctx.getHashString();
  const hashKey = `fontFamily ${fontFamily} // fontEmphasis ${fontEmphasis} // fontSize ${fontSize} // testCopyChoiceNumber ${testCopyChoiceNumber} // pixelDensity ${PIXEL_DENSITY}`;
  thisRunsHashes[hashKey] = crispTextHashString;
  
  let hashText = 'hash: ' + crispTextHashString;
  if (storedReferenceCrispTextRendersHashes[hashKey] === crispTextHashString) {
    hashText += " ✔ same hash as stored one";
  } else {
    hashText += " ✘ different hash from stored one";
  }
  addElementToDOM(createDivWithText(hashText));
  addElementToDOM(document.createElement('br'));

  addElementToDOM(createDivWithText("Glyphs' Sheet:"));
  
  const canvas4GlyphSheet = crispBitmapGlyphStore.getGlyphsSheet(fontFamily, fontSize, fontEmphasis);
  if (canvas4GlyphSheet) {
    addElementToDOM(canvas4GlyphSheet);
  } else {
    addElementToDOM(createDivWithText('No glyph sheet available for this font family, font size and font emphasis.'));
  }

  addElementToDOM(createDivWithText('Standard Canvas Text Drawing with no smoothing:'));

  const canvas2Width = Math.round(testCopyMeasures_CSS_Px.width);
  const canvas2Height = Math.round(testCopyMeasures_CSS_Px.height);
  const canvas2 = createCanvas(canvas2Width, canvas2Height);

  addElementToDOM(canvas2);
  const ctx2 = canvas2.getContext('2d');
  ctx2.scale(PIXEL_DENSITY, PIXEL_DENSITY);
  ctx2.fillStyle = 'white';
  ctx2.fillRect(0, 0, canvas2.width / PIXEL_DENSITY, canvas2.height / PIXEL_DENSITY);
  ctx2.fillStyle = 'black';
  ctx2.font = `${fontEmphasis} ${fontSize}px ${fontFamily}`;
  ctx2.textBaseline = 'bottom';

  for (let i = 0; i < testCopyLines.length; i++) {
    ctx2.fillText(testCopyLines[i], 0, Math.round((i+1) * testCopyMeasures_CSS_Px.height / testCopyLines.length));
  }

  addElementToDOM(createDivWithText('hash: ' + ctx2.getHashString()));

  addElementToDOM(createDivWithText('Standard Canvas Text Drawing with no smoothing - thin characters to see monospaced fonts:'));

  const canvas6Width = Math.round(testCopyMeasures_CSS_Px.width);
  const canvas6Height = Math.round(testCopyMeasures_CSS_Px.height / testCopyLines.length);
  const canvas6 = createCanvas(canvas6Width, canvas6Height);

  addElementToDOM(canvas6);
  const ctx6 = canvas6.getContext('2d');
  ctx6.scale(PIXEL_DENSITY, PIXEL_DENSITY);
  ctx6.fillStyle = 'white';
  ctx6.fillRect(0, 0, canvas6.width / PIXEL_DENSITY, canvas6.height / PIXEL_DENSITY);
  ctx6.fillStyle = 'black';
  ctx6.font = `${fontEmphasis} ${fontSize}px ${fontFamily}`;
  ctx6.textBaseline = 'bottom';
  ctx6.fillText('|||||||||||||||||||||||||||||||||||||', 0, canvas6.height / PIXEL_DENSITY - 1);

  addElementToDOM(createDivWithText('Standard Canvas Text Drawing with smoothing:'));

  const canvas3Width = Math.round(testCopyMeasuresCSSPx.width);
  const canvas3Height = Math.round(testCopyMeasuresCSSPx.height);
  const canvas3 = createCanvas(canvas3Width, canvas3Height);

  const ctx3 = canvas3.getContext('2d');
  ctx3.scale(PIXEL_DENSITY, PIXEL_DENSITY);
  ctx3.fillStyle = 'white';
  ctx3.fillRect(0, 0, canvas3.width / PIXEL_DENSITY, canvas3.height / PIXEL_DENSITY);
  ctx3.fillStyle = 'black';
  ctx3.font = `${fontEmphasis} ${fontSize}px ${fontFamily}`;
  ctx3.textBaseline = 'bottom';

  for (let i = 0; i < testCopyLines.length; i++) {
    ctx3.fillText(testCopyLines[i], 0, Math.round((i+1) * testCopyMeasuresCSSPx.height / testCopyLines.length));
  }

  addElementToDOM(canvas3);

  addElementToDOM(createDivWithText('hash: ' + ctx3.getHashString()));
}