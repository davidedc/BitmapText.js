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
          if (nameOfSubSpecOfFontFamilyFontEmphasis === "ActualBoundingBoxLeft correction px" ||
              nameOfSubSpecOfFontFamilyFontEmphasis === "CropLeft correction px" ||
              nameOfSubSpecOfFontFamilyFontEmphasis === "ActualBoundingBoxRight correction px" ||
              nameOfSubSpecOfFontFamilyFontEmphasis === "ActualBoundingBoxRight correction proportional" ||
              nameOfSubSpecOfFontFamilyFontEmphasis === "Advancement correction proportional"
              ) {
            specsForFontFamilyAndEmphasisPair[nameOfSubSpecOfFontFamilyFontEmphasis] = parseSingleFloatCorrectionsForLettersSet(contentOfSubSpecOfFontFamilyFontEmphasis);
          }
          else if (nameOfSubSpecOfFontFamilyFontEmphasis === "Space advancement px") {
            specsForFontFamilyAndEmphasisPair[nameOfSubSpecOfFontFamilyFontEmphasis] = parseSingleFloatCorrection(contentOfSubSpecOfFontFamilyFontEmphasis);
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

function parseSizeRange(line) {
  const sizeRangeLine = line.split(' to ');
  const from = parseInt(sizeRangeLine[0]);
  const to = parseInt(sizeRangeLine[1]);

  return { from: from, to: to };
}

function isSizeRange(line) {
  return /^\d+\s+to\s+\d+$/.test(line);
}
