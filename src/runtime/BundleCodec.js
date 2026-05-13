// BundleCodec - Shared codec primitives for metrics + positioning bundles
//
// Wire format for both bundle types (`font-assets/metrics-bundle.js` and
// `font-assets/positioning-bundle-density-<N>.js`):
//
//     BitmapText.rBundle('<base64>');           // metrics
//     BitmapText.pBundle(<density>, '<base64>'); // positioning
//
// where <base64> decodes to a `deflate-raw` stream of UTF-8 JSON. The decoded
// JSON is the envelope:
//
//     { formatVersion: <N>, records: [...] }                 // metrics
//     { formatVersion: <N>, density: <D>, records: [...] }   // positioning
//
// `formatVersion` is the runtime↔asset schema version; the single source of
// truth is `BitmapText.BUNDLE_SCHEMA_VERSION`. This module knows nothing
// about that number — it just decodes bytes.
//
// Inside each record's payload, integer streams are encoded as zigzag-varint
// bytes, then base64 — sometimes with a delta pre-pass (for streams whose
// values cluster after sorting or share local locality, like the metrics
// value lookup table and every positioning array). Reusing one helper from
// both the metrics expander and the positioning store keeps the encoders
// and decoders in lockstep.

class BundleCodec {
  // ----- bytes <-> base64 -----

  static base64ToBytes(b64) {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(b64, 'base64');
    }
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  static bytesToBase64(bytes) {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(bytes).toString('base64');
    }
    // Browser: chunked btoa to avoid stack overflow on large inputs.
    const CHUNK = 0x8000;
    let binary = '';
    const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    for (let i = 0; i < arr.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, arr.subarray(i, i + CHUNK));
    }
    return btoa(binary);
  }

  // ----- deflate-raw bundle envelope -----

  static async decodeBundle(b64) {
    const compressed = BundleCodec.base64ToBytes(b64);
    const inflated = await BundleCodec.#inflateRaw(compressed);
    const json = BundleCodec.#bytesToString(inflated);
    return JSON.parse(json);
  }

  static async #inflateRaw(bytes) {
    if (typeof DecompressionStream === 'function' && typeof Response === 'function') {
      const stream = new Response(bytes).body.pipeThrough(new DecompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    if (typeof require === 'function') {
      const zlib = require('zlib');
      const buf = zlib.inflateRawSync(bytes);
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    }
    throw new Error('BundleCodec: no DecompressionStream and no zlib fallback available');
  }

  static #bytesToString(bytes) {
    if (typeof TextDecoder === 'function') {
      return new TextDecoder().decode(bytes);
    }
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(bytes).toString('utf8');
    }
    throw new Error('BundleCodec: no TextDecoder and no Buffer available');
  }

  // ----- zigzag + varint -----
  //
  // Zigzag interleaves signed ints into unsigned: 0,-1,1,-2,2,... → 0,1,2,3,4,...
  // VarInt then encodes 7 bits per byte with MSB as continuation flag, so small
  // magnitudes take 1 byte and large ones grow gracefully. Together they make
  // small absolute values (and small deltas) costliest at 1 byte each.

  static encodeVarInts(signedIntegers) {
    const bytes = [];
    for (const value of signedIntegers) {
      let z = value >= 0 ? value * 2 : -value * 2 - 1;
      while (z >= 128) {
        bytes.push((z & 0x7F) | 0x80);
        z >>>= 7;
      }
      bytes.push(z & 0x7F);
    }
    return new Uint8Array(bytes);
  }

  static decodeVarInts(bytes) {
    const out = [];
    let i = 0;
    while (i < bytes.length) {
      let v = 0;
      let shift = 0;
      let byte;
      do {
        byte = bytes[i++];
        v |= (byte & 0x7F) << shift;
        shift += 7;
      } while (byte & 0x80);
      out.push((v & 1) ? -(v + 1) / 2 : v / 2);
    }
    return out;
  }

  // ----- convenience pairs -----

  static encodeVarIntB64(intArr) {
    return BundleCodec.bytesToBase64(BundleCodec.encodeVarInts(intArr));
  }

  static decodeVarIntB64(b64) {
    return BundleCodec.decodeVarInts(BundleCodec.base64ToBytes(b64));
  }

  // Delta-encode then zigzag-varint-base64. Reverse: decode varints, then
  // prefix-sum. The metrics value-lookup table feeds magnitude-sorted ints
  // here so deltas are small; positioning arrays use this directly on the
  // raw per-glyph integer streams (heights, dy, etc. cluster naturally).
  static encodeDeltaVarIntB64(intArr) {
    if (intArr.length === 0) return '';
    const d = [intArr[0]];
    for (let i = 1; i < intArr.length; i++) d.push(intArr[i] - intArr[i - 1]);
    return BundleCodec.encodeVarIntB64(d);
  }

  static decodeDeltaVarIntB64(b64) {
    if (!b64) return [];
    const deltas = BundleCodec.decodeVarIntB64(b64);
    const out = new Array(deltas.length);
    out[0] = deltas[0];
    for (let i = 1; i < deltas.length; i++) out[i] = out[i - 1] + deltas[i];
    return out;
  }
}
