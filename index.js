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
      if (!this.glyphs[glyph.fontFamily][glyph.fontEmphasis]) {
        this.glyphs[glyph.fontFamily][glyph.fontEmphasis] = {};
      }
      if (!this.glyphs[glyph.fontFamily][glyph.fontEmphasis][glyph.fontSize]) {
        this.glyphs[glyph.fontFamily][glyph.fontEmphasis][glyph.fontSize] = {};
      }
      if (!this.glyphs[glyph.fontFamily][glyph.fontEmphasis][glyph.fontSize][glyph.letter]) {
        this.glyphs[glyph.fontFamily][glyph.fontEmphasis][glyph.fontSize][glyph.letter] = glyph;
      }
    }

    getGlyph(fontFamily, fontSize, letter, fontEmphasis) {
      if (this.glyphs[fontFamily] && this.glyphs[fontFamily][fontEmphasis] && this.glyphs[fontFamily][fontEmphasis][fontSize] && this.glyphs[fontFamily][fontEmphasis][fontSize][letter]) {
        return this.glyphs[fontFamily][fontEmphasis][fontSize][letter];
      }
      return null;
    }
}

// a class CrispBitmpTextDrawer, constructed with a CrispBitmapGlyphStore
// has a method to draw text on a canvas
// the text is drawn by looking up the glyphs in the CrispBitmapGlyphStore
// and drawing them on the canvas one after the other, advancing the x position by the width of the glyph
// the text is drawn with the top bottom left corner of the first glyph at the x, y position specified

class CrispBitmapText {
  constructor(glyphStore) {
    this.glyphStore = glyphStore;
  }

  measureText(text, fontSize, fontFamily, fontEmphasis) {
    var width = 0;
    for (let i = 0; i < text.length; i++) {
      const letter = text[i];

      const glyph = this.glyphStore.getGlyph(fontFamily, fontSize, letter, fontEmphasis);

      width += this.getAdvanceWidth(i, text, glyph, fontFamily, letter, fontSize, fontEmphasis);
    }
    // get the height of the text by looking at the height of 'a' - they are all the same height
    const glyph = this.glyphStore.getGlyph(fontFamily, fontSize, 'a', fontEmphasis);
    return {width, height: Math.round(glyph.letterMeasures.fontBoundingBoxAscent + glyph.letterMeasures.fontBoundingBoxDescent)};
  }

  hasLotsOfSpaceAtBottomRight(letter) {
    return ['V', '7', '/', 'T', 'Y'].indexOf(letter) !== -1;
  }

  hasLotsOfSpaceAtBottomLeft(letter) {
    return ['V', '\\', 'T', 'Y'].indexOf(letter) !== -1;
  }

  hasSomeSpaceAtBottomLeft(letter) {
    return ['W', '7'].indexOf(letter) !== -1;
  }


  hasSomeSpaceAtBottomRight(letter) {
    return ['W', 'f', 'P'].indexOf(letter) !== -1;
  }

  hasSpaceAtTopRight(letter) {
    return ['A', '\\', 'L', 'h'].indexOf(letter) !== -1;
  }

  protrudesBottomLeft(letter) {
    return ['A', '/'].indexOf(letter) !== -1;
  }

  protrudesBottomRight(letter) {
    return ['A', '\\', 'L'].indexOf(letter) !== -1;
  }

  protrudesTopLeft(letter) {
    return ['V', 'W', '\\', 'T', 'Y'].indexOf(letter) !== -1;
  }

  isShortCharacter(letter) {
    return ['a', 'c', 'e', 'g', 'i', 'j', 'm', 'n', 'o', 'p', 'q', 'r', 's', 'u', 'v', 'w', 'x', 'y', 'z', '.', ',', ':', ';', '—', '·', 'Ç', 'à', 'ç', '•'].indexOf(letter) !== -1;
  }
  

