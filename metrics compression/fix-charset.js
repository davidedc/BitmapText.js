const fs = require('fs');

// The correct character set
const CORRECT_CS = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~¡¢£¤¥¦§¨©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿœšŸŽž—'•…‰‹›€™█";

console.log('Correct CS length:', CORRECT_CS.length);
console.log('Correct CS unique:', new Set(CORRECT_CS).size);

// Fix MetricsExpander.js
let expanderContent = fs.readFileSync('src/builder/MetricsExpander.js', 'utf8');
const expanderLines = expanderContent.split('\n');
for (let i = 0; i < expanderLines.length; i++) {
  if (expanderLines[i].includes('const DEFAULT_CHARACTER_SET = ')) {
    expanderLines[i] = `const DEFAULT_CHARACTER_SET = ${JSON.stringify(CORRECT_CS)};`;
    console.log('✅ Updated MetricsExpander.js line', i + 1);
    break;
  }
}
fs.writeFileSync('src/builder/MetricsExpander.js', expanderLines.join('\n'));

// Fix MetricsMinifier.js
let minifierContent = fs.readFileSync('src/builder/MetricsMinifier.js', 'utf8');
const minifierLines = minifierContent.split('\n');
for (let i = 0; i < minifierLines.length; i++) {
  if (minifierLines[i].includes('const DEFAULT_CHARACTER_SET = ')) {
    minifierLines[i] = `const DEFAULT_CHARACTER_SET = ${JSON.stringify(CORRECT_CS)};`;
    console.log('✅ Updated MetricsMinifier.js line', i + 1);
    break;
  }
}
fs.writeFileSync('src/builder/MetricsMinifier.js', minifierLines.join('\n'));

console.log('\n✅ Both files updated with correct DEFAULT_CHARACTER_SET');
