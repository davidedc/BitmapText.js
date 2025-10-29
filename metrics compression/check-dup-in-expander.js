// Check for duplicate in MetricsExpander's DEFAULT_CHARACTER_SET
const fs = require('fs');

// Load and eval the expander to get the constant
const expanderCode = fs.readFileSync('src/builder/MetricsExpander.js', 'utf8');
eval(expanderCode);

// Now DEFAULT_CHARACTER_SET should be available (but not in global scope due to const)
// We need to extract it differently

// Read the line and manually parse it
const lines = expanderCode.split('\n');
const defLine = lines.find(l => l.includes('const DEFAULT_CHARACTER_SET'));

console.log('Line found:', defLine ? 'YES' : 'NO');

if (defLine) {
  // Extract the string value - use JSON.parse to properly handle escape sequences
  const match = defLine.match(/= (".*");/);
  if (match) {
    const cs = JSON.parse(match[1]);  // Properly parse escape sequences
    console.log('String length:', cs.length);
    console.log('Array.from length:', Array.from(cs).length);

    const chars = Array.from(cs);
    const unique = new Set(chars);
    console.log('Unique characters:', unique.size);

    if (chars.length !== unique.size) {
      console.log('\n🔍 DUPLICATE FOUND!');
      const seen = {};
      for (let i = 0; i < chars.length; i++) {
        const char = chars[i];
        if (seen[char] !== undefined) {
          console.log(`Duplicate: '${char}' (code ${char.charCodeAt(0)})`);
          console.log(`  First occurrence: index ${seen[char]}`);
          console.log(`  Second occurrence: index ${i}`);
        } else {
          seen[char] = i;
        }
      }
    }
  }
}
