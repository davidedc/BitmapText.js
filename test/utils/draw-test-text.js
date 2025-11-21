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
    const measureResult = measureTextFn(line);

    // Handle both new BitmapText return {metrics, status} and standard HTML5Canvas return (direct metrics)
    const metrics = measureResult.metrics || measureResult;

    const { width, fontBoundingBoxAscent, fontBoundingBoxDescent } = metrics;
    linesMeasures_CSS_Px.width = Math.max(linesMeasures_CSS_Px.width, width || 0);
    // take as the height of all the lines to be the same as the maximum possible height given the font
    // i.e. don't actually measure the height of the line using actualBoundingBoxAscent and actualBoundingBoxDescent
    // (which would measure the actual text) but instead, just take the fontBoundingBoxAscent and fontBoundingBoxDescent
    // This is all the lines are equally spaced vertically and have all the space needed for particularly ascending and descending
    // characters such as "À", "Ç", "ç".
    // console.log(`linesMeasures_CSS_Px.fontBoundingBoxAscent: ${fontBoundingBoxAscent} linesMeasures_CSS_Px.fontBoundingBoxDescent: ${fontBoundingBoxDescent}`);
    linesMeasures_CSS_Px.height += (fontBoundingBoxAscent || 0) + Math.abs(fontBoundingBoxDescent || 0);
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
    { id: 'kern-king-copy-part-2-radio-button', text: kernKingCopyPart2, number: 3 },
    { id: 'test-copy-4-radio-button', text: testCopy4, number: 4 }
  ];
  for (const option of options) {
    if (document.getElementById(option.id).checked) {
      return { testCopy: option.text, testCopyChoiceNumber: option.number };
    }
  }
  return { testCopy: '', testCopyChoiceNumber: 0 };
}

function drawTestText(fontProperties) {
  const { testCopy, testCopyChoiceNumber } = getTestCopyChoiceAndText();
  const testCopyLines = testCopy.split("\n");
  const fontString = getFontString(fontProperties);

  // Get TextProperties from UI state (respects kerning checkbox)
  const textProperties = getTextPropertiesFromUI();

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

  // Measurements with BitmapTextFAB
  // now do the measurements, font assets building of atlas and rendering of text with the BitmapTextFAB class
  // note how this one doesn't need a canvas

  // CRITICAL: Copy metrics to BitmapText for measureText to work
  // Metrics are in FontMetricsStore (populated by GlyphFAB constructors)
  const fontMetrics = FontMetricsStore.getFontMetrics(fontProperties);
  if (fontMetrics) {
    BitmapText.setFontMetrics(fontProperties, fontMetrics);
  }

  const measureTextCrispBitmapFAB = text => BitmapTextFAB.measureText(text, fontProperties, textProperties);
  const linesMeasures_CSS_PxFAB = measureMultilineText(testCopyLines, measureTextCrispBitmapFAB);
  // generating the atlases (source + tight reconstructed) with the full class is necessary to then being able to draw the text with the "normal" class
  buildAndDisplayAtlases(fontProperties);
  // note that this one doesn't use the atlas, it uses the canvas stored in each glyph
  drawTestTextViaIndividualCanvasesNotViaAtlas(linesMeasures_CSS_PxFAB, testCopyLines, fontProperties, testCopyChoiceNumber, textProperties);
}

