const fs = require('fs');

// Generate DEFAULT_CHARACTER_SET inline
function generateCharacterSet() {
  const chars = [];
  for (let i = 32; i <= 126; i++) chars.push(String.fromCharCode(i));
  const cp1252 = [8364, 8230, 8240, 8249, 381, 8217, 8226, 8212, 8482, 353, 8250, 339, 382, 376];
  for (const code of cp1252) chars.push(String.fromCharCode(code));
  for (let i = 161; i <= 255; i++) if (i !== 173) chars.push(String.fromCharCode(i));
  chars.push('█');
  return chars.sort().join('');
}

const DEFAULT_CHARACTER_SET = generateCharacterSet();

// Load the metrics file
const file = fs.readFileSync('font-assets/metrics-density-1-0-Arial-style-normal-weight-normal-size-18-5.js', 'utf8');
const match = file.match(/registerMetrics\([^,]+,\s*(\{.+\})\)/);

if (match) {
  const data = JSON.parse(match[1]);

  console.log('DEFAULT_CHARACTER_SET length:', DEFAULT_CHARACTER_SET.length);
  console.log('File c field length:', data.c.length);
  console.log('File g array length:', data.g.length);
  console.log('Match:', data.c === DEFAULT_CHARACTER_SET);

  if (data.c !== DEFAULT_CHARACTER_SET) {
    console.log('\n❌ MISMATCH DETECTED\n');

    const defaultChars = Array.from(DEFAULT_CHARACTER_SET);
    const fileChars = Array.from(data.c);

    // Find all differences
    let diffs = 0;
    for (let i = 0; i < Math.max(defaultChars.length, fileChars.length); i++) {
      if (defaultChars[i] !== fileChars[i]) {
        diffs++;
        if (diffs <= 5) {
          console.log(`Diff at index ${i}:`);
          console.log(`  DEFAULT: ${JSON.stringify(defaultChars[i])} code ${defaultChars[i]?.charCodeAt(0)}`);
          console.log(`  File:    ${JSON.stringify(fileChars[i])} code ${fileChars[i]?.charCodeAt(0)}`);
        }
      }
    }
    console.log(`\nTotal differences: ${diffs}`);

    // Check for duplicates in file's c field
    const fileSet = new Set(fileChars);
    if (fileSet.size !== fileChars.length) {
      console.log(`\n⚠️  File c field has duplicates: ${fileChars.length} chars, ${fileSet.size} unique`);
    }
  } else {
    console.log('\n✅ File c field matches DEFAULT_CHARACTER_SET exactly');
  }
}
