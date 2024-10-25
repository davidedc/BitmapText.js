// Globals
let isKerningEnabled = true;
let drawAllPixelDensitiesWithLargerPixelDensity1Text = false;
let drawCheckeredBackgrounds = false;
let hoverFontSize = 19;
let selectedFontSize = 19;
let settingsTextarea = null;
let fontFamilySelect = null;
let fontStyleSelect = null;
let fontWeightSelect = null;


function buildKerningTableIfDoesntExist() {
    // if the kerning table for this font family, style, weight and size doesn't exist yet, generate it

    let pixelDensity;
    if (document.getElementById('pixel-density-2-radio-button').checked) {
        pixelDensity = 2;
    }
    else {
        pixelDensity = 1;
    }

    // first get the font family, style, weight, size
    const fontFamily = fontFamilySelect.value;
    const fontStyle = fontStyleSelect.value;
    const fontWeight = fontWeightSelect.value;
    let fontSize = selectedFontSize;

    if (hoverFontSize !== null) {
        fontSize = hoverFontSize;
    }

    const properties = {pixelDensity, fontFamily, fontStyle, fontWeight, fontSize};
 
    bitmapText_Full.buildKerningTableIfDoesntExist(properties);
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
    runButton.addEventListener('click', updatePageContent);

    // Add checkbox to force the use of pixel density 1, tied to the drawAllPixelDensitiesWithLargerPixelDensity1Text variable
    const drawAllPixelDensitiesWithLargerPixelDensity1TextCheckbox = createElement('input', 'draw-all-pixel-densities-with-larger-pixel-density-1-text-checkbox', null, selectorsDiv);
    drawAllPixelDensitiesWithLargerPixelDensity1TextCheckbox.type = 'checkbox';
    drawAllPixelDensitiesWithLargerPixelDensity1TextCheckbox.checked = drawAllPixelDensitiesWithLargerPixelDensity1Text;
    drawAllPixelDensitiesWithLargerPixelDensity1TextCheckbox.addEventListener('change', function() {
        drawAllPixelDensitiesWithLargerPixelDensity1Text = this.checked;
        updatePageContent();
    });
    createElement('label', null, 'Draw all pixel densities via larger pixel density 1 text', selectorsDiv).htmlFor = 'draw-all-pixel-densities-with-larger-pixel-density-1-text-checkbox';

    // Add checkbox to draw checkered bacgrounds instead of white
    const drawCheckeredBackgroundsCheckbox = createElement('input', 'draw-checkered-backgrounds-checkbox', null, selectorsDiv);
    drawCheckeredBackgroundsCheckbox.type = 'checkbox';
    drawCheckeredBackgroundsCheckbox.checked = drawCheckeredBackgrounds;
    drawCheckeredBackgroundsCheckbox.addEventListener('change', function() {
        drawCheckeredBackgrounds = this.checked;
        updatePageContent();
    });
    createElement('label', null, 'Draw checkered backgrounds', selectorsDiv).htmlFor = 'draw-checkered-backgrounds-checkbox';
    

    // Add kerning checkbox
    const enableKerningCheckbox = createElement('input', 'enable-kerning-checkbox', null, selectorsDiv);
    enableKerningCheckbox.type = 'checkbox';
    enableKerningCheckbox.checked = isKerningEnabled;
    enableKerningCheckbox.addEventListener('change', function() {
        isKerningEnabled = this.checked;
        updatePageContent();
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
                if (i > maxFontSize_px) {
                    clearInterval(interval);
                    return;
                }
                selectedFontSize = hoverFontSize = i;

                // un-highlight all the buttons
                for (let j = 0; j <= maxFontSize_px; j += fontSizeIncrement_px) {
                    const button = document.getElementById('button-size-' + j);
                    button.style.backgroundColor = 'white';
                }

                // highlight the button of the size we are currently building
                const button = document.getElementById('button-size-' + i);
                button.style.backgroundColor = 'darkgray';

                updatePageContent();
                i += fontSizeIncrement_px;
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
        const bitmapGlyphStore = bitmapGlyphStore_Full.extractBitmapGlyphStoreInstance();
        const glyphsSheets = bitmapGlyphStore.glyphsSheets;
        let pixelDensity;
        if (document.getElementById('pixel-density-2-radio-button').checked) {
            pixelDensity = 2;
        }
        else {
            pixelDensity = 1;
        }
            
        const fontFamily = fontFamilySelect.value;
        const fontStyle = fontStyleSelect.value;
        const fontWeight = fontWeightSelect.value;
        const sizes = Object.keys(glyphsSheets[pixelDensity][fontFamily][fontStyle][fontWeight]);
        let files = [];
        sizes.forEach(size => {
            // if there is no entry for the current pixel density, then do nothing
            if (!glyphsSheets[pixelDensity][fontFamily][fontStyle][fontWeight][size]) {
                return;
            }

            const canvas = glyphsSheets[pixelDensity][fontFamily][fontStyle][fontWeight][size];
            const dataUrl = canvas.toDataURL('image/png');
            const data = dataUrl.split(',')[1];

            // the filename is the font family, style, weight, size and pixel density, all lowercase, with
            // any special characters and spaces replaced by dashes and all multiple dashes replaced by a single dash
            // note that the pixel density and the weight have two parts because they could have decimals
            // e.g.
            // glyphs-sheet-density-1-5-Arial-style-normal-weight-normal-size-18-5.js fir pixel density 1.5 and size 18.5
            // glyphs-sheet-density-1-0-Arial-style-normal-weight-normal-size-18-0.js fir pixel density 1 and size 18
            const properties = {
                pixelDensity,
                fontFamily,
                fontStyle,
                fontWeight,
                fontSize: size
            };
        
            const fileName = GlyphIDString_Full.getFilename(properties);
        
            folder.file(fileName + '.png', data, { base64: true });

            // navigate through the bitmapGlyphStore, which contains:
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
            // and filter all the objects that are relevant to the current pixelDensity, font family, style, weight and size
            // and save them in a JSON file
            const kerningTable = bitmapGlyphStore.kerningTables[pixelDensity][fontFamily][fontStyle][fontWeight][size];
            const glyphsTextMetrics = bitmapGlyphStore.glyphsTextMetrics[pixelDensity][fontFamily][fontStyle][fontWeight][size];
            const spaceAdvancementOverrideForSmallSizesInPx = bitmapGlyphStore.spaceAdvancementOverrideForSmallSizesInPx[pixelDensity][fontFamily][fontStyle][fontWeight][size];
            const glyphsSheetsMetrics = {};
            glyphsSheetsMetrics.tightWidth = bitmapGlyphStore.glyphsSheetsMetrics.tightWidth[pixelDensity][fontFamily][fontStyle][fontWeight][size];
            glyphsSheetsMetrics.tightHeight = bitmapGlyphStore.glyphsSheetsMetrics.tightHeight[pixelDensity][fontFamily][fontStyle][fontWeight][size];
            glyphsSheetsMetrics.dx = bitmapGlyphStore.glyphsSheetsMetrics.dx[pixelDensity][fontFamily][fontStyle][fontWeight][size];
            glyphsSheetsMetrics.dy = bitmapGlyphStore.glyphsSheetsMetrics.dy[pixelDensity][fontFamily][fontStyle][fontWeight][size];
            glyphsSheetsMetrics.xInGlyphSheet = bitmapGlyphStore.glyphsSheetsMetrics.xInGlyphSheet[pixelDensity][fontFamily][fontStyle][fontWeight][size];

            // Store all the data in a JSON file with the same name as
            // the png file (apart from the extension of course)
            folder.file(fileName + '.js', 
                `(loadedBitmapFontData ??= {})['${fileName}'] = ${JSON.stringify({
                    kerningTable,
                    glyphsTextMetrics,
                    spaceAdvancementOverrideForSmallSizesInPx,
                    glyphsSheetsMetrics
                })};`
            );
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
    // value is specsDefault variable if it exists, otherwise it is an empty string
    settingsTextarea.value = specsDefault || '';
    settingsTextarea.style.cssText = 'float: left; height: 200px; width: 333px;';

    // Add size buttons
    hoverFontSize = addSizeButtons();

    document.body.appendChild(document.createElement('br'));
}

// Call setup function
setupGlyphUI();