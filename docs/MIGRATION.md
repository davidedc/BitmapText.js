# BitmapText.js Folder Reorganization Migration Guide

This document outlines the major folder structure reorganization implemented to improve code organization and maintainability.

## Overview

The project has been reorganized from a flat structure to a logical, hierarchical folder structure that separates concerns and improves navigation.

## New Project Structure

```
/
├── src/               # Source code
│   ├── core/          # Runtime library classes
│   ├── editor/        # Font generation classes
│   ├── utils/         # Utility functions
│   ├── ui/            # UI components
│   ├── specs/         # Font specifications
│   └── compression/   # Data compression utilities
├── public/            # HTML entry points
├── data/              # Generated font data
├── test/              # Test utilities and data
├── tools/             # Development tools
├── lib/               # Third-party libraries
├── docs/              # Documentation
└── scripts/           # Build scripts
```

## File Migration Map

### Core Runtime Files
| Old Path | New Path |
|----------|----------|
| `BitmapText.js` | `src/core/BitmapText.js` |
| `BitmapGlyphStore.js` | `src/core/BitmapGlyphStore.js` |
| `GlyphIDString.js` | `src/core/GlyphIDString.js` |

### Editor Classes (Also Renamed)
| Old Path | New Path |
|----------|----------|
| `BitmapText_Editor.js` | `src/editor/BitmapTextEditor.js` |
| `BitmapGlyphStore_Editor.js` | `src/editor/BitmapGlyphStoreEditor.js` |
| `BitmapGlyph_Editor.js` | `src/editor/BitmapGlyphEditor.js` |
| `GlyphIDString_Editor.js` | `src/editor/GlyphIDStringEditor.js` |

### Utility Functions
| Old Path | New Path |
|----------|----------|
| `canvas-extensions.js` | `src/utils/canvas-extensions.js` |
| `nested-properties.js` | `src/utils/nested-properties.js` |
| `deep-equal.js` | `src/utils/deep-equal.js` |
| `timing.js` | `src/utils/timing.js` |
| `HashStore.js` | `src/utils/HashStore.js` |
| `remove-canvases-and-divs.js` | `src/utils/dom-cleanup.js` |
| `load-and-parse-manifest.js` | `src/utils/manifest-loader.js` |

### Compression Utilities
| Old Path | New Path |
|----------|----------|
| `compress-font-metrics.js` | `src/compression/compress.js` |
| `decompress-font-metrics.js` | `src/compression/decompress.js` |

### Font Specifications
| Old Path | New Path |
|----------|----------|
| `Specs.js` | `src/specs/Specs.js` |
| `SpecsParser.js` | `src/specs/SpecsParser.js` |
| `specs-default.js` | `src/specs/default-specs.js` |

### UI Components
| Old Path | New Path |
|----------|----------|
| `ui.js` | `src/ui/base-ui.js` |
| `ui_Editor.js` | `src/ui/editor-ui.js` |
| `ui-copy-choice-radio-buttons.js` | `src/ui/components/copy-choice.js` |
| `ui-font-families-dropdown.js` | `src/ui/components/font-family-dropdown.js` |
| `ui-font-style-dropdown.js` | `src/ui/components/font-style-dropdown.js` |
| `ui-font-weight-dropdown.js` | `src/ui/components/font-weight-dropdown.js` |
| `ui-pixel-density-choice-radio-buttons.js` | `src/ui/components/pixel-density.js` |
| `ui-size-buttons.js` | `src/ui/components/size-buttons.js` |

### Test Utilities
| Old Path | New Path |
|----------|----------|
| `test-copy.js` | `test/utils/test-copy.js` |
| `drawTestText.js` | `test/utils/draw-test-text.js` |
| `text-generators.js` | `test/utils/text-generators.js` |
| `hashes-repo.js` | `test/data/reference-hashes.js` |
| `showGlyphs.js` | `test/utils/show-glyphs.js` |
| `buildAndShowGlyphs.js` | `test/utils/build-show-glyphs.js` |
| `createGlyphsAndAddToFullStore.js` | `test/utils/create-glyphs.js` |

### HTML Entry Points
| Old Path | New Path |
|----------|----------|
| `index.html` | `public/index.html` |
| `font-builder.html` | `public/font-builder.html` |
| `text-render-tests.html` | `public/test-renderer.html` |

