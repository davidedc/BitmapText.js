#!/bin/bash

# Parse command line arguments
PRESERVE_ORIGINALS=false
TARGET_DIR=""

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
            echo "Usage: $0 [--preserve-originals|--no-preserve-originals] [directory]"
            echo ""
            echo "Options:"
            echo "  --preserve-originals     Keep .orig.png backup files after optimization"
            echo "  --no-preserve-originals  Remove .orig.png backup files after optimization (default)"
            echo "  -h, --help              Show this help message"
            echo ""
            echo "Arguments:"
            echo "  directory               Target directory (default: font-assets/)"
            exit 0
            ;;
        -*)
            echo "Unknown option: $1"
            exit 1
            ;;
        *)
            if [ -z "$TARGET_DIR" ]; then
                TARGET_DIR="$1"
            else
                echo "Too many arguments"
                exit 1
            fi
            shift
            ;;
    esac
done

# Set default directory if not provided
TARGET_DIR="${TARGET_DIR:-font-assets}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting PNG optimization in directory: $TARGET_DIR"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Preserve originals: $PRESERVE_ORIGINALS"

# Check dependencies
if ! command -v brew &> /dev/null; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Homebrew is not installed. Please install it first:"
    echo "Visit: https://brew.sh/"
    exit 1
fi

# Check if ImageOptim is installed
if ! command -v imageoptim &> /dev/null; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: ImageOptim is not installed. Please install it first by running BOTH:"
    echo "  brew install --cask imageoptim"
    echo "  brew install imageoptim-cli"
    echo ""
    echo "Note: You need both the app AND the CLI tool for this script to work."
    exit 1
fi

# Check if target directory exists
if [ ! -d "$TARGET_DIR" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Directory $TARGET_DIR does not exist"
    exit 1
fi

# Change to target directory
cd "$TARGET_DIR" || exit 1
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Working in directory: $(pwd)"

# Loop through all PNG files in the directory
for file in *.png; do
    # Skip if no PNG files found
    [[ -e "$file" ]] || continue
    
    # Skip files that end with .orig.png
    if [[ "$file" == *.orig.png ]]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Skipping $file"
        continue
    fi
    
    # Check if .orig version already exists
    if [[ -f "${file%.png}.orig.png" ]]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Original backup already exists for $file, skipping..."
        continue
    fi
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Processing $file..."
    
    # Create backup of original file
    cp "$file" "${file%.png}.orig.png"
    
    # Optimize the file in place
    imageoptim --quality=100 --speed=1 "$file"
    
    # Remove .orig.png backup if preserve flag is false
    if [ "$PRESERVE_ORIGINALS" = "false" ]; then
        if [[ -f "${file%.png}.orig.png" ]]; then
            rm "${file%.png}.orig.png"
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Optimized $file (removed backup)"
        else
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Optimized $file"
        fi
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Optimized $file (backup preserved)"
    fi
done

echo "[$(date '+%Y-%m-%d %H:%M:%S')] PNG optimization completed"