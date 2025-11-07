#!/usr/bin/env node

/**
 * Browser Benchmark Profiler using Puppeteer
 * Profiles measurement and rendering benchmarks in a headless browser
 * and generates CPU profiles and trace data
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const OUTPUT_DIR = path.join(__dirname, 'output', 'browser');
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const MEASUREMENT_URL = `file://${PROJECT_ROOT}/perf/browser/measurement-benchmark.html`;
const RENDERING_URL = `file://${PROJECT_ROOT}/perf/browser/rendering-benchmark.html`;

// Create output directories
const measurementDir = path.join(OUTPUT_DIR, 'measurement');
const renderingDir = path.join(OUTPUT_DIR, 'rendering');
const analysisDir = path.join(OUTPUT_DIR, 'analysis');

[measurementDir, renderingDir, analysisDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * Profile a benchmark page
 */
async function profileBenchmark(browser, url, name, outputDir) {
  console.log(`\n📊 Profiling ${name} benchmark...`);
  console.log(`   URL: ${url}`);

  const page = await browser.newPage();

  // Enable console logging from the page
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('📊') || text.includes('✅') || text.includes('⏳')) {
      console.log(`   [Page] ${text}`);
    }
  });

  // Collect performance metrics
  const metrics = {
    name,
    url,
    timestamp: new Date().toISOString(),
    phases: {}
  };

  try {
    // Navigate to the page
    console.log(`   Loading page...`);
    const startLoad = performance.now();
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    metrics.phases.pageLoad = performance.now() - startLoad;
    console.log(`   ✅ Page loaded in ${metrics.phases.pageLoad.toFixed(2)}ms`);

    // Start profiling
    console.log(`   Starting CPU profiler...`);
    await page.coverage.startJSCoverage();
    const client = await page.target().createCDPSession();
    await client.send('Profiler.enable');
    await client.send('Profiler.start');

    // Start tracing
    console.log(`   Starting trace...`);
    await page.tracing.start({
      path: path.join(outputDir, 'trace.json'),
      screenshots: false,
      categories: [
        'devtools.timeline',
        'disabled-by-default-devtools.timeline',
        'disabled-by-default-devtools.timeline.frame',
        'toplevel',
        'blink.console',
        'blink.user_timing',
        'latencyInfo',
        'disabled-by-default-v8.cpu_profiler'
      ]
    });

    // Wait for the page to be ready
    await page.waitForSelector('#start-benchmark', { timeout: 10000 });

    // Inject performance monitoring
    await page.evaluate(() => {
      window.__profileData = {
        startTime: performance.now(),
        measurements: []
      };
    });

    // Click start benchmark
    console.log(`   Starting benchmark...`);
    const startBenchmark = performance.now();
    await page.click('#start-benchmark');

    // Wait for benchmark to complete (look for "complete" status)
    await page.waitForFunction(
      () => {
        const status = document.getElementById('status');
        return status && (
          status.textContent.includes('complete') ||
          status.textContent.includes('Complete')
        );
      },
      { timeout: 300000 } // 5 minutes max
    );

    metrics.phases.benchmarkExecution = performance.now() - startBenchmark;
    console.log(`   ✅ Benchmark completed in ${metrics.phases.benchmarkExecution.toFixed(2)}ms`);

    // Stop tracing
    console.log(`   Stopping trace...`);
    await page.tracing.stop();

    // Stop profiling and collect profile
    console.log(`   Collecting CPU profile...`);
    const profile = await client.send('Profiler.stop');
    const profilePath = path.join(outputDir, 'cpu-profile.cpuprofile');
    fs.writeFileSync(profilePath, JSON.stringify(profile.profile, null, 2));
    console.log(`   ✅ CPU profile saved: ${profilePath}`);

    // Stop coverage
    const coverage = await page.coverage.stopJSCoverage();
    const coveragePath = path.join(outputDir, 'coverage.json');
    fs.writeFileSync(coveragePath, JSON.stringify(coverage, null, 2));
    console.log(`   ✅ Coverage data saved: ${coveragePath}`);

    // Extract performance data from page
    const pageMetrics = await page.evaluate(() => {
      const perfEntries = performance.getEntriesByType('measure');
      return {
        measures: perfEntries.map(e => ({
          name: e.name,
          duration: e.duration,
          startTime: e.startTime
        })),
        timing: performance.timing ? {
          loadEventEnd: performance.timing.loadEventEnd - performance.timing.navigationStart,
          domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart
        } : null
      };
    });

    metrics.pageMeasures = pageMetrics.measures;
    metrics.pageTiming = pageMetrics.timing;

    // Save metrics
    const metricsPath = path.join(outputDir, 'metrics.json');
    fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));
    console.log(`   ✅ Metrics saved: ${metricsPath}`);

    // Take a screenshot
    const screenshotPath = path.join(outputDir, 'screenshot.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`   ✅ Screenshot saved: ${screenshotPath}`);

    await page.close();
    console.log(`   ✅ ${name} profiling complete`);

    return metrics;

  } catch (error) {
    console.error(`   ❌ Error profiling ${name}:`, error.message);
    await page.close();
    throw error;
  }
}