  getKerningCorrection(fontFamily, letter, nextLetter, fontSize, fontEmphasis) {

    if (fontSize <= specs[fontFamily][fontEmphasis]["kerning cutoff"]) {
      return 0;
    }

    if (fontFamily === 'Arial' && fontSize <= 21) {
      if (letter === 'A' && this.isShortCharacter(nextLetter)){
        return 0.1;
      }
    }

    if (fontFamily === 'Arial' && fontSize <= 20) {
      if ((['f','t','v','y'].indexOf(letter) !== -1) || (['f','t','v','y'].indexOf(nextLetter) !== -1)){
        return 0.1;
      }
      if (['r','k'].indexOf(letter) !== -1){
        return 0.1;
      }

      if (letter === 'p' && nextLetter === 'a') {
        return 0.1;
      }

      if (letter === 'c' && nextLetter === 'y') {
        return 0.1;
      }

      //if (letter === 'c' && nextLetter === 'c') {
      //  return 0.1;
      //}
    }

    // the j at sizes 21-23 is too close to the previous letter
    // and I can't fix this any other way, so I'm using this
    // anti-kerning hack here
    if (fontFamily === 'Arial' && (fontSize >= 21 && fontSize <= 23)) {
      if (['j'].indexOf(nextLetter) !== -1){
      return -0.15;
     }
    }

    // monospace fonts don't need kerning
    if (fontFamily === 'Courier New') {
      return 0;
    }

    // in my OS and my browser, the crisp rendering of consecutive V and W are joined together at the top,
    // which makes things like "WWW" just look like single zipgzag. Note that this doesn't happen in the
    // antialiased render. At any rate, we are going to correct the spacing between those pairs here.
    if (fontFamily === 'Arial' && (letter === 'W' || letter === 'V') && (nextLetter === 'W' || nextLetter === 'V')) {
      return -0.04;
    }

    if ((this.protrudesBottomRight(letter) && this.hasSomeSpaceAtBottomLeft(nextLetter)) || ( this.hasSomeSpaceAtBottomRight(letter) && this.protrudesBottomLeft(nextLetter))) {
      if (fontFamily === 'Arial') {
        return 0.1;
      }
      else if (fontFamily === 'Times New Roman') {
        return 0.1;
      }
      else {
        return 0.1;
      }
    }
    if (( this.hasLotsOfSpaceAtBottomRight(letter) && this.protrudesBottomLeft(nextLetter)) || ( this.protrudesBottomRight(letter) && this.hasLotsOfSpaceAtBottomLeft(nextLetter))) {
      if (fontFamily === 'Arial') {
        return 0.15;
      }
      else if (fontFamily === 'Times New Roman') {
        return 0.2;
      }
      else {
        return 0.1;
      }
    }

    if ( this.hasSpaceAtTopRight(letter) && this.protrudesTopLeft(nextLetter)) {
      if (fontFamily === 'Times New Roman') {
        return 0.2;
      }
      else {
        return 0.13;
      }
    }
    if ((this.isShortCharacter(letter) && this.hasSomeSpaceAtBottomLeft(nextLetter)) || (this.hasSomeSpaceAtBottomRight(letter) && this.isShortCharacter(nextLetter))) {
      if (fontFamily === 'Arial') {
        return 0.01;
      }
      else if (fontFamily === 'Times New Roman') {
        return 0.1;
      }
      else {
        return 0.1;
      }
    }
    if ((this.hasLotsOfSpaceAtBottomRight(letter) && this.isShortCharacter(nextLetter)) || ( this.isShortCharacter(letter) && this.hasLotsOfSpaceAtBottomLeft(nextLetter)) ) {
      if (fontFamily === 'Arial') {
        return 0.15;
      }
      else if (fontFamily === 'Times New Roman') {
        return 0.15;
      }
      else {
        return 0.1;
      }
    }
    if ( this.isShortCharacter(letter) && this.protrudesTopLeft(nextLetter)) {
      return 0.03;
    }
    return 0;
  }


