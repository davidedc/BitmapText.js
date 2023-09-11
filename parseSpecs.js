// build an object that will contain the specs, which is object keyed by font family,
// then by font emphasis, then by sub-spec name
const specs = {};

function parseSpecs() {
 
  // get contents of the settingsTextarea and remove all the lines containing double slashes (we'll treat them as comments)
  const settingsTextareaContents = settingsTextarea.value;
  // double shashes can be anywhere in the line, so we have to remove the whole line
  const settingsTextareaContentsWithoutComments = settingsTextareaContents.replace(/.*\/\/.*/g, '');

  // also remove empty lines
  const settingsTextareaContentsWithoutCommentsAndEmptyLines = settingsTextareaContentsWithoutComments.replace(/^\s*\n/gm, '');

  console.log("have to parse" + settingsTextareaContentsWithoutCommentsAndEmptyLines);

  const specsForFontFamilyAndFontEmphasisPair = settingsTextareaContentsWithoutCommentsAndEmptyLines.split('---------');
  console.dir(specsForFontFamilyAndFontEmphasisPair);

  // go through the specs for each font family and font emphasis pair
  for (let i = 0; i < specsForFontFamilyAndFontEmphasisPair.length; i++) {
    const setting = specsForFontFamilyAndFontEmphasisPair[i];
    const lines = setting.split('\n');

    // remove all the empty lines
    for (let j = 0; j < lines.length; j++) {
      if (lines[j] === '') {
        lines.splice(j, 1);
        j--;
      }
    }

    if (lines.length > 1) {
      
      // parse the first two lines, which are the font family and font emphasis
      const fontFamily = lines[0];
      const fontEmphasis = lines[1];

      // make the keys for font family and emphasis
      // in the specs object if they don't exist yet
      if (specs[fontFamily] === undefined) {
        specs[fontFamily] = {};
      }

      // the object that will hold the specs for the current
      // font family and font emphasis pair
      const specsForFontFamilyAndEmphasisPair = {};

      // these are all the specs for a specific fontfamily and fontemphasis
      var specsContentsOfFontFamilyAndFontEmphasis = lines.slice(2).join('\n');
      // these contain several sub-specs, each of which is separated by a line with two dashes,
      // so split the sub-specs by the -- separator
      var subSpecsOfFontFamilyAndFontEmphasisArray = specsContentsOfFontFamilyAndFontEmphasis.split('--');
      
      // go through each sub-spec and parse it

      // for each sub-spec...
      for (let k = 0; k < subSpecsOfFontFamilyAndFontEmphasisArray.length; k++) {
        const subSpecOfFontFamilyFontEmphasis = subSpecsOfFontFamilyAndFontEmphasisArray[k];        

        // remove all the empty lines
        const linesOfSubSpecOfFontFamilyFontEmphasis = subSpecOfFontFamilyFontEmphasis.split('\n');
        for (let j = 0; j < linesOfSubSpecOfFontFamilyFontEmphasis.length; j++) {
          if (linesOfSubSpecOfFontFamilyFontEmphasis[j] === '') {
            linesOfSubSpecOfFontFamilyFontEmphasis.splice(j, 1);
            j--;
          }
        }

        // get the name and content of the sub-spec.
        if (linesOfSubSpecOfFontFamilyFontEmphasis.length > 1) {
          
          // the name is the first line...
          const nameOfSubSpecOfFontFamilyFontEmphasis = linesOfSubSpecOfFontFamilyFontEmphasis[0];
          // ... the rest is the content (starting with a line with a dash)
          const contentOfSubSpecOfFontFamilyFontEmphasis = linesOfSubSpecOfFontFamilyFontEmphasis.slice(1).join('\n');

          // check the sub-spec name and parse it accordingly
          if (nameOfSubSpecOfFontFamilyFontEmphasis === "ActualBoundingBoxLeft correction px") {
            specsForFontFamilyAndEmphasisPair[nameOfSubSpecOfFontFamilyFontEmphasis] = parseActualBoundingBoxLeftPxCorrection(contentOfSubSpecOfFontFamilyFontEmphasis);
          }
          else if (nameOfSubSpecOfFontFamilyFontEmphasis === "Kerning cutoff") {
            specsForFontFamilyAndEmphasisPair[nameOfSubSpecOfFontFamilyFontEmphasis] = parseKerningCutoff(contentOfSubSpecOfFontFamilyFontEmphasis);
          }
          else if (nameOfSubSpecOfFontFamilyFontEmphasis === "Kerning") {
            specsForFontFamilyAndEmphasisPair[nameOfSubSpecOfFontFamilyFontEmphasis] = parseKerning(contentOfSubSpecOfFontFamilyFontEmphasis);
          }
          // if we don't have a parser for the sub-spec, just put its string content in the object as it is
          else {
            specsForFontFamilyAndEmphasisPair[nameOfSubSpecOfFontFamilyFontEmphasis] = contentOfSubSpecOfFontFamilyFontEmphasis;
          }
        }
      }


      specs[fontFamily][fontEmphasis] = specsForFontFamilyAndEmphasisPair;
    }
  }
  console.dir(specs);
}


