const DEFAULT_CHARACTER_SET = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~¡¢£¤¥¦§¨©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿœšŸŽž—\u2019•…‰‹›€™█";

console.log('String length:', DEFAULT_CHARACTER_SET.length);
console.log('Unique chars:', new Set(DEFAULT_CHARACTER_SET).size);

const chars = Array.from(DEFAULT_CHARACTER_SET);
const seen = {};
const duplicates = [];

for (let i = 0; i < chars.length; i++) {
  const char = chars[i];
  if (seen[char] !== undefined) {
    duplicates.push({char, firstIndex: seen[char], dupIndex: i, code: char.charCodeAt(0)});
  } else {
    seen[char] = i;
  }
}

if (duplicates.length > 0) {
  console.log('\nDuplicates found:');
  for (const dup of duplicates) {
    console.log(`  Character '${dup.char}' (code ${dup.code}) appears at index ${dup.firstIndex} and ${dup.dupIndex}`);
  }
} else {
  console.log('\nNo duplicates found!');
}

// Check what happens when used as object keys
const obj = {};
for (let i = 0; i < chars.length; i++) {
  obj[chars[i]] = i;
}
console.log(`\nObject keys count: ${Object.keys(obj).length}`);
console.log(`Missing: ${DEFAULT_CHARACTER_SET.length - Object.keys(obj).length} characters`);

if (Object.keys(obj).length < DEFAULT_CHARACTER_SET.length) {
  // Find which characters are missing
  const objKeys = Object.keys(obj);
  console.log(`\nChecking which characters did not make it as object keys...`);
  for (let i = 0; i < chars.length; i++) {
    if (!objKeys.includes(chars[i])) {
      console.log(`  Missing: char at index ${i} (code ${chars[i].charCodeAt(0)})`);
    }
  }
}
