#!/bin/bash

# Build all Node.js demos
# This script builds both standalone bundles and runtime-bundle versions

set -e  # Exit on any error

echo "======================================================================"
echo "Building All Node.js Demos"
echo "======================================================================"
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Build standalone bundles (concatenate all dependencies)
echo "[1/4] Building standalone demos..."
echo "----------------------------------------------------------------------"
"$SCRIPT_DIR/build-node-demo.sh"
echo ""

"$SCRIPT_DIR/build-node-multi-size-demo.sh"
echo ""

"$SCRIPT_DIR/build-node-small-sizes-demo.sh"
echo ""

# Build runtime-bundle versions (use production runtime bundle)
echo "[2/4] Building runtime-bundle demos..."
echo "----------------------------------------------------------------------"
"$SCRIPT_DIR/build-node-bundled-demos.sh"
echo ""

echo "======================================================================"
echo "✅ All Node.js demos built successfully!"
echo "======================================================================"
echo ""
echo "Standalone bundles (no dependencies):"
echo "  - examples/node/dist/hello-world.bundle.js (~205KB)"
echo "  - examples/node/dist/hello-world-multi-size.bundle.js (~207KB)"
echo "  - examples/node/dist/small-sizes.bundle.js (~214KB)"
echo ""
echo "Runtime-bundle versions (~33KB runtime + ~45KB demo):"
echo "  - examples/node/dist/hello-world-bundled.js"
echo "  - examples/node/dist/hello-world-multi-size-bundled.js"
echo "  - examples/node/dist/small-sizes-bundled.js"
echo ""
echo "To run all demos:"
echo "  ./scripts/run-all-node-demos.sh"
echo ""
