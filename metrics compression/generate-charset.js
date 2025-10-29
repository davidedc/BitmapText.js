// Generate the correct DEFAULT_CHARACTER_SET
function generateCharacterSet() {
  const chars = [];

  // ASCII printable characters (32-126)
  for (let i = 32; i <= 126; i++) {
    chars.push(String.fromCharCode(i));
  }

  // CP-1252 printable characters
  const cp1252PrintableChars = [
    8364, 8230, 8240, 8249, 381, 8217, 8226, 8212, 8482, 353, 8250, 339, 382, 376
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
}

const cs = generateCharacterSet();
console.log('Generated character set');
console.log('Length:', cs.length);
const arr = Array.from(cs);
console.log('Array.from length:', arr.length);
console.log('Unique:', new Set(arr).size);

// Check for duplicates
const seen = {};
const dups = [];
for (let i = 0; i < arr.length; i++) {
  if (seen[arr[i]] !== undefined) {
    dups.push({char: arr[i], code: arr[i].charCodeAt(0), first: seen[arr[i]], second: i});
  } else {
    seen[arr[i]] = i;
  }
}

if (dups.length > 0) {
  console.log('\n⚠️  DUPLICATES FOUND:');
  for (const d of dups) {
    console.log(`  Char '${d.char}' (code ${d.code}) at indices ${d.first} and ${d.second}`);
  }
} else {
  console.log('\n✅ No duplicates');
}

console.log('\nFor copy-paste into source code:');
console.log('const DEFAULT_CHARACTER_SET = ' + JSON.stringify(cs) + ';');
