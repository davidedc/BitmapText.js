// a class to store all the crispBitmapGlyphs
// so that we can retrieve them by font family, font size and letter

class CrispBitmapGlyphStore {
  constructor() {
    this.glyphs = {};
  }

    addGlyph(glyph) {
      if (!this.glyphs[glyph.fontFamily]) {
        this.glyphs[glyph.fontFamily] = {};
      }
      if (!this.glyphs[glyph.fontFamily][glyph.fontSize]) {
        this.glyphs[glyph.fontFamily][glyph.fontSize] = {};
      }
      if (!this.glyphs[glyph.fontFamily][glyph.fontSize][glyph.letter]) {
        this.glyphs[glyph.fontFamily][glyph.fontSize][glyph.letter] = glyph;
      }
    }

    getGlyph(fontFamily, fontSize, letter) {
      if (this.glyphs[fontFamily] && this.glyphs[fontFamily][fontSize] && this.glyphs[fontFamily][fontSize][letter]) {
        return this.glyphs[fontFamily][fontSize][letter];
      }
      return null;
    }
}

// a class CrispBitmpTextDrawer, constructed with a CrispBitmapGlyphStore
// has a method to draw text on a canvas
// the text is drawn by looking up the glyphs in the CrispBitmapGlyphStore
// and drawing them on the canvas one after the other, advancing the x position by the width of the glyph
// the text is drawn with the top bottom left corner of the first glyph at the x, y position specified

class CrispBitmapTextDrawer {
  constructor(glyphStore) {
    this.glyphStore = glyphStore;
  }

  drawText(ctx, text, x, y, fontSize, fontFamily) {
    for (let i = 0; i < text.length; i++) {
      const letter = text[i];
      const glyph = this.glyphStore.getGlyph(fontFamily, fontSize, letter);
      

      if (glyph) {
        if (glyph.tightCanvas)
          ctx.drawImage(glyph.tightCanvas, x + glyph.tightCanvasBox.topLeftCorner.x , y - glyph.tightCanvas.height - glyph.tightCanvas.distanceBetweenBottomAndBottomOfCanvas + 2);
        x += glyph.letterMeasures.width;
      }
    }
  }
}



class CrispBitmapGlyph {
  constructor(letter, fontSize, fontFamily) {
    this.letter = letter;
    this.fontSize = fontSize;
    this.fontFamily = fontFamily;

    var returned = this.createCanvasesAndCompressedPixels();
    // unpack the returned stuff into class properties
    this.compressedPixels = returned.compressedPixels;
    this.canvas = returned.canvas;
    this.tightCanvas = returned.tightCanvas;
    this.tightCanvasBox = returned.tightCanvasBox;
    this.letterMeasures = returned.letterMeasures;

    this.displayCanvasesAndData();
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
    ctx.strokeRect(this.tightCanvasBox.topLeftCorner.x, this.tightCanvasBox.topLeftCorner.y, this.tightCanvasBox.bottomRightCorner.x - this.tightCanvasBox.topLeftCorner.x, this.tightCanvasBox.bottomRightCorner.y - this.tightCanvasBox.topLeftCorner.y);
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
    ctx.font = this.fontSize + 'px ' + this.fontFamily;
  
    // size the canvas so it fits the this.letter
    var letterMeasures = ctx.measureText(this.letter);
    canvas.width = letterMeasures.width;
    canvas.height = letterMeasures.fontBoundingBoxAscent + letterMeasures.fontBoundingBoxDescent;

    // make the background white
    //ctx.fillStyle = 'white';
    //ctx.fillRect(0, 0, canvas.width, canvas.height);
  
    ctx.fillStyle = 'black';
  
    // draw the text so that it fits in the canvas
    // see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textBaseline
    ctx.textBaseline = 'bottom';
  
    ctx.font = this.fontSize + 'px ' + this.fontFamily;
    ctx.fillText(this.letter, 0, canvas.height-1);

    // now can remove the canvas from the page
    canvas.remove();

    return canvas;
  }

  getBoundingBoxOfBlackPixels(canvas) {
    // get the image data
    const blackWhitePxsArray = this.getBlackAndWhitePixelsArray(canvas);
  
    // draw the bounding box of the text
    const tightCanvasBox = this.getBoundingBox(canvas, blackWhitePxsArray);
  
    const tightCanvas = document.createElement('canvas');

    if (tightCanvasBox.topLeftCorner === null || tightCanvasBox.bottomRightCorner === null) {
      return {tightCanvas: null, tightCanvasBox: null}
    }

    // copy the bounding box to a new canvas and add it to the page
    tightCanvas.width = tightCanvasBox.bottomRightCorner.x - tightCanvasBox.topLeftCorner.x + 1;
    tightCanvas.height = tightCanvasBox.bottomRightCorner.y - tightCanvasBox.topLeftCorner.y + 1;
    tightCanvas.distanceBetweenBottomAndBottomOfCanvas = canvas.height - tightCanvasBox.bottomRightCorner.y;
    const tightCanvasBoxCtx = tightCanvas.getContext('2d');
  
    tightCanvasBoxCtx.drawImage(canvas, tightCanvasBox.topLeftCorner.x, tightCanvasBox.topLeftCorner.y, tightCanvas.width, tightCanvas.height, 0, 0, tightCanvas.width, tightCanvas.height);
    return {tightCanvas, tightCanvasBox};
  }

