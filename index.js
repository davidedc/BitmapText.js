const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
var text = '█Sphinx█ g, j, q, p, y';

var fontSize = 10;

canvas.width = 200;
canvas.height = 50;

document.body.appendChild(canvas);

ctx.font =  fontSize + 'px Arial';

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
ctx.fillText(text, 0, 0);

// get the image data
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
const data = imageData.data;

// create a new array with a boolean for each pixel to represent whether it is black or not
const pixels = [];
for (let i = 0; i < data.length; i += 4) {
  const isBlack = data[i] === 0;
  pixels.push(isBlack);
}

// do a simple compression of the data by looking for runs of zeros and ones
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

// add a div to the page with the compressed data
const div = document.createElement('div');
div.textContent = compressedPixels.join(',');
document.body.appendChild(div);





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