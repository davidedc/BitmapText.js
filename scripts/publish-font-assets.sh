#!/usr/bin/env bash
#
# Publish a font-assets release to GitHub.
#
# Two assets on the same tag, atomically:
#   - font-assets-min.zip       (~150 MB) — the full distribution set
#   - font-assets-smoke-set.zip  (~10 KB) — 3-font fixture for embedders'
#                                            Node-side tests (e.g. SWCanvas)
# The smoke set is built by subsetting the same bundles + copying the
# atlas .js files verbatim from font-assets/, so it is provably a literal
# subset of the main asset on the same release.
#
# Hand-holds the maintainer through:
#   1. Pre-flight checks (asset presence, gh installed + authed)
#   2. Building font-assets-min.zip + .sha256 sidecar
#   3. Building font-assets-smoke-set.zip + verifying it loads & renders
#   4. Generating release notes from a template
#   5. Tagging HEAD as font-assets-YYYY-MM-DD (or --tag override)
#   6. Pushing the tag and uploading both assets via `gh release create`
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
SMOKE_ASSET_NAME='font-assets-smoke-set.zip'
SMOKE_SPEC='font-sets/smoke-set.json'

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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"
cd "$PROJECT_ROOT"

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

# Smoke set: spec must exist (driven by the spec, so a missing spec = fatal).
# Per-font presence in font-assets/ is checked by build-smoke-set.js later.
if [ ! -f "$PROJECT_ROOT/$SMOKE_SPEC" ]; then
    echo "ERROR: smoke-set spec missing: $SMOKE_SPEC" >&2
    echo "       The smoke set is part of every release. Restore the spec or commit it before publishing." >&2
    exit 1
fi
echo "  $SMOKE_SPEC : present"

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
#   - README.md, .gitkeep               repo-tracked meta files (kept in the zip so a
#                                       fresh `download-font-assets.sh` into a clean
#                                       clone leaves `git status` clean instead of
#                                       showing them as deleted)
#
# The positioning bundles are required at runtime — without them
# `_loadAtlasFromPackage` throws "no positioning record". The rebuild step
# never regenerates them; they ship as-is.
( cd "$PROJECT_ROOT" && \
  find font-assets -maxdepth 1 \
       \( -name 'metrics-bundle.js' \
          -o -name 'positioning-bundle-density-*.js' \
          -o -name 'atlas-*.webp' \
          -o -name 'README.md' \
          -o -name '.gitkeep' \) \
       -type f -print \
  | zip -@ -q "$STAGING/$ASSET_NAME" )

ZIP_BYTES=$(wc -c < "$STAGING/$ASSET_NAME" | tr -d ' ')
ZIP_HUMAN=$(du -h "$STAGING/$ASSET_NAME" | awk '{print $1}')

# Sidecar references the asset by basename; generated from inside $STAGING.
( cd "$STAGING" && shasum -a 256 "$ASSET_NAME" > "$ASSET_NAME.sha256" )
SHA256=$(awk '{print $1}' "$STAGING/$ASSET_NAME.sha256")

echo "  Zip               : $STAGING/$ASSET_NAME ($ZIP_HUMAN, $ZIP_BYTES bytes)"
echo "  SHA-256           : $SHA256"

# --- Smoke-set artifact ------------------------------------------------------
#
# Second asset on the same tag: a tiny, committable-to-repo, Node-loadable
# fixture (~30 KB) containing 3 fonts as listed in font-sets/smoke-set.json.
# Intended for embedders (e.g. SWCanvas) that need a real font in their
# Node-side test suite without committing the full 157 MB font-assets/.
#
# The atlas .js files in the smoke set are byte-identical to the ones in the
# main zip — `build-smoke-set.js` copies them verbatim and subsets the bundles
# to match. So the smoke set is provably a strict subset of the main release.

echo ""
echo "=== Building smoke-set artifact ==="

