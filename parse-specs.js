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
  for (const element of specsForFontFamilyAndFontEmphasisPair) {
    const setting = element;
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
      for (const element of subSpecsOfFontFamilyAndFontEmphasisArray) {
        const subSpecOfFontFamilyFontEmphasis = element;        

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
          else if (nameOfSubSpecOfFontFamilyFontEmphasis === "Space advancement override for small sizes in px" ||
                   nameOfSubSpecOfFontFamilyFontEmphasis === "Advancement override for small sizes in px"
                  ) {
            specsForFontFamilyAndEmphasisPair[nameOfSubSpecOfFontFamilyFontEmphasis] = parseSingleFloatCorrection(contentOfSubSpecOfFontFamilyFontEmphasis);
          }
          else if (nameOfSubSpecOfFontFamilyFontEmphasis === "Kerning discretisation for small sizes") {
            specsForFontFamilyAndEmphasisPair[nameOfSubSpecOfFontFamilyFontEmphasis] = parseSingleFloatCorrectionsForSizeBrackets(contentOfSubSpecOfFontFamilyFontEmphasis);
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

// Parses a size range with possible pixel density into an object with keys "from" and "to" and "pixelDensity"
// Example 1:
//     "[integer1] to [integer2]"
//   returns:
//     { from: [integer1], to: [integer2], pixelDensity: null }
//
// Example 2:
//     "[integer1] to [integer2] at pixel density [integer3]"
//   returns:
//     { from: [integer1], to: [integer2], pixelDensity: [integer3] }

function parseSizeRange(line) {
  // split the line by " to "
  const splitByTo = line.split(' to ');
  const from = parseInt(splitByTo[0]);
  const to = parseInt(splitByTo[1]);

  // check if there is a pixel density in the line
  if (line.indexOf(' at pixel density ') !== -1) {
    // there is a pixel density
    // split by " at pixel density "
    const splitByAtPixelDensity = line.split(' at pixel density ');
    const pixelDensity = parseInt(splitByAtPixelDensity[1]);
    return { from: from, to: to, pixelDensity: pixelDensity };
  }
  else {
    // there is no pixel density
    return { from: from, to: to, pixelDensity: null };
  }
}

// Checks if a given line represents a size range in the format of either
//   "[integer] to [integer]"
// or
//   "[integer] to [integer] at pixel density [integer]"
function isSizeRange(line) {
  return /^\d+\s+to\s+\d+(\s+at\s+pixel\s+density\s+\d+)?$/.test(line);
}
