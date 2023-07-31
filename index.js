// add the size input and run button to the page
const sizeInput = document.createElement('input');
sizeInput.id = 'size-input';
sizeInput.type = 'number';
sizeInput.value = 10; // on safari on mac, sizes up to 181 are not antialiased, then from 182 onwards are anti-aliased
document.body.appendChild(sizeInput);

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
    const canvases = document.querySelectorAll('canvas');
    for (let i = 0; i < canvases.length; i++) {
      canvases[i].remove();
    }
    const divs = document.querySelectorAll('div');
    for (let i = 0; i < divs.length; i++) {
      divs[i].remove();
    }


    showCharsAndDataForSize(size);
  }
});





function showCharsAndDataForSize(size) {
  showCanvasAndCompressedDataForStringAtSize('█', size);

  // run showCanvasAndCompressedDataForStringAtSize for all lower case letters
  for (let i = 97; i < 123; i++) {
    const letter = String.fromCharCode(i);
    showCanvasAndCompressedDataForStringAtSize(letter, size);
  }

  // run showCanvasAndCompressedDataForStringAtSize for all upper case letters
  for (let i = 65; i < 91; i++) {
    const letter = String.fromCharCode(i);
    showCanvasAndCompressedDataForStringAtSize(letter, size);
  }

  // run showCanvasAndCompressedDataForStringAtSize for all numbers
  for (let i = 48; i < 58; i++) {
    const letter = String.fromCharCode(i);
    showCanvasAndCompressedDataForStringAtSize(letter, size);
  }

  allOtherChars = '!"#$%&€\'()*+,-./:;<=>?@[\]^_`{|}~—£°²·ÀÇàç•';
  // run showCanvasAndCompressedDataForStringAtSize for all chars in allOtherChars
  for (let i = 0; i < allOtherChars.length; i++) {
    const letter = allOtherChars[i];
    showCanvasAndCompressedDataForStringAtSize(letter, size);
  }
}

function showCanvasAndCompressedDataForStringAtSize(text, fontSize) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = 200;
  canvas.height = 50;

  document.body.appendChild(canvas);

  ctx.font = fontSize + 'px Arial';

  // size the canvas so it fits the text
  canvas.width = ctx.measureText(text).width;
  canvas.height = fontSize * 1.5;

  // make the background white
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);



  ctx.fillStyle = 'black';
  //ctx.fillText(text, 10, 30);
  // draw the text so that it fits in the canvas
  ctx.textBaseline = 'top';
  ctx.font = fontSize + 'px Arial';
  ctx.fillText(text, 0, 0);

  // get the image data
  const pixels = getBlackWhitePxsArray(canvas);

  // do a simple compression of the data by looking for runs of zeros and ones
  const compressedPixels = compressPixels(pixels);

  // add a div to the page with the compressed data
  const div = document.createElement('div');
  div.textContent = compressedPixels.join(',');
  document.body.appendChild(div);
}

function getBlackWhitePxsArray(canvas) {
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

function compressPixels(pixels) {
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

/*
const canvas = document.createElement('canvas');
canvas.width = 500;
canvas.height = 500;

const ctx = canvas.getContext('2d');

var fontSize = 10;
var text = 'Hello World';



document.body.appendChild(canvas);

ctx.font =  fontSize + 'px Arial';



ctx.fillText(text, 10, 30);

*/