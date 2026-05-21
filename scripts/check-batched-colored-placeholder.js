#!/usr/bin/env node
//
// Sprint 5 (Round 4) smoke test — covers the bug fix in #drawColoredTextBatched.
//
// Pre-fix: drawTextFromAtlas(ctx, "Hello ☺", ..., {textColor: '#ff0000'}) on a
// process where the primary atlas is loaded but the invariant atlas isn't
// crashes with TypeError: Cannot read properties of undefined (reading
// 'atlasPositioning'). The batched colored-text path didn't track per-glyph
// atlas validity the way the per-glyph branch does.
//
// Post-fix: the call returns gracefully with status.code === PARTIAL_ATLAS
// and status.missingAtlasChars containing the invariant char(s). A placeholder
// rectangle in textColor is drawn on the main canvas (mirroring the per-glyph
// branch's behaviour).
//
// Asserts:
//   1. No exception is thrown.
//   2. status.code === StatusCode.PARTIAL_ATLAS (4 — main atlas valid, some
//      glyphs missing).
//   3. status.missingAtlasChars contains the invariant character ('☺').
//   4. The fillRect was called at least once on the main canvas (the
//      placeholder rectangle) — proves the placeholder path executed, not
//      just the missing-char-tracking.
//
// Run: node scripts/check-batched-colored-placeholder.js
//      (or npm run test-batched-colored-placeholder)

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

// Minimal canvas/ctx stand-in. We don't care about pixel correctness — we
// only need the surface BitmapText exercises (drawImage, fillRect, etc.) to
// not throw, plus enough fillRect-call counting to verify the placeholder
// rect path executed.
let mainCanvasFillRectCalls = 0;

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
  fillRect() {
    if (this._isMainCanvas) mainCanvasFillRectCalls++;
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

(async () => {
  const fp = new FontProperties(1, 'Arial', 'normal', 'normal', 19);
  // Load ONLY the primary font (Arial). Don't load the invariant font's
  // atlas. The metrics bundle covers ALL fonts so invariant metrics ARE
  // available, but invariant atlas (BitmapTextInvariant) is NOT in
  // AtlasDataStore.
  await BitmapText.loadFont(fp.idString);

  // Build a main canvas/ctx and mark it so fillRect calls there get counted.
  const mainCanvas = new MiniCanvas();
  mainCanvas.width = 200;
  mainCanvas.height = 50;
  const mainCtx = mainCanvas.getContext('2d');
  mainCtx._isMainCanvas = true;

  // Render colored text containing an invariant char. This hits the batched
  // colored path AND triggers the invariant-atlas-missing case.
  let result;
  let threw = null;
  try {
    result = BitmapText.drawTextFromAtlas(
      mainCtx, 'Hello ☺', 10, 30, fp,
      new TextProperties({
        textColor: '#ff0000',
        textBaseline: 'bottom',
        textAlign: 'left',
        isKerningEnabled: true
      })
    );
  } catch (e) {
    threw = e;
  }

  // Assertion 1: no exception
  if (threw) {
    fail('drawTextFromAtlas does not throw', `caught: ${threw.message}`);
    process.exit(1);
  } else {
    ok('drawTextFromAtlas does not throw');
  }

  // Assertion 2: status.code === PARTIAL_ATLAS (4)
  if (!result || !result.status) {
    fail('result has a status object', `result: ${JSON.stringify(result)}`);
  } else if (result.status.code !== StatusCode.PARTIAL_ATLAS) {
    fail(`status.code === StatusCode.PARTIAL_ATLAS (${StatusCode.PARTIAL_ATLAS})`,
         `actual: ${result.status.code}`);
  } else {
    ok(`status.code === StatusCode.PARTIAL_ATLAS (${StatusCode.PARTIAL_ATLAS})`);
  }

  // Assertion 3: missingAtlasChars contains '☺'
  const missing = result && result.status && result.status.missingAtlasChars;
  if (!missing || !(missing instanceof Set)) {
    fail('status.missingAtlasChars is a Set', `actual: ${missing}`);
  } else if (!missing.has('☺')) {
    fail("status.missingAtlasChars contains '☺'", `actual: [${[...missing].join(', ')}]`);
  } else {
    ok("status.missingAtlasChars contains '☺'");
  }

  // Assertion 4: a placeholder rect was drawn on the main canvas (fillRect
  // was called there at least once during the render — by
  // #drawPlaceholderRectangle for the missing invariant char).
  if (mainCanvasFillRectCalls < 1) {
    fail('placeholder rectangle drawn on main canvas (fillRect called)',
         `actual fillRect calls on main canvas: ${mainCanvasFillRectCalls}`);
  } else {
    ok(`placeholder rectangle drawn on main canvas (fillRect calls: ${mainCanvasFillRectCalls})`);
  }

  console.log('');
  if (failures === 0) {
    console.log('✅ All batched-colored-placeholder assertions passed.');
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
