function removeAllCanvasesAndDivs() {
  
  // remove all the canvases
  const canvases = document.querySelectorAll('canvas');
  for (let i = 0; i < canvases.length; i++) {
    // do this special sort of cleanup so to hopefully hand-hold the garbage collector
    // resize the canvas to zero so that it doesn't take up any space
    canvases[i].width = 0;
    canvases[i].height = 0;
    // then remove it
    canvases[i].remove();
  }
  
  // remove all the contents of the testCopyCanvases div (which were mostly canvases cleaned up above)
  const testCopyCanvases = document.getElementById('testCopyCanvases');
  while (testCopyCanvases.firstChild) {
    testCopyCanvases.removeChild(testCopyCanvases.firstChild);
  }
  
  // remove all other divs apart from a couple
  const divs = document.querySelectorAll('div');
  for (let i = 0; i < divs.length; i++) {
    // remove all divs that don't have the id "selectors"
    if (divs[i].id !== 'selectors' && divs[i].id !== 'testCopyCanvases' && divs[i].id !== 'hoverButtons')
      divs[i].remove();
  }
}
