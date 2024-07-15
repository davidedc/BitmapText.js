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

function measureMultilineText(ctx, lines) {
  let linesMeasures_CSS_Px = { width: 0, height: 0 };
  for (const line of lines) {
    const lineMeasures_CSS_Px = ctx.measureText(line);
    linesMeasures_CSS_Px.width = Math.max(linesMeasures_CSS_Px.width, lineMeasures_CSS_Px.width);
    linesMeasures_CSS_Px.height += lineMeasures_CSS_Px.actualBoundingBoxAscent + lineMeasures_CSS_Px.actualBoundingBoxDescent;
  }
  return linesMeasures_CSS_Px;
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
  const canvasMeasuringSmooth = createCanvas(1, 1);
  const ctx_canvasMeasuringSmooth = canvasMeasuringSmooth.getContext('2d');
  ctx_canvasMeasuringSmooth.font = `${fontEmphasis} ${fontSize}px ${fontFamily}`;
  let smoothTestTextMeasures_CSS_Px = measureMultilineText(ctx_canvasMeasuringSmooth, testCopyLines);
  console.log('smoothTestTextMeasures_CSS_Px.width: ' + smoothTestTextMeasures_CSS_Px.width);
  console.log('smoothTestTextMeasures_CSS_Px.height: ' + smoothTestTextMeasures_CSS_Px.height);

  // measures the text drawn crisply
  // (it's drawn crisply because it's attached to the DOM before the drawing of the text
  // and there is a CSS rule that makes the canvas crisp)
  const canvasMeasuringCrisp = createCanvas(1, 1);
  addElementToDOM(canvasMeasuringCrisp);
  const ctx_canvasMeasuringCrisp = canvasMeasuringCrisp.getContext('2d');
  ctx_canvasMeasuringCrisp.font = `${fontEmphasis} ${fontSize}px ${fontFamily}`;
  let crispTestCopyMeasures_CSS_Px = measureMultilineText(ctx_canvasMeasuringCrisp, testCopyLines);
  console.log('crispTestCopyMeasures_CSS_Px.width: ' + crispTestCopyMeasures_CSS_Px.width);
  console.log('crispTestCopyMeasures_CSS_Px.height: ' + crispTestCopyMeasures_CSS_Px.height);


  // now do the measurements with the CrispBitmapText class
  // note how this one doesn't need a canvas
  const crispBitmapText = new CrispBitmapText(crispBitmapGlyphStore);
  let linesMeasures_CSS_Px = {width: 0, height: 0};
  for (const element of testCopyLines) {
    const lineMeasures_CSS_Px = crispBitmapText.measureText(element, fontSize, fontFamily, fontEmphasis);
    if (lineMeasures_CSS_Px.width > linesMeasures_CSS_Px.width)
      linesMeasures_CSS_Px.width = lineMeasures_CSS_Px.width;
    linesMeasures_CSS_Px.height += lineMeasures_CSS_Px.height;
  }

  // ------------------------------------------------

  // (it's drawn crisply because it's attached to the DOM before the drawing of the text
  // and there is a CSS rule that makes the canvas crisp)
  addElementToDOM(createDivWithText('Crisp Bitmap Text Drawing:'));
  const canvasCrispBitmapDraw = createCanvas(linesMeasures_CSS_Px.width, linesMeasures_CSS_Px.height);
  addElementToDOM(canvasCrispBitmapDraw);
  const ctx_canvasCrispBitmapDraw = canvasCrispBitmapDraw.getContext('2d');
  ctx_canvasCrispBitmapDraw.fillStyle = 'white';
  ctx_canvasCrispBitmapDraw.fillRect(0, 0, canvasCrispBitmapDraw.width, canvasCrispBitmapDraw.height);

  for (let i = 0; i < testCopyLines.length; i++) {
    crispBitmapText.drawText(ctx_canvasCrispBitmapDraw, testCopyLines[i], 0, Math.round((i+1) * linesMeasures_CSS_Px.height / testCopyLines.length), fontSize, fontFamily, fontEmphasis);
  }

  addHashInfoWithMatch(ctx_canvasCrispBitmapDraw, fontFamily, fontEmphasis, fontSize, testCopyChoiceNumber);

  addElementToDOM(document.createElement('br'));

  // ------------------------------------------------

  addElementToDOM(createDivWithText("Glyphs' Sheet:"));
  const canvasGlyphSheet = crispBitmapGlyphStore.getGlyphsSheet(fontFamily, fontSize, fontEmphasis);
  addElementToDOM(canvasGlyphSheet);

  // ------------------------------------------------

  addElementToDOM(createDivWithText('Standard Canvas Text Drawing with no smoothing:'));
  const canvasStdDrawCrispWidth = Math.round(crispTestCopyMeasures_CSS_Px.width);
  const canvasStdDrawCrispHeight = Math.round(crispTestCopyMeasures_CSS_Px.height);
  const canvasStdDrawCrisp = createCanvas(canvasStdDrawCrispWidth, canvasStdDrawCrispHeight);
  addElementToDOM(canvasStdDrawCrisp);
  const ctx_canvasStdDrawCrisp = canvasStdDrawCrisp.getContext('2d');
  standardDrawTextOnCanvas(ctx_canvasStdDrawCrisp, testCopyLines, crispTestCopyMeasures_CSS_Px, fontSize, fontFamily, fontEmphasis);
  addElementToDOM(createDivWithText('hash: ' + ctx_canvasStdDrawCrisp.getHashString()));

  // ------------------------------------------------

  addElementToDOM(createDivWithText('Standard Canvas Text Drawing with no smoothing - thin characters to see monospaced fonts:'));
  const canvasThinLinesWidth = Math.round(crispTestCopyMeasures_CSS_Px.width);
  const canvasThinLinesHeight = Math.round(crispTestCopyMeasures_CSS_Px.height / testCopyLines.length);
  const canvasThinLines = createCanvas(canvasThinLinesWidth, canvasThinLinesHeight);
  addElementToDOM(canvasThinLines);
  const ctx_canvasThinLines = canvasThinLines.getContext('2d');
  setupCanvas(ctx_canvasThinLines, fontSize, fontFamily, fontEmphasis);
  ctx_canvasThinLines.fillText('|||||||||||||||||||||||||||||||||||||', 0, canvasThinLines.height / PIXEL_DENSITY - 1);

  // ------------------------------------------------

  addElementToDOM(createDivWithText('Standard Canvas Text Drawing with smoothing:'));
  const canvasStdDrawSmoothWidth = Math.round(smoothTestTextMeasures_CSS_Px.width);
  const canvasStdDrawSmoothHeight = Math.round(smoothTestTextMeasures_CSS_Px.height);
  const canvasStdDrawSmooth = createCanvas(canvasStdDrawSmoothWidth, canvasStdDrawSmoothHeight);
  const ctx_canvasStdDrawSmooth = canvasStdDrawSmooth.getContext('2d');
  standardDrawTextOnCanvas(ctx_canvasStdDrawSmooth, testCopyLines, smoothTestTextMeasures_CSS_Px, fontSize, fontFamily, fontEmphasis);
  addElementToDOM(canvasStdDrawSmooth);
  addElementToDOM(createDivWithText('hash: ' + ctx_canvasStdDrawSmooth.getHashString()));

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
