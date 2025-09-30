class Specs {

  constructor(specs) {
    this.specs = specs;
  }

  kerning(fontProperties) {
    const { fontFamily, fontStyle, fontWeight } = fontProperties;
    return this.specs[fontFamily][fontStyle][fontWeight]["Kerning"];
  }

  kerningCutoff(fontProperties) {
    const { fontFamily, fontStyle, fontWeight } = fontProperties;
    return this.specs[fontFamily][fontStyle][fontWeight]["Kerning cutoff"];
  }

  specCombinationExists(fontProperties, correctionKey) {
    const { fontFamily, fontStyle, fontWeight } = fontProperties;
    return this.specs?.[fontFamily]?.[fontStyle]?.[fontWeight]?.[correctionKey] !== undefined;
  }

  getCorrectionEntries(fontProperties, correctionKey) {
    const {
      fontFamily,
      fontStyle,
      fontWeight,
      fontSize,
      pixelDensity
    } = fontProperties;

    if (!this.specCombinationExists(fontProperties, correctionKey)) {
      return null;
    }

    const specEntry = this.specs[fontFamily][fontStyle][fontWeight][correctionKey];
    if (fontSize <= specEntry) {
      return null;
    }

    const correctionEntries = [];
    for (const correctionEntry of specEntry) {
      if (correctionEntry.sizeRange == undefined) continue;
      // if the pixel density is specified and it doesn't match, skip this entry
      if (
        pixelDensity !== null &&
        correctionEntry.sizeRange.pixelDensity !== null &&
        pixelDensity !== correctionEntry.sizeRange.pixelDensity
      )
        continue;
      if (correctionEntry.sizeRange.from <= fontSize && correctionEntry.sizeRange.to >= fontSize) {
        correctionEntries.push(correctionEntry);
      }
    }
    return correctionEntries.length > 0 ? correctionEntries : null;
  }

  // We don't expect to have multiple matches across sizes as the
  // sizes should form a partition i.e. they shouldn't be overlapping,
  // hence we return the first match.
  //
  // Example:
  //
  //  Space advancement override for small sizes in px
  //  -
  //  15 to 20
  //    5
  //  14 to 14
  //    4
  getSingleFloatCorrection(fontProperties, correctionKey) {
    const correctionEntries = this.getCorrectionEntries(fontProperties, correctionKey);
    // if there is a first element with a correcttion, return it, otherwise return null
    return correctionEntries ? correctionEntries[0].correction : null;
  }

  // for this one, the sizes don't form a partition, so we need to check all the entries
  // and return the first match where the character is found
  //
  // Example:
  //
  //  CropLeft correction px
  //  -
  //  14 to 14 at pixel density 1
  //    .: -1
  //  13 to 14 at pixel density 1
  //    ,: -110 to 10 at pixel density 1
  //    W: 1
  //  13 to 13 at pixel density 1
  //    v: 1
  getSingleFloatCorrectionForChar(fontProperties, char, correctionKey) {
    const correctionEntries = this.getCorrectionEntries(fontProperties, correctionKey);
    if (!correctionEntries) return 0;

    for (const correctionEntry of correctionEntries) {
      for (const charAndOffset of correctionEntry.charsAndTheirCorrections) {
        if (charAndOffset.string.indexOf(char) !== -1) {
          return charAndOffset.adjustment;
        }
      }
    }

    return 0;
  }
}