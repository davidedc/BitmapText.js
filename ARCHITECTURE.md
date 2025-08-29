  # BitmapText.js Architecture

  ## System Overview

  BitmapText.js is a bitmap font rendering system that pre-renders glyphs to ensure pixel-identical consistency across browsers.

  ## Core Architecture

  ### Design Principles

  1. **Pre-rendering**: All glyphs rendered once at generation time
  2. **Immutability**: Runtime uses read-only bitmap data
  3. **Separation of Concerns**: Clear boundary between generation (Editor classes) and rendering (runtime classes)
  4. **Hash Verification**: verification of rendering consistency

  ### Component Organization
```
  ┌─────────────────────────────────────────┐
  │          Font Builder (Editor)          │
  │  ┌────────────────┐  ┌─────────────┐    │
  │  │ BitmapText_    │  │ BitmapGlyph │    │
  │  │ Editor         │  │ Store_Editor│    │
  │  └────────────────┘  └─────────────┘    │
  │           │                 │           │
  │           ▼                 ▼           │
  │      Generate          Generate         │
  │      Glyphs           Glyph Sheets      │
  └─────────────────────────────────────────┘
                      │
                      ▼
            ┌──────────────────┐
            │  Bitmap Font     │
            │  Data Files      │
            │  (.js + .png)    │
            └──────────────────┘
                      │
                      ▼
  ┌─────────────────────────────────────────┐
  │            Runtime Renderer             │
  │  ┌────────────────┐  ┌─────────────┐    │
  │  │  BitmapText    │  │ BitmapGlyph │    │
  │  │                │  │ Store       │    │
  │  └────────────────┘  └─────────────┘    │
  └─────────────────────────────────────────┘
```

  ## Class Hierarchy

  ### Core Classes (Runtime)

  **BitmapText**
  - Purpose: Text rendering engine
  - Responsibilities:
    - Text measurement (measureText)
    - Glyph positioning with kerning
    - Color application via composite operations
    - Canvas rendering

  **BitmapGlyphStore**
  - Purpose: Glyph data repository
  - Data structures:
    - `glyphSheets`: Canvas/Image elements with rendered glyphs
    - `glyphSheetsMetrics`: Position and dimension data
    - `glyphsTextMetrics`: Text measurement data
    - `kerningTables`: Pair-wise character adjustments
    - `spaceAdvancementOverrideForSmallSizesInPx`: Special spacing rules

  ### Editor Classes (Generation)

  **BitmapText_Editor extends BitmapText**
  - Additional capabilities for glyph generation
  - Creates individual glyph canvases
  - Calculates precise bounding boxes

  **BitmapGlyphStore_Editor extends BitmapGlyphStore**
  - Builds glyph sheets from individual glyphs
  - Optimizes glyph packing
  - Generates compressed metadata

  ### Supporting Classes

  **Specs**
  - Parses and manages font correction specifications
  - Handles size-dependent adjustments
  - Manages kerning rules

  **SpecsParser**
  - DSL parser for font specifications
  - Converts human-readable specs to data structures

  **HashStore**
  - Hash generation for rendered output
  - Verification of pixel-identical consistency
  - Test infrastructure support

  ## Data Flow

  ### Generation Phase

  1. **Glyph Creation**
     Font Spec → Canvas Rendering → Tight Bounding Box → Individual Glyph

  2. **Sheet Assembly**
     Individual Glyphs → Packed Layout → Glyph Sheet Image + Metrics

  3. **Data Export**
     Glyph Sheet + Metrics → Compressed JS + PNG Files

  ### Runtime Phase

  1. **Data Loading**
     Manifest.js → Load Sheet JS → Load Sheet PNG → Populate Store

  2. **Text Rendering**
     Text String → Measure → Apply Kerning → Copy Glyphs → Composite Color

  ## Key Algorithms

  ### Tight Bounding Box Detection

  The system scans rendered glyphs pixel-by-pixel to find minimal bounding boxes, eliminating browser-specific padding.

  ### Kerning Application

  Multi-level kerning system:
  1. Base kerning from browser metrics
  2. Size-specific corrections from Specs
  3. Pair-specific adjustments
  4. Discretization for small sizes

  ### Color Application

  Uses Canvas composite operations:
  1. Draw glyph in black on temporary canvas
  2. Apply 'source-in' composite mode
  3. Fill with target color
  4. Copy to destination

  ## Memory Management

  - Single shared temporary canvas for color operations
  - Glyph sheets loaded on-demand
  - Automatic cleanup of generation-time data

  ## Performance Optimizations

  1. **Pre-computed Metrics**: All measurements calculated at generation time
  2. **Batch Rendering**: Multiple glyphs drawn from single sheet
  3. **Integer Coordinates**: Rounding for pixel alignment
  4. **Minimal DOM Operations**: Reuses canvases

  ## Extension Points

  ### Custom Glyph Sources
  Override `BitmapGlyphStore_Editor.createCanvasesAndLetterTextMetrics()`

  ### Custom Kerning Rules
  Extend `Specs` class or modify specs DSL

  ### Alternative Storage
  Replace `BitmapGlyphStore` with custom implementation

  ## Object-Oriented Design Patterns

  - **Template Method**: Editor classes extend base with hooks
  - **Strategy**: Pluggable specs and kerning algorithms
  - **Facade**: BitmapText provides simple API over complex internals
  - **Repository**: BitmapGlyphStore manages data access