  getAdvanceWidth(i, text, glyph, fontFamily, letter, fontSize, fontEmphasis) {
    var x = 0;


    if (i < text.length - 1){
      // console.log(glyph.letterMeasures.width + " " + x);

      // deal with the size of the " " character
      if (fontFamily === 'Arial') {
        if (glyph.letter === " ") {
          if (fontSize >= 15 && fontSize <= 20)
            return 5;
          else if (fontSize >= 14 && fontSize < 15)
            return 4;
          else if (fontSize >= 12 && fontSize < 14)
            return 3;
          else if (fontSize < 12)
            return 2;
        }
      }

      if (i==0) {
        x = glyph.letterMeasures.actualBoundingBoxLeft;
      }
  
      if (fontFamily === 'Arial' && fontSize > 11 && fontSize <= 20) {
        x += (glyph.tightCanvasBox.bottomRightCorner.x - glyph.tightCanvasBox.topLeftCorner.x + 1) + 2;
      }
      else if (fontFamily === 'Arial' && fontSize <= 11) {
        x += (glyph.tightCanvasBox.bottomRightCorner.x - glyph.tightCanvasBox.topLeftCorner.x + 1) + 1;
      }
      else {
        x += glyph.letterMeasures.width;
      }

      const nextLetter = text[i+1];
      const kerningCorrection = this.getKerningCorrection(fontFamily, letter, nextLetter, fontSize, fontEmphasis);
      
      // console.log("kerningCorrection: " + kerningCorrection);
      if (fontFamily === 'Arial' && fontSize <= 20) {
        if (kerningCorrection > 0 && kerningCorrection < 0.145){
          x -= 1;
        }
        else if (kerningCorrection > 0.145){
          x -= 2;
        }
      }
      else {
        x -= glyph.letterMeasures.width * kerningCorrection;
      }
    }
    else {
      // with the last character you don't just advance by the advance with,
      // rather you need to add the actualBoundingBoxRight
      if (fontFamily === 'Arial' && fontSize <= 20) {
        x += (glyph.tightCanvasBox.bottomRightCorner.x - glyph.tightCanvasBox.topLeftCorner.x + 1) + 2;
      }
      else {
        x += glyph.letterMeasures.actualBoundingBoxRight;
      }
    }
    return Math.round(x);
  }

  drawText(ctx, text, x, y, fontSize, fontFamily, fontEmphasis) {
    for (let i = 0; i < text.length; i++) {
      const letter = text[i];
      const glyph = this.glyphStore.getGlyph(fontFamily, fontSize, letter, fontEmphasis);
      

      if (glyph) {
        if (glyph.tightCanvas) {
          
          // some letters protrude to the left, i.e. the so called actualBoundingBoxLeft
          // is positive, for example it's quite large for the italic f in Times New Roman.
          // For these characters you basically draw them at x - actualBoundingBoxLeft
          // but for the first character you don't want to do that, because it would be
          // drawn outside the canvas. So for the first character you draw it at x.
          var slightlyToTheLeft = Math.round(glyph.letterMeasures.actualBoundingBoxLeft);
          if (i == 0)
            slightlyToTheLeft = 0;
          
            if (fontFamily === 'Arial' && fontSize <= 20) {
            ctx.drawImage(glyph.tightCanvas, x - slightlyToTheLeft, y - glyph.tightCanvas.height - glyph.tightCanvas.distanceBetweenBottomAndBottomOfCanvas + 2);
          }
          else {
            ctx.drawImage(glyph.tightCanvas, x  - slightlyToTheLeft + glyph.tightCanvasBox.topLeftCorner.x , y - glyph.tightCanvas.height - glyph.tightCanvas.distanceBetweenBottomAndBottomOfCanvas + 2);
          }
        }
        
        x += this.getAdvanceWidth(i, text, glyph, fontFamily, letter, fontSize, fontEmphasis);

      }
    }
  }
}



