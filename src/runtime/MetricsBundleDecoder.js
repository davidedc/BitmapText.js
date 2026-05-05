// MetricsBundleDecoder - Async decode of the metrics bundle
//
// Bundle wire format:
//   BitmapText.rBundle("<base64>");
// where <base64> decodes to a `deflate-raw` stream. Decompressing that yields
// UTF-8 JSON of:
//   [
//     ["FamilyName", styleIdx, weightIdx, size, <8-element minified array>],
//     ...
//   ]
//
// Browser and Node 18+ use the standard DecompressionStream + Response API.
// Node ≤ 17 falls back to the built-in `zlib` module.

class MetricsBundleDecoder {
  static async decode(b64) {
    const compressed = MetricsBundleDecoder.#base64ToBytes(b64);
    const inflated = await MetricsBundleDecoder.#inflateRaw(compressed);
    const json = MetricsBundleDecoder.#bytesToString(inflated);
    return JSON.parse(json);
  }

  static #base64ToBytes(b64) {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(b64, 'base64');
    }
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  static async #inflateRaw(bytes) {
    if (typeof DecompressionStream === 'function' && typeof Response === 'function') {
      const stream = new Response(bytes).body.pipeThrough(new DecompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    // Node ≤ 17: no global DecompressionStream. Fall back to zlib.
    if (typeof require === 'function') {
      const zlib = require('zlib');
      const buf = zlib.inflateRawSync(bytes);
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    }
    throw new Error('MetricsBundleDecoder: no DecompressionStream and no zlib fallback available');
  }

  static #bytesToString(bytes) {
    if (typeof TextDecoder === 'function') {
      return new TextDecoder().decode(bytes);
    }
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(bytes).toString('utf8');
    }
    throw new Error('MetricsBundleDecoder: no TextDecoder and no Buffer available');
  }
}
