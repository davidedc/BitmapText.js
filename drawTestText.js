// Helper function to generate font string
function getFontString({ fontStyle = '', fontWeight = '', fontSize, fontFamily }) {
  return `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`.trim();
}

function createCanvas(width, height, pixelDensity) {
  const canvas = document.createElement('canvas');
  
  // normally you would not multiply the CSS width and height by pixelDensity
  // because the whole purpose od pixel density is that you paing n times more pixels
  // in the *same* space. But here we are doing it so we can see the actual individual
  // pixels on my screen so I can screenshot them to diff them with some reference
  // images.
  canvas.style.width = `${width * pixelDensity}px`;
  canvas.style.height = `${height * pixelDensity}px`;
  
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
  const linesMeasures_CSS_Px = { width: 0, height: 0 };
  for (const line of lines) {
    const { width, fontBoundingBoxAscent, fontBoundingBoxDescent } = measureTextFn(line);
    linesMeasures_CSS_Px.width = Math.max(linesMeasures_CSS_Px.width, width);
    // take as the height of all the lines to be the same as the maximum possible height given the font
    // i.e. don't actually measure the height of the line using actualBoundingBoxAscent and actualBoundingBoxDescent
    // (which would measure the actual text) but instead, just take the fontBoundingBoxAscent and fontBoundingBoxDescent
    // This is all the lines are equally spaced vertically and have all the space needed for particularly ascending and descending
    // characters such as "À", "Ç", "ç".
    console.log(`linesMeasures_CSS_Px.fontBoundingBoxAscent: ${fontBoundingBoxAscent} linesMeasures_CSS_Px.fontBoundingBoxDescent: ${fontBoundingBoxDescent}`);
    linesMeasures_CSS_Px.height += fontBoundingBoxAscent + fontBoundingBoxDescent;
  }
  return linesMeasures_CSS_Px;
}

function setupCanvas(ctx, fontProperties) {
  const pixelDensity = fontProperties.pixelDensity;
  ctx.scale(pixelDensity, pixelDensity);
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, ctx.canvas.width / pixelDensity, ctx.canvas.height / pixelDensity);
  ctx.fillStyle = 'black';
  ctx.font = getFontString(fontProperties);
  ctx.textBaseline = 'bottom';
}

function standardDrawTextOnCanvas(ctx, lines, measures, fontProperties) {
  setupCanvas(ctx, fontProperties);
  // note that we draw with baseline = 'bottom' i.e.
  // the chosen x,y is at the crossing of the first column and last row
  // of where any pixel can be drawn
  // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textBaseline
  startTiming('drawTestText standard draw');
  lines.forEach((line, i) => {
    ctx.fillText(line, 0, Math.round((i + 1) * measures.height / lines.length));
  });
  console.log(`⏱️ drawTestText standard draw ${stopTiming('drawTestText standard draw')} milliseconds`);
}

function getTestCopyChoiceAndText() {
  const options = [
    { id: 'test-copy-1-radio-button', text: testCopy1, number: 1 },
    { id: 'kern-king-copy-part-1-radio-button', text: kernKingCopyPart1, number: 2 },
    { id: 'kern-king-copy-part-2-radio-button', text: kernKingCopyPart2, number: 3 }
  ];
  for (const option of options) {
    if (document.getElementById(option.id).checked) {
      return { testCopy: option.text, testCopyChoiceNumber: option.number };
    }
  }
  return { testCopy: '', testCopyChoiceNumber: 0 };
}