  createCanvasesAndCompressedPixels() {
    var canvas = this. createCanvasWithLetter();
    var letterMeasures = {width: canvas.width, height: canvas.height};
    const ctx = canvas.getContext('2d');

    var returned = this.getBoundingBoxOfBlackPixels(canvas);
    if (returned.tightCanvas === null) {
      return {compressedPixels: null, canvas, tightCanvas: null, tightCanvasBox: null, letterMeasures};
    }

    var tightCanvas = returned.tightCanvas;
    var tightCanvasBox = returned.tightCanvasBox;
    
  
    // get the image data
    const blackWhitePxsArrayBoundingBox = this.getBlackAndWhitePixelsArray(tightCanvas);
  
    // do a simple compression of the data by looking for runs of zeros and ones
    const compressedPixels = this.compressPixels(blackWhitePxsArrayBoundingBox).join(',');
  
  
    // return the compressedPixels and the teo canvases
    return {
      compressedPixels,
      canvas,
      tightCanvas,
      tightCanvasBox,
      letterMeasures
    };
  
  }

// function that gets the bounding box of the text and its position, by looking at the pixels
 getBoundingBox(canvas, blackWhitePxsArray) {

  // find the top left and bottom right corners of the text
  let topLeftCorner = null;
  let bottomRightCorner = null;

  for (let i = 0; i < blackWhitePxsArray.length; i++) {
    if (blackWhitePxsArray[i]) {
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



getBlackAndWhitePixelsArray(canvas) {
  var ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // create a new array with a boolean for each pixel to represent whether it is black or not
  const pixels = [];
  for (let i = 0; i < data.length; i += 4) {
    // isBlack is when any of the components is 0 AND the alpha is not 0
    // that's because we are working with canvases with transparent backgrounds
    // because glyphs often have are painted on top of other content AND also
    // because glyphs actually often have to overlap with each other e.g. in the case of "ff" in Times New Roman
    const isBlack = data[i] === 0 && data[i+3] !== 0;
    pixels.push(isBlack);
  }
  return pixels;
}

 compressPixels(pixels) {
  const compressedPixels = [];
  let currentPixel = pixels[0];
  let currentPixelCount = 0;
  for (let i = 0; i < pixels.length; i++) {
    if (currentPixel === pixels[i]) {
      currentPixelCount++;
    } else {
      compressedPixels.push(currentPixelCount);
      currentPixel = pixels[i];
      currentPixelCount = 1;
    }
  }
  compressedPixels.push(currentPixelCount);
  return compressedPixels;
  }
}

/////////////////////////////////////////////////////
//
//   add the size input and run button to the page
//   and kick-off code to show the glyphs and data
//
/////////////////////////////////////////////////////

// add the size input and run button to the page
const sizeInput = document.createElement('input');
sizeInput.id = 'size-input';
sizeInput.type = 'number';
sizeInput.value = 80; // on safari on mac, sizes up to 181 are not anti-aliased, then from 182 onwards are anti-aliased
document.body.appendChild(sizeInput);

// add a dropdown with the font family options
const fontFamilySelect = document.createElement('select');
fontFamilySelect.id = 'font-family-select';
const fontFamilies = ['Arial', 'Courier New', 'Times New Roman', 'Verdana', 'Georgia', 'Comic Sans MS', 'Impact', 'Lucida Console', 'Lucida Sans Unicode', 'Tahoma', 'Trebuchet MS'];
for (let i = 0; i < fontFamilies.length; i++) {
  const option = document.createElement('option');
  option.value = fontFamilies[i];
  option.textContent = fontFamilies[i];
  fontFamilySelect.appendChild(option);
}
document.body.appendChild(fontFamilySelect);


const runButton = document.createElement('button');
runButton.id = 'run-button';
runButton.textContent = 'Build and Show Glyphs';
document.body.appendChild(runButton);

// append a line break
document.body.appendChild(document.createElement('br'));


runButton.addEventListener('click', () => {
  const size = parseInt(sizeInput.value);
  if (!isNaN(size)) {
    // remove all canvases and divs from the page
    removeAllCanvasesAndDivs();
    showCharsAndDataForSize(size, fontFamilySelect.value);
  }

  function removeAllCanvasesAndDivs() {
    const canvases = document.querySelectorAll('canvas');
    for (let i = 0; i < canvases.length; i++) {
      canvases[i].remove();
    }
    const divs = document.querySelectorAll('div');
    for (let i = 0; i < divs.length; i++) {
      divs[i].remove();
    }
  }
});


function showCharsAndDataForSize(size, fontFamily) {
  // create a new CrispBitmapGlyph object
  var crispBitmapGlyphStore = new CrispBitmapGlyphStore();
  
  crispBitmapGlyphStore.addGlyph(new CrispBitmapGlyph(' ', size, fontFamily));
  crispBitmapGlyphStore.addGlyph(new CrispBitmapGlyph('█', size, fontFamily));

  // lower case letters
  for (let i = 97; i < 123; i++) {
    const letter = String.fromCharCode(i);
    crispBitmapGlyphStore.addGlyph(new CrispBitmapGlyph(letter, size, fontFamily));
  }

  // upper case letters
  for (let i = 65; i < 91; i++) {
    const letter = String.fromCharCode(i);
    crispBitmapGlyphStore.addGlyph(new CrispBitmapGlyph(letter, size, fontFamily));
  }

  // numbers
  for (let i = 48; i < 58; i++) {
    const letter = String.fromCharCode(i);
    crispBitmapGlyphStore.addGlyph(new CrispBitmapGlyph(letter, size, fontFamily));
  }

  allOtherChars = '!"#$%&€\'()*+,-./:;<=>?@[\]^_`{|}~—£°²·ÀÇàç•';
  // all chars in allOtherChars
  for (let i = 0; i < allOtherChars.length; i++) {
    const letter = allOtherChars[i];
    crispBitmapGlyphStore.addGlyph(new CrispBitmapGlyph(letter, size, fontFamily));
  }

  var testText = 'Hello World ÀÇ█gMffAVAWWW';

  // create a canvas just to find the text measures for the antialiased version (easy: don't add it to the DOM)
  const canvas4 = document.createElement('canvas');
  const ctx4 = canvas4.getContext('2d');
  ctx4.font = size + 'px ' + fontFamily;
  const testTextMeasures = ctx4.measureText(testText);

  // create a canvas to find the text measures for the crisp version (we need to add it to the DOM for the CSS properties to be applied)
  const canvas5 = document.createElement('canvas');
  canvas5.width = 1;
  canvas5.height = 1;
  document.body.insertBefore(canvas5, document.body.firstChild);
  const ctx5 = canvas5.getContext('2d');
  ctx5.font = size + 'px ' + fontFamily;
  const testTextMeasuresCrisp = ctx5.measureText(testText);



  // add a canvas at the top of the page and draw "Hello World" on it using the standard canvas text drawing methods
  const canvas3 = document.createElement('canvas');
  canvas3.width = testTextMeasures.width; // todo not entirely correct to use width
  canvas3.height = testTextMeasures.fontBoundingBoxAscent + testTextMeasures.fontBoundingBoxDescent;

  const ctx3 = canvas3.getContext('2d');
  ctx3.fillStyle = 'white';
  ctx3.fillRect(0, 0, canvas3.width, canvas3.height);
  ctx3.fillStyle = 'black';
  ctx3.font = size + 'px ' + fontFamily;
  ctx3.textBaseline = 'bottom';

  ctx3.fillText( testText , 0, canvas3.height-1);
  // add to DOM after drawing the text so
  // the CSS property to make it crisp doesn't work
  document.body.insertBefore(canvas3, document.body.firstChild);
  // add some text above the canvas to say what it is
  const div3 = document.createElement('div');
  div3.textContent = 'Standard Canvas Text Drawing with smoothing:';
  document.body.insertBefore(div3, document.body.firstChild);
  

  // add another canvas at the top of the page and draw "Hello World" on it using the standard canvas text drawing methods
  const canvas2 = document.createElement('canvas');
  canvas2.width = testTextMeasuresCrisp.width; // todo not entirely correct to use width
  canvas2.height = testTextMeasuresCrisp.fontBoundingBoxAscent + testTextMeasures.fontBoundingBoxDescent;
  // add to DOM before drawing the text otherwise
  // the CSS property to make it crisp doesn't work
  document.body.insertBefore(canvas2, document.body.firstChild);
  const ctx2 = canvas2.getContext('2d');
  ctx2.fillStyle = 'white';
  ctx2.fillRect(0, 0, canvas2.width, canvas2.height);
  ctx2.fillStyle = 'black';
  ctx2.font = size + 'px ' + fontFamily;
  ctx2.textBaseline = 'bottom';
  ctx2.fillText( testText , 0, canvas2.height-1);
  // add some text above the canvas to say what it is
  const div2 = document.createElement('div');
  div2.textContent = 'Standard Canvas Text Drawing with no smoothing:';
  document.body.insertBefore(div2, document.body.firstChild);


  // add another canvas at the top of the page and draw "Hello World" on it using the CrispBitmapTextDrawer
  const canvas = document.createElement('canvas');
  // TODO not entirely correct to use width, plus
  // TODO need to use own measureText method of the Crisp kind
  canvas.width = testTextMeasuresCrisp.width + 20;
  canvas.height = testTextMeasuresCrisp.fontBoundingBoxAscent + testTextMeasures.fontBoundingBoxDescent;
  document.body.insertBefore(canvas, document.body.firstChild);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'black';
  const crispBitmapTextDrawer = new CrispBitmapTextDrawer(crispBitmapGlyphStore);
  crispBitmapTextDrawer.drawText(ctx, testText, 0, canvas.height-1, size, fontFamily);
  // add some text above the canvas to say what it is
  const div = document.createElement('div');
  div.textContent = 'Crisp Bitmap Text Drawing:';
  document.body.insertBefore(div, document.body.firstChild);
  

}
