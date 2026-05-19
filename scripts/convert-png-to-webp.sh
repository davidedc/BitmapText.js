#!/bin/bash

# PNG to WebP Converter
# Converts PNG atlas files to lossless WebP format and deletes source PNGs
# Part of BitmapText.js font assets pipeline

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

# Default directory
DIRECTORY="${1:-font-assets}"

log "INFO" "PNG to WebP Converter starting..."
log "INFO" "Target directory: $DIRECTORY"

# Check if cwebp is installed
if ! command -v cwebp &> /dev/null; then
    log "ERROR" "cwebp command not found!"
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
log "INFO" "Found cwebp: $CWEBP_VERSION"

# Check if directory exists
if [ ! -d "$DIRECTORY" ]; then
    log "ERROR" "Directory not found: $DIRECTORY"
    exit 1
fi

# Count atlas PNG files (use NUL-delimited find to handle filenames with spaces)
NUM_PNG_FILES=$(find "$DIRECTORY" -maxdepth 1 -name "atlas-*.png" -type f -print0 | tr -cd '\0' | wc -c | tr -d ' ')

if [ "$NUM_PNG_FILES" -eq 0 ]; then
    log "WARNING" "No atlas-*.png files found in $DIRECTORY"
    exit 0
fi

log "INFO" "Found ${NUM_PNG_FILES} PNG file(s) to convert"
echo ""

# Statistics
TOTAL_PNG_SIZE=0
TOTAL_WEBP_SIZE=0
CONVERTED=0
FAILED=0

# Convert each PNG to WebP (NUL-delimited to preserve spaces in filenames; process
# substitution keeps the loop in the parent shell so counters propagate)
while IFS= read -r -d '' PNG_FILE; do
    BASENAME=$(basename "$PNG_FILE" .png)
    WEBP_FILE="${DIRECTORY}/${BASENAME}.webp"

    log "INFO" "Converting: $BASENAME.png → $BASENAME.webp"

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

        # Check for zero-byte WebP file (indicates silent conversion failure)
        if [ "$WEBP_SIZE" -eq 0 ]; then
            log "WARNING" "WebP conversion produced zero-byte file for: $BASENAME.png"
            log "WARNING" "This typically happens when image dimensions exceed WebP's 16383px limit"
            log "WARNING" "Keeping original PNG file instead"
            rm "$WEBP_FILE"
            FAILED=$((FAILED + 1))
        else
            TOTAL_WEBP_SIZE=$((TOTAL_WEBP_SIZE + WEBP_SIZE))

            # Calculate savings
            SAVINGS=$((PNG_SIZE - WEBP_SIZE))
            PERCENT=$(awk "BEGIN {printf \"%.1f\", ($SAVINGS / $PNG_SIZE) * 100}")

            log "SUCCESS" "Converted: $PNG_SIZE bytes → $WEBP_SIZE bytes (saved $SAVINGS bytes, ${PERCENT}%)"

            # Delete source PNG file
            rm "$PNG_FILE"
            log "SUCCESS" "Deleted source PNG: $PNG_FILE"

            CONVERTED=$((CONVERTED + 1))
        fi
    else
        # Check if a zero-byte WebP file was created despite the error
        if [ -f "$WEBP_FILE" ]; then
            WEBP_SIZE=$(stat -f%z "$WEBP_FILE" 2>/dev/null || stat -c%s "$WEBP_FILE" 2>/dev/null)
            if [ "$WEBP_SIZE" -eq 0 ]; then
                log "WARNING" "WebP conversion failed and produced zero-byte file for: $BASENAME.png"
                log "WARNING" "This typically happens when image dimensions exceed WebP's 16383px limit"
                log "WARNING" "Keeping original PNG file and removing invalid WebP"
                rm "$WEBP_FILE"
            else
                log "ERROR" "Failed to convert: $PNG_FILE (but WebP file exists with size $WEBP_SIZE)"
            fi
        else
            log "ERROR" "Failed to convert: $PNG_FILE"
        fi
        FAILED=$((FAILED + 1))
    fi

    echo ""
done < <(find "$DIRECTORY" -maxdepth 1 -name "atlas-*.png" -type f -print0)

# Final statistics
echo "=================================================="
log "INFO" "Conversion complete!"
echo ""
log "INFO" "Files converted: $CONVERTED"
if [ $FAILED -gt 0 ]; then
    log "WARNING" "Files failed: $FAILED"
fi
echo ""

if [ $CONVERTED -gt 0 ]; then
    TOTAL_SAVINGS=$((TOTAL_PNG_SIZE - TOTAL_WEBP_SIZE))
    TOTAL_PERCENT=$(awk "BEGIN {printf \"%.1f\", ($TOTAL_SAVINGS / $TOTAL_PNG_SIZE) * 100}")

    log "INFO" "Total PNG size:  $TOTAL_PNG_SIZE bytes"
    log "INFO" "Total WebP size: $TOTAL_WEBP_SIZE bytes"
    log "SUCCESS" "Total savings:   $TOTAL_SAVINGS bytes (${TOTAL_PERCENT}%)"
    echo ""
    log "SUCCESS" "All source PNG files have been deleted"
fi

echo "=================================================="
