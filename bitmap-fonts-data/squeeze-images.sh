#!/bin/bash

# Check if ImageOptim is installed
if ! command -v imageoptim &> /dev/null; then
    echo "ImageOptim is not installed. Please install it first."
    exit 1
fi

# Loop through all PNG files in the directory
for file in *.png; do
    # Skip if no PNG files found
    [[ -e "$file" ]] || continue
    
    # Skip files that end with .orig.png
    if [[ "$file" == *.orig.png ]]; then
        echo "Skipping $file"
        continue
    fi
    
    # Check if .orig version already exists
    if [[ -f "${file%.png}.orig.png" ]]; then
        echo "Original backup already exists for $file, skipping..."
        continue
    fi
    
    # Create backup of original file
    cp "$file" "${file%.png}.orig.png"
    
    # Optimize the file in place
    imageoptim --quality=100 --speed=1 "$file"
    
    echo "Optimized $file"
done