#!/bin/bash

# Automated Font Data Pipeline
# Watches for ~/Downloads/glyphSheets.zip and processes it through the complete pipeline

# Parse command line arguments
PRESERVE_ORIGINALS=false

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
        -h|--help)
            echo "Usage: $0 [--preserve-originals|--no-preserve-originals]"
            echo ""
            echo "Automated font data pipeline that monitors ~/Downloads/glyphSheets.zip"
            echo ""
            echo "Options:"
            echo "  --preserve-originals     Keep .orig.png backup files after optimization"
            echo "  --no-preserve-originals  Remove .orig.png backup files after optimization (default)"
            echo "  -h, --help              Show this help message"
            echo ""
            echo "The script will:"
            echo "  1. Monitor ~/Downloads/glyphSheets.zip"
            echo "  2. Create timestamped backups of data/ directory"
            echo "  3. Extract new glyphSheets.zip to data/"
            echo "  4. Optimize PNG files"
            echo "  5. Convert PNGs to JS wrappers"
            echo "  6. Continue monitoring"
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
GLYPH_SHEETS_FILE="$DOWNLOADS_DIR/glyphSheets.zip"
DATA_DIR="data"
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
    
    local backup_name="data-backup-$(date '+%Y-%m-%d-%H%M%S').zip"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    log "INFO" "Creating backup: $backup_name"
    
    # Create backup excluding any existing backup files
    if cd "$DATA_DIR" && zip -r "../$backup_name" . -x "data-backup-*.zip"; then
        log "SUCCESS" "Backup created: $backup_path"
        cd ..
        return 0
    else
        log "ERROR" "Failed to create backup"
        return 1
    fi
}

function clear_data_directory() {
    log "INFO" "Clearing data directory (preserving backups)..."
    
    if [ ! -d "$DATA_DIR" ]; then
        mkdir -p "$DATA_DIR"
        log "INFO" "Created data directory"
        return 0
    fi
    
    # Remove all files except backup files
    find "$DATA_DIR" -type f ! -name "data-backup-*.zip" -delete
    
    if [ $? -eq 0 ]; then
        log "SUCCESS" "Data directory cleared"
        return 0
    else
        log "ERROR" "Failed to clear data directory"
        return 1
    fi
}

function extract_glyph_sheets() {
    log "INFO" "Extracting glyphSheets.zip to $DATA_DIR"
    
    if unzip -o "$GLYPH_SHEETS_FILE" -d "$DATA_DIR"; then
        log "SUCCESS" "Successfully extracted glyphSheets.zip"
        
        # Check if files were extracted to a glyphSheets subdirectory and move them up
        if [ -d "$DATA_DIR/glyphSheets" ]; then
            log "INFO" "Moving files from glyphSheets/ subdirectory to data/ root"
            mv "$DATA_DIR/glyphSheets"/* "$DATA_DIR/" 2>/dev/null || true
            rmdir "$DATA_DIR/glyphSheets" 2>/dev/null || true
            log "SUCCESS" "Files moved to data/ root directory"
        fi
        
        return 0
    else
        log "ERROR" "Failed to extract glyphSheets.zip"
        return 1
    fi
}

function move_zip_to_trash() {
    log "INFO" "Moving processed zip file to trash"
    
    # Use macOS trash command if available, otherwise just remove
    if command -v trash &> /dev/null; then
        trash "$GLYPH_SHEETS_FILE"
        log "SUCCESS" "Moved glyphSheets.zip to trash"
    else
        rm "$GLYPH_SHEETS_FILE"
        log "SUCCESS" "Removed glyphSheets.zip"
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

function process_glyph_sheets() {
    log "INFO" "Starting glyph sheets processing pipeline..."
    
    # Step 1: Backup current data
    if ! backup_current_data; then
        log "ERROR" "Backup failed, aborting processing"
        return 1
    fi
    
    # Step 2: Clear data directory
    if ! clear_data_directory; then
        log "ERROR" "Failed to clear data directory, aborting processing"
        return 1
    fi
    
    # Step 3: Extract new glyph sheets
    if ! extract_glyph_sheets; then
        log "ERROR" "Failed to extract glyph sheets, aborting processing"
        return 1
    fi
    
    # Step 4: Run PNG optimization
    if ! run_optimization; then
        log "WARNING" "PNG optimization failed, but continuing..."
    fi
    
    # Step 5: Convert PNGs to JS
    if ! run_js_conversion; then
        log "WARNING" "PNG to JS conversion failed, but continuing..."
    fi
    
    # Step 6: Move zip to trash
    move_zip_to_trash
    
    log "SUCCESS" "Glyph sheets processing pipeline completed!"
    return 0
}

function start_monitoring() {
    log "INFO" "Starting to monitor for glyphSheets.zip in $DOWNLOADS_DIR"
    log "INFO" "Press Ctrl+C to stop monitoring"
    
    # Use fswatch to monitor the downloads directory
    fswatch -o "$DOWNLOADS_DIR" | while read num_events; do
        if [ -f "$GLYPH_SHEETS_FILE" ]; then
            log "SUCCESS" "Detected glyphSheets.zip!"
            
            # Wait a moment to ensure file is fully written
            sleep 1
            
            # Process the file
            process_glyph_sheets
            
            log "INFO" "Resuming monitoring..."
        fi
    done
}

# Main script execution
function main() {
    log "INFO" "=== BitmapText.js Glyph Sheets Watcher ==="
    log "INFO" "Working directory: $PROJECT_ROOT"
    log "INFO" "Data directory: $DATA_DIR"
    log "INFO" "Monitoring: $GLYPH_SHEETS_FILE"
    log "INFO" "Preserve originals: $PRESERVE_ORIGINALS"
    
    # Change to project root
    cd "$PROJECT_ROOT" || {
        log "ERROR" "Failed to change to project root: $PROJECT_ROOT"
        exit 1
    }
    
    # Check dependencies
    check_dependencies
    
    # Ensure data directory exists
    mkdir -p "$DATA_DIR"
    
    # Check if there's already a glyphSheets.zip file
    if [ -f "$GLYPH_SHEETS_FILE" ]; then
        log "WARNING" "Found existing glyphSheets.zip, processing it first..."
        process_glyph_sheets
    fi
    
    # Start monitoring
    start_monitoring
}

# Run main function
main "$@"