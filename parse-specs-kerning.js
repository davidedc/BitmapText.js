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
  for (const element of linesOfSubSpecOfFontFamilyFontEmphasis) {
    const line = element;

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
