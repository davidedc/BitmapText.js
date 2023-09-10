// add three radio buttons, one labelled "Test text 1", one labelled "Kern King Part 1", and one labelled "Kern King Part 2"
// these will control which test text is shown

function addRadioButtonsToSelectText() {
    const nextTextRadioButton = document.createElement('input');
    nextTextRadioButton.type = 'radio';
    nextTextRadioButton.id = 'next-text-radio-button';
    nextTextRadioButton.name = 'test-text-radio-button';
    nextTextRadioButton.checked = true;
    document.getElementById("selectors").appendChild(nextTextRadioButton);
    // add a label for the radio button
    const nextTextRadioButtonLabel = document.createElement('label');
    nextTextRadioButtonLabel.textContent = 'Test text 1';
    nextTextRadioButtonLabel.htmlFor = 'next-text-radio-button';
    document.getElementById("selectors").appendChild(nextTextRadioButtonLabel);
    const kernKindPart1RadioButton = document.createElement('input');
    kernKindPart1RadioButton.type = 'radio';
    kernKindPart1RadioButton.id = 'kern-kind-part-1-radio-button';
    kernKindPart1RadioButton.name = 'test-text-radio-button';
    document.getElementById("selectors").appendChild(kernKindPart1RadioButton);
    // add a label for the radio button
    const kernKindPart1RadioButtonLabel = document.createElement('label');
    kernKindPart1RadioButtonLabel.textContent = 'Kern King Part 1';
    kernKindPart1RadioButtonLabel.htmlFor = 'kern-kind-part-1-radio-button';
    document.getElementById("selectors").appendChild(kernKindPart1RadioButtonLabel);
    const kernKindPart2RadioButton = document.createElement('input');
    kernKindPart2RadioButton.type = 'radio';
    kernKindPart2RadioButton.id = 'kern-kind-part-2-radio-button';
    kernKindPart2RadioButton.name = 'test-text-radio-button';
    document.getElementById("selectors").appendChild(kernKindPart2RadioButton);
    // add a label for the radio button
    const kernKindPart2RadioButtonLabel = document.createElement('label');
    kernKindPart2RadioButtonLabel.textContent = 'Kern King Part 2';
    kernKindPart2RadioButtonLabel.htmlFor = 'kern-kind-part-2-radio-button';
    document.getElementById("selectors").appendChild(kernKindPart2RadioButtonLabel);

    // if the radio button is clicked, call the buildAndShowGlyphs function
    // TODO you should do less work here, you should
    // 1. remove all the test text canvases
    // 2. re-add them
    // 3. call drawTestText
    nextTextRadioButton.addEventListener('click', buildAndShowGlyphs);
    kernKindPart1RadioButton.addEventListener('click', buildAndShowGlyphs);
    kernKindPart2RadioButton.addEventListener('click', buildAndShowGlyphs);

}

