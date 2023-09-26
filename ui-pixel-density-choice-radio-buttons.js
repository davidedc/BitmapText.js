// add two radio buttons,for pixel density 1 and pixel density 2

function addPixelDensityChoiceRadioButtons() {
    const pixelDensity1RadioButton = document.createElement('input');
    pixelDensity1RadioButton.type = 'radio';
    pixelDensity1RadioButton.id = 'pixel-density-1-radio-button';
    pixelDensity1RadioButton.name = 'pixel-density-radio-button';
    pixelDensity1RadioButton.checked = true;
    document.getElementById("selectors").appendChild(pixelDensity1RadioButton);
    // add a label for the radio button
    const pixelDensity1RadioButtonLabel = document.createElement('label');
    pixelDensity1RadioButtonLabel.textContent = 'Pixel density 1';
    pixelDensity1RadioButtonLabel.htmlFor = 'pixel-density-1-radio-button';
    document.getElementById("selectors").appendChild(pixelDensity1RadioButtonLabel);
    const pixelDensity2RadioButton = document.createElement('input');
    pixelDensity2RadioButton.type = 'radio';
    pixelDensity2RadioButton.id = 'pixel-density-2-radio-button';
    pixelDensity2RadioButton.name = 'pixel-density-radio-button';
    document.getElementById("selectors").appendChild(pixelDensity2RadioButton);
    // add a label for the radio button
    const pixelDensity2RadioButtonLabel = document.createElement('label');
    pixelDensity2RadioButtonLabel.textContent = 'Pixel density 2';
    pixelDensity2RadioButtonLabel.htmlFor = 'pixel-density-2-radio-button';
    document.getElementById("selectors").appendChild(pixelDensity2RadioButtonLabel);

    // if the radio button is clicked, call the buildAndShowGlyphs function
    // TODO you should do less work here, you should
    // 1. remove all the test text canvases
    // 2. re-add them
    // 3. call drawTestText
    pixelDensity1RadioButton.addEventListener('click', buildAndShowGlyphs);
    pixelDensity2RadioButton.addEventListener('click', buildAndShowGlyphs);

}  
