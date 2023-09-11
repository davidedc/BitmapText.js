function parseKerningCutoff(contentOfSubSpec) {
  console.log("have to parse" + contentOfSubSpec);

  // remove the first line as it's a dash
  const linesOfSubSpecOfFontFamilyFontEmphasis = contentOfSubSpec.split('\n');
  linesOfSubSpecOfFontFamilyFontEmphasis.splice(0, 1);

  // just parse a number in the next line
  return parseInt(linesOfSubSpecOfFontFamilyFontEmphasis[0]);
}
