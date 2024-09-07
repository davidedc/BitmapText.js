#!/bin/bash

# Check if ImageOptim is installed
if ! command -v imageoptim &> /dev/null; then
    echo "ImageOptim is not installed. Please install it first."
    exit 1
fi

# Loop through all PNG files in the directory
for file in *.png; do
    # Skip files that have already been renamed with .orig extension
    if [[ $file == *.orig.png ]]; then
        continue
    fi

    # Rename original file to .orig.png
    mv "$file" "${file%.png}.orig.png"

    # Optimize the newly renamed .orig.png file
    imageoptim --quality=100 --speed=1 "${file%.png}.orig.png"

    # Copy optimized file back to original name
    cp "${file%.png}.orig.png" "$file"

    echo "Optimized $file"
done
