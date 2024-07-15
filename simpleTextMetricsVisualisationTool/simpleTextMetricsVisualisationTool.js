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
    for (const element of canvases)
        element.remove();

    const divs = document.querySelectorAll("div");
    for (const element of divs)
            element.remove();

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
