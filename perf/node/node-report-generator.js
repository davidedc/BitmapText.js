/**
 * Node.js HTML Report Generator for BitmapText.js Performance Benchmarks
 */

const fs = require('fs');
const path = require('path');

/**
 * Generate HTML report from benchmark results
 */
function generate(results) {
  const timestamp = Date.now();
  const outputPath = path.join(__dirname, `report-${timestamp}.html`);

  const html = generateHTML(results);
  fs.writeFileSync(outputPath, html);

  return outputPath;
}

/**
 * Generate complete HTML document
 */
function generateHTML(results) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BitmapText.js Node.js Performance Report</title>
  <style>
    ${getCSS()}
  </style>
</head>
<body>
  <h1>BitmapText.js Node.js Performance Report</h1>
  <p class="subtitle">Generated on ${new Date(results.timestamp).toLocaleString()}</p>

  ${generatePlatformSection(results.platform)}
  ${generateFontLoadingSection(results)}
  ${generateComparisonTable(results)}
  ${generateDetailedResults(results)}
  ${generateCharts(results)}
  ${generateRawData(results)}
</body>
</html>`;
}

/**
 * Get CSS styles
 */
function getCSS() {
  return `
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
      color: #333;
      line-height: 1.6;
    }
    h1 {
      color: #2c3e50;
      border-bottom: 3px solid #3498db;
      padding-bottom: 10px;
    }
    h2 {
      color: #34495e;
      border-bottom: 2px solid #95a5a6;
      padding-bottom: 8px;
      margin-top: 30px;
    }
    .subtitle {
      color: #7f8c8d;
      font-style: italic;
      margin-top: -10px;
      margin-bottom: 30px;
    }
    .section {
      background: white;
      padding: 20px;
      margin-bottom: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    th {
      background-color: #34495e;
      color: white;
      padding: 12px;
      text-align: left;
      font-weight: 600;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #ecf0f1;
    }
    tr:hover {
      background-color: #f8f9fa;
    }
    tr:nth-child(even) {
      background-color: #fafafa;
    }
    .highlight {
      background-color: #d5f4e6 !important;
      font-weight: 600;
    }
    .chart {
      margin: 20px 0;
      text-align: center;
    }
    .bar-chart {
      display: flex;
      align-items: flex-end;
      justify-content: space-around;
      height: 300px;
      background: white;
      padding: 20px;
      border: 1px solid #ddd;
      border-radius: 5px;
    }
    .bar {
      flex: 1;
      margin: 0 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
    }
    .bar-fill {
      width: 100%;
      background: linear-gradient(to top, #3498db, #5dade2);
      border-radius: 5px 5px 0 0;
      transition: all 0.3s;
    }
    .bar-label {
      margin-top: 10px;
      font-size: 12px;
      text-align: center;
      font-weight: 600;
    }
    .bar-value {
      margin-bottom: 5px;
      font-size: 14px;
      font-weight: 600;
      color: #2c3e50;
    }
    pre {
      background-color: #2c3e50;
      color: #ecf0f1;
      padding: 15px;
      border-radius: 5px;
      overflow-x: auto;
      font-size: 12px;
      line-height: 1.4;
    }
    .success {
      color: #27ae60;
      font-weight: 600;
    }
    .warning {
      color: #f39c12;
      font-weight: 600;
    }
  `;
}

/**
 * Generate platform information section
 */
function generatePlatformSection(platform) {
  return `
  <div class="section">
    <h2>Platform Information</h2>
    <table>
      <tr><th>Property</th><th>Value</th></tr>
      <tr><td>Operating System</td><td>${platform.os}</td></tr>
      <tr><td>Node.js Version</td><td>${platform.nodeVersion}</td></tr>
      <tr><td>Architecture</td><td>${platform.arch}</td></tr>
    </table>
  </div>`;
}

/**
 * Generate font loading section
 */
function generateFontLoadingSection(results) {
  return `
  <div class="section">
    <h2>Font Loading Performance</h2>
    <table>
      <tr><th>Version</th><th>Font ID</th><th>Load Time</th></tr>
      <tr>
        <td>Unbundled</td>
        <td>${results.unbundled.fontLoading.fontId}</td>
        <td>${results.unbundled.fontLoading.loadTime.toFixed(2)}ms</td>
      </tr>
      <tr>
        <td>Bundled</td>
        <td>${results.bundled.fontLoading.fontId}</td>
        <td>${results.bundled.fontLoading.loadTime.toFixed(2)}ms</td>
      </tr>
    </table>
  </div>`;
}

/**
 * Generate comparison table
 */
function generateComparisonTable(results) {
  let rows = '';

  // Compare each test case
  const testNames = results.unbundled.tests.map(t => t.name);

  testNames.forEach(testName => {
    const unbundled = results.unbundled.tests.find(t => t.name === testName);
    const bundled = results.bundled.tests.find(t => t.name === testName);

    if (unbundled && bundled) {
      const ratio = bundled.avgTime / unbundled.avgTime;
      const faster = ratio < 1 ? 'bundled' : 'unbundled';
      const percentage = Math.abs((1 - ratio) * 100).toFixed(1);

      rows += `
      <tr>
        <td>${testName}</td>
        <td>${unbundled.avgTime.toFixed(3)}ms</td>
        <td>${bundled.avgTime.toFixed(3)}ms</td>
        <td>${ratio.toFixed(2)}x</td>
        <td class="${ratio < 0.95 ? 'success' : ratio > 1.05 ? 'warning' : ''}">
          ${faster === 'bundled' ? '✅' : '⚠️'} ${faster} is ${percentage}% faster
        </td>
      </tr>`;
    }
  });

  return `
  <div class="section">
    <h2>Bundled vs Unbundled Comparison</h2>
    <table>
      <tr>
        <th>Test Case</th>
        <th>Unbundled</th>
        <th>Bundled</th>
        <th>Ratio</th>
        <th>Analysis</th>
      </tr>
      ${rows}
    </table>
  </div>`;
}

/**
 * Generate detailed results
 */
function generateDetailedResults(results) {
  return `
  <div class="section">
    <h2>Detailed Results: Unbundled</h2>
    ${generateResultTable(results.unbundled.tests)}
  </div>

  <div class="section">
    <h2>Detailed Results: Bundled</h2>
    ${generateResultTable(results.bundled.tests)}
  </div>`;
}

/**
 * Generate result table for tests
 */
function generateResultTable(tests) {
  let rows = '';

  tests.forEach(test => {
    rows += `
    <tr>
      <td>${test.name}</td>
      <td>${test.blockCount}</td>
      <td>${test.iterations}</td>
      <td>${test.avgTime.toFixed(3)}ms</td>
      <td>${test.totalTime.toFixed(2)}ms</td>
      <td>${test.opsPerSecond.toFixed(0)}</td>
    </tr>`;
  });

  return `
  <table>
    <tr>
      <th>Test Case</th>
      <th>Blocks</th>
      <th>Iterations</th>
      <th>Avg Time</th>
      <th>Total Time</th>
      <th>Ops/Sec</th>
    </tr>
    ${rows}
  </table>`;
}

/**
 * Generate charts
 */
function generateCharts(results) {
  const singleBlackUnbundled = results.unbundled.tests.find(t => t.name === 'Single block (black)');
  const singleBlackBundled = results.bundled.tests.find(t => t.name === 'Single block (black)');
  const tenBlocksBlackUnbundled = results.unbundled.tests.find(t => t.name === '10 blocks (black)');
  const tenBlocksBlackBundled = results.bundled.tests.find(t => t.name === '10 blocks (black)');

  const maxTime = Math.max(
    singleBlackUnbundled?.avgTime || 0,
    singleBlackBundled?.avgTime || 0,
    tenBlocksBlackUnbundled?.avgTime || 0,
    tenBlocksBlackBundled?.avgTime || 0
  );

  return `
  <div class="section">
    <h2>Performance Charts</h2>
    <div class="chart">
      <h3>Average Render Time (lower is better)</h3>
      <div class="bar-chart">
        ${generateBar('Single Block\n(Unbundled)', singleBlackUnbundled?.avgTime || 0, maxTime, 'ms')}
        ${generateBar('Single Block\n(Bundled)', singleBlackBundled?.avgTime || 0, maxTime, 'ms')}
        ${generateBar('10 Blocks\n(Unbundled)', tenBlocksBlackUnbundled?.avgTime || 0, maxTime, 'ms')}
        ${generateBar('10 Blocks\n(Bundled)', tenBlocksBlackBundled?.avgTime || 0, maxTime, 'ms')}
      </div>
    </div>
  </div>`;
}

/**
 * Generate bar for chart
 */
function generateBar(label, value, maxValue, unit) {
  const heightPercent = (value / maxValue) * 100;
  return `
  <div class="bar">
    <div class="bar-value">${value.toFixed(3)}${unit}</div>
    <div class="bar-fill" style="height: ${heightPercent}%;"></div>
    <div class="bar-label">${label}</div>
  </div>`;
}

/**
 * Generate raw data section
 */
function generateRawData(results) {
  return `
  <div class="section">
    <h2>Raw Data (JSON)</h2>
    <pre>${JSON.stringify(results, null, 2)}</pre>
  </div>`;
}

module.exports = {
  generate
};
