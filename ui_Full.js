function setupGlyphUI_Full() {
    const selectorsDiv = document.getElementById("selectors");

    // Add copy to clipboard button
    const copyToClipboardButton = createElement('button', 'copy-to-clipboard-button', 'Copy collected hashes to clipboard', selectorsDiv);
    copyToClipboardButton.addEventListener('click', function() {
        //  we'll copy to clipboard something of this shape:
        //
        //  const thisRunsHashes = {};
        //
        //  // Note that some are missing because we fail to render some very small sizes
        //  const storedReferenceCrispTextRendersHashes = {
        //    "density-1-0-Arial-style-normal-weight-normal-size-10-0 glyph sheet":"e5a58cf",
        //    "density-1-0-Arial-style-normal-weight-normal-size-10-0 glyph sheet testCopyChoiceNumber 1":"61e749a7",
        //    "density-1-0-Arial-style-normal-weight-normal-size-10-0 glyph sheet testCopyChoiceNumber 2":"77a625b",
        //    "density-1-0-Arial-style-normal-weight-normal-size-10-0 glyph sheet testCopyChoiceNumber 3":"c86ecc3",
        //     ...
        //    "density-2-0-Arial-style-normal-weight-normal-size-9-5 individual glyphs testCopyChoiceNumber 3":"2d72c896"
        //  };

        // sort and filter the hashes, which are stored as key-value pairs in the thisRunsHashes object
        const sortedKeys = Object.keys(thisRunsHashes).sort();
        const filteredKeys = sortedKeys.filter(key => key.includes('glyph sheet') || key.includes('ndividual glyphs'));
        const formattedString = `const thisRunsHashes = {};\n\n// Note that some are missing because we fail to render some very small sizes\nconst storedReferenceCrispTextRendersHashes = {\n${filteredKeys.map(key => `  "${key}":"${thisRunsHashes[key]}"`).join(',\n')}\n};`;
        navigator.clipboard.writeText(formattedString);
    });
  }

  setupGlyphUI_Full();