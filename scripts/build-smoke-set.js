#!/usr/bin/env node

// build-smoke-set.js
//
// Builds a `font-assets-smoke-set` staging directory from an existing populated
// `font-assets/` directory by subsetting the metrics + positioning bundles down
// to the fonts listed in a spec JSON, and copying the matching QOI atlas .js
// wrappers verbatim. Companion to `publish-font-assets.sh`.
//
// Why subset existing bundles instead of re-rendering via the font-asset
// builder?
//   - The atlas .js files in the smoke set are byte-identical to the ones in
//     the contemporaneous full-set release. An embedder dropping smoke files
//     into a populated font-assets/ directory gets zero conflicts.
//   - No Playwright/WebKit dependency just to re-produce glyphs we already have.
//   - The subset bundles are derived deterministically from the same source
//     records, so the smoke set is provably a literal subset of the full set.
//
// Bundle envelope (both metrics and positioning):
//   `{ formatVersion, [density,] records: [...] }` → JSON → deflate-raw → base64
//   → wrapped as `BitmapText.rBundle('<b64>')` / `BitmapText.pBundle(d,'<b64>')`.
//
// Each record is keyed by `(fontFamily, styleIdx, weightIdx, fontSize)`.
// Encoding mirrors the producer in src/automation/export-font-data.js but uses
// Node's `zlib.deflateRawSync` instead of the browser-only CompressionStream.
// `BundleCodec.decodeBundle` is the inverse and already works in Node via its
// `zlib.inflateRawSync` fallback.
//
// Usage:
//   node scripts/build-smoke-set.js \
//     --spec=font-sets/smoke-set.json \
//     --source-dir=font-assets \
//     --output-dir=/tmp/smoke-set-staging
//
// Fails loudly if any font in the spec is missing from the source bundles or
// has no matching atlas .js file — the smoke set is supposed to be complete
// and self-contained.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PROJECT_ROOT = path.resolve(__dirname, '..');

// -----------------------------------------------------------------------------
// Args
// -----------------------------------------------------------------------------

