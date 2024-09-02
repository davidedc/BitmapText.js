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
        const zip = new JSZip();
        const folder = zip.folder("glyphsSheets");
        const crispBitmapGlyphStore = crispBitmapGlyphStore_Full.extractCrispBitmapGlyphStoreInstance();
        const glyphsSheets = crispBitmapGlyphStore.glyphsSheets;
        const fontFamily = fontFamilySelect.value;
        const fontStyle = fontStyleSelect.value;
        const fontWeight = fontWeightSelect.value;
        const sizes = Object.keys(glyphsSheets[PIXEL_DENSITY][fontFamily][fontStyle][fontWeight]);
        let files = [];
        sizes.forEach(size => {
            // if there is no entry for the current pixel density, then do nothing
            if (!glyphsSheets[PIXEL_DENSITY][fontFamily][fontStyle][fontWeight][size]) {
                return;
            }

            const canvas = glyphsSheets[PIXEL_DENSITY][fontFamily][fontStyle][fontWeight][size];
            const dataUrl = canvas.toDataURL('image/png');
            const data = dataUrl.split(',')[1];
            // the filename is the font family, style, weight, size and pixel density, all lowercase, with
            // any special characters and spaces replaced by dashes and all multiple dashes replaced by a single dash
            let fileName = 'glyphs-sheet-density-' + PIXEL_DENSITY + '-' + fontFamily + '-style-' + fontStyle + '-weight-' + fontWeight + '-size-' + size;
            fileName = fileName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
            folder.file(fileName + '.png', data, { base64: true });

            // navigate through the crispBitmapGlyphStore, which contains:
            //   kerningTables = {}; // [pixelDensity,fontFamily, fontStyle, fontWeight, fontSize]    
            //   glyphsTextMetrics = {}; // [pixelDensity, fontFamily, fontStyle, fontWeight, fontSize, letter]
            //   spaceAdvancementOverrideForSmallSizesInPx = {}; // [pixelDensity, fontFamily, fontStyle, fontWeight, fontSize]
            //   // these two needed to precisely paint a glyph from the sheet into the destination canvas
            //   glyphsSheets = {}; // [pixelDensity, fontFamily, fontStyle, fontWeight, fontSize]
            //   glyphsSheetsMetrics = { // all objects indexed on [pixelDensity, fontFamily, fontStyle, fontWeight, fontSize, letter]
            //     tightWidth: {},
            //     tightHeight: {},
            //     dx: {},
            //     dy: {},
            //     xInGlyphSheet: {}
            //   };
            // and filter all the objects that are relevant to the current PIXEL_DENSITY, font family, style, weight and size
            // and save them in a JSON file
            const kerningTable = crispBitmapGlyphStore.kerningTables[PIXEL_DENSITY][fontFamily][fontStyle][fontWeight][size];
            const glyphsTextMetrics = crispBitmapGlyphStore.glyphsTextMetrics[PIXEL_DENSITY][fontFamily][fontStyle][fontWeight][size];
            const spaceAdvancementOverrideForSmallSizesInPx = crispBitmapGlyphStore.spaceAdvancementOverrideForSmallSizesInPx[PIXEL_DENSITY][fontFamily][fontStyle][fontWeight][size];
            const glyphsSheetsMetrics = {};
            glyphsSheetsMetrics.tightWidth = crispBitmapGlyphStore.glyphsSheetsMetrics.tightWidth[PIXEL_DENSITY][fontFamily][fontStyle][fontWeight][size];
            glyphsSheetsMetrics.tightHeight = crispBitmapGlyphStore.glyphsSheetsMetrics.tightHeight[PIXEL_DENSITY][fontFamily][fontStyle][fontWeight][size];
            glyphsSheetsMetrics.dx = crispBitmapGlyphStore.glyphsSheetsMetrics.dx[PIXEL_DENSITY][fontFamily][fontStyle][fontWeight][size];
            glyphsSheetsMetrics.dy = crispBitmapGlyphStore.glyphsSheetsMetrics.dy[PIXEL_DENSITY][fontFamily][fontStyle][fontWeight][size];
            glyphsSheetsMetrics.xInGlyphSheet = crispBitmapGlyphStore.glyphsSheetsMetrics.xInGlyphSheet[PIXEL_DENSITY][fontFamily][fontStyle][fontWeight][size];

            // save all the data in a JSON file with the same name as the png file
            folder.file(fileName + '.js', "(bitmapFontsData ??= {})." + fileName.replace(/-/g, '_') + " = " + JSON.stringify({
                kerningTable,
                glyphsTextMetrics,
                spaceAdvancementOverrideForSmallSizesInPx,
                glyphsSheetsMetrics
            }) + ";");
            files.push(fileName);
        });
        // add one last file i.e. the manifest file that contains the list of all the files
        folder.file('manifest.js', "(bitmapFontsManifest ??= {}).files = " + JSON.stringify(files) + ";");

        zip.generateAsync({ type: "blob" }).then(function(content) {
            saveAs(content, "glyphsSheets.zip");
        });
        
    });

    // add a new button "reset background color" to reset the background color of the page after an error
    const resetBackgroundColorButton = createElement('button', 'reset-background-color-button', 'Reset background color', selectorsDiv);
    resetBackgroundColorButton.addEventListener('click', function() {
        document.body.style.backgroundColor = '#d4ffd4';
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