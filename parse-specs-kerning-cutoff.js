function parseKerningCutoff(contentOfSubSpec) {
  console.log("have to parse" + contentOfSubSpec);

  // remove the first line as it's a dash
  const linesOfSubSpecOfFontFamilyFontStyleFontWeight = contentOfSubSpec.split('\n');
  linesOfSubSpecOfFontFamilyFontStyleFontWeight.splice(0, 1);

  // just parse a number in the next line
  return parseInt(linesOfSubSpecOfFontFamilyFontStyleFontWeight[0]);
}
