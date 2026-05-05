#!/usr/bin/env node

/**
 * Atlas binarity inspector.
 *
 * Scans every QOI, PNG and WebP file under a target directory (default:
 * font-assets/) and flags any atlas that contains anti-aliased pixels —
 * i.e. any pixel whose R, G, B or A channel is neither 0 nor 255.
 *
 * Per CLAUDE.md, glyph atlases are supposed to be binary (pixels on or
 * off). If a file shows AA pixels here, it means either:
 *   - the source QOI was rasterised with AA and the pipeline propagated it, OR
 *   - some downstream encoder/optimiser produced lossy output.
 *
 * For each base atlas we also cross-check that QOI / PNG / WebP all decode
 * to identical pixels (when the file exists for that base). Mismatches
 * indicate the lossy step.
 *
 * Decoders:
 *   - QOI : in-process via lib/QOIDecode.js
 *   - PNG : in-process minimal decoder (8-bit, all colour types, all filters)
 *   - WebP: subprocess `dwebp -pam <file> -o -`, parallelised
 *
 * Usage: node scripts/check-atlas-binary.js [directory]
 *        node scripts/check-atlas-binary.js --json [directory]   # machine-readable
 *        node scripts/check-atlas-binary.js --concurrency=N      # dwebp parallelism (default: cores)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');
const vm = require('vm');
const crypto = require('crypto');
const { spawn } = require('child_process');

// ---- arg parsing ----------------------------------------------------------

const args = process.argv.slice(2);
let targetDir = 'font-assets';
let jsonOut = false;
let concurrency = Math.max(2, os.cpus().length);
let limit = null;

for (const arg of args) {
  if (arg === '--json') jsonOut = true;
  else if (arg.startsWith('--concurrency=')) concurrency = parseInt(arg.split('=')[1], 10);
  else if (arg.startsWith('--limit=')) limit = parseInt(arg.split('=')[1], 10);
  else if (arg.startsWith('--')) { console.error('Unknown flag:', arg); process.exit(2); }
  else targetDir = arg;
}

const absDir = path.resolve(targetDir);
if (!fs.existsSync(absDir) || !fs.statSync(absDir).isDirectory()) {
  console.error(`Directory not found: ${absDir}`);
  process.exit(1);
}

// ---- QOI decoder (load via vm) -------------------------------------------

const qoiSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'QOIDecode.js'), 'utf8');
const qoiCtx = vm.createContext({ Uint8Array, ArrayBuffer, Math, String, Object });
vm.runInContext(qoiSrc + '\nthis.QOIDecode = QOIDecode;', qoiCtx);
const QOIDecode = qoiCtx.QOIDecode;

// ---- PNG decoder ---------------------------------------------------------
// Handles colour types 0/2/3/4/6 at bit depth 8 (and PLTE/tRNS for type 3).
// Returns RGBA Uint8Array. Throws on unsupported variants (interlaced, 16-bit).

function decodePng(buf) {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) if (buf[i] !== sig[i]) throw new Error('not a PNG');
  let pos = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  let palette = null, trns = null;
  const idat = [];
  while (pos < buf.length) {
    const length = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const ds = pos + 8;
    if (type === 'IHDR') {
      width = buf.readUInt32BE(ds);
      height = buf.readUInt32BE(ds + 4);
      bitDepth = buf[ds + 8];
      colorType = buf[ds + 9];
      interlace = buf[ds + 12];
    } else if (type === 'PLTE') {
      palette = Buffer.from(buf.subarray(ds, ds + length));
    } else if (type === 'tRNS') {
      trns = Buffer.from(buf.subarray(ds, ds + length));
    } else if (type === 'IDAT') {
      idat.push(buf.subarray(ds, ds + length));
    } else if (type === 'IEND') {
      break;
    }
    pos = ds + length + 4; // skip CRC
  }
  if (interlace !== 0) throw new Error('interlaced PNG not supported');
  if (bitDepth !== 8) throw new Error(`bit depth ${bitDepth} not supported (only 8)`);

  const channelsByType = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const channels = channelsByType[colorType];
  if (channels === undefined) throw new Error(`color type ${colorType} not supported`);

  const bpp = channels;                   // bytes per pixel (bit depth = 8)
  const stride = width * bpp;             // unfiltered scanline length
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(stride * height);
  let prev = Buffer.alloc(stride);
  let r = 0;
  for (let y = 0; y < height; y++) {
    const filt = raw[r++];
    const cur = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const left = x >= bpp ? cur[x - bpp] : 0;
      const up = prev[x];
      const upLeft = x >= bpp ? prev[x - bpp] : 0;
      let v = raw[r + x];
      switch (filt) {
        case 0: break;
        case 1: v = (v + left) & 0xff; break;
        case 2: v = (v + up) & 0xff; break;
        case 3: v = (v + ((left + up) >> 1)) & 0xff; break;
        case 4: {
          const p = left + up - upLeft;
          const pa = Math.abs(p - left);
          const pb = Math.abs(p - up);
          const pc = Math.abs(p - upLeft);
          const pred = (pa <= pb && pa <= pc) ? left : (pb <= pc) ? up : upLeft;
          v = (v + pred) & 0xff;
          break;
        }
        default: throw new Error(`unknown filter type ${filt}`);
      }
      cur[x] = v;
    }
    cur.copy(out, y * stride);
    prev = cur;
    r += stride;
  }

  // Map to RGBA
  const rgba = new Uint8Array(width * height * 4);
  if (colorType === 6) {
    rgba.set(out);
  } else if (colorType === 2) {
    for (let i = 0, j = 0; i < out.length; i += 3, j += 4) {
      rgba[j] = out[i]; rgba[j + 1] = out[i + 1]; rgba[j + 2] = out[i + 2]; rgba[j + 3] = 255;
    }
  } else if (colorType === 0) {
    for (let i = 0, j = 0; i < out.length; i++, j += 4) {
      rgba[j] = rgba[j + 1] = rgba[j + 2] = out[i]; rgba[j + 3] = 255;
    }
  } else if (colorType === 4) {
    for (let i = 0, j = 0; i < out.length; i += 2, j += 4) {
      rgba[j] = rgba[j + 1] = rgba[j + 2] = out[i]; rgba[j + 3] = out[i + 1];
    }
  } else if (colorType === 3) {
    for (let i = 0, j = 0; i < out.length; i++, j += 4) {
      const idx = out[i];
      rgba[j] = palette[idx * 3];
      rgba[j + 1] = palette[idx * 3 + 1];
      rgba[j + 2] = palette[idx * 3 + 2];
      rgba[j + 3] = (trns && idx < trns.length) ? trns[idx] : 255;
    }
  }
  return { width, height, data: rgba };
}

// ---- WebP decoder (dwebp subprocess) -------------------------------------

function decodeWebpViaDwebp(filePath) {
  return new Promise((resolve, reject) => {
    const child = spawn('/opt/homebrew/bin/dwebp', ['-pam', filePath, '-o', '-'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const chunks = [];
    let stderr = '';
    child.stdout.on('data', (c) => chunks.push(c));
    child.stderr.on('data', (c) => { stderr += c.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`dwebp exited ${code}: ${stderr.trim()}`));
        return;
      }
      try {
        resolve(parsePam(Buffer.concat(chunks)));
      } catch (e) {
        reject(e);
      }
    });
  });
}

function parsePam(buf) {
  let p = 0;
  function readLine() {
    let end = p;
    while (end < buf.length && buf[end] !== 0x0a) end++;
    const s = buf.toString('ascii', p, end);
    p = end + 1;
    return s;
  }
  const magic = readLine();
  if (magic !== 'P7') throw new Error(`bad PAM magic: ${magic}`);
  let width = 0, height = 0, depth = 0;
  while (true) {
    const line = readLine();
    if (line === 'ENDHDR') break;
    const [k, v] = line.split(' ');
    if (k === 'WIDTH') width = +v;
    else if (k === 'HEIGHT') height = +v;
    else if (k === 'DEPTH') depth = +v;
  }
  const pixels = buf.subarray(p);
  let rgba;
  if (depth === 4) {
    rgba = new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength);
  } else if (depth === 3) {
    rgba = new Uint8Array(width * height * 4);
    for (let i = 0, j = 0; i < pixels.length; i += 3, j += 4) {
      rgba[j] = pixels[i]; rgba[j + 1] = pixels[i + 1]; rgba[j + 2] = pixels[i + 2]; rgba[j + 3] = 255;
    }
  } else {
    throw new Error(`unsupported PAM depth ${depth}`);
  }
  return { width, height, data: rgba };
}

// ---- pixel analysis ------------------------------------------------------

function analyse(rgba) {
  // Count: total pixels, AA pixels (any channel ∉ {0,255}), unique colours.
  // AA-pixel histogram capped at 32 entries to keep memory bounded.
  let aaCount = 0;
  const onColors = new Map();      // R<<24|G<<16|B<<8|A → count, only for opaque-ish pixels
  const aaSamples = new Map();     // first <= 16 distinct AA colours
  const total = rgba.length / 4;
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2], a = rgba[i + 3];
    const isAA = (r !== 0 && r !== 255) || (g !== 0 && g !== 255) || (b !== 0 && b !== 255) || (a !== 0 && a !== 255);
    if (isAA) {
      aaCount++;
      if (aaSamples.size < 16) {
        const key = (r << 24) | (g << 16) | (b << 8) | a;
        aaSamples.set(key, (aaSamples.get(key) || 0) + 1);
      } else {
        const key = (r << 24) | (g << 16) | (b << 8) | a;
        if (aaSamples.has(key)) aaSamples.set(key, aaSamples.get(key) + 1);
      }
    }
    // record pixel value for cross-format hash later
    const key = (r << 24) | (g << 16) | (b << 8) | a;
    onColors.set(key, (onColors.get(key) || 0) + 1);
  }
  return { total, aaCount, uniqueColors: onColors.size, aaSamples, fingerprint: fingerprint(rgba) };
}

function fingerprint(rgba) {
  return crypto.createHash('sha1').update(rgba).digest('hex');
}

// ---- driver --------------------------------------------------------------

function listFiles() {
  const all = fs.readdirSync(absDir);
  const qoi = all.filter((f) => f.endsWith('.qoi')).sort();
  const png = all.filter((f) => f.endsWith('.png')).sort();
  const webp = all.filter((f) => f.endsWith('.webp')).sort();
  return { qoi, png, webp };
}

async function main() {
  const { qoi, png, webp } = listFiles();
  if (limit) {
    qoi.length = Math.min(qoi.length, limit);
    png.length = Math.min(png.length, limit);
    webp.length = Math.min(webp.length, limit);
  }
  if (!jsonOut) {
    console.error(`Scanning ${absDir}`);
    console.error(`  qoi: ${qoi.length} png: ${png.length} webp: ${webp.length}`);
    console.error(`  dwebp concurrency: ${concurrency}`);
    console.error('');
  }

  const results = { qoi: [], png: [], webp: [] };

  // --- QOI ---
  await runSerial('qoi', qoi, async (file) => {
    const buf = fs.readFileSync(path.join(absDir, file));
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
    const r = QOIDecode(ab);
    return analyse(r.data);
  }, results.qoi);

  // --- PNG ---
  await runSerial('png', png, async (file) => {
    const buf = fs.readFileSync(path.join(absDir, file));
    const r = decodePng(buf);
    return analyse(r.data);
  }, results.png);

  // --- WebP (parallel) ---
  await runParallel('webp', webp, concurrency, async (file) => {
    const r = await decodeWebpViaDwebp(path.join(absDir, file));
    return analyse(r.data);
  }, results.webp);

  // ---- summarise ---------------------------------------------------------
  const summary = summarise(results);

  if (jsonOut) {
    process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
    return;
  }

  printReport(summary);
}

async function runSerial(label, files, fn, sink) {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const a = await fn(file);
      sink.push({ file, ...a });
    } catch (e) {
      sink.push({ file, error: e.message });
    }
    if (!jsonOut && (i % 200 === 0 || i === files.length - 1)) {
      process.stderr.write(`\r  ${label}: ${i + 1}/${files.length}   `);
    }
  }
  if (!jsonOut && files.length) process.stderr.write('\n');
}

async function runParallel(label, files, concurrency, fn, sink) {
  let next = 0;
  let done = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= files.length) return;
      const file = files[i];
      try {
        const a = await fn(file);
        sink[i] = { file, ...a };
      } catch (e) {
        sink[i] = { file, error: e.message };
      }
      done++;
      if (!jsonOut && (done % 50 === 0 || done === files.length)) {
        process.stderr.write(`\r  ${label}: ${done}/${files.length}   `);
      }
    }
  }
  sink.length = files.length;
  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  if (!jsonOut && files.length) process.stderr.write('\n');
}

// Group results by base name (strip .qoi/.png/.webp) and check fingerprint match.
function summarise(results) {
  const byBase = new Map();
  function add(format, entry) {
    const base = entry.file.replace(/\.(qoi|png|webp)$/, '');
    if (!byBase.has(base)) byBase.set(base, {});
    byBase.get(base)[format] = entry;
  }
  for (const e of results.qoi) add('qoi', e);
  for (const e of results.png) add('png', e);
  for (const e of results.webp) add('webp', e);

  const aaByFormat = { qoi: [], png: [], webp: [] };
  const formatTotal = { qoi: results.qoi.length, png: results.png.length, webp: results.webp.length };
  const aaCountByFormat = { qoi: 0, png: 0, webp: 0 };
  const errorByFormat = { qoi: [], png: [], webp: [] };
  const mismatches = [];

  for (const [base, e] of byBase) {
    for (const fmt of ['qoi', 'png', 'webp']) {
      const r = e[fmt];
      if (!r) continue;
      if (r.error) {
        errorByFormat[fmt].push({ file: r.file, error: r.error });
        continue;
      }
      if (r.aaCount > 0) {
        aaByFormat[fmt].push({
          file: r.file,
          total: r.total,
          aaCount: r.aaCount,
          aaPct: (100 * r.aaCount / r.total).toFixed(3),
          uniqueColors: r.uniqueColors,
          aaSamples: [...r.aaSamples.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([k, n]) => {
              const r2 = (k >>> 24) & 0xff, g2 = (k >>> 16) & 0xff, b2 = (k >>> 8) & 0xff, a2 = k & 0xff;
              return { rgba: [r2, g2, b2, a2], count: n };
            }),
        });
        aaCountByFormat[fmt]++;
      }
    }
    // Fingerprint check
    const fps = ['qoi', 'png', 'webp']
      .map((f) => e[f] && !e[f].error ? { f, fp: e[f].fingerprint } : null)
      .filter(Boolean);
    if (fps.length >= 2) {
      const distinct = new Set(fps.map((x) => x.fp));
      if (distinct.size > 1) {
        mismatches.push({ base, fingerprints: Object.fromEntries(fps.map((x) => [x.f, x.fp])) });
      }
    }
  }

  return { formatTotal, aaCountByFormat, aaByFormat, errorByFormat, mismatches };
}

function printReport(s) {
  console.log('========================================');
  console.log('Atlas binarity report');
  console.log('========================================');
  console.log('');
  console.log('Scanned:');
  for (const fmt of ['qoi', 'png', 'webp']) {
    console.log(`  ${fmt.toUpperCase().padEnd(4)} : ${s.formatTotal[fmt]} files`);
  }
  console.log('');
  console.log('Files with anti-aliased pixels (any channel ∉ {0,255}):');
  for (const fmt of ['qoi', 'png', 'webp']) {
    console.log(`  ${fmt.toUpperCase().padEnd(4)} : ${s.aaCountByFormat[fmt]} / ${s.formatTotal[fmt]}`);
  }
  console.log('');
  console.log('Decode errors:');
  for (const fmt of ['qoi', 'png', 'webp']) {
    console.log(`  ${fmt.toUpperCase().padEnd(4)} : ${s.errorByFormat[fmt].length}`);
    for (const e of s.errorByFormat[fmt].slice(0, 5)) {
      console.log(`    - ${e.file}: ${e.error}`);
    }
    if (s.errorByFormat[fmt].length > 5) {
      console.log(`    ... and ${s.errorByFormat[fmt].length - 5} more`);
    }
  }
  console.log('');
  for (const fmt of ['qoi', 'png', 'webp']) {
    if (s.aaByFormat[fmt].length === 0) continue;
    console.log(`==== AA files in ${fmt.toUpperCase()} (${s.aaByFormat[fmt].length}) ====`);
    s.aaByFormat[fmt].sort((a, b) => parseFloat(b.aaPct) - parseFloat(a.aaPct));
    for (const f of s.aaByFormat[fmt].slice(0, 50)) {
      console.log(`  ${f.file}`);
      console.log(`    AA: ${f.aaCount}/${f.total} = ${f.aaPct}%, unique colors: ${f.uniqueColors}`);
      const top = f.aaSamples.slice(0, 4)
        .map((x) => `rgba(${x.rgba.join(',')})×${x.count}`).join(' ');
      console.log(`    samples: ${top}`);
    }
    if (s.aaByFormat[fmt].length > 50) {
      console.log(`  ... and ${s.aaByFormat[fmt].length - 50} more`);
    }
    console.log('');
  }
  console.log('Cross-format pixel mismatches (same base, different fingerprints):');
  console.log(`  ${s.mismatches.length} bases differ between formats`);
  for (const m of s.mismatches.slice(0, 30)) {
    console.log(`  ${m.base}`);
    for (const [f, fp] of Object.entries(m.fingerprints)) {
      console.log(`    ${f.padEnd(4)}: ${fp}`);
    }
  }
  if (s.mismatches.length > 30) {
    console.log(`  ... and ${s.mismatches.length - 30} more`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
