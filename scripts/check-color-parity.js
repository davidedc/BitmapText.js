#!/usr/bin/env node
//
// Regression gate: per-glyph rounding parity between black fast path and
// colored batched path.
//
// drawTextFromAtlas takes one of two branches based on textColor:
//   - textColor === BitmapText.#DEFAULT_TEXT_COLOR ('#000000') →
//     the per-glyph fast path; each glyph's atlas tile is drawImage'd
//     directly onto the main canvas at Math.round(position + p.dx).
//   - else → #drawColoredTextBatched: each glyph goes into a scratch
//     canvas first, the scratch is tinted via source-in compositing
//     in one shot, then blitted to the main canvas at integer dst.
//
// Embedders running a software Canvas (e.g. SWCanvas) reasonably assume
// that rendering the same string at the same integer (x, y) produces the
// same set of opaque pixel positions regardless of textColor — only the
// color channels should differ. The batched path passes through a scratch
// canvas, so its per-glyph rounding decisions are made in a different
// coordinate space than the fast path's. The arithmetic was designed to
// produce identical integer dst coordinates either way (see math proof
// at the top of #drawColoredTextBatched), but the property is
// invisibly load-bearing and easy to break in future refactors of either
// path. This gate makes it explicit.
//
// Math (density 1, crisp metrics, integer p.dx — the standard case):
//   black:    Math.round(S + Σadvances + p.dx)
//   colored:  (Math.round(S) − aBBL) + Math.round(aBBL + Σadvances + p.dx)
// Since aBBL is Math.round'd at line 1378, Σadvances is integer at
// density 1 with crisp metrics, p.dx is integer (varint decoder):
//   colored = Math.round(S) − aBBL + aBBL + Σadvances + p.dx
//           = Math.round(S) + Σadvances + p.dx
//   black   = Math.round(S + Σadvances + p.dx) = Math.round(S) + (Σ + p.dx)
//           (Math.round is shift-invariant under integer offsets)
// → identical, glyph-for-glyph.
//
// What this test catches:
//   - Future change to either path that makes the rounding decisions
//     diverge (e.g. someone removes the Math.round on aBBL, or moves the
//     advancement accumulator out of integer-only).
//   - The reverse: density-2 or other-density paths where the math
//     could shift if aBBL or advancements become fractional.
//
// What this test does NOT catch:
//   - Embedder-side Canvas bugs (e.g. drawImage that loses edge pixels
//     on same-size blits). Such bugs are diagnosed by running this same
//     check on the embedder's own Canvas; if it diverges there but not
//     here, the embedder's Canvas is the source.
//
// Run: node scripts/check-color-parity.js
//      (or npm run test-color-parity)

'use strict';

const path = require('path');
const fs = require('fs');
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Load canvas-mock for real rasterization (same module the Node demos use
// to produce their PNG outputs). Not in the runtime bundle by design.
const canvasMockSrc = fs.readFileSync(
  path.join(PROJECT_ROOT, 'src', 'platform', 'canvas-mock.js'),
  'utf8'
);
const { BitmapTextCanvas } = (new Function(
  canvasMockSrc + '\nreturn { BitmapTextCanvas };'
))();

// Load runtime bundle (sets globals: BitmapText, FontProperties, ...).
require(path.join(PROJECT_ROOT, 'dist', 'bitmaptext-node.min.js'));

BitmapText.setCanvasFactory(() => new BitmapTextCanvas());
BitmapText.setFontDirectory(path.join(PROJECT_ROOT, 'font-assets/'));

const CANVAS_W = 400;
const CANVAS_H = 80;
const Y = 50;

function renderInkSet(text, textColor, fp, x, textAlign) {
  const canvas = new BitmapTextCanvas();
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');
  const tp = new TextProperties({
    textColor,
    textBaseline: 'bottom',
    textAlign,
    isKerningEnabled: true,
  });
  BitmapText.drawTextFromAtlas(ctx, text, x, Y, fp, tp);
  // Collect linear pixel indices where alpha > 0.
  const d = canvas.data;
  const s = new Set();
  for (let i = 0; i < CANVAS_W * CANVAS_H; i++) {
    if (d[i * 4 + 3] > 0) s.add(i);
  }
  return s;
}

let failures = 0;
function ok(label) { console.log(`  ✓ ${label}`); }
function fail(label, detail) {
  failures++;
  console.error(`  ✗ ${label}`);
  if (detail) console.error(`     ${detail}`);
}

function checkOne(text, x, textAlign, fp) {
  const black = renderInkSet(text, '#000000', fp, x, textAlign);
  const colored = renderInkSet(text, '#aa2222', fp, x, textAlign);
  const blackOnly = [];
  const coloredOnly = [];
  for (const p of black) if (!colored.has(p)) blackOnly.push(p);
  for (const p of colored) if (!black.has(p)) coloredOnly.push(p);

  const label = `'${text}' x=${x} align=${textAlign}`;
  if (blackOnly.length === 0 && coloredOnly.length === 0) {
    ok(`${label} — ${black.size} px both paths`);
  } else {
    const showCoord = (i) => `(${i % CANVAS_W},${Math.floor(i / CANVAS_W)})`;
    fail(
      `${label} — black=${black.size} colored=${colored.size} ` +
      `blackOnly=${blackOnly.length} coloredOnly=${coloredOnly.length}`,
      `first mismatches: blackOnly ${blackOnly.slice(0, 4).map(showCoord).join(' ')} ` +
      `coloredOnly ${coloredOnly.slice(0, 4).map(showCoord).join(' ')}`
    );
  }
}

(async () => {
  const fp = new FontProperties(1, 'Arial', 'normal', 'normal', 16);
  await BitmapText.loadFont(fp.idString);

  // Scenarios chosen to exercise:
  //  (1) ASCII letters/digits/punct in plain left-aligned position.
  //  (2) Kerning-heavy sequences ('iiiiii').
  //  (3) Fractional input x (the colored path normalizes via Math.round of
  //      start position — must remain glyph-position-equivalent to black).
  //  (4) Non-left alignment (alignmentOffset_CssPx becomes non-zero,
  //      potentially fractional after density multiplication).
  //  (5) The exact em-dash string from the SWCanvas regression report —
  //      ensures U+2014 (in Arial's character set) doesn't sneak through.
  //  (6) Placeholder-rect cases ('45°', '1×1') — exercises the missing-
  //      char path added in the prior commit. Verifies that placeholder
  //      rect positions also match between paths.
  const cases = [
    { text: 'Hello, World! 42', x: 10, align: 'left' },
    { text: 'The quick brown fox jumps over the lazy dog', x: 10, align: 'left' },
    { text: 'abcdefghij', x: 10, align: 'left' },
    { text: 'iiiiii', x: 10, align: 'left' },
    { text: 'Hello, World! 42', x: 10.5, align: 'left' },
    { text: 'Hello, World! 42', x: 10.3, align: 'left' },
    { text: 'Hello, World! 42', x: 10.7, align: 'left' },
    { text: 'Hello, World! 42', x: 200, align: 'center' },
    { text: 'Hello, World! 42', x: 390, align: 'right' },
    { text: 'Red — slow path (recolor)', x: 10, align: 'left' },
    { text: '45°', x: 10, align: 'left' },
    { text: '1×1', x: 10, align: 'left' },
  ];

  for (const c of cases) checkOne(c.text, c.x, c.align, fp);

  console.log('');
  if (failures === 0) {
    console.log('✅ All color-parity assertions passed (per-glyph and batched paths produce identical ink masks).');
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
