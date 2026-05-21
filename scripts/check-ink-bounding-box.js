#!/usr/bin/env node
//
// Sprint 5 (Round 4) smoke test — covers proposal F (computeInkBoundingBox).
//
// Asserts three things about the new public method:
//   1. Empty / failure cases return predictable shapes. Empty text →
//      zero-area box at (x, y) + SUCCESS. (Failure cases are documented but
//      not exercised here — they're driven by measureText's own failure modes
//      which are covered elsewhere.)
//   2. Round-trip against painted pixels — the load-bearing assertion. For a
//      known font and several textAlign/textBaseline combinations:
//        - Call computeInkBoundingBox to get the expected ink box.
//        - Convert CSS-px → physical-px (density=1 here, so 1:1).
//        - Render via drawTextFromAtlas into a real canvas-mock Canvas.
//        - Scan the canvas's Uint8ClampedArray for non-transparent pixels
//          (alpha ≥ 128 — same threshold as the binary-atlas invariant).
//        - The scanned ink-pixel bounding box must equal the predicted box
//          within ±2 px on every edge (tolerance for the rounding boundary).
//   3. Alignment shifts the box predictably — no render. For the same text:
//      textAlign='center' shifts box.x left by ~width/2 vs 'left';
//      textAlign='right' shifts box.x left by ~width. Catches sign flips
//      without needing a full round-trip.
//
// UNITS NOTE — important for anyone reading this test (and the
// computeInkBoundingBox JSDoc).
//   computeInkBoundingBox returns CSS-pixel floats. To compute physical
//   pixels (e.g. to allocate an intermediate canvas), the embedder pattern is:
//       const w_phys = Math.ceil(box.width  * fp.pixelDensity);
//       const h_phys = Math.ceil(box.height * fp.pixelDensity);
//   The (x - box.x, y - box.y) draw position passed to drawTextFromAtlas
//   STAYS in CSS pixels — drawTextFromAtlas multiplies internally by
//   pixelDensity. Don't double-scale. See CLAUDE.md invariant 5 and the
//   plan at ~/.claude/plans/i-am-about-to-golden-narwhal.md §4 for the
//   full discussion.
//
// Run: node scripts/check-ink-bounding-box.js  (or npm run test-ink-bounding-box)
// Exits non-zero on any failed assertion.

'use strict';

const fs = require('fs');
const path = require('path');
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Load the runtime bundle.
require(path.join(PROJECT_ROOT, 'dist/bitmaptext-node.min.js'));

// Bring canvas-mock's BitmapTextCanvas / BitmapTextCanvasContext2D into scope
// by eval'ing the source — with explicit global assignments appended so the
// classes survive eval's strict-mode scope rules and are reachable both from
// this script's top-level code AND from closures (the canvasFactory closure
// runs from inside FontLoaderNode and needs the binding too). canvas-mock is
// NOT in the runtime bundle (it's a separate module Node consumers require
// independently); eval'ing keeps this smoke test single-file without a
// multi-step build.
const canvasMockSrc = fs.readFileSync(
  path.join(PROJECT_ROOT, 'src/platform/canvas-mock.js'),
  'utf8'
);
eval(
  canvasMockSrc +
  '\nglobalThis.BitmapTextCanvas = BitmapTextCanvas;' +
  '\nglobalThis.BitmapTextCanvasContext2D = BitmapTextCanvasContext2D;' +
  '\nglobalThis.BitmapTextCanvasImage = BitmapTextCanvasImage;'
);

BitmapText.setCanvasFactory(() => new BitmapTextCanvas());
BitmapText.setFontDirectory(path.join(PROJECT_ROOT, 'font-assets/'));

const FP = new FontProperties(1, 'Arial', 'normal', 'normal', 19); // density 1 — CSS-px == phys-px

let failures = 0;
function ok(label) { console.log(`  ✓ ${label}`); }
function fail(label, detail) {
  failures++;
  console.error(`  ✗ ${label}`);
  if (detail) console.error(`     ${detail}`);
}

// Scan a canvas-mock Canvas for the bounding box of non-transparent pixels.
// Returns null if no pixel has alpha ≥ 128.
function scanInkBoundingBox(canvas) {
  const w = canvas.width;
  const h = canvas.height;
  const data = canvas.data;
  let left = Infinity, right = -Infinity, top = Infinity, bot = -Infinity;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const alpha = data[(py * w + px) * 4 + 3];
      if (alpha >= 128) {
        if (px < left)  left  = px;
        if (px > right) right = px;
        if (py < top)   top   = py;
        if (py > bot)   bot   = py;
      }
    }
  }
  if (left === Infinity) return null;
  return { x: left, y: top, width: right - left + 1, height: bot - top + 1 };
}

