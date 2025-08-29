function setupGlyphUI_Editor() {
    const selectorsDiv = document.getElementById("selectors");

    const copyToClipboardButton = createElement('button', 'copy-to-clipboard-button', 'Copy collected hashes to clipboard', selectorsDiv);
    copyToClipboardButton.addEventListener('click', () => hashStore.copyHashesToClipboard());


    // button to download all the png glyph sheets
    const downloadAllSheetsButton = createElement('button', 'download-all-sheets-button', 'Download glyph sheets & kerning maps', selectorsDiv);
    downloadAllSheetsButton.addEventListener('click', function() {
        const pixelDensity = document.getElementById('pixel-density-2-radio-button').checked ? 2 : 1;
        
        downloadGlyphSheetsAndKerningMaps({
            bitmapGlyphStore_Editor,
            pixelDensity,
            fontFamily: fontFamilySelect.value,
            fontStyle: fontStyleSelect.value,
            fontWeight: fontWeightSelect.value
        });
    });
}

setupGlyphUI_Editor();