### Tools
| Old Path | New Path |
|----------|----------|
| `simpleTextMetricsVisualisationTool/` | `tools/text-metrics-visualizer/` |
| `download-glyph-sheets-and-kerning-maps.js` | `tools/export-font-data.js` |

### Data Files
| Old Path | New Path |
|----------|----------|
| `bitmap-fonts-data/` | `data/` |
| `bitmap-fonts-data/PNG-to-JS-converter.js` | `scripts/png-to-js-converter.js` |
| `bitmap-fonts-data/squeeze-images.sh` | `scripts/optimize-images.sh` |

### Libraries
| Old Path | New Path |
|----------|----------|
| `libs/` | `lib/` |

### Documentation
| Old Path | New Path |
|----------|----------|
| `ARCHITECTURE.md` | `docs/ARCHITECTURE.md` |
| `CLAUDE.md` | `docs/CLAUDE.md` |
| `DOCS.md` | `docs/API.md` |

## Breaking Changes

### For Developers Extending the Library

1. **Import Paths**: All `<script>` tags in HTML files need to be updated to new paths
2. **Class Names**: Editor classes have been renamed:
   - `BitmapText_Editor` → `BitmapTextEditor`
   - `BitmapGlyphStore_Editor` → `BitmapGlyphStoreEditor`
   - `BitmapGlyph_Editor` → `BitmapGlyphEditor`
   - `GlyphIDString_Editor` → `GlyphIDStringEditor`

### For Users of the Library

1. **Entry Points**: 
   - Font Builder: `http://localhost:8000/public/font-builder.html`
   - Test Renderer: `http://localhost:8000/public/test-renderer.html`
   
2. **Font Data Location**: Generated font data is now in `data/` instead of `bitmap-fonts-data/`

3. **Specification Files**: Default specs moved from `specs-default.js` to `src/specs/default-specs.js`

## Migration Steps

### For HTML Projects Using BitmapText.js

1. **Update Script Paths**: Change all script references to use the new structure:
   ```html
   <!-- Before -->
   <script src="BitmapText.js"></script>
   
   <!-- After -->
   <script src="src/core/BitmapText.js"></script>
   ```

2. **Update Manifest References**: Change font data manifest path:
   ```html
   <!-- Before -->
   <script src="bitmap-fonts-data/manifest.js"></script>
   
   <!-- After -->
   <script src="data/manifest.js"></script>
   ```

### For Developers Extending Editor Classes

1. **Update Class References**:
   ```javascript
   // Before
   const editor = new BitmapText_Editor();
   
   // After
   const editor = new BitmapTextEditor();
   ```

2. **Update Import Paths** (if using ES6 modules in the future):
   ```javascript
   // Before
   import BitmapText from './BitmapText.js';
   
   // After
   import BitmapText from './src/core/BitmapText.js';
   ```

### For Development Setup

1. **Server Root**: Continue serving from the project root directory
2. **Entry Points**: Update bookmarks and links to new HTML locations
3. **Development Scripts**: Use the new npm scripts:
   ```bash
   npm run serve
   npm run font-builder
   npm run test-renderer
   ```
4. **PNG to JS Conversion**: For file:// protocol compatibility:
   ```bash
   cd data
   node ../scripts/png-to-js-converter.js
   ```

## Benefits of New Structure

1. **Clear Separation**: Runtime vs development code is clearly separated
2. **Logical Grouping**: Related functionality is organized together
3. **Better Navigation**: Easier to find specific components
4. **Standard Structure**: Follows JavaScript project conventions
5. **Future-Proof**: Ready for ES6 modules and build tools
6. **Documentation**: All docs in one place

## Compatibility

- **Backward Compatibility**: None - this is a breaking change
- **Data Compatibility**: All font data remains compatible
- **API Compatibility**: All JavaScript APIs remain unchanged
- **Functionality**: No functional changes, only organizational

## Support

- **Documentation**: Updated in docs/CLAUDE.md and docs/ARCHITECTURE.md
- **Examples**: All examples updated to use new paths
- **Testing**: All HTML entry points updated and tested

## Timeline

This reorganization is effective immediately. All future development should use the new structure.