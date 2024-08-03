// Globals
let ENABLE_KERNING = true;
let PIXEL_DENSITY = 0;
let hoverFontSize = 19;
let selectedFontSize = 19;
let settingsTextarea = null;
let fontFamilySelect = null;
let fontStyleSelect = null;
let fontWeightSelect = null;


function buildKerningTableIfDoesntExist() {
    // if the kerning table for this font family, style, weight and size doesn't exist yet, generate it

    // first get the font family, style, weight, size
    const fontFamily = fontFamilySelect.value;
    const fontStyle = fontStyleSelect.value;
    const fontWeight = fontWeightSelect.value;
    let fontSize = selectedFontSize;

    if (hoverFontSize !== null) {
        fontSize = hoverFontSize;
    }
 
    crispBitmapText_Full.buildKerningTableIfDoesntExist(fontFamily, fontStyle, fontWeight, fontSize);
}

// Helper function to create and append elements
function createElement(type, id, text, parent) {
    const element = document.createElement(type);
    if (id) element.id = id;
    if (text) element.textContent = text;
    parent.appendChild(element);
    return element;
}

function setupGlyphUI() {
    const selectorsDiv = document.getElementById("selectors");

    // Add dropdowns
    fontFamilySelect = addDropdownWithFontFamilies();
    fontStyleSelect = addFontStyleDropdown();
    fontWeightSelect = addFontWeightDropdown();

    // Add run button
    const runButton = createElement('button', 'run-button', 'Build and Show Glyphs', selectorsDiv);
    runButton.addEventListener('click', buildAndShowGlyphs);

    // Add kerning checkbox
    const enableKerningCheckbox = createElement('input', 'enable-kerning-checkbox', null, selectorsDiv);
    enableKerningCheckbox.type = 'checkbox';
    enableKerningCheckbox.checked = ENABLE_KERNING;
    enableKerningCheckbox.addEventListener('change', function() {
        ENABLE_KERNING = this.checked;
        buildAndShowGlyphs();
    });

    createElement('label', null, 'Enable kerning', selectorsDiv).htmlFor = 'enable-kerning-checkbox';

    // Add additional UI elements
    addCopyChoiceRadioButtons();
    addPixelDensityChoiceRadioButtons();

    // Add copy to clipboard button
    const copyToClipboardButton = createElement('button', 'copy-to-clipboard-button', 'Copy collected hashes to clipboard', selectorsDiv);
    copyToClipboardButton.addEventListener('click', function() {
        navigator.clipboard.writeText(JSON.stringify(thisRunsHashes));
    });

    // button to automatically scan through all the sizes of a particular triplet (font family, style, weight)
    const buildAllSizesButton = createElement('button', 'build-all-sizes-button', 'Build and Show Glyphs at All Sizes', selectorsDiv);
    buildAllSizesButton.addEventListener('click', function() {
        let i = 3;
        setTimeout(() => {
            let i = 3;
            const interval = setInterval(() => {
                if (i >= 81) {
                    clearInterval(interval);
                    return;
                }
                selectedFontSize = hoverFontSize = i;

                // un-highlight all the buttons
                for (let j = 0; j < 81; j++) {
                    const button = document.getElementById('button-size-' + j);
                    button.style.backgroundColor = 'white';
                }

                // highlight the button of the size we are currently building
                const button = document.getElementById('button-size-' + i);
                button.style.backgroundColor = 'darkgray';

                buildAndShowGlyphs();
                i++;
            });
        }, 1);
    });

    // button to download all the png glyphs sheets
    const downloadAllSheetsButton = createElement('button', 'download-all-sheets-button', 'Download glyphs sheets & kerning maps', selectorsDiv);
    downloadAllSheetsButton.addEventListener('click', function() {
        // use JSZip to create a zip file with all the pngs
        // for this font family, style, weight and all sizes
        // This is done starting from the canvases, which are all at
        // crispBitmapGlyphStore_Full.compact_glyphsSheets[fontFamily][fontStyle][fontWeight][fontSize][PIXEL_DENSITY];
        const zip = new JSZip();
        const folder = zip.folder("glyphsSheets");
        const glyphsSheets = crispBitmapGlyphStore_Full.compact_glyphsSheets;
        const fontFamily = fontFamilySelect.value;
        const fontStyle = fontStyleSelect.value;
        const fontWeight = fontWeightSelect.value;
        const sizes = Object.keys(glyphsSheets[fontFamily][fontStyle][fontWeight]);
        sizes.forEach(size => {
            // if there is no entry for the current pixel density, then do nothing
            if (!glyphsSheets[fontFamily][fontStyle][fontWeight][size][PIXEL_DENSITY + ""]) {
                return;
            }

            const canvas = glyphsSheets[fontFamily][fontStyle][fontWeight][size][PIXEL_DENSITY + ""];
            const dataUrl = canvas.toDataURL('image/png');
            const data = dataUrl.split(',')[1];
            // the filename is the font family, style, weight, size and pixel density, all lowercase, with
            // any special characters and spaces replaced by dashes and all multiple dashes replaced by a single dash
            let fileName = 'glyphs-sheet-density-' + PIXEL_DENSITY + '-' + fontFamily + '-style-' + fontStyle + '-weight-' + fontWeight + '-size-' + size;
            fileName = fileName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
            folder.file(fileName + '.png', data, { base64: true });

            // get the kerning table at this size, it's in
            // the glyphStore in compact_kerningTables[PIXEL_DENSITY][fontFamily][fontStyle][fontWeight][fontSize] = kerningTable;
            const kerningTable = crispBitmapGlyphStore_Full.compact_kerningTables[PIXEL_DENSITY][fontFamily][fontStyle][fontWeight][size];

            // save it in a JSON file with the same name as the png file
            folder.file(fileName + '.json', JSON.stringify(kerningTable));


        });
        zip.generateAsync({ type: "blob" }).then(function(content) {
            saveAs(content, "glyphsSheets.zip");
        });
        
    });


    selectorsDiv.appendChild(document.createElement('br'));

    // Add settings textarea
    settingsTextarea = createElement('textarea', 'settings-textarea', null, selectorsDiv);
    settingsTextarea.value = specsText;
    settingsTextarea.style.cssText = 'float: left; height: 200px; width: 333px;';

    // Add size buttons
    hoverFontSize = addSizeButtons();

    document.body.appendChild(document.createElement('br'));
}

// Call setup function
setupGlyphUI();