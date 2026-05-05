#!/usr/bin/env node

// build-metrics-bundle.js
//
// Generates `font-assets/metrics-bundle.js` from the per-file metrics records
// currently sitting in `font-assets/`. Density-1 / density-2 pairs collapse to
// one density-agnostic record (the only difference is `pixelDensity`, which the
// runtime injects at register-time via MetricsExpander.expand's `overrideDensity`
// argument).
//
// Bundle file layout:
//   BitmapText.rBundle("<base64 of deflate-raw of bundle JSON>");
//
// where bundle JSON is:
//   [
//     ["FamilyName", styleIdx, weightIdx, size, <8-element minified array>],
//     ...
//   ]
//
// Exits with non-zero on any parse / encoding error.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const FONT_ASSETS = path.join(PROJECT_ROOT, 'font-assets');
const OUTPUT_PATH = path.join(FONT_ASSETS, 'metrics-bundle.js');

function styleStringToIdx(s) {
  if (s === 'normal') return 0;
  if (s === 'italic') return 1;
  if (s === 'oblique') return 2;
  throw new Error(`Unknown fontStyle: ${s}`);
}

function weightStringToIdx(w) {
  if (w === 'normal') return 0;
  if (w === 'bold') return 1;
  const n = Number(w);
  if (!Number.isFinite(n)) throw new Error(`Unknown fontWeight: ${w}`);
  return n;
}

// Parse a single metrics-*.js file and return [family, styleIdx, weightIdx, size, minifiedArray].
// The file is one statement: `BitmapText.r(d,'F',si,wi,sz,[...])`. We isolate the 6 args, parse
// them as a JSON array (with single quotes converted to double), then return the (DPR-stripped)
// record.
function parseMetricsFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  // Strip the wrapper: BitmapText.r(<args>) — any whitespace tolerated, optional trailing semicolon.
  const m = code.match(/^\s*BitmapText\.r\(\s*([\s\S]+)\s*\)\s*;?\s*$/);
  if (!m) throw new Error(`Could not parse wrapper in ${filePath}`);
  const argsBody = m[1];

  // The 6 args are a comma-separated tuple at the top level. Use eval as a
  // single-purpose JS-of-JS parser; the surrounding context is build-time only
  // and the inputs are our own minified files.
  let parsed;
  try {
    // eslint-disable-next-line no-eval
    parsed = (0, eval)(`[${argsBody}]`);
  } catch (e) {
    throw new Error(`Failed to eval args in ${filePath}: ${e.message}`);
  }
  if (!Array.isArray(parsed) || parsed.length !== 6) {
    throw new Error(`Expected 6 args in ${filePath}, got ${parsed?.length}`);
  }

  const [density, family, styleIdx, weightIdx, size, minified] = parsed;
  if (!Array.isArray(minified) || minified.length !== 8) {
    throw new Error(`Bad minified array in ${filePath}: length=${minified?.length}`);
  }
  return { density, family, styleIdx, weightIdx, size, minified };
}

function recordKey(family, styleIdx, weightIdx, size) {
  return `${family}|${styleIdx}|${weightIdx}|${size}`;
}

function isDeepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!isDeepEqual(a[i], b[i])) return false;
    return true;
  }
  if (typeof a === 'object') {
    const ak = Object.keys(a).sort();
    const bk = Object.keys(b).sort();
    if (ak.length !== bk.length) return false;
    for (let i = 0; i < ak.length; i++) {
      if (ak[i] !== bk[i]) return false;
      if (!isDeepEqual(a[ak[i]], b[bk[i]])) return false;
    }
    return true;
  }
  return false;
}

// Replace baseline[5] (pixelDensity) with null in the 8-element minified array.
// The bundle is density-agnostic; pixelDensity is supplied by the runtime when
// MetricsExpander.expand materialises a FontMetrics for a specific density.
function stripDensityFromBaseline(minified) {
  const baseline = minified[2];
  if (!Array.isArray(baseline) || baseline.length !== 6) {
    throw new Error(`Expected 6-element baseline, got ${baseline?.length}`);
  }
  const out = minified.slice();
  out[2] = [baseline[0], baseline[1], baseline[2], baseline[3], baseline[4], null];
  return out;
}

