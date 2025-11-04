#!/bin/bash

# Automated Font Data Pipeline
# Watches for ~/Downloads/fontAssets.zip and processes it through the complete pipeline

# Parse command line arguments
PRESERVE_ORIGINALS=false
REMOVE_QOI=false
KEEP_POSITIONING=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --preserve-originals)
            PRESERVE_ORIGINALS=true
            shift
            ;;
        --no-preserve-originals)
            PRESERVE_ORIGINALS=false
            shift
            ;;
        --remove-qoi)
            REMOVE_QOI=true
            shift
            ;;
        --keep-positioning)
            KEEP_POSITIONING=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Automated font assets pipeline that monitors ~/Downloads/fontAssets.zip"
            echo ""
            echo "Options:"
            echo "  --preserve-originals     Keep .orig.png backup files after optimization"
            echo "  --no-preserve-originals  Remove .orig.png backup files after optimization (default)"
            echo "  --remove-qoi            Remove .qoi files after conversion to PNG"
            echo "  --keep-positioning      Keep positioning JSON files after JS conversion"
            echo "  -h, --help              Show this help message"
            echo ""
            echo "The script will:"
            echo "  1. Monitor ~/Downloads/fontAssets.zip"
            echo "  2. Create timestamped backups of font-assets/ directory"
            echo "  3. Extract font assets to font-assets/"
            echo "  4. Convert QOI files to PNG format"
            echo "  5. Optimize PNG files with ImageOptim"
            echo "  6. Convert PNG to WebP (lossless) and delete PNG files"
            echo "  7. Convert images (WebP and QOI) to JS wrappers"
            echo "  8. Minify JS files (metrics + atlases) with terser"
            echo "  9. Generate font registry for test-renderer"
            echo "  10. Continue monitoring"
            echo ""
            echo "Press Ctrl+C to stop monitoring."
            exit 0
            ;;
        -*)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
        *)
            echo "Unknown argument: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOWNLOADS_DIR="$HOME/Downloads"
FONT_ASSETS_FILE="$DOWNLOADS_DIR/fontAssets.zip"
DATA_DIR="font-assets"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$DATA_DIR"

function log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local color=""
    
    case $level in
        "INFO") color="$BLUE" ;;
        "SUCCESS") color="$GREEN" ;;
        "WARNING") color="$YELLOW" ;;
        "ERROR") color="$RED" ;;
    esac
    
    echo -e "[$timestamp] ${color}[$level]${NC} $message"
}

function cleanup_on_exit() {
    log "INFO" "Script interrupted, cleaning up..."
    exit 0
}

# Set up signal handlers
trap cleanup_on_exit SIGINT SIGTERM

function check_dependencies() {
    log "INFO" "Checking dependencies..."
    local missing_deps=()
    
    # Check if Homebrew is available (macOS package manager)
    if ! command -v brew &> /dev/null; then
        log "ERROR" "Homebrew is not installed. Please install it first:"
        log "ERROR" "Visit: https://brew.sh/"
        exit 1
    fi
    
    # Check if fswatch is available
    if ! command -v fswatch &> /dev/null; then
        missing_deps+=("fswatch")
        log "WARNING" "fswatch is not installed."
    fi
    
    # Check if unzip is available (usually pre-installed on macOS)
    if ! command -v unzip &> /dev/null; then
        missing_deps+=("unzip")
        log "WARNING" "unzip is not available (this is unusual on macOS)"
    fi
    
    # Check if node is available
    if ! command -v node &> /dev/null; then
        missing_deps+=("node")
        log "WARNING" "Node.js is not installed."
    fi
    
    # Check if ImageOptim CLI is available
    if ! command -v imageoptim &> /dev/null; then
        missing_deps+=("imageoptim-cli")
        log "WARNING" "ImageOptim CLI is not installed."
    fi

    # Check if cwebp is available (for WebP conversion)
    if ! command -v cwebp &> /dev/null; then
        missing_deps+=("webp")
        log "WARNING" "cwebp (WebP tools) is not installed."
    fi

    # Check if terser is available (for metrics minification)
    if ! command -v terser &> /dev/null; then
        missing_deps+=("terser")
        log "WARNING" "terser is not installed."
    fi

    # Check if trash command is available (optional, but recommended)
    if ! command -v trash &> /dev/null; then
        log "WARNING" "trash command not found (will use rm instead)"
    fi
    
    # If any dependencies are missing, show installation instructions
    if [ ${#missing_deps[@]} -gt 0 ]; then
        log "ERROR" "Missing dependencies detected. Please install:"
        echo ""
        for dep in "${missing_deps[@]}"; do
            case $dep in
                "fswatch")
                    echo "  brew install fswatch"
                    ;;
                "node")
                    echo "  brew install node"
                    ;;
                "imageoptim-cli")
                    echo "  brew install --cask imageoptim"
                    echo "  brew install imageoptim-cli"
                    echo "  (Note: You need BOTH the app and CLI tool)"
                    ;;
                "webp")
                    echo "  brew install webp"
                    ;;
                "terser")
                    echo "  npm install -g terser"
                    echo "  (Note: Requires Node.js/npm to be installed)"
                    ;;
                "unzip")
                    echo "  unzip should be pre-installed on macOS"
                    ;;
            esac
        done
        echo ""
        log "ERROR" "Install missing dependencies and try again"
        exit 1
    fi
    
    log "SUCCESS" "All dependencies are available"
}

