#!/bin/bash

# Runner script for Measurement Performance Benchmarks
# Builds, runs, and generates comparative reports

set -e  # Exit on any error

echo "🚀 BitmapText.js Measurement Performance Benchmark Runner"
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

echo "[1/5] Building measurement benchmarks..."
"$PROJECT_ROOT/scripts/build-measurement-benchmark.sh"
echo ""

# ============================================================================
# STEP 2: Run Unbundled Benchmark
# ============================================================================

echo "[2/5] Running UNBUNDLED benchmark..."
UNBUNDLED_OUTPUT=$("$DIST_DIR/measurement-benchmark-unbundled.bundle.js" 2>&1)

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
UNBUNDLED_RESULTS_FILE="$DIST_DIR/measurement-results-unbundled-$TIMESTAMP.json"
echo "$UNBUNDLED_JSON" > "$UNBUNDLED_RESULTS_FILE"
echo "✅ Unbundled results saved to: $UNBUNDLED_RESULTS_FILE"
echo ""

# ============================================================================
# STEP 3: Run Bundled Benchmark
# ============================================================================

echo "[3/5] Running BUNDLED benchmark..."
BUNDLED_OUTPUT=$("$DIST_DIR/measurement-benchmark-bundled.js" 2>&1)

# Extract JSON from output
BUNDLED_JSON=$(echo "$BUNDLED_OUTPUT" | sed -n '/JSON_RESULTS_START/,/JSON_RESULTS_END/p' | sed '1d;$d')

if [ -z "$BUNDLED_JSON" ]; then
  echo "ERROR: Failed to extract bundled results"
  echo "Output:"
  echo "$BUNDLED_OUTPUT"
  exit 1
fi

# Save bundled results
BUNDLED_RESULTS_FILE="$DIST_DIR/measurement-results-bundled-$TIMESTAMP.json"
echo "$BUNDLED_JSON" > "$BUNDLED_RESULTS_FILE"
echo "✅ Bundled results saved to: $BUNDLED_RESULTS_FILE"
echo ""

# ============================================================================
# STEP 4: Combine Results
# ============================================================================

echo "[4/5] Combining results..."

# Create combined results JSON using node
COMBINED_RESULTS_FILE="$DIST_DIR/measurement-results-combined-$TIMESTAMP.json"

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
# STEP 5: Generate Summary Report
# ============================================================================

echo "[5/5] Generating summary report..."

node -e "
const results = require('$COMBINED_RESULTS_FILE');

console.log('');
console.log('============================================================');
console.log('📊 Measurement Performance Summary');
console.log('============================================================');
console.log('');

console.log('Font Loading:');
console.log('  Unbundled: ' + results.unbundled.fontLoading.loadTime.toFixed(2) + 'ms');
console.log('  Bundled:   ' + results.bundled.fontLoading.loadTime.toFixed(2) + 'ms');
console.log('');

// Text Length Scaling (50 chars)
const unbundled50 = results.unbundled.tests.find(t => t.category === 'Text Length Scaling' && t.textLength === 50);
const bundled50 = results.bundled.tests.find(t => t.category === 'Text Length Scaling' && t.textLength === 50);

if (unbundled50 && bundled50) {
  console.log('Text Measurement (50 characters):');
  console.log('  Unbundled: ' + (unbundled50.avgTime * 1000).toFixed(3) + 'μs avg, ' + unbundled50.opsPerSec.toFixed(0) + ' ops/sec');
  console.log('  Bundled:   ' + (bundled50.avgTime * 1000).toFixed(3) + 'μs avg, ' + bundled50.opsPerSec.toFixed(0) + ' ops/sec');
  const ratio = bundled50.avgTime / unbundled50.avgTime;
  console.log('  Ratio:     ' + ratio.toFixed(3) + 'x ' + (ratio < 1 ? '(bundled faster)' : '(unbundled faster)'));
  console.log('');
}

// Kerning Overhead
const unbundledKerningOn = results.unbundled.tests.find(t => t.test === 'Kerning ON');
const unbundledKerningOff = results.unbundled.tests.find(t => t.test === 'Kerning OFF');

if (unbundledKerningOn && unbundledKerningOff) {
  const overhead = ((unbundledKerningOn.avgTime - unbundledKerningOff.avgTime) / unbundledKerningOff.avgTime * 100).toFixed(1);
  console.log('Kerning Overhead (Unbundled):');
  console.log('  Kerning ON:  ' + (unbundledKerningOn.avgTime * 1000).toFixed(3) + 'μs');
  console.log('  Kerning OFF: ' + (unbundledKerningOff.avgTime * 1000).toFixed(3) + 'μs');
  console.log('  Overhead:    ' + overhead + '%');
  console.log('');
}

// Repeated measurements
const unbundledRepeat = results.unbundled.tests.find(t => t.category === 'Repeated Measurements');
const bundledRepeat = results.bundled.tests.find(t => t.category === 'Repeated Measurements');

if (unbundledRepeat && bundledRepeat) {
  console.log('Repeated Measurements (60 per frame):');
  console.log('  Unbundled: ' + unbundledRepeat.avgTime.toFixed(3) + 'ms per frame (' + unbundledRepeat.framesPerSecond.toFixed(1) + ' fps)');
  console.log('  Bundled:   ' + bundledRepeat.avgTime.toFixed(3) + 'ms per frame (' + bundledRepeat.framesPerSecond.toFixed(1) + ' fps)');
  console.log('');
}

console.log('Linear Scaling Analysis:');
console.log('');
console.log('Text Length | Unbundled (μs) | Bundled (μs) | Ops/Sec (Unbundled)');
console.log('----------- | -------------- | ------------ | -------------------');

[5, 10, 25, 50, 100, 250, 500].forEach(length => {
  const u = results.unbundled.tests.find(t => t.category === 'Text Length Scaling' && t.textLength === length);
  const b = results.bundled.tests.find(t => t.category === 'Text Length Scaling' && t.textLength === length);
  if (u && b) {
    const pad = (n, w) => String(n).padStart(w, ' ');
    console.log(pad(length, 11) + ' | ' + pad((u.avgTime * 1000).toFixed(3), 14) + ' | ' + pad((b.avgTime * 1000).toFixed(3), 12) + ' | ' + pad(u.opsPerSec.toFixed(0), 19));
  }
});

console.log('');
console.log('✅ Full results available in:');
console.log('   ' + '$COMBINED_RESULTS_FILE');
console.log('');
"

# ============================================================================
# SUMMARY
# ============================================================================

echo "============================================================"
echo "✅ Measurement Benchmark Complete!"
echo "============================================================"
echo ""
echo "Results:"
echo "  Unbundled: $UNBUNDLED_RESULTS_FILE"
echo "  Bundled:   $BUNDLED_RESULTS_FILE"
echo "  Combined:  $COMBINED_RESULTS_FILE"
echo ""
