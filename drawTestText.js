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

function measureText(ctx, lines) {
  let measures = { width: 0, height: 0 };
  for (const line of lines) {
    const lineMeasures = ctx.measureText(line);
    measures.width = Math.max(measures.width, lineMeasures.width);
    measures.height += lineMeasures.actualBoundingBoxAscent + lineMeasures.actualBoundingBoxDescent;
  }
  return measures;
}

function setupCanvas(ctx, fontSize, fontFamily, fontEmphasis, pixelDensity = PIXEL_DENSITY) {
  ctx.scale(pixelDensity, pixelDensity);
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, ctx.canvas.width / pixelDensity, ctx.canvas.height / pixelDensity);
  ctx.fillStyle = 'black';
  ctx.font = `${fontEmphasis} ${fontSize}px ${fontFamily}`;
  ctx.textBaseline = 'bottom';
}

function standardDrawTextOnCanvas(ctx, lines, measures, fontSize, fontFamily, fontEmphasis, pixelDensity = PIXEL_DENSITY) {
  setupCanvas(ctx, fontSize, fontFamily, fontEmphasis, pixelDensity);
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], 0, Math.round((i + 1) * measures.height / lines.length));
  }
}

function getTestCopyChoiceAndText() {
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
  return { testCopy, testCopyChoiceNumber };
}

function drawTestText(fontEmphasis, fontSize, fontFamily, crispBitmapGlyphStore) {
  const { testCopy, testCopyChoiceNumber } = getTestCopyChoiceAndText();

  const testCopyLines = testCopy.split("\n");

  // measures the text drawn smoothly
  const canvas4 = createCanvas(1, 1);
  const ctx4 = canvas4.getContext('2d');
  ctx4.font = `${fontEmphasis} ${fontSize}px ${fontFamily}`;
  let smoothTestTextMeasures_CSS_Px = measureText(ctx4, testCopyLines);
  console.log('smoothTestTextMeasures_CSS_Px.width: ' + smoothTestTextMeasures_CSS_Px.width);
  console.log('smoothTestTextMeasures_CSS_Px.height: ' + smoothTestTextMeasures_CSS_Px.height);

  // measures the text drawn crisply
  // (it's drawn crisply because it's attached to the DOM before the drawing of the text
  // and there is a CSS rule that makes the canvas crisp)
  const canvas5 = createCanvas(1, 1);
  addElementToDOM(canvas5);
  const ctx5 = canvas5.getContext('2d');
  ctx5.font = `${fontEmphasis} ${fontSize}px ${fontFamily}`;
  let crispTestCopyMeasures_CSS_Px = measureText(ctx5, testCopyLines);
  console.log('crispTestCopyMeasures_CSS_Px.width: ' + crispTestCopyMeasures_CSS_Px.width);
  console.log('crispTestCopyMeasures_CSS_Px.height: ' + crispTestCopyMeasures_CSS_Px.height);


  // now do the measurements with the CrispBitmapText class
  const crispBitmapText = new CrispBitmapText(crispBitmapGlyphStore);
  let crispTestTextMeasures_CSS_Px = {width: 0, height: 0};
  for (const element of testCopyLines) {
    const crispBitmapTextTestLinesMeasures_CSS_Px = crispBitmapText.measureText(element, fontSize, fontFamily, fontEmphasis);
    if (crispBitmapTextTestLinesMeasures_CSS_Px.width > crispTestTextMeasures_CSS_Px.width)
      crispTestTextMeasures_CSS_Px.width = crispBitmapTextTestLinesMeasures_CSS_Px.width;
    crispTestTextMeasures_CSS_Px.height += crispBitmapTextTestLinesMeasures_CSS_Px.height;
  }

  // ------------------------------------------------

  // (it's drawn crisply because it's attached to the DOM before the drawing of the text
  // and there is a CSS rule that makes the canvas crisp)
  addElementToDOM(createDivWithText('Crisp Bitmap Text Drawing:'));
  const canvas = createCanvas(crispTestTextMeasures_CSS_Px.width, crispTestTextMeasures_CSS_Px.height);
  addElementToDOM(canvas);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < testCopyLines.length; i++) {
    crispBitmapText.drawText(ctx, testCopyLines[i], 0, Math.round((i+1) * crispTestTextMeasures_CSS_Px.height / testCopyLines.length), fontSize, fontFamily, fontEmphasis);
  }

  addHashInfoWithMatch(ctx, fontFamily, fontEmphasis, fontSize, testCopyChoiceNumber);

  addElementToDOM(document.createElement('br'));

  // ------------------------------------------------

  addElementToDOM(createDivWithText("Glyphs' Sheet:"));
  const canvas4GlyphSheet = crispBitmapGlyphStore.getGlyphsSheet(fontFamily, fontSize, fontEmphasis);
  addElementToDOM(canvas4GlyphSheet);

  // ------------------------------------------------

  addElementToDOM(createDivWithText('Standard Canvas Text Drawing with no smoothing:'));
  const canvas2Width = Math.round(crispTestCopyMeasures_CSS_Px.width);
  const canvas2Height = Math.round(crispTestCopyMeasures_CSS_Px.height);
  const canvas2 = createCanvas(canvas2Width, canvas2Height);
  addElementToDOM(canvas2);
  const ctx2 = canvas2.getContext('2d');
  standardDrawTextOnCanvas(ctx2, testCopyLines, crispTestCopyMeasures_CSS_Px, fontSize, fontFamily, fontEmphasis);
  addElementToDOM(createDivWithText('hash: ' + ctx2.getHashString()));

  // ------------------------------------------------

  addElementToDOM(createDivWithText('Standard Canvas Text Drawing with no smoothing - thin characters to see monospaced fonts:'));
  const canvas6Width = Math.round(crispTestCopyMeasures_CSS_Px.width);
  const canvas6Height = Math.round(crispTestCopyMeasures_CSS_Px.height / testCopyLines.length);
  const canvas6 = createCanvas(canvas6Width, canvas6Height);
  addElementToDOM(canvas6);
  const ctx6 = canvas6.getContext('2d');
  setupCanvas(ctx6, fontSize, fontFamily, fontEmphasis);
  ctx6.fillText('|||||||||||||||||||||||||||||||||||||', 0, canvas6.height / PIXEL_DENSITY - 1);

  // ------------------------------------------------

  addElementToDOM(createDivWithText('Standard Canvas Text Drawing with smoothing:'));
  const canvas3Width = Math.round(smoothTestTextMeasures_CSS_Px.width);
  const canvas3Height = Math.round(smoothTestTextMeasures_CSS_Px.height);
  const canvas3 = createCanvas(canvas3Width, canvas3Height);
  const ctx3 = canvas3.getContext('2d');
  standardDrawTextOnCanvas(ctx3, testCopyLines, smoothTestTextMeasures_CSS_Px, fontSize, fontFamily, fontEmphasis);
  addElementToDOM(canvas3);
  addElementToDOM(createDivWithText('hash: ' + ctx3.getHashString()));

}

function addHashInfoWithMatch(ctx, fontFamily, fontEmphasis, fontSize, testCopyChoiceNumber) {
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
}
