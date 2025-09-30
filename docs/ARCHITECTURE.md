  # BitmapText.js Architecture

  ## System Overview

  BitmapText.js is a bitmap font rendering system that pre-renders glyphs to ensure pixel-identical consistency across browsers.

  ## Core Architecture

  ### Design Principles

  1. **Pre-rendering**: All glyphs rendered once at font assets building time
  2. **Immutability**: Runtime uses read-only bitmap data
  3. **Separation of Concerns**: Clear boundary between font assets building (FAB classes) and rendering (runtime classes)
  4. **Hash Verification**: verification of rendering consistency

  ### Architectural Rationale: Core/FAB Layering

  The system is architected with a **two-tier class hierarchy** where FAB classes extend Core classes. This design enables **modular distribution** and **optimized bundle sizes** for different use cases:

  **Distribution Strategy:**
  - **Runtime Distribution** (~18-22KB): Only core classes (BitmapText, AtlasDataStore, FontMetricsStore, FontProperties, TextProperties, FontLoader, FontLoaderConfig) for measuring and drawing pre-generated fonts
  - **Full Distribution** (~55KB+): Core + FAB classes for complete font assets building and rendering capabilities
  - **Typical Use Case**: Most applications only need the lightweight runtime to consume pre-built bitmap fonts

  **Benefits:**
  1. **Bundle Size Optimization**: End users importing only runtime classes get significantly smaller bundles
  2. **Clear Separation of Concerns**: Build-time font assets building vs runtime text rendering
  3. **Deployment Flexibility**: Runtime-only distribution can be used in production without font assets building dependencies
  4. **Development Efficiency**: Font assets building can happen in development/build pipeline, not in user browsers

  **Implementation Pattern:**
  - **Core Classes**: Minimal, performance-optimized runtime functionality
  - **FAB Classes**: Extend core classes with font assets building capabilities (validation, font building, metrics calculation)
  - **Extraction Methods**: FAB instances can extract clean runtime instances (e.g., `extractAtlasDataStoreInstance()`, `extractFontMetricsStoreInstance()`)

  This architecture allows developers to choose between a lightweight consumer library or a full font assets building toolkit based on their needs.

  ### Component Organization
