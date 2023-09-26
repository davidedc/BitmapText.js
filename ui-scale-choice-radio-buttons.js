// add two radio buttons, one labelled "scale 1", one labelled "scale 2"
// these will control the scale used

function addScaleChoiceRadioButtons() {
    const scale1RadioButton = document.createElement('input');
    scale1RadioButton.type = 'radio';
    scale1RadioButton.id = 'scale-1-radio-button';
    scale1RadioButton.name = 'scale-radio-button';
    scale1RadioButton.checked = true;
    document.getElementById("selectors").appendChild(scale1RadioButton);
    // add a label for the radio button
    const scale1RadioButtonLabel = document.createElement('label');
    scale1RadioButtonLabel.textContent = 'Scale 1';
    scale1RadioButtonLabel.htmlFor = 'scale-1-radio-button';
    document.getElementById("selectors").appendChild(scale1RadioButtonLabel);
    const scale2RadioButton = document.createElement('input');
    scale2RadioButton.type = 'radio';
    scale2RadioButton.id = 'scale-2-radio-button';
    scale2RadioButton.name = 'scale-radio-button';
    document.getElementById("selectors").appendChild(scale2RadioButton);
    // add a label for the radio button
    const scale2RadioButtonLabel = document.createElement('label');
    scale2RadioButtonLabel.textContent = 'Scale 2';
    scale2RadioButtonLabel.htmlFor = 'scale-2-radio-button';
    document.getElementById("selectors").appendChild(scale2RadioButtonLabel);

    // if the radio button is clicked, call the buildAndShowGlyphs function
    // TODO you should do less work here, you should
    // 1. remove all the test text canvases
    // 2. re-add them
    // 3. call drawTestText
    scale1RadioButton.addEventListener('click', buildAndShowGlyphs);
    scale2RadioButton.addEventListener('click', buildAndShowGlyphs);

}  
