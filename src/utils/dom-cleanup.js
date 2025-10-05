function removeAllCanvasesAndDivs() {

  // remove all the canvases EXCEPT atlas section canvases
  const atlasSection = document.getElementById('atlas-section');
  const canvases = document.querySelectorAll('canvas');
  for (const element of canvases) {
    // Skip atlas section canvases (inside atlas-section div)
    if (atlasSection && atlasSection.contains(element)) {
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

  // remove all other divs apart from a couple (including atlas-section and its children)
  const divs = document.querySelectorAll('div');
  // atlasSection already declared above

  for (const element of divs) {
    // Skip protected divs and their descendants
    const isProtectedDiv = element.id === 'selectors' ||
                          element.id === 'testCopyCanvases' ||
                          element.id === 'hoverButtons' ||
                          element.id === 'atlas-section';

    const isInsideAtlasSection = atlasSection && atlasSection.contains(element);

    if (!isProtectedDiv && !isInsideAtlasSection) {
      element.remove();
    }
  }
}