function parseKerningCutoff(contentOfSubSpec) {
  console.log("have to parse" + contentOfSubSpec);

  // remove the first line as it's a dash
  const linesOfSubSpecOfFontFamilyFontEmphasis = contentOfSubSpec.split('\n');
  linesOfSubSpecOfFontFamilyFontEmphasis.splice(0, 1);

  // just parse a number in the next line
  return parseInt(linesOfSubSpecOfFontFamilyFontEmphasis[0]);
}

// The function parseKerning takes as input a sub-spec of the form:
//
// Kerning
// -
// [integer] to [integer]
//   [letters or "*any*"] followed by [letters or "*any*"]: [float]
//   ...
// ...
//
// EXAMPLE -------------
//
// Kerning
// -
// 0 to 20
//   absvds followed by dshkjshdfjhsdfsdfjkh: 0.1
//   sdfslksdf followed by *any*: 0.2
//   *any* followed by LKJLKJF: 0.2
// 21 to 22
//   absvds followed by dshkjshdfjhsdfsdfjkh: 0.1
//   sdfslksdf followed by *any*: 0.2
//   *any* followed by LKJLKJF: 0.2

function parseKerning(contentOfSubSpec) {
  console.log("have to parse" + contentOfSubSpec);

  // remove the first line as it's a dash
  const linesOfSubSpecOfFontFamilyFontEmphasis = contentOfSubSpec.split('\n');
  linesOfSubSpecOfFontFamilyFontEmphasis.splice(0, 1);

  // linesOfSubSpecOfFontFamilyFontEmphasis in in the form:
  // 0 to 20
  //   [something]
  //   ...
  // 20 to 1000
  //   [something]
  //   ...
  // ...
  // let's put each section starting with
  //   [number] to [number]
  // until the next line with
  //   [number] to [number]
  // into an array
  const kerningArray = [];
  for (let i = 0; i < linesOfSubSpecOfFontFamilyFontEmphasis.length; i++) {
    const line = linesOfSubSpecOfFontFamilyFontEmphasis[i];

    // there can be multiple parts covering different ranges of sizes
    // so you have to constantly look out for the next range
    // i.e. a line matching "[number] to [number]""
    if (isSizeRange(line)) {
      // this is a line with " to " in it
      // so it's the start of a new section
      // put the two numbers in the line into an object with keys "from" and "to"
      const sizeRangeObj = parseSizeRange(line);
      
      // add to the kerningArray array the new size range and the kerning objects array
      kerningArray.push({ sizeRange: {}, kerning: [] });

      kerningArray[kerningArray.length - 1].sizeRange = sizeRangeObj;
    }
    else {
      const parseKerningObj = parseKerningLine(line);
      kerningArray[kerningArray.length - 1].kerning.push(parseKerningObj);
    }
  }
  return kerningArray;
}

function parseSizeRange(line) {
  const sizeRangeLine = line.split(' to ');
  const from = parseInt(sizeRangeLine[0]);
  const to = parseInt(sizeRangeLine[1]);

  return { from: from, to: to };
}

function isSizeRange(line) {
  return /^\d+\s+to\s+\d+$/.test(line);
}


// The function parseKerningLine takes as input a line of the form:
//
//   [letters or "*any*"] followed by [letters or "*any*"]: [float]
//
// and returns an object of the form:
//
//   { left: [letters or "*any*"] , right: [letters or "*any*"], adjustment: [float] }
//
// EXAMPLE -------------
//
//   absvds followed by dshkjshdfjhsdfsdfjkh: 0.1
//
// returns:
//
//   { left: "absvds", right: "dshkjshdfjhsdfsdfjkh", adjustment: 0.1 }

function parseKerningLine(line) {
  // each line after the size range looks like:
  //
  //   [letters or "*any*"] followed by [letters or "*any*"]: [float]
  //
  // so:
  // 1. keep in a string all the characters up to the last colon in the string (there might be more than one colon in the string)
  // 2. keep as a number the number after the last colon
  // 3. keep in a string all the characters up to the word " followed" and remove the first two spaces
  // 4. keep in a string all the characters after the string "followed by " and before the last colon
  // 5. pack the two strings and the number into an object

  // 1. keep in a string all the characters up to the last colon in the string (there might be more than one colon in the string)
  const line2 = line.substring(0, line.lastIndexOf(':'));

  // 2. keep as a number the number after the last colon
  const adjustment = parseFloat(line.substring(line.lastIndexOf(':') + 1));

  // 3. keep in a string all the characters up to the word " followed" and remove the first two spaces
  // const left = line2.substring(0, line2.indexOf(' followed') - 1);
  const left = line2.substring(2, line2.indexOf(' followed'));

  // 4. keep in a string all the characters after the string "followed by " and before the last colon
  const right = line2.substring(line2.indexOf('followed by ') + 12);

  // 5. pack the two strings and the number into an object
  return { left: left, right: right, adjustment: adjustment };
}
