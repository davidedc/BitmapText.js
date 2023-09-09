// add three radio buttons, one labelled "Next text", one labelled "Kern Kind Part 1", and one labelled "Kern Kind Part 2"
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
    nextTextRadioButtonLabel.textContent = 'Next text';
    nextTextRadioButtonLabel.htmlFor = 'next-text-radio-button';
    document.getElementById("selectors").appendChild(nextTextRadioButtonLabel);
    const kernKindPart1RadioButton = document.createElement('input');
    kernKindPart1RadioButton.type = 'radio';
    kernKindPart1RadioButton.id = 'kern-kind-part-1-radio-button';
    kernKindPart1RadioButton.name = 'test-text-radio-button';
    document.getElementById("selectors").appendChild(kernKindPart1RadioButton);
    // add a label for the radio button
    const kernKindPart1RadioButtonLabel = document.createElement('label');
    kernKindPart1RadioButtonLabel.textContent = 'Kern Kind Part 1';
    kernKindPart1RadioButtonLabel.htmlFor = 'kern-kind-part-1-radio-button';
    document.getElementById("selectors").appendChild(kernKindPart1RadioButtonLabel);
    const kernKindPart2RadioButton = document.createElement('input');
    kernKindPart2RadioButton.type = 'radio';
    kernKindPart2RadioButton.id = 'kern-kind-part-2-radio-button';
    kernKindPart2RadioButton.name = 'test-text-radio-button';
    document.getElementById("selectors").appendChild(kernKindPart2RadioButton);
    // add a label for the radio button
    const kernKindPart2RadioButtonLabel = document.createElement('label');
    kernKindPart2RadioButtonLabel.textContent = 'Kern Kind Part 2';
    kernKindPart2RadioButtonLabel.htmlFor = 'kern-kind-part-2-radio-button';
    document.getElementById("selectors").appendChild(kernKindPart2RadioButtonLabel);

    // if the radio button is clicked, call the drawTestText function
    nextTextRadioButton.addEventListener('click', drawTestText);
    kernKindPart1RadioButton.addEventListener('click', drawTestText);
    kernKindPart2RadioButton.addEventListener('click', drawTestText);
    
}

