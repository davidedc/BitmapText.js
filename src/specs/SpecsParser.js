// Builds a Specs object that will contain the specs, i.e. an object keyed by font family,
// then by font style, then by sub-spec name.

class SpecsParser {
  constructor() {
    this.previousSpecsString = null;
    this.parsedSpecs = {};

    // Bind methods to ensure 'this' refers to the SpecsParser instance
    this.parseSubSpec = this.parseSubSpec.bind(this);
    this.parseKerningCutoff = this.parseKerningCutoff.bind(this);
    this.parseSizeBasedSpec = this.parseSizeBasedSpec.bind(this);
  }

  parseSpecsIfChanged(specsString) {
    if (specsString !== this.previousSpecsString) {
      this.previousSpecsString = specsString;
      this.parseSpecs(specsString);
      console.dir(this.parsedSpecs);
      // clear the kerning tables because the specs probably have changed
      // (unless the user is just changing, say, a comment, but we can't know that)
      fontMetricsStoreFAB.clearKerningTables();
    }
    return new Specs(this.parsedSpecs);
  }

  cleanSpecsString(specsString) {
    return specsString
      .replace(/.*\/\/.*/g, '') // Remove comments
      .replace(/^\s*\n/gm, ''); // Remove empty lines
  }

  // Each "spec" is separated by '---------' and specifies
  // a bunch of sub-specs for a triplet of font family, style, and weight
  parseSpecs(specsString) {
    const cleanedSpecs = this.cleanSpecsString(specsString);
    const fontSpecs = cleanedSpecs.split('---------');

    for (const setting of fontSpecs) {
      const lines = setting.split('\n').filter(line => line !== '');
      if (lines.length > 1) {
        this.parseFontSpec(lines);
      }
    }
  }

  // Each "spec" is separated by '---------' and starts with three lines of font info,
  // then a bunch of sub-specs separated by '--'
  parseFontSpec(lines) {
    // example:
    //   Font family: Arial
    //   Font style: normal
    //   Font weight: normal
    const [fontFamily, fontStyle, fontWeight] = this.parseFontInfo(lines.slice(0, 3));
    
    // Ensure nested objects exist
    if (!this.parsedSpecs[fontFamily]) {
      this.parsedSpecs[fontFamily] = {};
    }
    if (!this.parsedSpecs[fontFamily][fontStyle]) {
      this.parsedSpecs[fontFamily][fontStyle] = {};
    }

    // subspecs are separated by '--'
    const specsForFont = {};
    const subSpecs = lines.slice(2).join('\n').split('--');

    // go through each sub-spec and parse it
    for (const subSpec of subSpecs) {
      const subSpecLines = subSpec.split('\n').filter(line => line !== '');
      if (subSpecLines.length > 1) {
        const [name, ...content] = subSpecLines;
        specsForFont[name] = this.parseSubSpec(name, content.join('\n'));
      }
    }

    this.parsedSpecs[fontFamily][fontStyle][fontWeight] = specsForFont;
  }

  parseFontInfo(infoLines) {
    return infoLines.map(line => line.split(':')[1].trim());
  }

  // Take Kerning for example:
  // ---------------------------------------
  // Kerning
  // -
  // [integer] to [integer]
  //   [letters or "*any*"] followed by [letters or "*any*"]: [float]
  //   ...
  // ...
  //
  // EXAMPLE --------------------------------
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
  parseSubSpec(name, content) {
    const parsers = {
      "ActualBoundingBoxLeft correction px": this.parseSizeBasedSpec.bind(this, 'letters'),
      "CropLeft correction px": this.parseSizeBasedSpec.bind(this, 'letters'),
      "ActualBoundingBoxRight correction px": this.parseSizeBasedSpec.bind(this, 'letters'),
      "ActualBoundingBoxRight correction proportional": this.parseSizeBasedSpec.bind(this, 'letters'),
      "Advancement correction proportional": this.parseSizeBasedSpec.bind(this, 'letters'),
      "Space advancement override for small sizes in px": this.parseSizeBasedSpec.bind(this, 'single'),
      "Advancement override for small sizes in px": this.parseSizeBasedSpec.bind(this, 'single'),
      "Kerning discretisation for small sizes": this.parseSizeBasedSpec.bind(this, 'sizeBracket'),
      "Kerning cutoff": this.parseKerningCutoff,
      "Kerning": this.parseSizeBasedSpec.bind(this, 'kerning')
    };

    return parsers[name] ? parsers[name](content) : content;
  }

  parseSizeBasedSpec(type, content) {
    const lines = content.split('\n').slice(1);
    const result = [];

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
    let currentSizeRange = null;
    for (const line of lines) {
      if (this.isSizeRange(line)) {
        currentSizeRange = this.parseSizeRange(line);
        result.push(this.createEntryForType(type, currentSizeRange));
      } else if (currentSizeRange) {
        const parsedLine = this.parseSizeBasedLine(type, line);
        const lastEntry = result[result.length - 1];
        this.addParsedLineToEntry(lastEntry, type, parsedLine);
      }
    }

    return result;
  }

