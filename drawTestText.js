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

function measureMultilineText(lines, measureTextFn) {
  let linesMeasures_CSS_Px = { width: 0, height: 0 };
  for (const line of lines) {
    const lineMeasures_CSS_Px = measureTextFn(line);
    linesMeasures_CSS_Px.width = Math.max(linesMeasures_CSS_Px.width, lineMeasures_CSS_Px.width);
    // take as the height of all the lines to be the same as the maximum possible height given the font
    // i.e. don't actually measure the height of the line using actualBoundingBoxAscent and actualBoundingBoxDescent
    // (which would measure the actual text) but instead, just take the fontBoundingBoxAscent and fontBoundingBoxDescent
    // This is all the lines are equally spaced vertically and have all the space needed for particularly ascending and descending
    // characters such as "À", "Ç", "ç".
    console.log ('lineMeasures_CSS_Px.fontBoundingBoxAscent: ' + lineMeasures_CSS_Px.fontBoundingBoxAscent + ' lineMeasures_CSS_Px.fontBoundingBoxDescent: ' + lineMeasures_CSS_Px.fontBoundingBoxDescent);
    linesMeasures_CSS_Px.height += lineMeasures_CSS_Px.fontBoundingBoxAscent + lineMeasures_CSS_Px.fontBoundingBoxDescent;
  }
  return linesMeasures_CSS_Px;
}

function setupCanvas(ctx, fontSize, fontFamily, fontStyle, fontWeight, pixelDensity = PIXEL_DENSITY) {
  ctx.scale(pixelDensity, pixelDensity);
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, ctx.canvas.width / pixelDensity, ctx.canvas.height / pixelDensity);
  ctx.fillStyle = 'black';
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textBaseline = 'bottom';
}