(async () => {
  // Pre-load the font + atlas so the renders work.
  await BitmapText.loadFont(FP.idString);

  // ----- Test 1: empty text -----
  console.log('1. Empty text returns degenerate zero-area box at (x, y)');
  {
    const tp = new TextProperties();
    const r = BitmapText.computeInkBoundingBox('', 50, 100, FP, tp);
    if (r.status.code !== 0) {
      fail('status code is 0 for empty text', `actual code: ${r.status.code}`);
    } else if (!r.box) {
      fail('box is non-null for empty text', `box: ${r.box}`);
    } else if (r.box.x !== 50 || r.box.y !== 100 || r.box.width !== 0 || r.box.height !== 0) {
      fail('empty text box is {x:50, y:100, w:0, h:0}', `actual: ${JSON.stringify(r.box)}`);
    } else {
      ok('empty text box is {x:50, y:100, w:0, h:0}');
    }
  }

  // ----- Test 2: round-trip against painted pixels -----
  console.log('\n2. Round-trip: computeInkBoundingBox ↔ scanned painted pixels');
  {
    const tests = [
      { textAlign: 'left',   textBaseline: 'bottom' },
      { textAlign: 'left',   textBaseline: 'top' },
      { textAlign: 'left',   textBaseline: 'alphabetic' },
      { textAlign: 'center', textBaseline: 'middle' },
      { textAlign: 'right',  textBaseline: 'bottom' },
    ];

    // Big-enough canvas to contain all variants with margin.
    const CANVAS_W = 200, CANVAS_H = 100;
    const text = 'Hgy'; // mix of ascender + descender + cap so all metrics activate
    const x_draw = 80, y_draw = 50;

    let passed = 0;
    for (const variant of tests) {
      const tp = new TextProperties({ ...variant });
      const r = BitmapText.computeInkBoundingBox(text, x_draw, y_draw, FP, tp);
      if (r.status.code !== 0 || !r.box) {
        fail(`predicted box for ${JSON.stringify(variant)}`, `status: ${JSON.stringify(r.status)}`);
        continue;
      }
      // density=1, so CSS-px box maps to phys-px integer pixels at ceil.
      const predicted = {
        x: Math.floor(r.box.x),
        y: Math.floor(r.box.y),
        right:  Math.ceil(r.box.x + r.box.width),
        bottom: Math.ceil(r.box.y + r.box.height),
      };

      const canvas = new BitmapTextCanvas();
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      BitmapText.drawTextFromAtlas(canvas.getContext('2d'), text, x_draw, y_draw, FP, tp);

      const scanned = scanInkBoundingBox(canvas);
      if (!scanned) {
        fail(`scanned ink box for ${JSON.stringify(variant)}`, 'no ink pixels found');
        continue;
      }
      const scannedR = { right: scanned.x + scanned.width, bottom: scanned.y + scanned.height };

      // ±2 px tolerance on every edge — generous enough to absorb rounding
      // boundary effects, tight enough to catch sign flips.
      const TOL = 2;
      const dxL = Math.abs(scanned.x       - predicted.x);
      const dyT = Math.abs(scanned.y       - predicted.y);
      const dxR = Math.abs(scannedR.right  - predicted.right);
      const dyB = Math.abs(scannedR.bottom - predicted.bottom);

      if (dxL <= TOL && dyT <= TOL && dxR <= TOL && dyB <= TOL) {
        passed++;
      } else {
        fail(
          `predicted ≈ scanned for align=${variant.textAlign}, baseline=${variant.textBaseline}`,
          `predicted ${JSON.stringify(predicted)}\n     scanned   ${JSON.stringify({ x: scanned.x, y: scanned.y, right: scannedR.right, bottom: scannedR.bottom })}\n     deltas    L=${dxL} T=${dyT} R=${dxR} B=${dyB} (tol=${TOL})`
        );
      }
    }
    if (passed === tests.length) {
      ok(`all ${tests.length} alignment×baseline variants round-tripped within ±2 px`);
    }
  }

  // ----- Test 3: alignment shifts box predictably (no render) -----
  console.log('\n3. Alignment shifts box.x predictably (no-render check)');
  {
    const text = 'Hello';
    const x_draw = 100, y_draw = 50;
    const baseTP    = new TextProperties({ textAlign: 'left' });
    const centerTP  = new TextProperties({ textAlign: 'center' });
    const rightTP   = new TextProperties({ textAlign: 'right' });

    const leftR   = BitmapText.computeInkBoundingBox(text, x_draw, y_draw, FP, baseTP);
    const centerR = BitmapText.computeInkBoundingBox(text, x_draw, y_draw, FP, centerTP);
    const rightR  = BitmapText.computeInkBoundingBox(text, x_draw, y_draw, FP, rightTP);

    if (!leftR.box || !centerR.box || !rightR.box) {
      fail('all three box predictions succeeded', `left=${!!leftR.box} center=${!!centerR.box} right=${!!rightR.box}`);
    } else {
      // measureText gives the width; alignment shifts box.x by -width/2 and -width.
      const m = BitmapText.measureText(text, FP, baseTP).metrics;
      const expectedCenterShift = -m.width / 2;
      const expectedRightShift  = -m.width;

      const actualCenterShift = centerR.box.x - leftR.box.x;
      const actualRightShift  = rightR.box.x  - leftR.box.x;

      // ±0.5 px tolerance — these are pure-arithmetic predictions, no rendering.
      const TOL = 0.5;
      if (Math.abs(actualCenterShift - expectedCenterShift) > TOL) {
        fail('center shift ≈ -width/2',
             `expected ${expectedCenterShift.toFixed(2)}, actual ${actualCenterShift.toFixed(2)}`);
      } else {
        ok(`center shift ≈ -width/2  (${actualCenterShift.toFixed(2)} ≈ ${expectedCenterShift.toFixed(2)})`);
      }
      if (Math.abs(actualRightShift - expectedRightShift) > TOL) {
        fail('right shift ≈ -width',
             `expected ${expectedRightShift.toFixed(2)}, actual ${actualRightShift.toFixed(2)}`);
      } else {
        ok(`right shift  ≈ -width    (${actualRightShift.toFixed(2)} ≈ ${expectedRightShift.toFixed(2)})`);
      }
    }
  }

  // ----- Summary -----
  console.log('');
  if (failures === 0) {
    console.log('✅ All ink-bounding-box assertions passed.');
    process.exit(0);
  } else {
    console.error(`❌ ${failures} assertion(s) failed.`);
    process.exit(1);
  }
})().catch(e => {
  console.error('Uncaught error:', e);
  process.exit(2);
});
