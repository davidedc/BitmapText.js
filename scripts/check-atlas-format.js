#!/usr/bin/env node
//
// Sprint 4 (Round 4) smoke test — covers proposal D (setAtlasFormat opt-in).
//
// Asserts three things about the atlas storage format:
//   1. Default ('imageElement') path stores the canvas the canvasFactory
//      returned. In this test the factory returns MiniCanvas (a tiny
//      stand-in for canvas-mock), and AtlasDataStore should end up holding
//      that MiniCanvas instance.
//   2. 'imageData' path stores a plain {width, height, data: Uint8ClampedArray}
//      object. NOT an instance of any Canvas class, and `.constructor === Object`.
//   3. Pixel-parity round-trip — bytes from both paths must be byte-identical.
//      Both originate from the same QOIDecode output; only the wrapper differs.
//      This proves the imageData path doesn't lose or alter pixel data.
//
// The two paths use separate child processes so BitmapText._atlasFormat is
// independent between them (clean boot for each).
//
// Run: node scripts/check-atlas-format.js  (or npm run test-atlas-format)
// Exits non-zero on any failed assertion.

'use strict';

const path = require('path');
const child_process = require('child_process');
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Font that's known to be in font-assets/ (used by the hello-world demo).
const TEST_ID = 'density-1-0-Arial-style-normal-weight-normal-size-19-0';

// The two child processes each print one JSON line to stdout reporting:
//   {
//     constructor: 'MiniCanvas' | 'Object',
//     width: number,
//     height: number,
//     dataKind: 'Uint8ClampedArray' | 'other',
//     dataLength: number,
//     dataHash: hex SHA-256 of the data bytes
//   }
//
// The parent reads both lines and asserts.

const child = `
'use strict';
const crypto = require('crypto');
const path = require('path');

// Tiny stand-in for canvas-mock. Mimics the surface FontLoaderNode needs
// (width, height, getContext('2d') with createImageData + putImageData).
class MiniCanvas {
  constructor() { this.width = 0; this.height = 0; this.data = null; }
  getContext() { return new MiniCtx(this); }
}
class MiniCtx {
  constructor(c) { this.c = c; }
  createImageData(w, h) {
    return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
  }
  putImageData(imgData) {
    this.c.data = imgData.data;
    this.c.width = imgData.width;
    this.c.height = imgData.height;
  }
}

require('${path.join(PROJECT_ROOT, 'dist/bitmaptext-node.min.js').replace(/\\\\/g, '\\\\\\\\')}');

BitmapText.setCanvasFactory(() => new MiniCanvas());
if (process.env.ATLAS_FORMAT_MODE === 'imageData') {
  BitmapText.setAtlasFormat('imageData');
}
BitmapText.setFontDirectory('${path.join(PROJECT_ROOT, 'font-assets/').replace(/\\\\/g, '\\\\\\\\')}');

(async () => {
  await BitmapText.loadFont('${TEST_ID}');
  const fp = FontProperties.fromIDString('${TEST_ID}');
  const atlasData = AtlasDataStore.getAtlasData(fp);
  if (!atlasData) {
    console.error(JSON.stringify({ error: 'no AtlasData' }));
    process.exit(2);
  }
  const img = atlasData.atlasImage.image;
  const data = img.data instanceof Uint8ClampedArray ? img.data : null;
  const hash = data ? crypto.createHash('sha256').update(Buffer.from(data.buffer, data.byteOffset, data.byteLength)).digest('hex') : null;
  console.log(JSON.stringify({
    constructor: img && img.constructor && img.constructor.name,
    width: img.width,
    height: img.height,
    dataKind: data ? 'Uint8ClampedArray' : 'other',
    dataLength: data ? data.length : null,
    dataHash: hash
  }));
})().catch(e => {
  console.error(JSON.stringify({ error: String(e && e.message || e) }));
  process.exit(2);
});
`;

