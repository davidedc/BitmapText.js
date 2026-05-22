#!/usr/bin/env node

// verify-smoke-set.js
//
// Publish gate for the font-assets-smoke-set release artifact. Loads every
// font listed in the staged smoke-set's `smoke-set.json` from the staging
// directory, then renders a glyph for each and asserts it produced
// non-transparent pixels. Fails non-zero if any step doesn't work — so a
// broken smoke set never reaches `gh release create`.
//
// What this catches:
//   - Wrong/missing files in the staging dir (filename mismatch with idString)
//   - Bundle decode failures (corrupted base64, wrong format)
//   - Records present in bundles but no matching atlas (or vice versa)
//   - drawTextFromAtlas falling back to the placeholder-rect path
//   - drawTextFromAtlas returning SUCCESS but writing zero pixels
//
// Usage:
//   node scripts/verify-smoke-set.js --dir=/tmp/smoke-set-staging

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

function getArg(name) {
  const eq = process.argv.find(a => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  return null;
}

const dir = path.resolve(getArg('dir') || '');
if (!dir || !fs.existsSync(dir)) {
  console.error('verify-smoke-set.js: --dir=<staged-smoke-set-dir> is required');
  process.exit(2);
}
const specPath = path.join(dir, 'smoke-set.json');
if (!fs.existsSync(specPath)) {
  console.error(`verify-smoke-set.js: ${specPath} not found — staging dir incomplete`);
  process.exit(2);
}

// Load the Node runtime bundle. It exposes BitmapText, FontProperties,
// TextProperties, StatusCode, etc. as globals — but NOT a Canvas class:
// canvas-mock.js is intentionally out of the runtime bundle (embedders ship
// their own canvas; only the Node demos concatenate canvas-mock). Pull it in
// here via a Function-wrapper that returns the classes we need — same effect
// as concatenation, no edits required to canvas-mock.js itself.
require(path.join(PROJECT_ROOT, 'dist', 'bitmaptext-node.min.js'));

const canvasMockSrc = fs.readFileSync(
  path.join(PROJECT_ROOT, 'src', 'platform', 'canvas-mock.js'),
  'utf8'
);
const { BitmapTextCanvas } = (new Function(
  canvasMockSrc + '\nreturn { BitmapTextCanvas };'
))();

const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

// Re-derive the (density, family, style, weight, size) cross-product from the
// spec — same expansion build-smoke-set.js does. Keeping this duplicated (and
// short) avoids importing build-smoke-set.js for one helper.
const wanted = [];
for (const set of spec.fontSets) {
  for (const density of set.density) {
    for (const family of set.families) {
      for (const style of set.styles) {
        for (const weight of set.weights) {
          for (const size of set.sizes) {
            wanted.push({ density, family, style, weight, size });
          }
        }
      }
    }
  }
}

const fmt = (n) => {
  const s = String(n);
  return s.includes('.') ? s.replace('.', '-') : `${s}-0`;
};
function idStringFor(d, f, st, w, sz) {
  return `density-${fmt(d)}-${f}-style-${st}-weight-${w}-size-${fmt(sz)}`;
}

// Pick a glyph each font is known to be able to render. The Invariant font
// exists specifically to back the FONT_INVARIANT_CHARS set (smileys, arrows,
// box-drawing, …) — any plain ASCII glyph routes to the regular family. So
// for the Invariant font we use a character it actually owns.
function glyphFor(family) {
  return family === 'BitmapTextInvariant' ? '☺' /* ☺ */ : 'A';
}

(async () => {
  BitmapText.configure({
    fontDirectory: dir.endsWith('/') ? dir : dir + '/',
    canvasFactory: () => new BitmapTextCanvas(),
  });

  const idStrings = wanted.map(w =>
    idStringFor(w.density, w.family, w.style, w.weight, w.size)
  );
  console.log(`verify-smoke-set: loading ${idStrings.length} font(s) from ${dir}`);
  await BitmapText.loadFonts(idStrings);

  let failures = 0;
  for (const w of wanted) {
    const fp = new FontProperties(w.density, w.family, w.style, w.weight, w.size);
    const tp = new TextProperties({
      isKerningEnabled: false,
      textBaseline: 'bottom',
      textAlign: 'left',
      textColor: '#000000',
    });
    const canvas = new BitmapTextCanvas();
    canvas.width = 64;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    // Transparent background → any non-zero alpha pixel proves the glyph was painted.
    const ch = glyphFor(w.family);

    const res = BitmapText.drawTextFromAtlas(ctx, ch, 2, 28, fp, tp);
    const ok = res.rendered && res.status.code === StatusCode.SUCCESS;
    const placeholders = res.status.placeholdersUsed || 0;

    let opaquePixels = 0;
    const data = canvas.data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) opaquePixels++;
    }

    const idStr = idStringFor(w.density, w.family, w.style, w.weight, w.size);
    const pass = ok && placeholders === 0 && opaquePixels > 0;
    console.log(
      `  ${pass ? 'PASS' : 'FAIL'} ${idStr}  glyph='${ch}'  ` +
      `rendered=${res.rendered}  code=${res.status.code}  ` +
      `placeholders=${placeholders}  opaquePixels=${opaquePixels}`
    );
    if (!pass) failures++;
  }

  if (failures > 0) {
    console.error(`\nverify-smoke-set: ${failures} font(s) failed — refusing to ship`);
    process.exit(1);
  }
  console.log(`\nverify-smoke-set: OK (${wanted.length}/${wanted.length} fonts render)`);
})().catch(err => {
  console.error('verify-smoke-set: error during verification:');
  console.error(err.stack || err.message || err);
  process.exit(1);
});