function main() {
  const entries = fs.readdirSync(FONT_ASSETS)
    .filter(f => /^metrics-density-.*\.js$/.test(f) && !f.endsWith('-full.js'));
  console.error(`[bundle] discovered ${entries.length} per-file metrics`);

  // Map: recordKey → first-seen DPR-stripped minified array
  // We also keep the second-seen for cross-density consistency check.
  const recordsMap = new Map();
  const seenDensities = new Map();

  let parseFailures = 0;
  let dprMismatches = 0;
  let i = 0;
  for (const fname of entries) {
    i++;
    if (i % 500 === 0) console.error(`[bundle] parsed ${i}/${entries.length}`);
    const filePath = path.join(FONT_ASSETS, fname);
    let rec;
    try {
      rec = parseMetricsFile(filePath);
    } catch (e) {
      console.error(`[bundle] PARSE FAIL ${fname}: ${e.message}`);
      parseFailures++;
      continue;
    }
    const key = recordKey(rec.family, rec.styleIdx, rec.weightIdx, rec.size);
    const stripped = stripDensityFromBaseline(rec.minified);

    if (!recordsMap.has(key)) {
      recordsMap.set(key, { record: stripped, family: rec.family, styleIdx: rec.styleIdx, weightIdx: rec.weightIdx, size: rec.size });
      seenDensities.set(key, [rec.density]);
    } else {
      const existing = recordsMap.get(key).record;
      if (!isDeepEqual(existing, stripped)) {
        dprMismatches++;
        console.error(`[bundle] DPR MISMATCH ${key} (densities: ${seenDensities.get(key).join(',')} now ${rec.density})`);
      }
      seenDensities.get(key).push(rec.density);
    }
  }

  console.error(`[bundle] unique records (density-agnostic): ${recordsMap.size}`);
  console.error(`[bundle] parse failures: ${parseFailures}`);
  console.error(`[bundle] DPR mismatches: ${dprMismatches}`);
  if (parseFailures || dprMismatches) {
    console.error(`[bundle] aborting due to errors`);
    process.exit(1);
  }

  // Sort by (family, styleIdx, weightIdx, size) for deterministic output.
  const recordsArr = Array.from(recordsMap.values()).sort((a, b) => {
    if (a.family !== b.family) return a.family < b.family ? -1 : 1;
    if (a.styleIdx !== b.styleIdx) return a.styleIdx - b.styleIdx;
    if (a.weightIdx !== b.weightIdx) return (typeof a.weightIdx === 'number' ? a.weightIdx : 0) - (typeof b.weightIdx === 'number' ? b.weightIdx : 0);
    return a.size - b.size;
  });

  const bundleArray = recordsArr.map(r => [r.family, r.styleIdx, r.weightIdx, r.size, r.record]);
  const json = JSON.stringify(bundleArray);
  console.error(`[bundle] JSON size: ${json.length} bytes`);

  const compressed = zlib.deflateRawSync(Buffer.from(json, 'utf8'), { level: 9 });
  console.error(`[bundle] deflate-raw size: ${compressed.length} bytes (${(compressed.length / json.length * 100).toFixed(1)}%)`);

  const b64 = compressed.toString('base64');
  console.error(`[bundle] base64 size: ${b64.length} bytes`);

  // Write the wrapper. Single-quoted string so terser-style mangling won't matter;
  // base64 contains only [A-Za-z0-9+/=], all safe inside single quotes.
  const wrapped = `BitmapText.rBundle('${b64}');\n`;
  fs.writeFileSync(OUTPUT_PATH, wrapped, 'utf8');
  console.error(`[bundle] wrote ${OUTPUT_PATH} (${wrapped.length} bytes)`);
  console.error(`[bundle] total reduction vs ${entries.length} per-file metrics: see du -sh font-assets/metrics-density-*.js`);
}

main();
