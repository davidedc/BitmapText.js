#!/usr/bin/env node
//
// Regression check: a font size under MIN_RENDERABLE_SIZE (9) draws its
// placeholder rectangles at the font's pixel density.
//
// A size under 9 has no atlas: BitmapText measures it with the 9 px metrics
// scaled down (InterpolatedFontMetrics) and draws one placeholder rectangle per
// character. The rectangle is sized and placed in physical pixels by
// characterMetrics.pixelDensity (#drawPlaceholderRectangle). The scaled
// metrics once left that field out, so it defaulted to 1: at density 2 every
// rectangle came out half its size and its vertical offset halved, while the
// glyph positions still advanced at density 2.
//
// Asserts, for 'H' drawn at 4.5 px with textBaseline 'bottom':
//   A. at density 1 and at density 2, exactly one placeholder rectangle is
//      drawn on the main canvas, with a positive width and height;
//   B. the density-2 rectangle is the density-1 rectangle scaled by 2:
//      x, y, width and height each exactly double;
//   C. the draw reports NO_ATLAS (placeholders, as for any size under 9).
//
// Run: node scripts/check-small-size-placeholder-density.js
//      (or npm run test-small-size-placeholder-density)

'use strict';

const path = require('path');
const PROJECT_ROOT = path.resolve(__dirname, '..');

let failures = 0;
function ok(label) { console.log(`  ✓ ${label}`); }
function fail(label, detail) {
  failures++;
  console.error(`  ✗ ${label}`);
  if (detail) console.error(`     ${detail}`);
}

// Minimal canvas/ctx stand-in, the shape check-missing-char-placeholder.js uses,
// recording the main canvas's fillRect calls.
let mainCanvasRects = [];

class MiniCanvas {
  constructor() { this.width = 0; this.height = 0; this.data = null; }
  getContext() { return new MiniCtx(this); }
}
class MiniCtx {
  constructor(c) {
    this.c = c;
    this.fillStyle = '#000';
    this.globalCompositeOperation = 'source-over';
    this._isMainCanvas = false;
  }
  save() {} restore() {} setTransform() {}
  createImageData(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; }
  putImageData(d) { this.c.data = d.data; this.c.width = d.width; this.c.height = d.height; }
  drawImage() {}
  fillRect(x, y, w, h) {
    if (this._isMainCanvas) mainCanvasRects.push({ x, y, w, h });
  }
  clearRect() {}
  measureText(text) {
    return {
      width: 10 * text.length,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: 10 * text.length,
      fontBoundingBoxAscent: 15,
      fontBoundingBoxDescent: 5,
      actualBoundingBoxAscent: 15,
      actualBoundingBoxDescent: 5
    };
  }
}

require(path.join(PROJECT_ROOT, 'dist/bitmaptext-node.min.js'));
BitmapText.setCanvasFactory(() => new MiniCanvas());
BitmapText.setFontDirectory(path.join(PROJECT_ROOT, 'font-assets/'));

const SMALL_SIZE = 4.5;

function drawAtDensity(density) {
  mainCanvasRects = [];
  const c = new MiniCanvas();
  c.width = 100 * density;
  c.height = 40 * density;
  const ctx = c.getContext('2d');
  ctx._isMainCanvas = true;
  const fp = new FontProperties(density, 'Arial', 'normal', 'normal', SMALL_SIZE);
  const tp = new TextProperties({ textColor: '#000000', textBaseline: 'bottom', textAlign: 'left', isKerningEnabled: true });
  const result = BitmapText.drawTextFromAtlas(ctx, 'H', 10, 30, fp, tp);
  return { result, rects: mainCanvasRects.slice() };
}

(async () => {
  // the 9 px metrics the small size is scaled from, at each density
  for (const density of [1, 2]) {
    await BitmapText.loadFont(new FontProperties(density, 'Arial', 'normal', 'normal', 9).idString);
  }

  const d1 = drawAtDensity(1);
  const d2 = drawAtDensity(2);

  console.log(`Test A — one rectangle per density ('H' at ${SMALL_SIZE} px):`);
  for (const [label, run] of [['density 1', d1], ['density 2', d2]]) {
    if (run.rects.length === 1 && run.rects[0].w > 0 && run.rects[0].h > 0) {
      ok(`[${label}] one rectangle, ${JSON.stringify(run.rects[0])}`);
    } else {
      fail(`[${label}] one rectangle with a positive size`, `actual: ${JSON.stringify(run.rects)}`);
    }
  }

  console.log('\nTest B — the density-2 rectangle is the density-1 one scaled by 2:');
  if (d1.rects.length === 1 && d2.rects.length === 1) {
    for (const k of ['x', 'y', 'w', 'h']) {
      const expected = d1.rects[0][k] * 2;
      if (Math.abs(d2.rects[0][k] - expected) < 1e-9) ok(`${k}: ${d2.rects[0][k]} = 2 × ${d1.rects[0][k]}`);
      else fail(`${k} doubles`, `density 1: ${d1.rects[0][k]}, density 2: ${d2.rects[0][k]} (expected ${expected})`);
    }
  } else {
    fail('both densities drew one rectangle', 'see Test A');
  }

  console.log('\nTest C — a size under 9 reports NO_ATLAS:');
  for (const [label, run] of [['density 1', d1], ['density 2', d2]]) {
    const code = run.result && run.result.status && run.result.status.code;
    if (code === StatusCode.NO_ATLAS) ok(`[${label}] status.code === NO_ATLAS`);
    else fail(`[${label}] status.code === NO_ATLAS`, `actual: ${code}`);
  }

  console.log('');
  if (failures === 0) {
    console.log('✅ All small-size placeholder density assertions passed.');
    process.exit(0);
  } else {
    console.error(`❌ ${failures} assertion(s) failed.`);
    process.exit(1);
  }
})().catch(e => {
  console.error('Unexpected error:', e.message);
  console.error(e.stack);
  process.exit(2);
});
