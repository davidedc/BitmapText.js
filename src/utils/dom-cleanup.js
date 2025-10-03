function removeAllCanvasesAndDivs() {

  // remove all the canvases EXCEPT validation harness canvases
  const canvases = document.querySelectorAll('canvas');
  for (const element of canvases) {
    // Skip validation harness canvases (identified by data-validation attribute)
    if (element.hasAttribute('data-validation')) {
      continue;
    }
    // do this special sort of cleanup so to hopefully hand-hold the garbage collector
    // resize the canvas to zero so that it doesn't take up any space
    element.width = 0;
    element.height = 0;
    // then remove it
    element.remove();
  }

  // remove all the contents of the testCopyCanvases div (which were mostly canvases cleaned up above)
  const testCopyCanvases = document.getElementById('testCopyCanvases');
  while (testCopyCanvases.firstChild) {
    testCopyCanvases.removeChild(testCopyCanvases.firstChild);
  }

  // remove all other divs apart from a couple (including validation-section and its children)
  const divs = document.querySelectorAll('div');
  const validationSection = document.getElementById('validation-section');

  for (const element of divs) {
    // Skip protected divs and their descendants
    const isProtectedDiv = element.id === 'selectors' ||
                          element.id === 'testCopyCanvases' ||
                          element.id === 'hoverButtons' ||
                          element.id === 'validation-section';

    const isInsideValidationSection = validationSection && validationSection.contains(element);

    if (!isProtectedDiv && !isInsideValidationSection) {
      element.remove();
    }
  }
}
