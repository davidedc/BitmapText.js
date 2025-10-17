// TIER 3 OPTIMIZATION: Default character set constant (204 characters)
// Shared by MetricsMinifier.js and MetricsExpander.js
// This is the sorted character set - generated using the same logic as character-set.js

// If generateCharacterSet exists (from character-set.js), use it
// Otherwise, generate inline using the same logic
const DEFAULT_CHARACTER_SET = (function() {
  // Check if character-set.js is already loaded
  if (typeof generateCharacterSet === 'function') {
    return generateCharacterSet();
  }

  // Otherwise, generate inline (same logic as character-set.js)
  const chars = [];

  // ASCII printable characters (32-126)
  for (let i = 32; i <= 126; i++) {
    chars.push(String.fromCharCode(i));
  }

  // CP-1252 printable characters
  const cp1252PrintableChars = [
    8364, // € Euro sign
    8230, // … Horizontal ellipsis
    8240, // ‰ Per mille sign
    8249, // ‹ Single left-pointing angle quotation
    381,  // Ž Latin capital letter Z with caron
    8217, // ' Right single quotation mark (curly apostrophe)
    8226, // • Bullet
    8212, // — Em dash
    8482, // ™ Trade mark sign
    353,  // š Latin small letter s with caron
    8250, // › Single right-pointing angle quotation
    339,  // œ Latin small ligature oe
    382,  // ž Latin small letter z with caron
    376   // Ÿ Latin capital letter Y with diaeresis
  ];

  for (const code of cp1252PrintableChars) {
    chars.push(String.fromCharCode(code));
  }

  // Latin-1 Supplement characters (161-255), excluding soft hyphen (173)
  for (let i = 161; i <= 255; i++) {
    if (i !== 173) {
      chars.push(String.fromCharCode(i));
    }
  }

  // Add Full Block character
  chars.push('█');

  return chars.sort().join('');
})();