function standardDrawTextOnCanvas(ctx, lines, measures, fontSize, fontFamily, fontStyle, fontWeight, pixelDensity = PIXEL_DENSITY) {
  setupCanvas(ctx, fontSize, fontFamily, fontStyle, fontWeight, pixelDensity);
  // note that we draw with baseline = 'bottom' i.e.
  // the chosen x,y is at the crossing of the first column and last row
  // of where any pixel can be drawn
  // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textBaseline
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

function drawTestText(fontStyle, fontWeight, fontSize, fontFamily, crispBitmapGlyphStore_Full) {
  const { testCopy, testCopyChoiceNumber } = getTestCopyChoiceAndText();

  const testCopyLines = testCopy.split("\n");

  // ------------------------------------------------
  // measurements
  // ------------------------------------------------

  // measures the text drawn smoothly
  // (it's drawn smoothly because it's attached to the DOM before the drawing of the text
  // and there is a CSS rule that makes the canvas crisp)
  const canvasMeasuringSmooth = createCanvas(1, 1);
  const ctx_canvasMeasuringSmooth = canvasMeasuringSmooth.getContext('2d');
  ctx_canvasMeasuringSmooth.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
  // measureMultilineText takes a function to measure a line of text so let's build it
  const measureText = (text) => ctx_canvasMeasuringSmooth.measureText(text);
  let smoothTestTextMeasures_CSS_Px = measureMultilineText(testCopyLines, measureText);
  console.log('smoothTestTextMeasures_CSS_Px.width: ' + smoothTestTextMeasures_CSS_Px.width);
  console.log('smoothTestTextMeasures_CSS_Px.height: ' + smoothTestTextMeasures_CSS_Px.height);

  // measures the text drawn crisply
  // (it's drawn crisply because it's attached to the DOM before the drawing of the text
  // and there is a CSS rule that makes the canvas crisp)
  const canvasMeasuringCrisp = createCanvas(1, 1);
  addElementToDOM(canvasMeasuringCrisp);
  const ctx_canvasMeasuringCrisp = canvasMeasuringCrisp.getContext('2d');
  ctx_canvasMeasuringCrisp.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
  // measureMultilineText takes a function to measure a line of text so let's build it
  const measureTextCrisp = (text) => ctx_canvasMeasuringCrisp.measureText(text);
  let crispTestCopyMeasures_CSS_Px = measureMultilineText(testCopyLines, measureTextCrisp);
  console.log('crispTestCopyMeasures_CSS_Px.width: ' + crispTestCopyMeasures_CSS_Px.width);
  console.log('crispTestCopyMeasures_CSS_Px.height: ' + crispTestCopyMeasures_CSS_Px.height);


  // now do the measurements, generation of glyphs sheet and rendering of text with the CrispBitmapText_Full class
  // note how this one doesn't need a canvas
  const measureTextCrispBitmap_Full = (text) => crispBitmapText_Full.measureText(text, fontSize, fontFamily, fontStyle, fontWeight);
  let linesMeasures_CSS_Px_Full = measureMultilineText(testCopyLines, measureTextCrispBitmap_Full);
  // generating the glyphs sheet with the full class is necessary to then being able to draw the text with the "normal" class
  drawGlyphSheet(crispBitmapGlyphStore_Full, fontFamily, fontSize, fontStyle, fontWeight);
  // note that this one doesn't use the glyph sheet, it uses the canvas stored in each glyph
  bitmapDrawCrispText(linesMeasures_CSS_Px_Full, testCopyLines, crispBitmapText_Full, fontSize, fontFamily, fontStyle, fontWeight, testCopyChoiceNumber);

}

function drawTestText_withStandardClass(fontStyle, fontWeight, fontSize, fontFamily, crispBitmapGlyphStore) {
  const { testCopy, testCopyChoiceNumber } = getTestCopyChoiceAndText();
  const testCopyLines = testCopy.split("\n");

  // this is going to be the class that is going to be used to render the text
  // outside of the editor.
  const crispBitmapText = new CrispBitmapText(crispBitmapGlyphStore);


  // do the measurements and drawing with the CrispBitmapText "normal" class
  // note how also this one doesn't need a canvas
  const measureTextCrispBitmap = (text) => crispBitmapText.measureText(text, fontSize, fontFamily, fontStyle, fontWeight);
  let linesMeasures_CSS_Px = measureMultilineText(testCopyLines, measureTextCrispBitmap);
  bitmapGlyphsSheetDrawCrispText(linesMeasures_CSS_Px, testCopyLines, crispBitmapText, fontSize, fontFamily, fontStyle, fontWeight, testCopyChoiceNumber);

  addElementToDOM(document.createElement('br'));

  stdDrawCrispText(linesMeasures_CSS_Px, testCopyLines, fontSize, fontFamily, fontStyle, fontWeight);
  stdDrawCrispThinLines(linesMeasures_CSS_Px, testCopyLines, fontSize, fontFamily, fontStyle, fontWeight);
  stdDrawSmoothText(linesMeasures_CSS_Px, testCopyLines, fontSize, fontFamily, fontStyle, fontWeight);

}

function bitmapDrawCrispText(linesMeasures_CSS_Px_Full, testCopyLines, crispBitmapText_Full, fontSize, fontFamily, fontStyle, fontWeight, testCopyChoiceNumber) {
  addElementToDOM(createDivWithText('Crisp Bitmap Text Drawing:'));
  const canvas = createCanvas(linesMeasures_CSS_Px_Full.width, linesMeasures_CSS_Px_Full.height);
  addElementToDOM(canvas);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // note that we assume that we draw with baseline = 'bottom' i.e.
  // the chosen x,y is at the crossing of the first column and last row
  // of where any pixel can be drawn
  // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textBaseline
  for (let i = 0; i < testCopyLines.length; i++) {
    crispBitmapText_Full.drawText(ctx, testCopyLines[i], 0, Math.round((i + 1) * linesMeasures_CSS_Px_Full.height / testCopyLines.length), fontSize, fontFamily, fontStyle, fontWeight);
  }

  addHashInfoWithMatch(ctx, fontFamily, fontStyle, fontWeight, fontSize, testCopyChoiceNumber);
}

function bitmapGlyphsSheetDrawCrispText(linesMeasures_CSS_Px, testCopyLines, crispBitmapText, fontSize, fontFamily, fontStyle, fontWeight, testCopyChoiceNumber) {
  addElementToDOM(createDivWithText('Crisp Bitmap Text Drawing from glyphs sheet:'));
  const canvas = createCanvas(linesMeasures_CSS_Px.width, linesMeasures_CSS_Px.height);
  addElementToDOM(canvas);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < testCopyLines.length; i++) {
    crispBitmapText.drawTextFromGlyphSheet(ctx, testCopyLines[i], 0, Math.round((i + 1) * linesMeasures_CSS_Px.height / testCopyLines.length), fontSize, fontFamily, fontStyle, fontWeight);
  }

  addHashInfoWithMatch(ctx, fontFamily, fontStyle, fontWeight, fontSize, testCopyChoiceNumber);
}

