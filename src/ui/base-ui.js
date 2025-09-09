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
let drawCrisply = true;
let truncateMetrics = true;

// Consolidated function to extract font properties from UI elements
// Returns FontProperties instance for core functionality
function getFontPropertiesFromUI() {
  let fontSize, pixelDensity;

  if (hoverFontSize !== null) {
    fontSize = hoverFontSize;
  }
  else {
    fontSize = selectedFontSize;
  }

  if (document.getElementById('pixel-density-2-radio-button').checked) {
    pixelDensity = 2;
  }
  else {
    pixelDensity = 1;
  }

  // Create core FontProperties instance
  return new FontProperties(
    pixelDensity,
    fontFamilySelect.value,
    fontStyleSelect.value,
    fontWeightSelect.value,
    fontSize
  );
}

// UI wrapper for kerning table building - ensures kerning table exists for current font
function ensureKerningTable() {
    // Guard against missing Editor class in text-render-tests.html
    if (typeof bitmapText_Editor === 'undefined') {
        return;
    }
    
    // Get current font properties and build kerning table if needed
    const properties = getFontPropertiesFromUI();
    bitmapText_Editor.buildKerningTableIfDoesntExist(properties);
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

    // add a checkbox to draw the glyphs crisply or not
    const drawCrisplyCheckbox = createElement('input', 'draw-crisp-checkbox', null, selectorsDiv);
    drawCrisplyCheckbox.type = 'checkbox';
    drawCrisplyCheckbox.checked = drawCrisply;
    drawCrisplyCheckbox.addEventListener('change', function() {
        drawCrisply = this.checked;
        updatePageContent();
    });
    createElement('label', null, 'Draw crisply', selectorsDiv).htmlFor = 'draw-crisp-checkbox';


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

    // Add checkbox to truncate metrics
    const truncateMetricsCheckbox = createElement('input', 'truncate-metrics-checkbox', null, selectorsDiv);
    truncateMetricsCheckbox.type = 'checkbox';
    truncateMetricsCheckbox.checked = truncateMetrics;
    truncateMetricsCheckbox.addEventListener('change', function() {
        truncateMetrics = this.checked;
        updatePageContent();
    });
    createElement('label', null, 'Truncate metrics', selectorsDiv).htmlFor = 'truncate-metrics-checkbox';


    // Add additional UI elements
    addCopyChoiceRadioButtons();
    addPixelDensityChoiceRadioButtons();


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