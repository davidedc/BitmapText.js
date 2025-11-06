#!/usr/bin/env node

/**
 * Comprehensive Performance Report Generator
 * Combines Node.js and Browser profiling data to generate
 * a ranked list of performance improvement opportunities
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, 'output');
const NODE_ANALYSIS = path.join(OUTPUT_DIR, 'node', 'analysis', 'node-profile-analysis.json');
const BROWSER_ANALYSIS = path.join(OUTPUT_DIR, 'browser', 'analysis', 'browser-profile-analysis.json');

/**
 * Load analysis files
 */
function loadAnalysis(filePath, name) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ ${name} analysis not found: ${filePath}`);
    console.error(`   Please run the profiling first.`);
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error(`❌ Error loading ${name}:`, error.message);
    return null;
  }
}

/**
 * Extract all optimization opportunities
 */
function extractOptimizations(nodeData, browserData) {
  const opportunities = [];

  // Helper to add opportunity
  function addOpportunity(source, benchmark, recommendation, categoryData) {
    opportunities.push({
      source, // 'node' or 'browser'
      benchmark, // 'measurement' or 'rendering'
      priority: recommendation.priority,
      category: recommendation.category,
      issue: recommendation.issue,
      suggestion: recommendation.suggestion,
      functions: recommendation.functions || [],
      impact: categoryData?.percentage || 0,
      functionCount: categoryData?.functionCount || 0
    });
  }

  // Extract from Node.js data
  if (nodeData) {
    if (nodeData.measurement) {
      nodeData.measurement.recommendations.forEach(rec => {
        const categoryData = nodeData.measurement.categoryBreakdown[rec.category];
        addOpportunity('node', 'measurement', rec, categoryData);
      });
    }

    if (nodeData.rendering) {
      nodeData.rendering.recommendations.forEach(rec => {
        const categoryData = nodeData.rendering.categoryBreakdown[rec.category];
        addOpportunity('node', 'rendering', rec, categoryData);
      });
    }
  }

  // Extract from Browser data
  if (browserData) {
    if (browserData.measurement?.analysis) {
      browserData.measurement.analysis.recommendations.forEach(rec => {
        const categoryData = browserData.measurement.analysis.categoryBreakdown[rec.category];
        addOpportunity('browser', 'measurement', rec, categoryData);
      });
    }

    if (browserData.rendering?.analysis) {
      browserData.rendering.analysis.recommendations.forEach(rec => {
        const categoryData = browserData.rendering.analysis.categoryBreakdown[rec.category];
        addOpportunity('browser', 'rendering', rec, categoryData);
      });
    }
  }

  return opportunities;
}

/**
 * Consolidate and rank opportunities
 */
function rankOptimizations(opportunities) {
  // Group by category and calculate aggregate impact
  const grouped = {};

  opportunities.forEach(opp => {
    const key = opp.category;

    if (!grouped[key]) {
      grouped[key] = {
        category: opp.category,
        occurrences: [],
        totalImpact: 0,
        avgImpact: 0,
        maxImpact: 0,
        affectedBenchmarks: new Set(),
        affectedSources: new Set(),
        allFunctions: new Set(),
        suggestions: new Set(),
        priority: 'MEDIUM'
      };
    }

    grouped[key].occurrences.push(opp);
    grouped[key].totalImpact += opp.impact;
    grouped[key].maxImpact = Math.max(grouped[key].maxImpact, opp.impact);
    grouped[key].affectedBenchmarks.add(opp.benchmark);
    grouped[key].affectedSources.add(opp.source);
    grouped[key].suggestions.add(opp.suggestion);
    opp.functions.forEach(f => grouped[key].allFunctions.add(f));

    // Upgrade priority if any occurrence is higher
    const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    if (priorities.indexOf(opp.priority) > priorities.indexOf(grouped[key].priority)) {
      grouped[key].priority = opp.priority;
    }
  });

  // Calculate average impact and convert sets to arrays
  Object.values(grouped).forEach(group => {
    group.avgImpact = group.totalImpact / group.occurrences.length;
    group.affectedBenchmarks = Array.from(group.affectedBenchmarks);
    group.affectedSources = Array.from(group.affectedSources);
    group.allFunctions = Array.from(group.allFunctions);
    group.suggestions = Array.from(group.suggestions);
  });

  // Sort by priority and impact
  const priorityWeight = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
  const ranked = Object.values(grouped).sort((a, b) => {
    // First by priority
    const priorityDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
    if (priorityDiff !== 0) return priorityDiff;

    // Then by max impact
    const impactDiff = b.maxImpact - a.maxImpact;
    if (impactDiff !== 0) return impactDiff;

    // Then by number of occurrences
    return b.occurrences.length - a.occurrences.length;
  });

  return ranked;
}

/**
 * Generate detailed category analysis
 */
function analyzeCategoryDistribution(nodeData, browserData) {
  const categories = {};

  function addCategoryData(source, benchmark, categoryBreakdown) {
    Object.entries(categoryBreakdown).forEach(([category, data]) => {
      if (!categories[category]) {
        categories[category] = {
          category,
          measurements: {}
        };
      }

      const key = `${source}-${benchmark}`;
      categories[category].measurements[key] = {
        percentage: data.percentage,
        time: data.time,
        functionCount: data.functionCount
      };
    });
  }

  if (nodeData) {
    if (nodeData.measurement?.categoryBreakdown) {
      addCategoryData('node', 'measurement', nodeData.measurement.categoryBreakdown);
    }
    if (nodeData.rendering?.categoryBreakdown) {
      addCategoryData('node', 'rendering', nodeData.rendering.categoryBreakdown);
    }
  }

  if (browserData) {
    if (browserData.measurement?.analysis?.categoryBreakdown) {
      addCategoryData('browser', 'measurement', browserData.measurement.analysis.categoryBreakdown);
    }
    if (browserData.rendering?.analysis?.categoryBreakdown) {
      addCategoryData('browser', 'rendering', browserData.rendering.analysis.categoryBreakdown);
    }
  }

  return Object.values(categories);
}

/**
 * Generate text report
 */
function generateTextReport(ranked, categoryAnalysis, outputPath) {
  let report = '';

  report += '═══════════════════════════════════════════════════════════════\n';
  report += '  BitmapText.js Comprehensive Performance Analysis\n';
  report += '  Ranked Performance Improvement Opportunities\n';
  report += '═══════════════════════════════════════════════════════════════\n';
  report += `\nGenerated: ${new Date().toISOString()}\n\n`;

  report += 'This report combines profiling data from all four benchmarks:\n';
  report += '  • Node.js Measurement Benchmark\n';
  report += '  • Node.js Rendering Benchmark\n';
  report += '  • Browser Measurement Benchmark\n';
  report += '  • Browser Rendering Benchmark\n\n';

  report += '═══════════════════════════════════════════════════════════════\n';
  report += '  RANKED PERFORMANCE IMPROVEMENTS\n';
  report += '═══════════════════════════════════════════════════════════════\n\n';

  ranked.forEach((opp, index) => {
    const rank = index + 1;
    report += `${rank}. [${opp.priority}] ${opp.category}\n`;
    report += `${'─'.repeat(63)}\n`;

    report += `\n   Impact:\n`;
    report += `     • Maximum Impact:     ${opp.maxImpact.toFixed(2)}% of execution time\n`;
    report += `     • Average Impact:     ${opp.avgImpact.toFixed(2)}% of execution time\n`;
    report += `     • Occurrences:        ${opp.occurrences.length} across benchmarks\n`;

    report += `\n   Affected Areas:\n`;
    report += `     • Benchmarks:         ${opp.affectedBenchmarks.join(', ')}\n`;
    report += `     • Environments:       ${opp.affectedSources.join(', ')}\n`;
    report += `     • Total Functions:    ${opp.allFunctions.length}\n`;

    if (opp.allFunctions.length > 0 && opp.allFunctions.length <= 10) {
      report += `\n   Hot Functions:\n`;
      opp.allFunctions.forEach(func => {
        report += `     • ${func}\n`;
      });
    } else if (opp.allFunctions.length > 10) {
      report += `\n   Top Hot Functions:\n`;
      opp.allFunctions.slice(0, 10).forEach(func => {
        report += `     • ${func}\n`;
      });
      report += `     ... and ${opp.allFunctions.length - 10} more\n`;
    }

    report += `\n   Recommendations:\n`;
    opp.suggestions.forEach(suggestion => {
      report += `     • ${suggestion}\n`;
    });

    report += `\n   Details by Benchmark:\n`;
    opp.occurrences.forEach(occur => {
      report += `     • ${occur.source}/${occur.benchmark}: ${occur.impact.toFixed(2)}% - ${occur.issue}\n`;
    });

    report += '\n';
  });

  report += '═══════════════════════════════════════════════════════════════\n';
  report += '  CATEGORY TIME DISTRIBUTION\n';
  report += '═══════════════════════════════════════════════════════════════\n\n';

  report += 'Time spent in each category across all benchmarks:\n\n';

  report += `${'Category'.padEnd(25)} | ${'Node/Meas'.padStart(10)} | ${'Node/Rend'.padStart(10)} | ${'Brow/Meas'.padStart(10)} | ${'Brow/Rend'.padStart(10)}\n`;
  report += `${'-'.repeat(25)}-+-${'-'.repeat(10)}-+-${'-'.repeat(10)}-+-${'-'.repeat(10)}-+-${'-'.repeat(10)}\n`;

  categoryAnalysis
    .sort((a, b) => {
      const aMax = Math.max(...Object.values(a.measurements).map(m => m.percentage || 0));
      const bMax = Math.max(...Object.values(b.measurements).map(m => m.percentage || 0));
      return bMax - aMax;
    })
    .forEach(cat => {
      const nm = cat.measurements['node-measurement']?.percentage || 0;
      const nr = cat.measurements['node-rendering']?.percentage || 0;
      const bm = cat.measurements['browser-measurement']?.percentage || 0;
      const br = cat.measurements['browser-rendering']?.percentage || 0;

      if (nm > 0.5 || nr > 0.5 || bm > 0.5 || br > 0.5) {
        report += `${cat.category.padEnd(25)} | ${nm.toFixed(2).padStart(8)}%  | ${nr.toFixed(2).padStart(8)}%  | ${bm.toFixed(2).padStart(8)}%  | ${br.toFixed(2).padStart(8)}% \n`;
      }
    });

  report += '\n';

  report += '═══════════════════════════════════════════════════════════════\n';
  report += '  SUMMARY & NEXT STEPS\n';
  report += '═══════════════════════════════════════════════════════════════\n\n';

  report += 'Priority Actions:\n\n';

  const critical = ranked.filter(r => r.priority === 'CRITICAL');
  const high = ranked.filter(r => r.priority === 'HIGH');

  if (critical.length > 0) {
    report += 'CRITICAL Priority Items:\n';
    critical.forEach((item, idx) => {
      report += `  ${idx + 1}. ${item.category} (${item.maxImpact.toFixed(1)}% impact)\n`;
    });
    report += '\n';
  }

  if (high.length > 0) {
    report += 'HIGH Priority Items:\n';
    high.forEach((item, idx) => {
      report += `  ${idx + 1}. ${item.category} (${item.maxImpact.toFixed(1)}% impact)\n`;
    });
    report += '\n';
  }

  report += 'Recommended approach:\n';
  report += '  1. Start with CRITICAL priority items first\n';
  report += '  2. Focus on items that affect multiple benchmarks\n';
  report += '  3. Optimize hot functions identified in each category\n';
  report += '  4. Re-profile after each optimization to measure improvement\n';
  report += '  5. Document performance gains\n\n';

  report += 'For detailed profiling data, see:\n';
  report += '  • Node profiles:    perf/profiling/output/node/\n';
  report += '  • Browser profiles: perf/profiling/output/browser/\n';
  report += '  • Flame graphs:     Open HTML files in browser\n';
  report += '  • Trace files:      Open in chrome://tracing\n\n';

  fs.writeFileSync(outputPath, report);
  console.log(`✅ Text report saved: ${outputPath}`);
}

/**
 * Generate JSON report
 */
function generateJSONReport(ranked, categoryAnalysis, nodeData, browserData, outputPath) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalOpportunities: ranked.length,
      criticalCount: ranked.filter(r => r.priority === 'CRITICAL').length,
      highCount: ranked.filter(r => r.priority === 'HIGH').length,
      mediumCount: ranked.filter(r => r.priority === 'MEDIUM').length,
      lowCount: ranked.filter(r => r.priority === 'LOW').length
    },
    rankedOptimizations: ranked,
    categoryDistribution: categoryAnalysis,
    rawData: {
      node: nodeData,
      browser: browserData
    }
  };

  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`✅ JSON report saved: ${outputPath}`);
}

/**
 * Generate HTML report
 */
function generateHTMLReport(ranked, categoryAnalysis, outputPath) {
  const priorityColors = {
    'CRITICAL': '#d32f2f',
    'HIGH': '#f57c00',
    'MEDIUM': '#fbc02d',
    'LOW': '#388e3c'
  };

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BitmapText.js Performance Analysis</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      line-height: 1.6;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .header h1 {
      margin: 0 0 10px 0;
    }
    .header p {
      margin: 5px 0;
      opacity: 0.9;
    }
    .opportunity {
      background: white;
      padding: 20px;
      margin-bottom: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      border-left: 4px solid #ccc;
    }
    .opportunity.critical { border-left-color: #d32f2f; }
    .opportunity.high { border-left-color: #f57c00; }
    .opportunity.medium { border-left-color: #fbc02d; }
    .opportunity.low { border-left-color: #388e3c; }
    .opportunity-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }
    .opportunity-title {
      font-size: 1.3em;
      font-weight: bold;
      color: #333;
    }
    .priority-badge {
      padding: 5px 12px;
      border-radius: 4px;
      color: white;
      font-weight: bold;
      font-size: 0.85em;
    }
    .impact-metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin: 15px 0;
    }
    .metric {
      background: #f5f5f5;
      padding: 12px;
      border-radius: 4px;
    }
    .metric-label {
      font-size: 0.85em;
      color: #666;
      margin-bottom: 5px;
    }
    .metric-value {
      font-size: 1.3em;
      font-weight: bold;
      color: #333;
    }
    .section {
      background: white;
      padding: 20px;
      margin-bottom: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .section h2 {
      margin-top: 0;
      color: #333;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    th, td {
      padding: 10px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background: #f5f5f5;
      font-weight: bold;
    }
    .function-list {
      list-style: none;
      padding: 0;
    }
    .function-list li {
      padding: 5px 0 5px 20px;
      position: relative;
    }
    .function-list li:before {
      content: "→";
      position: absolute;
      left: 0;
      color: #667eea;
    }
    .suggestions {
      background: #e3f2fd;
      padding: 15px;
      border-radius: 4px;
      border-left: 3px solid #2196f3;
    }
    .suggestions ul {
      margin: 10px 0 0 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔬 BitmapText.js Performance Analysis</h1>
    <p>Comprehensive profiling of Node.js and Browser benchmarks</p>
    <p>Generated: ${new Date().toISOString()}</p>
  </div>

  <div class="section">
    <h2>📊 Executive Summary</h2>
    <div class="impact-metrics">
      <div class="metric">
        <div class="metric-label">Total Opportunities</div>
        <div class="metric-value">${ranked.length}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Critical Priority</div>
        <div class="metric-value" style="color: #d32f2f;">${ranked.filter(r => r.priority === 'CRITICAL').length}</div>
      </div>
      <div class="metric">
        <div class="metric-label">High Priority</div>
        <div class="metric-value" style="color: #f57c00;">${ranked.filter(r => r.priority === 'HIGH').length}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Medium Priority</div>
        <div class="metric-value" style="color: #fbc02d;">${ranked.filter(r => r.priority === 'MEDIUM').length}</div>
      </div>
    </div>
  </div>

  <h2 style="margin-top: 40px; color: #333;">⚡ Ranked Performance Improvements</h2>
`;

  ranked.forEach((opp, index) => {
    const priorityClass = opp.priority.toLowerCase();
    const priorityColor = priorityColors[opp.priority];

    html += `
  <div class="opportunity ${priorityClass}">
    <div class="opportunity-header">
      <div class="opportunity-title">${index + 1}. ${opp.category}</div>
      <div class="priority-badge" style="background-color: ${priorityColor};">${opp.priority}</div>
    </div>

    <div class="impact-metrics">
      <div class="metric">
        <div class="metric-label">Maximum Impact</div>
        <div class="metric-value">${opp.maxImpact.toFixed(2)}%</div>
      </div>
      <div class="metric">
        <div class="metric-label">Average Impact</div>
        <div class="metric-value">${opp.avgImpact.toFixed(2)}%</div>
      </div>
      <div class="metric">
        <div class="metric-label">Occurrences</div>
        <div class="metric-value">${opp.occurrences.length}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Affected Benchmarks</div>
        <div class="metric-value" style="font-size: 0.9em;">${opp.affectedBenchmarks.join(', ')}</div>
      </div>
    </div>

    <div class="suggestions">
      <strong>💡 Recommendations:</strong>
      <ul>
        ${opp.suggestions.map(s => `<li>${s}</li>`).join('')}
      </ul>
    </div>

    ${opp.allFunctions.length > 0 ? `
    <div style="margin-top: 15px;">
      <strong>🔥 Hot Functions:</strong>
      <ul class="function-list">
        ${opp.allFunctions.slice(0, 10).map(f => `<li><code>${f}</code></li>`).join('')}
        ${opp.allFunctions.length > 10 ? `<li><em>... and ${opp.allFunctions.length - 10} more</em></li>` : ''}
      </ul>
    </div>
    ` : ''}
  </div>
`;
  });

  html += `
  <div class="section">
    <h2>📈 Category Time Distribution</h2>
    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th>Node/Measurement</th>
          <th>Node/Rendering</th>
          <th>Browser/Measurement</th>
          <th>Browser/Rendering</th>
        </tr>
      </thead>
      <tbody>
`;

  categoryAnalysis
    .sort((a, b) => {
      const aMax = Math.max(...Object.values(a.measurements).map(m => m.percentage || 0));
      const bMax = Math.max(...Object.values(b.measurements).map(m => m.percentage || 0));
      return bMax - aMax;
    })
    .forEach(cat => {
      const nm = cat.measurements['node-measurement']?.percentage || 0;
      const nr = cat.measurements['node-rendering']?.percentage || 0;
      const bm = cat.measurements['browser-measurement']?.percentage || 0;
      const br = cat.measurements['browser-rendering']?.percentage || 0;

      if (nm > 0.5 || nr > 0.5 || bm > 0.5 || br > 0.5) {
        html += `
        <tr>
          <td><strong>${cat.category}</strong></td>
          <td>${nm.toFixed(2)}%</td>
          <td>${nr.toFixed(2)}%</td>
          <td>${bm.toFixed(2)}%</td>
          <td>${br.toFixed(2)}%</td>
        </tr>
`;
      }
    });

  html += `
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>🎯 Next Steps</h2>
    <ol>
      <li><strong>Address Critical Items:</strong> Start with the highest-impact optimizations</li>
      <li><strong>Focus on Cross-Cutting Issues:</strong> Prioritize items affecting multiple benchmarks</li>
      <li><strong>Profile Iteratively:</strong> Re-profile after each optimization to measure gains</li>
      <li><strong>Document Results:</strong> Track performance improvements over time</li>
    </ol>
  </div>
</body>
</html>
`;

  fs.writeFileSync(outputPath, html);
  console.log(`✅ HTML report saved: ${outputPath}`);
}

