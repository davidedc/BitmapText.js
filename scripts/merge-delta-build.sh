#!/bin/bash

# merge-delta-build.sh — apply a partial (delta) rebuild to font-assets/ without
# nuking the rest of the corpus.
#
# Usage:
#   ./scripts/merge-delta-build.sh <delta-zip>
#
# The script auto-detects which families are in the delta by reading the delta
# bundle, drops those families from the existing bundles, then appends the
# delta's records.
#
# Example:
#   node scripts/automated-font-builder.js \
#     --spec=specs/font-sets/bitmap-text-invariant.json \
#     --output=/tmp
#   ./scripts/merge-delta-build.sh /tmp/fontAssets.zip
#
# Steps:
#   1. Extract the delta zip to a staging dir (NOT ~/Downloads/, so the watcher
#      doesn't grab it).
#   2. Run the qoi → png → optimize → webp → js-wrap pipeline on staging.
#   3. Copy staging atlas files into font-assets/ additively (overwrite OK —
#      no clearing).
#   4. Merge bundles in place: drop affected families from font-assets/ bundles,
#      append the delta bundle's records, write back.
#
# Why a separate script: the watcher's normal pipeline (watch-font-assets.sh)
# clears font-assets/ before extracting. That's correct for full-corpus
# rebuilds but would erase every family except the one in the delta zip. This
# script gives you a partial-rebuild path without touching the watcher.

set -e

DELTA_ZIP="$1"

if [ -z "$DELTA_ZIP" ]; then
  echo "Usage: $0 <delta-zip>"
  exit 1
fi

if [ ! -f "$DELTA_ZIP" ]; then
  echo "ERROR: delta zip not found: $DELTA_ZIP" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

if [ ! -d font-assets ]; then
  echo "ERROR: font-assets/ does not exist; nothing to merge into" >&2
  exit 1
fi

STAGING=$(mktemp -d -t merge-delta.XXXXXX)
trap 'rm -rf "$STAGING"' EXIT

echo "[1/5] Extracting delta zip to $STAGING..."
unzip -q "$DELTA_ZIP" -d "$STAGING"
# Builder zips include a top-level fontAssets/ folder
if [ -d "$STAGING/fontAssets" ]; then
  STAGING_DATA="$STAGING/fontAssets"
else
  STAGING_DATA="$STAGING"
fi
echo "  $(ls "$STAGING_DATA" | wc -l | tr -d ' ') files in staging"

echo "[2/5] Running qoi → png → optimize → webp → js pipeline on staging..."
node scripts/qoi-to-png-converter.js "$STAGING_DATA"
bash scripts/optimize-images.sh "$STAGING_DATA"
bash scripts/convert-png-to-webp.sh "$STAGING_DATA"
node scripts/image-to-js-converter.js "$STAGING_DATA"

echo "[3/5] Copying staging atlas files into font-assets/ (additive)..."
# rsync is more robust than cp for many files. Just atlas-* — bundles are
# handled by the merge step below.
for pattern in 'atlas-*.qoi' 'atlas-*.webp' 'atlas-*-qoi.js' 'atlas-*-webp.js'; do
  if compgen -G "$STAGING_DATA"/$pattern >/dev/null; then
    rsync -a "$STAGING_DATA"/$pattern font-assets/
  fi
done
echo "  font-assets/ now has $(ls font-assets/atlas-*.qoi 2>/dev/null | wc -l | tr -d ' ') .qoi files"

echo "[4/5] Merging bundles (auto-detect affected families, drop them, add delta records)..."
node scripts/merge-delta-bundles.js "$STAGING_DATA"

echo "[5/5] Verifying via Node bundle..."
node -e "
require('./dist/bitmaptext-node.min.js');
(async () => {
  await BitmapText.ensureMetricsBundleLoaded();
  await BitmapText.ensurePositioningBundleLoaded(1);
  await BitmapText.ensurePositioningBundleLoaded(2);
  console.log('  metrics:', MetricsBundleStore.size(), 'positioning:', PositioningBundleStore.size());
})();
"

echo "Done."
