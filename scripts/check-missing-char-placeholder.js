#!/usr/bin/env node
//
// Smoke test for the "char not in any atlas" fix.
//
// Pre-fix: drawTextFromAtlas(ctx, '45°', ...) renders ZERO pixels for the
// entire string when '°' (U+00B0) is in neither the active font's
// FONT_SPECIFIC_CHARS (it's in the latin1Exclusions set) nor
// FONT_INVARIANT_CHARS. The whole-string-drop happens at the prologue
// pre-pass in drawTextFromAtlas (#scanForMissingChars early-bail) — and
// independently in #drawColoredTextBatched, whose measureText-pre-pass
// also bails. Both paths return rendered:false silently for the user.
//
// Post-fix: both paths render real glyphs for the chars that DO exist
// (4 and 5 via the atlas) AND a placeholder rectangle in textColor for
// the missing char (°), sized using '?' character metrics as a fallback
// (always available in FONT_SPECIFIC_CHARS). Status is PARTIAL_ATLAS;
// status.missingAtlasChars contains '°'. Converges the failure-mode
// surface with c338025's missing-atlas placeholder behaviour.
//
// Asserts (three test cases):
//   A. Per-glyph path (textColor === DEFAULT_TEXT_COLOR / '#000000'):
//        drawTextFromAtlas(ctx, '45°', ...) does not throw;
//        status.code === PARTIAL_ATLAS;
//        status.missingAtlasChars contains '°';
//        mainCanvasFillRectCalls >= 1 (placeholder rect drawn).
//   B. Batched path (textColor !== DEFAULT_TEXT_COLOR — e.g. '#0000FF'):
//        same four assertions.
//   C. Regression check: drawTextFromAtlas(ctx, '45', ...) returns
//        status.code === SUCCESS; mainCanvasFillRectCalls === 0 (no
//        placeholder fired on a happy-path render).
//
// Run: node scripts/check-missing-char-placeholder.js
//      (or npm run test-missing-char-placeholder)

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

// Minimal canvas/ctx stand-in. Same shape as check-batched-colored-placeholder.js.
// We only need the surface BitmapText exercises to not throw, plus enough
// fillRect-call counting to detect placeholder-rect activity on the main canvas.
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

function makeMainCtx() {
  const c = new MiniCanvas();
  c.width = 200;
  c.height = 50;
  const ctx = c.getContext('2d');
  ctx._isMainCanvas = true;
  return ctx;
}

function runOneCase(label, text, textColor, expectStatusCode, expectMissingChar) {
  mainCanvasFillRectCalls = 0;
  const ctx = makeMainCtx();
  const fp = new FontProperties(1, 'Arial', 'normal', 'normal', 19);
  const tp = new TextProperties({
    textColor,
    textBaseline: 'bottom',
    textAlign: 'left',
    isKerningEnabled: true
  });

  let result;
  let threw = null;
  try {
    result = BitmapText.drawTextFromAtlas(ctx, text, 10, 30, fp, tp);
  } catch (e) {
    threw = e;
  }

  if (threw) {
    fail(`[${label}] does not throw`, `caught: ${threw.message}`);
    return;
  }
  ok(`[${label}] does not throw`);

  if (!result || !result.status) {
    fail(`[${label}] result has a status object`, `result: ${JSON.stringify(result)}`);
    return;
  }
  if (result.status.code !== expectStatusCode) {
    fail(`[${label}] status.code === ${expectStatusCode}`,
         `actual: ${result.status.code}`);
  } else {
    ok(`[${label}] status.code === ${expectStatusCode}`);
  }

  if (expectMissingChar) {
    const missing = result.status.missingAtlasChars;
    if (!missing || !(missing instanceof Set)) {
      fail(`[${label}] status.missingAtlasChars is a Set`, `actual: ${missing}`);
    } else if (!missing.has(expectMissingChar)) {
      fail(`[${label}] status.missingAtlasChars contains '${expectMissingChar}'`,
           `actual: [${[...missing].join(', ')}]`);
    } else {
      ok(`[${label}] status.missingAtlasChars contains '${expectMissingChar}'`);
    }
    if (mainCanvasFillRectCalls < 1) {
      fail(`[${label}] placeholder rect drawn on main canvas (fillRect called)`,
           `actual fillRect calls on main canvas: ${mainCanvasFillRectCalls}`);
    } else {
      ok(`[${label}] placeholder rect drawn on main canvas (fillRect calls: ${mainCanvasFillRectCalls})`);
    }
  } else {
    // Regression case: no missing chars, no placeholder fillRect.
    if (mainCanvasFillRectCalls !== 0) {
      fail(`[${label}] no placeholder fillRect on happy-path render`,
           `actual fillRect calls on main canvas: ${mainCanvasFillRectCalls}`);
    } else {
      ok(`[${label}] no placeholder fillRect on happy-path render`);
    }
  }
}

(async () => {
  const fp = new FontProperties(1, 'Arial', 'normal', 'normal', 19);
  await BitmapText.loadFont(fp.idString);

  console.log("Test A — per-glyph path (black text, '45°'):");
  runOneCase('A', '45°', '#000000', StatusCode.PARTIAL_ATLAS, '°');

  console.log("\nTest B — batched path (colored text, '45°'):");
  runOneCase('B', '45°', '#0000FF', StatusCode.PARTIAL_ATLAS, '°');

  console.log("\nTest C — regression (no missing chars, both paths):");
  runOneCase('C-black', '45', '#000000', StatusCode.SUCCESS, null);
  runOneCase('C-color', '45', '#0000FF', StatusCode.SUCCESS, null);

  console.log('');
  if (failures === 0) {
    console.log('✅ All missing-char-placeholder assertions passed.');
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
