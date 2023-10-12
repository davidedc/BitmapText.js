class CrispBitmapGlyph {
  constructor(letter, fontSize, fontFamily, fontEmphasis) {
    this.letter = letter;
    this.fontSize = fontSize;
    this.fontFamily = fontFamily;
    this.fontEmphasis = fontEmphasis;

    var returned = this.createCanvasesAndCompressedPixels();
    // unpack the returned stuff into class properties
    this.compressedPixels = returned.bestCompression;
    this.canvas = returned.canvas;
    this.tightCanvas = returned.tightCanvas;
    this.tightCanvasBox = returned.tightCanvasBox;
    this.letterMeasures = returned.letterMeasures;

    this.displayCanvasesAndData();
    debugger
  }

  displayCanvasesAndData() {
    document.body.appendChild(this.canvas);
    if (this.tightCanvas === null) {
      // append a new line
      const div = document.createElement('div');
      document.body.appendChild(div);
      return;
    }
    // this.drawBoundingBox();
    document.body.appendChild(this.tightCanvas);
    const div = document.createElement('div');
    div.textContent = this.compressedPixels;
    document.body.appendChild(div);
  }

  drawBoundingBox() {
    var ctx = this.canvas.getContext('2d');
    ctx.strokeStyle = 'red';
    ctx.strokeRect(this.tightCanvasBox.topLeftCorner.x / PIXEL_DENSITY, this.tightCanvasBox.topLeftCorner.y / PIXEL_DENSITY, (this.tightCanvasBox.bottomRightCorner.x - this.tightCanvasBox.topLeftCorner.x) / PIXEL_DENSITY, (this.tightCanvasBox.bottomRightCorner.y - this.tightCanvasBox.topLeftCorner.y) / PIXEL_DENSITY);
  }

  // this method can be refactored with the next two
  getSingleFloatCorrectionForLetter(fontFamily, letter, nextLetter, fontSize, fontEmphasis, correctionKey, pixelDensity) {

    // if specs[fontFamily][fontEmphasis][correctionKey] doesn't exist
    if (!specCombinationExists(fontFamily, fontEmphasis, correctionKey)) {
      return 0;
    }

    if (fontSize <= specs[fontFamily][fontEmphasis][correctionKey]) {
      return 0;
    }
  
    for (let i = 0; i < specs[fontFamily][fontEmphasis][correctionKey].length; i++) {
      const correctionEntry = specs[fontFamily][fontEmphasis][correctionKey][i];
      if (correctionEntry.sizeRange == undefined) return 0;

      // check if the passed pixelDensity is the same as the one in the correctionEntry
      // if not, return 0
      // if (pixelDensity !== null) debugger;
      if (pixelDensity !== null && correctionEntry.sizeRange.pixelDensity !== null && pixelDensity !== correctionEntry.sizeRange.pixelDensity) continue;

      if (correctionEntry.sizeRange.from <= fontSize && correctionEntry.sizeRange.to >= fontSize) {
        for (let j = 0; j < correctionEntry.lettersAndTheirCorrections.length; j++) {
          const charAndOffset = correctionEntry.lettersAndTheirCorrections[j];
          if (charAndOffset.string.indexOf(letter) !== -1) {
            return charAndOffset.adjustment;
          }
        }
      }
    }
  
    return 0;
  }

  getSingleFloatCorrection(fontFamily, fontSize, fontEmphasis, correctionKey) {

    // if specs[fontFamily][fontEmphasis][correctionKey] doesn't exist
    if (!specCombinationExists(fontFamily, fontEmphasis, correctionKey)) {
      return null;
    }

    if (fontSize <= specs[fontFamily][fontEmphasis][correctionKey]) {
      return null;
    }
  
    for (let i = 0; i < specs[fontFamily][fontEmphasis][correctionKey].length; i++) {
      const correctionEntry = specs[fontFamily][fontEmphasis][correctionKey][i];
      if (correctionEntry.sizeRange == undefined) return null;
      if (correctionEntry.sizeRange.from <= fontSize && correctionEntry.sizeRange.to >= fontSize) {
        return correctionEntry.correction;
      }
    }
  
    return null;
  }

  getSingleFloatCorrectionForSizeBracket(fontFamily, fontSize, fontEmphasis, correctionKey, kerning) {

    if (!specCombinationExists(fontFamily, fontEmphasis, correctionKey)) {
      return null;
    }

    if (fontSize <= specs[fontFamily][fontEmphasis][correctionKey]) {
      return null;
    }
  
    for (let i = 0; i < specs[fontFamily][fontEmphasis][correctionKey].length; i++) {
      const correctionEntry = specs[fontFamily][fontEmphasis][correctionKey][i];
      if (correctionEntry.sizeRange == undefined) return null;
      if (correctionEntry.sizeRange.from <= fontSize && correctionEntry.sizeRange.to >= fontSize) {
        for (let j = 0; j < correctionEntry.sizeBracketAndItsCorrection.length; j++) {
          // get the two floats representing the size range
          // from something like:
          //    { kernG: 0, kernLE: 0.145, adjustment: -1 }
          const sizeRangeLower = correctionEntry.sizeBracketAndItsCorrection[j].kernLE;
          const sizeRangeUpper = correctionEntry.sizeBracketAndItsCorrection[j].kernG;
          if (sizeRangeLower < kerning && sizeRangeUpper >= kerning) {
            return correctionEntry.sizeBracketAndItsCorrection[j].adjustment;
          }
        }
      }
    }
  
    return null;
  }


  createCanvasWithLetter() {
    const canvas = document.createElement('canvas');

    // add the canvas to the page otherwise the
    // CSS font smoorhing properties are not applied
    // I tried setting the properties via javascript
    // like this:
    //   canvas.style["-webkit-font-smoothing"] = "none";
    //   canvas.style["-moz-osx-font-smoothing"] = "none";
    //   canvas.style["font-smooth"] = "never";
    // but it didn't work
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    ctx.font = this.fontEmphasis + " " + this.fontSize + 'px ' + this.fontFamily;

    // size the canvas so it fits the this.letter
    var letterMeasuresOrig = ctx.measureText(this.letter);

    // let's make a copy of letterMeasuresOrig into letterMeasures
    // so we can modify it
    var letterMeasures = {};
    for (var key in letterMeasuresOrig) {
      letterMeasures[key] = letterMeasuresOrig[key];
    }

    // for the space character, Chrome gives actualBoundingBoxLeft == actualBoundingBoxRight == 0
    // even if the width is not 0. Since we are going to use the actualBoundingBoxLeft and actualBoundingBoxRight
    // to size the canvas, we need to fix that.
    if (letterMeasures.actualBoundingBoxLeft === 0 && letterMeasures.actualBoundingBoxRight === 0) {
      letterMeasures.actualBoundingBoxRight = letterMeasures.width;
    }

    //////////////////////////////////////////////
    // START OF LETTER-LEVEL RENDERING CORRECTIONS
    //////////////////////////////////////////////
    // These defects we are fixing are visible at small sizes (12px or so), however
    // that's a crucial use case for a crisp text renderer.
    // The defects to be corrected can be spotted by disabling all the kerning corrections and
    // rendering at size 12 (pretty much the smallest legible size) and looking
    // for problems like letters that touch, letters that miss a pixel, letter that
    // are systematically too far/close to the previous/next, etc.
    // These corrections are specific to the font, and also
    // likely specific to the OS, browser and possibly
    // depend on other factors like the screen resolution, etc.
    // HOWEVER once we fix them, we bake the letters and their sizes and
    // the kerning info into a format that we re-use pixel-perfectly in all
    // OSs and browsers, so these corrections only need to be done in
    // one place to get a good rendering everywhere.
    // for the letter "W" Arial 80px let's add 2 pixels to the actualBoundingBoxRight...
    // ...don't understand why, but the actualBoundingBoxLeft + actualBoundingBoxRight
    // is not enough to fit the letter in the canvas and the top-right gets ever so slightly clipped...

    // get the specs for "ActualBoundingBoxLeft correction px" of this
    // font family and emphasis and size
    

    letterMeasures.actualBoundingBoxLeft += this.getSingleFloatCorrectionForLetter(this.fontFamily, this.letter, null, this.fontSize, this.fontEmphasis, "ActualBoundingBoxLeft correction px");
    //console.log ("letterMeasures.actualBoundingBoxLeft: " + letterMeasures.actualBoundingBoxLeft);
    letterMeasures.actualBoundingBoxRight += this.getSingleFloatCorrectionForLetter(this.fontFamily, this.letter, null, this.fontSize, this.fontEmphasis, "ActualBoundingBoxRight correction px");
    //console.log ("letterMeasures.actualBoundingBoxRight: " + letterMeasures.actualBoundingBoxRight);
    letterMeasures.actualBoundingBoxLeft += Math.floor(this.fontSize * this.getSingleFloatCorrectionForLetter(this.fontFamily, this.letter, null, this.fontSize, this.fontEmphasis, "ActualBoundingBoxLeft correction proportional"));
    //console.log ("letterMeasures.actualBoundingBoxLeft: " + letterMeasures.actualBoundingBoxLeft);
    letterMeasures.actualBoundingBoxRight += Math.floor(this.fontSize * this.getSingleFloatCorrectionForLetter(this.fontFamily, this.letter, null, this.fontSize, this.fontEmphasis, "ActualBoundingBoxRight correction proportional"));
    //console.log ("letterMeasures.actualBoundingBoxRight: " + letterMeasures.actualBoundingBoxRight);
    letterMeasures.width += Math.floor(this.fontSize * this.getSingleFloatCorrectionForLetter(this.fontFamily, this.letter, null, this.fontSize, this.fontEmphasis, "Advancement correction proportional"));
    //console.log ("letterMeasures.width: " + letterMeasures.width);
  


    // END OF LETTER-LEVEL RENDERING CORRECTIONS
    /////////////////////////////////////////////

    // Happens at small sizes due to a browser rendering defect.
    // This correction will simply paint the letter
    // n pixel more to the right in the mini canvas
    const cropLeftCorrection_CSS_Px = this.getSingleFloatCorrectionForLetter(this.fontFamily, this.letter, null, this.fontSize, this.fontEmphasis, "CropLeft correction px", PIXEL_DENSITY);

    var canvasPixelsWidth = Math.round(letterMeasures.actualBoundingBoxLeft + letterMeasures.actualBoundingBoxRight);
    canvas.style.width = canvasPixelsWidth + 'px';
    canvas.width = canvasPixelsWidth * PIXEL_DENSITY;

    // add a div with letterMeasures.actualBoundingBoxLeft + letterMeasures.actualBoundingBoxRight
    const div = document.createElement('div');
    div.textContent = this.letter + " bbox left: " + letterMeasures.actualBoundingBoxLeft + " bbox right:" + letterMeasures.actualBoundingBoxRight;

    // add to the textcontent the actualBoundingBoxLeft in red if it's not 0
    if (letterMeasures.actualBoundingBoxLeft !== 0) {
      div.style.color = "red";
    }

    document.body.appendChild(div);

    var canvasPixelsHeight = Math.round(letterMeasures.fontBoundingBoxAscent + letterMeasures.fontBoundingBoxDescent);;
    canvas.style.height = canvasPixelsHeight + 'px';
    canvas.height = canvasPixelsHeight * PIXEL_DENSITY;

    ctx.scale(PIXEL_DENSITY, PIXEL_DENSITY);

    // make the background white
    //ctx.fillStyle = 'white';
    //ctx.fillRect(0, 0, canvas.width / PIXEL_DENSITY, canvas.height / PIXEL_DENSITY);
    // draw the text so that it fits in the canvas
    // see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textBaseline
    ctx.textBaseline = 'bottom';

    ctx.font = this.fontEmphasis + " " + this.fontSize + 'px ' + this.fontFamily;

    // you have to start painting the letter at actualBoundingBoxLeft because that's how much
    // TO THE LEFT OF THAT POINT that letter will ALSO extend
    ctx.fillText(this.letter, Math.round(letterMeasures.actualBoundingBoxLeft) + cropLeftCorrection_CSS_Px, canvas.height / PIXEL_DENSITY - 1);

    // now can remove the canvas from the page
    canvas.remove();

    return { canvas, letterMeasures };
  }

  getBoundingBoxOfOnPixels(canvas) {
    // get the image data
    const onPixelsArray = this.getOnPixelsArray(canvas);

    // draw the bounding box of the text
    // TODO you'd rather use the 2D array here
    const tightCanvasBox = this.getBoundingBox(canvas, onPixelsArray);

    const tightCanvas = document.createElement('canvas');

    if (tightCanvasBox.topLeftCorner === null || tightCanvasBox.bottomRightCorner === null) {
      return { tightCanvas: null, tightCanvasBox: null };
    }

    // copy the bounding box to a new canvas and add it to the page
    var tightCanvasPixelsWidth = tightCanvasBox.bottomRightCorner.x - tightCanvasBox.topLeftCorner.x + 1 * PIXEL_DENSITY;
    tightCanvas.style.width = tightCanvasPixelsWidth / PIXEL_DENSITY + 'px';
    tightCanvas.width = tightCanvasPixelsWidth;

    var tightCanvasPixelsHeight = tightCanvasBox.bottomRightCorner.y - tightCanvasBox.topLeftCorner.y + 1 * PIXEL_DENSITY;
    tightCanvas.style.height = tightCanvasPixelsHeight / PIXEL_DENSITY + 'px';
    tightCanvas.height = tightCanvasPixelsHeight;

    tightCanvas.distanceBetweenBottomAndBottomOfCanvas = canvas.height - tightCanvasBox.bottomRightCorner.y;
    const tightCanvasBoxCtx = tightCanvas.getContext('2d');

    // avoid scaling here and just use physical pixels coordinates and sizes since the source and destination canvases have the same scale
    tightCanvasBoxCtx.drawImage(canvas, tightCanvasBox.topLeftCorner.x , tightCanvasBox.topLeftCorner.y , tightCanvas.width , tightCanvas.height , 0, 0, tightCanvas.width , tightCanvas.height );
    return { tightCanvas, tightCanvasBox };
  }

  createCanvasesAndCompressedPixels() {
    var returned = this.createCanvasWithLetter();
    var canvas = returned.canvas;
    var letterMeasures = returned.letterMeasures;

    const ctx = canvas.getContext('2d');

    var returned = this.getBoundingBoxOfOnPixels(canvas);
    //if (this.letter === ' ') {
    //  console.log("for space:");
    //  console.dir(returned);
    //}
    if (returned.tightCanvas === null) {
      return { compressedPixels: null, canvas, tightCanvas: null, tightCanvasBox: null, letterMeasures };
    }

    var tightCanvas = returned.tightCanvas;
    var tightCanvasData = tightCanvas.getContext('2d').getImageData(0, 0, tightCanvas.width, tightCanvas.height).data;
    var tightCanvasBox = returned.tightCanvasBox;

    const div = document.createElement('div');
    div.textContent = "tightCanvasBox width in px, phys: " + (tightCanvasBox.bottomRightCorner.x - tightCanvasBox.topLeftCorner.x) + " css: " + (tightCanvasBox.bottomRightCorner.x - tightCanvasBox.topLeftCorner.x) / PIXEL_DENSITY; 
    document.body.appendChild(div);



    // get the image data
    // const onPixelsArrayBoundingBox = this.getOnPixelsArray(tightCanvas);
    // do a simple compression of the data by looking for runs of zeros and ones
    //const compressedPixels = this.compressPixels(onPixelsArrayBoundingBox).join(',');

    //const compressedPixels = this.compressPixels(this.getOnPixelsInOrder(tightCanvas, createIndicesFromCanvas(tightCanvas))).join(',');

    var NUM_REMAPS_STAGES = 3;
    var REMAPS_COUNT = 10;
    // create an array "remapsCombinations" containing all possible arrays of NUM_REMAPS_STAGES integers from 0 to REMAPS_COUNT
    var remapsCombinations = [];
    for (let i = 0; i < Math.pow(REMAPS_COUNT, NUM_REMAPS_STAGES); i++) {
      remapsCombinations.push([]);
    }

    // print all possible sequences of NUM_REMAPS_STAGES integers from 0 to REMAPS_COUNT
    for (let i = 0; i < Math.pow(REMAPS_COUNT, NUM_REMAPS_STAGES); i++) {
      for (let j = 0; j < NUM_REMAPS_STAGES; j++) {
        remapsCombinations[i].push(Math.floor(i / Math.pow(REMAPS_COUNT, j)) % REMAPS_COUNT);
      }
    }


    var remapIndices = function(indices, remapID) {
      // switch on the remap, 0 does nothing, 1 does a diagonalStripesRemap
      switch (remapID) {
        case 0:
          return indices;
        case 1:
          return diagonalStripesRemap(indices.width, indices.height, indices.coordinates);
        case 2:
          return spiralOutsideInRemap(indices.width, indices.height, indices.coordinates);
        case 3:
          return bustrophedicHorizontalRemap(indices.width, indices.height, indices.coordinates);
        case 4:
          return horizontalFlipRemap(indices.width, indices.height, indices.coordinates);
        case 5:
          return verticalFlipRemap(indices.width, indices.height, indices.coordinates);
        case 6:
          return turn90DegreesRightRemap(indices.width, indices.height, indices.coordinates);
        case 7:
          return gilbert2dRemap(indices.width, indices.height, indices.coordinates);
        case 8:
          return foldRightHalfOnLeftHalfRemap(indices.width, indices.height, indices.coordinates);
        case 9:
          return foldBottomHalfOnTopHalfRemap(indices.width, indices.height, indices.coordinates);
        default:
          debugger
      }
    }


    // for each possible remaps combination in remapsCombinations
    var bestCompression = null;
    var bestIndex = null;
    var bestRemapCombination = null;
    var bestOnPixelsInOrder = null;
    for (let i = 0; i < remapsCombinations.length; i++) {
      var indexes = createIndicesFromCanvas(tightCanvas);
      var currentRemapCombination = remapsCombinations[i];
      // for each remap stage
      for (let j = 0; j < NUM_REMAPS_STAGES; j++) {
        // remap the indices
        indexes = remapIndices(indexes, currentRemapCombination[j]);
      }
      // compress the pixels
      var onPixelsInOrder = this.getOnPixelsInOrder(tightCanvas, indexes);
      const compressedPixels = this.compressPixels(onPixelsInOrder).join(',');
      // make a version of the currentRemapCombination removing any zeroes in it
      var currentRemapCombinationNoZeroes = [];
      for (let j = 0; j < currentRemapCombination.length; j++) {
        if (currentRemapCombination[j] !== 0) {
          currentRemapCombinationNoZeroes.push(currentRemapCombination[j]);
        }
      }
      // pre-pend the compressedPixels string with a string version of the currentRemapCombinationNoZeroes
      var compressedPixelsWithHeader = currentRemapCombinationNoZeroes.join(',') + '//' + compressedPixels;

      // if currentRemapCombinationNoZeroes contains 8 then print out to console the compressedPixelsWithHeader
      //if (currentRemapCombinationNoZeroes.indexOf(8) !== -1) {
      //  console.log("with vertical fold: " + compressedPixelsWithHeader);
      //}

      // record the compressedPixels into bestCompression if it's the shortest so far
      if (bestCompression === null || compressedPixelsWithHeader.length < bestCompression.length) {
        bestCompression = compressedPixelsWithHeader;
        bestIndex = indexes;
        bestRemapCombination = currentRemapCombinationNoZeroes;
        bestOnPixelsInOrder = onPixelsInOrder;
      }      
    }
    console.log("best: " + bestCompression);

    // visualise all the images for steps of the winning remap combination
    var indexes = createIndicesFromCanvas(tightCanvas);
    // for each remap stage
    for (let j = 0; j < bestRemapCombination.length; j++) {
      // remap the indices
      indexes = remapIndices(indexes, bestRemapCombination[j]);


      // create a canvas of size indexes.width x indexes.height
      var tightCanvasIndexesVizWidth = indexes.width;
      var tightCanvasIndexesVizHeight = indexes.height;
      var tightCanvasIndexesViz = document.createElement('canvas');
      tightCanvasIndexesViz.style.width = tightCanvasIndexesVizWidth / PIXEL_DENSITY + 'px';
      tightCanvasIndexesViz.width = tightCanvasIndexesVizWidth;
      tightCanvasIndexesViz.style.height = tightCanvasIndexesVizHeight / PIXEL_DENSITY + 'px';
      tightCanvasIndexesViz.height = tightCanvasIndexesVizHeight;
      // put the onPixelsInOrder into the tightCanvasIndexesViz image data
      var tightCanvasIndexesVizCtx = tightCanvasIndexesViz.getContext('2d');
      var imageData = tightCanvasIndexesVizCtx.createImageData(tightCanvasIndexesVizWidth, tightCanvasIndexesVizHeight);
      var data = imageData.data;
      for (let i = 0; i < indexes.coordinates.length; i++) {
        const x = indexes.coordinates[i][0];
        const y = indexes.coordinates[i][1];
        // get the image data
        const isOn = tightCanvasData[(y * tightCanvas.width + x) * 4 + 3] !== 0;
        if (isOn) {
          data[i * 4 + 0] = 0;
          data[i * 4 + 1] = 0;
          data[i * 4 + 2] = 0;
          data[i * 4 + 3] = 255;
        } else {
          data[i * 4 + 0] = 255;
          data[i * 4 + 1] = 255;
          data[i * 4 + 2] = 255;
          data[i * 4 + 3] = 255;
        }
      }
      // put the image data into the canvas
      tightCanvasIndexesVizCtx.putImageData(imageData, 0, 0);
      // add the tightCanvasIndexesViz to the page
      document.body.appendChild(tightCanvasIndexesViz);

    }    



    /*
    // create a canvas of size bestIndex.width x bestIndex.height
    var tightCanvasIndexesVizWidth = bestIndex.width;
    var tightCanvasIndexesVizHeight = bestIndex.height;
    var tightCanvasIndexesViz = document.createElement('canvas');
    tightCanvasIndexesViz.style.width = tightCanvasIndexesVizWidth / PIXEL_DENSITY + 'px';
    tightCanvasIndexesViz.width = tightCanvasIndexesVizWidth;
    tightCanvasIndexesViz.style.height = tightCanvasIndexesVizHeight / PIXEL_DENSITY + 'px';
    tightCanvasIndexesViz.height = tightCanvasIndexesVizHeight;

    // put the bestOnPixelsInOrder into the tightCanvasIndexesViz image data
    var tightCanvasIndexesVizCtx = tightCanvasIndexesViz.getContext('2d');
    var imageData = tightCanvasIndexesVizCtx.createImageData(tightCanvasIndexesVizWidth, tightCanvasIndexesVizHeight);
    var data = imageData.data;
    for (let i = 0; i < bestOnPixelsInOrder.length; i++) {
      const isOn = bestOnPixelsInOrder[i];
      if (isOn) {
        data[i * 4 + 0] = 0;
        data[i * 4 + 1] = 0;
        data[i * 4 + 2] = 0;
        data[i * 4 + 3] = 255;
      } else {
        data[i * 4 + 0] = 255;
        data[i * 4 + 1] = 255;
        data[i * 4 + 2] = 255;
        data[i * 4 + 3] = 255;
      }
    }
    tightCanvasIndexesVizCtx.putImageData(imageData, 0, 0);
    document.body.appendChild(tightCanvasIndexesViz);
    */


    //const compressedPixels = this.compressPixels(this.getOnPixelsInOrder(tightCanvas, indexes)).join(',');

    // return the compressedPixels and the two canvases
    return {
      bestCompression,
      canvas,
      tightCanvas,
      tightCanvasBox,
      letterMeasures
    };

  }

  // function that gets the bounding box of the text and its position, by looking at the pixels
  getBoundingBox(canvas, onPixelsArray) {

    // find the top left and bottom right corners of the text
    let topLeftCorner = null;
    let bottomRightCorner = null;

    for (let i = 0; i < onPixelsArray.length; i++) {
      if (onPixelsArray[i]) {
        const x = i % canvas.width;
        const y = Math.floor(i / canvas.width);

        if (topLeftCorner === null) {
          topLeftCorner = { x, y };
        }

        if (bottomRightCorner === null) {
          bottomRightCorner = { x, y };
        }
        bottomRightCorner.y = y;

        if (x < topLeftCorner.x) {
          topLeftCorner.x = x;
        }
        if (x > bottomRightCorner.x) {
          bottomRightCorner.x = x;
        }
      }
    }

    // return the bounding box
    return {
      topLeftCorner,
      bottomRightCorner
    };
  }


  // takes the canvas and returns an array of booleans representing whether each pixel is on or not
  getOnPixels2DArray(canvas) {
    var ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // create a new 2D array with a boolean for each pixel to represent whether it is on or not
    // note that the color in which the character is painted doesn't matter, we are just looking
    // for pixels that are not transparent
    const pixels2DArray = [];
    for (let y = 0; y < canvas.height; y++) {
      const row = [];
      for (let x = 0; x < canvas.width; x++) {
        // isOn is when any of the components is 0 AND the alpha is not 0
        // that's because we are working with canvases with transparent backgrounds
        // because glyphs often have are painted on top of other content AND also
        // because glyphs actually often have to overlap with each other e.g. in the case of "ff" in Times New Roman
        const isOn = data[(y * canvas.width + x) * 4 + 3] !== 0;
        row.push(isOn);
      }
      pixels2DArray.push(row);
    }
    return pixels2DArray; 
  }


  getOnPixelsArray(canvas) {
    var ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // create a new array with a boolean for each pixel to represent whether it is on or not
    // note that the color in which the character is painted doesn't matter, we are just looking
    // for pixels that are not transparent
    const pixels = [];
    for (let i = 0; i < data.length; i += 4) {
      // isOn is when any of the components is 0 AND the alpha is not 0
      // that's because we are working with canvases with transparent backgrounds
      // because glyphs often have are painted on top of other content AND also
      // because glyphs actually often have to overlap with each other e.g. in the case of "ff" in Times New Roman
      const isOn = data[i + 3] !== 0;
      pixels.push(isOn);
    }
    return pixels;
  }

  // gets an array of coordinates and returns an array of booleans representing whether each pixel is on or not
  getOnPixelsInOrder(canvas, coordinates) {
    var ctx = canvas.getContext('2d');
    var data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    return coordinates.coordinates.map((coordinate) => {
      const x = coordinate[0];
      const y = coordinate[1];
      // get the image data
      const isOn = data[(y * canvas.width + x) * 4 + 3] !== 0;
      return isOn;
    });
  }

  // does a RLE (Run Length Encoding) compression of the pixels array
  compressPixels(pixelsArray) {
    const compressedPixels = [];
    
    // you start assuming an off pixel.
    // (you have to assume a starting pixel color)
    let currentPixel = false;

    let currentPixelCount = 0;
    for (let i = 0; i < pixelsArray.length; i++) {
      if (currentPixel === pixelsArray[i]) {
        currentPixelCount++;
      } else {
        compressedPixels.push(currentPixelCount);
        currentPixel = pixelsArray[i];
        currentPixelCount = 1;
      }
    }
    compressedPixels.push(currentPixelCount);
    return compressedPixels;
  }
}
