#!/bin/bash

# Run all Node.js demos
# Executes all standalone and bundled demos in sequence

set -e  # Exit on any error

echo "======================================================================"
echo "Running All Node.js Demos"
echo "======================================================================"
echo ""

# Get project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Track success/failure
TOTAL=0
SUCCESS=0
FAILED=0

run_demo() {
  local demo_name="$1"
  local demo_path="$2"

  TOTAL=$((TOTAL + 1))

  echo "======================================================================"
  echo "[$TOTAL] Running: $demo_name"
  echo "======================================================================"
  echo ""

  if node "$demo_path"; then
    SUCCESS=$((SUCCESS + 1))
    echo ""
    echo "✅ $demo_name completed successfully"
    echo ""
  else
    FAILED=$((FAILED + 1))
    echo ""
    echo "❌ $demo_name failed"
    echo ""
    return 1
  fi
}

# Run standalone bundles
echo ""
echo "══════════════════════════════════════════════════════════════════════"
echo "STANDALONE BUNDLES (~200KB, no external dependencies)"
echo "══════════════════════════════════════════════════════════════════════"
echo ""

run_demo "Hello World (standalone)" "examples/node/dist/hello-world.bundle.js" || true
run_demo "Hello World Multi-Size (standalone)" "examples/node/dist/hello-world-multi-size.bundle.js" || true
run_demo "Small Sizes Interpolation (standalone)" "examples/node/dist/small-sizes.bundle.js" || true

# Run runtime-bundle versions
echo ""
echo "══════════════════════════════════════════════════════════════════════"
echo "RUNTIME-BUNDLE VERSIONS (~45KB demo + ~33KB runtime)"
echo "══════════════════════════════════════════════════════════════════════"
echo ""

run_demo "Hello World (bundled)" "examples/node/dist/hello-world-bundled.js" || true
run_demo "Hello World Multi-Size (bundled)" "examples/node/dist/hello-world-multi-size-bundled.js" || true
run_demo "Small Sizes Interpolation (bundled)" "examples/node/dist/small-sizes-bundled.js" || true

# Summary
echo ""
echo "======================================================================"
echo "Summary"
echo "======================================================================"
echo ""
echo "Total demos run: $TOTAL"
echo "Successful: $SUCCESS ✅"
echo "Failed: $FAILED ❌"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "🎉 All demos completed successfully!"
  echo ""
  echo "Generated PNG files:"
  ls -lh *.png 2>/dev/null | grep -E "(hello-world|small-sizes)" | awk '{print "  -", $9, "(" $5 ")"}'
  echo ""
  exit 0
else
  echo "⚠️  Some demos failed. Check output above for details."
  exit 1
fi
