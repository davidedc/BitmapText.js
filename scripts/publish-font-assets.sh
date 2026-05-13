#!/usr/bin/env bash
#
# Publish a font-assets minimum-set release to GitHub.
#
# Hand-holds the maintainer through:
#   1. Pre-flight checks (asset presence, gh installed + authed)
#   2. Building font-assets-min.zip + .sha256 sidecar
#   3. Generating release notes from a template
#   4. Tagging HEAD as font-assets-YYYY-MM-DD (or --tag override)
#   5. Pushing the tag and uploading via `gh release create`
#
# Use --dry-run to do everything except the tag push and gh release call.
#
# Usage:
#   ./scripts/publish-font-assets.sh                       # tag = font-assets-$(date +%F)
#   ./scripts/publish-font-assets.sh --tag font-assets-2026-05-06
#   ./scripts/publish-font-assets.sh --dry-run
#   ./scripts/publish-font-assets.sh --help
#
# Companion: ./scripts/download-font-assets.sh (consumer-side fetcher)
# See scripts/README.md sec 9 for the full distribution workflow.

set -euo pipefail

REPO_OWNER='davidedc'
REPO_NAME='BitmapText.js'
ASSET_NAME='font-assets-min.zip'

TAG=''
DRY_RUN=0
SHOW_HELP=0

while [ $# -gt 0 ]; do
    case "$1" in
        --tag)      TAG="${2:-}"; shift 2 ;;
        --tag=*)    TAG="${1#--tag=}"; shift ;;
        --dry-run)  DRY_RUN=1; shift ;;
        --help|-h)  SHOW_HELP=1; shift ;;
        *)          echo "ERROR: unknown argument: $1" >&2; SHOW_HELP=1; shift ;;
    esac
done

if [ "$SHOW_HELP" -eq 1 ]; then
    sed -n '3,21p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# --- Pre-flight ---------------------------------------------------------------

echo "=== Pre-flight ==="

if [ ! -f font-assets/metrics-bundle.js ]; then
    echo "ERROR: font-assets/metrics-bundle.js missing. Build the assets first." >&2
    exit 1
fi

# Per-density positioning bundles. The runtime requires these for atlas loading
# (see src/runtime/FontLoaderBase.js:_loadAtlasFromPackage). Without them, every
# atlas load throws "no positioning record". They are part of the minimum set.
POSITIONING_BUNDLES=$(find font-assets -maxdepth 1 -name 'positioning-bundle-density-*.js' -type f | sort)
POSITIONING_COUNT=$(printf '%s\n' "$POSITIONING_BUNDLES" | grep -c . || true)
if [ "$POSITIONING_COUNT" -eq 0 ]; then
    echo "ERROR: no positioning-bundle-density-*.js files in font-assets/." >&2
    echo "       Rebuild the assets via the font-assets-builder before publishing." >&2
    exit 1
fi

WEBP_COUNT=$(find font-assets -maxdepth 1 -name 'atlas-*.webp' -type f | wc -l | tr -d ' ')
if [ "$WEBP_COUNT" -eq 0 ]; then
    echo "ERROR: no atlas-*.webp files in font-assets/." >&2
    exit 1
fi
DENSITIES=$(printf '%s\n' "$POSITIONING_BUNDLES" \
    | sed -E 's|.*positioning-bundle-density-([^.]+)\.js|\1|' \
    | paste -sd ',' - \
    | sed 's/,/, /g')
echo "  metrics-bundle.js              : present"
echo "  positioning-bundle-density-*   : $POSITIONING_COUNT ($DENSITIES)"
echo "  atlas-*.webp                   : $WEBP_COUNT"

# Warn (don't fail) on uncommitted code changes.
if ! git diff --quiet -- scripts/ src/ 2>/dev/null; then
    echo "  WARNING: uncommitted changes in scripts/ or src/ — release will tag HEAD as-is."
fi

if [ "$DRY_RUN" -ne 1 ]; then
    if ! command -v gh >/dev/null 2>&1; then
        cat >&2 <<'EOF'