function drawTestText(fontProperties, bitmapGlyphStore_Full) {
  const { testCopy, testCopyChoiceNumber } = getTestCopyChoiceAndText();
  const testCopyLines = testCopy.split("\n");
  const fontString = getFontString(fontProperties);

  // ------------------------------------------------
  // measurements
  // ------------------------------------------------

  // Measurements for smooth text
  // (it's drawn smoothly because it's attached to the DOM before the drawing of the text
  // and there is a CSS rule that makes the canvas crisp)
  const canvasMeasuringSmooth = createCanvas(1, 1, fontProperties.pixelDensity);
  const ctxSmooth = canvasMeasuringSmooth.getContext('2d');
  ctxSmooth.font = fontString;
  const measureTextSmooth = text => ctxSmooth.measureText(text);
  const smoothMeasures = measureMultilineText(testCopyLines, measureTextSmooth);
  console.log(`smoothTestTextMeasures_CSS_Px.width: ${smoothMeasures.width}`);
  console.log(`smoothTestTextMeasures_CSS_Px.height: ${smoothMeasures.height}`);

  // Measurements for crisp text
  // (it's drawn crisply because it's attached to the DOM before the drawing of the text
  // and there is a CSS rule that makes the canvas crisp)
  const canvasMeasuringCrisp = createCanvas(1, 1, fontProperties.pixelDensity);
  addElementToDOM(canvasMeasuringCrisp);
  const ctxCrisp = canvasMeasuringCrisp.getContext('2d');
  ctxCrisp.font = fontString;
  // measureMultilineText takes a function to measure a line of text so let's build it
  const measureTextCrisp = text => ctxCrisp.measureText(text);
  const crispMeasures = measureMultilineText(testCopyLines, measureTextCrisp);
  console.log(`crispTestCopyMeasures_CSS_Px.width: ${crispMeasures.width}`);
  console.log(`crispTestCopyMeasures_CSS_Px.height: ${crispMeasures.height}`);

  // Measurements with BitmapText_Full
  // now do the measurements, generation of glyphs sheet and rendering of text with the BitmapText_Full class
  // note how this one doesn't need a canvas
  const measureTextCrispBitmap_Full = text => bitmapText_Full.measureText(text, fontProperties);
  const linesMeasures_CSS_Px_Full = measureMultilineText(testCopyLines, measureTextCrispBitmap_Full);
  // generating the glyphs sheet with the full class is necessary to then being able to draw the text with the "normal" class
  buildAndDisplayGlyphSheet(bitmapGlyphStore_Full, fontProperties);
  // note that this one doesn't use the glyph sheet, it uses the canvas stored in each glyph
  drawTestText_withIndividualGlyphsNotFromGlyphSheet(linesMeasures_CSS_Px_Full, testCopyLines, bitmapText_Full, fontProperties, testCopyChoiceNumber);
}

function drawTestText_withStandardClass(originalFontProperties, bitmapGlyphStore) {

  let linesMeasures_CSS_PxForcedPixelDensity1 = null;

  const { testCopy, testCopyChoiceNumber } = getTestCopyChoiceAndText();
  const testCopyLines = testCopy.split("\n");

  // this is going to be the class that is going to be used to render the text
  // outside of the editor.
  const bitmapText = new BitmapText(bitmapGlyphStore);

  let fontProperties = originalFontProperties;

  let measureTextCrispBitmap = text => bitmapText.measureText(text, originalFontProperties);
  let originalLinesMeasures_CSS_Px = measureMultilineText(testCopyLines, measureTextCrispBitmap);
  let linesMeasures_CSS_Px = originalLinesMeasures_CSS_Px;



  let fontPropertiesForcedPixelDensity1 = null;

  // pixel-density-1-forcing is a trick where we draw at pixelDensity 1 size 2n
  // the advantage is that we can reuse a glyph sheet that was generated for pixelDensity 1
  let didPixelDensity1Forcing = false;
  if (drawAllPixelDensitiesWithLargerPixelDensity1Text && originalFontProperties.pixelDensity === 2) {
    // make another deep copy of the fontProperties and call it fontPropertiesForcedPixelDensity1
    fontPropertiesForcedPixelDensity1 = JSON.parse(JSON.stringify(originalFontProperties));
    fontPropertiesForcedPixelDensity1.pixelDensity = 1;
    fontPropertiesForcedPixelDensity1.fontSize *= 2;

    measureTextCrispBitmap = text => bitmapText.measureText(text, fontPropertiesForcedPixelDensity1);
    linesMeasures_CSS_PxForcedPixelDensity1 = measureMultilineText(testCopyLines, measureTextCrispBitmap);

    fontProperties = fontPropertiesForcedPixelDensity1;
    linesMeasures_CSS_Px = linesMeasures_CSS_PxForcedPixelDensity1;

    didPixelDensity1Forcing = true;
  }


  bitmapGlyphsSheetDrawCrispText(linesMeasures_CSS_Px, testCopyLines, bitmapText, fontProperties, testCopyChoiceNumber);

  if (originalFontProperties.pixelDensity === 2) {
    let fontPropertiesPixelDensity1 = JSON.parse(JSON.stringify(originalFontProperties));
    fontPropertiesPixelDensity1.pixelDensity = 1;

    measureTextCrispBitmap = text => bitmapText.measureText(text, fontPropertiesPixelDensity1);
    const linesMeasures_CSS_PxPixelDensity1 = measureMultilineText(testCopyLines, measureTextCrispBitmap);

    const canvas = bitmapGlyphsSheetDrawCrispText(linesMeasures_CSS_PxPixelDensity1, testCopyLines, bitmapText, fontPropertiesPixelDensity1, testCopyChoiceNumber, null, 2, false, null, "Comparison pixel density 2 (red) and pixel density 1 scaled (black)");
    bitmapGlyphsSheetDrawCrispText(originalLinesMeasures_CSS_Px, testCopyLines, bitmapText, originalFontProperties, testCopyChoiceNumber, canvas, null, null, 'multiply', null, 'red');
  }
  
  // If we did the pixel-density-1-forcing, let's
  // compare the text rendering done normally with the text rendering done with the pixel-density-1-forcing
  if (didPixelDensity1Forcing) {
    const canvas = bitmapGlyphsSheetDrawCrispText(linesMeasures_CSS_PxForcedPixelDensity1, testCopyLines, bitmapText, fontPropertiesForcedPixelDensity1, testCopyChoiceNumber, null, null, null, null, "Comparison crisp bitmap text drawing from glyph sheet original pixel density (red) and forced pixel density 1 (black)");
    bitmapGlyphsSheetDrawCrispText(originalLinesMeasures_CSS_Px, testCopyLines, bitmapText, originalFontProperties, testCopyChoiceNumber, canvas, null, null, 'multiply', null, 'red');
  }

  stdDrawCrispText(originalLinesMeasures_CSS_Px, testCopyLines, originalFontProperties);
  stdDrawCrispThinLines(originalLinesMeasures_CSS_Px, testCopyLines, originalFontProperties);
  stdDrawSmoothText(originalLinesMeasures_CSS_Px, testCopyLines, originalFontProperties);
}

