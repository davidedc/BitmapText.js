// build an object that will contain the specs, which is object keyed by font family,
// then by font style, then by sub-spec name


class SpecsParser {
  constructor() {
    this.previousSpecsString = null;
    this.parsedSpecs = {};
  }

  // If the specs string changed, parse it, clear all the kerning tables and build
  // the one for the current size.
  // If the string has not changed, check if the kerning table for the current size exists and if not, build it.
  parseSpecsIfChanged(specsString) {

    if (specsString !== this.previousSpecsString) {
      this.previousSpecsString = specsString;

      this.parseSpecs(specsString);
      console.dir(this.parsedSpecs);

      // clear the kerning tables because the specs probably have changed
      // (unless the user is just changing, say, a comment, but we can't know that)
      crispBitmapGlyphStore_Full.clearKerningTables();
    }

    return new Specs(this.parsedSpecs);

  }

  parseSpecs(specsString) {
    // remove comments i.e. double shashes. Can be anywhere in the line, so we have to remove the whole line
    const specsStringWithoutComments = specsString.replace(/.*\/\/.*/g, '');
    // also remove empty lines
    const specsStringWithoutCommentsAndEmptyLines = specsStringWithoutComments.replace(/^\s*\n/gm, '');

    console.log("have to parse" + specsStringWithoutCommentsAndEmptyLines);

    const specsForFontFamilyAndFontStyleAndFontWeightTriplet = specsStringWithoutCommentsAndEmptyLines.split('---------');
    console.dir(specsForFontFamilyAndFontStyleAndFontWeightTriplet);

    // go through the specs for each font family and font style pair
    for (const setting of specsForFontFamilyAndFontStyleAndFontWeightTriplet) {
      // also remove empty lines
      const lines = setting.split('\n').filter(line => line !== '');

      if (lines.length > 1) {
        // parse the first three lines, which are the font family and font style and font weight
        const fontFamily = lines[0].split(':')[1].trim();
        const fontStyle = lines[1].split(':')[1].trim();
        const fontWeight = lines[2].split(':')[1].trim();

        // make the keys for font family and style
        // in the specs object if they don't exist yet
        ensureNestedPropertiesExist(this.parsedSpecs, [fontFamily, fontStyle]);

        const specsForFontFamilyAndStyleAndWeightTriplet = {};

        const specsContentsOfFontFamilyAndFontStyleAndFontWeight = lines.slice(2).join('\n');
        const subSpecsOfFontFamilyAndFontStyleAndFontWeightArray = specsContentsOfFontFamilyAndFontStyleAndFontWeight.split('--');

        // go through each sub-spec and parse it
        // for each sub-spec...
        for (const subSpecOfFontFamilyFontStyleFontWeight of subSpecsOfFontFamilyAndFontStyleAndFontWeightArray) {
          // also remove empty lines
          const linesOfSubSpecOfFontFamilyFontStyleFontWeight = subSpecOfFontFamilyFontStyleFontWeight.split('\n').filter(line => line !== '');

          // get the name and content of the sub-spec.
          if (linesOfSubSpecOfFontFamilyFontStyleFontWeight.length > 1) {
            // the name is the first line...
            const nameOfSubSpecOfFontFamilyFontStyleFontWeight = linesOfSubSpecOfFontFamilyFontStyleFontWeight[0];
            // ... the rest is the content (starting with a line with a dash)
            const contentOfSubSpecOfFontFamilyFontStyleFontWeight = linesOfSubSpecOfFontFamilyFontStyleFontWeight.slice(1).join('\n');

            specsForFontFamilyAndStyleAndWeightTriplet[nameOfSubSpecOfFontFamilyFontStyleFontWeight] = this.parseSubSpec(nameOfSubSpecOfFontFamilyFontStyleFontWeight, contentOfSubSpecOfFontFamilyFontStyleFontWeight);
          }
        }

        this.parsedSpecs[fontFamily][fontStyle][fontWeight] = specsForFontFamilyAndStyleAndWeightTriplet;
      }
    }
  }

  parseSubSpec(name, content) {
    switch (name) {
      case "ActualBoundingBoxLeft correction px":
      case "CropLeft correction px":
      case "ActualBoundingBoxRight correction px":
      case "ActualBoundingBoxRight correction proportional":
      case "Advancement correction proportional":
        return this.parseSingleFloatCorrectionsForLettersSet(content);
      case "Space advancement override for small sizes in px":
      case "Advancement override for small sizes in px":
        return this.parseSingleFloatCorrection(content);
      case "Kerning discretisation for small sizes":
        return this.parseSingleFloatCorrectionsForSizeBrackets(content);
      case "Kerning cutoff":
        return this.parseKerningCutoff(content);
      case "Kerning":
        return this.parseKerning(content);
      default:
        // if we don't have a parser for the sub-spec, just put its string content in the object as it is  
        return content;
    }
  }

  parseSingleFloatCorrectionsForLettersSet(contentOfSubSpec) {
    // remove the first line as it's a dash
    const linesOfSubSpecOfFontFamilyFontStyleFontWeight = contentOfSubSpec.split('\n').slice(1);
    const correctionsBySizeArray = [];

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
    for (const line of linesOfSubSpecOfFontFamilyFontStyleFontWeight) {
      // there can be multiple parts covering different ranges of sizes
      // so you have to constantly look out for the next range
      // i.e. a line matching "[number] to [number]""
      if (this.isSizeRange(line)) {
        // this is a line with " to " in it
        // so it's the start of a new section
        // put the two numbers in the line into an object with keys "from" and "to"
        const sizeRangeObj = this.parseSizeRange(line);
        // add to the correctionsBySizeArray array the new size range and the correctionsBySizeArray objects array
        correctionsBySizeArray.push({ sizeRange: sizeRangeObj, lettersAndTheirCorrections: [] });
      } else {
        const parseCharsAndCorrectionObj = this.parseCharsAndCorrectionLine(line);
        correctionsBySizeArray[correctionsBySizeArray.length - 1].lettersAndTheirCorrections.push(parseCharsAndCorrectionObj);
      }
    }
    return correctionsBySizeArray;
  }

