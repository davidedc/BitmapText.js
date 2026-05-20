#!/usr/bin/env node
//
// Sprint 1 (Round 4) smoke test — covers proposals A + C.
//
// Asserts three things about the platform font loader plumbing:
//   1. The Node bundle's self-registration footer ran on require, so
//      BitmapText._fontLoader === BitmapTextFontLoaderNode after fresh load.
//   2. Explicit BitmapText.setFontLoader(stub) wins after BitmapText.__resetForTesting()
//      resets the registration. The stub's loadFont must be invoked.
//   3. After clear(), with no loader registered, calling a font-loading API
//      throws the new error message — which must name both
//      BitmapTextFontLoaderBrowser / BitmapTextFontLoaderNode and mention
//      setFontLoader as the explicit-injection escape hatch.
//
// Run: node scripts/check-loader-injection.js  (or npm run test-loader-injection)
// Exits non-zero on any failed assertion.

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

// ----- Test 1: default auto-registration on require -----
console.log('1. Auto-registration via FontLoaderNode self-registration footer');
require(path.join(PROJECT_ROOT, 'dist/bitmaptext-node.min.js'));

if (typeof BitmapText === 'undefined') {
  fail('BitmapText is in global scope', 'globalThis.BitmapText not defined');
} else {
  ok('BitmapText is in global scope');
}

if (typeof BitmapTextFontLoaderNode === 'undefined') {
  fail('BitmapTextFontLoaderNode class is in scope', 'class was not declared/exposed by the bundle');
} else {
  ok('BitmapTextFontLoaderNode class is in scope');
}

if (BitmapText._fontLoader !== BitmapTextFontLoaderNode) {
  fail('BitmapText._fontLoader === BitmapTextFontLoaderNode',
       `actual: ${BitmapText._fontLoader && BitmapText._fontLoader.name}`);
} else {
  ok('BitmapText._fontLoader === BitmapTextFontLoaderNode (footer self-registered)');
}

// ----- Test 2: explicit setFontLoader(stub) wins after clear() -----
console.log('\n2. setFontLoader(stub) explicit injection');

class StubLoader extends FontLoaderBase {
  static loadFontCalls = [];
  static async loadFont(idString, options) {
    StubLoader.loadFontCalls.push({ idString, options });
    // Resolve to a benign no-op so the caller doesn't fail downstream.
    return Promise.resolve();
  }
}

BitmapText.__resetForTesting();
if (BitmapText._fontLoader !== null) {
  fail('__resetForTesting() reset _fontLoader to null', `actual: ${BitmapText._fontLoader}`);
} else {
  ok('__resetForTesting() reset _fontLoader to null');
}

BitmapText.setFontLoader(StubLoader);
if (BitmapText._fontLoader !== StubLoader) {
  fail('setFontLoader(StubLoader) sets _fontLoader',
       `actual: ${BitmapText._fontLoader && BitmapText._fontLoader.name}`);
} else {
  ok('setFontLoader(StubLoader) sets _fontLoader');
}

const TEST_ID = 'density-1-0-Arial-style-normal-weight-normal-size-19-0';
BitmapText.loadFont(TEST_ID, { onProgress: () => {} });

if (StubLoader.loadFontCalls.length !== 1) {
  fail('Stub.loadFont was called exactly once',
       `actual calls: ${StubLoader.loadFontCalls.length}`);
} else if (StubLoader.loadFontCalls[0].idString !== TEST_ID) {
  fail('Stub.loadFont received the right idString',
       `got: ${StubLoader.loadFontCalls[0].idString}`);
} else {
  ok('Stub.loadFont received the loadFont call with the right idString');
}

// ----- Test 3: missing-loader error message -----
console.log('\n3. _ensureFontLoader throws the new error when no loader registered');

BitmapText.__resetForTesting();
let caught;
try {
  BitmapText._ensureFontLoader();
} catch (e) {
  caught = e;
}

if (!caught) {
  fail('_ensureFontLoader threw with no loader registered', 'no exception thrown');
} else {
  ok('_ensureFontLoader threw with no loader registered');

  const msg = caught.message;
  const needles = [
    'BitmapTextFontLoaderBrowser',
    'BitmapTextFontLoaderNode',
    'setFontLoader',
  ];
  let missing = needles.filter(n => !msg.includes(n));
  if (missing.length) {
    fail(`Error message names ${needles.join(', ')}`,
         `missing from message: ${missing.join(', ')}\n     actual message: ${msg}`);
  } else {
    ok(`Error message names ${needles.join(', ')}`);
  }
}

// ----- Summary -----
console.log('');
if (failures === 0) {
  console.log('✅ All loader-injection assertions passed.');
  process.exit(0);
} else {
  console.error(`❌ ${failures} assertion(s) failed.`);
  process.exit(1);
}
