#!/bin/bash

# Comprehensive Node.js Profiling Script for BitmapText.js Benchmarks
# Generates CPU profiles, flame graphs, and detailed performance analysis

set -e

echo "🔬 BitmapText.js Node.js Profiling Suite"
echo "========================================"
echo ""

# Get directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
NODE_DIST_DIR="$PROJECT_ROOT/perf/node/dist"
PROFILE_OUTPUT_DIR="$SCRIPT_DIR/output/node"

# Create output directories
mkdir -p "$PROFILE_OUTPUT_DIR/measurement"
mkdir -p "$PROFILE_OUTPUT_DIR/rendering"
mkdir -p "$PROFILE_OUTPUT_DIR/analysis"

# Check if benchmarks are built
if [ ! -f "$NODE_DIST_DIR/measurement-benchmark-unbundled.bundle.js" ]; then
  echo "❌ Benchmarks not built. Building now..."
  "$PROJECT_ROOT/scripts/build-measurement-benchmark.sh"
  "$PROJECT_ROOT/scripts/build-rendering-benchmark.sh"
fi

# Check if 0x is installed (for flame graphs)
if ! command -v 0x &> /dev/null; then
  echo "⚠️  0x not found. Installing for flame graph generation..."
  npm install -g 0x
fi

echo ""
echo "============================================"
echo "Part 1: Measurement Benchmark Profiling"
echo "============================================"
echo ""

# Profile measurement benchmark with --cpu-prof
echo "📊 [1/4] Profiling measurement benchmark with --cpu-prof..."
cd "$NODE_DIST_DIR"
node --cpu-prof --cpu-prof-dir="$PROFILE_OUTPUT_DIR/measurement" \
  ./measurement-benchmark-unbundled.bundle.js > "$PROFILE_OUTPUT_DIR/measurement/output.log" 2>&1

# Find the generated profile
MEASUREMENT_CPUPROFILE=$(ls -t "$PROFILE_OUTPUT_DIR/measurement"/CPU.*.cpuprofile | head -1)
echo "✅ CPU profile saved: $MEASUREMENT_CPUPROFILE"

# Profile with 0x for flame graph
echo "📊 [2/4] Generating flame graph for measurement benchmark..."
cd "$SCRIPT_DIR"
0x --output-dir="$PROFILE_OUTPUT_DIR/measurement/flamegraph" \
  "$NODE_DIST_DIR/measurement-benchmark-unbundled.bundle.js" > /dev/null 2>&1 || true
echo "✅ Flame graph saved to: $PROFILE_OUTPUT_DIR/measurement/flamegraph"

echo ""
echo "============================================"
echo "Part 2: Rendering Benchmark Profiling"
echo "============================================"
echo ""

# Profile rendering benchmark with --cpu-prof
echo "📊 [3/4] Profiling rendering benchmark with --cpu-prof..."
cd "$NODE_DIST_DIR"
node --cpu-prof --cpu-prof-dir="$PROFILE_OUTPUT_DIR/rendering" \
  ./rendering-benchmark-unbundled.bundle.js > "$PROFILE_OUTPUT_DIR/rendering/output.log" 2>&1

# Find the generated profile
RENDERING_CPUPROFILE=$(ls -t "$PROFILE_OUTPUT_DIR/rendering"/CPU.*.cpuprofile | head -1)
echo "✅ CPU profile saved: $RENDERING_CPUPROFILE"

# Profile with 0x for flame graph
echo "📊 [4/4] Generating flame graph for rendering benchmark..."
cd "$SCRIPT_DIR"
0x --output-dir="$PROFILE_OUTPUT_DIR/rendering/flamegraph" \
  "$NODE_DIST_DIR/rendering-benchmark-unbundled.bundle.js" > /dev/null 2>&1 || true
echo "✅ Flame graph saved to: $PROFILE_OUTPUT_DIR/rendering/flamegraph"

echo ""
echo "============================================"
echo "Part 3: Profile Analysis"
echo "============================================"
echo ""

# Analyze CPU profiles using Node.js
node "$SCRIPT_DIR/analyze-node-profiles.js" \
  "$MEASUREMENT_CPUPROFILE" \
  "$RENDERING_CPUPROFILE" \
  "$PROFILE_OUTPUT_DIR/analysis"

echo ""
echo "✅ Node.js profiling complete!"
echo ""
echo "Results:"
echo "  Measurement CPU Profile: $MEASUREMENT_CPUPROFILE"
echo "  Measurement Flame Graph: $PROFILE_OUTPUT_DIR/measurement/flamegraph"
echo "  Rendering CPU Profile:   $RENDERING_CPUPROFILE"
echo "  Rendering Flame Graph:   $PROFILE_OUTPUT_DIR/rendering/flamegraph"
echo "  Analysis Report:         $PROFILE_OUTPUT_DIR/analysis"
echo ""
echo "To view flame graphs, open the HTML files in your browser:"
echo "  file://$PROFILE_OUTPUT_DIR/measurement/flamegraph/flamegraph.html"
echo "  file://$PROFILE_OUTPUT_DIR/rendering/flamegraph/flamegraph.html"
echo ""
