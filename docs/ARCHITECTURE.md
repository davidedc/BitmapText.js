  # BitmapText.js Architecture

  ## System Overview

  BitmapText.js is a bitmap font rendering system that pre-renders glyphs to ensure pixel-identical consistency across browsers.

  ## Core Architecture

  ### Design Principles

  1. **Pre-rendering**: All glyphs rendered once at font assets building time
  2. **Immutability**: Runtime uses read-only bitmap data
  3. **Separation of Concerns**: Clear boundary between font assets building (FAB classes) and rendering (runtime classes)
  4. **Hash Verification**: verification of rendering consistency

  ### Architectural Rationale: Static Class Design

  The system uses a **static class architecture** for the runtime API, providing zero-configuration usage while maintaining a separate instance-based architecture for font-assets-builder.

  **Why Static Architecture?**

  The static architecture was chosen after evaluating an instance-based approach. The key insight: **font data is application-wide state, not instance-specific state**. There's no meaningful use case for maintaining separate font data per instance.

  **Comparison: Instance-based vs Static**

  *Instance-based approach (rejected):*
  ```javascript
  // User must manually create and wire stores
  const atlasDataStore = new AtlasDataStore();
  const fontMetricsStore = new FontMetricsStore();
  const bitmapText = new BitmapText(atlasDataStore, fontMetricsStore);
  const fontLoader = new FontLoader(atlasDataStore, fontMetricsStore, ...);

  // Problems: Unnecessary plumbing, exposed complexity, larger bundle
  ```

  *Static approach (implemented):*
  ```javascript
  // Zero configuration - just use it
  BitmapText.drawTextFromAtlas(ctx, text, x, y, fontProperties);

  // All stores are internal, managed automatically
  ```

  The classes that became static (BitmapText, AtlasDataStore, FontMetricsStore) revealed themselves to be singletons - they maintain application-wide state that doesn't benefit from multiple instances. Making them static eliminates unnecessary instantiation and wiring.

  **Distribution Strategy:**
  - **Static Runtime** (~15-18KB): BitmapText static class with internal stores - zero configuration in browsers, minimal configuration in Node.js
  - **Full Distribution** (~55KB+): Static runtime + FAB classes for complete font assets building capabilities

  **Benefits:**
  1. **Zero Configuration**: Browser users load BitmapText.js and font assets - no setup required
  2. **Simplified API**: All methods static - `BitmapText.drawTextFromAtlas()` instead of manual wiring
  3. **Smaller Bundle**: Single class instead of multiple instances and stores
  4. **Self-Registering Assets**: Font files call `BitmapText.registerMetrics/Atlas()` when loaded
  5. **Cross-Platform**: Same API works in browser and Node.js with minimal configuration
  6. **No Plumbing**: Stores are internal, no manual wiring required

  **Architecture:**
  - **BitmapText (static)**: Production runtime - static methods, delegates to internal stores
  - **FAB Classes**: Extend BitmapText, AtlasDataStore, FontMetricsStore for font building capabilities

  This architecture provides a simple static API for end users while also supporting the font-assets-builder tool through FAB extensions.

### Transform Reset Pattern

**Design Decision:** BitmapText ignores context transforms for pixel-perfect rendering.

**Rationale:**
1. **Predictable Positioning:** Text always renders at exact physical pixel boundaries
2. **No Double-Scaling:** Prevents bugs when users apply `ctx.scale(dpr, dpr)`
3. **Independent Rendering:** BitmapText behavior is deterministic regardless of context state
4. **Pixel-Perfect Guarantee:** Direct control over physical pixel placement ensures consistency

**Implementation:**
```javascript
static drawTextFromAtlas(ctx, text, x_CssPx, y_CssPx, fontProperties, textProperties) {
  // ... validation ...

  ctx.save();                           // Save current transform
  ctx.setTransform(1, 0, 0, 1, 0, 0);   // Reset to identity

  // Draw at physical pixels: x_CssPx × pixelDensity
  // All ctx.drawImage() calls receive physical pixel coordinates

  ctx.restore();                        // Restore original transform

  // ... return status ...
}
```

**Trade-offs:**
- ✅ **Pro:** Simple, robust, predictable
- ✅ **Pro:** No complex transform mathematics
- ✅ **Pro:** Compatible with any context state
- ⚠️ **Con:** Users cannot use transforms to position BitmapText
- ⚠️ **Con:** Different pattern than HTML5 Canvas fillText()

