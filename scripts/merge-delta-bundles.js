#!/usr/bin/env node

// merge-delta-bundles.js <staging-dir>
//
// Helper for merge-delta-build.sh. Reads existing font-assets/ bundles and the
// delta bundles in <staging-dir>, then for each family that appears in the
// delta:
//   - drops all records of that family from the existing bundle
//   - appends the delta's records for that family
// and writes the merged bundle back.
//
// Auto-detects the affected families from the delta — no need to spell them
// out on the command line. Lets you regenerate one or more families (e.g.
// after a spec change) without rebuilding every other family's atlases.

const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const stagingDir = process.argv[2];
if (!stagingDir) {
  console.error('Usage: merge-delta-bundles.js <staging-dir>');
  process.exit(1);
}

function decode(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  const m = code.match(/'([^']+)'/);
  if (!m) throw new Error(`Could not parse base64 from ${filePath}`);
  const buf = Buffer.from(m[1], 'base64');
  return JSON.parse(zlib.inflateRawSync(buf).toString('utf8'));
}

function encode(envelope, wrapPrefix, outPath) {
  const json = JSON.stringify(envelope);
  const compressed = zlib.deflateRawSync(Buffer.from(json, 'utf8'), { level: 9 });
  fs.writeFileSync(outPath, `${wrapPrefix}'${compressed.toString('base64')}');\n`);
}

const bundleSort = (a, b) => {
  if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
  if (a[1] !== b[1]) return a[1] - b[1];
  const aw = typeof a[2] === 'number' ? a[2] : 0;
  const bw = typeof b[2] === 'number' ? b[2] : 0;
  if (aw !== bw) return aw - bw;
  return a[3] - b[3];
};

// Record key: (family, styleIdx, weightIdx, size). The whole 4-tuple — NOT
// just family — so a delta covering "Arial sizes 85-96" replaces only those
// 12 sizes, not all of Arial. (Earlier version of this script used family-only
// keys and dropped 600+ records per family on a 23-size delta.)
const recordKey = (r) => `${r[0]}|${r[1]}|${r[2]}|${r[3]}`;

function mergeBundle(existingPath, deltaPath, wrapPrefix, density) {
  if (!fs.existsSync(deltaPath)) return null;
  if (!fs.existsSync(existingPath)) {
    console.log(`  ${path.basename(existingPath)}: existing bundle missing, copying delta as-is`);
    fs.copyFileSync(deltaPath, existingPath);
    return null;
  }
  const existing = decode(existingPath);
  const delta = decode(deltaPath);
  const deltaKeys = new Set(delta.records.map(recordKey));
  const deltaFamilies = new Set(delta.records.map(r => r[0]));
  const before = existing.records.length;
  const filtered = existing.records.filter(r => !deltaKeys.has(recordKey(r)));
  const dropped = before - filtered.length;
  const merged = filtered.concat(delta.records).sort(bundleSort);
  const envelope = density != null
    ? { formatVersion: existing.formatVersion, density, records: merged }
    : { formatVersion: existing.formatVersion, records: merged };
  encode(envelope, wrapPrefix, existingPath);
  console.log(
    `  ${path.basename(existingPath)}: ${before} → ${merged.length} records ` +
    `(replaced ${dropped} exact-key matches in {${[...deltaFamilies].join(', ')}}, added ${delta.records.length})`
  );
  return deltaFamilies;
}

// Metrics bundle (density-agnostic)
const families = mergeBundle(
  'font-assets/metrics-bundle.js',
  path.join(stagingDir, 'metrics-bundle.js'),
  'BitmapText.rBundle('
);

// Per-density positioning bundles. Iterate any density we find a delta for.
for (const f of fs.readdirSync(stagingDir)) {
  const m = f.match(/^positioning-bundle-density-(.+)\.js$/);
  if (!m) continue;
  const density = parseFloat(m[1]);
  mergeBundle(
    `font-assets/positioning-bundle-density-${m[1]}.js`,
    path.join(stagingDir, f),
    `BitmapText.pBundle(${density},`,
    density
  );
}

if (families && families.size > 0) {
  console.log(`Merged delta covering ${families.size} family/families: ${[...families].join(', ')}`);
}
