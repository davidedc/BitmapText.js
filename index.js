class Glyph {
  constructor(letter, fontSize, fontFamily) {
    this.letter = letter;
    this.fontSize = fontSize;
    this.fontFamily = fontFamily;

    var returned = this.createCanvasesAndCompressedData();
    // unpack the returned stuff into class properties
    this.compressedPixels = returned.compressedPixels;
    this.canvas = returned.canvas;
    this.tightCanvas = returned.tightCanvas;
    this.tightCanvasBox = returned.tightCanvasBox;

    this.displayCanvasesAndData();
  }

  displayCanvasesAndData() {
    this.drawBoundingBox();
    document.body.appendChild(this.canvas);
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

    canvas.width = 200;
    canvas.height = 50;
  
    const ctx = canvas.getContext('2d');
    ctx.font = this.fontSize + 'px ' + this.fontFamily;
  
    // size the canvas so it fits the this.letter
    canvas.width = ctx.measureText(this.letter).width;
    canvas.height = this.fontSize * 1.5;

    // make the background white
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  
    ctx.fillStyle = 'black';
  
    // draw the text so that it fits in the canvas
    // see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textBaseline
    ctx.textBaseline = 'top';
  
    ctx.font = this.fontSize + 'px ' + this.fontFamily;
    ctx.fillText(this.letter, 0, 0);

    // now can remove the canvas from the page
    canvas.remove();

    return canvas;
  }

  getBoundingBoxOfBlackPixels(canvas) {
    // get the image data
    const blackWhitePxsArray = this.getBlackAndWhitePixelsArray(canvas);
  
    // draw the bounding box of the text
    const tightCanvasBox = this.getBoundingBox(canvas, blackWhitePxsArray);
  
    // copy the bounding box to a new canvas and add it to the page
    const tightCanvas = document.createElement('canvas');
    tightCanvas.width = tightCanvasBox.bottomRightCorner.x - tightCanvasBox.topLeftCorner.x + 1;
    tightCanvas.height = tightCanvasBox.bottomRightCorner.y - tightCanvasBox.topLeftCorner.y + 1;
    const tightCanvasBoxCtx = tightCanvas.getContext('2d');
  
    tightCanvasBoxCtx.drawImage(canvas, tightCanvasBox.topLeftCorner.x, tightCanvasBox.topLeftCorner.y, tightCanvas.width, tightCanvas.height, 0, 0, tightCanvas.width, tightCanvas.height);
    return {tightCanvas, tightCanvasBox};
  }

  createCanvasesAndCompressedData() {
    var canvas = this. createCanvasWithLetter();
    const ctx = canvas.getContext('2d');

    var returned = this.getBoundingBoxOfBlackPixels(canvas);
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
      tightCanvasBox
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
    const isBlack = data[i] === 0;
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
sizeInput.value = 10; // on safari on mac, sizes up to 181 are not anti-aliased, then from 182 onwards are anti-aliased
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
runButton.textContent = 'Run';
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
  // create a new Glyph object
  var glyph
  
  glyph = new Glyph('█', size, fontFamily);

  // lower case letters
  for (let i = 97; i < 123; i++) {
    const letter = String.fromCharCode(i);
    glyph = new Glyph(letter, size, fontFamily);
  }

  // upper case letters
  for (let i = 65; i < 91; i++) {
    const letter = String.fromCharCode(i);
    glyph = new Glyph(letter, size, fontFamily);
  }

  // numbers
  for (let i = 48; i < 58; i++) {
    const letter = String.fromCharCode(i);
    glyph = new Glyph(letter, size, fontFamily);
  }

  allOtherChars = '!"#$%&€\'()*+,-./:;<=>?@[\]^_`{|}~—£°²·ÀÇàç•';
  // all chars in allOtherChars
  for (let i = 0; i < allOtherChars.length; i++) {
    const letter = allOtherChars[i];
    glyph = new Glyph(letter, size, fontFamily);
  }
}