function stdDrawSmoothText(smoothTestTextMeasures_CSS_Px, testCopyLines, fontSize, fontFamily, fontStyle, fontWeight) {
  // It's drawn crisply because it's attached to the DOM AFTER the drawing of the text.
  // If we attached it to the DOM before the drawing, we'd be drawing crisply because
  // there is a CSS rule that makes the canvas crisp.
  addElementToDOM(createDivWithText('Standard Canvas Text Drawing with smoothing:'));
  const canvasWidth = Math.round(smoothTestTextMeasures_CSS_Px.width);
  const canvasHeight = Math.round(smoothTestTextMeasures_CSS_Px.height);
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');
  standardDrawTextOnCanvas(ctx, testCopyLines, smoothTestTextMeasures_CSS_Px, fontSize, fontFamily, fontStyle, fontWeight);
  addElementToDOM(canvas);
  addElementToDOM(createDivWithText('hash: ' + ctx.getHashString()));
}

function stdDrawCrispThinLines(crispTestCopyMeasures_CSS_Px, testCopyLines, fontSize, fontFamily, fontStyle, fontWeight) {
  addElementToDOM(createDivWithText('Standard Canvas Text Drawing with no smoothing - thin characters to see monospaced fonts:'));
  const canvasWidth = Math.round(crispTestCopyMeasures_CSS_Px.width);
  const canvasHeight = Math.round(crispTestCopyMeasures_CSS_Px.height / testCopyLines.length);
  const canvas = createCanvas(canvasWidth, canvasHeight);
  addElementToDOM(canvas);
  const ctx = canvas.getContext('2d');
  setupCanvas(ctx, fontSize, fontFamily, fontStyle, fontWeight);
  ctx.fillText('|||||||||||||||||||||||||||||||||||||', 0, canvas.height / PIXEL_DENSITY - 1);
}

function stdDrawCrispText(crispTestCopyMeasures_CSS_Px, testCopyLines, fontSize, fontFamily, fontStyle, fontWeight) {
  // It's drawn crisply because it's attached to the DOM before the drawing of the text
  // and there is a CSS rule that makes the canvas crisp.
  addElementToDOM(createDivWithText('Standard Canvas Text Drawing with no smoothing:'));
  const canvasWidth = Math.round(crispTestCopyMeasures_CSS_Px.width);
  const canvasHeight = Math.round(crispTestCopyMeasures_CSS_Px.height);
  const canvas = createCanvas(canvasWidth, canvasHeight);
  addElementToDOM(canvas);
  const ctx = canvas.getContext('2d');
  standardDrawTextOnCanvas(ctx, testCopyLines, crispTestCopyMeasures_CSS_Px, fontSize, fontFamily, fontStyle, fontWeight);
  addElementToDOM(createDivWithText('hash: ' + ctx.getHashString()));
}

function drawGlyphSheet(crispBitmapGlyphStore_Full, fontFamily, fontSize, fontStyle, fontWeight) {
  addElementToDOM(createDivWithText("Glyphs' Sheet:"));
  const canvas = crispBitmapGlyphStore_Full.getGlyphsSheet(fontFamily, fontSize, fontStyle, fontWeight);
  addElementToDOM(canvas);
}

function addHashInfoWithMatch(ctx, fontFamily, fontStyle, fontWeight, fontSize, testCopyChoiceNumber) {
  const crispTextHashString = ctx.getHashString();
  const hashKey = `fontFamily ${fontFamily} // fontStyle ${fontStyle} // fontWeight ${fontWeight} // fontSize ${fontSize} // testCopyChoiceNumber ${testCopyChoiceNumber} // pixelDensity ${PIXEL_DENSITY}`;
  thisRunsHashes[hashKey] = crispTextHashString;

  let hashText = 'hash: ' + crispTextHashString;
  if (storedReferenceCrispTextRendersHashes[hashKey] === crispTextHashString) {
    hashText += " ✔ same hash as stored one";
  } else {
    hashText += " ✘ different hash from stored one";
    // turn the background of the page light pink
    document.body.style.backgroundColor = '#FFC0CB';
  }
  addElementToDOM(createDivWithText(hashText));
}
