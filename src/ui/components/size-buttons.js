function addSizeButtons() {
  const hoverButtonsDiv = document.createElement('div');
  hoverButtonsDiv.id = 'hoverButtons';
  document.getElementById("selectors").appendChild(hoverButtonsDiv);

  // Start from minFontSize_px (9 for building, 0 for rendering/testing)
  for (let i = minFontSize_px; i <= maxFontSize_px; i += fontSizeIncrement_px) {
    const button = document.createElement('button');
    // set the id to "button-size-<i>"
    button.id = 'button-size-' + i;
    button.textContent = i;
    button.style.width = '30px';
    button.style.height = '30px';
    button.style.margin = '0px';
    button.style.padding = '0px';
    button.style.border = '1px dotted grey';
    button.style.backgroundColor = 'white';
    button.style.color = 'black';
    button.style.fontSize = '12px';
    button.style.fontWeight = 'normal';
    button.style.fontStyle = 'normal';
    button.style.fontFamily = 'Arial';
    button.style.textAlign = 'center';
    button.style.verticalAlign = 'middle';
    button.style.lineHeight = '30px';
    button.style.cursor = 'pointer';

    button.addEventListener('mouseover', function () {
      hoverFontSize = i;
      // set the button background color to light gray
      if (selectedFontSize !== i) {
        button.style.backgroundColor = 'lightgray';
      }
      updatePageContent();
    });

    // when the mouse exits the button, set the hoverFontSize to null
    button.addEventListener('mouseout', function () {
      hoverFontSize = null;
      // set the button background color to white unless it is the selectedFontSize
      if (selectedFontSize !== i) {
        button.style.backgroundColor = 'white';
      }
      updatePageContent();
    });


    // when you click on the button, you set the selectedFontSize to the number of the button
    // and color the button dark gray
    button.addEventListener('click', function () {

      if (selectedFontSize !== null) {
        const oldButton = document.getElementById('button-size-' + selectedFontSize);
        oldButton.style.backgroundColor = 'white';
      }

      selectedFontSize = i;
      button.style.backgroundColor = 'darkgray';
    });


    hoverButtonsDiv.appendChild(button);
  }

  // make the button of the default selectedFontSize dark gray
  const defaultSizeButton = document.getElementById('button-size-' + selectedFontSize);
  defaultSizeButton.style.backgroundColor = 'darkgray';
  return hoverFontSize;
}