```
  ┌─────────────────────────────────────────┐
  │       Font Assets Builder (FAB)      │
  │  ┌────────────────┐  ┌─────────────┐    │
  │  │ BitmapText     │  │ Atlas       │    │
  │  │ FAB            │  │ StoreFAB   │    │
  │  └────────────────┘  └─────────────┘    │
  │           │                 │           │
  │           ▼                 ▼           │
  │      Generate          Generate         │
  │      Glyphs           Glyph Atlases     │
  └─────────────────────────────────────────┘
                      │
                      ▼
            ┌──────────────────┐
            │  Bitmap Font     │
            │  Data Files      │
            │ (metrics + atlas) │
            └──────────────────┘
                      │
                      ▼
  ┌─────────────────────────────────────────┐
  │            Runtime Renderer             │
  │  ┌────────────────┐  ┌─────────────┐    │
  │  │  BitmapText    │  │ Atlas       │    │
  │  │                │  │ Store       │    │
  │  └────────────────┘  └─────────────┘    │
  └─────────────────────────────────────────┘
```

  ## Class Hierarchy

  **Distribution Requirements by Use Case:**

  **Runtime-Only Applications** (consuming pre-built fonts):
  - `BitmapText` - Text rendering and measurement
  - `AtlasDataStore` - Atlas data storage and retrieval
  - `FontMetricsStore` - Font metrics, kerning, and glyph positioning data
  - `FontProperties` - Font configuration management
  - `TextProperties` - Text rendering configuration (kerning, alignment, color)
  - `FontLoader` - Font loading utilities
  - `FontLoaderConfig` - Font loading configuration
  - `FontManifest` - Font registry for testing (optional)
  - **Bundle Size**: ~18-22KB + font assets
  - **Use Case**: Production applications displaying bitmap text

  **Font Assets Building Applications**:
  - All Core Classes (above) +
  - `BitmapTextFAB` - Extended font assets building capabilities
  - `AtlasDataStoreFAB` - Atlas building and optimization
  - `FontMetricsStoreFAB` - Font metrics calculation and kerning generation
  - `FontPropertiesFAB` - Validation and font configuration tools
  - **Bundle Size**: ~55KB+ including font assets building tools
  - **Use Case**: Development tools, font builders, CI pipelines

  **Key Pattern**: FAB classes extend Core classes and provide `extract*Instance()` methods to create clean runtime objects for distribution.

  ### Core Classes (Runtime)

  **BitmapText**
  - Purpose: Text rendering engine
  - Responsibilities:
    - Text measurement (measureText)
    - Glyph positioning with kerning
    - Color application via composite operations
    - Canvas rendering
    - Placeholder rectangle rendering for missing atlases

  **AtlasDataStore**
  - Purpose: Atlas image repository
  - Data structures:
    - `atlases`: AtlasData objects containing both image and positioning data
  - Methods:
    - `getAtlasData()`, `setAtlasData()`: Atlas storage and retrieval
    - `isValidAtlas()`: Validates atlas integrity

  **AtlasImage**
  - Purpose: Encapsulates atlas image as immutable domain object
  - Data structures:
    - `image`: Canvas/Image element with rendered glyphs (public field, object frozen)
  - Methods:
    - `get width()`, `get height()`: Convenient dimension accessors
    - `isValid()`: Validates image integrity
    - `canRender()`: Checks if ready for drawing operations
    - `getImageType()`: Returns 'canvas' or 'image'

  **AtlasPositioning**
  - Purpose: Encapsulates glyph positioning data as immutable domain object
  - Data structures:
    - `_tightWidth`, `_tightHeight`: Glyph dimensions
    - `_dx`, `_dy`: Position offsets
    - `_xInAtlas`: Horizontal positions in atlas
  - Methods:
    - `getPositioning()`: Access to positioning data for specific character
    - `hasPositioning()`: Check if character has positioning data
    - `getAvailableCharacters()`: List all characters with positioning

  **AtlasData**
  - Purpose: Combines AtlasImage and AtlasPositioning for complete atlas representation
  - Data structures:
    - `atlasImage`: AtlasImage instance (public field, object frozen)
    - `atlasPositioning`: AtlasPositioning instance (public field, object frozen)
  - Methods:
    - `hasPositioning()`: Null-safe check if positioning data exists for character
    - `isValid()`: Validates both image and positioning integrity
    - `getAvailableCharacters()`: List all characters with positioning
    - `get width()`, `get height()`: Convenient dimension accessors
    - `canRender()`: Checks if ready for rendering operations

  **FontMetricsStore**
  - Purpose: Font metrics repository
  - Data structures:
    - `characterMetrics`: Text measurement data for layout calculation
    - `kerningTables`: Pair-wise character adjustments
    - `spaceAdvancementOverrideForSmallSizesInPx`: Special spacing rules
  - Methods:
    - `getFontMetrics()`, `setFontMetrics()`: FontMetrics instance management
    - `hasFontMetrics()`, `deleteFontMetrics()`: FontMetrics lifecycle management
    - `getAvailableFonts()`: Available font configurations

  **TextProperties**
  - Purpose: Text rendering configuration management
  - Responsibilities:
    - Kerning enable/disable control
    - Text baseline and alignment settings
    - Color specification
    - Immutable configuration object with pre-computed keys
  - Properties:
    - `isKerningEnabled`: Boolean kerning control
    - `textBaseline`, `textAlign`: Canvas text positioning
    - `textColor`: CSS color specification

  **FontLoader**
  - Purpose: Consolidated font loading utility
  - Responsibilities:
    - Promise-based font data loading
    - Error handling for missing files
    - Progress tracking and callbacks
    - Support for both PNG and JS atlases
    - Protocol detection (file:// vs http://) for appropriate loading strategy
    - Graceful degradation: missing atlases result in placeholder rectangles

## Terminology

**Character vs Glyph vs Code Point:**

- **Character**: Input unit of text - specifically a Unicode code point. Used for:
  - Method parameters (`char`)
  - Variables representing input text units
  - Examples: 'A', '5', '!', '😀' (basic emoji)

- **Glyph**: Visual representation/bitmap in the atlas. Used for:
  - Atlas contents
  - Rendered output
  - Methods like `hasGlyph()`, `renderGlyph()`

- **Code Point**: Technical term for Unicode character representation
  - JavaScript's `[...text]` splits strings into code points
  - NOT grapheme clusters (user-perceived characters)

**Current Limitation - Compound Emojis:**

The library operates on Unicode code points, not grapheme clusters. This means:

✓ **Works:** Basic characters, numbers, symbols, basic emojis
- 'Hello', '123', '!@#', '😀', 'é'

✗ **Doesn't work:** Compound emojis (multi-code-point sequences)
- '👨‍👩‍👧' (family emoji - splits into 5 code points with ZWJ)
- '🏳️‍🌈' (rainbow flag - splits into 4 code points)
- Emojis with skin tone modifiers

To support compound emojis would require:
1. Using `Intl.Segmenter` for grapheme cluster iteration
2. Updating data structures for multi-code-point keys
3. Building atlas entries for compound characters

  **FontLoaderConfig**
  - Purpose: Font loading configuration management
  - Responsibilities:
    - Centralized path configuration for font assets
    - Error message templates for consistent user feedback
    - Path building methods for metrics and atlas files
    - Support for multiple file formats (PNG, QOI, JS)

  **FontManifest**
  - Purpose: Font registry management for testing and development
  - Responsibilities:
    - Centralized storage of available font IDs
    - Clean API for font registration without global namespace pollution
    - Used primarily by test-renderer for loading all available fonts
  - Methods:
    - `addFontIDs()`: Register font IDs from generated font-registry files
    - `allFontIDs()`: Get copy of all registered font IDs
    - `hasFontID()`, `count()`, `clear()`: Registry management utilities

  ### FAB Classes (Font Assets Building)

  **BitmapTextFAB extends BitmapText**
  - Additional capabilities for font assets building
  - Creates individual glyph canvases
  - Calculates precise bounding boxes

  **AtlasImageFAB extends AtlasImage**
  - Font assets building capabilities for atlas image management
  - Factory methods for creating from canvas, base64, or URL
  - Image format conversion and export (PNG, QOI, base64)
  - Atlas validation and optimization features
  - Extraction method to create clean AtlasImage instances

  **AtlasDataStoreFAB extends AtlasDataStore**
  - Builds atlases from individual canvases using AtlasImageFAB
  - Optimizes glyph packing and atlas generation
  - Generates minified metadata and export formats
  - Extraction method to convert AtlasImageFAB to AtlasImage instances

  **AtlasPositioningFAB extends AtlasPositioning**
  - Font assets building capabilities for atlas positioning data management
  - Calculates positioning data from glyph canvas bounds and font metrics
  - Manages xInAtlas positions during atlas building process
  - Provides extraction methods to create clean runtime AtlasPositioning instances
  - Handles ONLY atlas positioning calculations (separated from FontMetricsFAB)

  **FontMetricsFAB extends FontMetrics**
  - Font assets building capabilities for font metrics data management
  - Handles ONLY font metrics, kerning tables, and character measurements
  - Building, validation, and optimization features for metrics data
  - Provides extraction methods to create clean runtime FontMetrics instances
  - Clean separation from atlas positioning (handled by AtlasPositioningFAB)

  **FontMetricsStoreFAB extends FontMetricsStore**
  - Font assets building store for FontMetricsFAB instances
  - Manages font metrics calculation and validation during building
  - Provides extraction methods to create clean runtime FontMetricsStore instances
  - Focuses solely on font metrics (positioning handled separately by AtlasPositioningFAB)

  ### Supporting Classes

  **Specs**
  - Parses and manages font correction specifications
  - Handles size-dependent adjustments
  - Manages kerning rules

  **SpecsParser**
  - DSL parser for font specifications
  - Converts human-readable specs to data structures

  **HashStore**
  - Hash computation for rendered output using djb2-style algorithm
  - Verification of pixel-identical consistency across browsers
  - Test infrastructure support with reference hash storage
  - Includes canvas dimensions in hash calculation for robustness

  ## Data Flow

  ### Font Assets Building Phase

  1. **Glyph Creation**
     Font Spec → Canvas Rendering → Tight Bounding Box → Individual Glyph

  2. **Atlas Assembly**
     Individual Glyphs → Packed Layout → Atlas Image + Metrics

  3. **Data Export**
     Atlas + Metrics → QOI Files + Compressed JS

  ### Runtime Phase

  1. **Data Loading**
     font-registry.js → FontManifest → FontLoader → Load Atlas JS → Load Atlas PNG → Direct FontMetricsStore Population

  2. **Text Rendering**
     Text String → Measure → Apply Kerning → Copy Glyphs → Composite Color
     (If atlas missing: Render placeholder rectangles)

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

  ### Placeholder Rendering

  When atlases are missing but metrics are available:
  1. Validate atlas using `isValidAtlas()`
  2. Fall back to placeholder rectangle mode
  3. Draw simplified rectangle using character metrics (width × fontBoundingBoxAscent + actualBoundingBoxDescent)
  4. Position at baseline using character metrics positioning

  ## QOI Image Format

  The system uses QOI (Quite OK Image format) for atlas export and storage:

  **Browser Export (tools/export-font-data.js:25)**:
  1. Extract RGBA image data from canvas via `getImageData()`
  2. Encode using QOIEncode with 4 channels (RGBA) and sRGB colorspace
  3. Package as base64 in zip for download

  **Pipeline Conversion (scripts/qoi-to-png-converter.js)**:
  1. Decode QOI files using QOIDecode library
  2. Convert to uncompressed PNG using PngEncoder for ImageOptim processing
  3. Preserve QOI files by default for future Node.js font rendering

  **Benefits**:
  - **Minimal Dependencies**: Small, self-contained encoder/decoder (~200 lines each)
  - **Reasonable Compression**: Better than raw RGBA, smaller than browser PNG
  - **Node.js Compatibility**: Easy parsing without external dependencies
  - **Future-Ready**: QOI files preserved for direct Node.js font renderer consumption

  ## Data Minification/Expansion

  Font data is minified for efficient storage and network transfer:

  **Font Metrics Minification (src/minification/MetricsMinifier.js)**:
  1. **Dynamic Base Metrics**: Uses first available character for base font metrics extraction
  2. **Nested Structure Flattening**: Converts multi-level font property objects to flat arrays
  3. **Data Deduplication**: Removes redundant entries across similar font configurations
  4. **Property Name Shortening**: Optimizes repeated font family/style/weight combinations

  **Font Metrics Expansion (src/minification/MetricsExpander.js)**:
  1. **Array to Object Mapping**: Rebuilds nested property structures
  2. **Property Reconstruction**: Restores font property hierarchies
  3. **Metrics Expansion**: Reconstructs full glyph metrics from minified data
  4. **Essential Property Validation**: Verifies key metrics are preserved during roundtrip

  **Atlas Data Minification (src/minification/AtlasDataMinifier.js)**:
  1. **Property Key Shortening**: Converts verbose keys (tightWidth → w, tightHeight → h, xInAtlas → x)
  2. **Raw Data Extraction**: Extracts positioning data from AtlasPositioning instances for serialization
  3. **Non-FAB Instance Processing**: Operates on extracted runtime instances to ensure only runtime-needed data is serialized
  4. **Compact Format Generation**: Creates minimal positioning objects for file size optimization

  **Atlas Data Expansion (src/minification/AtlasDataExpander.js)**:
  1. **Property Key Restoration**: Expands shortened keys back to full names (w → tightWidth, h → tightHeight, x → xInAtlas)
  2. **AtlasPositioning Creation**: Reconstructs AtlasPositioning instances from minified data
  3. **AtlasData Assembly**: Combines expanded positioning with AtlasImage instances
  4. **Runtime Instance Generation**: Creates clean runtime objects from serialized data

  ## Memory Management

  Optimized for minimal memory footprint and efficient access:

  - **Shared Resources**: Single temporary canvas reused for all color operations
  - **Lazy Loading**: Glyph atlases loaded on-demand when first accessed
  - **Automatic Cleanup**: Font assets building-time data structures cleared after font building
  - **Canvas Reuse**: BitmapText instances reuse coloredGlyphCanvas for all glyphs
  - **Integer Coordinates**: All positions rounded to prevent floating-point accumulation
  - **Minimal DOM**: Only necessary canvases attached to document during rendering

  ## Performance Optimizations

  1. **Pre-computed Metrics**: All measurements calculated at font assets building time
  2. **Batch Rendering**: Multiple glyphs drawn from single atlas
  3. **Integer Coordinates**: Rounding for pixel alignment
  4. **Minimal DOM Operations**: Reuses canvases

  ## Sequence Diagrams

  ### Font Assets Building Workflow
  ```
  User → public/font-assets-builder.html → BitmapTextFAB → AtlasDataStoreFAB
    1. Load font specifications (src/specs/default-specs.js)
    2. Parse specs (src/specs/SpecsParser.parseSubSpec:98)
    3. Create individual glyph canvases
    4. Apply tight bounding box detection
    5. Calculate kerning tables
    6. Build optimized atlases
    7. Generate minified metadata
    8. Export metrics-*.js files + atlas-*-qoi.js/png.js files + font-registry.js
  ```

  ### Runtime Text Rendering Workflow
  ```
  User → src/core/BitmapText.drawTextFromAtlas → src/core/AtlasDataStore + src/core/FontMetricsStore
    1. Convert text to code point array ([...text])
    2. Measure text (src/core/BitmapText.measureText)
    3. For each character:
       a. Get glyph metrics (src/core/FontMetricsStore.getFontMetrics)
       b. Create colored glyph (src/core/BitmapText.createColoredGlyph)
       c. Render to main canvas (src/core/BitmapText.renderGlyphToMainCanvas)
       d. Calculate advancement with kerning (src/core/BitmapText.calculateAdvancement_CSS_Px:78)
    4. Return final rendered text
  ```

  ## Extension Points

  ### Custom Glyph Sources
  Override `src/font-assets-builder-FAB/GlyphFAB.createCanvasesAndCharacterMetrics()`

  ### Custom Kerning Rules
  Extend `Specs` class or modify specs DSL

  ### Alternative Storage
  Replace `AtlasDataStore` with custom implementation

  ## Object-Oriented Design Patterns

  - **Template Method**: FAB classes extend base with hooks
  - **Strategy**: Pluggable specs and kerning algorithms
  - **Facade**: BitmapText provides simple API over complex internals
  - **Repository**: AtlasDataStore manages data access

  ## API Usage

  See README.md for complete API documentation and usage examples.