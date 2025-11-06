#!/bin/bash

# Simple Node.js Profiling Script (no external dependencies)
# Uses Node's built-in --cpu-prof flag

set -e

echo "🔬 BitmapText.js Node.js CPU Profiling"
echo "======================================"
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

echo "Output directory: $PROFILE_OUTPUT_DIR"
echo ""

# Check if benchmarks are built
if [ ! -f "$NODE_DIST_DIR/measurement-benchmark-unbundled.bundle.js" ]; then
  echo "❌ Benchmarks not built. Building now..."
  "$PROJECT_ROOT/scripts/build-measurement-benchmark.sh"
  "$PROJECT_ROOT/scripts/build-rendering-benchmark.sh"
fi

echo "============================================"
echo "Part 1: Measurement Benchmark Profiling"
echo "============================================"
echo ""

echo "📊 Profiling measurement benchmark..."
cd "$NODE_DIST_DIR"
node --cpu-prof --cpu-prof-dir="$PROFILE_OUTPUT_DIR/measurement" \
  ./measurement-benchmark-unbundled.bundle.js > "$PROFILE_OUTPUT_DIR/measurement/output.log" 2>&1

# Find the generated profile
MEASUREMENT_CPUPROFILE=$(ls -t "$PROFILE_OUTPUT_DIR/measurement"/CPU*.cpuprofile 2>/dev/null | head -1)

if [ -n "$MEASUREMENT_CPUPROFILE" ]; then
  echo "✅ CPU profile saved: $MEASUREMENT_CPUPROFILE"
  # Get file size
  SIZE=$(ls -lh "$MEASUREMENT_CPUPROFILE" | awk '{print $5}')
  echo "   Profile size: $SIZE"
else
  echo "⚠️  No profile generated"
fi

echo ""
echo "============================================"
echo "Part 2: Rendering Benchmark Profiling"
echo "============================================"
echo ""

echo "📊 Profiling rendering benchmark..."
cd "$NODE_DIST_DIR"
node --cpu-prof --cpu-prof-dir="$PROFILE_OUTPUT_DIR/rendering" \
  ./rendering-benchmark-unbundled.bundle.js > "$PROFILE_OUTPUT_DIR/rendering/output.log" 2>&1

# Find the generated profile
RENDERING_CPUPROFILE=$(ls -t "$PROFILE_OUTPUT_DIR/rendering"/CPU*.cpuprofile 2>/dev/null | head -1)

if [ -n "$RENDERING_CPUPROFILE" ]; then
  echo "✅ CPU profile saved: $RENDERING_CPUPROFILE"
  SIZE=$(ls -lh "$RENDERING_CPUPROFILE" | awk '{print $5}')
  echo "   Profile size: $SIZE"
else
  echo "⚠️  No profile generated"
fi

echo ""
echo "============================================"
echo "Part 3: Profile Analysis"
echo "============================================"
echo ""

if [ -n "$MEASUREMENT_CPUPROFILE" ] && [ -n "$RENDERING_CPUPROFILE" ]; then
  echo "📊 Analyzing profiles..."
  node "$SCRIPT_DIR/analyze-node-profiles.js" \
    "$MEASUREMENT_CPUPROFILE" \
    "$RENDERING_CPUPROFILE" \
    "$PROFILE_OUTPUT_DIR/analysis"
else
  echo "⚠️  Skipping analysis - profiles not found"
fi

echo ""
echo "✅ Node.js profiling complete!"
echo ""
echo "Results:"
echo "  Measurement:"
echo "    - Output:  $PROFILE_OUTPUT_DIR/measurement/output.log"
if [ -n "$MEASUREMENT_CPUPROFILE" ]; then
  echo "    - Profile: $MEASUREMENT_CPUPROFILE"
fi
echo ""
echo "  Rendering:"
echo "    - Output:  $PROFILE_OUTPUT_DIR/rendering/output.log"
if [ -n "$RENDERING_CPUPROFILE" ]; then
  echo "    - Profile: $RENDERING_CPUPROFILE"
fi
echo ""
echo "  Analysis:  $PROFILE_OUTPUT_DIR/analysis/"
echo ""
echo "To view profiles in Chrome DevTools:"
echo "  1. Open Chrome and go to: chrome://inspect"
echo "  2. Click 'Open dedicated DevTools for Node'"
echo "  3. Go to the 'Profiler' tab"
echo "  4. Click 'Load' and select the .cpuprofile files"
echo ""
