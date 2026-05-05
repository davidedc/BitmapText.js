# font-assets/

This directory holds the pre-rendered bitmap-font assets that the runtime loads. Its contents are **not committed to git** — the full set is ~800 MB and the published "minimum set" is ~72 MB. Both are distributed via [GitHub Releases](https://github.com/davidedc/BitmapText.js/releases).

Only this README and a `.gitkeep` are tracked here, so the directory exists after a fresh clone.

## Quick start (consumer)

From the repo root:

```bash
./scripts/download-font-assets.sh
```

That script downloads the latest release (`font-assets-min.zip` from GitHub's stable `releases/latest/download/...` URL), verifies its SHA-256 against the published sidecar, unzips into this directory, and chains into `./scripts/rebuild-from-minimal.sh` to re-derive the QOI atlases and JS wrappers locally. Total time ≈10 min.

Pinning to a specific release: `./scripts/download-font-assets.sh --tag font-assets-2026-05-05`.

## Manual fallback

If you'd rather not run a script, do it by hand:

```bash
curl -L -o font-assets-min.zip \
  https://github.com/davidedc/BitmapText.js/releases/latest/download/font-assets-min.zip
unzip font-assets-min.zip            # populates font-assets/
./scripts/rebuild-from-minimal.sh    # ~10 min
```

## Cutting a new release (maintainer)

After regenerating fonts, from the repo root:

```bash
./scripts/publish-font-assets.sh
```

The script builds the zip + SHA-256 sidecar, generates release notes, and (with `gh` installed and authenticated) creates the release. Tag pattern: `font-assets-YYYY-MM-DD`. See [`scripts/README.md`](../scripts/README.md) § 9 for the full workflow.
