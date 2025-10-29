const fs = require('fs');

// Load the character-set.js generation function
eval(fs.readFileSync('src/builder/character-set.js', 'utf8'));

// Generate using the authoritative function
const CORRECT_CS = generateCharacterSet();

console.log('✅ Generated from character-set.js');
console.log('   Length:', CORRECT_CS.length);
console.log('   Unique:', new Set(Array.from(CORRECT_CS)).size);

// Helper to properly escape the string for JavaScript source
function escapeForJS(str) {
  let result = JSON.stringify(str);
  // JSON.stringify turns \ into \\\\ (which becomes \\ in the output)
  // We need just \\ (which becomes \ in the output)
  // So replace \\\\ with \\
  result = result.replace(/\\\\\\\\/g, '\\\\');
  return result;
}

// Update MetricsExpander.js
let expanderContent = fs.readFileSync('src/builder/MetricsExpander.js', 'utf8');
const expanderLines = expanderContent.split('\n');
for (let i = 0; i < expanderLines.length; i++) {
  if (expanderLines[i].includes('const DEFAULT_CHARACTER_SET = ')) {
    expanderLines[i] = `const DEFAULT_CHARACTER_SET = ${escapeForJS(CORRECT_CS)};`;
    console.log('✅ Updated MetricsExpander.js line', i + 1);
    break;
  }
}
fs.writeFileSync('src/builder/MetricsExpander.js', expanderLines.join('\n'));

// Update MetricsMinifier.js
let minifierContent = fs.readFileSync('src/builder/MetricsMinifier.js', 'utf8');
const minifierLines = minifierContent.split('\n');
for (let i = 0; i < minifierLines.length; i++) {
  if (minifierLines[i].includes('const DEFAULT_CHARACTER_SET = ')) {
    minifierLines[i] = `const DEFAULT_CHARACTER_SET = ${escapeForJS(CORRECT_CS)};`;
    console.log('✅ Updated MetricsMinifier.js line', i + 1);
    break;
  }
}
fs.writeFileSync('src/builder/MetricsMinifier.js', minifierLines.join('\n'));

console.log('\n✅ Both files updated with authoritative character set from character-set.js');