function drawTestText_withStandardClass(originalFontProperties, atlasDataStore, fontMetricsStore) {

  let linesMeasures_CSS_PxForcedPixelDensity1 = null;

  const { testCopy, testCopyChoiceNumber } = getTestCopyChoiceAndText();
  const testCopyLines = testCopy.split("\n");

  // Get TextProperties from UI state (respects kerning checkbox)
  const textProperties = getTextPropertiesFromUI();

  let fontProperties = originalFontProperties;

  // Choose measurement method based on context
  // If stores provided (font-assets-builder), use instance; otherwise use static API
  let measureTextCrispBitmap;
  if (atlasDataStore && fontMetricsStore) {
    // Font-assets-builder context - create instance
    const bitmapText = new BitmapTextRuntime(atlasDataStore, fontMetricsStore);
    measureTextCrispBitmap = text => bitmapText.measureText(text, originalFontProperties, textProperties);
  } else {
    // Runtime context (test-renderer) - use static API
    measureTextCrispBitmap = text => BitmapText.measureText(text, originalFontProperties, textProperties);
  }
  let originalLinesMeasures_CSS_Px = measureMultilineText(testCopyLines, measureTextCrispBitmap);
  let linesMeasures_CSS_Px = originalLinesMeasures_CSS_Px;



  let fontPropertiesForcedPixelDensity1 = null;

  // pixel-density-1-forcing is a trick where we draw at pixelDensity 1 size 2n
  // the advantage is that we can reuse an atlas that was generated for pixelDensity 1
  let didPixelDensity1Forcing = false;
  if (drawAllPixelDensitiesWithLargerPixelDensity1Text && originalFontProperties.pixelDensity === 2) {
    // Create new FontProperties with pixelDensity=1 and doubled fontSize
    fontPropertiesForcedPixelDensity1 = new FontProperties(
      1, // pixelDensity
      originalFontProperties.fontFamily,
      originalFontProperties.fontStyle,
      originalFontProperties.fontWeight,
      originalFontProperties.fontSize * 2
    );

    if (atlasDataStore && fontMetricsStore) {
      const bitmapText = new BitmapTextRuntime(atlasDataStore, fontMetricsStore);
      measureTextCrispBitmap = text => bitmapText.measureText(text, fontPropertiesForcedPixelDensity1, textProperties);
    } else {
      measureTextCrispBitmap = text => BitmapText.measureText(text, fontPropertiesForcedPixelDensity1, textProperties);
    }
    linesMeasures_CSS_PxForcedPixelDensity1 = measureMultilineText(testCopyLines, measureTextCrispBitmap);

    fontProperties = fontPropertiesForcedPixelDensity1;
    linesMeasures_CSS_Px = linesMeasures_CSS_PxForcedPixelDensity1;

    didPixelDensity1Forcing = true;
  }


  bitmapAtlasDrawCrispText(linesMeasures_CSS_Px, testCopyLines, fontProperties, testCopyChoiceNumber, null, null, null, null, null, textProperties, atlasDataStore, fontMetricsStore);

  // Render blue text to demonstrate colored slow path
  const blueTextProperties = new TextProperties({
    isKerningEnabled: textProperties.isKerningEnabled,
    textBaseline: textProperties.textBaseline,
    textAlign: textProperties.textAlign,
    textColor: '#0000FF'
  });
  bitmapAtlasDrawCrispText(linesMeasures_CSS_Px, testCopyLines, fontProperties, testCopyChoiceNumber, null, null, null, null, 'Crisp Bitmap Text Drawing (using atlas) - BLUE COLOR:', blueTextProperties, atlasDataStore, fontMetricsStore);

  if (originalFontProperties.pixelDensity === 2) {
    // Create new FontProperties with pixelDensity=1 (same fontSize)
    let fontPropertiesPixelDensity1 = new FontProperties(
      1, // pixelDensity
      originalFontProperties.fontFamily,
      originalFontProperties.fontStyle,
      originalFontProperties.fontWeight,
      originalFontProperties.fontSize
    );

    if (atlasDataStore && fontMetricsStore) {
      const bitmapText = new BitmapTextRuntime(atlasDataStore, fontMetricsStore);
      measureTextCrispBitmap = text => bitmapText.measureText(text, fontPropertiesPixelDensity1, textProperties);
    } else {
      measureTextCrispBitmap = text => BitmapText.measureText(text, fontPropertiesPixelDensity1, textProperties);
    }
    const linesMeasures_CSS_PxPixelDensity1 = measureMultilineText(testCopyLines, measureTextCrispBitmap);

    const redTextProperties = textProperties.withTextColor('red');
    const canvas = bitmapAtlasDrawCrispText(linesMeasures_CSS_PxPixelDensity1, testCopyLines, fontPropertiesPixelDensity1, testCopyChoiceNumber, null, 2, false, null, "Comparison pixel density 2 (red) and pixel density 1 scaled (black, should be blurred)", textProperties, atlasDataStore, fontMetricsStore);
    bitmapAtlasDrawCrispText(originalLinesMeasures_CSS_Px, testCopyLines, originalFontProperties, testCopyChoiceNumber, canvas, null, null, 'multiply', null, 'red', redTextProperties, atlasDataStore, fontMetricsStore);
  }

  // If we did the pixel-density-1-forcing, let's
  // compare the text rendering done normally with the text rendering done with the pixel-density-1-forcing
  if (didPixelDensity1Forcing) {
    const redTextProperties = textProperties.withTextColor('red');
    const canvas = bitmapAtlasDrawCrispText(linesMeasures_CSS_PxForcedPixelDensity1, testCopyLines, fontPropertiesForcedPixelDensity1, testCopyChoiceNumber, null, null, null, null, "Comparison crisp bitmap text drawing from atlas original pixel density (red) and forced pixel density 1 (black)", textProperties, atlasDataStore, fontMetricsStore);
    bitmapAtlasDrawCrispText(originalLinesMeasures_CSS_Px, testCopyLines, originalFontProperties, testCopyChoiceNumber, canvas, null, null, 'multiply', null, 'red', redTextProperties, atlasDataStore, fontMetricsStore);
  }

  stdDrawCrispText(originalLinesMeasures_CSS_Px, testCopyLines, originalFontProperties);
  stdDrawCrispThinLines(originalLinesMeasures_CSS_Px, testCopyLines, originalFontProperties);
  stdDrawSmoothText(originalLinesMeasures_CSS_Px, testCopyLines, originalFontProperties);
}

