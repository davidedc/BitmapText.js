#!/usr/bin/env node

/**
 * Node.js CPU Profile Analyzer
 * Analyzes V8 CPU profiles to identify performance bottlenecks and hotspots
 */

const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 3) {
  console.error('Usage: analyze-node-profiles.js <measurement-profile> <rendering-profile> <output-dir>');
  process.exit(1);
}

const [measurementProfilePath, renderingProfilePath, outputDir] = args;

// Create output directory
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

/**
 * Parse and analyze a CPU profile
 */
function analyzeProfile(profilePath, benchmarkName) {
  console.log(`\n📊 Analyzing ${benchmarkName} profile...`);

  if (!fs.existsSync(profilePath)) {
    console.error(`❌ Profile not found: ${profilePath}`);
    return null;
  }

  const profileData = JSON.parse(fs.readFileSync(profilePath, 'utf8'));

  const analysis = {
    benchmarkName,
    profilePath,
    timestamp: new Date().toISOString(),
    summary: {},
    hotFunctions: [],
    categoryBreakdown: {},
    recommendations: []
  };

  // Extract nodes
  const nodes = profileData.nodes || [];
  const samples = profileData.samples || [];
  const timeDeltas = profileData.timeDeltas || [];

  // Calculate total time
  const totalTime = timeDeltas.reduce((sum, delta) => sum + delta, 0);
  analysis.summary.totalTime = totalTime;
  analysis.summary.totalSamples = samples.length;

  // Build function time map
  const functionTimeMap = new Map();
  const functionHitMap = new Map();

  samples.forEach((nodeId, index) => {
    const node = nodes[nodeId];
    if (!node) return;

    const callFrame = node.callFrame || {};
    const functionName = callFrame.functionName || '(anonymous)';
    const url = callFrame.url || '';
    const scriptId = callFrame.scriptId || 0;

    const key = `${functionName}@${url}`;
    const timeDelta = timeDeltas[index] || 0;

    functionTimeMap.set(key, (functionTimeMap.get(key) || 0) + timeDelta);
    functionHitMap.set(key, (functionHitMap.get(key) || 0) + 1);
  });

  // Sort functions by time spent
  const sortedFunctions = Array.from(functionTimeMap.entries())
    .map(([key, time]) => {
      const [functionName, url] = key.split('@');
      return {
        functionName,
        url,
        time,
        percentage: (time / totalTime) * 100,
        hits: functionHitMap.get(key) || 0
      };
    })
    .sort((a, b) => b.time - a.time);

  // Top 20 hot functions
  analysis.hotFunctions = sortedFunctions.slice(0, 20);

  // Categorize functions
  const categories = {
    'BitmapText Core': [],
    'Font Loading': [],
    'Atlas Operations': [],
    'Canvas/Drawing': [],
    'Measurement': [],
    'Node.js Core': [],
    'V8 Runtime': [],
    'Unknown/Other': []
  };

  sortedFunctions.forEach(func => {
    const name = func.functionName.toLowerCase();
    const url = func.url.toLowerCase();

    if (url.includes('bitmaptext') || name.includes('bitmaptext')) {
      categories['BitmapText Core'].push(func);
    } else if (name.includes('font') || name.includes('load')) {
      categories['Font Loading'].push(func);
    } else if (name.includes('atlas') || name.includes('reconstruct')) {
      categories['Atlas Operations'].push(func);
    } else if (name.includes('canvas') || name.includes('draw') || name.includes('fill') || name.includes('render')) {
      categories['Canvas/Drawing'].push(func);
    } else if (name.includes('measure')) {
      categories['Measurement'].push(func);
    } else if (url.includes('node:') || url.includes('internal/')) {
      categories['Node.js Core'].push(func);
    } else if (url === '' && name.startsWith('(')) {
      categories['V8 Runtime'].push(func);
    } else {
      categories['Unknown/Other'].push(func);
    }
  });

  // Calculate category breakdown
  Object.keys(categories).forEach(category => {
    const categoryFunctions = categories[category];
    const categoryTime = categoryFunctions.reduce((sum, func) => sum + func.time, 0);
    const categoryPercentage = (categoryTime / totalTime) * 100;

    analysis.categoryBreakdown[category] = {
      time: categoryTime,
      percentage: categoryPercentage,
      functionCount: categoryFunctions.length,
      topFunctions: categoryFunctions.slice(0, 5)
    };
  });

  // Generate recommendations based on hotspots
  const recommendations = [];

  // Check for BitmapText bottlenecks
  const bitmapTextTime = analysis.categoryBreakdown['BitmapText Core'].percentage;
  if (bitmapTextTime > 30) {
    recommendations.push({
      priority: 'HIGH',
      category: 'BitmapText Core',
      issue: `BitmapText core operations consume ${bitmapTextTime.toFixed(1)}% of total time`,
      suggestion: 'Optimize core BitmapText rendering functions',
      functions: analysis.categoryBreakdown['BitmapText Core'].topFunctions.slice(0, 3).map(f => f.functionName)
    });
  }

  // Check for atlas operations
  const atlasTime = analysis.categoryBreakdown['Atlas Operations'].percentage;
  if (atlasTime > 20) {
    recommendations.push({
      priority: 'HIGH',
      category: 'Atlas Operations',
      issue: `Atlas operations consume ${atlasTime.toFixed(1)}% of total time`,
      suggestion: 'Consider caching atlas data or optimizing reconstruction',
      functions: analysis.categoryBreakdown['Atlas Operations'].topFunctions.slice(0, 3).map(f => f.functionName)
    });
  }

  // Check for canvas operations
  const canvasTime = analysis.categoryBreakdown['Canvas/Drawing'].percentage;
  if (canvasTime > 25) {
    recommendations.push({
      priority: 'MEDIUM',
      category: 'Canvas/Drawing',
      issue: `Canvas operations consume ${canvasTime.toFixed(1)}% of total time`,
      suggestion: 'Batch canvas operations or reduce draw calls',
      functions: analysis.categoryBreakdown['Canvas/Drawing'].topFunctions.slice(0, 3).map(f => f.functionName)
    });
  }

  // Check for measurement overhead
  const measurementTime = analysis.categoryBreakdown['Measurement'].percentage;
  if (measurementTime > 15) {
    recommendations.push({
      priority: 'MEDIUM',
      category: 'Measurement',
      issue: `Text measurement consumes ${measurementTime.toFixed(1)}% of total time`,
      suggestion: 'Cache measurement results or optimize measurement algorithm',
      functions: analysis.categoryBreakdown['Measurement'].topFunctions.slice(0, 3).map(f => f.functionName)
    });
  }

  // Check individual hot functions
  analysis.hotFunctions.slice(0, 5).forEach((func, index) => {
    if (func.percentage > 10 && !func.functionName.startsWith('(')) {
      recommendations.push({
        priority: index === 0 ? 'CRITICAL' : 'HIGH',
        category: 'Hot Function',
        issue: `${func.functionName} consumes ${func.percentage.toFixed(1)}% of total time`,
        suggestion: `Optimize ${func.functionName} - this is the #${index + 1} hottest function`,
        functions: [func.functionName]
      });
    }
  });

  analysis.recommendations = recommendations;

  return analysis;
}