**User Impact:**
```javascript
// This does NOT work as expected:
ctx.translate(100, 50);
BitmapText.drawTextFromAtlas(ctx, "Hello", 10, 20, fontProps);
// Text renders at (10, 20), NOT (110, 70)

// Users must calculate absolute positions:
const baseX = 100;
const baseY = 50;
BitmapText.drawTextFromAtlas(ctx, "Hello", baseX + 10, baseY + 20, fontProps);
// Text renders at (110, 70) as intended
```

**Alternatives Considered:**
1. **Respect Transforms:** Would require complex matrix mathematics and cause double-scaling issues
2. **Smart Un-scale:** Would work only for simple `scale(dpr, dpr)`, breaks with translations/rotations
3. **Transform-Aware Mode:** Would add API complexity and dual code paths

**Chosen:** Reset transform (identity matrix) for simplicity and robustness.

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

  **Static Runtime Applications** (consuming pre-built fonts):
  - `BitmapText` (static) - All rendering and measurement via static methods
  - `FontProperties` - Font configuration (optional, for type safety)
  - `TextProperties` - Text rendering configuration (optional, for type safety)
  - **Bundle Size**: ~15-18KB + font assets
  - **Use Case**: Production web apps, Node.js rendering, games
  - **Configuration**: Zero-config in browser, minimal config in Node.js

  **Font Assets Building Applications**:
  - `BitmapText` - Static text rendering (base class for BitmapTextFAB)
  - `AtlasDataStore` - Atlas data storage (base class for AtlasDataStoreFAB)
  - `FontMetricsStore` - Font metrics storage (base class for FontMetricsStoreFAB)
  - `BitmapTextFAB` - Extended font assets building capabilities
  - `AtlasDataStoreFAB` - Atlas building and optimization
  - `FontMetricsStoreFAB` - Font metrics calculation and kerning generation
  - `FontPropertiesFAB` - Validation and font configuration tools
  - **Bundle Size**: ~55KB+ including font assets building tools
  - **Use Case**: Font-assets-builder.html, development tools

  **Key Pattern**: Static BitmapText for end users, extended by BitmapTextFAB for font building capabilities.

  ### Core Classes (Runtime)

  **BitmapText (static class)**
  - Purpose: Static text rendering API and facade for internal stores and FontLoader
  - Architecture: All methods static, delegates storage to AtlasDataStore and FontMetricsStore, delegates font loading to FontLoaderBase
  - Responsibilities:
    - Configuration (Optional): `configure({ fontDirectory, canvasFactory })` - delegates fontDirectory to FontLoader
    - Font directory: `setFontDirectory()`, `getFontDirectory()` - delegates to FontLoader (FontLoader owns this)
    - Font loading: `loadFont()`, `loadFonts()` - delegates to platform-specific FontLoader
    - Font registration: `registerMetrics()`, `registerAtlas()` (called by font assets) - delegates to stores
    - Font queries: `hasMetrics()`, `hasAtlas()`, `unloadMetrics()`, `unloadAtlas()` - delegates to stores
    - Text measurement: `measureText()` - retrieves data from stores
    - Text rendering: `drawTextFromAtlas()` - retrieves data from stores
    - Platform-specific FontLoader detection: Checks for `FontLoader` class from src/platform/
    - Canvas creation: Auto-creates in browser, uses canvasFactory in Node.js
  - Internal Fields (private):
    - `#fontLoader`: Platform-specific FontLoader class (src/platform/FontLoader-browser.js or FontLoader-node.js)
    - `#canvasFactory`: Canvas creation function (optional override, platform-specific defaults)
    - Storage: Delegated to AtlasDataStore and FontMetricsStore (stores are the single source of truth)
    - Note: fontDirectory is NOT stored in BitmapText - it's owned by FontLoaderBase

  **AtlasDataStore (static class)**
  - Purpose: Single source of truth for atlas image storage
  - Architecture: Static class, used by BitmapText (via delegation) and FontLoaderBase (directly)
  - Data structures:
    - `atlases`: Map storing AtlasData objects (image + positioning data)
  - Methods:
    - `getAtlasData()`, `setAtlasData()`: Atlas storage and retrieval
    - `deleteAtlas()`: Remove atlas from memory
    - `hasAtlas()`: Check if atlas exists
    - `getLoadedAtlases()`: List all loaded atlas IDs
    - `clear()`: Clear all atlases (testing only)

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
    - `_tightWidth`: Glyph width
    - `_tightHeight`: Glyph height
    - `_dx`, `_dy`: Position offsets relative to text cursor
    - `_xInAtlas`: Horizontal positions in atlas
  - Current Export Format:
    - NO positioning data serialized (100% reconstruction at runtime)
    - All 5 properties reconstructed by TightAtlasReconstructor from Atlas image
    - Atlas format (variable-width cells) provides all information needed for reconstruction
    - Reconstruction uses pixel scanning + FontMetrics for cell dimensions
    - All positioning data stored in memory for O(1) access during rendering
  - Methods:
    - `getPositioning()`: Access to positioning data for specific character
    - `hasPositioning()`: Check if character has positioning data
    - `getAvailableCharacters()`: List all characters with positioning
    - `getHash()`: Generate deterministic cross-platform hash of positioning data (FNV-1a, 6-char hex)

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

  **FontMetricsStore (static class)**
  - Purpose: Single source of truth for font metrics storage
  - Architecture: Static class, used by BitmapText (via delegation) and FontLoaderBase (directly)
  - Data structures:
    - `fontMetrics`: Map storing FontMetrics instances
    - Each FontMetrics contains:
      - `characterMetrics`: Text measurement data for layout calculation
      - `kerningTables`: Pair-wise character adjustments
      - `spaceAdvancementOverrideForSmallSizesInPx`: Special spacing rules
  - Methods:
    - `getFontMetrics()`, `setFontMetrics()`: FontMetrics instance management
    - `deleteFontMetrics()`: Remove font metrics from memory
    - `hasFontMetrics()`: Check if font metrics exist
    - `getLoadedFonts()`: List all loaded font IDs
    - `clear()`: Clear all font metrics (testing only)

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

  **Font Loading (platform-specific FontLoader classes)**
  - Purpose: Load font data from pre-generated assets
  - Architecture: Platform-specific implementations with unified class name
    - **src/platform/FontLoader-browser.js**: Browser implementation (class: `FontLoader`)
    - **src/platform/FontLoader-node.js**: Node.js implementation (class: `FontLoader`)
    - Platform selection: Build-time (which file is included), not runtime detection
    - Both extend FontLoaderBase for shared logic
  - Browser Implementation (FontLoader-browser.js):
    - Script tag loading for metrics JS files (call `BitmapText.registerMetrics()`)
    - Image element loading for PNG atlases (http://)
    - Script tag + base64 decoding for JS-wrapped atlases (file://)
    - Protocol detection (file:// vs http://) for appropriate loading strategy
    - Promise-based async loading with progress callbacks
    - Auto-detects canvas creation: `document.createElement('canvas')`
    - Default font directory: './font-assets/' (from FontLoaderBase)
  - Node.js Implementation (FontLoader-node.js):
    - Synchronous fs.readFileSync for metrics and atlas files
    - eval-based loading with BitmapText static scope
    - QOI decoding for atlas image data
    - Uses configured canvasFactory from BitmapText for canvas creation
    - Uses own fontDirectory (from FontLoaderBase) for file paths
  - FontLoaderBase (shared logic and ownership):
    - **Owns fontDirectory configuration**: `#fontDirectory` private field (default: './font-assets/')
    - Methods: `setFontDirectory(path)`, `getFontDirectory()` (returns override ?? DEFAULT)
    - Atlas reconstruction via TightAtlasReconstructor
    - Stores data directly in AtlasDataStore and FontMetricsStore
    - Pending atlas handling (atlas arrives before metrics)
    - Architecture rationale: FontLoader owns fontDirectory because it's the component that uses it
  - Loading Dependency: Metrics MUST be loaded before atlases
  - Graceful degradation: Missing atlases result in placeholder rectangles
  - API Methods (exposed via BitmapText):
    - `BitmapText.loadFont(idString, options)`: Load single font
    - `BitmapText.loadFonts(idStrings, options)`: Load multiple fonts in parallel
    - Options: `{ isFileProtocol, onProgress }`

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
  - Delegates kerning calculations to KerningCalculator service
  - Orchestrates kerning table storage in FontMetricsStoreFAB

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
  - Supports building atlases (buildAtlas - variable-width cells format)
  - Supports tight atlas reconstruction (reconstructTightAtlas - converts variable-width atlas to tight atlas via pixel scanning)

  **AtlasPositioningFAB extends AtlasPositioning**
  - Font assets building capabilities for atlas positioning data management
  - Calculates positioning data from glyph canvas bounds and font metrics
  - Manages xInAtlas and tightHeight during atlas building process
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

  **GlyphFAB**
  - Individual glyph creation and rendering for font assets building
  - No base class (standalone FAB utility class)
  - Orchestrates 6-step glyph creation pipeline:
    1. Canvas creation and configuration (DOM attachment for crisp rendering)
    2. Character metrics measurement (handles browser edge cases)
    3. Specs corrections application (pixel + proportional adjustments)
    4. Canvas dimension configuration (width/height calculation)
    5. Character rendering (precise positioning with corrections)
    6. Canvas preservation (export-ready copy before DOM removal)
  - Calculates tight bounding boxes via pixel scanning
  - Stores character metrics in FontMetricsStoreFAB
  - Produces two canvas formats: standard (for atlas packing) + tight (for verification)
  - Key architectural pattern: Extract Method decomposition for maintainability
  - Public API: `createCanvasesAndCharacterMetrics()` orchestrates all steps

  ### Supporting Classes

  **Character Set Configuration (src/builder/character-set.js)**
  - Defines the complete set of supported characters for font assets building
  - Programmatically generates character set from multiple ranges:
    - ASCII printable characters (32-126): space, numbers, letters, common symbols
    - Windows-1252 (CP-1252) subset (128-159): commonly used extended ASCII symbols (€, •, —, ™, etc.)
    - Latin-1 Supplement (161-255): accented characters, excluding soft hyphen (U+00AD)
    - Full Block character (█): visual reference for maximum glyph space
  - Implementation: `generateCharacterSet()` function creates sorted character string
  - Exported as global: `characterSet` variable (used by create-glyphs.js and KerningCalculator)
  - Character count: 217 characters (as of latest version)
  - Distribution: Part of font assets building toolkit only

  **Glyph Creation Utilities (src/builder/create-glyphs.js)**
  - Orchestrates glyph creation for all characters in character set
  - Function: `createGlyphsAndAddToFullStore(fontProperties)`
  - Iterates through character set and creates GlyphFAB instance for each character
  - Stores created glyphs in AtlasDataStoreFAB for subsequent atlas building
  - Depends on: character-set.js (global characterSet), GlyphFAB, AtlasDataStoreFAB
  - Used by: font-assets-builder.html build workflow
  - Distribution: Part of font assets building toolkit only

  **KerningCalculator**
  - Service class for kerning calculation and table generation (build-time only)
  - Encapsulates kerning logic extracted from BitmapTextFAB
  - Depends on Specs instance for accessing kerning rules
  - Methods:
    - `calculateCorrection()`: Calculate kerning adjustment for character pair
    - `buildTable()`: Generate complete kerning table for character set
    - `getSpaceAdvancementOverride()`: Get space override for small font sizes
  - Benefits: Improved testability, reusability, Single Responsibility Principle
  - Distribution: Part of "full toolkit" for font assets building (not in runtime)

  **Specs**
  - Parses and manages font correction specifications
  - Handles size-dependent adjustments
  - Manages kerning rules
  - Provides query methods for accessing specification data

  **SpecsParser**
  - DSL parser for font specifications
  - Converts human-readable specs to data structures

  **HashStore**
  - Hash computation for rendered output using djb2-style algorithm
  - Verification of pixel-identical consistency across browsers
  - Test infrastructure support with reference hash storage
  - Includes canvas dimensions in hash calculation for robustness

  ### Minification and Atlas Reconstruction

  **AtlasReconstructionUtils**
  - Shared utilities for atlas reconstruction algorithms
  - Provides getImageData() for extracting pixel data from various image sources
  - Used by both AtlasDataExpander (runtime) and TightAtlasReconstructor (atlas generation)

  **AtlasBuilder**
  - Builds atlases from glyph canvases (variable-width cells format)
  - Uses variable-width cells (actualBoundingBox) × constant height (fontBoundingBox)
  - Maintains sorted character order for determinism
  - Used by font-assets-builder.html to generate atlas source for reconstruction
  - API: `buildAtlas(fontMetrics, glyphs)` - fontMetrics first for consistency

  **TightAtlasReconstructor**
  - Runtime class for reconstructing tight atlases from Atlas format via pixel scanning
  - Uses 4-step optimized tight bounds detection (bottom→top, top→bottom, left→right, right→left)
  - Calculates positioning data using exact formulas from AtlasPositioningFAB
  - Integrated into FontLoader for automatic Atlas → Tight Atlas conversion at load time
  - Cross-platform canvas creation via `BitmapText.getCanvasFactory()()` (explicit double invocation pattern)
  - Part of core runtime distribution (~18-22KB)
  - API: `reconstructFromAtlas(fontMetrics, atlasImage)` - fontMetrics first for consistency

## Canvas Factory Pattern

### Why Factory Functions, Not Classes?

**The HTMLCanvasElement Constraint:**
- `HTMLCanvasElement` is **not constructible** in JavaScript
- Attempting `new HTMLCanvasElement()` throws `"Illegal constructor"`
- This is a platform limitation, not a design choice

**Platform-Specific Solutions:**
- **Browser**: Must use `document.createElement('canvas')` or `new OffscreenCanvas(width, height)`
- **Node.js**: Requires canvas-mock library providing `Canvas` constructor

**Why BitmapText Needs Canvas (Node.js-specific concern):**

BitmapText needs to create Canvas instances internally for:
1. **Loading atlas images** from atlas-*.js files
2. **Scanning pixels** to find tight bounding boxes for each glyph
3. **Creating tight atlases** from scanned data

The browser has built-in Canvas via DOM, but Node.js does not. Hence the need for configuration.

### Usage Pattern

**Explicit double invocation** (makes the two-step process visible):
```javascript
const canvas = BitmapText.getCanvasFactory()();
//               │                        │  │
//               │                        │  └─ Invoke factory to create canvas
//               │                        └──── Get the factory function
//               └─────────────────────────── Returns factory
```

**Why explicit instead of hidden?**
- Self-documenting: Shows "get factory, call factory"
- Clear about the two-step process
- No unnecessary abstraction layer

### Configuration

**Browser**:
```javascript
// No configuration needed - uses document.createElement('canvas')
BitmapText.drawTextFromAtlas(...);
```

**Node.js** (requires configuration):
```javascript
import { Canvas } from './src/platform/canvas-mock.js';

BitmapText.configure({
  canvasFactory: () => new Canvas()  // Factory function, not class reference
});
```

**Alternative**: Using OffscreenCanvas (browser):
```javascript
BitmapText.setCanvasFactory(() => new OffscreenCanvas(0, 0));
```

  ## Data Flow

  ### Font Assets Building Phase

  1. **Configuration Loading**
     Character Set (src/builder/character-set.js) → 217 characters defined
     Font Specs (src/specs/default-specs.js) → Kerning rules and corrections

  2. **Glyph Creation**
     Character Set + Font Spec → Canvas Rendering (GlyphFAB) → Individual Glyph (two formats: original canvas + tight canvas)

  3. **Atlas Assembly**
     Individual Glyphs (original canvases) → AtlasBuilder → Atlas Image (variable-width cells)

  4. **Data Export**
     Atlas Image → QOI → Compressed JS (base64)
     Font Metrics → MetricsMinifier → Compressed JS
     (No positioning data exported - reconstructed at runtime)

  ### Runtime Phase

  1. **Data Loading**
     - Browser: font-registry.js → FontManifest → FontLoader instance → loadFonts() → Promise-based loading
     - Node.js: FontLoader instance → loadFonts() → Synchronous fs-based loading
     - Loading order: Metrics FIRST (required), then Atlases
     - Atlas reconstruction: Atlas JS → registerAtlasPackage() → TightAtlasReconstructor.reconstructFromAtlas() → Tight Atlas + AtlasPositioning → AtlasData → Store

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
  3. Draw character-specific rectangle using actualBoundingBox (not font-wide fontBoundingBox):
     - Width: actualBoundingBoxLeft + actualBoundingBoxRight (scaled by pixelDensity)
     - Height: actualBoundingBoxAscent + actualBoundingBoxDescent (scaled by pixelDensity)
     - Makes 'a' shorter than 'A', shows descenders on 'g', etc.
  4. Position at baseline using character metrics positioning
  5. Skip space characters (invisible placeholders)

  ### Baseline Positioning

  BitmapText supports all six HTML5 Canvas textBaseline values by converting user's chosen baseline to the internal "bottom" baseline reference.

  **Internal Architecture:**
  All glyph dy offsets are pre-calculated during font generation assuming y-coordinate is at the "bottom" of the em square (src/builder/AtlasPositioningFAB.js:96). At runtime, BitmapText converts user's chosen baseline to this internal reference before applying dy offsets.

  **Conversion Algorithm (src/runtime/BitmapText.js:#calculateBaselineOffsetToBottom):**

  All calculations in CSS pixels, relative to alphabetic baseline (ab = 0):

  ```javascript
  baselineOffset = switch (textBaseline) {
    'top':         fontBoundingBoxAscent + fontBoundingBoxDescent
    'hanging':     hangingBaseline + fontBoundingBoxDescent
    'middle':      (fontBoundingBoxAscent + fontBoundingBoxDescent) / 2
    'alphabetic':  fontBoundingBoxDescent
    'ideographic': fontBoundingBoxDescent + ideographicBaseline  // ib is negative, so this subtracts
    'bottom':      0  // No conversion needed
  }

  y_internal = y_user + baselineOffset
  ```

  **Baseline Data Source:**

  Baseline measurements are captured automatically during font generation:
  1. **Capture (src/builder/GlyphFAB.js:84):** Browser's `ctx.measureText()` returns TextMetrics with all baseline properties
  2. **Storage (src/builder/MetricsMinifier.js:29-41):** Extracted from first character to minimize file size (~2.5KB savings per font)
  3. **Minification:** Stored in `b` object: `{fba, fbd, hb, ab, ib, pd}` in metrics-*.js files
  4. **Expansion (src/builder/MetricsExpander.js:63-70):** Copied to every character's metrics for convenient access
  5. **Usage:** Available via `characterMetrics.fontBoundingBoxAscent/Descent`, `hangingBaseline`, `ideographicBaseline`

  **Coordinate System:**
  - y-coordinate increases downward (Canvas convention)
  - Alphabetic baseline is the reference point (ab = 0)
  - fontBoundingBoxAscent is positive (upward from alphabetic)
  - fontBoundingBoxDescent is positive (downward from alphabetic)
  - hangingBaseline is positive (upward from alphabetic)
  - ideographicBaseline is typically negative (downward from alphabetic)

  **Performance:**
  - Baseline calculation: O(1), ~5-10 arithmetic operations per drawTextFromAtlas call
  - Baseline offset calculated once per text string (not per character)
  - No caching needed due to trivial computation cost

  **Demo:**
  See public/baseline-alignment-demo.html for visual demonstration of all baselines.

  ### Text Alignment

  BitmapText supports three horizontal text alignment modes (left, center, right) by calculating an x-offset based on measured text width.

  **Internal Architecture:**
  All text rendering uses "left" alignment internally (characters are positioned starting from x-coordinate and advancing rightward). At runtime, BitmapText converts user's chosen alignment to this internal reference by measuring text width and applying an offset.

  **Conversion Algorithm (src/runtime/BitmapText.js:#calculateAlignmentOffsetToLeft):**

  All calculations in CSS pixels:

  ```javascript
  // Step 1: Measure text width (respects kerning if enabled)
  const measureResult = BitmapText.measureText(text, fontProperties, textProperties);
  const textWidth = measureResult.metrics.width;

  // Step 2: Calculate alignment offset
  alignmentOffset = switch (textAlign) {
    'left':   0                  // No offset needed (internal reference)
    'center': -textWidth / 2     // Shift left by half width
    'right':  -textWidth         // Shift left by full width
  }

  // Step 3: Apply offset to x-coordinate
  x_internal = x_user + alignmentOffset
  ```

  **Text Width Measurement:**
  - Uses existing `measureText()` method (src/runtime/BitmapText.js:209-313)
  - Accounts for character widths and kerning corrections (if enabled)
  - Returns status code for error handling (missing glyphs, no metrics, etc.)
  - Measurement respects same textProperties used for rendering (ensures consistency)

  **Error Handling:**
  - If `measureText()` fails (missing glyphs, no metrics):
    - Alignment defaults to 'left' (alignmentOffset = 0)
    - Warning logged to console
    - Text still renders but without requested alignment
    - Graceful degradation ensures partial functionality

  **Performance:**
  - One additional `measureText()` call per `drawTextFromAtlas()` when alignment != 'left'
  - measureText is O(n) in text length: iterates through characters, sums widths and kerning
  - Typical overhead: ~20-50μs for 10-20 character strings
  - No caching needed (calculation is fast, measurement changes with textProperties/kerning)
  - 'left' alignment skips measurement entirely (zero overhead for default case)

  **Integration with Baseline Positioning:**
  Both alignment (x-axis) and baseline (y-axis) offsets are calculated before rendering:
  ```javascript
  // src/runtime/BitmapText.js:408-439
  const baselineOffset_CssPx = calculateBaselineOffsetToBottom(...);     // y-axis
  const alignmentOffset_CssPx = calculateAlignmentOffsetToLeft(...);     // x-axis

  const position_PhysPx = {
    x: (x_CssPx + alignmentOffset_CssPx) * pixelDensity,
    y: (y_CssPx + baselineOffset_CssPx) * pixelDensity
  };
  ```

  **Coordinate System:**
  - x-coordinate increases rightward (Canvas convention)
  - Negative offset shifts text leftward (for center/right alignment)
  - All calculations in CSS pixels before scaling to physical pixels

  **Demo:**
  See public/baseline-alignment-demo.html for visual demonstration showing all baseline and alignment combinations.

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

  **Font Metrics Minification (src/builder/MetricsMinifier.js)**:
  1. **Dynamic Base Metrics**: Uses first available character for base font metrics extraction
  2. **Nested Structure Flattening**: Converts multi-level font property objects to flat arrays
  3. **Data Deduplication**: Removes redundant entries across similar font configurations
  4. **Property Name Shortening**: Optimizes repeated font family/style/weight combinations

  **Font Metrics Expansion (src/builder/MetricsExpander.js)**:
  1. **Array to Object Mapping**: Rebuilds nested property structures
  2. **Property Reconstruction**: Restores font property hierarchies
  3. **Metrics Expansion**: Reconstructs full glyph metrics from minified data
  4. **Essential Property Validation**: Verifies key metrics are preserved during roundtrip

  **Atlas Reconstruction Utilities (src/builder/AtlasReconstructionUtils.js)**:
  1. **Image Data Extraction**: Central utility used by TightAtlasReconstructor for atlas image processing
  2. **getImageData()**: Extracts ImageData from Canvas/Image/AtlasImage with environment detection (document.createElement in browser, Canvas class in Node.js)
  3. **Cross-Platform Support**: Works in both browser and Node.js environments
  4. **Single Source of Truth**: Eliminates code duplication for image data access

  **Current Export Format: Atlas-Based Serialization**:
  1. **Export Format**: Atlas image (QOI/PNG) only - NO positioning data serialized
  2. **Atlas Format**: Variable-width cells (actualBoundingBox width × fontBoundingBox height)
  3. **File Size Reduction**: ~69% reduction (4.9KB → 1.5KB per font)
  4. **Runtime Reconstruction**: TightAtlasReconstructor converts Atlas → Tight Atlas + AtlasPositioning
  5. **Dependency**: Requires FontMetrics for cell dimension calculation
  6. **Reconstruction Cost**: ~10-15ms one-time cost per font at load time

  **PNG Base64 Header Stripping (Browser Optimization)**:
  1. **Predictable Header**: All PNG files (width < 65,536) start with identical 18-byte signature + IHDR header
  2. **Base64 Encoding**: These 18 bytes encode to "iVBORw0KGgoAAAANSUhEUgAA" (24 characters)
  3. **Stripping Process**: scripts/strip-png-base64-header.js removes this prefix from atlas-*-png.js files
  4. **Runtime Restoration**: src/platform/FontLoader-browser.js prepends header when loading (line ~114)
  5. **File Size Savings**: ~24 bytes per PNG atlas file (scales with number of font configurations)
  6. **Backwards Compatible**: Runtime checks for header presence, only adds if missing
  7. **Node.js Unaffected**: Only applies to PNG files used in browsers; Node.js uses QOI format

  ## Memory Management

  Optimized for minimal memory footprint and efficient access:

  - **Shared Resources**: Single temporary canvas reused for all color operations
  - **Lazy Loading**: Glyph atlases loaded on-demand when first accessed
  - **Automatic Cleanup**: Font assets building-time data structures cleared after font building
  - **Canvas Reuse**: BitmapText instances reuse coloredGlyphCanvas for all glyphs
  - **Float Position Tracking**: Position coordinates tracked as floats to avoid rounding error accumulation
  - **Integer Draw Coordinates**: Coordinates rounded to integers only at final draw stage (drawImage/fillRect) for crisp, pixel-aligned rendering
  - **Minimal DOM**: Only necessary canvases attached to document during rendering

  ## Performance Optimizations

  1. **Pre-computed Metrics**: All measurements calculated at font assets building time
  2. **Batch Rendering**: Multiple glyphs drawn from single atlas
  3. **Pixel-Aligned Rendering**: Coordinates rounded at draw stage for crisp rendering without subpixel antialiasing
  4. **Minimal DOM Operations**: Reuses canvases

  ## Sequence Diagrams

  ### Font Assets Building Workflow
  ```
  User → public/font-assets-builder.html → BitmapTextFAB → AtlasDataStoreFAB
    1. Load character set configuration (src/builder/character-set.js → 217 characters)
    2. Load font specifications (src/specs/default-specs.js)
    3. Parse specs (src/specs/SpecsParser.parseSubSpec:98)
    4. Create individual glyph canvases (src/builder/create-glyphs.js → GlyphFAB 6-step pipeline per character):
       a. Canvas creation + configuration
       b. Character measurement
       c. Specs corrections application
       d. Dimension configuration
       e. Character rendering
       f. Canvas preservation
    5. Apply tight bounding box detection (GlyphFAB pixel scanning)
    6. Calculate kerning tables (KerningCalculator using character set)
    7. Build optimized atlases (AtlasBuilder → variable-width cells)
    8. Generate minified metadata (MetricsMinifier)
    9. Export metrics-*.js files + atlas-*-qoi.js/png.js files + font-registry.js
  ```

  ### Runtime Font Loading Workflow (Static API)
  ```
  Browser (uses src/platform/FontLoader-browser.js):
    User → BitmapText.loadFonts(IDStrings, options)
      1. BitmapText delegates to FontLoader (platform-specific, included at build time)
      2. For each IDString: FontLoader.loadFont(IDString, bitmapTextClass)
      3. Load metrics: Create <script> tag → Await load → metrics file calls BitmapText.registerMetrics()
         → BitmapText.registerMetrics() delegates to FontMetricsStore.setFontMetrics()
      4. Load atlas: Delegates to loadAtlasFromJS() or loadAtlasFromPNG()
         - loadAtlasFromPNG(): Create <img> → Await load → TightAtlasReconstructor → store in AtlasDataStore
         - loadAtlasFromJS(): Create <script> → Await load → atlas file calls BitmapText.registerAtlas()
         → BitmapText.registerAtlas() delegates to AtlasDataStore.setAtlasData()
      5. Progress callbacks fire for each file (optional)
      6. Return Promise when complete

  Node.js (uses src/platform/FontLoader-node.js):
    User → BitmapText.configure({ fontDirectory, canvasFactory }) → BitmapText.loadFonts(IDStrings, options)
      1. BitmapText delegates to FontLoader (platform-specific, included at build time)
      2. For each IDString: FontLoader.loadFont(IDString, bitmapTextClass)
      3. Load metrics: fs.readFileSync() → eval with BitmapText in scope → calls BitmapText.registerMetrics()
         → BitmapText.registerMetrics() delegates to FontMetricsStore.setFontMetrics()
      4. Load atlas: fs.readFileSync() → QOI decode → TightAtlasReconstructor → store in AtlasDataStore
      5. Progress callbacks fire synchronously (optional)
      6. Return immediately (synchronous)

  Data Storage Flow:
    FontLoader (platform-specific) → FontLoaderBase → TightAtlasReconstructor → AtlasDataStore/FontMetricsStore
    BitmapText public API (registerMetrics/registerAtlas) → Delegates to stores
    Internal BitmapText methods (measureText/drawTextFromAtlas) → Query stores directly

  Self-Registration (Alternative):
    Browser → Load font asset scripts directly:
      <script src="font-assets/metrics-*.js"></script>  // Calls BitmapText.registerMetrics() → FontMetricsStore
      <script src="font-assets/atlas-*-qoi.js"></script> // Calls BitmapText.registerAtlas() → AtlasDataStore
    → Font data auto-registered in stores, ready to use immediately
  ```

  ### Runtime Text Rendering Workflow (Static API)
  ```
  User → BitmapText.drawTextFromAtlas(ctx, text, x, y, fontProperties, textProperties)
    1. Convert text to code point array ([...text])
    2. Get FontMetrics from FontMetricsStore
    3. Get AtlasData from AtlasDataStore
    4. For each character:
       a. Get glyph metrics from FontMetrics
       b. Create colored glyph (internal method)
       c. Render to canvas at position
       d. Calculate advancement with kerning
    5. Return { rendered, status }

  Storage Query Flow:
    BitmapText.measureText() → FontMetricsStore.getFontMetrics()
    BitmapText.drawTextFromAtlas() → FontMetricsStore.getFontMetrics() + AtlasDataStore.getAtlasData()
  ```

  ## Extension Points

  ### Custom Glyph Sources
  Override `src/builder/GlyphFAB.createCanvasesAndCharacterMetrics()`

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