function drawTestTextViaIndividualCanvasesNotViaAtlas(linesMeasures, testCopyLines, fontProperties, testCopyChoiceNumber, textProperties) {
  // Debug: Check if glyphs exist
  const testGlyph = AtlasDataStoreFAB.getGlyph(fontProperties, 'A');
  console.log(`[DEBUG] drawTestTextViaIndividualCanvasesNotViaAtlas - fontProperties.key: ${fontProperties.key}, test glyph 'A' exists: ${!!testGlyph}, has tightCanvas: ${!!testGlyph?.tightCanvas}`);

  addElementToDOM(createDivWithText('Crisp Bitmap Text Drawing with individual canvases (not using atlas):'));
  const canvas = createCanvas(linesMeasures.width, linesMeasures.height, fontProperties.pixelDensity);
  console.log(`[DEBUG] Created canvas: ${canvas.width}x${canvas.height}, measures: ${linesMeasures.width}x${linesMeasures.height}, pixelDensity: ${fontProperties.pixelDensity}`);
  addElementToDOM(canvas);
  const ctx = canvas.getContext('2d');
  createCheckerboardBackground(ctx);

  // note that we assume that we draw with baseline = 'bottom' i.e.
  // the chosen x,y is at the crossing of the first column and last row
  // of where any pixel can be drawn
  // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textBaseline
  testCopyLines.forEach((line, i) => {
    const yPosition = Math.round((i + 1) * linesMeasures.height / testCopyLines.length);
    BitmapTextFAB.drawTextViaIndividualCanvasesNotViaAtlas(ctx, line, 0, yPosition, fontProperties, textProperties);
  });

  let hashMatchInfo = '';
  if (!drawCheckeredBackgrounds)
    hashMatchInfo = getHashMatchInfo(ctx, fontProperties, "atlas testCopyChoiceNumber " + testCopyChoiceNumber);

  addCanvasInfoToDOM(canvas, hashMatchInfo);
  addElementToDOM(document.createElement('br'));
}

