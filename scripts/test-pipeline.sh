#!/bin/bash

# Test script for the font data pipeline (runs once without monitoring)

# Get the directory of this script and project root (via common.sh)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"
# $PROJECT_ROOT, ANSI colours, log() now available from common.sh.

function test_pipeline() {
    local downloads_dir="$HOME/Downloads"
    local font_assets_file="$downloads_dir/fontAssets.zip"
    
    log "INFO" "=== Testing Font Data Pipeline ==="
    log "INFO" "Project root: $PROJECT_ROOT"
    
    # Change to project root
    cd "$PROJECT_ROOT" || {
        log "ERROR" "Failed to change to project root: $PROJECT_ROOT"
        exit 1
    }
    
    # Check if fontAssets.zip exists
    if [ ! -f "$font_assets_file" ]; then
        log "ERROR" "fontAssets.zip not found in Downloads. Please generate one first."
        exit 1
    fi
    
    # Source the main script functions (but don't run main)
    source "$SCRIPT_DIR/watch-font-assets.sh"
    
    # Test the pipeline once
    log "INFO" "Testing processing pipeline..."
    if process_font_assets; then
        log "SUCCESS" "Pipeline test completed successfully!"
    else
        log "ERROR" "Pipeline test failed!"
        exit 1
    fi
    
    # Show final results
    log "INFO" "Final data directory contents:"
    ls -la font-assets/ | head -20
}

# Run the test
test_pipeline "$@"