/**
 * Generate text report
 */
function generateTextReport(measurementAnalysis, renderingAnalysis, outputPath) {
  let report = '';

  report += '═══════════════════════════════════════════════════════════════\n';
  report += '  BitmapText.js Node.js CPU Profile Analysis\n';
  report += '═══════════════════════════════════════════════════════════════\n';
  report += `\nGenerated: ${new Date().toISOString()}\n\n`;

  // Helper function to format analysis section
  function formatAnalysis(analysis) {
    if (!analysis) return 'Analysis failed or profile not found\n\n';

    let section = '';
    section += `\n${'─'.repeat(63)}\n`;
    section += `  ${analysis.benchmarkName}\n`;
    section += `${'─'.repeat(63)}\n\n`;

    section += `Summary:\n`;
    section += `  Total Time:    ${analysis.summary.totalTime.toFixed(2)}μs\n`;
    section += `  Total Samples: ${analysis.summary.totalSamples}\n\n`;

    section += `Category Breakdown:\n`;
    Object.keys(analysis.categoryBreakdown)
      .sort((a, b) => analysis.categoryBreakdown[b].percentage - analysis.categoryBreakdown[a].percentage)
      .forEach(category => {
        const data = analysis.categoryBreakdown[category];
        if (data.percentage > 0.1) {
          section += `  ${category.padEnd(20)} ${data.percentage.toFixed(2).padStart(6)}%  (${data.functionCount} functions)\n`;
        }
      });

    section += `\nTop 10 Hot Functions:\n`;
    analysis.hotFunctions.slice(0, 10).forEach((func, index) => {
      const funcDisplay = func.functionName.length > 40
        ? func.functionName.substring(0, 37) + '...'
        : func.functionName;
      section += `  ${String(index + 1).padStart(2)}. ${funcDisplay.padEnd(40)} ${func.percentage.toFixed(2).padStart(6)}%  (${func.hits} hits)\n`;
    });

    if (analysis.recommendations.length > 0) {
      section += `\n⚡ Performance Recommendations:\n`;
      analysis.recommendations.forEach((rec, index) => {
        section += `\n  [${rec.priority}] ${rec.category}\n`;
        section += `      Issue:      ${rec.issue}\n`;
        section += `      Suggestion: ${rec.suggestion}\n`;
        if (rec.functions && rec.functions.length > 0) {
          section += `      Functions:  ${rec.functions.join(', ')}\n`;
        }
      });
    }

    section += '\n';
    return section;
  }

  report += formatAnalysis(measurementAnalysis);
  report += formatAnalysis(renderingAnalysis);

  // Comparative analysis
  if (measurementAnalysis && renderingAnalysis) {
    report += `${'═'.repeat(63)}\n`;
    report += `  Comparative Analysis\n`;
    report += `${'═'.repeat(63)}\n\n`;

    report += `Performance Comparison:\n`;
    report += `  Measurement Benchmark: ${measurementAnalysis.summary.totalTime.toFixed(2)}μs\n`;
    report += `  Rendering Benchmark:   ${renderingAnalysis.summary.totalTime.toFixed(2)}μs\n\n`;

    // Compare categories
    report += `Category Time Distribution:\n\n`;
    const allCategories = new Set([
      ...Object.keys(measurementAnalysis.categoryBreakdown),
      ...Object.keys(renderingAnalysis.categoryBreakdown)
    ]);

    report += `  ${'Category'.padEnd(20)} | ${'Measurement'.padStart(12)} | ${'Rendering'.padStart(12)}\n`;
    report += `  ${'-'.repeat(20)}-+-${'-'.repeat(12)}-+-${'-'.repeat(12)}\n`;

    Array.from(allCategories).forEach(category => {
      const measPct = measurementAnalysis.categoryBreakdown[category]?.percentage || 0;
      const rendPct = renderingAnalysis.categoryBreakdown[category]?.percentage || 0;
      if (measPct > 0.1 || rendPct > 0.1) {
        report += `  ${category.padEnd(20)} | ${measPct.toFixed(2).padStart(10)}%  | ${rendPct.toFixed(2).padStart(10)}% \n`;
      }
    });
  }

  report += '\n';
  fs.writeFileSync(outputPath, report);
  console.log(`✅ Text report saved to: ${outputPath}`);
}

/**
 * Generate JSON report
 */
function generateJSONReport(measurementAnalysis, renderingAnalysis, outputPath) {
  const report = {
    timestamp: new Date().toISOString(),
    measurement: measurementAnalysis,
    rendering: renderingAnalysis
  };

  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`✅ JSON report saved to: ${outputPath}`);
}

// Main execution
console.log('🔬 Node.js CPU Profile Analyzer');
console.log('================================\n');

const measurementAnalysis = analyzeProfile(measurementProfilePath, 'Measurement Benchmark');
const renderingAnalysis = analyzeProfile(renderingProfilePath, 'Rendering Benchmark');

// Generate reports
const textReportPath = path.join(outputDir, 'node-profile-analysis.txt');
const jsonReportPath = path.join(outputDir, 'node-profile-analysis.json');

generateTextReport(measurementAnalysis, renderingAnalysis, textReportPath);
generateJSONReport(measurementAnalysis, renderingAnalysis, jsonReportPath);

console.log('\n✅ Profile analysis complete!\n');