  parseSingleFloatCorrection(contentOfSubSpec) {
    // remove the first line as it's a dash
    const linesOfSubSpecOfFontFamilyFontStyleFontWeight = contentOfSubSpec.split('\n').slice(1);
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

    for (const line of linesOfSubSpecOfFontFamilyFontStyleFontWeight) {
      // there can be multiple parts covering different ranges of sizes
      // so you have to constantly look out for the next range
      // i.e. a line matching "[number] to [number]""
      if (this.isSizeRange(line)) {
        // this is a line with " to " in it
        // so it's the start of a new section
        // put the two numbers in the line into an object with keys "from" and "to"
        const sizeRangeObj = this.parseSizeRange(line);
        // add to the correctionsBySizeArray array the new size range and the correctionsBySizeArray objects array
        correctionsBySizeArray.push({ sizeRange: sizeRangeObj, correction: {} });
      } else {
        const correction = this.parseCorrectionLine(line);
        correctionsBySizeArray[correctionsBySizeArray.length - 1].correction = correction;
      }
    }
    return correctionsBySizeArray;
  }

  parseSingleFloatCorrectionsForSizeBrackets(contentOfSubSpec) {
    // remove the first line as it's a dash
    const linesOfSubSpecOfFontFamilyFontStyleFontWeight = contentOfSubSpec.split('\n').slice(1);

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

    for (const line of linesOfSubSpecOfFontFamilyFontStyleFontWeight) {
      // there can be multiple parts covering different ranges of sizes
      // so you have to constantly look out for the next range
      // i.e. a line matching "[number] to [number]""
      if (this.isSizeRange(line)) {
        // this is a line with " to " in it
        // so it's the start of a new section
        // put the two numbers in the line into an object with keys "from" and "to"
        const sizeRangeObj = this.parseSizeRange(line);
        // add to the correctionsBySizeArray array the new size range and the correctionsBySizeArray objects array
        correctionsBySizeArray.push({ sizeRange: sizeRangeObj, sizeBracketAndItsCorrection: [] });
      } else {
        const sizeBracketAndCorrection = this.parseSizesAndCorrectionLine(line);
        correctionsBySizeArray[correctionsBySizeArray.length - 1].sizeBracketAndItsCorrection.push(sizeBracketAndCorrection);
      }
    }
    return correctionsBySizeArray;
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
  parseKerning(contentOfSubSpec) {
    console.log("have to parse" + contentOfSubSpec);
    // remove the first line as it's a dash
    const linesOfSubSpecOfFontFamilyFontStyleFontWeight = contentOfSubSpec.split('\n').slice(1);

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
    const kerningArray = [];

    for (const line of linesOfSubSpecOfFontFamilyFontStyleFontWeight) {
      // there can be multiple parts covering different ranges of sizes
      // so you have to constantly look out for the next range
      // i.e. a line matching "[number] to [number]""
      if (this.isSizeRange(line)) {
        // this is a line with " to " in it
        // so it's the start of a new section
        // put the two numbers in the line into an object with keys "from" and "to"
        const sizeRangeObj = this.parseSizeRange(line);
        // add to the kerningArray array the new size range and the kerning objects array
        kerningArray.push({ sizeRange: sizeRangeObj, kerning: [] });
      } else {
        const parseKerningObj = this.parseKerningLine(line);
        kerningArray[kerningArray.length - 1].kerning.push(parseKerningObj);
      }
    }
    return kerningArray;
  }

  parseKerningCutoff(contentOfSubSpec) {
    console.log("have to parse" + contentOfSubSpec);

    // remove the first line as it's a dash
    const linesOfSubSpecOfFontFamilyFontStyleFontWeight = contentOfSubSpec.split('\n');
    linesOfSubSpecOfFontFamilyFontStyleFontWeight.splice(0, 1);

    // just parse a number in the next line
    return parseInt(linesOfSubSpecOfFontFamilyFontStyleFontWeight[0]);
  }

  parseCharsAndCorrectionLine(line) {
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
    const correction = parseFloat(line2.substring(line2.lastIndexOf(':') + 1));
    // 4. pack the string and the two numbers into an object
    return { string: line3, adjustment: correction };
  }

  parseCorrectionLine(line) {
    // each line after the size range looks like:
    //
    //   9
    //
    // so:
    // 1. ignore the first two spaces
    // 2. parse the float and return it

    // 1. ignore the first two spaces
    const line2 = line.substring(2);
    // 2. parse the float and return it
    return parseFloat(line2);
  }

  parseSizesAndCorrectionLine(line) {
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
  parseKerningLine(line) {
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

  parseSizeRange(line) {
    const splitByTo = line.split(' to ');
    const from = parseInt(splitByTo[0]);
    const to = parseInt(splitByTo[1]);

    if (line.indexOf(' at pixel density ') !== -1) {
      const splitByAtPixelDensity = line.split(' at pixel density ');
      const pixelDensity = parseInt(splitByAtPixelDensity[1]);
      return { from: from, to: to, pixelDensity: pixelDensity };
    } else {
      return { from: from, to: to, pixelDensity: null };
    }
  }

  // Checks if a given line represents a size range in the format of either
  //   "[integer] to [integer]"
  // or
  //   "[integer] to [integer] at pixel density [integer]"
  isSizeRange(line) {
    return /^\d+\s+to\s+\d+(\s+at\s+pixel\s+density\s+\d+)?$/.test(line);
  }

}