ERROR: gh CLI not found.

Install it once:
  brew install gh
  gh auth login

Or run with --dry-run to stage the release artifacts without uploading.
EOF
        exit 1
    fi
    if ! gh auth status >/dev/null 2>&1; then
        echo "ERROR: gh CLI is not authenticated. Run: gh auth login" >&2
        exit 1
    fi
fi

# --- Stale-PNG defensive cleanup ---------------------------------------------

PNG_COUNT=$(find font-assets -maxdepth 1 -name 'atlas-*.png' -type f | wc -l | tr -d ' ')
if [ "$PNG_COUNT" -gt 0 ]; then
    echo "  Removing $PNG_COUNT stale atlas-*.png files (must not ship)..."
    find font-assets -maxdepth 1 -name 'atlas-*.png' -delete
fi

# --- Tag selection -----------------------------------------------------------

if [ -z "$TAG" ]; then
    TAG="font-assets-$(date +%Y-%m-%d)"
fi
echo "  Planned tag       : $TAG"

if [ "$DRY_RUN" -ne 1 ]; then
    if gh release view "$TAG" >/dev/null 2>&1; then
        printf "Release '%s' already exists. Overwrite? [y/N] " "$TAG"
        read -r REPLY
        case "$REPLY" in
            [yY]|[yY][eE][sS]) echo "  Will overwrite existing release." ;;
            *) echo "  Aborted. Re-run with --tag <name> to pick a different one."; exit 1 ;;
        esac
    fi
fi

# --- Build artifacts ----------------------------------------------------------

STAGING="/tmp/font-assets-release-${TAG}"
rm -rf "$STAGING"
mkdir -p "$STAGING"

echo ""
echo "=== Building artifacts ==="
echo "  Staging: $STAGING"

# Use find -print | zip -@ (newline-delimited): atlas filenames contain spaces
# but never newlines, so this is safe and avoids shell glob limits.
#
# Minimum-set contents:
#   - metrics-bundle.js                 density-agnostic font metrics (single file)
#   - positioning-bundle-density-*.js   per-density positioning records (one per density)
#   - atlas-*.webp                      lossless WebP atlas images
#
# The positioning bundles are required at runtime — without them
# `_loadAtlasFromPackage` throws "no positioning record". The rebuild step
# never regenerates them; they ship as-is.
( cd "$REPO_ROOT" && \
  find font-assets -maxdepth 1 \
       \( -name 'metrics-bundle.js' \
          -o -name 'positioning-bundle-density-*.js' \
          -o -name 'atlas-*.webp' \) \
       -type f -print \
  | zip -@ -q "$STAGING/$ASSET_NAME" )

ZIP_BYTES=$(wc -c < "$STAGING/$ASSET_NAME" | tr -d ' ')
ZIP_HUMAN=$(du -h "$STAGING/$ASSET_NAME" | awk '{print $1}')

# Sidecar references the asset by basename; generated from inside $STAGING.
( cd "$STAGING" && shasum -a 256 "$ASSET_NAME" > "$ASSET_NAME.sha256" )
SHA256=$(awk '{print $1}' "$STAGING/$ASSET_NAME.sha256")

echo "  Zip               : $STAGING/$ASSET_NAME ($ZIP_HUMAN, $ZIP_BYTES bytes)"
echo "  SHA-256           : $SHA256"

# --- Release notes -----------------------------------------------------------

NOTES_FILE="$STAGING/release-notes.md"
TITLE="font-assets minimum set ($TAG)"

cat > "$NOTES_FILE" <<EOF
# font-assets minimum set

