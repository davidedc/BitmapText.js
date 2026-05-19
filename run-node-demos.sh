#!/bin/bash

set -e  # Exit on any error

echo "================================================================================"
echo "BitmapText.js Node.js Demos Runner"
echo "================================================================================"
echo ""

# Clean up examples/node/dist directory completely
echo "🧹 Cleaning up examples/node/dist directory..."
rm -rf examples/node/dist
mkdir -p examples/node/dist
echo ""

# Build runtime bundle if needed
echo "🔨 Building runtime bundle..."
./scripts/build-runtime-bundle.sh --node
echo ""

# Build standalone demo bundles (complete, self-contained)
echo "🔨 Building standalone demo bundles..."
./scripts/build-node-demo.sh hello-world
./scripts/build-node-demo.sh multi-size
./scripts/build-node-demo.sh small-sizes
echo ""

# Build runtime-bundle demos (concatenate Canvas/PNG, load runtime bundle)
echo "🔨 Building runtime-bundle demos..."
./scripts/build-node-bundled-demos.sh
echo ""

# Display info
echo "================================================================================"
echo "📂 Demo Files Ready"
echo "================================================================================"
echo ""
echo "Standalone Bundles (complete, ~196KB each):"
echo "  - examples/node/dist/hello-world.bundle.js"
echo "  - examples/node/dist/hello-world-multi-size.bundle.js"
echo "  - examples/node/dist/small-sizes.bundle.js"
echo ""
echo "Runtime Bundle Demos (use dist/bitmaptext-node.min.js, ~33KB):"
echo "  - examples/node/dist/hello-world-bundled.js"
echo "  - examples/node/dist/hello-world-multi-size-bundled.js"
echo "  - examples/node/dist/small-sizes-bundled.js"
echo ""

# Run all demos
echo "================================================================================"
echo "🚀 Running Demos"
echo "================================================================================"
echo ""

echo "────────────────────────────────────────────────────────────────────────────────"
echo "1️⃣  Standalone Bundle: Single-Size Demo"
echo "────────────────────────────────────────────────────────────────────────────────"
node examples/node/dist/hello-world.bundle.js
echo ""

echo "────────────────────────────────────────────────────────────────────────────────"
echo "2️⃣  Standalone Bundle: Multi-Size Demo"
echo "────────────────────────────────────────────────────────────────────────────────"
node examples/node/dist/hello-world-multi-size.bundle.js
echo ""

echo "────────────────────────────────────────────────────────────────────────────────"
echo "3️⃣  Runtime Bundle: Single-Size Demo"
echo "────────────────────────────────────────────────────────────────────────────────"
node examples/node/dist/hello-world-bundled.js
echo ""

echo "────────────────────────────────────────────────────────────────────────────────"
echo "4️⃣  Runtime Bundle: Multi-Size Demo"
echo "────────────────────────────────────────────────────────────────────────────────"
node examples/node/dist/hello-world-multi-size-bundled.js
echo ""

echo "────────────────────────────────────────────────────────────────────────────────"
echo "5️⃣  Standalone Bundle: Small Sizes Interpolation Demo"
echo "────────────────────────────────────────────────────────────────────────────────"
node examples/node/dist/small-sizes.bundle.js
echo ""

echo "────────────────────────────────────────────────────────────────────────────────"
echo "6️⃣  Runtime Bundle: Small Sizes Interpolation Demo"
echo "────────────────────────────────────────────────────────────────────────────────"
node examples/node/dist/small-sizes-bundled.js
echo ""

echo "================================================================================"
echo "✅ All 6 demos completed successfully!"
echo "================================================================================"
echo ""
echo "Generated PNG files:"
ls -lh hello-world*.png small-sizes*.png 2>/dev/null || echo "  (no PNG files found - demos may have failed)"
echo ""
echo "Bundle Comparison:"
echo "  Standalone: ~196KB (includes Canvas mock, PNG encoder, QOI decoder)"
echo "  Runtime:    ~33KB  (user provides Canvas, PNG encoder separate)"
echo ""
