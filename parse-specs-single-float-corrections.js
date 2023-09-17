function parseSingleFloatCorrection(contentOfSubSpec) {
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
  const correctionsBySizeArray = [];
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

      // add to the correctionsBySizeArray array the new size range and the correctionsBySizeArray objects array
      correctionsBySizeArray.push({ sizeRange: {}, correction: {} });

      correctionsBySizeArray[correctionsBySizeArray.length - 1].sizeRange = sizeRangeObj;
    }
    else {
      const correction = parseCorrectionLine(line);
      correctionsBySizeArray[correctionsBySizeArray.length - 1].correction = correction;
    }
  }
  return correctionsBySizeArray;
}

function parseCorrectionLine(line) {
  // each line after the size range looks like:
  //
  //   9
  //
  // so:
  // 1. ignore the first two spaces
  // 2. parse the float
  // 3. pack the number into an object

  // 1. ignore the first two spaces
  const line2 = line.substring(2);

  // 2. parse the float
  const correction = parseFloat(line2);

  // 3. pack the number into an object
  return correction;
}

