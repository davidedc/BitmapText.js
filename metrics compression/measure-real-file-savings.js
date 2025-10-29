/**
 * Measure compression savings on real font files
 * Compares existing files with re-compressed versions using two-dimensional compression
 */

const fs = require('fs');

// Generate DEFAULT_CHARACTER_SET inline
function generateDefaultCharacterSet() {
  const chars = [];
  for (let i = 32; i <= 126; i++) chars.push(String.fromCharCode(i));
  const cp1252 = [8364, 8230, 8240, 8249, 381, 8217, 8226, 8212, 8482, 353, 8250, 339, 382, 376];
  for (const code of cp1252) chars.push(String.fromCharCode(code));
  for (let i = 161; i <= 255; i++) if (i !== 173) chars.push(String.fromCharCode(i));
  chars.push('█');
  return chars.sort().join('');
}

const DEFAULT_CHARACTER_SET = generateDefaultCharacterSet();

// Load classes
const minifierCode = fs.readFileSync('src/builder/MetricsMinifier.js', 'utf8');
const expanderCode = fs.readFileSync('src/builder/MetricsExpander.js', 'utf8');
const fontMetricsCode = fs.readFileSync('src/runtime/FontMetrics.js', 'utf8');

eval(fontMetricsCode + '\nglobalThis.FontMetrics = FontMetrics;');
eval(minifierCode + '\nglobalThis.MetricsMinifier = MetricsMinifier;');
eval(expanderCode + '\nglobalThis.MetricsExpander = MetricsExpander;');

const { FontMetrics, MetricsMinifier, MetricsExpander } = globalThis;

console.log('✓ Dependencies loaded\n');

// Load and analyze a real font file with kerning data
const fontFile = 'font-assets/metrics-density-1-0-Arial-style-normal-weight-normal-size-19-0.js';
const fontCode = fs.readFileSync(fontFile, 'utf8');

// Extract the minified data from the file
const match = fontCode.match(/registerMetrics\([^,]+,\s*(\{.+\})\)/);
if (!match) {
  console.error('❌ Could not parse font file');
  process.exit(1);
}

const oldMinified = JSON.parse(match[1]);

console.log('📂 File:', fontFile);
console.log('📊 Original minified data:');
console.log(`   - File size: ${fontCode.length} bytes`);
console.log(`   - Minified JSON size: ${JSON.stringify(oldMinified).length} bytes`);
console.log(`   - Kerning table size: ${JSON.stringify(oldMinified.k).length} bytes`);

// Count kerning entries and ranges in old version
let oldLeftEntries = 0;
let oldRightEntries = 0;
let oldLeftRanges = 0;
let oldRightRanges = 0;

for (const [leftKey, pairs] of Object.entries(oldMinified.k)) {
  oldLeftEntries++;
  if (leftKey.includes('-') && leftKey.length >= 3) {
    oldLeftRanges++;
  }

  for (const rightKey of Object.keys(pairs)) {
    oldRightEntries++;
    if (rightKey.includes('-') && rightKey.length >= 3) {
      oldRightRanges++;
    }
  }
}

console.log(`   - Left entries: ${oldLeftEntries} (${oldLeftRanges} ranges)`);
console.log(`   - Right entries: ${oldRightEntries} (${oldRightRanges} ranges)`);

// Expand the font data
console.log('\n🔼 Expanding...');
const expanded = MetricsExpander.expand(oldMinified);
const expandedData = {
  kerningTable: expanded._kerningTable,
  characterMetrics: expanded._characterMetrics,
  spaceAdvancementOverrideForSmallSizesInPx: oldMinified.s
};

// Count expanded kerning pairs
let totalKerningPairs = 0;
for (const pairs of Object.values(expandedData.kerningTable)) {
  totalKerningPairs += Object.keys(pairs).length;
}

console.log(`   - Characters: ${Object.keys(expandedData.characterMetrics).length}`);
console.log(`   - Total kerning pairs: ${totalKerningPairs}`);

// Re-minify with new two-dimensional compression
console.log('\n🔽 Re-minifying with two-dimensional compression...');
const newMinified = MetricsMinifier.minify(expandedData);

console.log('📊 New minified data:');
console.log(`   - Minified JSON size: ${JSON.stringify(newMinified).length} bytes`);
console.log(`   - Kerning table size: ${JSON.stringify(newMinified.k).length} bytes`);

// Count kerning entries and ranges in new version
let newLeftEntries = 0;
let newRightEntries = 0;
let newLeftRanges = 0;
let newRightRanges = 0;

for (const [leftKey, pairs] of Object.entries(newMinified.k)) {
  newLeftEntries++;
  if (leftKey.includes('-') && leftKey.length >= 3) {
    newLeftRanges++;
  }

  for (const rightKey of Object.keys(pairs)) {
    newRightEntries++;
    if (rightKey.includes('-') && rightKey.length >= 3) {
      newRightRanges++;
    }
  }
}

console.log(`   - Left entries: ${newLeftEntries} (${newLeftRanges} ranges)`);
console.log(`   - Right entries: ${newRightEntries} (${newRightRanges} ranges)`);

// Calculate savings
const oldKerningSize = JSON.stringify(oldMinified.k).length;
const newKerningSize = JSON.stringify(newMinified.k).length;
const kerningBytes = oldKerningSize - newKerningSize;
const kerningPercent = ((kerningBytes / oldKerningSize) * 100).toFixed(1);

const oldJsonSize = JSON.stringify(oldMinified).length;
const newJsonSize = JSON.stringify(newMinified).length;
const totalBytes = oldJsonSize - newJsonSize;
const totalPercent = ((totalBytes / oldJsonSize) * 100).toFixed(1);

console.log('\n📏 Compression Improvements:');
console.log(`   Kerning table: ${oldKerningSize} → ${newKerningSize} bytes (saved ${kerningBytes} bytes, ${kerningPercent}%)`);
console.log(`   Total JSON:    ${oldJsonSize} → ${newJsonSize} bytes (saved ${totalBytes} bytes, ${totalPercent}%)`);

// Verify roundtrip
console.log('\n✓ Verifying roundtrip...');
const reExpanded = MetricsExpander.expand(newMinified);

let kerningMatch = true;
for (const [leftChar, pairs] of Object.entries(expandedData.kerningTable)) {
  if (!reExpanded._kerningTable[leftChar]) {
    console.log(`❌ Missing left char: ${leftChar}`);
    kerningMatch = false;
    continue;
  }

  for (const [rightChar, value] of Object.entries(pairs)) {
    const reExpandedValue = reExpanded._kerningTable[leftChar][rightChar];
    if (reExpandedValue !== value) {
      console.log(`❌ Kerning mismatch: ${leftChar}/${rightChar} expected ${value}, got ${reExpandedValue}`);
      kerningMatch = false;
    }
  }
}

if (kerningMatch) {
  console.log('✓ Roundtrip successful - data integrity verified');
} else {
  console.log('❌ Roundtrip failed - data corruption detected');
}

console.log('\n✅ Analysis complete!');

// Summary
if (newLeftRanges > oldLeftRanges) {
  console.log(`\n🎯 Two-dimensional compression created ${newLeftRanges - oldLeftRanges} new left-side ranges!`);
}
