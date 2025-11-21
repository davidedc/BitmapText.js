// add four radio buttons, one labelled "Test text 1", one labelled "Kern King Part 1", one labelled "Kern King Part 2", and one labelled "Mixed Text & Symbols"
// these will control which test text is shown

function addCopyChoiceRadioButtons() {
    const testCopy1RadioButton = document.createElement('input');
    testCopy1RadioButton.type = 'radio';
    testCopy1RadioButton.id = 'test-copy-1-radio-button';
    testCopy1RadioButton.name = 'test-copy-radio-button';
    testCopy1RadioButton.checked = true;
    document.getElementById("selectors").appendChild(testCopy1RadioButton);
    // add a label for the radio button
    const testCopy1RadioButtonLabel = document.createElement('label');
    testCopy1RadioButtonLabel.textContent = 'Test text 1';
    testCopy1RadioButtonLabel.htmlFor = 'test-copy-1-radio-button';
    document.getElementById("selectors").appendChild(testCopy1RadioButtonLabel);
    const kernKingCopyPart1RadioButton = document.createElement('input');
    kernKingCopyPart1RadioButton.type = 'radio';
    kernKingCopyPart1RadioButton.id = 'kern-king-copy-part-1-radio-button';
    kernKingCopyPart1RadioButton.name = 'test-copy-radio-button';
    document.getElementById("selectors").appendChild(kernKingCopyPart1RadioButton);
    // add a label for the radio button
    const kernKingCopyPart1RadioButtonLabel = document.createElement('label');
    kernKingCopyPart1RadioButtonLabel.textContent = 'Kern King Part 1';
    kernKingCopyPart1RadioButtonLabel.htmlFor = 'kern-king-copy-part-1-radio-button';
    document.getElementById("selectors").appendChild(kernKingCopyPart1RadioButtonLabel);
    const kernKingCopyPart2RadioButton = document.createElement('input');
    kernKingCopyPart2RadioButton.type = 'radio';
    kernKingCopyPart2RadioButton.id = 'kern-king-copy-part-2-radio-button';
    kernKingCopyPart2RadioButton.name = 'test-copy-radio-button';
    document.getElementById("selectors").appendChild(kernKingCopyPart2RadioButton);
    // add a label for the radio button
    const kernKingCopyPart2RadioButtonLabel = document.createElement('label');
    kernKingCopyPart2RadioButtonLabel.textContent = 'Kern King Part 2';
    kernKingCopyPart2RadioButtonLabel.htmlFor = 'kern-king-copy-part-2-radio-button';
    document.getElementById("selectors").appendChild(kernKingCopyPart2RadioButtonLabel);
    const testCopy4RadioButton = document.createElement('input');
    testCopy4RadioButton.type = 'radio';
    testCopy4RadioButton.id = 'test-copy-4-radio-button';
    testCopy4RadioButton.name = 'test-copy-radio-button';
    document.getElementById("selectors").appendChild(testCopy4RadioButton);
    // add a label for the radio button
    const testCopy4RadioButtonLabel = document.createElement('label');
    testCopy4RadioButtonLabel.textContent = 'Mixed Text & Symbols';
    testCopy4RadioButtonLabel.htmlFor = 'test-copy-4-radio-button';
    document.getElementById("selectors").appendChild(testCopy4RadioButtonLabel);

    // if the radio button is clicked, call the buildAndShowGlyphs function
    // TODO you should do less work here, you should
    // 1. remove all the test text canvases
    // 2. re-add them
    // 3. call drawTestText
    testCopy1RadioButton.addEventListener('click', updatePageContent);
    kernKingCopyPart1RadioButton.addEventListener('click', updatePageContent);
    kernKingCopyPart2RadioButton.addEventListener('click', updatePageContent);
    testCopy4RadioButton.addEventListener('click', updatePageContent);

}