function backup_current_data() {
    if [ ! -d "$DATA_DIR" ]; then
        log "WARNING" "Data directory $DATA_DIR does not exist, skipping backup"
        return 0
    fi
    
    local backup_name="font-assets-backup-$(date '+%Y-%m-%d-%H%M%S').zip"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    log "INFO" "Creating backup: $backup_name"
    
    # Create backup excluding any existing backup files
    if cd "$DATA_DIR" && zip -r "../$backup_name" . -x "font-assets-backup-*.zip"; then
        log "SUCCESS" "Backup created: $backup_path"
        cd ..
        return 0
    else
        log "ERROR" "Failed to create backup"
        return 1
    fi
}

function clear_data_directory() {
    log "INFO" "Clearing font-assets directory (preserving backups)..."
    
    if [ ! -d "$DATA_DIR" ]; then
        mkdir -p "$DATA_DIR"
        log "INFO" "Created font-assets directory"
        return 0
    fi
    
    # Remove all files except backup files
    find "$DATA_DIR" -type f ! -name "font-assets-backup-*.zip" -delete
    
    if [ $? -eq 0 ]; then
        log "SUCCESS" "Data directory cleared"
        return 0
    else
        log "ERROR" "Failed to clear font-assets directory"
        return 1
    fi
}

function extract_font_assets() {
    log "INFO" "Extracting fontAssets.zip to $DATA_DIR"

    if unzip -o "$FONT_ASSETS_FILE" -d "$DATA_DIR"; then
        log "SUCCESS" "Successfully extracted fontAssets.zip"

        # Check if files were extracted to a fontAssets subdirectory and move them up
        if [ -d "$DATA_DIR/fontAssets" ]; then
            log "INFO" "Moving files from fontAssets/ subdirectory to font-assets/ root"

            # Move all files (including hidden files) from subdirectory
            # Use find to handle all files including hidden ones
            find "$DATA_DIR/fontAssets" -maxdepth 1 -mindepth 1 -exec mv {} "$DATA_DIR/" \; 2>/dev/null || true

            # Remove the now-empty subdirectory
            # Use rm -rf to handle any edge cases (should be empty by now)
            if [ -d "$DATA_DIR/fontAssets" ]; then
                rm -rf "$DATA_DIR/fontAssets"
                log "SUCCESS" "Removed fontAssets/ subdirectory"
            fi

            log "SUCCESS" "Files moved to font-assets/ root directory"
        fi

        return 0
    else
        log "ERROR" "Failed to extract fontAssets.zip"
        return 1
    fi
}

function move_zip_to_trash() {
    log "INFO" "Moving processed zip file to trash"
    
    # Use macOS trash command if available, otherwise just remove
    if command -v trash &> /dev/null; then
        trash "$FONT_ASSETS_FILE"
        log "SUCCESS" "Moved fontAssets.zip to trash"
    else
        rm "$FONT_ASSETS_FILE"
        log "SUCCESS" "Removed fontAssets.zip"
    fi
}

function run_qoi_to_png_conversion() {
    log "INFO" "Converting QOI files to PNG format..."
    
    local qoi_flag=""
    if [ "$REMOVE_QOI" = "true" ]; then
        qoi_flag="--remove-qoi"
        log "INFO" "QOI files will be removed after conversion"
    else
        log "INFO" "QOI files will be preserved after conversion"
    fi
    
    if node "$PROJECT_ROOT/scripts/qoi-to-png-converter.js" "$DATA_DIR" $qoi_flag; then
        log "SUCCESS" "QOI to PNG conversion completed"
        return 0
    else
        log "ERROR" "QOI to PNG conversion failed"
        return 1
    fi
}

