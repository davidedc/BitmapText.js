function setupGlyphUI_Full() {
    const selectorsDiv = document.getElementById("selectors");
    const copyToClipboardButton = createElement('button', 'copy-to-clipboard-button', 'Copy collected hashes to clipboard', selectorsDiv);
    copyToClipboardButton.addEventListener('click', () => hashStore.copyHashesToClipboard());
}

  setupGlyphUI_Full();