/**
 * Main execution
 */
function main() {
  console.log('🔬 Comprehensive Performance Report Generator');
  console.log('==============================================\n');

  // Load analysis data
  console.log('Loading profiling data...');
  const nodeData = loadAnalysis(NODE_ANALYSIS, 'Node.js');
  const browserData = loadAnalysis(BROWSER_ANALYSIS, 'Browser');

  if (!nodeData && !browserData) {
    console.error('\n❌ No profiling data found. Please run profiling first:');
    console.error('   npm run profile:node');
    console.error('   npm run profile:browser');
    process.exit(1);
  }

  if (!nodeData) {
    console.warn('⚠️  Node.js profiling data not found. Continuing with browser data only...');
  }

  if (!browserData) {
    console.warn('⚠️  Browser profiling data not found. Continuing with Node.js data only...');
  }

  console.log('✅ Data loaded\n');

  // Extract and rank optimizations
  console.log('Analyzing performance data...');
  const opportunities = extractOptimizations(nodeData, browserData);
  const ranked = rankOptimizations(opportunities);
  const categoryAnalysis = analyzeCategoryDistribution(nodeData, browserData);

  console.log(`✅ Found ${ranked.length} optimization opportunities\n`);

  // Generate reports
  const reportDir = path.join(OUTPUT_DIR, 'reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  console.log('Generating reports...\n');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const textPath = path.join(reportDir, `performance-report-${timestamp}.txt`);
  const jsonPath = path.join(reportDir, `performance-report-${timestamp}.json`);
  const htmlPath = path.join(reportDir, `performance-report-${timestamp}.html`);

  generateTextReport(ranked, categoryAnalysis, textPath);
  generateJSONReport(ranked, categoryAnalysis, nodeData, browserData, jsonPath);
  generateHTMLReport(ranked, categoryAnalysis, htmlPath);

  console.log('\n✅ Report generation complete!\n');
  console.log('Reports generated:');
  console.log(`  Text:  ${textPath}`);
  console.log(`  JSON:  ${jsonPath}`);
  console.log(`  HTML:  ${htmlPath}`);
  console.log(`\nOpen the HTML report in your browser to view the interactive report.`);
  console.log('');
}

// Run main
main();