function getArg(name, fallback) {
  const eq = process.argv.find(a => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const specPath = path.resolve(getArg('spec', path.join(PROJECT_ROOT, 'font-sets/smoke-set.json')));
const sourceDir = path.resolve(getArg('source-dir', path.join(PROJECT_ROOT, 'font-assets')));
const outputDir = path.resolve(getArg('output-dir', ''));

if (!outputDir) {
  console.error('build-smoke-set.js: --output-dir is required');
  process.exit(2);
}
if (!fs.existsSync(specPath)) {
  console.error(`build-smoke-set.js: spec file not found: ${specPath}`);
  process.exit(2);
}
if (!fs.existsSync(sourceDir)) {
  console.error(`build-smoke-set.js: source-dir not found: ${sourceDir}`);
  process.exit(2);
}

// -----------------------------------------------------------------------------
// Spec → wanted-tuples expansion
// -----------------------------------------------------------------------------

const STYLE_TO_IDX = { normal: 0, italic: 1, oblique: 2 };
// Mirror of _parametersToIDString's weight handling: 'normal' → 0, 'bold' → 1,
// numeric strings/numbers pass through as-is. Smoke set only uses normal+bold,
// but keep the door open in case the spec ever names a numeric weight.
function weightToIdx(w) {
  if (w === 'normal') return 0;
  if (w === 'bold') return 1;
  const n = Number(w);
  if (!Number.isFinite(n)) throw new Error(`Unsupported weight in spec: ${w}`);
  return n;
}

// idString helper — replica of BitmapText._parametersToIDString.
function idStringFor(density, family, styleIdx, weightIdx, size) {
  const style = styleIdx === 0 ? 'normal' : styleIdx === 1 ? 'italic' : 'oblique';
  const weight = weightIdx === 0 ? 'normal' : weightIdx === 1 ? 'bold' : String(weightIdx);
  const fmt = (n) => {
    const s = String(n);
    return s.includes('.') ? s.replace('.', '-') : `${s}-0`;
  };
  return `density-${fmt(density)}-${family}-style-${style}-weight-${weight}-size-${fmt(size)}`;
}

const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
if (!Array.isArray(spec.fontSets) || spec.fontSets.length === 0) {
  console.error('build-smoke-set.js: spec has no fontSets');
  process.exit(2);
}

// Cross-product expansion. Key shape: density|family|styleIdx|weightIdx|size.
// We also collect a per-density wanted set for the per-density positioning bundles.
const wantedByDensity = new Map();   // density → Set("family|styleIdx|weightIdx|size")
const wantedMetrics = new Set();     // "family|styleIdx|weightIdx|size"
const wantedAtlases = [];            // {density, family, styleIdx, weightIdx, size, idString}

for (const set of spec.fontSets) {
  for (const density of set.density) {
    for (const family of set.families) {
      for (const style of set.styles) {
        const styleIdx = STYLE_TO_IDX[style];
        if (styleIdx === undefined) throw new Error(`Unknown style: ${style}`);
        for (const weight of set.weights) {
          const weightIdx = weightToIdx(weight);
          for (const size of set.sizes) {
            const key = `${family}|${styleIdx}|${weightIdx}|${size}`;
            wantedMetrics.add(key);
            if (!wantedByDensity.has(density)) wantedByDensity.set(density, new Set());
            wantedByDensity.get(density).add(key);
            wantedAtlases.push({
              density, family, styleIdx, weightIdx, size,
              idString: idStringFor(density, family, styleIdx, weightIdx, size),
            });
          }
        }
      }
    }
  }
}

// -----------------------------------------------------------------------------
// Bundle subset helpers
// -----------------------------------------------------------------------------

function extractRBundleB64(file) {
  const src = fs.readFileSync(file, 'utf8');
  const m = src.match(/rBundle\(\s*['"]([A-Za-z0-9+/=]+)['"]\s*\)/);
  if (!m) throw new Error(`Could not extract rBundle base64 from ${file}`);
  return m[1];
}

function extractPBundle(file) {
  const src = fs.readFileSync(file, 'utf8');
  const m = src.match(/pBundle\(\s*([0-9.]+)\s*,\s*['"]([A-Za-z0-9+/=]+)['"]\s*\)/);
  if (!m) throw new Error(`Could not extract pBundle base64 from ${file}`);
  return { density: parseFloat(m[1]), b64: m[2] };
}

function decodeBundleB64(b64) {
  const buf = zlib.inflateRawSync(Buffer.from(b64, 'base64'));
  return JSON.parse(buf.toString('utf8'));
}

function encodeBundleObj(obj) {
  const json = JSON.stringify(obj);
  const def = zlib.deflateRawSync(Buffer.from(json, 'utf8'), { level: 9 });
  return def.toString('base64');
}

function recordKey([family, styleIdx, weightIdx, size]) {
  return `${family}|${styleIdx}|${weightIdx}|${size}`;
}

// -----------------------------------------------------------------------------
// Stage output dir
// -----------------------------------------------------------------------------

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

const summary = { metricsRecords: 0, positioningFiles: [], atlases: [], missing: [] };

// --- Metrics bundle subset (density-agnostic) -------------------------------

const metricsSrcFile = path.join(sourceDir, 'metrics-bundle.js');
if (!fs.existsSync(metricsSrcFile)) {
  console.error(`build-smoke-set.js: source metrics bundle missing: ${metricsSrcFile}`);
  process.exit(2);
}
const metricsEnv = decodeBundleB64(extractRBundleB64(metricsSrcFile));
const metricsKept = metricsEnv.records.filter(r => wantedMetrics.has(recordKey(r)));

// Verify completeness — every wanted metrics tuple must be present in the source bundle.
{
  const foundKeys = new Set(metricsKept.map(recordKey));
  for (const k of wantedMetrics) {
    if (!foundKeys.has(k)) summary.missing.push(`metrics: ${k}`);
  }
}
summary.metricsRecords = metricsKept.length;

const metricsSubsetB64 = encodeBundleObj({
  formatVersion: metricsEnv.formatVersion,
  records: metricsKept,
});
fs.writeFileSync(
  path.join(outputDir, 'metrics-bundle.js'),
  `BitmapText.rBundle('${metricsSubsetB64}');\n`
);

// --- Positioning bundles subset (one per density in spec) -------------------

for (const [density, wantedAtThisDensity] of wantedByDensity) {
  const posSrcFile = path.join(sourceDir, `positioning-bundle-density-${density}.js`);
  if (!fs.existsSync(posSrcFile)) {
    summary.missing.push(`positioning-bundle for density ${density}`);
    continue;
  }
  const { density: bundleDensity, b64 } = extractPBundle(posSrcFile);
  if (bundleDensity !== density) {
    console.error(`build-smoke-set.js: density mismatch in ${posSrcFile} (got ${bundleDensity}, expected ${density})`);
    process.exit(2);
  }
  const posEnv = decodeBundleB64(b64);
  const posKept = posEnv.records.filter(r => wantedAtThisDensity.has(recordKey(r)));
  {
    const foundKeys = new Set(posKept.map(recordKey));
    for (const k of wantedAtThisDensity) {
      if (!foundKeys.has(k)) summary.missing.push(`positioning d=${density}: ${k}`);
    }
  }
  const posSubsetB64 = encodeBundleObj({
    formatVersion: posEnv.formatVersion,
    density: posEnv.density,
    records: posKept,
  });
  const outName = `positioning-bundle-density-${density}.js`;
  fs.writeFileSync(
    path.join(outputDir, outName),
    `BitmapText.pBundle(${posEnv.density},'${posSubsetB64}');\n`
  );
  summary.positioningFiles.push({ name: outName, records: posKept.length });
}

// --- Atlas .js wrappers (copied verbatim) -----------------------------------

for (const a of wantedAtlases) {
  const fname = `atlas-${a.idString}-qoi.js`;
  const src = path.join(sourceDir, fname);
  if (!fs.existsSync(src)) {
    summary.missing.push(`atlas .js: ${fname}`);
    continue;
  }
  fs.copyFileSync(src, path.join(outputDir, fname));
  summary.atlases.push(fname);
}

// --- Spec JSON (self-description) -------------------------------------------

fs.copyFileSync(specPath, path.join(outputDir, 'smoke-set.json'));

// -----------------------------------------------------------------------------
// Report
// -----------------------------------------------------------------------------

if (summary.missing.length) {
  console.error('build-smoke-set.js: missing items in source font-assets/:');
  for (const m of summary.missing) console.error(`  - ${m}`);
  console.error('Aborting — the smoke set must be complete. Rebuild font-assets/ first.');
  process.exit(1);
}

const sizes = fs.readdirSync(outputDir).map(f => {
  const full = path.join(outputDir, f);
  return { name: f, bytes: fs.statSync(full).size };
});
sizes.sort((a, b) => a.name.localeCompare(b.name));
const totalBytes = sizes.reduce((s, x) => s + x.bytes, 0);

console.log('=== Smoke set staged ===');
console.log(`  Spec        : ${specPath}`);
console.log(`  Source dir  : ${sourceDir}`);
console.log(`  Output dir  : ${outputDir}`);
console.log(`  Metrics     : ${summary.metricsRecords} record(s)`);
for (const p of summary.positioningFiles) {
  console.log(`  Positioning : ${p.name} (${p.records} record(s))`);
}
console.log(`  Atlases     : ${summary.atlases.length} file(s)`);
console.log('');
console.log('Files:');
for (const s of sizes) {
  console.log(`  ${s.name.padEnd(72)} ${String(s.bytes).padStart(8)} bytes`);
}
console.log(`  ${'TOTAL'.padEnd(72)} ${String(totalBytes).padStart(8)} bytes`);
