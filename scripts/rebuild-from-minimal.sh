#!/usr/bin/env bash
#
# Rebuild full font-assets/ from the minimum distribution set.
#
# Input expected in font-assets/:
#   - metrics-bundle.js
#   - atlas-*.webp  (the published "minimum set" — ~72 MB total)
#
# Output produced in font-assets/:
#   - atlas-*.qoi             (re-derived via dwebp -pam → lib/QOIEncode.js)
#   - atlas-*-webp.js         (base64-wrapped webp, terser-minified)
#   - atlas-*-qoi.js          (base64-wrapped qoi,  terser-minified)
#
# After this script runs, font-assets/ contains the same artifacts as the
# canonical forward pipeline produces (scripts/watch-font-assets.sh).
#
# Requires: dwebp (brew install webp), node, terser (npm i -g terser).

set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f font-assets/metrics-bundle.js ]; then
    echo "ERROR: font-assets/metrics-bundle.js missing" >&2
    exit 1
fi

WEBP_COUNT=$(find font-assets -maxdepth 1 -name 'atlas-*.webp' -type f | wc -l | tr -d ' ')
if [ "$WEBP_COUNT" -eq 0 ]; then
    echo "ERROR: no atlas-*.webp files in font-assets/" >&2
    exit 1
fi
echo "Found $WEBP_COUNT atlas-*.webp files"

# Defensive cleanup: stale PNG intermediates from interrupted forward-pipeline
# runs would not affect this script's output but should never ship.
find font-assets -maxdepth 1 -name 'atlas-*.png' -delete

echo ""
echo "[1/3] Re-deriving atlas-*.qoi from atlas-*.webp..."
node scripts/webp-to-qoi-converter.js font-assets

echo ""
echo "[2/3] Generating atlas-*-{webp,qoi}.js wrappers..."
node scripts/image-to-js-converter.js font-assets --all

echo ""
echo "[3/3] Minifying atlas-*-{webp,qoi}.js with terser..."
# NUL-delimited loop: family names contain spaces (e.g. "Courier New").
# Pattern lifted from scripts/convert-png-to-webp.sh:89/149.
MINIFIED=0
while IFS= read -r -d '' f; do
    terser "$f" -c -m -o "${f}.tmp" && mv "${f}.tmp" "$f"
    MINIFIED=$((MINIFIED + 1))
    if [ $((MINIFIED % 500)) -eq 0 ]; then
        echo "  $MINIFIED minified"
    fi
done < <(find font-assets -maxdepth 1 \
    \( -name 'atlas-*-webp.js' -o -name 'atlas-*-qoi.js' \) \
    -type f -print0)
echo "  $MINIFIED minified (total)"

echo ""
echo "=== Final counts ==="
WEBP=$(find font-assets -maxdepth 1 -name 'atlas-*.webp'    -type f | wc -l | tr -d ' ')
QOI=$( find font-assets -maxdepth 1 -name 'atlas-*.qoi'     -type f | wc -l | tr -d ' ')
WJS=$( find font-assets -maxdepth 1 -name 'atlas-*-webp.js' -type f | wc -l | tr -d ' ')
QJS=$( find font-assets -maxdepth 1 -name 'atlas-*-qoi.js'  -type f | wc -l | tr -d ' ')
echo "  atlas-*.webp     : $WEBP"
echo "  atlas-*.qoi      : $QOI"
echo "  atlas-*-webp.js  : $WJS"
echo "  atlas-*-qoi.js   : $QJS"

if [ "$WEBP" = "$QOI" ] && [ "$WEBP" = "$WJS" ] && [ "$WEBP" = "$QJS" ]; then
    echo ""
    echo "OK: all four artifact kinds match ($WEBP each)"
else
    echo ""
    echo "WARNING: artifact counts do not match — investigate" >&2
    exit 1
fi