function drawTestText_withIndividualGlyphsNotFromGlyphSheet(linesMeasures, testCopyLines, bitmapText, fontProperties, testCopyChoiceNumber) {
  addElementToDOM(createDivWithText('Crisp Bitmap Text Drawing:'));
  const canvas = createCanvas(linesMeasures.width, linesMeasures.height, fontProperties.pixelDensity);
  addElementToDOM(canvas);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // note that we assume that we draw with baseline = 'bottom' i.e.
  // the chosen x,y is at the crossing of the first column and last row
  // of where any pixel can be drawn
  // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textBaseline
  testCopyLines.forEach((line, i) => {
    const yPosition = Math.round((i + 1) * linesMeasures.height / testCopyLines.length);
    bitmapText.drawText(ctx, line, 0, yPosition, fontProperties);
  });

  addCanvasInfoToDOM(canvas, getHashMatchInfo(ctx, fontProperties, "testCopyChoiceNumber " + testCopyChoiceNumber));
  addElementToDOM(document.createElement('br'));
}

function bitmapGlyphsSheetDrawCrispText(linesMeasures, testCopyLines, bitmapText, fontProperties, testCopyChoiceNumber, canvas = null, scale, checkTheHashes = true, blendingMode = null, sectionLabel = 'Crisp Bitmap Text Drawing from glyphs sheet:', textColor = null) {
  
  let drawOverExistingCanvas = false;

  if (canvas)
    drawOverExistingCanvas = true;

  // if scale is null then set it to 1
  if (!scale) scale = 1;

  if (!drawOverExistingCanvas) {
    addElementToDOM(createDivWithText(sectionLabel));
    canvas = createCanvas(linesMeasures.width * scale, linesMeasures.height * scale, fontProperties.pixelDensity);
    addElementToDOM(canvas);
  }
  
  const ctx = canvas.getContext('2d');

  if (blendingMode) {
    ctx.globalCompositeOperation = blendingMode;
  }

  if (scale != 1) {
    ctx.save();
    ctx.scale(scale, scale);
  }

  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  startTiming('drawTestText via glyphs sheet');
  testCopyLines.forEach((line, i) => {
    const yPosition = Math.round((i + 1) * linesMeasures.height / testCopyLines.length);
    bitmapText.drawTextFromGlyphSheet(ctx, line, 0, yPosition, fontProperties, textColor);
  });
  console.log(`⏱️ drawTestText via glyphs sheet ${stopTiming('drawTestText via glyphs sheet')} milliseconds`);

  if (!drawOverExistingCanvas) {
    let hashMatchInfo = '';
    if (checkTheHashes)
      hashMatchInfo = getHashMatchInfo(ctx, fontProperties, "testCopyChoiceNumber " + testCopyChoiceNumber);
    
    addCanvasInfoToDOM(canvas, hashMatchInfo);
    addElementToDOM(document.createElement('br'));
  }  

  if (scale) ctx.restore();

  return canvas;
}