function run_optimization() {
    log "INFO" "Running PNG optimization..."

    local preserve_flag=""
    if [ "$PRESERVE_ORIGINALS" = "true" ]; then
        preserve_flag="--preserve-originals"
        log "INFO" "Original PNG files will be preserved"
    else
        preserve_flag="--no-preserve-originals"
        log "INFO" "Original PNG backup files will be removed after optimization"
    fi

    if bash "$PROJECT_ROOT/scripts/optimize-images.sh" $preserve_flag "$DATA_DIR"; then
        log "SUCCESS" "PNG optimization completed"
        return 0
    else
        log "ERROR" "PNG optimization failed"
        return 1
    fi
}

function run_webp_conversion() {
    log "INFO" "Converting optimized PNG files to WebP format..."
    log "INFO" "Source PNG files will be deleted after conversion"

    if bash "$PROJECT_ROOT/scripts/convert-png-to-webp.sh" "$DATA_DIR"; then
        log "SUCCESS" "WebP conversion completed (PNG files deleted)"
        return 0
    else
        log "ERROR" "WebP conversion failed"
        return 1
    fi
}

function run_js_conversion() {
    log "INFO" "Converting image files (WebP and QOI) to JS files..."

    local positioning_flag=""
    if [ "$KEEP_POSITIONING" = "true" ]; then
        positioning_flag="--keep-positioning"
        log "INFO" "Positioning JSON files will be preserved after conversion"
    else
        log "INFO" "Positioning JSON files will be removed after conversion"
    fi

    if node "$PROJECT_ROOT/scripts/image-to-js-converter.js" "$DATA_DIR" --all $positioning_flag; then
        log "SUCCESS" "Image to JS conversion completed"
        return 0
    else
        log "ERROR" "Image to JS conversion failed"
        return 1
    fi
}

function generate_font_registry() {
    log "INFO" "Generating font registry for test-renderer..."

    if node "$PROJECT_ROOT/scripts/generate-font-registry.js"; then
        log "SUCCESS" "Font registry generation completed"
        return 0
    else
        log "WARNING" "Font registry generation failed"
        return 1
    fi
}

function run_terser_minification() {
    log "INFO" "Minifying JS files with terser (metrics + atlases)..."

    # Track metrics separately
    local metrics_count=0
    local metrics_before=0
    local metrics_after=0

    # Track atlases separately
    local atlas_count=0
    local atlas_before=0
    local atlas_after=0

    # Process metrics files
    log "INFO" "Processing metrics files..."
    local metrics_files=$(find "$DATA_DIR" -name "metrics-density-*.js" ! -name "*-full.js" -type f)

    if [ -n "$metrics_files" ]; then
        while IFS= read -r file; do
            if [ -f "$file" ]; then
                local before_size=$(wc -c < "$file")
                local temp_file="${file}.tmp"

                # Run terser: minify in-place with compact output
                if terser "$file" -c -m -o "$temp_file" 2>/dev/null; then
                    local after_size=$(wc -c < "$temp_file")
                    mv "$temp_file" "$file"

                    local saved=$((before_size - after_size))
                    log "SUCCESS" "METRICS: $(basename "$file"): ${before_size} → ${after_size} bytes (saved ${saved} bytes)"

                    metrics_count=$((metrics_count + 1))
                    metrics_before=$((metrics_before + before_size))
                    metrics_after=$((metrics_after + after_size))
                else
                    log "WARNING" "Failed to minify metrics file: $(basename "$file")"
                    rm -f "$temp_file"
                fi
            fi
        done <<< "$metrics_files"
    else
        log "WARNING" "No metrics files found to minify"
    fi

    # Process atlas files (both webp and qoi variants)
    log "INFO" "Processing atlas files..."
    local atlas_files=$(find "$DATA_DIR" \( -name "atlas-density-*-webp.js" -o -name "atlas-density-*-qoi.js" \) -type f)

    if [ -n "$atlas_files" ]; then
        while IFS= read -r file; do
            if [ -f "$file" ]; then
                local before_size=$(wc -c < "$file")
                local temp_file="${file}.tmp"

                # Run terser: minify in-place with compact output
                if terser "$file" -c -m -o "$temp_file" 2>/dev/null; then
                    local after_size=$(wc -c < "$temp_file")
                    mv "$temp_file" "$file"

                    local saved=$((before_size - after_size))
                    log "SUCCESS" "ATLAS: $(basename "$file"): ${before_size} → ${after_size} bytes (saved ${saved} bytes)"

                    atlas_count=$((atlas_count + 1))
                    atlas_before=$((atlas_before + before_size))
                    atlas_after=$((atlas_after + after_size))
                else
                    log "WARNING" "Failed to minify atlas file: $(basename "$file")"
                    rm -f "$temp_file"
                fi
            fi
        done <<< "$atlas_files"
    else
        log "WARNING" "No atlas files found to minify"
    fi

    # Summary statistics
    local total_count=$((metrics_count + atlas_count))
    local total_before=$((metrics_before + atlas_before))
    local total_after=$((metrics_after + atlas_after))
    local total_saved=$((total_before - total_after))

    if [ $total_count -gt 0 ]; then
        log "SUCCESS" "═══════════════════════════════════════════════════"
        if [ $metrics_count -gt 0 ]; then
            local metrics_saved=$((metrics_before - metrics_after))
            log "SUCCESS" "Metrics: ${metrics_count} file(s), saved ${metrics_saved} bytes"
        fi
        if [ $atlas_count -gt 0 ]; then
            local atlas_saved=$((atlas_before - atlas_after))
            log "SUCCESS" "Atlases: ${atlas_count} file(s), saved ${atlas_saved} bytes"
        fi
        log "SUCCESS" "Total: ${total_count} file(s), ${total_before} → ${total_after} bytes (saved ${total_saved} bytes)"
        log "SUCCESS" "═══════════════════════════════════════════════════"
        return 0
    else
        log "WARNING" "No files were minified"
        return 1
    fi
}

