// Globals
let ENABLE_KERNING = true;
let PIXEL_DENSITY = 0;
let hoverFontSize = 19;
let selectedFontSize = 19;
let settingsTextarea = null;
let fontFamilySelect = null;
let fontStyleSelect = null;
let fontWeightSelect = null;

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