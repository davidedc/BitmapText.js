function setupGlyphUIFAB() {
    const selectorsDiv = document.getElementById("selectors");

    const copyToClipboardButton = createElement('button', 'copy-to-clipboard-button', 'Copy collected hashes to clipboard', selectorsDiv);
    copyToClipboardButton.addEventListener('click', () => hashStore.copyHashesToClipboard());


    // Checkbox to include non-minified metrics files in download
    const includeNonMinifiedLabel = document.createElement('label');
    includeNonMinifiedLabel.style.marginLeft = '20px';
    includeNonMinifiedLabel.style.fontSize = '14px';

    const includeNonMinifiedMetricsCheckbox = document.createElement('input');
    includeNonMinifiedMetricsCheckbox.type = 'checkbox';
    includeNonMinifiedMetricsCheckbox.id = 'include-non-minified-metrics-checkbox';
    includeNonMinifiedMetricsCheckbox.style.marginRight = '5px';

    includeNonMinifiedLabel.appendChild(includeNonMinifiedMetricsCheckbox);
    includeNonMinifiedLabel.appendChild(document.createTextNode('Include non-minified metrics files'));
    selectorsDiv.appendChild(includeNonMinifiedLabel);

    // button to download all the font assets
    const downloadAllAtlasesButton = createElement('button', 'download-all-atlases-button', 'Download font assets', selectorsDiv);
    downloadAllAtlasesButton.addEventListener('click', function() {
        const pixelDensity = document.getElementById('pixel-density-2-radio-button').checked ? 2 : 1;

        // Static classes - no instances needed
        // downloadFontAssets uses static AtlasDataStoreFAB and FontMetricsStoreFAB methods
        downloadFontAssets({
            pixelDensity,
            fontFamily: fontFamilySelect.value,
            fontStyle: fontStyleSelect.value,
            fontWeight: fontWeightSelect.value,
            includeNonMinifiedMetrics: includeNonMinifiedMetricsCheckbox.checked
        });
    });
}

setupGlyphUIFAB();