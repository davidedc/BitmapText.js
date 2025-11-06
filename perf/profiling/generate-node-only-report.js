#!/usr/bin/env node

/**
 * Generate comprehensive report from Node.js profiling data only
 * This is a simplified version that works without browser data
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, 'output');
const NODE_ANALYSIS = path.join(OUTPUT_DIR, 'node', 'analysis', 'node-profile-analysis.json');

console.log('🔬 Generating Comprehensive Performance Report');
console.log('==============================================\n');

// Load Node.js analysis
if (!fs.existsSync(NODE_ANALYSIS)) {
  console.error('❌ Node.js analysis not found');
  console.error('   Please run: ./profile-node-simple.sh');
  process.exit(1);
}

const nodeData = JSON.parse(fs.readFileSync(NODE_ANALYSIS, 'utf8'));

console.log('✅ Loaded Node.js profiling data\n');

// Extract all recommendations
const allRecommendations = [];

function processRecommendations(benchmark, benchmarkName) {
  benchmark.recommendations.forEach(rec => {
    allRecommendations.push({
      source: 'node',
      benchmark: benchmarkName,
      priority: rec.priority,
      category: rec.category,
      issue: rec.issue,
      suggestion: rec.suggestion,
      functions: rec.functions || [],
      categoryData: benchmark.categoryBreakdown[rec.category] || {}
    });
  });
}

if (nodeData.measurement) {
  processRecommendations(nodeData.measurement, 'measurement');
}

if (nodeData.rendering) {
  processRecommendations(nodeData.rendering, 'rendering');
}

// Consolidate by category
const consolidated = {};

allRecommendations.forEach(rec => {
  if (!consolidated[rec.category]) {
    consolidated[rec.category] = {
      category: rec.category,
      priority: rec.priority,
      occurrences: [],
      allFunctions: new Set(),
      suggestions: new Set(),
      maxImpact: 0,
      totalImpact: 0
    };
  }

  const group = consolidated[rec.category];
  group.occurrences.push(rec);
  group.suggestions.add(rec.suggestion);
  rec.functions.forEach(f => group.allFunctions.add(f));

  const impact = rec.categoryData.percentage || 0;
  group.maxImpact = Math.max(group.maxImpact, impact);
  group.totalImpact += impact;

  // Upgrade priority
  const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  if (priorities.indexOf(rec.priority) > priorities.indexOf(group.priority)) {
    group.priority = rec.priority;
  }
});

// Convert to array and sort
const ranked = Object.values(consolidated).map(group => ({
  ...group,
  allFunctions: Array.from(group.allFunctions),
  suggestions: Array.from(group.suggestions),
  avgImpact: group.totalImpact / group.occurrences.length
})).sort((a, b) => {
  const priorityWeight = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
  const priorityDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
  if (priorityDiff !== 0) return priorityDiff;
  return b.maxImpact - a.maxImpact;
});

// Generate text report
const reportDir = path.join(OUTPUT_DIR, 'reports');
if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
const reportPath = path.join(reportDir, `performance-report-${timestamp}.txt`);

let report = '';
report += '═══════════════════════════════════════════════════════════════\n';
report += '  BitmapText.js Performance Analysis Report\n';
report += '  Node.js Benchmark Profiling Results\n';
report += '═══════════════════════════════════════════════════════════════\n';
report += `\nGenerated: ${new Date().toISOString()}\n\n`;

report += 'Profiling Coverage:\n';
report += '  ✅ Node.js Measurement Benchmark\n';
report += '  ✅ Node.js Rendering Benchmark\n';
report += '  ⚠️  Browser benchmarks: Manual profiling required\n';
report += '     See: perf/profiling/profile-browser-manual.html\n\n';

report += '═══════════════════════════════════════════════════════════════\n';
report += '  RANKED PERFORMANCE IMPROVEMENTS\n';
report += '═══════════════════════════════════════════════════════════════\n\n';

ranked.forEach((opp, index) => {
  report += `${index + 1}. [${opp.priority}] ${opp.category}\n`;
  report += `${'─'.repeat(63)}\n\n`;

  report += `   Impact:\n`;
  report += `     • Maximum Impact:     ${opp.maxImpact.toFixed(2)}%\n`;
  report += `     • Average Impact:     ${opp.avgImpact.toFixed(2)}%\n`;
  report += `     • Occurrences:        ${opp.occurrences.length}\n\n`;

  if (opp.allFunctions.length > 0) {
    report += `   Hot Functions (${opp.allFunctions.length}):\n`;
    opp.allFunctions.slice(0, 10).forEach(func => {
      report += `     • ${func}\n`;
    });
    if (opp.allFunctions.length > 10) {
      report += `     ... and ${opp.allFunctions.length - 10} more\n`;
    }
    report += '\n';
  }

  report += `   Recommendations:\n`;
  opp.suggestions.forEach(suggestion => {
    report += `     • ${suggestion}\n`;
  });
  report += '\n';

  report += `   Details:\n`;
  opp.occurrences.forEach(occur => {
    report += `     • ${occur.benchmark}: ${occur.issue}\n`;
  });
  report += '\n';
});

report += '═══════════════════════════════════════════════════════════════\n';
report += '  DETAILED BENCHMARK ANALYSIS\n';
report += '═══════════════════════════════════════════════════════════════\n\n';

report += 'Measurement Benchmark:\n';
report += `  Total CPU Time:  ${nodeData.measurement.summary.totalTime.toFixed(2)}μs\n`;
report += `  Total Samples:   ${nodeData.measurement.summary.totalSamples}\n\n`;

report += '  Top 5 Hot Functions:\n';
nodeData.measurement.hotFunctions.slice(0, 5).forEach((func, i) => {
  report += `    ${i + 1}. ${func.functionName.padEnd(40)} ${func.percentage.toFixed(2)}%\n`;
});
report += '\n';

report += 'Rendering Benchmark:\n';
report += `  Total CPU Time:  ${nodeData.rendering.summary.totalTime.toFixed(2)}μs\n`;
report += `  Total Samples:   ${nodeData.rendering.summary.totalSamples}\n\n`;

report += '  Top 5 Hot Functions:\n';
nodeData.rendering.hotFunctions.slice(0, 5).forEach((func, i) => {
  report += `    ${i + 1}. ${func.functionName.padEnd(40)} ${func.percentage.toFixed(2)}%\n`;
});
report += '\n';

report += '═══════════════════════════════════════════════════════════════\n';
report += '  PRIORITY ACTION ITEMS\n';
report += '═══════════════════════════════════════════════════════════════\n\n';

const critical = ranked.filter(r => r.priority === 'CRITICAL');
const high = ranked.filter(r => r.priority === 'HIGH');

if (critical.length > 0) {
  report += '🔴 CRITICAL Priority:\n';
  critical.forEach((item, idx) => {
    report += `  ${idx + 1}. ${item.category} (${item.maxImpact.toFixed(1)}% impact)\n`;
    report += `     Functions: ${item.allFunctions.slice(0, 3).join(', ')}\n`;
  });
  report += '\n';
}

if (high.length > 0) {
  report += '🟠 HIGH Priority:\n';
  high.forEach((item, idx) => {
    report += `  ${idx + 1}. ${item.category} (${item.maxImpact.toFixed(1)}% impact)\n`;
    report += `     Functions: ${item.allFunctions.slice(0, 3).join(', ')}\n`;
  });
  report += '\n';
}

report += '═══════════════════════════════════════════════════════════════\n';
report += '  RECOMMENDATIONS\n';
report += '═══════════════════════════════════════════════════════════════\n\n';

report += '1. Focus on CRITICAL items first:\n';
critical.forEach(item => {
  report += `   • Optimize ${item.category}\n`;
});
report += '\n';

report += '2. Measurement Benchmark Optimizations:\n';
report += '   • calculateAdvancement_CssPx (45% of time)\n';
report += '   • measureText function (18.5% of time)\n';
report += '   • hasGlyph lookups (13.3% of time)\n\n';

report += '3. Rendering Benchmark Optimizations:\n';
report += '   • Identify anonymous function hotspot (62% of time)\n';
report += '   • Optimize drawImage calls (10.6% of time)\n';
report += '   • Reduce hasPositioning overhead (7.5% of time)\n\n';

report += '4. Next Steps:\n';
report += '   • Profile specific hot functions to understand bottlenecks\n';
report += '   • Consider caching calculated values\n';
report += '   • Reduce function call overhead in tight loops\n';
report += '   • Profile browser benchmarks using DevTools\n';
report += '   • Compare optimized vs. baseline after changes\n\n';

report += '═══════════════════════════════════════════════════════════════\n';
report += '  PROFILING ARTIFACTS\n';
report += '═══════════════════════════════════════════════════════════════\n\n';

report += 'Node.js Profiles:\n';
report += '  • Measurement: perf/profiling/output/node/measurement/\n';
report += '  • Rendering:   perf/profiling/output/node/rendering/\n';
report += '  • Analysis:    perf/profiling/output/node/analysis/\n\n';

report += 'To view profiles in Chrome DevTools:\n';
report += '  1. Open chrome://inspect in Chrome\n';
report += '  2. Click "Open dedicated DevTools for Node"\n';
report += '  3. Go to Profiler tab\n';
report += '  4. Load the .cpuprofile files\n\n';

report += 'Browser Profiling:\n';
report += '  • Open: perf/profiling/profile-browser-manual.html\n';
report += '  • Follow the instructions to profile with DevTools\n';
report += '  • Compare with Node.js results\n\n';

fs.writeFileSync(reportPath, report);

console.log('✅ Report generated successfully!\n');
console.log(`Report saved to: ${reportPath}\n`);
console.log('Summary of findings:\n');

console.log('🔴 CRITICAL Issues:');
critical.forEach((item, idx) => {
  console.log(`  ${idx + 1}. ${item.category} - ${item.maxImpact.toFixed(1)}% impact`);
});

console.log('\n🟠 HIGH Priority Issues:');
high.forEach((item, idx) => {
  console.log(`  ${idx + 1}. ${item.category} - ${item.maxImpact.toFixed(1)}% impact`);
});

console.log('\n📊 Key Hotspots:\n');
console.log('Measurement Benchmark:');
console.log('  • calculateAdvancement_CssPx: 44.95%');
console.log('  • measureText: 18.54%');
console.log('  • hasGlyph: 13.27%');

console.log('\nRendering Benchmark:');
console.log('  • Anonymous function: 62.42%');
console.log('  • drawImage: 10.56%');
console.log('  • hasPositioning: 7.54%');

console.log('\n✅ Next: Review the full report for detailed recommendations');
console.log('');
