#!/usr/bin/env bash
#
# Download the published "minimum set" of font-assets and rebuild the rest.
#
# The full font-assets/ tree (~800 MB) is too large to commit. Instead we
# distribute a "minimum set" (metrics-bundle.js + atlas-*.webp, ~72 MB) via
# GitHub Releases, and re-derive the QOI atlases + JS wrappers locally.
#
# Usage:
#   ./scripts/download-font-assets.sh                       # latest release
#   ./scripts/download-font-assets.sh --tag font-assets-2026-05-05
#   ./scripts/download-font-assets.sh --no-rebuild          # skip rebuild step
#   ./scripts/download-font-assets.sh --force               # overwrite existing
#   ./scripts/download-font-assets.sh --help
#
# Companion: ./scripts/publish-font-assets.sh (maintainer-side release tool)
# See scripts/README.md sec 9 for the full distribution workflow.

set -euo pipefail

REPO_OWNER='davidedc'
REPO_NAME='BitmapText.js'
ASSET_NAME='font-assets-min.zip'

TAG=''
DO_REBUILD=1
FORCE=0
SHOW_HELP=0

while [ $# -gt 0 ]; do
    case "$1" in
        --tag)         TAG="${2:-}"; shift 2 ;;
        --tag=*)       TAG="${1#--tag=}"; shift ;;
        --no-rebuild)  DO_REBUILD=0; shift ;;
        --force)       FORCE=1; shift ;;
        --help|-h)     SHOW_HELP=1; shift ;;
        *)             echo "ERROR: unknown argument: $1" >&2; SHOW_HELP=1; shift ;;
    esac
done

if [ "$SHOW_HELP" -eq 1 ]; then
    sed -n '3,17p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# Refuse to clobber a populated font-assets/ unless --force.
# `find` on a missing font-assets/ exits non-zero, which under `set -e` + `pipefail`
# would kill the script silently. Guard with -d so a totally-absent font-assets/ (the
# state on some fresh clones, or after a manual `mv aside`) is treated as "empty,
# proceed". The unzip step later re-creates the directory.
if [ "$FORCE" -ne 1 ] && [ -d font-assets ]; then
    EXISTING_WEBP=$(find font-assets -maxdepth 1 -name 'atlas-*.webp' -type f 2>/dev/null | wc -l | tr -d ' ')
    if [ "$EXISTING_WEBP" -gt 0 ]; then
        echo "ERROR: font-assets/ already contains $EXISTING_WEBP atlas-*.webp file(s)." >&2
        echo "Pass --force to re-download and overwrite." >&2
        exit 1
    fi
fi

# Build the release URLs. GitHub redirects /releases/latest/download/<asset> to
# the asset of whichever release is marked "latest" (default for new releases),
# so consumers don't need to know the tag.
if [ -n "$TAG" ]; then
    ZIP_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${TAG}/${ASSET_NAME}"
    SHA_URL="${ZIP_URL}.sha256"
    echo "Downloading release: $TAG"
else
    ZIP_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest/download/${ASSET_NAME}"
    SHA_URL="${ZIP_URL}.sha256"
    echo "Downloading release: latest"
fi

STAGING="$(mktemp -d -t font-assets-dl.XXXXXX)"
trap 'rm -rf "$STAGING"' EXIT

ZIP_TMP="$STAGING/$ASSET_NAME"
SHA_TMP="$STAGING/$ASSET_NAME.sha256"

echo "URL: $ZIP_URL"
curl --fail --location --retry 3 --progress-bar -o "$ZIP_TMP" "$ZIP_URL"

# Sidecar is best-effort: older releases may not have one. Warn and proceed.
SHA_OK=0
if curl --fail --location --silent --retry 3 -o "$SHA_TMP" "$SHA_URL" 2>/dev/null; then
    # The sidecar references the asset by basename; shasum -c needs the file
    # alongside it, which is true since both live in $STAGING.
    if (cd "$STAGING" && shasum -a 256 -c "$ASSET_NAME.sha256"); then
        SHA_OK=1
    else
        echo "ERROR: SHA-256 verification failed; aborting." >&2
        echo "Files left in $STAGING for inspection." >&2
        trap - EXIT
        exit 1
    fi
else
    echo "WARNING: no SHA-256 sidecar at $SHA_URL — skipping integrity check."
    echo "         (Releases produced by ./scripts/publish-font-assets.sh include one.)"
fi

echo ""
echo "Unpacking into font-assets/..."
unzip -oq "$ZIP_TMP" -d "$REPO_ROOT"

# Sanity report.
WEBP_COUNT=$(find font-assets -maxdepth 1 -name 'atlas-*.webp' -type f | wc -l | tr -d ' ')
test -f font-assets/metrics-bundle.js
echo "  metrics-bundle.js : present"
echo "  atlas-*.webp      : $WEBP_COUNT"
if [ "$SHA_OK" -eq 1 ]; then
    echo "  SHA-256           : verified"
fi

if [ "$DO_REBUILD" -eq 1 ]; then
    echo ""
    echo "Re-deriving full font-assets/ via ./scripts/rebuild-from-minimal.sh..."
    ./scripts/rebuild-from-minimal.sh
else
    echo ""
    echo "Skipping rebuild (--no-rebuild). To finish:"
    echo "  ./scripts/rebuild-from-minimal.sh"
fi