/**
 * Analyze CPU profile
 */
function analyzeCPUProfile(profilePath, benchmarkName) {
  console.log(`\n🔬 Analyzing ${benchmarkName} CPU profile...`);

  if (!fs.existsSync(profilePath)) {
    console.error(`   ❌ Profile not found: ${profilePath}`);
    return null;
  }

  const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
  const nodes = profile.nodes || [];
  const samples = profile.samples || [];
  const timeDeltas = profile.timeDeltas || [];

  const analysis = {
    benchmarkName,
    timestamp: new Date().toISOString(),
    summary: {},
    hotFunctions: [],
    categoryBreakdown: {},
    recommendations: []
  };

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

  analysis.hotFunctions = sortedFunctions.slice(0, 30);

  // Categorize functions
  const categories = {
    'BitmapText Core': [],
    'Font Loading': [],
    'Atlas Operations': [],
    'Canvas Drawing': [],
    'Text Measurement': [],
    'DOM/Browser': [],
    'V8 Runtime': [],
    'Benchmark Framework': [],
    'Unknown': []
  };

  sortedFunctions.forEach(func => {
    const name = func.functionName.toLowerCase();
    const url = func.url.toLowerCase();

    if (name.includes('bitmaptext') || url.includes('bitmaptext')) {
      categories['BitmapText Core'].push(func);
    } else if (name.includes('font') || name.includes('load')) {
      categories['Font Loading'].push(func);
    } else if (name.includes('atlas') || name.includes('reconstruct')) {
      categories['Atlas Operations'].push(func);
    } else if (name.includes('draw') || name.includes('fill') || name.includes('render') || name.includes('canvas')) {
      categories['Canvas Drawing'].push(func);
    } else if (name.includes('measure')) {
      categories['Text Measurement'].push(func);
    } else if (url.includes('benchmark') || name.includes('benchmark') || name.includes('test')) {
      categories['Benchmark Framework'].push(func);
    } else if (url === '' || name.startsWith('(')) {
      categories['V8 Runtime'].push(func);
    } else if (url.startsWith('http') || url.includes('browser')) {
      categories['DOM/Browser'].push(func);
    } else {
      categories['Unknown'].push(func);
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

  // Generate recommendations
  const recommendations = [];

  // Check each category
  Object.entries(analysis.categoryBreakdown).forEach(([category, data]) => {
    if (data.percentage > 20 && category !== 'V8 Runtime' && category !== 'Benchmark Framework') {
      recommendations.push({
        priority: data.percentage > 40 ? 'CRITICAL' : data.percentage > 30 ? 'HIGH' : 'MEDIUM',
        category,
        issue: `${category} operations consume ${data.percentage.toFixed(1)}% of total time`,
        suggestion: `Optimize ${category.toLowerCase()} operations`,
        functions: data.topFunctions.slice(0, 3).map(f => f.functionName)
      });
    }
  });

  // Check individual hot functions
  analysis.hotFunctions.slice(0, 5).forEach((func, index) => {
    if (func.percentage > 10 && !func.functionName.startsWith('(') && !func.functionName.includes('benchmark')) {
      recommendations.push({
        priority: index === 0 ? 'CRITICAL' : 'HIGH',
        category: 'Hot Function',
        issue: `${func.functionName} consumes ${func.percentage.toFixed(1)}% of total time`,
        suggestion: `Optimize ${func.functionName} - this is a critical hotspot`,
        functions: [func.functionName]
      });
    }
  });

  analysis.recommendations = recommendations;

  console.log(`   ✅ Analysis complete`);
  return analysis;
}

/**
 * Main execution
 */
async function main() {
  console.log('🔬 BitmapText.js Browser Profiling Suite');
  console.log('=========================================\n');

  // Check if Puppeteer is installed
  try {
    require.resolve('puppeteer');
  } catch (e) {
    console.error('❌ Puppeteer not found. Installing...');
    require('child_process').execSync('npm install puppeteer', { stdio: 'inherit' });
  }

  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  console.log('✅ Browser launched\n');

  try {
    // Profile measurement benchmark
    console.log('═══════════════════════════════════════');
    console.log('Part 1: Measurement Benchmark');
    console.log('═══════════════════════════════════════');
    const measurementMetrics = await profileBenchmark(
      browser,
      MEASUREMENT_URL,
      'Measurement',
      measurementDir
    );

    // Profile rendering benchmark
    console.log('\n═══════════════════════════════════════');
    console.log('Part 2: Rendering Benchmark');
    console.log('═══════════════════════════════════════');
    const renderingMetrics = await profileBenchmark(
      browser,
      RENDERING_URL,
      'Rendering',
      renderingDir
    );

    // Analyze profiles
    console.log('\n═══════════════════════════════════════');
    console.log('Part 3: Profile Analysis');
    console.log('═══════════════════════════════════════');

    const measurementAnalysis = analyzeCPUProfile(
      path.join(measurementDir, 'cpu-profile.cpuprofile'),
      'Measurement Benchmark'
    );

    const renderingAnalysis = analyzeCPUProfile(
      path.join(renderingDir, 'cpu-profile.cpuprofile'),
      'Rendering Benchmark'
    );

    // Generate comprehensive report
    const report = {
      timestamp: new Date().toISOString(),
      measurement: {
        metrics: measurementMetrics,
        analysis: measurementAnalysis
      },
      rendering: {
        metrics: renderingMetrics,
        analysis: renderingAnalysis
      }
    };

    const reportPath = path.join(analysisDir, 'browser-profile-analysis.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n✅ Comprehensive report saved: ${reportPath}`);

    // Generate text report
    await generateTextReport(report, analysisDir);

  } finally {
    await browser.close();
    console.log('\n✅ Browser closed');
  }

  console.log('\n═══════════════════════════════════════');
  console.log('✅ Browser profiling complete!');
  console.log('═══════════════════════════════════════\n');

  console.log('Results:');
  console.log(`  Measurement Profile: ${measurementDir}`);
  console.log(`  Rendering Profile:   ${renderingDir}`);
  console.log(`  Analysis:            ${analysisDir}`);
  console.log(`  Trace files can be viewed in Chrome DevTools (chrome://tracing)`);
  console.log('');
}

/**
 * Generate text report
 */
async function generateTextReport(report, outputDir) {
  console.log('\n📄 Generating text report...');

  let text = '';
  text += '═══════════════════════════════════════════════════════════════\n';
  text += '  BitmapText.js Browser CPU Profile Analysis\n';
  text += '═══════════════════════════════════════════════════════════════\n';
  text += `\nGenerated: ${new Date().toISOString()}\n\n`;

  // Helper to format analysis
  function formatAnalysis(name, data) {
    if (!data.analysis) return '';

    let section = '';
    section += `\n${'─'.repeat(63)}\n`;
    section += `  ${name}\n`;
    section += `${'─'.repeat(63)}\n\n`;

    section += `Execution Time:\n`;
    section += `  Benchmark:  ${data.metrics.phases.benchmarkExecution.toFixed(2)}ms\n`;
    section += `  CPU Time:   ${data.analysis.summary.totalTime.toFixed(2)}μs\n`;
    section += `  Samples:    ${data.analysis.summary.totalSamples}\n\n`;

    section += `Category Breakdown:\n`;
    Object.keys(data.analysis.categoryBreakdown)
      .sort((a, b) => data.analysis.categoryBreakdown[b].percentage - data.analysis.categoryBreakdown[a].percentage)
      .forEach(category => {
        const cat = data.analysis.categoryBreakdown[category];
        if (cat.percentage > 0.5) {
          section += `  ${category.padEnd(25)} ${cat.percentage.toFixed(2).padStart(6)}%  (${cat.functionCount} functions)\n`;
        }
      });

    section += `\nTop 10 Hot Functions:\n`;
    data.analysis.hotFunctions.slice(0, 10).forEach((func, index) => {
      const funcDisplay = func.functionName.length > 40
        ? func.functionName.substring(0, 37) + '...'
        : func.functionName;
      section += `  ${String(index + 1).padStart(2)}. ${funcDisplay.padEnd(40)} ${func.percentage.toFixed(2).padStart(6)}%\n`;
    });

    if (data.analysis.recommendations.length > 0) {
      section += `\n⚡ Performance Recommendations:\n`;
      data.analysis.recommendations.forEach((rec, index) => {
        section += `\n  [${rec.priority}] ${rec.category}\n`;
        section += `      ${rec.issue}\n`;
        section += `      → ${rec.suggestion}\n`;
        if (rec.functions && rec.functions.length > 0) {
          section += `      Functions: ${rec.functions.join(', ')}\n`;
        }
      });
    }

    section += '\n';
    return section;
  }

  text += formatAnalysis('Measurement Benchmark', report.measurement);
  text += formatAnalysis('Rendering Benchmark', report.rendering);

  // Comparative analysis
  text += `${'═'.repeat(63)}\n`;
  text += `  Comparative Analysis\n`;
  text += `${'═'.repeat(63)}\n\n`;

  text += `Execution Time:\n`;
  text += `  Measurement: ${report.measurement.metrics.phases.benchmarkExecution.toFixed(2)}ms\n`;
  text += `  Rendering:   ${report.rendering.metrics.phases.benchmarkExecution.toFixed(2)}ms\n\n`;

  const reportPath = path.join(outputDir, 'browser-profile-analysis.txt');
  fs.writeFileSync(reportPath, text);
  console.log(`   ✅ Text report saved: ${reportPath}`);
}

// Run main function
main().catch(error => {
  console.error('❌ Profiling failed:', error);
  process.exit(1);
});