function stdDrawSmoothText(measures, testCopyLines, fontProperties) {
  // It's drawn crisply because it's attached to the DOM AFTER the drawing of the text.
  // If we attached it to the DOM before the drawing, we'd be drawing crisply because
  // there is a CSS rule that makes the canvas crisp.
  addElementToDOM(createDivWithText('Standard Canvas Text Drawing with smoothing:'));
  const canvas = createCanvas(Math.round(measures.width), Math.round(measures.height), fontProperties.pixelDensity);
  const ctx = canvas.getContext('2d');
  standardDrawTextOnCanvas(ctx, testCopyLines, measures, fontProperties);
  addElementToDOM(canvas);
  addCanvasInfoToDOM(canvas, getHashMatchInfo(ctx, fontProperties, 'standard draw smooth text'));
}

function stdDrawCrispThinLines(measures, testCopyLines, fontProperties) {
  addElementToDOM(createDivWithText('Standard Canvas Text Drawing with no smoothing - thin characters to see monospaced fonts:'));
  const canvasHeight = Math.round(measures.height / testCopyLines.length);
  const canvas = createCanvas(Math.round(measures.width), canvasHeight, fontProperties.pixelDensity);
  const ctx = canvas.getContext('2d');
  setupCanvas(ctx, fontProperties);
  ctx.fillText('|||||||||||||||||||||||||||||||||||||', 0, canvas.height / fontProperties.pixelDensity - 1);
  addElementToDOM(canvas);
  addCanvasInfoToDOM(canvas, getHashMatchInfo(ctx, fontProperties, 'standard draw crisp thin lines'));
  addElementToDOM(document.createElement('br'));
}

function stdDrawCrispText(measures, testCopyLines, fontProperties) {
  // It's drawn crisply because it's attached to the DOM before the drawing of the text
  // and there is a CSS rule that makes the canvas crisp.
  addElementToDOM(createDivWithText('Standard Canvas Text Drawing with no smoothing:'));
  const canvas = createCanvas(Math.round(measures.width), Math.round(measures.height), fontProperties.pixelDensity);
  addElementToDOM(canvas);
  const ctx = canvas.getContext('2d');
  standardDrawTextOnCanvas(ctx, testCopyLines, measures, fontProperties);
  addCanvasInfoToDOM(canvas, getHashMatchInfo(ctx, fontProperties, 'standard draw crisp text'));
  addElementToDOM(document.createElement('br'));
}

function buildAndDisplayGlyphSheet(bitmapGlyphStore, fontProperties) {
  addElementToDOM(createDivWithText("Glyphs' Sheet:"));
  const [glyphSheetImage, glyphSheetCtx] = bitmapGlyphStore.buildGlyphsSheet(fontProperties);
  addElementToDOM(glyphSheetImage);
  
  addCanvasInfoToDOM(glyphSheetCtx.canvas, getHashMatchInfo(glyphSheetCtx, fontProperties, 'glyphSheet'));
  addElementToDOM(document.createElement('br'));
}

function addCanvasInfoToDOM(canvas, additionalInfo = '') {
  const ctx = canvas.getContext('2d');
  const hashString = ctx.getHashString();
  const infoDiv = document.createElement('div');
  infoDiv.innerHTML = `
    ${canvas.width} x ${canvas.height} hash: ${hashString} ${additionalInfo ? additionalInfo : ''}
  `;
  addElementToDOM(infoDiv);
}

function getHashMatchInfo(ctx, fontProperties, hashSuffix = '') {
  const hashKey = calculateFontPropertiesHashKey(fontProperties, hashSuffix);
  const crispTextHashString = ctx.getHashString();
  thisRunsHashes[hashKey] = crispTextHashString;

  if (storedReferenceCrispTextRendersHashes[hashKey] === undefined) {
    //console.log("ℹ️ No stored hash" + hashKey);
    return "ℹ️ No stored hash";
  } else if (storedReferenceCrispTextRendersHashes[hashKey] === crispTextHashString) {
    return "✔ Same hash as stored one";
  } else {
    document.body.style.backgroundColor = '#FFC0CB';
    return "✘ Different hash from stored one";
  }
}
function calculateFontPropertiesHashKey(fontProperties, hashSuffix = '') {
  const { fontFamily, fontStyle, fontWeight, fontSize, pixelDensity } = fontProperties;
  return `fontFamily ${fontFamily} // fontStyle ${fontStyle} // fontWeight ${fontWeight} // fontSize ${fontSize} // ${hashSuffix} // pixelDensity ${pixelDensity}`;
}