  createEntryForType(type, sizeRange) {
    const entry = { sizeRange };
    switch (type) {
      case 'kerning':
        entry.kerning = [];
        break;
      case 'letters':
        entry.lettersAndTheirCorrections = [];
        break;
      case 'single':
        entry.correction = null;
        break;
      case 'sizeBracket':
        entry.sizeBracketAndItsCorrection = [];
        break;
      default:
        entry.data = [];
    }
    return entry;
  }

  addParsedLineToEntry(entry, type, parsedLine) {
    switch (type) {
      case 'kerning':
        entry.kerning.push(parsedLine);
        break;
      case 'letters':
        entry.lettersAndTheirCorrections.push(parsedLine);
        break;
      case 'single':
        entry.correction = parsedLine;
        break;
      case 'sizeBracket':
        entry.sizeBracketAndItsCorrection.push(parsedLine);
        break;
      default:
        if (!entry.data) entry.data = [];
        entry.data.push(parsedLine);
    }
  }

  parseSizeBasedLine(type, line) {
    const trimmedLine = line.trim();
    switch (type) {
      case 'letters':
        return this.parseCharsAndCorrectionLine(trimmedLine);
      case 'single':
        return this.parseCorrectionLine(trimmedLine);
      case 'sizeBracket':
        return this.parseSizesAndCorrectionLine(trimmedLine);
      case 'kerning':
        // example:
        //   absvds followed by dshkjshdfjhsdfsdfjkh: 0.1
        return this.parseKerningLine(trimmedLine);
      default:
        throw new Error(`Unknown size-based spec type: ${type}`);
    }
  }

  // example:
  //   Kerning cutoff
  //   -
  //   5
  parseKerningCutoff(content) {
    const cutoffLine = content.split('\n')[1].trim();
    return this.parseIntAndCheck(cutoffLine, content);
  }

  splitOnLastColon(str) {
    const lastColonIndex = str.lastIndexOf(':');
    if (lastColonIndex === -1) {
      return [str];
    }
    return [str.slice(0, lastColonIndex), str.slice(lastColonIndex + 1)];
  }

  parseNumberAndCheck(value, originalLine, parseFunction) {
    const parsedValue = parseFunction(value);
    if (isNaN(parsedValue)) {
      console.log(originalLine);
      debugger;
    }
    return parsedValue;
  }

  parseIntAndCheck(value, originalLine) {
    return this.parseNumberAndCheck(value, originalLine, parseInt);
  }

  parseFloatAndCheck(value, originalLine) {
    return this.parseNumberAndCheck(value, originalLine, parseFloat);
  }

  // example:
  //   abc.:;,def: -1
  parseCharsAndCorrectionLine(line) {
    const [chars, correction] = this.splitOnLastColon(line).map(s => s.trim());
    return { 
      string: chars, 
      adjustment: this.parseFloatAndCheck(correction, line) 
    };
  }

  // example is the '5' below:
  //   Space advancement override for small sizes in px
  //   -
  //   15 to 20
  //    5  
  parseCorrectionLine(line) {
    return this.parseFloatAndCheck(line.trim(), line);
  }

  // example:
  //   0.145 >= kern > 0: -1
  parseSizesAndCorrectionLine(line) {
    const [sizes, adjustment] = this.splitOnLastColon(line).map(s => s.trim());
    const [kernLE, kernG] = sizes.split('>=').map(s => parseFloat(s.trim()));
    return { 
      kernG, 
      kernLE, 
      adjustment: this.parseFloatAndCheck(adjustment, line) 
    };
  }

  // example:
  //   [letters or "*any*"] followed by [letters or "*any*"]: [float]
  // e.g.
  //   absvds followed by dshkjshdfjhsdfsdfjkh: 0.1
  parseKerningLine(line) {
    const [pairs, adjustment] = this.splitOnLastColon(line).map(s => s.trim());
    const [left, right] = pairs.split('followed by').map(s => s.trim());
    return { 
      left, 
      right, 
      adjustment: this.parseFloatAndCheck(adjustment, line) 
    };
  }

  // examples:
  //   2 to 10.5
  //   9.5 to 9 at pixel density 2
  parseSizeRange(line) {
    const [range, pixelDensity] = line.split(' at pixel density ');
    const [from, to] = range.split(' to').map(s => this.parseFloatAndCheck(s.trim(), line));
    return {
      from,
      to,
      pixelDensity: pixelDensity ? this.parseIntAndCheck(pixelDensity, line) : null
    };
  }

  // Checks if a given line represents a size range in the format of either
  //   "[integer or float] to [integer or float]"
  // or
  //   "[integer or float] to [integer or float] at pixel density [integer]"
  isSizeRange(line) {
    return /^(\d*\.?\d+)\s+to\s+(\d*\.?\d+)(\s+at\s+pixel\s+density\s+\d+)?$/.test(line);
  }
}
