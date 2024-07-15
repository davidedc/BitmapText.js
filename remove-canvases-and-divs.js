function removeAllCanvasesAndDivs() {
  
  // remove all the canvases
  const canvases = document.querySelectorAll('canvas');
  for (const element of canvases) {
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
  
  // remove all other divs apart from a couple
  const divs = document.querySelectorAll('div');
  for (const element of divs) {
    // remove all divs that don't have the id "selectors"
    if (element.id !== 'selectors' && element.id !== 'testCopyCanvases' && element.id !== 'hoverButtons')
      element.remove();
  }
}