// This is useful to show that one can draw text without disrupting the existing canvas,
// which is worth checking because for exammple drawing the text with a specific color
// involves some non-trivial canvas operations that could indeed disrupt what's underneath.
function createCheckerboardBackground(ctx) {
  if (drawCheckeredBackgrounds) {
    const gridColor1 = '#E0E0E0';
    const gridColor2 = '#F0F0F0';
    const gridWidth = 10;
    const gridHeight = 10;

    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    for (let x = 0; x < canvasWidth; x += gridWidth) {
        for (let y = 0; y < canvasHeight; y += gridHeight) {
            ctx.fillStyle = (x / gridWidth + y / gridHeight) % 2 === 0 ? gridColor1 : gridColor2;
            ctx.fillRect(x, y, gridWidth, gridHeight);
        }
    }
  }
  else {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }
}

function bitmapAtlasDrawCrispText(linesMeasures, testCopyLines, fontProperties, testCopyChoiceNumber, canvas = null, scale, checkTheHashes = true, blendingMode = null, sectionLabel = 'Crisp Bitmap Text Drawing (using atlas):', textProperties = null, atlasDataStore = null, fontMetricsStore = null) {
  // Handle null/falsy sectionLabel by using default
  if (!sectionLabel) {
    sectionLabel = 'Crisp Bitmap Text Drawing (using atlas):';
  }

  textProperties = textProperties || getTextPropertiesFromUI();
  const textColor = textProperties.textColor;

  let drawOverExistingCanvas = false;

  if (canvas)
    drawOverExistingCanvas = true;

  // if scale is null then set it to 1
  if (!scale) scale = 1;

  // Check if we're in placeholder mode (metrics available but atlasData missing)
  let isPlaceholderMode;
  if (atlasDataStore && fontMetricsStore) {
    // Font-assets-builder context
    const atlasData = atlasDataStore.getAtlasData(fontProperties);
    isPlaceholderMode = !atlasDataStore.isValidAtlas(atlasData);
  } else {
    // Runtime context
    isPlaceholderMode = !BitmapText.hasAtlas(fontProperties.idString);
  }

  // Update section label if in placeholder mode
  let actualSectionLabel = sectionLabel;
  if (isPlaceholderMode && sectionLabel === 'Crisp Bitmap Text Drawing (using atlas):') {
    actualSectionLabel = 'Crisp Bitmap Text Drawing with placeholder rectangles (atlas missing):';
  }

  if (!drawOverExistingCanvas) {
    addElementToDOM(createDivWithText(actualSectionLabel));
    canvas = createCanvas(linesMeasures.width * scale, linesMeasures.height * scale, fontProperties.pixelDensity);
    addElementToDOM(canvas);
  }
  
  const ctx = canvas.getContext('2d');

  if (blendingMode) {
    ctx.globalCompositeOperation = blendingMode;
  }

  //ctx.fillStyle = 'white';
  //ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!drawOverExistingCanvas) {
    createCheckerboardBackground(ctx);
  }
  else {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (scale != 1) {
    ctx.save();
    ctx.scale(scale, scale);
  }


  startTiming('drawTestText via atlas');
  if (atlasDataStore && fontMetricsStore) {
    // Font-assets-builder context
    const bitmapText = new BitmapTextRuntime(atlasDataStore, fontMetricsStore);
    testCopyLines.forEach((line, i) => {
      const yPosition = Math.round((i + 1) * linesMeasures.height / testCopyLines.length);
      bitmapText.drawTextFromAtlas(ctx, line, 0, yPosition, fontProperties, textProperties);
    });
  } else {
    // Runtime context
    testCopyLines.forEach((line, i) => {
      const yPosition = Math.round((i + 1) * linesMeasures.height / testCopyLines.length);
      BitmapText.drawTextFromAtlas(ctx, line, 0, yPosition, fontProperties, textProperties);
    });
  }
  console.log(`⏱️ drawTestText via atlas ${stopTiming('drawTestText via atlas')} milliseconds`);

  if (!drawOverExistingCanvas) {
    let hashMatchInfo = '';
    if (checkTheHashes !== false && !drawCheckeredBackgrounds) {
      // Detect if this is blue text by checking the text color
      const isBlueText = textProperties && textProperties.textColor === '#0000FF';
      hashMatchInfo = getHashMatchInfo(ctx, fontProperties, "atlas testCopyChoiceNumber " + testCopyChoiceNumber, isBlueText);
    }

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

function buildAndDisplayAtlases(fontProperties) {
  // Build Atlas (variable-width cells)
  addElementToDOM(createDivWithText("Atlas Source (variable-width cells):"));
  const atlasResult = AtlasDataStoreFAB.buildAtlas(fontProperties);

  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = atlasResult.canvas.width;
  sourceCanvas.height = atlasResult.canvas.height;
  const sourceCtx = sourceCanvas.getContext('2d');
  sourceCtx.drawImage(atlasResult.canvas, 0, 0);

  addElementToDOM(sourceCanvas);
  addCanvasInfoToDOM(sourceCanvas, getHashMatchInfo(sourceCtx, fontProperties, 'atlas source'));

  // Reconstruct Tight Atlas from Atlas
  addElementToDOM(createDivWithText("Tight Atlas (reconstructed from source):"));
  const reconstructedData = AtlasDataStoreFAB.reconstructTightAtlas(
    atlasResult.canvas,
    fontProperties
  );

  // CRITICAL: Store the reconstructed tight atlas in both stores
  // AtlasDataStoreFAB for building pipeline, BitmapText for rendering
  AtlasDataStoreFAB.setAtlasData(fontProperties, reconstructedData);
  BitmapText.setAtlasData(fontProperties, reconstructedData);

  // Also store metrics in BitmapText for rendering
  const fontMetrics = FontMetricsStore.getFontMetrics(fontProperties);
  if (fontMetrics) {
    BitmapText.setFontMetrics(fontProperties, fontMetrics);
  }

  const tightCanvas = document.createElement('canvas');
  tightCanvas.width = reconstructedData.atlasImage.width;
  tightCanvas.height = reconstructedData.atlasImage.height;
  const tightCtx = tightCanvas.getContext('2d');
  tightCtx.drawImage(reconstructedData.atlasImage.image, 0, 0);

  addElementToDOM(tightCanvas);
  addCanvasInfoToDOM(tightCanvas, getHashMatchInfo(tightCtx, fontProperties, 'tight atlas'));
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

function getHashMatchInfo(ctx, fontProperties, hashSuffix = '', isBlueText = false) {
  let message = '';

  if (isBlueText) {
    // For blue text: use a different key for the colored hash to avoid false mismatch
    const blueHashKey = calculateFontPropertiesHashKey(fontProperties, hashSuffix + '-blue-color');
    const blueTextHashString = ctx.getHashString();
    const blueResult = hashStore.compareHash(blueHashKey, blueTextHashString);
    message += 'Blue text hash: ' + blueTextHashString + ' ' + blueResult.message;

    // Calculate black-and-white hash (all non-white pixels converted to black)
    const blackAndWhiteHashString = ctx.getBlackAndWhiteHashString();
    const originalHashKey = calculateFontPropertiesHashKey(fontProperties, hashSuffix);
    const blackAndWhiteResult = hashStore.compareHash(originalHashKey, blackAndWhiteHashString);
    message += '\nBlack-and-white hash: ' + blackAndWhiteHashString + ' ' + blackAndWhiteResult.message;

    // Only turn page red if black-and-white hash mismatches (indicates real rendering problem)
    if (blackAndWhiteResult.status === 'mismatch') {
      document.body.style.backgroundColor = '#FFC0CB';
    }
  } else {
    // Standard black text: original behavior
    const hashKey = calculateFontPropertiesHashKey(fontProperties, hashSuffix);
    const crispTextHashString = ctx.getHashString();
    const result = hashStore.compareHash(hashKey, crispTextHashString);
    message = result.message;

    if (result.status === 'mismatch') {
      document.body.style.backgroundColor = '#FFC0CB';
    }
  }

  return message;
}

function calculateFontPropertiesHashKey(fontProperties, hashSuffix = '') {
  return fontProperties.idString + (hashSuffix ? ' ' + hashSuffix : '');
}