function runChild(mode) {
  const out = child_process.spawnSync('node', ['-e', child], {
    encoding: 'utf8',
    cwd: PROJECT_ROOT,
    env: { ...process.env, ATLAS_FORMAT_MODE: mode },
  });
  if (out.status !== 0) {
    console.error(`child (mode=${mode}) failed with status ${out.status}`);
    console.error('stderr:', out.stderr);
    process.exit(1);
  }
  // Last non-empty line of stdout is our JSON report; earlier lines are
  // runtime logging (atlas-fetch etc.).
  const lines = out.stdout.split('\n').filter(s => s.trim());
  const last = lines[lines.length - 1];
  try {
    return JSON.parse(last);
  } catch (e) {
    console.error(`child (mode=${mode}) returned non-JSON last line: "${last}"`);
    console.error('full stdout:', out.stdout);
    process.exit(1);
  }
}

let failures = 0;
function ok(label) { console.log(`  ✓ ${label}`); }
function fail(label, detail) {
  failures++;
  console.error(`  ✗ ${label}`);
  if (detail) console.error(`     ${detail}`);
}

console.log('1. Default \'imageElement\' path stores the configured Canvas instance');
const def = runChild('default');
if (def.error) {
  fail('default path loaded the atlas', `child error: ${def.error}`);
} else {
  if (def.constructor !== 'MiniCanvas') {
    fail('atlasImage.image.constructor.name === MiniCanvas',
         `actual: ${def.constructor}`);
  } else {
    ok('atlasImage.image is a MiniCanvas instance');
  }
  if (def.dataKind !== 'Uint8ClampedArray') {
    fail('atlasImage.image.data is Uint8ClampedArray', `actual kind: ${def.dataKind}`);
  } else {
    ok('atlasImage.image.data is Uint8ClampedArray');
  }
}

console.log('\n2. \'imageData\' path stores a plain {width,height,data} object');
const idata = runChild('imageData');
if (idata.error) {
  fail('imageData path loaded the atlas', `child error: ${idata.error}`);
} else {
  if (idata.constructor !== 'Object') {
    fail('atlasImage.image.constructor.name === Object',
         `actual: ${idata.constructor} (expected a plain object, not a class instance)`);
  } else {
    ok('atlasImage.image is a plain Object');
  }
  if (idata.dataKind !== 'Uint8ClampedArray') {
    fail('atlasImage.image.data is Uint8ClampedArray', `actual kind: ${idata.dataKind}`);
  } else {
    ok('atlasImage.image.data is Uint8ClampedArray');
  }
  if (typeof idata.width !== 'number' || typeof idata.height !== 'number') {
    fail('atlasImage.image has numeric width/height',
         `width: ${typeof idata.width}, height: ${typeof idata.height}`);
  } else {
    ok('atlasImage.image has numeric width/height');
  }
}

console.log('\n3. Pixel-parity round-trip — bytes identical between the two paths');
if (def.error || idata.error) {
  fail('both paths completed', 'one of the paths failed (see above)');
} else {
  if (def.width !== idata.width || def.height !== idata.height) {
    fail('width/height match between paths',
         `default: ${def.width}x${def.height}, imageData: ${idata.width}x${idata.height}`);
  } else {
    ok(`width/height match (${def.width}x${def.height})`);
  }
  if (def.dataLength !== idata.dataLength) {
    fail('data byte-length matches', `default: ${def.dataLength}, imageData: ${idata.dataLength}`);
  } else {
    ok(`data byte-length matches (${def.dataLength} bytes)`);
  }
  if (def.dataHash !== idata.dataHash) {
    fail('SHA-256 of data bytes matches',
         `default: ${def.dataHash}\\n     imageData: ${idata.dataHash}`);
  } else {
    ok(`SHA-256 of data bytes matches (${def.dataHash && def.dataHash.slice(0, 16)}…)`);
  }
}

console.log('');
if (failures === 0) {
  console.log('✅ All atlas-format assertions passed.');
  process.exit(0);
} else {
  console.error(`❌ ${failures} assertion(s) failed.`);
  process.exit(1);
}
