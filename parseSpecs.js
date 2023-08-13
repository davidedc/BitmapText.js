function parseSpecs() {
 
  const specsForFontFamilyAndFontEmphasisPair = settingsTextarea.value.split('---------');
  console.dir(specsForFontFamilyAndFontEmphasisPair);

  // build an object that will contain the specs, which is object keyed by font family,
  // then by font emphasis, then by sub-spec name
  const specs = {};

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
          if (nameOfSubSpecOfFontFamilyFontEmphasis === "letters extra space and pull px") {
            specsForFontFamilyAndEmphasisPair[nameOfSubSpecOfFontFamilyFontEmphasis] = parseLettersExtraSpaceAndPullPX(contentOfSubSpecOfFontFamilyFontEmphasis);
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


function parseLettersExtraSpaceAndPullPX(contentOfSubSpec) {
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
  const lettersExtraSpaceAndPullPxArray = [];
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

      // add to the lettersExtraSpaceAndPullPxArray array the new size range and the charAndOffsets objects array
      lettersExtraSpaceAndPullPxArray.push({ sizeRange: {}, charsAndOffsets: [] });
      
      lettersExtraSpaceAndPullPxArray[lettersExtraSpaceAndPullPxArray.length - 1].sizeRange = sizeRangeObj;
    }
    else {
      const parseCharsAndOffsetsObj = parseCharsAndOffsetsLine(line);
      lettersExtraSpaceAndPullPxArray[lettersExtraSpaceAndPullPxArray.length - 1].charsAndOffsets.push(parseCharsAndOffsetsObj);
    }
  }
  return lettersExtraSpaceAndPullPxArray;
}
function parseCharsAndOffsetsLine(line) {
  // each line after the size range looks like:
  //
  //   vw: right 5 left 9
  //
  // so:
  // 1. ignore the first two spaces
  // 2. keep in a string all the characters up to the last colon in the string (there might be more than one colon in the string)
  // 3. keep as a number the number after "right"
  // 4. keep as a number the number after "left"
  // 5. pack the string and the two numbers into an object

  // 1. ignore the first two spaces
  const line2 = line.substring(2);

  // 2. keep in a string all the characters up to the last colon in the string (there might be more than one colon in the string)
  const line3 = line2.substring(0, line2.lastIndexOf(':'));

  // 3. keep as a number the number after "right"
  const right = parseInt(line2.substring(line2.indexOf('right') + 6, line2.indexOf('left') - 1));

  // 4. keep as a number the number after "left"
  const left = parseInt(line2.substring(line2.indexOf('left') + 5));

  // 5. pack the string and the two numbers into an object
  return { string: line3, right: right, left: left };

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

