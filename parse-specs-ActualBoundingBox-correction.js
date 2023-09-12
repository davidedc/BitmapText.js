function parseActualBoundingBoxCorrection(contentOfSubSpec) {
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
      const parseCharsAndOffsetsObj = parseCharsAndCorrectionLine(line);
      lettersExtraSpaceAndPullPxArray[lettersExtraSpaceAndPullPxArray.length - 1].charsAndOffsets.push(parseCharsAndOffsetsObj);
    }
  }
  return lettersExtraSpaceAndPullPxArray;
}

function parseCharsAndCorrectionLine(line) {
  // each line after the size range looks like:
  //
  //   vw: 9
  //
  // so:
  // 1. ignore the first two spaces
  // 2. keep in a string all the characters up to the last colon in the string (there might be more than one colon in the string)
  // 3. keep as a number the number after the last colon
  // 4. pack the string and the two numbers into an object

  // 1. ignore the first two spaces
  const line2 = line.substring(2);

  // 2. keep in a string all the characters up to the last colon in the string (there might be more than one colon in the string)
  const line3 = line2.substring(0, line2.lastIndexOf(':'));

  // 3. keep as a number the number after the last colon
  const correction = parseInt(line2.substring(line2.lastIndexOf(':') + 1));

  // 4. pack the string and the two numbers into an object
  return { string: line3, adjustment: correction };

}

