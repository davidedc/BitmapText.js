#!/usr/bin/env node

// capture-metrics-baseline.js
//
// Captures a snapshot of every materialised FontMetrics object as it stands today
// (per-file metrics loader, density-aware, baseline[5] = pixelDensity in bundle data).
// The snapshot is the truth source for byte-identical verification once the
// per-file loader is replaced by the metrics-bundle loader.
//
// Outputs:
//   /tmp/bitmaptext-metrics-baseline.json    canonical per-font JSON dump
//   /tmp/bitmaptext-metrics-baseline.sha256  one-line hash for quick comparison

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const RUNTIME_BUNDLE = path.join(PROJECT_ROOT, 'dist', 'bitmaptext-node.min.js');
const FONT_REGISTRY = path.join(PROJECT_ROOT, 'font-assets', 'font-registry.js');
const FONT_ASSETS_DIR = path.join(PROJECT_ROOT, 'font-assets');

const OUT_JSON = '/tmp/bitmaptext-metrics-baseline.json';
const OUT_HASH = '/tmp/bitmaptext-metrics-baseline.sha256';

// Build a sandbox the runtime + asset files share.
const sandbox = { console, Buffer, require, process, setTimeout, clearTimeout };
sandbox.global = sandbox;
sandbox.globalThis = sandbox;

const ctx = vm.createContext(sandbox);

function runInCtx(code, filename) {
  vm.runInContext(code, ctx, { filename });
}

// 1. Load the runtime bundle + the manifest.
runInCtx(fs.readFileSync(RUNTIME_BUNDLE, 'utf8'), RUNTIME_BUNDLE);
runInCtx(fs.readFileSync(FONT_REGISTRY, 'utf8'), FONT_REGISTRY);

const allIds = vm.runInContext('FontManifest.allFontIDsSorted()', ctx);
console.error(`[baseline] FontManifest reports ${allIds.length} font IDs`);

// 2. Load each metrics file directly into the same context (bypass the async
//    loader; we just want the registration side effect).
let loaded = 0;
let failed = 0;
for (const id of allIds) {
  const filePath = path.join(FONT_ASSETS_DIR, `metrics-${id}.js`);
  try {
    runInCtx(fs.readFileSync(filePath, 'utf8'), filePath);
    loaded++;
  } catch (e) {
    failed++;
    console.error(`[baseline] FAILED ${id}: ${e.message}`);
  }
  if (loaded % 500 === 0) console.error(`[baseline] loaded ${loaded}/${allIds.length}`);
}
console.error(`[baseline] loaded ${loaded}, failed ${failed}`);

// 3. Pull every materialised FontMetrics out of FontMetricsStore.
//    For each (idString), build a canonical JSON record. Sort keys at every level
//    so the output is reproducible.
function canonicalise(value) {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = canonicalise(value[k]);
    return out;
  }
  if (typeof value === 'number') {
    // Round-trip through Number to normalise -0 / +0 and NaN representation.
    if (Object.is(value, -0)) return 0;
  }
  return value;
}

const records = [];
for (const id of allIds) {
  const fp = vm.runInContext(`FontProperties.fromIDString(${JSON.stringify(id)})`, ctx);
  const fm = vm.runInContext(`FontMetricsStore.getFontMetrics(FontProperties.fromIDString(${JSON.stringify(id)}))`, ctx);
  if (!fm) {
    records.push({ id, missing: true });
    continue;
  }
  records.push({
    id,
    kerningTable: canonicalise(fm._kerningTable),
    characterMetrics: canonicalise(fm._characterMetrics),
    spaceAdvancementOverride: fm._spaceAdvancementOverride === undefined ? null : fm._spaceAdvancementOverride,
  });
}

// Sort records by id for determinism.
records.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

// 4. Write JSON dump (newline-separated for easy diffing) and hash it.
const stream = fs.createWriteStream(OUT_JSON);
stream.write('[\n');
for (let i = 0; i < records.length; i++) {
  stream.write(JSON.stringify(records[i]));
  stream.write(i + 1 === records.length ? '\n' : ',\n');
}
stream.write(']\n');
stream.end();

stream.on('finish', () => {
  const buf = fs.readFileSync(OUT_JSON);
  const h = crypto.createHash('sha256').update(buf).digest('hex');
  fs.writeFileSync(OUT_HASH, `${h}  ${path.basename(OUT_JSON)}\n`);
  console.error(`[baseline] wrote ${OUT_JSON} (${buf.length} bytes)`);
  console.error(`[baseline] sha256 = ${h}`);
  console.error(`[baseline] records: ${records.length}, missing: ${records.filter(r => r.missing).length}`);
});
