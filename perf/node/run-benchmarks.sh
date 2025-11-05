#!/bin/bash

# Runner script for Performance Benchmarks
# Builds, runs, and generates comparative reports

set -e  # Exit on any error

echo "🚀 BitmapText.js Performance Benchmark Runner"
echo "============================================================"
echo ""

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DIST_DIR="$SCRIPT_DIR/dist"

# Create dist directory
mkdir -p "$DIST_DIR"

# ============================================================================
# STEP 1: Build Benchmarks
# ============================================================================

echo "[1/5] Building benchmarks..."
"$PROJECT_ROOT/scripts/build-rendering-benchmark.sh"
echo ""

# ============================================================================
# STEP 2: Run Unbundled Benchmark
# ============================================================================

echo "[2/5] Running UNBUNDLED benchmark..."
UNBUNDLED_OUTPUT=$("$DIST_DIR/rendering-benchmark-unbundled.bundle.js" 2>&1)

# Extract JSON from output
UNBUNDLED_JSON=$(echo "$UNBUNDLED_OUTPUT" | sed -n '/JSON_RESULTS_START/,/JSON_RESULTS_END/p' | sed '1d;$d')

if [ -z "$UNBUNDLED_JSON" ]; then
  echo "ERROR: Failed to extract unbundled results"
  echo "Output:"
  echo "$UNBUNDLED_OUTPUT"
  exit 1
fi

# Save unbundled results
TIMESTAMP=$(date +%s)
UNBUNDLED_RESULTS_FILE="$DIST_DIR/results-unbundled-$TIMESTAMP.json"
echo "$UNBUNDLED_JSON" > "$UNBUNDLED_RESULTS_FILE"
echo "✅ Unbundled results saved to: $UNBUNDLED_RESULTS_FILE"
echo ""

# ============================================================================
# STEP 3: Run Bundled Benchmark
# ============================================================================

echo "[3/5] Running BUNDLED benchmark..."
BUNDLED_OUTPUT=$("$DIST_DIR/rendering-benchmark-bundled.js" 2>&1)

# Extract JSON from output
BUNDLED_JSON=$(echo "$BUNDLED_OUTPUT" | sed -n '/JSON_RESULTS_START/,/JSON_RESULTS_END/p' | sed '1d;$d')

if [ -z "$BUNDLED_JSON" ]; then
  echo "ERROR: Failed to extract bundled results"
  echo "Output:"
  echo "$BUNDLED_OUTPUT"
  exit 1
fi

# Save bundled results
BUNDLED_RESULTS_FILE="$DIST_DIR/results-bundled-$TIMESTAMP.json"
echo "$BUNDLED_JSON" > "$BUNDLED_RESULTS_FILE"
echo "✅ Bundled results saved to: $BUNDLED_RESULTS_FILE"
echo ""

# ============================================================================
# STEP 4: Combine Results
# ============================================================================

echo "[4/5] Combining results..."

# Create combined results JSON using node
COMBINED_RESULTS_FILE="$DIST_DIR/results-combined-$TIMESTAMP.json"

node -e "
const unbundled = $UNBUNDLED_JSON;
const bundled = $BUNDLED_JSON;

const combined = {
  timestamp: new Date().toISOString(),
  platform: unbundled.platform,
  unbundled: unbundled,
  bundled: bundled
};

console.log(JSON.stringify(combined, null, 2));
" > "$COMBINED_RESULTS_FILE"

echo "✅ Combined results saved to: $COMBINED_RESULTS_FILE"
echo ""

# ============================================================================
# STEP 5: Generate HTML Report
# ============================================================================

echo "[5/5] Generating HTML report..."

# Use node to generate report
REPORT_FILE=$(node -e "
const reportGenerator = require('$SCRIPT_DIR/node-report-generator.js');
const results = require('$COMBINED_RESULTS_FILE');
const reportPath = reportGenerator.generate(results);
console.log(reportPath);
")

echo "✅ HTML report generated: $REPORT_FILE"
echo ""

# ============================================================================
# SUMMARY
# ============================================================================

echo "============================================================"
echo "✅ Performance Benchmark Complete!"
echo "============================================================"
echo ""
echo "Results:"
echo "  Unbundled: $UNBUNDLED_RESULTS_FILE"
echo "  Bundled:   $BUNDLED_RESULTS_FILE"
echo "  Combined:  $COMBINED_RESULTS_FILE"
echo "  Report:    $REPORT_FILE"
echo ""
echo "To view the report:"
echo "  open $REPORT_FILE"
echo ""

# Print summary statistics
node -e "
const results = require('$COMBINED_RESULTS_FILE');

console.log('Summary:');
console.log('');
console.log('Font Loading:');
console.log('  Unbundled: ' + results.unbundled.fontLoading.loadTime.toFixed(2) + 'ms');
console.log('  Bundled:   ' + results.bundled.fontLoading.loadTime.toFixed(2) + 'ms');
console.log('');

const unbundledSingle = results.unbundled.tests.find(t => t.name === 'Single block (black)');
const bundledSingle = results.bundled.tests.find(t => t.name === 'Single block (black)');

if (unbundledSingle && bundledSingle) {
  const ratio = bundledSingle.avgTime / unbundledSingle.avgTime;
  console.log('Single Block Render (Black):');
  console.log('  Unbundled: ' + unbundledSingle.avgTime.toFixed(3) + 'ms');
  console.log('  Bundled:   ' + bundledSingle.avgTime.toFixed(3) + 'ms');
  console.log('  Ratio:     ' + ratio.toFixed(2) + 'x ' + (ratio < 1 ? '(bundled faster)' : '(unbundled faster)'));
}
"
