#!/bin/bash

# Automated Font Data Pipeline
# Watches for ~/Downloads/fontAssets.zip and processes it through the complete pipeline

# Parse command line arguments
PRESERVE_ORIGINALS=false
REMOVE_QOI=false

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
        -h|--help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Automated font assets pipeline that monitors ~/Downloads/fontAssets.zip"
            echo ""
            echo "Options:"
            echo "  --preserve-originals     Keep .orig.png backup files after optimization"
            echo "  --no-preserve-originals  Remove .orig.png backup files after optimization (default)"
            echo "  --remove-qoi            Remove .qoi files after conversion to PNG"
            echo "  -h, --help              Show this help message"
            echo ""
            echo "The script will:"
            echo "  1. Monitor ~/Downloads/fontAssets.zip"
            echo "  2. Create timestamped backups of font-assets/ directory"
            echo "  3. Extract font assets to font-assets/"
            echo "  4. Convert QOI files to PNG format"
            echo "  5. Optimize PNG files"
            echo "  6. Convert PNGs to JS wrappers"
            echo "  7. Continue monitoring"
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
            mv "$DATA_DIR/fontAssets"/* "$DATA_DIR/" 2>/dev/null || true
            rmdir "$DATA_DIR/fontAssets" 2>/dev/null || true
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

function run_js_conversion() {
    log "INFO" "Converting PNGs to JS files..."
    
    if node "$PROJECT_ROOT/scripts/png-to-js-converter.js" "$DATA_DIR"; then
        log "SUCCESS" "PNG to JS conversion completed"
        return 0
    else
        log "ERROR" "PNG to JS conversion failed"
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
    
    # Step 6: Convert PNGs to JS
    if ! run_js_conversion; then
        log "WARNING" "PNG to JS conversion failed, but continuing..."
    fi
    
    # Step 7: Move zip to trash
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