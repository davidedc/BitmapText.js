#!/usr/bin/env node

// verify-metrics-bundle.js
//
// Runs the same FontMetrics-snapshot logic as `capture-metrics-baseline.js`,
// but sources metrics from the new `metrics-bundle.js` via the new runtime
// (lazy materialisation through MetricsBundleStore + density injection).
//
// Compares the resulting SHA-256 against the baseline written previously.
// Exits non-zero on any divergence.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const RUNTIME_BUNDLE = path.join(PROJECT_ROOT, 'dist', 'bitmaptext-node.min.js');
const METRICS_BUNDLE = path.join(PROJECT_ROOT, 'font-assets', 'metrics-bundle.js');

const BASELINE_HASH_FILE = '/tmp/bitmaptext-metrics-baseline.sha256';
const OUT_JSON = '/tmp/bitmaptext-metrics-verify.json';
const OUT_HASH = '/tmp/bitmaptext-metrics-verify.sha256';

const sandbox = { console, Buffer, require, process, setTimeout, clearTimeout };
sandbox.global = sandbox;
sandbox.globalThis = sandbox;
const ctx = vm.createContext(sandbox);
function runInCtx(code, filename) { vm.runInContext(code, ctx, { filename }); }

(async () => {
  // 1. Load runtime bundle (defines BitmapText, FontMetricsStore, MetricsBundleStore, BundleCodec, FontLoader, ...).
  runInCtx(fs.readFileSync(RUNTIME_BUNDLE, 'utf8'), RUNTIME_BUNDLE);

  // 2. Eval the metrics bundle. This calls BitmapText.rBundle("<b64>") which kicks off
  //    async decoding and stores the promise on FontLoaderBase._bundleDecodePromise.
  runInCtx(fs.readFileSync(METRICS_BUNDLE, 'utf8'), METRICS_BUNDLE);

  // 3. Await the decode promise — it lives in the sandbox, so we extract it and await.
  const decodePromise = vm.runInContext('FontLoaderBase._bundleDecodePromise', ctx);
  if (!decodePromise) {
    console.error('[verify] FAIL: bundle did not call BitmapText.rBundle');
    process.exit(1);
  }
  await decodePromise;

  const bundleSize = vm.runInContext('MetricsBundleStore.size()', ctx);
  console.error(`[verify] MetricsBundleStore.size() = ${bundleSize}`);

  // 4. Pull every idString FontManifest now knows about (the bundle decoder
  //    registers both density variants for each record).
  const allIds = vm.runInContext('FontManifest.allFontIDsSorted()', ctx);
  console.error(`[verify] FontManifest reports ${allIds.length} font IDs`);

  // 5. For each idString, run the lazy materialisation path
  //    (FontMetricsStore.getFontMetrics → MetricsExpander.expand with density injection)
  //    and snapshot canonically.
  function canonicalise(value) {
    if (Array.isArray(value)) return value.map(canonicalise);
    if (value && typeof value === 'object') {
      const out = {};
      for (const k of Object.keys(value).sort()) out[k] = canonicalise(value[k]);
      return out;
    }
    if (typeof value === 'number' && Object.is(value, -0)) return 0;
    return value;
  }

  const records = [];
  let missing = 0;
  for (const id of allIds) {
    const fm = vm.runInContext(
      `FontMetricsStore.getFontMetrics(FontProperties.fromIDString(${JSON.stringify(id)}))`,
      ctx
    );
    if (!fm) {
      records.push({ id, missing: true });
      missing++;
      continue;
    }
    records.push({
      id,
      kerningTable: canonicalise(fm._kerningTable),
      characterMetrics: canonicalise(fm._characterMetrics),
      spaceAdvancementOverride: fm._spaceAdvancementOverride === undefined ? null : fm._spaceAdvancementOverride,
    });
  }
  records.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // 6. Write JSON dump (matching baseline format) and hash.
  const stream = fs.createWriteStream(OUT_JSON);
  stream.write('[\n');
  for (let i = 0; i < records.length; i++) {
    stream.write(JSON.stringify(records[i]));
    stream.write(i + 1 === records.length ? '\n' : ',\n');
  }
  stream.write(']\n');
  stream.end();

  await new Promise(r => stream.on('finish', r));
  const buf = fs.readFileSync(OUT_JSON);
  const h = crypto.createHash('sha256').update(buf).digest('hex');
  fs.writeFileSync(OUT_HASH, `${h}  ${path.basename(OUT_JSON)}\n`);
  console.error(`[verify] wrote ${OUT_JSON} (${buf.length} bytes)`);
  console.error(`[verify] sha256 = ${h}`);
  console.error(`[verify] records: ${records.length}, missing: ${missing}`);

  // 7. Compare to baseline.
  if (!fs.existsSync(BASELINE_HASH_FILE)) {
    console.error(`[verify] WARN: no baseline at ${BASELINE_HASH_FILE} - skipping comparison`);
    process.exit(0);
  }
  const baseline = fs.readFileSync(BASELINE_HASH_FILE, 'utf8').split(/\s+/)[0];
  if (baseline === h) {
    console.error(`[verify] PASS: bundle output is byte-identical to baseline (${h})`);
    process.exit(0);
  } else {
    console.error(`[verify] FAIL: hash mismatch`);
    console.error(`[verify]   baseline: ${baseline}`);
    console.error(`[verify]   bundle:   ${h}`);
    console.error(`[verify] diff with: diff /tmp/bitmaptext-metrics-baseline.json /tmp/bitmaptext-metrics-verify.json | head -50`);
    process.exit(1);
  }
})().catch(e => {
  console.error(`[verify] threw: ${e.message}`);
  console.error(e.stack);
  process.exit(1);
});
