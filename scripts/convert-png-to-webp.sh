#!/bin/bash

# PNG to WebP Converter
# Converts PNG atlas files to lossless WebP format and deletes source PNGs
# Part of BitmapText.js font assets pipeline

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%H:%M:%S') - $1"
}

# Default directory
DIRECTORY="${1:-font-assets}"

log_info "PNG to WebP Converter starting..."
log_info "Target directory: $DIRECTORY"

# Check if cwebp is installed
if ! command -v cwebp &> /dev/null; then
    log_error "cwebp command not found!"
    echo ""
    echo "WebP tools are required for this script."
    echo ""
    echo "Installation instructions:"
    echo ""
    echo "  macOS:"
    echo "    brew install webp"
    echo ""
    echo "  Ubuntu/Debian:"
    echo "    sudo apt-get install webp"
    echo ""
    echo "  RHEL/CentOS:"
    echo "    sudo yum install libwebp-tools"
    echo ""
    echo "After installation, run this script again."
    exit 1
fi

# Verify cwebp version
CWEBP_VERSION=$(cwebp -version 2>&1 | head -n 1)
log_info "Found cwebp: $CWEBP_VERSION"

# Check if directory exists
if [ ! -d "$DIRECTORY" ]; then
    log_error "Directory not found: $DIRECTORY"
    exit 1
fi

# Find all atlas PNG files
PNG_FILES=($(find "$DIRECTORY" -maxdepth 1 -name "atlas-*.png" -type f))

if [ ${#PNG_FILES[@]} -eq 0 ]; then
    log_warning "No atlas-*.png files found in $DIRECTORY"
    exit 0
fi

log_info "Found ${#PNG_FILES[@]} PNG file(s) to convert"
echo ""

# Statistics
TOTAL_PNG_SIZE=0
TOTAL_WEBP_SIZE=0
CONVERTED=0
FAILED=0

# Convert each PNG to WebP
for PNG_FILE in "${PNG_FILES[@]}"; do
    BASENAME=$(basename "$PNG_FILE" .png)
    WEBP_FILE="${DIRECTORY}/${BASENAME}.webp"

    log_info "Converting: $BASENAME.png → $BASENAME.webp"

    # Get original file size
    PNG_SIZE=$(stat -f%z "$PNG_FILE" 2>/dev/null || stat -c%s "$PNG_FILE" 2>/dev/null)
    TOTAL_PNG_SIZE=$((TOTAL_PNG_SIZE + PNG_SIZE))

    # Convert with optimal lossless compression
    # -lossless: Lossless compression (pixel-identical)
    # -z 9: Maximum compression effort (0-9 scale)
    # -m 6: Best compression method (0-6 scale, slowest but best)
    # -mt: Multi-threading for faster processing
    if cwebp -lossless -z 9 -m 6 -mt "$PNG_FILE" -o "$WEBP_FILE" > /dev/null 2>&1; then
        # Get WebP file size
        WEBP_SIZE=$(stat -f%z "$WEBP_FILE" 2>/dev/null || stat -c%s "$WEBP_FILE" 2>/dev/null)
        TOTAL_WEBP_SIZE=$((TOTAL_WEBP_SIZE + WEBP_SIZE))

        # Calculate savings
        SAVINGS=$((PNG_SIZE - WEBP_SIZE))
        PERCENT=$(awk "BEGIN {printf \"%.1f\", ($SAVINGS / $PNG_SIZE) * 100}")

        log_success "Converted: $PNG_SIZE bytes → $WEBP_SIZE bytes (saved $SAVINGS bytes, ${PERCENT}%)"

        # Delete source PNG file
        rm "$PNG_FILE"
        log_success "Deleted source PNG: $PNG_FILE"

        CONVERTED=$((CONVERTED + 1))
    else
        log_error "Failed to convert: $PNG_FILE"
        FAILED=$((FAILED + 1))
    fi

    echo ""
done

# Final statistics
echo "=================================================="
log_info "Conversion complete!"
echo ""
log_info "Files converted: $CONVERTED"
if [ $FAILED -gt 0 ]; then
    log_warning "Files failed: $FAILED"
fi
echo ""

if [ $CONVERTED -gt 0 ]; then
    TOTAL_SAVINGS=$((TOTAL_PNG_SIZE - TOTAL_WEBP_SIZE))
    TOTAL_PERCENT=$(awk "BEGIN {printf \"%.1f\", ($TOTAL_SAVINGS / $TOTAL_PNG_SIZE) * 100}")

    log_info "Total PNG size:  $TOTAL_PNG_SIZE bytes"
    log_info "Total WebP size: $TOTAL_WEBP_SIZE bytes"
    log_success "Total savings:   $TOTAL_SAVINGS bytes (${TOTAL_PERCENT}%)"
    echo ""
    log_success "All source PNG files have been deleted"
fi

echo "=================================================="