class CrispBitmapGlyph {
  constructor(letter, fontSize, fontFamily, fontEmphasis) {
    this.letter = letter;
    this.fontSize = fontSize;
    this.fontFamily = fontFamily;
    this.fontEmphasis = fontEmphasis;

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
    if (this.fontFamily === 'Arial') {
      if (this.fontSize <= 12) {
        // the j needs to be 1 pixel more to the right, let's kill its actualBoundingBoxLeft
        // so it's drawn in the same space, but 1 pixel more to the right
        if ((this.letter === 'j')) {
          letterMeasures.actualBoundingBoxLeft = 0;
        }
      }
      else if (this.fontSize <= 20) {
        if ((this.letter === 'W' || this.letter === 'w')) {
          letterMeasures.actualBoundingBoxRight += 5;
          //ßletterMeasures.actualBoundingBoxLeft += 9;
        }
      }
      else {

        if ((this.letter === 'W')) {
          letterMeasures.actualBoundingBoxRight += Math.ceil(this.fontSize/30);
          letterMeasures.width += Math.ceil(this.fontSize/30);
        }
        // the j needs to be 1 pixel more to the right
        //if ((this.letter === 'j')) {
        //  //letterMeasures.actualBoundingBoxRight += Math.ceil(this.fontSize/20);
        //  letterMeasures.actualBoundingBoxLeft = -2;
        //  //letterMeasures.width += Math.ceil(this.fontSize/10);
        //}
      }
    }

    /*
    // the s needs 1 pixel more to the right
    if ((this.letter === 's' || this.letter === 'V' || this.letter === 'W') && this.fontFamily === 'Arial') {
      letterMeasures.actualBoundingBoxRight += 1;
      letterMeasures.width += 1;
    }

    // similarly, if you turn the kerning off, at size 12 (pretty much the smallest legible size ) you can see that some letters are just too much to the right
    if ((this.letter === 'A' || this.letter === 'j') && this.fontFamily === 'Arial') {
      letterMeasures.actualBoundingBoxLeft -= 1;
    }
    if (this.letter === 'y' && this.fontFamily === 'Arial') {
      letterMeasures.actualBoundingBoxLeft += 1;
    }
    */

    // END OF LETTER-LEVEL RENDERING CORRECTIONS
    /////////////////////////////////////////////

    canvas.width = Math.round(letterMeasures.actualBoundingBoxLeft + letterMeasures.actualBoundingBoxRight);

    // add a div with letterMeasures.actualBoundingBoxLeft + letterMeasures.actualBoundingBoxRight
    const div = document.createElement('div');
    div.textContent = this.letter + " bbox left: " + letterMeasures.actualBoundingBoxLeft + " bbox right:" + letterMeasures.actualBoundingBoxRight;

    // add to the textcontent the actualBoundingBoxLeft in red if it's not 0
    if (letterMeasures.actualBoundingBoxLeft !== 0) {
      div.style.color = "red";
    }

    document.body.appendChild(div);

    canvas.height = Math.round(letterMeasures.fontBoundingBoxAscent + letterMeasures.fontBoundingBoxDescent);

    // make the background white
    //ctx.fillStyle = 'white';
    //ctx.fillRect(0, 0, canvas.width, canvas.height);
  
    // draw the text so that it fits in the canvas
    // see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textBaseline
    ctx.textBaseline = 'bottom';
  
    ctx.font = this.fontEmphasis + " " + this.fontSize + 'px ' + this.fontFamily;
    ctx.fillText(this.letter, Math.round(letterMeasures.actualBoundingBoxLeft), canvas.height-1);

    // now can remove the canvas from the page
    canvas.remove();

    return {canvas, letterMeasures};
  }

