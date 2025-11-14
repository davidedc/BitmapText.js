#!/bin/bash

# Build script for Node.js runtime-bundle demos
# Concatenates user-provided dependencies (Canvas, PNG encoder) with demo logic
# Demos then use the production runtime bundle via require()

set -e  # Exit on any error

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Building Node.js runtime-bundle demos..."

# Project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Define paths
SRC_DIR="$PROJECT_ROOT/src"
LIB_DIR="$PROJECT_ROOT/lib"
OUTPUT_DIR="$PROJECT_ROOT/examples/node/dist"

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Function to build a bundled demo
build_bundled_demo() {
  local demo_name="$1"
  local main_file="$2"
  local output_file="$OUTPUT_DIR/${demo_name}.js"

  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Building ${demo_name}..."

  # Create bundle header
  cat > "$output_file" << 'EOF'
#!/usr/bin/env node

/**
 * ⚠️  THIS IS A BUILT FILE - DO NOT EDIT ⚠️
 *
 * BitmapText.js Node.js Demo - Runtime Bundle Version
 *
 * This file concatenates user-provided dependencies:
 *   - Canvas mock (platform abstraction)
 *   - PNG encoder (I/O utilities)
 *
 * Then loads the runtime bundle:
 *   - dist/bitmaptext-node.min.js (rendering only, ~33KB)
 *
 * To modify this demo:
 *   1. Edit source: src/node/
 *   2. Run: ./scripts/build-node-bundled-demos.sh
 *
 * This demonstrates the production pattern:
 *   User provides: Canvas implementation, I/O utilities
 *   Library provides: Text rendering (runtime bundle)
 */

EOF

  # Add Canvas mock (no require/exports needed - classes available globally)
  echo "// ============================================================================" >> "$output_file"
  echo "// USER-PROVIDED: Canvas Implementation" >> "$output_file"
  echo "// ============================================================================" >> "$output_file"
  echo "" >> "$output_file"
  cat "$SRC_DIR/platform/canvas-mock.js" | grep -v "module.exports" >> "$output_file"
  echo "" >> "$output_file"

  # Add PNG encoding utilities (no require/exports needed)
  echo "// ============================================================================" >> "$output_file"
  echo "// USER-PROVIDED: PNG Encoder (I/O Utilities)" >> "$output_file"
  echo "// ============================================================================" >> "$output_file"
  echo "" >> "$output_file"
  cat "$LIB_DIR/PngEncodingOptions.js" | grep -v "module.exports" >> "$output_file"
  echo "" >> "$output_file"
  cat "$LIB_DIR/PngEncoder.js" | grep -v "module.exports" >> "$output_file"
  echo "" >> "$output_file"

  # Add runtime bundle loader
  echo "// ============================================================================" >> "$output_file"
  echo "// RUNTIME BUNDLE: BitmapText Rendering (~33KB)" >> "$output_file"
  echo "// ============================================================================" >> "$output_file"
  echo "" >> "$output_file"
  echo "// Load production runtime bundle" >> "$output_file"
  echo "require('../../../dist/bitmaptext-node.min.js');" >> "$output_file"
  echo "" >> "$output_file"

  # Add Node.js built-ins
  echo "// ============================================================================" >> "$output_file"
  echo "// NODE.JS BUILT-INS" >> "$output_file"
  echo "// ============================================================================" >> "$output_file"
  echo "" >> "$output_file"
  echo "const fs = require('fs');" >> "$output_file"
  echo "const path = require('path');" >> "$output_file"
  echo "" >> "$output_file"

  # Add demo logic (strip the require statements since we concatenated dependencies)
  echo "// ============================================================================" >> "$output_file"
  echo "// DEMO LOGIC" >> "$output_file"
  echo "// ============================================================================" >> "$output_file"
  echo "" >> "$output_file"

  # Extract demo logic (skip the header comments and require statements)
  tail -n +23 "$main_file" | \
    grep -v "const { Canvas }" | \
    grep -v "const { PngEncoder }" | \
    grep -v "const { PngEncodingOptions }" | \
    grep -v "const fs = require" | \
    grep -v "const path = require" | \
    grep -v "require('.*bitmaptext-node" | \
    grep -v "^// ============================================================================$" | \
    grep -v "^// USER-PROVIDED DEPENDENCIES$" | \
    grep -v "^// LIBRARY RUNTIME BUNDLE" | \
    grep -v "^// ============================================================================$" \
    >> "$output_file"

  # Make executable
  chmod +x "$output_file"

  local file_size=$(wc -c < "$output_file" | tr -d ' ')
  local file_kb=$((file_size / 1024))

  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ ${demo_name} complete: ${file_kb}KB"
}

# Build all demos
build_bundled_demo "hello-world-bundled" "$SRC_DIR/node/hello-world-bundled-main.js"
build_bundled_demo "hello-world-multi-size-bundled" "$SRC_DIR/node/hello-world-multi-size-bundled-main.js"
build_bundled_demo "small-sizes-bundled" "$SRC_DIR/node/small-sizes-bundled-main.js"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ================================================"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Runtime-bundle demos built successfully! ✅"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ================================================"
echo ""
echo "Output files:"
echo "  - examples/node/dist/hello-world-bundled.js"
echo "  - examples/node/dist/hello-world-multi-size-bundled.js"
echo "  - examples/node/dist/small-sizes-bundled.js"
echo ""
echo "These demos:"
echo "  - Include Canvas mock + PNG encoder (concatenated, no require)"
echo "  - Load runtime bundle via require() (~33KB)"
echo "  - Demonstrate production pattern: user provides platform/I/O, library provides rendering"
echo ""
