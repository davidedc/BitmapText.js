#!/usr/bin/env node
// One-shot Playwright smoke test: loads every demo page under both
// file:// and http:// and reports any console errors / page errors.
// Used to catch asset-pipeline regressions in the browser that hash-verify
// and Node demos won't surface (e.g. a bundle that's missing a needed
// decoder, or a path that breaks under one protocol but not the other).
//
// Usage:
//   node scripts/playwright-smoke-loop.js
//
// Exit status: 0 if all page-loads are clean, non-zero with a per-page
// breakdown otherwise. Pages legitimately log console.warn (e.g. status
// messages from test-renderer) — only console.error / pageerror count.

const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PORT = 8766;

const PAGES = [
  'public/hello-world-demo.html',
  'public/hello-world-demo-bundled.html',
  'public/hello-world-multi-size.html',
  'public/hello-world-multi-size-bundled.html',
  'public/hello-world-with-transforms.html',
  'public/baseline-alignment-demo.html',
  'public/baseline-alignment-demo-bundled.html',
  'public/small-font-size-demo.html',
  'public/small-text-rendering-demo.html',
  'public/small-text-rendering-demo-bundled.html',
  'public/test-renderer.html',
  'public/test-renderer-bundled.html',
];

// Some pages legitimately log console.warn while exercising error paths
// (e.g. test-renderer logs warnings on hash mismatches, status messages).
// We only flag console.error / page.uncaught and let warns through.
function startStaticServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = req.url.split('?')[0];
      const filePath = path.join(PROJECT_ROOT, urlPath);
      if (!filePath.startsWith(PROJECT_ROOT)) { res.statusCode = 403; res.end(); return; }
      fs.stat(filePath, (err, stat) => {
        if (err || !stat.isFile()) { res.statusCode = 404; res.end('Not found: ' + urlPath); return; }
        const ext = path.extname(filePath).toLowerCase();
        const ct = ({
          '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
          '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png',
          '.qoi': 'application/octet-stream', '.svg': 'image/svg+xml',
        })[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', ct);
        fs.createReadStream(filePath).pipe(res);
      });
    });
    server.listen(PORT, () => resolve(server));
    server.on('error', reject);
  });
}

async function visit(browser, url, label) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    // Give async bucket loads a chance to finish even after networkidle
    // (data: URL Image decodes don't show up in network).
    await page.waitForTimeout(1500);
  } catch (e) {
    errors.push(`navigation: ${e.message}`);
  }
  await ctx.close();
  return { label, url, errors };
}

(async () => {
  const server = await startStaticServer();
  const browser = await chromium.launch();
  const results = [];

  for (const p of PAGES) {
    const httpUrl = `http://localhost:${PORT}/${p}`;
    const fileUrl = `file://${path.join(PROJECT_ROOT, p)}`;
    const r1 = await visit(browser, httpUrl, `http  ${p}`);
    const r2 = await visit(browser, fileUrl, `file  ${p}`);
    results.push(r1, r2);
    process.stdout.write(`  ${r1.errors.length === 0 ? '✓' : '✗'} ${r1.label}\n`);
    process.stdout.write(`  ${r2.errors.length === 0 ? '✓' : '✗'} ${r2.label}\n`);
  }

  await browser.close();
  server.close();

  const failing = results.filter(r => r.errors.length > 0);
  console.log('');
  if (failing.length === 0) {
    console.log(`✅ All ${results.length} page-loads clean (${PAGES.length} pages × 2 protocols)`);
    process.exit(0);
  } else {
    console.log(`❌ ${failing.length} page-loads had errors:`);
    for (const f of failing) {
      console.log(`  ${f.label}`);
      for (const e of f.errors) console.log(`    ${e}`);
    }
    process.exit(1);
  }
})();