  getBoundingBoxOfOnPixels(canvas) {
    // get the image data
    const onPixelsArray = this.getOnPixelsArray(canvas);
  
    // draw the bounding box of the text
    const tightCanvasBox = this.getBoundingBox(canvas, onPixelsArray);
  
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
    var returned = this. createCanvasWithLetter();
    var canvas = returned.canvas;
    var letterMeasures = returned.letterMeasures;
    
    const ctx = canvas.getContext('2d');

    var returned = this.getBoundingBoxOfOnPixels(canvas);
    if (returned.tightCanvas === null) {
      return {compressedPixels: null, canvas, tightCanvas: null, tightCanvasBox: null, letterMeasures};
    }

    var tightCanvas = returned.tightCanvas;
    var tightCanvasBox = returned.tightCanvasBox;
    
  
    // get the image data
    const onPixelsArrayBoundingBox = this.getOnPixelsArray(tightCanvas);
  
    // do a simple compression of the data by looking for runs of zeros and ones
    const compressedPixels = this.compressPixels(onPixelsArrayBoundingBox).join(',');
  
  
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
    const isOn = data[i+3] !== 0;
    pixels.push(isOn);
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

var selectedFontSize = 80;


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
document.getElementById("selectors").appendChild(fontFamilySelect);
// run the buildAndShowGlyphs function when the user changes the value of the font family select
fontFamilySelect.addEventListener('change', buildAndShowGlyphs);


// add a dropdown with the font emphasis options
const fontEmphasisSelect = document.createElement('select');
fontEmphasisSelect.id = 'font-emphasis-select';
const fontEmphases = ['normal', 'bold', 'italic', 'bold italic'];
for (let i = 0; i < fontEmphases.length; i++) {
  const option = document.createElement('option');
  option.value = fontEmphases[i];
  option.textContent = fontEmphases[i];
  fontEmphasisSelect.appendChild(option);
}
document.getElementById("selectors").appendChild(fontEmphasisSelect);
// run the buildAndShowGlyphs function when the user changes the value of the font emphasis select
fontEmphasisSelect.addEventListener('change', buildAndShowGlyphs);


const runButton = document.createElement('button');
runButton.id = 'run-button';
runButton.textContent = 'Build and Show Glyphs';
document.getElementById("selectors").appendChild(runButton);


document.getElementById("selectors").appendChild(document.createElement('br'));

// add to the "selectors" div a multiline textbox input where we have some settings related to the rendering.
// and buildAndShowGlyphs() when the user clicks out of it
const settingsTextarea = document.createElement('textarea');
settingsTextarea.id = 'settings-textarea';
settingsTextarea.style.float = 'left';

settingsTextarea.value = `Arial
normal
--
Kerning cutoff
-
11
--
Letters extra space and pull px
-
0 to 20
  v:w: right 5 left 9
  xy: right 6 left 10  
21 to 22
  po: right 11 left 12
23 to 1000
  ef: right 11 left 12
  gh: right 13 left 14
--
Letters extra space and pull proportional
-
1 to 21
  hk: right 30 left 0
22 to 1001
  lm: right 40 left 0
--
setting three
dasdasd
asdas
---------
Arial
bold
--
setting three
setting 3 here
--
setting four
setting 4 here
`;
document.getElementById("selectors").appendChild(settingsTextarea);
// settingsTextarea.addEventListener('change', buildAndShowGlyphs);
settingsTextarea.style.height = '200px';

// add to the selectors div 81 square buttons numbered from 0 to 80,
// and when the user hovers over them, set the size input to the number

// create a new div "hoverButtons" where we will put the buttons
const hoverButtonsDiv = document.createElement('div');
hoverButtonsDiv.id = 'hoverButtons';
document.getElementById("selectors").appendChild(hoverButtonsDiv);

var hoverFontSize = null;

for (let i = 0; i < 81; i++) {
  const button = document.createElement('button');
  // set the id to "button-size-<i>"
  button.id = 'button-size-' + i;
  button.textContent = i;
  button.style.width = '30px';
  button.style.height = '30px';
  button.style.margin = '2px';
  button.style.padding = '0px';
  button.style.border = '0px';
  button.style.backgroundColor = 'white';
  button.style.color = 'black';
  button.style.fontSize = '12px';
  button.style.fontWeight = 'normal';
  button.style.fontStyle = 'normal';
  button.style.fontFamily = 'Arial';
  button.style.textAlign = 'center';
  button.style.verticalAlign = 'middle';
  button.style.lineHeight = '30px';
  button.style.cursor = 'pointer';

  button.addEventListener('mouseover', function() {
    hoverFontSize = i;
    // set the button background color to light gray
    if (selectedFontSize !== i) {
      button.style.backgroundColor = 'lightgray';
    }
    buildAndShowGlyphs();
  });

  // when the mouse exits the button, set the hoverFontSize to null
  button.addEventListener('mouseout', function() {
    hoverFontSize = null;
    // set the button background color to white unless it is the selectedFontSize
    if (selectedFontSize !== i) {
      button.style.backgroundColor = 'white';
    }
    buildAndShowGlyphs();
  });


  // when you click on the button, you set the selectedFontSize to the number of the button
  // and color the button dark gray
  button.addEventListener('click', function() {

    if (selectedFontSize !== null) {
      const oldButton = document.getElementById('button-size-' + selectedFontSize);
      oldButton.style.backgroundColor = 'white';
    }

    selectedFontSize = i;
    button.style.backgroundColor = 'darkgray';
  });


  hoverButtonsDiv.appendChild(button);
}

// make the button of the default selectedFontSize dark gray
const defaultSizeButton = document.getElementById('button-size-' + selectedFontSize);
defaultSizeButton.style.backgroundColor = 'darkgray';



// append a line break
document.body.appendChild(document.createElement('br'));

function buildAndShowGlyphs() {

  var fontSize;

  if (hoverFontSize !== null) {
    fontSize = hoverFontSize;
  }
  else {
    fontSize = selectedFontSize;
  }


  // get the contents of the settings-textarea and split the contents by the --------- separator
  parseSpecs();
  

  if (!isNaN(fontSize)) {
    // remove all canvases and divs from the page
    removeAllCanvasesAndDivs();
    showCharsAndDataForSize(fontSize, fontFamilySelect.value, fontEmphasisSelect.value);
  }

  function removeAllCanvasesAndDivs() {
    const canvases = document.querySelectorAll('canvas');
    for (let i = 0; i < canvases.length; i++) {
      canvases[i].remove();
    }
    const divs = document.querySelectorAll('div');
    for (let i = 0; i < divs.length; i++) {
      // remove all divs that don't have the id "selectors"
      if (divs[i].id !== 'selectors' && divs[i].id !== 'testTextCanvases' && divs[i].id !== 'hoverButtons')
        divs[i].remove();
    }
  }
}

runButton.addEventListener('click', buildAndShowGlyphs);


function showCharsAndDataForSize(fontSize, fontFamily, fontEmphasis) {
  // create a new CrispBitmapGlyph object
  var crispBitmapGlyphStore = new CrispBitmapGlyphStore();
  
  crispBitmapGlyphStore.addGlyph(new CrispBitmapGlyph(' ', fontSize, fontFamily, fontEmphasis));
  crispBitmapGlyphStore.addGlyph(new CrispBitmapGlyph('█', fontSize, fontFamily, fontEmphasis));

  // lower case letters
  for (let i = 97; i < 123; i++) {
    const letter = String.fromCharCode(i);
    crispBitmapGlyphStore.addGlyph(new CrispBitmapGlyph(letter, fontSize, fontFamily, fontEmphasis));
  }

  // upper case letters
  for (let i = 65; i < 91; i++) {
    const letter = String.fromCharCode(i);
    crispBitmapGlyphStore.addGlyph(new CrispBitmapGlyph(letter, fontSize, fontFamily, fontEmphasis));
  }

  // numbers
  for (let i = 48; i < 58; i++) {
    const letter = String.fromCharCode(i);
    crispBitmapGlyphStore.addGlyph(new CrispBitmapGlyph(letter, fontSize, fontFamily, fontEmphasis));
  }

  allOtherChars = '!"#$%&€\'()*+,-./:;<=>?@[\]^_`{|}~—£°²·ÀÇàç•';
  // all chars in allOtherChars
  for (let i = 0; i < allOtherChars.length; i++) {
    const letter = allOtherChars[i];
    crispBitmapGlyphStore.addGlyph(new CrispBitmapGlyph(letter, fontSize, fontFamily, fontEmphasis));
  }

  //var testText = 'Document Hello World ÀÇ█gMffAVAWWVaWa7a9a/aTaYaPafa information is provided as part of the WorldWideWeb project responsability';
  var testText = 'Access to this information is provided as part of the WorldWideWeb project. The WWW';
  var testText2 = 'project does not take responsability for the accuracy of information provided by others';
  var testText3 = 'References to other information are represented like this. Double-click on it to jump to';
  var testText4 = 'related information.';
  var testText5 = 'Now choose an area in which you would like to start browsing. The system currently has';
  var testText6 = 'access to three sources of information. With the indexes, you should use the keyword';
  var testText7 = 'f to check actualBoundingBoxLeft doesn\t cause f to be drawn outside the canvas.';

  //var testText = 'project does not take responsability for the accuracy of information provided by others.';
  

  // create a canvas just to find the text measures for the antialiased version (easy: don't add it to the DOM)
  const canvas4 = document.createElement('canvas');
  const ctx4 = canvas4.getContext('2d');
  ctx4.font = fontEmphasis + " " + fontSize + 'px ' + fontFamily;
  const testTextMeasures = ctx4.measureText(testText);

  // create a canvas to find the text measures for the crisp version (we need to add it to the DOM for the CSS properties to be applied)
  const canvas5 = document.createElement('canvas');
  canvas5.width = 1;
  canvas5.height = 1;
  document.getElementById("testTextCanvases").appendChild(canvas5);
  const ctx5 = canvas5.getContext('2d');
  ctx5.font = fontEmphasis + " " + fontSize + 'px ' + fontFamily;
  const testTextMeasuresCrisp = ctx5.measureText(testText);




  // add another canvas at the top of the page and draw "Hello World" on it using the CrispBitmapText
  // add some text above the canvas to say what it is
  const div = document.createElement('div');
  div.textContent = 'Crisp Bitmap Text Drawing:';
  document.getElementById("testTextCanvases").appendChild(div);
  const canvas = document.createElement('canvas');
  // TODO need to use own measureText method of the Crisp kind
  // get the measures of the text from the CrispBitmapText measureText method
  const crispBitmapText = new CrispBitmapText(crispBitmapGlyphStore);
  const crispTestTextMeasures = crispBitmapText.measureText(testText, fontSize, fontFamily, fontEmphasis);
  canvas.width = crispTestTextMeasures.width;
  canvas.height = crispTestTextMeasures.height * 7;
  document.getElementById("testTextCanvases").appendChild(canvas);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  crispBitmapText.drawText(ctx, testText, 0, Math.round(canvas.height - 6 * crispTestTextMeasures.height -1), fontSize, fontFamily, fontEmphasis);
  crispBitmapText.drawText(ctx, testText2, 0, Math.round(canvas.height - 5 * crispTestTextMeasures.height -1), fontSize, fontFamily, fontEmphasis);
  crispBitmapText.drawText(ctx, testText3, 0, Math.round(canvas.height - 4 * crispTestTextMeasures.height -1), fontSize, fontFamily, fontEmphasis);
  crispBitmapText.drawText(ctx, testText4, 0, Math.round(canvas.height - 3 * crispTestTextMeasures.height -1), fontSize, fontFamily, fontEmphasis);
  crispBitmapText.drawText(ctx, testText5, 0, Math.round(canvas.height - 2 * crispTestTextMeasures.height -1), fontSize, fontFamily, fontEmphasis);
  crispBitmapText.drawText(ctx, testText6, 0, Math.round(canvas.height - 1 * crispTestTextMeasures.height -1), fontSize, fontFamily, fontEmphasis);
  crispBitmapText.drawText(ctx, testText7, 0, Math.round(canvas.height - 0 * crispTestTextMeasures.height -1), fontSize, fontFamily, fontEmphasis);


  // add another canvas at the top of the page and draw "Hello World" on it using the standard canvas text drawing methods
  // add some text above the canvas to say what it is
  const div2 = document.createElement('div');
  div2.textContent = 'Standard Canvas Text Drawing with no smoothing:';
  document.getElementById("testTextCanvases").appendChild(div2);
  const canvas2 = document.createElement('canvas');
  canvas2.width = Math.round(testTextMeasuresCrisp.actualBoundingBoxLeft + testTextMeasuresCrisp.actualBoundingBoxRight);
  canvas2.height = Math.round(testTextMeasuresCrisp.fontBoundingBoxAscent + testTextMeasures.fontBoundingBoxDescent);
  // add to DOM before drawing the text otherwise
  // the CSS property to make it crisp doesn't work
  document.getElementById("testTextCanvases").appendChild(canvas2);
  const ctx2 = canvas2.getContext('2d');
  ctx2.fillStyle = 'white';
  ctx2.fillRect(0, 0, canvas2.width, canvas2.height);
  ctx2.fillStyle = 'black';
  ctx2.font = fontEmphasis + " " + fontSize + 'px ' + fontFamily;
  ctx2.textBaseline = 'bottom';
  ctx2.fillText( testText , 0, canvas2.height-1);


  
  // add another canvas at the top of the page and draw "xxxxxxxxxxxx" on it using the standard canvas text drawing methods
  // add some text above the canvas to say what it is
  const div6 = document.createElement('div');
  div6.textContent = 'Standard Canvas Text Drawing with no smoothing - thin characters to see monospaced fonts:';
  document.getElementById("testTextCanvases").appendChild(div6);
  const canvas6 = document.createElement('canvas');
  canvas6.width = Math.round(testTextMeasuresCrisp.actualBoundingBoxLeft + testTextMeasuresCrisp.actualBoundingBoxRight);
  canvas6.height = Math.round(testTextMeasuresCrisp.fontBoundingBoxAscent + testTextMeasures.fontBoundingBoxDescent);
  // add to DOM before drawing the text otherwise
  // the CSS property to make it crisp doesn't work
  document.getElementById("testTextCanvases").appendChild(canvas6);
  const ctx6 = canvas6.getContext('2d');
  ctx6.fillStyle = 'white';
  ctx6.fillRect(0, 0, canvas6.width, canvas6.height);
  ctx6.fillStyle = 'black';
  ctx6.font = fontEmphasis + " " + fontSize + 'px ' + fontFamily;
  ctx6.textBaseline = 'bottom';
  ctx6.fillText( '|||||||||||||||||||||||||||||||||||||' , 0, canvas6.height-1);




  // add a canvas at the top of the page and draw "Hello World" on it using the standard canvas text drawing methods
  // add some text above the canvas to say what it is
  const div3 = document.createElement('div');
  div3.textContent = 'Standard Canvas Text Drawing with smoothing:';
  // add inside the testTextCanvases div
  document.getElementById("testTextCanvases").appendChild(div3);
  const canvas3 = document.createElement('canvas');
  canvas3.width = Math.round(testTextMeasures.actualBoundingBoxLeft + testTextMeasures.actualBoundingBoxRight);
  canvas3.height = Math.round(testTextMeasures.fontBoundingBoxAscent + testTextMeasures.fontBoundingBoxDescent);

  const ctx3 = canvas3.getContext('2d');
  ctx3.fillStyle = 'white';
  ctx3.fillRect(0, 0, canvas3.width, canvas3.height);
  ctx3.fillStyle = 'black';
  ctx3.font = fontEmphasis + " " + fontSize + 'px ' + fontFamily;
  ctx3.textBaseline = 'bottom';

  ctx3.fillText( testText , 0, canvas3.height-1);
  // add to DOM after drawing the text so
  // the CSS property to make it crisp doesn't work
  document.getElementById("testTextCanvases").appendChild(canvas3);

}

buildAndShowGlyphs();