SMOKE_STAGING_DIR="$STAGING/smoke-set-stage"
node "$SCRIPT_DIR/build-smoke-set.js" \
    --spec="$PROJECT_ROOT/$SMOKE_SPEC" \
    --source-dir="$PROJECT_ROOT/font-assets" \
    --output-dir="$SMOKE_STAGING_DIR"

echo ""
echo "  Verifying smoke set (load + render gate)..."
node "$SCRIPT_DIR/verify-smoke-set.js" --dir="$SMOKE_STAGING_DIR"

( cd "$SMOKE_STAGING_DIR" && zip -q -9 "$STAGING/$SMOKE_ASSET_NAME" * )

SMOKE_BYTES=$(wc -c < "$STAGING/$SMOKE_ASSET_NAME" | tr -d ' ')
SMOKE_HUMAN=$(du -h "$STAGING/$SMOKE_ASSET_NAME" | awk '{print $1}')
( cd "$STAGING" && shasum -a 256 "$SMOKE_ASSET_NAME" > "$SMOKE_ASSET_NAME.sha256" )
SMOKE_SHA256=$(awk '{print $1}' "$STAGING/$SMOKE_ASSET_NAME.sha256")

echo ""
echo "  Smoke zip         : $STAGING/$SMOKE_ASSET_NAME ($SMOKE_HUMAN, $SMOKE_BYTES bytes)"
echo "  Smoke SHA-256     : $SMOKE_SHA256"

# --- Release notes -----------------------------------------------------------

NOTES_FILE="$STAGING/release-notes.md"
TITLE="font-assets ($TAG)"

cat > "$NOTES_FILE" <<EOF
# font-assets

