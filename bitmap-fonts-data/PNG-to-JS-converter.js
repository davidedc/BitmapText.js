// If you use the renderer from filesystem, it will load the image sheets from the filesystem
// the problem with that is that when loading images, the browser considers each of them
// as a separate domain, so they are tainted as cross-origin. You CAN still paint them on a canvas
// however you can't read the pixels from the canvas, and hence you can't check the hash of the image of
// generated text.
//
// With this script you put the image data in a JS file, and load the image from the JS file.
// When loading .js files, the browser considers all of them as the same domain (strange but true),
// so the images are not tainted as cross-origin.
// This way you can read the pixels from the canvas and check the hash of the image of generated text.

const fs = require('fs');
const path = require('path');

// Function to convert PNG to base64
function pngToBase64(filePath) {
    const png = fs.readFileSync(filePath);
    return Buffer.from(png).toString('base64');
}

// Get all PNG files in the current directory
const pngFiles = fs.readdirSync('.').filter(file => path.extname(file).toLowerCase() === '.png');

// Process each PNG file
pngFiles.forEach(pngFile => {
    const base64Data = pngToBase64(pngFile);
    const jsFileName = 'image-' + pngFile.replace('.png', '.js');
    const jsContent = `
if (typeof imagesFromJs === 'undefined') {
    var imagesFromJs = {};
}
imagesFromJs['${pngFile.replace('.png', '').replace('glyphs-sheet-','')}'] = '${base64Data}';
`;

    fs.writeFileSync(jsFileName, jsContent);
    console.log(`Processed ${pngFile} -> ${jsFileName}`);
});

console.log('All PNG files have been converted to JS files.');
