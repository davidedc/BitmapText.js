function parseSpecs() {
  const specsOfFontFamilyAndFontEmphasys = settingsTextarea.value.split('---------');
  console.dir(specsOfFontFamilyAndFontEmphasys);
  // build an object that will contain each of the settings, the key is the first line after the separator
  // and the value is the rest of the lines after the separator
  const specs = {};
  for (let i = 0; i < specsOfFontFamilyAndFontEmphasys.length; i++) {
    const setting = specsOfFontFamilyAndFontEmphasys[i];
    const lines = setting.split('\n');

    // remove all the empty lines
    for (let j = 0; j < lines.length; j++) {
      if (lines[j] === '') {
        lines.splice(j, 1);
        j--;
      }
    }

    if (lines.length > 1) {
      const key = lines[0];
      const key2 = lines[1];
      const innerObject = {};
      if (specs[key] === undefined) {
        specs[key] = {};
      }

      // these are all the settings for fontfamily, fontemphasis
      var specsContentsOfFontFamilyAndFontEmphasys = lines.slice(2).join('\n');
      // split the sub-specs for the FontFamilyFontEmphasis by the -- separator
      var specsContentsOfFontFamilyAndFontEmphasysSplit = specsContentsOfFontFamilyAndFontEmphasys.split('--');
      for (let k = 0; k < specsContentsOfFontFamilyAndFontEmphasysSplit.length; k++) {
        const subSpecOfFontFamilyFontEmphasis = specsContentsOfFontFamilyAndFontEmphasysSplit[k];
        const linesOfSubSpecOfFontFamilyFontEmphasis = subSpecOfFontFamilyFontEmphasis.split('\n');
        // remove all the empty lines
        for (let j = 0; j < linesOfSubSpecOfFontFamilyFontEmphasis.length; j++) {
          if (linesOfSubSpecOfFontFamilyFontEmphasis[j] === '') {
            linesOfSubSpecOfFontFamilyFontEmphasis.splice(j, 1);
            j--;
          }
        }

        if (linesOfSubSpecOfFontFamilyFontEmphasis.length > 1) {
          const keyOfSubSpecOfFontFamilyFontEmphasis = linesOfSubSpecOfFontFamilyFontEmphasis[0];
          const valueOfSubSpecOfFontFamilyFontEmphasis = linesOfSubSpecOfFontFamilyFontEmphasis.slice(1).join('\n');

          // check the sub-spec name
          if (keyOfSubSpecOfFontFamilyFontEmphasis === "letters extra space and pull px") {
            const sections = parseLettersExtraSpaceAndPullPX(valueOfSubSpecOfFontFamilyFontEmphasis);
            //console.dir(sections);
            innerObject[keyOfSubSpecOfFontFamilyFontEmphasis] = sections;
          }
          else {
            innerObject[keyOfSubSpecOfFontFamilyFontEmphasis] = valueOfSubSpecOfFontFamilyFontEmphasis;
          }
        }
      }


      specs[key][key2] = innerObject;
    }
  }
  console.dir(specs);
}


function parseLettersExtraSpaceAndPullPX(valueOfSettingOfFontFamilyFontEmphasis) {
  console.log("have to parse" + valueOfSettingOfFontFamilyFontEmphasis);
  // remove the first line
  const linesOfSubSpecOfFontFamilyFontEmphasis = valueOfSettingOfFontFamilyFontEmphasis.split('\n');
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
  const sections = [];
  for (let i = 0; i < linesOfSubSpecOfFontFamilyFontEmphasis.length; i++) {
    const line = linesOfSubSpecOfFontFamilyFontEmphasis[i];

    // there can be multiple parts covering different ranges of sizes
    // so you have to constantly look out for the next range
    // i.e. a line matching "[number] to [number]""
    if (/^\d+\s+to\s+\d+$/.test(line)) {
      // this is a line with " to " in it
      // so it's the start of a new section
      // put the two numbers in the line into an object with keys "from" and "to"
      const sizeRangeLine = line.split(' to ');
      const from = parseInt(sizeRangeLine[0]);
      const to = parseInt(sizeRangeLine[1]);

      sections.push({ sizeRange: {}, charsAndOffsets: [] });
      sections[sections.length - 1].sizeRange = { from: from, to: to };

    }
    else {
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
      sections[sections.length - 1].charsAndOffsets.push({ string: line3, right: right, left: left });
    }
  }
  return sections;
}
