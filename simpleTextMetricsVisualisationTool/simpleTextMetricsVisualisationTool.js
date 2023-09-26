// add a textbox to the page where we will put the text to be drawn
const textbox = document.createElement("textarea");
textbox.id = "textbox";
textbox.style.float = "left";
textbox.value = "ffff";
document.body.appendChild(textbox);

// add another textbox where you can change the context font
// e.g. "italic 50px serif"
const fontTextbox = document.createElement("textarea");
fontTextbox.id = "font-textbox";
fontTextbox.style.float = "left";
// picking a font that has significant actualBoundingBoxLeft and actualBoundingBoxRight
// and a size such that my version of Safari shows nice round numbers for all the metrics
fontTextbox.value = "italic 54px serif";
document.body.appendChild(fontTextbox);


let text = null;
let font = null;

// put the contents of the textbox in a variable "text" as you type
textbox.addEventListener("input", function() {
    getNewSettingsFromTextboxes();
    removeAllDivsAndRecreateContents();
    }
);

fontTextbox.addEventListener("input", function() {
    getNewSettingsFromTextboxes();
    removeAllDivsAndRecreateContents();
});


getNewSettingsFromTextboxes();
createPageContentsApartFromTextboxes();

function getNewSettingsFromTextboxes() {
    text = textbox.value;
    font = fontTextbox.value;
}

function removeAllDivsAndRecreateContents() {
    const canvases = document.querySelectorAll("canvas");
    for (let i = 0; i < canvases.length; i++)
        canvases[i].remove();

    const divs = document.querySelectorAll("div");
    for (let i = 0; i < divs.length; i++)
            divs[i].remove();

    text = textbox.value;
    createPageContentsApartFromTextboxes();
}

function createPageContentsApartFromTextboxes() {
    const canvas = document.createElement("canvas");
    canvas.width = 700;
    canvas.height = 150;

    // make the canvas stay in its own line by adding a clear:both div before it
    const clearDiv = document.createElement("div");
    clearDiv.style.clear = "both";
    document.body.appendChild(clearDiv);

    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");


    const pos = [10, 100];
    ctx.font = font;
    const metrics = ctx.measureText(text);
    const width = Math.abs(metrics.actualBoundingBoxLeft) +
        Math.abs(metrics.actualBoundingBoxRight);

    const height = Math.abs(metrics.actualBoundingBoxAscent) +
        Math.abs(metrics.actualBoundingBoxDescent);

    const bounds = {
        top: pos[1] - metrics.actualBoundingBoxAscent,
        right: pos[0] + metrics.actualBoundingBoxRight,
        bottom: pos[1] + metrics.actualBoundingBoxDescent,
        left: pos[0] - metrics.actualBoundingBoxLeft
    };

    //console.log(bounds);
    ctx.fillText(text, pos[0], pos[1]);

    // draw a red "x" of line thickness 2 centered at pos
    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;
    const xSize = 5;
    ctx.beginPath();
    ctx.moveTo(pos[0] - xSize, pos[1] - xSize);

    ctx.lineTo(pos[0] + xSize, pos[1] + xSize);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos[0] + xSize, pos[1] - xSize);
    ctx.lineTo(pos[0] - xSize, pos[1] + xSize);
    ctx.stroke();


    // Using bounding box
    ctx.strokeStyle = "red";
    ctx.strokeRect(bounds.left, bounds.top, width, height);


    // add another canvas with twice the width and height of the first one
    // scan the pixels of the first canvas and for each of them, draw a 2x2 square on the second canvas
    // with the color of the pixel
    createScaledCanvas(canvas, ctx, 6);


    console.assert(
        width === bounds.right - bounds.left,
        "Bounds width should match calculation"
    );
    console.assert(
        height === bounds.bottom - bounds.top,
        "Bounds height should match calculation"
    );

    const div0 = document.createElement("div");
    div0.textContent = `metrics.width: ${metrics.width}`;
    document.body.appendChild(div0);

    // a div with the width calculated as the sum of the absolute values of the actualBoundingBoxLeft and actualBoundingBoxRight
    const div1 = document.createElement("div");
    div1.textContent = `calculated width: ${width}`;
    document.body.appendChild(div1);

 
    const div = document.createElement("div");
    div.textContent = `actualBoundingBoxLeft: ${metrics.actualBoundingBoxLeft}`;
    document.body.appendChild(div);
 
    const div2 = document.createElement("div");
    div2.textContent = `actualBoundingBoxRight: ${metrics.actualBoundingBoxRight}`;
    document.body.appendChild(div2);

    // a div with the calculated height as the sum of the absolute values of the actualBoundingBoxAscent and actualBoundingBoxDescent
    const div5 = document.createElement("div");
    div5.textContent = `calculated height: ${height}`;
    document.body.appendChild(div5);
 
    const div3 = document.createElement("div");
    div3.textContent = `actualBoundingBoxAscent: ${metrics.actualBoundingBoxAscent}`;
    document.body.appendChild(div3);
 
    const div4 = document.createElement("div");
    div4.textContent = `actualBoundingBoxDescent: ${metrics.actualBoundingBoxDescent}`;
    document.body.appendChild(div4);
    
}

