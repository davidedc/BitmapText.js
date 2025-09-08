#!/bin/bash

# Clean up examples/node/dist directory completely
echo "Cleaning up examples/node/dist directory..."
rm -rf examples/node/dist
mkdir -p examples/node/dist

# Set up font assets for Node.js demos (in dist directory alongside bundles)
echo "Setting up font assets for Node.js demos..."
mkdir -p examples/node/dist/font-assets
cp font-assets/*.js examples/node/dist/font-assets/ 2>/dev/null || true
cp font-assets/*.qoi examples/node/dist/font-assets/ 2>/dev/null || true
echo "Font assets copied to examples/node/dist/font-assets/"

# Build and run demos
./scripts/build-node-demo.sh && ./scripts/build-node-multi-size-demo.sh && echo "Running single-size demo..." && node examples/node/dist/hello-world.bundle.js && echo -e "\nRunning multi-size demo..." && node examples/node/dist/hello-world-multi-size.bundle.js