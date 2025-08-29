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
  │  │ BitmapText     │  │ BitmapGlyph │    │
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

  **BitmapTextEditor extends BitmapText**
  - Additional capabilities for glyph generation
  - Creates individual glyph canvases
  - Calculates precise bounding boxes

  **BitmapGlyphStoreEditor extends BitmapGlyphStore**
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
  - Hash generation for rendered output using djb2-style algorithm
  - Verification of pixel-identical consistency across browsers
  - Test infrastructure support with reference hash storage
  - Includes canvas dimensions in hash calculation for robustness

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

  The system scans rendered glyphs pixel-by-pixel to find minimal bounding boxes, eliminating browser-specific padding:

  1. **Pixel Scanning**: Iterates through canvas image data
  2. **Edge Detection**: Finds first/last non-transparent pixels in each direction
  3. **Coordinate Calculation**: Computes tight dx, dy, width, height values
  4. **Validation**: Ensures bounding box contains all visible pixels

  ### Hash Verification System

  Ensures pixel-identical rendering across browsers and sessions:

  **Algorithm (src/utils/canvas-extensions.js:1)**:
  1. Extract RGBA pixel data from canvas
  2. Pack each pixel into 32-bit integer (R<<24 | G<<16 | B<<8 | A)
  3. Apply djb2-style hash function: `hash = ((hash << 5) - hash) + pixel`
  4. Include canvas width and height in final hash
  5. Convert to 8-character hexadecimal string

  **Usage**:
  - Runtime verification during testing
  - Background color changes to pink on hash mismatch
  - Reference hashes stored in test/data/reference-hashes.js
  - Enables detection of sub-pixel rendering differences

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

  ## Data Compression/Decompression

  Font data is compressed for efficient storage and network transfer:

  **Compression (src/compression/compress.js)**:
  1. **Dynamic Base Metrics**: Uses first available character for base font metrics extraction
  2. **Nested Structure Flattening**: Converts multi-level font property objects to flat arrays
  3. **Data Deduplication**: Removes redundant entries across similar font configurations
  4. **String Compression**: Optimizes repeated font family/style/weight combinations

  **Decompression (src/compression/decompress.js)**:
  1. **Array to Object Mapping**: Rebuilds nested property structures
  2. **Property Reconstruction**: Restores font property hierarchies
  3. **Metrics Expansion**: Reconstructs full glyph metrics from compressed data
  4. **Essential Property Validation**: Verifies key metrics are preserved during roundtrip

  ## Memory Management

  Optimized for minimal memory footprint and efficient access:

  - **Shared Resources**: Single temporary canvas reused for all color operations
  - **Lazy Loading**: Glyph sheets loaded on-demand when first accessed
  - **Automatic Cleanup**: Generation-time data structures cleared after font building
  - **Canvas Reuse**: BitmapText instances reuse coloredGlyphCanvas for all glyphs
  - **Integer Coordinates**: All positions rounded to prevent floating-point accumulation
  - **Minimal DOM**: Only necessary canvases attached to document during rendering

  ## Performance Optimizations

  1. **Pre-computed Metrics**: All measurements calculated at generation time
  2. **Batch Rendering**: Multiple glyphs drawn from single sheet
  3. **Integer Coordinates**: Rounding for pixel alignment
  4. **Minimal DOM Operations**: Reuses canvases

  ## Sequence Diagrams

  ### Glyph Generation Workflow
  ```
  User → public/font-builder.html → BitmapTextEditor → BitmapGlyphStoreEditor
    1. Load font specifications (src/specs/default-specs.js)
    2. Parse specs (src/specs/SpecsParser.parseSubSpec:98)
    3. Create individual glyph canvases
    4. Apply tight bounding box detection
    5. Calculate kerning tables
    6. Build optimized glyph sheets
    7. Generate compressed metadata
    8. Export .js + .png files
  ```

  ### Runtime Text Rendering Workflow
  ```
  User → src/core/BitmapText.drawTextFromGlyphSheet → src/core/BitmapGlyphStore
    1. Measure text (src/core/BitmapText.measureText)
    2. For each character:
       a. Get glyph metrics (src/core/BitmapGlyphStore.getGlyphSheetMetrics)
       b. Create colored glyph (src/core/BitmapText.createColoredGlyph)
       c. Render to main canvas (src/core/BitmapText.renderGlyphToMainCanvas)
       d. Calculate advancement with kerning (src/core/BitmapText.calculateAdvancement_CSS_Px:78)
    3. Return final rendered text
  ```

  ## Extension Points

  ### Custom Glyph Sources
  Override `src/editor/BitmapGlyphStoreEditor.createCanvasesAndLetterTextMetrics()`

  ### Custom Kerning Rules
  Extend `Specs` class or modify specs DSL

  ### Alternative Storage
  Replace `BitmapGlyphStore` with custom implementation

  ## Object-Oriented Design Patterns

  - **Template Method**: Editor classes extend base with hooks
  - **Strategy**: Pluggable specs and kerning algorithms
  - **Facade**: BitmapText provides simple API over complex internals
  - **Repository**: BitmapGlyphStore manages data access

  ## API Usage

  See README.md for complete API documentation and usage examples.