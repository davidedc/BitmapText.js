// build an object that will contain the specs, which is object keyed by font family,
// then by font style, then by sub-spec name
const specs = {};
let previousSoecsTextareaValue = null;

function parseSpecs() {

  // get contents of the settingsTextarea
  const settingsTextareaContents = settingsTextarea.value;

  // if the contents of the textarea haven't changed, don't parse them again
  if (settingsTextareaContents === previousSoecsTextareaValue) {
    return;
  }

  previousSoecsTextareaValue = settingsTextareaContents;
  // clear the kerning tables
  crispBitmapGlyphStore_Full.clearKerningTables();

  // remove comments i.e. double shashes. Can be anywhere in the line, so we have to remove the whole line
  const settingsTextareaContentsWithoutComments = settingsTextareaContents.replace(/.*\/\/.*/g, '');

  // also remove empty lines
  const settingsTextareaContentsWithoutCommentsAndEmptyLines = settingsTextareaContentsWithoutComments.replace(/^\s*\n/gm, '');

  console.log("have to parse" + settingsTextareaContentsWithoutCommentsAndEmptyLines);

  const specsForFontFamilyAndFontStyleAndFontWeightTriplet = settingsTextareaContentsWithoutCommentsAndEmptyLines.split('---------');
  console.dir(specsForFontFamilyAndFontStyleAndFontWeightTriplet);

  // go through the specs for each font family and font style pair
  for (const element of specsForFontFamilyAndFontStyleAndFontWeightTriplet) {
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
      
      // parse the first three lines, which are the font family and font style and font weight
      const fontFamily = lines[0].split(':')[1].trim();
      const fontStyle = lines[1].split(':')[1].trim();
      const fontWeight = lines[2].split(':')[1].trim();

      // make the keys for font family and style
      // in the specs object if they don't exist yet
      if (specs[fontFamily] === undefined) {
        specs[fontFamily] = {};
      }
      // space for the fontWeight
      if (specs[fontFamily][fontStyle] === undefined) {
        specs[fontFamily][fontStyle] = {};
      }

      // the object that will hold the specs for the current
      // font family and font style pair
      const specsForFontFamilyAndStyleAndWeightTriplet = {};

      // these are all the specs for a specific fontfamily and fontStyle and fontWeight
      var specsContentsOfFontFamilyAndFontStyleAndFontWeight = lines.slice(2).join('\n');
      // these contain several sub-specs, each of which is separated by a line with two dashes,
      // so split the sub-specs by the -- separator
      var subSpecsOfFontFamilyAndFontStyleAndFontWeightArray = specsContentsOfFontFamilyAndFontStyleAndFontWeight.split('--');
      
      // go through each sub-spec and parse it

      // for each sub-spec...
      for (const element of subSpecsOfFontFamilyAndFontStyleAndFontWeightArray) {
        const subSpecOfFontFamilyFontStyleFontWeight = element;        

        // remove all the empty lines
        const linesOfSubSpecOfFontFamilyFontStyleFontWeight = subSpecOfFontFamilyFontStyleFontWeight.split('\n');
        for (let j = 0; j < linesOfSubSpecOfFontFamilyFontStyleFontWeight.length; j++) {
          if (linesOfSubSpecOfFontFamilyFontStyleFontWeight[j] === '') {
            linesOfSubSpecOfFontFamilyFontStyleFontWeight.splice(j, 1);
            j--;
          }
        }

        // get the name and content of the sub-spec.
        if (linesOfSubSpecOfFontFamilyFontStyleFontWeight.length > 1) {
          
          // the name is the first line...
          const nameOfSubSpecOfFontFamilyFontStyleFontWeight = linesOfSubSpecOfFontFamilyFontStyleFontWeight[0];
          // ... the rest is the content (starting with a line with a dash)
          const contentOfSubSpecOfFontFamilyFontStyleFontWeight = linesOfSubSpecOfFontFamilyFontStyleFontWeight.slice(1).join('\n');

          // check the sub-spec name and parse it accordingly
          if (nameOfSubSpecOfFontFamilyFontStyleFontWeight === "ActualBoundingBoxLeft correction px" ||
              nameOfSubSpecOfFontFamilyFontStyleFontWeight === "CropLeft correction px" ||
              nameOfSubSpecOfFontFamilyFontStyleFontWeight === "ActualBoundingBoxRight correction px" ||
              nameOfSubSpecOfFontFamilyFontStyleFontWeight === "ActualBoundingBoxRight correction proportional" ||
              nameOfSubSpecOfFontFamilyFontStyleFontWeight === "Advancement correction proportional"
              ) {
            specsForFontFamilyAndStyleAndWeightTriplet[nameOfSubSpecOfFontFamilyFontStyleFontWeight] = parseSingleFloatCorrectionsForLettersSet(contentOfSubSpecOfFontFamilyFontStyleFontWeight);
          }
          else if (nameOfSubSpecOfFontFamilyFontStyleFontWeight === "Space advancement override for small sizes in px" ||
                   nameOfSubSpecOfFontFamilyFontStyleFontWeight === "Advancement override for small sizes in px"
                  ) {
            specsForFontFamilyAndStyleAndWeightTriplet[nameOfSubSpecOfFontFamilyFontStyleFontWeight] = parseSingleFloatCorrection(contentOfSubSpecOfFontFamilyFontStyleFontWeight);
          }
          else if (nameOfSubSpecOfFontFamilyFontStyleFontWeight === "Kerning discretisation for small sizes") {
            specsForFontFamilyAndStyleAndWeightTriplet[nameOfSubSpecOfFontFamilyFontStyleFontWeight] = parseSingleFloatCorrectionsForSizeBrackets(contentOfSubSpecOfFontFamilyFontStyleFontWeight);
          }
          else if (nameOfSubSpecOfFontFamilyFontStyleFontWeight === "Kerning cutoff") {
            specsForFontFamilyAndStyleAndWeightTriplet[nameOfSubSpecOfFontFamilyFontStyleFontWeight] = parseKerningCutoff(contentOfSubSpecOfFontFamilyFontStyleFontWeight);
          }
          else if (nameOfSubSpecOfFontFamilyFontStyleFontWeight === "Kerning") {
            specsForFontFamilyAndStyleAndWeightTriplet[nameOfSubSpecOfFontFamilyFontStyleFontWeight] = parseKerning(contentOfSubSpecOfFontFamilyFontStyleFontWeight);
          }
          // if we don't have a parser for the sub-spec, just put its string content in the object as it is
          else {
            specsForFontFamilyAndStyleAndWeightTriplet[nameOfSubSpecOfFontFamilyFontStyleFontWeight] = contentOfSubSpecOfFontFamilyFontStyleFontWeight;
          }
        }
      }


      specs[fontFamily][fontStyle][fontWeight] = specsForFontFamilyAndStyleAndWeightTriplet;
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
