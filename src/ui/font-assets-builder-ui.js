function setupGlyphUIFAB() {
    const selectorsDiv = document.getElementById("selectors");

    const copyToClipboardButton = createElement('button', 'copy-to-clipboard-button', 'Copy collected hashes to clipboard', selectorsDiv);
    copyToClipboardButton.addEventListener('click', () => hashStore.copyHashesToClipboard());


    // button to download all the font assets
    const downloadAllAtlasesButton = createElement('button', 'download-all-atlases-button', 'Download font assets', selectorsDiv);
    downloadAllAtlasesButton.addEventListener('click', function() {
        const pixelDensity = document.getElementById('pixel-density-2-radio-button').checked ? 2 : 1;
        
        // Pass individual properties to downloadFontAssets
        // (The function will create FontPropertiesFAB instances internally for each size)
        downloadFontAssets({
            atlasDataStoreFAB,
            fontMetricsStoreFAB,
            pixelDensity,
            fontFamily: fontFamilySelect.value,
            fontStyle: fontStyleSelect.value,
            fontWeight: fontWeightSelect.value
        });
    });
}

setupGlyphUIFAB();