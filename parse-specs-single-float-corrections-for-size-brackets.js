function parseSingleFloatCorrectionsForSizeBrackets(contentOfSubSpec) {
  // TODO there is a lot of code in here that is already in
  // parseSingleFloatCorrectionsForLettersSet and others.

  // remove the first line as it's a dash
  const linesOfSubSpecOfFontFamilyFontStyleFontWeight = contentOfSubSpec.split('\n');
  linesOfSubSpecOfFontFamilyFontStyleFontWeight.splice(0, 1);

  // linesOfSubSpecOfFontFamilyFontStyleFontWeight in the form:
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
  const correctionsBySizeArray = [];
  for (const element of linesOfSubSpecOfFontFamilyFontStyleFontWeight) {
    const line = element;

    // there can be multiple parts covering different ranges of sizes
    // so you have to constantly look out for the next range
    // i.e. a line matching "[number] to [number]""
    if (isSizeRange(line)) {
      // this is a line with " to " in it
      // so it's the start of a new section
      // put the two numbers in the line into an object with keys "from" and "to"
      const sizeRangeObj = parseSizeRange(line);

      // add to the correctionsBySizeArray array the new size range and the correctionsBySizeArray objects array
      correctionsBySizeArray.push({ sizeRange: {}, sizeBracketAndItsCorrection: [] });

      correctionsBySizeArray[correctionsBySizeArray.length - 1].sizeRange = sizeRangeObj;
    }
    else {
      const sizeBracketAndCorrection = parseSizesAndCorrectionLine(line);
      correctionsBySizeArray[correctionsBySizeArray.length - 1].sizeBracketAndItsCorrection.push(sizeBracketAndCorrection);
    }
  }
  return correctionsBySizeArray;
}

// TODO this seems to be unused according to Chrome's coverage tool
function parseSizesAndCorrectionLine(line) {
  // each line after the size range looks like:
  //
  //   0.145 >= kern > 0: -1
  //
  // in which case we want to return:
  //   { kernG: 0, kernLE: 0.145, adjustment: -1 }
  //
  // so:
  // 1. ignore the first two spaces
  // 2. parse the float
  // 3. skip the " >= kern > " part
  // 4. parse the float
  // 5. skip the ": " part
  // 6. parse the float
  // 7. pack the three numbers into an object

  // 1. ignore the first two spaces
  const line2 = line.substring(2);

  // 2. parse the float
  const kernG = parseFloat(line2);

  // 3. skip the " >= kern > " part
  const line3 = line2.substring(line2.indexOf(' > ') + 3);

  // 4. parse the float
  const kernLE = parseFloat(line3);

  // 5. skip the ": " part
  const line4 = line3.substring(line3.indexOf(': ') + 2);

  // 6. parse the float
  const adjustment = parseFloat(line4);

  // 7. pack the three numbers into an object
  return { kernG: kernG, kernLE: kernLE, adjustment: adjustment };

}