function process_font_assets() {
    log "INFO" "Starting font assets processing pipeline..."
    
    # Step 1: Backup current data
    if ! backup_current_data; then
        log "ERROR" "Backup failed, aborting processing"
        return 1
    fi
    
    # Step 2: Clear data directory
    if ! clear_data_directory; then
        log "ERROR" "Failed to clear font-assets directory, aborting processing"
        return 1
    fi
    
    # Step 3: Extract font assets
    if ! extract_font_assets; then
        log "ERROR" "Failed to extract font assets, aborting processing"
        return 1
    fi
    
    # Step 4: Convert QOI files to PNG format
    if ! run_qoi_to_png_conversion; then
        log "WARNING" "QOI to PNG conversion failed, but continuing..."
    fi
    
    # Step 5: Run PNG optimization
    if ! run_optimization; then
        log "WARNING" "PNG optimization failed, but continuing..."
    fi

    # Step 6: Convert PNG to WebP (deletes PNG files)
    if ! run_webp_conversion; then
        log "WARNING" "WebP conversion failed, but continuing..."
    fi

    # Step 7: Convert images (WebP and QOI) to JS
    if ! run_js_conversion; then
        log "WARNING" "Image to JS conversion failed, but continuing..."
    fi

    # Step 8: Minify metrics files with terser
    if ! run_terser_minification; then
        log "WARNING" "Terser minification failed, but continuing..."
    fi

    # Step 9: Generate font registry
    if ! generate_font_registry; then
        log "WARNING" "Font registry generation failed, but continuing..."
    fi

    # Step 10: Move zip to trash
    move_zip_to_trash

    log "SUCCESS" "Font assets processing pipeline completed!"
    return 0
}

function start_monitoring() {
    log "INFO" "Starting to monitor for fontAssets.zip in $DOWNLOADS_DIR"
    log "INFO" "Press Ctrl+C to stop monitoring"
    
    # Use fswatch to monitor the downloads directory
    fswatch -o "$DOWNLOADS_DIR" | while read num_events; do
        if [ -f "$FONT_ASSETS_FILE" ]; then
            log "SUCCESS" "Detected fontAssets.zip!"
            
            # Wait a moment to ensure file is fully written
            sleep 1
            
            # Process the file
            process_font_assets
            
            log "INFO" "Resuming monitoring..."
        fi
    done
}

# Main script execution
function main() {
    log "INFO" "=== BitmapText.js Font Assets Watcher ==="
    log "INFO" "Working directory: $PROJECT_ROOT"
    log "INFO" "Data directory: $DATA_DIR"
    log "INFO" "Monitoring: $FONT_ASSETS_FILE"
    log "INFO" "Preserve originals: $PRESERVE_ORIGINALS"
    log "INFO" "Remove QOI files: $REMOVE_QOI"
    log "INFO" "Keep positioning files: $KEEP_POSITIONING"
    
    # Change to project root
    cd "$PROJECT_ROOT" || {
        log "ERROR" "Failed to change to project root: $PROJECT_ROOT"
        exit 1
    }
    
    # Check dependencies
    check_dependencies
    
    # Ensure data directory exists
    mkdir -p "$DATA_DIR"
    
    # Check if there's already a fontAssets.zip file
    if [ -f "$FONT_ASSETS_FILE" ]; then
        log "WARNING" "Found existing fontAssets.zip, processing it first..."
        process_font_assets
    fi
    
    # Start monitoring
    start_monitoring
}

# Run main function
main "$@"