Pre-rendered bitmap-font assets for [BitmapText.js](https://github.com/${REPO_OWNER}/${REPO_NAME}). Two assets on this release:

| Asset | Size | For |
|---|---|---|
| \`${ASSET_NAME}\` | ${ZIP_HUMAN} | Standard distribution — \`metrics-bundle.js\` + every \`positioning-bundle-density-*.js\` + every \`atlas-*.webp\`; the full \`font-assets/\` directory is re-derived from this with one command |
| \`${SMOKE_ASSET_NAME}\` | ${SMOKE_HUMAN} | Smoke fixture — 3 fonts at density-1 size 16, QOI \`.js\` wrappers only, committable to embedder repos (e.g. SWCanvas) for Node-side tests |

## ${ASSET_NAME}

- \`font-assets/metrics-bundle.js\` — single deflate-raw + base64 bundle of every font's metrics (density-agnostic)
- \`font-assets/positioning-bundle-density-*.js\` — ${POSITIONING_COUNT} per-density bundle(s) of pre-computed atlas positioning (densities: ${DENSITIES}); required at runtime by \`_loadAtlasFromPackage\` — atlas loads fail without them
- \`font-assets/atlas-*.webp\` — ${WEBP_COUNT} lossless WebP atlas images
- $((WEBP_COUNT + 1 + POSITIONING_COUNT)) files total, ${ZIP_HUMAN} compressed

How to use:

\`\`\`bash
./scripts/download-font-assets.sh
\`\`\`

That one command fetches this asset, verifies the SHA-256 sidecar, unzips into \`font-assets/\`, and runs \`./scripts/rebuild-from-minimal.sh\` to re-derive the QOI atlases and JS wrappers locally.

Manual fallback:

\`\`\`bash
curl -L -o ${ASSET_NAME} \\
  https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest/download/${ASSET_NAME}
unzip ${ASSET_NAME}
./scripts/rebuild-from-minimal.sh
\`\`\`

Requirements: \`dwebp\` (\`brew install webp\`), \`terser\` (\`npm i -g terser\`), Node ≥ 12.

See [\`scripts/README.md\`](https://github.com/${REPO_OWNER}/${REPO_NAME}/blob/main/scripts/README.md) sec 9 for the full distribution workflow.

## ${SMOKE_ASSET_NAME}

A tiny self-contained fixture for embedders running BitmapText in Node-side test suites who don't want to commit the full 157 MB \`font-assets/\` directory. Contents:

- \`metrics-bundle.js\` + \`positioning-bundle-density-1.js\` — subsetted to the 3 fonts below
- \`atlas-*-qoi.js\` — 3 QOI atlas wrappers (Node-loadable, no \`<script>\` injection needed)
- \`smoke-set.json\` — the spec describing exactly what's in the zip (mirrors \`${SMOKE_SPEC}\` upstream)

Fonts in the smoke set: \`Arial\` normal+normal size 16, \`Arial\` normal+bold size 16, \`BitmapTextInvariant\` normal+normal size 16. Atlas \`.js\` files are byte-identical to the ones in \`${ASSET_NAME}\` — the smoke set is a strict subset, safe to drop into a populated \`font-assets/\` without conflicts.

Verified before publish: every font in the smoke set loads via \`BitmapText.loadFont\` and renders non-zero opaque pixels.

Manual fetch:

\`\`\`bash
curl -L -o ${SMOKE_ASSET_NAME} \\
  https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest/download/${SMOKE_ASSET_NAME}
unzip ${SMOKE_ASSET_NAME} -d ./font-assets/_smoke/
\`\`\`

Then in test setup: \`BitmapText.setFontDirectory('./font-assets/_smoke/')\` and \`await BitmapText.loadFont(...)\` for the 3 idStrings listed in \`smoke-set.json\`.

## Integrity

\`\`\`
${ASSET_NAME}        SHA-256: ${SHA256}
${SMOKE_ASSET_NAME}  SHA-256: ${SMOKE_SHA256}
\`\`\`

Verify after download:

\`\`\`bash
shasum -a 256 -c ${ASSET_NAME}.sha256
shasum -a 256 -c ${SMOKE_ASSET_NAME}.sha256
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
    echo "  $STAGING/$SMOKE_ASSET_NAME"
    echo "  $STAGING/$SMOKE_ASSET_NAME.sha256"
    echo "Notes: $NOTES_FILE"
    echo ""
    echo "Re-run without --dry-run to publish."
    exit 0
fi

# --- Confirmation -------------------------------------------------------------

cat <<EOF

=== Ready to publish ===
  Tag         : $TAG
  Title       : $TITLE
  Repo        : ${REPO_OWNER}/${REPO_NAME}
  Main asset  : ${ASSET_NAME} (${ZIP_HUMAN})  +  ${ASSET_NAME}.sha256
  Smoke asset : ${SMOKE_ASSET_NAME} (${SMOKE_HUMAN})  +  ${SMOKE_ASSET_NAME}.sha256
  SHA-256s    : ${SHA256}
                ${SMOKE_SHA256}

After publish the assets will be reachable at:
  https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${TAG}/${ASSET_NAME}
  https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${TAG}/${SMOKE_ASSET_NAME}
  https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest/download/${ASSET_NAME}        (if marked latest)
  https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest/download/${SMOKE_ASSET_NAME}  (if marked latest)
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
    "$STAGING/$SMOKE_ASSET_NAME" \
    "$STAGING/$SMOKE_ASSET_NAME.sha256" \
    --title "$TITLE" \
    --notes-file "$NOTES_FILE"

echo ""
echo "=== Published ==="
echo "Main asset   : https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${TAG}/${ASSET_NAME}"
echo "Smoke asset  : https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${TAG}/${SMOKE_ASSET_NAME}"
echo "Latest alias : https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest/download/${ASSET_NAME}"
echo "Latest smoke : https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest/download/${SMOKE_ASSET_NAME}"
echo "Verify main  : shasum -a 256 -c ${ASSET_NAME}.sha256"
echo "Verify smoke : shasum -a 256 -c ${SMOKE_ASSET_NAME}.sha256"
echo ""
echo "Staging dir kept at $STAGING (safe to delete)."
