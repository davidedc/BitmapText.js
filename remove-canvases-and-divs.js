function removeAllCanvasesAndDivs() {
    const canvases = document.querySelectorAll('canvas');
    for (let i = 0; i < canvases.length; i++) {
      canvases[i].remove();
    }
    const divs = document.querySelectorAll('div');
    for (let i = 0; i < divs.length; i++) {
      // remove all divs that don't have the id "selectors"
      if (divs[i].id !== 'selectors' && divs[i].id !== 'testCopyCanvases' && divs[i].id !== 'hoverButtons')
        divs[i].remove();
    }
  }