function createScaledCanvas(canvas, ctx, scale) {
    const canvas2 = document.createElement("canvas");
    canvas2.width = canvas.width * scale;
    canvas2.height = canvas.height * scale;
    document.body.appendChild(canvas2);
    const ctx2 = canvas2.getContext("2d");

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const x = (i / 4) % canvas.width;
        const y = Math.floor((i / 4) / canvas.width);

        const x2 = x * scale;
        const y2 = y * scale;

        ctx2.fillStyle = `rgba(${data[i]}, ${data[i + 1]}, ${data[i + 2]}, ${data[i + 3] / 255})`;
        ctx2.fillRect(x2, y2, scale, scale);
    }
}

// given a canvas and its context, return an array of rectangles
// that describe the image on the canvas
function findMinimumSetOfRectsDescribingImage(canvas, ctx) {
    // 1. get the image data as just an array of booleans
    // 2. make a copy of the array, called "covered", with all values set to false
    //    this array will keep track of which pixels have been covered by a rectangle
    // 3. start to scan the image data array from the top left corner
    // 4. when you find a pixel that is not covered, find the rectangle with the biggest area that covers only "painted" pixels, whether they have already been covered or not
    // 5. add the rectangle to the array of rectangles
    // 6. mark all the pixels in the rectangle as covered
    // 7. repeat from step 3 until all pixels have been covered
    // 8. return the array of rectangles

    // 1. get the image data as just an array of booleans
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const paintedPixels = [];

    for (let i = 0; i < data.length; i += 4) {
        const x = (i / 4) % canvas.width;
        const y = Math.floor((i / 4) / canvas.width);

        const alpha = data[i + 3];
        paintedPixels.push(alpha > 0);
    }

    // 2. make a copy of the array, called "covered", with all values set to false
    const covered = [];
    for (let i = 0; i < paintedPixels.length; i++)
        covered.push(false);

    // 3. start to scan the image data array from the top left corner
    const rects = [];

    for (let i = 0; i < paintedPixels.length; i++) {
        const x = i % canvas.width;
        const y = Math.floor(i / canvas.width);

        // if the pixel is not painted, skip it
        if (!paintedPixels[i])
            continue;

        // if the pixel is painted and covered, skip it
        if (covered[i])
            continue;

        // 4. when you find a pixel that is not covered, find the rectangle with the biggest area that covers only "painted" pixels, whether they have already been covered or not
        const rect = findBiggestRectContainingPixel(paintedPixels, covered, x, y, canvas.width, canvas.height);

        // 5. add the rectangle to the array of rectangles
        rects.push(rect);

        // 6. mark all the pixels in the rectangle as covered
        for (let j = rect.top; j <= rect.bottom; j++)
            for (let k = rect.left; k <= rect.right; k++)
                covered[j * canvas.width + k] = true;

        // 7. repeat from step 3 until all pixels have been covered

   }
}

// given an array of booleans "paintedPixels" that describes an image,
// and an array of booleans "covered" that describes which pixels have been covered by a rectangle,
// and a pixel with coordinates x and y,
// and the width and height of the image,
// return the biggest rectangle that contains the pixel and only painted pixels
function findBiggestRectContainingPixel(paintedPixels, covered, x, y, width, height) {
    // 1. start with a rectangle that is just the pixel
    // 2. find all possible rectangles that contain the pixel and only painted pixels
    // 3. find the first rectangle with the maximum area among them
    // 4. return it

    // 1. start with a rectangle that is just the pixel
    const rect = {
        left: x,
        right: x,
        top: y,
        bottom: y
    };

    // 2. find all possible rectangles that contain the pixel and only painted pixels
    // i.e. for every possible width, find the tallest rectangle that contains the pixel and only painted pixels

    // 2.1. return the first rectangle with the biggest area
    const rects = [];
    for (let i = 1; i <= width; i++) {
        const rect = findTallestRectContainingPixel(paintedPixels, covered, x, y, width, height, i);
        rects.push(rect);
    }

    // 3. find the first rectangle with the maximum area among them
    let maxArea = 0;
    let maxAreaRect = null;
    for (let i = 0; i < rects.length; i++) {
        const rect = rects[i];
        const area = (rect.right - rect.left + 1) * (rect.bottom - rect.top + 1);
        if (area > maxArea) {
            maxArea = area;
            maxAreaRect = rect;
        }
    }

    // 4. return it
    return maxAreaRect;
}

