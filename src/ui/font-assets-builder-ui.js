function setupGlyphUI_FAB() {
    const selectorsDiv = document.getElementById("selectors");

    const copyToClipboardButton = createElement('button', 'copy-to-clipboard-button', 'Copy collected hashes to clipboard', selectorsDiv);
    copyToClipboardButton.addEventListener('click', () => hashStore.copyHashesToClipboard());


    // button to download all the font assets
    const downloadAllSheetsButton = createElement('button', 'download-all-sheets-button', 'Download font assets', selectorsDiv);
    downloadAllSheetsButton.addEventListener('click', function() {
        const pixelDensity = document.getElementById('pixel-density-2-radio-button').checked ? 2 : 1;
        
        // Pass individual properties to downloadFontAssets
        // (The function will create FontPropertiesFAB instances internally for each size)
        downloadFontAssets({
            bitmapGlyphStore_FAB,
            pixelDensity,
            fontFamily: fontFamilySelect.value,
            fontStyle: fontStyleSelect.value,
            fontWeight: fontWeightSelect.value
        });
    });
}

setupGlyphUI_FAB();