Pre-rendered bitmap-font assets for [BitmapText.js](https://github.com/${REPO_OWNER}/${REPO_NAME}). This is the **minimum distribution set** — \`metrics-bundle.js\` + every \`positioning-bundle-density-*.js\` + every \`atlas-*.webp\` — from which the full \`font-assets/\` directory can be re-derived locally with one command.

## What's inside

- \`font-assets/metrics-bundle.js\` — single deflate-raw + base64 bundle of every font's metrics (density-agnostic)
- \`font-assets/positioning-bundle-density-*.js\` — ${POSITIONING_COUNT} per-density bundle(s) of pre-computed atlas positioning (densities: ${DENSITIES}); required at runtime by \`_loadAtlasFromPackage\` — atlas loads fail without them
- \`font-assets/atlas-*.webp\` — ${WEBP_COUNT} lossless WebP atlas images
- $((WEBP_COUNT + 1 + POSITIONING_COUNT)) files total, ${ZIP_HUMAN} compressed

## How to use

\`\`\`bash
./scripts/download-font-assets.sh
\`\`\`

That one command fetches this release, verifies the SHA-256 sidecar, unzips into \`font-assets/\`, and runs \`./scripts/rebuild-from-minimal.sh\` to re-derive the QOI atlases and JS wrappers locally.

Manual fallback:

\`\`\`bash
curl -L -o font-assets-min.zip \\
  https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest/download/font-assets-min.zip
unzip font-assets-min.zip
./scripts/rebuild-from-minimal.sh
\`\`\`

See [\`scripts/README.md\`](https://github.com/${REPO_OWNER}/${REPO_NAME}/blob/main/scripts/README.md) sec 9 for the full distribution workflow.

## Requirements

- \`dwebp\` — \`brew install webp\` (macOS) or distro equivalent
- \`terser\` — \`npm i -g terser\`
- Node ≥ 12

## Integrity

\`\`\`
SHA-256: ${SHA256}
\`\`\`

Verify after download:

\`\`\`bash
shasum -a 256 -c font-assets-min.zip.sha256
\`\`\`
EOF

echo "  Release notes     : $NOTES_FILE"

# --- Dry-run exit ------------------------------------------------------------

if [ "$DRY_RUN" -eq 1 ]; then
    echo ""
    echo "=== Dry-run complete ==="
    echo "Would publish to tag: $TAG"
    echo "Would upload:"
    echo "  $STAGING/$ASSET_NAME"
    echo "  $STAGING/$ASSET_NAME.sha256"
    echo "Notes: $NOTES_FILE"
    echo ""
    echo "Re-run without --dry-run to publish."
    exit 0
fi

# --- Confirmation -------------------------------------------------------------

cat <<EOF

=== Ready to publish ===
  Tag    : $TAG
  Title  : $TITLE
  Repo   : ${REPO_OWNER}/${REPO_NAME}
  Assets : font-assets-min.zip ($ZIP_HUMAN), font-assets-min.zip.sha256
  SHA-256: $SHA256

After publish the assets will be reachable at:
  https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${TAG}/${ASSET_NAME}
  https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest/download/${ASSET_NAME}  (if marked latest)
EOF

printf "Proceed? [y/N] "
read -r REPLY
case "$REPLY" in
    [yY]|[yY][eE][sS]) ;;
    *) echo "Aborted. Staging dir left at $STAGING for manual recovery."; exit 1 ;;
esac

# --- Tag + upload ------------------------------------------------------------

if git rev-parse --verify "refs/tags/$TAG" >/dev/null 2>&1; then
    echo "  Local tag $TAG already exists."
else
    echo "  Tagging HEAD as $TAG..."
    git tag "$TAG"
fi

echo "  Pushing tag to origin..."
git push origin "$TAG"

echo "  Creating GitHub release..."
gh release create "$TAG" \
    "$STAGING/$ASSET_NAME" \
    "$STAGING/$ASSET_NAME.sha256" \
    --title "$TITLE" \
    --notes-file "$NOTES_FILE"

echo ""
echo "=== Published ==="
echo "Specific tag : https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${TAG}/${ASSET_NAME}"
echo "Latest alias : https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest/download/${ASSET_NAME}"
echo "Verify       : shasum -a 256 -c ${ASSET_NAME}.sha256"
echo ""
echo "Staging dir kept at $STAGING (safe to delete)."
