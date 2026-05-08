#!/usr/bin/env node

// repair-missing-webps.js
//
// Regenerates any atlas-*.webp files that are missing in font-assets/, sourcing
// pixels from the matching atlas-*.qoi. Bypasses ImageOptim, which sometimes
// re-encodes large binary PNGs as bit-depth-1 — a format cwebp's PNG reader
// rejects, dropping the .webp + -webp.js wrapper from the pipeline.
//
// Pipeline: qoi → 8-bit RGBA PNG (via PngEncoder) → webp (cwebp -lossless -z 9).
// The temporary PNG is removed, matching the watcher's "delete source PNG after
// WebP" step.
//
// Idempotent: only files actually missing a .webp are regenerated.
// After this finishes, run scripts/image-to-js-converter.js to (re)create the
// matching atlas-*-webp.js wrappers.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const FONT_ASSETS = path.join(PROJECT_ROOT, 'font-assets');

// Load QOIDecode + PngEncoder via vm context (same pattern as qoi-to-png-converter.js)
const context = {
  console,
  TextEncoder: global.TextEncoder || require('util').TextEncoder,
  Uint8Array, Uint8ClampedArray, ArrayBuffer, Math, String, Object,
  global: {},
};
vm.createContext(context);
for (const lib of ['lib/PngEncodingOptions.js', 'lib/PngEncoder.js', 'lib/QOIDecode.js']) {
  const code = fs.readFileSync(path.join(PROJECT_ROOT, lib), 'utf8');
  const exposeName = path.basename(lib, '.js');
  vm.runInContext(code + `\nglobal.${exposeName} = ${exposeName};`, context);
}
const { PngEncodingOptions, PngEncoder, QOIDecode } = context.global;

// Find every .qoi without a matching .webp.
const allFiles = fs.readdirSync(FONT_ASSETS);
const qoiSet = new Set(allFiles.filter(f => f.endsWith('.qoi')).map(f => f.slice(0, -4)));
const webpSet = new Set(allFiles.filter(f => f.endsWith('.webp')).map(f => f.slice(0, -5)));
const missing = [...qoiSet].filter(base => !webpSet.has(base)).sort();

console.log(`Found ${missing.length} atlas(es) missing .webp out of ${qoiSet.size} qoi files`);
if (missing.length === 0) { console.log('Nothing to do.'); process.exit(0); }

let ok = 0, failed = 0;
for (let i = 0; i < missing.length; i++) {
  const base = missing[i];
  const qoiPath = path.join(FONT_ASSETS, `${base}.qoi`);
  const pngPath = path.join(FONT_ASSETS, `${base}.png`);
  const webpPath = path.join(FONT_ASSETS, `${base}.webp`);
  try {
    // 1. QOI → ImageData
    const qoiBuf = fs.readFileSync(qoiPath);
    const qoiArrBuf = qoiBuf.buffer.slice(qoiBuf.byteOffset, qoiBuf.byteOffset + qoiBuf.length);
    const qoiData = QOIDecode(qoiArrBuf);
    if (qoiData.error) throw new Error('QOI decode error');

    // 2. ImageData → 8-bit RGBA PNG
    const surface = { width: qoiData.width, height: qoiData.height, data: qoiData.data };
    const pngBuffer = PngEncoder.encode(surface, PngEncodingOptions.DEFAULT);
    fs.writeFileSync(pngPath, Buffer.from(pngBuffer));

    // 3. PNG → WebP via cwebp (lossless, max compression)
    execFileSync('cwebp', ['-lossless', '-z', '9', '-q', '100', '-quiet', pngPath, '-o', webpPath]);

    // 4. Clean up the intermediate PNG
    fs.unlinkSync(pngPath);

    ok++;
    if ((i + 1) % 10 === 0 || i === missing.length - 1) {
      process.stdout.write(`  [${i + 1}/${missing.length}] ${ok} ok, ${failed} failed\r`);
    }
  } catch (e) {
    failed++;
    console.error(`\nFAIL ${base}: ${e.message}`);
    try { if (fs.existsSync(pngPath)) fs.unlinkSync(pngPath); } catch (_) {}
  }
}
console.log(`\nDone: ${ok} regenerated, ${failed} failed.`);
console.log('Next: node scripts/image-to-js-converter.js font-assets   (creates -webp.js wrappers)');
