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

### Font-Invariant Character Auto-Redirect System

**Design Decision:** Special Unicode font-invariant characters automatically render using BitmapTextInvariant font regardless of specified base font.

**Problem:**
Different fonts render the same Unicode characters with different metrics and styles. For UI consistency, font-invariant characters like ✔✘☺ should look identical regardless of whether text is in Arial, Georgia, or Courier.

**Solution:**
Introduce a dedicated font-invariant font (BitmapTextInvariant) that uses Courier New for rendering, ensuring monospaced, consistent font-invariant character appearance. At runtime, transparently redirect font-invariant characters to this font during rendering.

**Implementation:**

1. **Build-time Character Set Selection** (src/builder/create-glyphs.js):
```javascript
function createGlyphsAndAddToFullStore(fontProperties) {
  let characterSet;
  if (fontProperties.fontFamily === 'BitmapTextInvariant') {
    characterSet = BitmapText.FONT_INVARIANT_CHARS;  // 18 symbols
  } else {
    characterSet = BitmapText.CHARACTER_SET;  // 204 standard chars
  }
  // Generate glyphs for appropriate character set
}
```

2. **Runtime Fast Symbol Detection** (src/runtime/BitmapText.js):
```javascript
// Pre-defined symbol string (18 characters)
static FONT_INVARIANT_CHARS = '☺☹♠♡♦♣│─├└▶▼▲◀✔✘≠↗';

// Fast detection using string.includes() (~1-2ns)
static #isInvariantCharacter(char) {
  return BitmapText.FONT_INVARIANT_CHARS.includes(char);
}

// In rendering loop
const isSymbol = hasInvariantFont && BitmapText.#isInvariantCharacter(currentChar);
if (isSymbol && currentFontProps !== invariantFontProps) {
  currentFontProps = invariantFontProps;
  currentFontMetrics = invariantFontMetrics;
  currentAtlasData = invariantAtlasData;
}
```

**Architecture Decisions:**

1. **Inline Fast-Path Detection**: Uses `string.includes()` on 18-character string rather than Set or Map
   - **Rationale**: ~1-2ns lookup is negligible in rendering loop, no memory allocation overhead
   - **Trade-off**: Linear search vs O(1) hash lookup - 18 characters is small enough for linear to win

2. **Pre-fetch Symbol Font Once**: Symbol font properties/metrics/atlas fetched before rendering loop
   - **Rationale**: Avoids repeated lookups when switching between base font and symbol font
   - **Trade-off**: Small memory overhead vs performance in hot loop

3. **Courier New Override**: BitmapTextInvariant uses Courier New as rendering font (src/builder/GlyphFAB.js)
   - **Rationale**: Ensures monospacing and consistent metrics across platforms
   - **Trade-off**: Symbols don't match base font style, but consistency is more important

4. **Explicit Character Set (No Registry)**: Symbol fonts specified with custom character sets in font spec JSON
   - **Rationale**: Simple, explicit, no runtime registration needed
   - **Previous approach**: CharacterSetRegistry class (removed in commit 6890fe9) - unnecessary complexity

**User Impact:**

```javascript
// User specifies Arial, but ✔ renders using BitmapTextInvariant automatically
const fontProps = new FontProperties(1, "Arial", "normal", "normal", 19);
BitmapText.drawTextFromAtlas(ctx, "Task done ✔", 10, 50, fontProps);
// "Task done " → Arial metrics/atlas
// "✔" → BitmapTextInvariant metrics/atlas (automatic)
```

**Requirements:**
- BitmapTextInvariant must be loaded at same pixel density and size as base font
- If symbol font not loaded, symbols render using base font (degraded experience)
- Symbol font only supports normal style/weight

**Performance:**
- Symbol detection: ~1-2ns per character (string.includes() on 18 chars)
- Font switching: Single pointer reassignment (no allocation)
- Negligible impact on rendering hot loop

**Character Set:**
The 18 symbols were selected for common UI/text needs:
- Smiley faces: ☺☹
- Card suits: ♠♡♦♣
- Box drawing: │─├└
- Arrows/triangles: ▶▼▲◀
- Check/cross: ✔✘
- Math/arrow: ≠↗

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
    - Symbol auto-redirect: Detects symbol characters during rendering and switches to BitmapTextInvariant font
    - Platform-specific FontLoader detection: Checks for `FontLoader` class from src/platform/
    - Canvas creation: Auto-creates in browser, uses canvasFactory in Node.js
  - Internal Fields (private):
    - `#fontLoader`: Platform-specific FontLoader instance (lazy-initialized on first use)
    - `#canvasFactory`: Canvas creation function (optional override, platform-specific defaults)
    - `#coloredGlyphCanvas`: Shared scratch canvas for coloring glyphs (lazy-initialized)
    - `#coloredGlyphCtx`: 2D context for scratch canvas (lazy-initialized)
    - Storage: ALL font data delegated to AtlasDataStore and FontMetricsStore (stores are the single source of truth)
    - Symbol font detection: `FONT_INVARIANT_CHARS` static constant (18 symbols), `#isInvariantCharacter()` fast detection helper
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
    - `_yInAtlas`: Vertical positions in atlas
  - Current Export Format:
    - NO positioning data serialized (100% reconstruction at runtime)
    - All 6 properties reconstructed by TightAtlasReconstructor from Atlas image
    - Atlas format (variable-width cells in grid layout) provides all information needed for reconstruction
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

  **FontMetrics**
  - Purpose: Immutable domain object encapsulating all metrics for one font configuration
  - Architecture: Eliminates fontProperties parameter passing throughout the codebase, provides clean API for metrics access
  - Data structures:
    - `_characterMetrics`: Map of character → TextMetrics-compatible objects (width, ascent, descent, bounding boxes)
    - `_kerningTable`: Map of character pairs → adjustment values (in 1/1000 em units)
    - `_spaceAdvancementOverride`: Special spacing rules for small font sizes
  - Methods:
    - `getCharacterMetrics(char)`: Get TextMetrics-compatible object for a character
    - `getKerningAdjustment(leftChar, rightChar)`: Get kerning adjustment between character pair
    - `hasGlyph(char)`: Check if character exists in this font
    - `getAvailableCharacters()`: List all characters with metrics
    - `getSpaceAdvancementOverride()`: Get space override value (for small sizes)
  - Used by: BitmapText.measureText(), BitmapText.drawTextFromAtlas()

  **InterpolatedFontMetrics**
  - Purpose: Memory-efficient font metrics for sizes < 8.5px via automatic interpolation
  - Architecture: Extends FontMetrics with lazy metric scaling from size 8.5px base
  - Key insight: Rendering very small text (< 8.5px) as pixel-perfect bitmaps provides minimal visual benefit while consuming significant memory. Instead, interpolate metrics from 8.5px and render as placeholder rectangles.
  - Behavior:
    - Sizes < 8.5px: Creates InterpolatedFontMetrics wrapping 8.5px base metrics, scales all measurements by (requestedSize / 8.5)
    - Size 8.5px and above: Uses regular FontMetrics (no interpolation)
    - Atlases never loaded for interpolated sizes (placeholder mode always used)
  - Benefits:
    - Memory savings: Only one metrics file needed (8.5px) instead of separate files for 0, 0.5, 1, 1.5, ..., 8px
    - Accurate measurements: Text width/height calculations work correctly with scaled metrics
    - Graceful rendering: Placeholder rectangles show correct text bounds even at tiny sizes
  - Methods (same interface as FontMetrics):
    - `getCharacterMetrics(char)`: Returns scaled metrics (width, ascent, descent all multiplied by scale factor)
    - `getKerningAdjustment(leftChar, rightChar)`: Returns scaled kerning values
    - `hasGlyph(char)`: Delegates to base metrics
    - `getAvailableCharacters()`: Delegates to base metrics
    - `getSpaceAdvancementOverride()`: Returns scaled space override
  - Usage: Created automatically by FontMetricsStore when size < 8.5px is requested
  - File: `src/runtime/InterpolatedFontMetrics.js`

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
    - Image element loading for WebP atlases (http://)
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

  **Character Set Constant (BitmapText.CHARACTER_SET)**
  - Defines the complete set of supported characters (shared by build-time and runtime)
  - Implemented as static property of BitmapText class in src/runtime/BitmapText.js
  - Programmatically generates character set from multiple ranges:
    - ASCII printable characters (32-126): space, numbers, letters, common symbols
    - Windows-1252 (CP-1252) subset (128-159): commonly used extended ASCII symbols (€, •, —, ™, etc.)
    - Latin-1 Supplement (161-255): accented characters, excluding soft hyphen (U+00AD)
    - Full Block character (█): visual reference for maximum glyph space
  - Implementation: Private static method `#generateCharacterSet()` creates sorted character string
  - Accessible as: `BitmapText.CHARACTER_SET` (used by build-time: create-glyphs.js, KerningCalculator, MetricsMinifier; runtime: MetricsExpander)
  - Character count: 204 characters (all font files must contain all 204 characters)
  - Distribution: Part of BitmapText class, used by both build-time and runtime

  **Glyph Creation Utilities (src/builder/create-glyphs.js)**
  - Orchestrates glyph creation for all characters in character set
  - Function: `createGlyphsAndAddToFullStore(fontProperties)`
  - Character set selection based on font family:
    - BitmapTextInvariant: Uses `BitmapText.FONT_INVARIANT_CHARS` (18 symbols)
    - All other fonts: Uses `BitmapText.CHARACTER_SET` (204 standard characters)
  - Iterates through selected character set and creates GlyphFAB instance for each character
  - Stores created glyphs in AtlasDataStoreFAB for subsequent atlas building
  - Depends on: BitmapText.CHARACTER_SET, BitmapText.FONT_INVARIANT_CHARS, GlyphFAB, AtlasDataStoreFAB
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

  **StatusCode (src/runtime/StatusCode.js)**
  - Purpose: Centralized status code system for error reporting and success handling
  - Architecture: Global constants and factory functions for structured status information
  - Status Codes:
    - `SUCCESS = 0`: Operation completed successfully
    - `NO_METRICS = 1`: Font metrics not available
    - `PARTIAL_METRICS = 2`: Some characters missing metrics
    - `NO_ATLAS = 3`: Atlas image not available (placeholder mode)
    - `PARTIAL_ATLAS = 4`: Some characters missing from atlas
  - Factory Functions:
    - `createSuccessStatus()`: Create success status object
    - `createErrorStatus(code, data)`: Create error status with optional data
  - Helper Functions:
    - `isSuccess(status)`, `isCompleteFailure(status)`, `isPartialSuccess(status)`, `getStatusDescription(status)`
  - Used by: BitmapText.measureText(), BitmapText.drawTextFromAtlas(), FontLoader methods
  - Distribution: Core runtime constant, must be loaded before BitmapText.js in browser script tags

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
  - Grid layout with dynamic dimensions calculated from character count (sqrt-based for square-ish shape)
  - Grid prevents exceeding WebP 16,384px dimension limit for large fonts at high pixel densities
  - Maintains sorted character order for determinism
  - Used by font-assets-builder.html to generate atlas source for reconstruction
  - API: `buildAtlas(fontMetrics, glyphs)` - fontMetrics first for consistency

  **TightAtlasReconstructor**
  - Runtime class for reconstructing tight atlases from Atlas format via pixel scanning
  - Scans grid-layout atlas cells to extract tight glyph bounds
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
     Character Set (BitmapText.CHARACTER_SET) → 204 characters defined
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
     Text String → Measure → Apply Kerning → Copy Glyphs → Apply Color (fast path for black, composite for colors)
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

  Two rendering paths for optimal performance:

  **Fast Path (Black Text #000000):**
  1. Draw glyph directly from atlas to main canvas (single drawImage operation)
  2. No temporary canvas or composite operations needed
  3. 2-3x faster than colored text rendering

  **Slow Path (Colored Text):**
  Uses Canvas composite operations:
  1. Draw glyph from atlas to temporary canvas
  2. Apply 'source-in' composite mode
  3. Fill with target color
  4. Copy colored glyph to main canvas

  Implementation: src/runtime/BitmapText.js:#drawCharacter checks textColor and selects path accordingly

  ### Placeholder Rendering

  When atlases are missing but metrics are available:
  1. Validate atlas using `isValidAtlas()`
  2. Fall back to placeholder rectangle mode
  3. Draw character-specific rectangle using actualBoundingBox (not font-wide fontBoundingBox):
     - Width: actualBoundingBoxLeft + actualBoundingBoxRight (scaled by pixelDensity)
     - Height: actualBoundingBoxAscent + actualBoundingBoxDescent (scaled by pixelDensity)
     - X position: position.x - actualBoundingBoxLeft (accounts for left protrusion, e.g., italic 'f')
     - Y position: position.y - fontBoundingBoxDescent - actualBoundingBoxAscent (from bottom baseline)
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

  ## Image Format Strategy

  The system uses different formats optimized for each platform:

  **Browser Export (QOI)**:
  - Tools/export-font-data.js exports QOI format from canvas
  - QOI provides simple, portable export format
  - Minimal dependencies (~200 line encoder)

  **Browser Delivery (WebP)**:
  - Pipeline converts: QOI → PNG (intermediate) → WebP (final)
  - WebP (lossless) provides best compression (5-10% smaller than PNG)
  - Native browser support (Safari 14+, Chrome, Firefox, Edge)
  - No header optimization needed (unlike PNG)

  **Pipeline Conversion**:
  1. **QOI → PNG** (scripts/qoi-to-png-converter.js):
     - Decode QOI using QOIDecode library
     - Convert to PNG for ImageOptim processing

  2. **PNG → WebP** (scripts/convert-png-to-webp.sh):
     - Convert with cwebp: `cwebp -lossless -z 9 -m 6 -mt`
     - Delete source PNG files after conversion
     - Lossless compression (pixel-identical)

  3. **WebP → JS** (scripts/image-to-js-converter.js --webp):
     - Wrap in JS for file:// protocol compatibility

  **Node.js (QOI)**:
  - Direct QOI loading without conversion
  - QOI files preserved for Node.js usage
  - Lightweight decoder, no external dependencies

  **Benefits**:
  - **Browser**: WebP lossless, 8% smaller, modern standard
  - **Node.js**: QOI direct loading, no dependencies
  - **Export**: QOI simple, portable, minimal encoder

  ## Data Minification/Expansion

  Font data is minified for efficient storage and network transfer using seven-tier compression:

  **Font Metrics Minification (src/builder/MetricsMinifier.js)**:
  - **Tier 1: Property Name Shortening** - Reduces JSON key names (e.g., `fontBoundingBoxAscent` → `fba`)
  - **Tier 2: Array-Based Glyph Encoding** - Converts character metrics from objects to arrays (removes character keys, uses position instead)
  - **Tier 3: Two-Dimensional Kerning Compression** - Compresses kerning table using range notation (e.g., `{"A":{"s":20},"B":{"s":20}}` → `{"A-B":{"s":20}}`)
  - **Tier 4: Value Indexing** - Two-part optimization replacing repeated values with indices into lookup tables:
    - **Glyph Value Indexing** - 'v' field (glyph value lookup) + 'g' field contains indices, achieving ~52.7% reduction in glyph data size
    - **Kerning Value Indexing** - 'kv' field (kerning value lookup) + 'k' field contains indices, achieving ~51.0% reduction in kerning data size
  - **Tier 5: Tuplet Deduplication** - Two-part optimization combining pattern compression with tuplet indexing:
    - **Tier 5a: Variable-Length Tuplet Compression** - Exploits redundancy patterns in glyph metrics:
      - **Case C (3 elements)**: `[w, l, a]` when width_idx === right_idx AND left_idx === descent_idx (~40% of glyphs)
      - **Case B (4 elements)**: `[w, l, a, d]` when width_idx === right_idx only (~30% of glyphs)
      - **Case A (5 elements)**: `[w, l, r, a, d]` no compression when width_idx ≠ right_idx (~30% of glyphs)
      - **Decompression**: Deterministic based on array length (no flags needed)
    - **Tier 5b: Tuplet Indexing** - Deduplicates tuplet arrays by storing unique tuplets once:
      - **Scoring Algorithm**: `score = JSON.stringify(tuplet).length × occurrences`
      - **Index Assignment**: Highest-scoring tuplets get shortest indices (0-9 = 1 char, 10-99 = 2 chars)
      - **Format Change**: 't' field (unique tuplet lookup array) + 'g' field (single integer indices, not arrays)
      - **Real-World Results**: 204 glyphs → ~61 unique tuplets (70% deduplication)
      - **Example**: Tuplet `[0,3,0,2,1]` appearing 50 times: before 550 chars (50×11), after 61 chars (11 + 50×1) = 89% saved
    - **Combined Savings**: ~1,124 bytes per font (~55% reduction on glyph data)
  - **Tier 6c: Binary Encoding Optimization** - Final compression tier using binary encoding for maximum efficiency:
    - **Multi-Parameter Font ID** - Replaces string ID with multiple parameters in registration call:
      - **Format**: `BitmapText.r(1,'Arial',0,0,18,[data])`
      - **Style/Weight Encoding**: `styleIdx` (0=normal, 1=italic, 2=oblique), `weightIdx` (0=normal, 1=bold, or numeric)
      - **Savings**: ~10 bytes per file
    - **Configurable 2-Element Tuplet Compression** - Adds most-frequent-left-index optimization:
      - **Common Left Detection**: Finds most common left bounding box value (typically 0, appears in ~92% of glyphs)
      - **4-Level Cascading Compression** (most-frequent-first):
        - **Case D (2 elements)**: `[w, a]` when w===r AND l===d AND l===common (~43% of glyphs)
        - **Case C (3 elements)**: `[w, l, a]` when w===r AND l===d
        - **Case B (4 elements)**: `[w, l, a, d]` when w===r
        - **Case A (5 elements)**: `[w, l, r, a, d]` no compression
      - **Negative Delimiter Encoding**: Tuplets flattened with negative last element marking boundaries
        - **Index Shift**: All indices shifted by 1 (0→1) to avoid `-0` JSON problem
        - **Format**: `[3,2,-15,1,2,16,-8]` represents two tuplets: `[2,1,14]` and `[0,1,15,7]`
        - **Trade-off**: Only 9 "short index" slots (1-9) instead of 10, but saves ~110 bytes vs length-prefix
      - **File Format**: 8-element array with common left index (`cl`) as last element
    - **Advanced Kerning Compression** - Groups all characters with same value (not just consecutive):
      - **Non-Sequential Grouping**: `{"T":{" ":1,",":1,".":1,"a":1,"c":1,"d":1,"e":1}}` → `{"T":{" ,.ac-e":1}}`
      - **Compact Notation**: Dash-at-start = literal dash, dash-in-middle = range delimiter
      - **Example**: `"-,.:;ac-egj-s"` = literal dash + individual chars + ranges
    - **Binary Encoding (A1+A2)** - Base64-encoded binary data for maximum compression:
      - **Tuplet Indices** - Byte-encoded array (each index 0-255 becomes 1 byte), then base64
        - **Before**: `[127,76,108,...]` = 593 bytes JSON
        - **After**: `"f0xsXTs8..."` = ~270 bytes base64
        - **Savings**: ~320 bytes per file (54% reduction)
      - **Flattened Tuplets** - VarInt+zigzag encoding, then base64
        - **Zigzag Encoding**: Handles negative delimiters (0→0, -1→1, 1→2, -2→3, 2→4)
        - **VarInt Encoding**: Small values (0-127) = 1 byte, larger values = 2+ bytes with continuation bit
        - **Before**: `[1,2,7,-8,...]` = 1,209 bytes JSON
        - **After**: `"AgQODwIEKBMG..."` = ~600-700 bytes base64
        - **Savings**: ~500 bytes per file (40-50% reduction)
        - **Key Insight**: 54-58% of values are 1-10, encoded in just 1 byte
    - **Combined Tier 6c Savings**: ~2,689 bytes average (~31% reduction from Tier 6b, ~69% from original)
  - **Tier 7: Value Array Delta Encoding** - Compresses glyph value lookup array using base64+delta encoding:
    - **Magnitude Sorting**: Values sorted ascending for optimal delta compression (0, 156, 1563, 1875...)
      - **Delta Efficiency**: Sorted deltas average ~2,100 (vs ~88,000 for unsorted)
      - **Key Change**: Replaces frequency-based sorting with magnitude sorting
    - **Delta Encoding**: First value absolute, subsequent values as differences
      - **Example**: `[0, 156, 1563]` → deltas: `[0, 156, 1407]`
    - **VarInt + Base64**: Uses existing zigzag+varint infrastructure, then base64 encode
      - **Before**: `[100107,0,120059,...]` = ~655 bytes JSON array
      - **After**: `"ALgC1A6qB/AE..."` = ~288 bytes base64 string
      - **Savings**: ~365 bytes per file (55.7% reduction on value array)
    - **Format Change**: Element [3] changes from array to base64 string
    - **Index Mapping**: Tuplet indices correctly reference magnitude-sorted positions (0=smallest value)
    - **Combined Tier 7 Savings**: ~307 bytes average per file (16.5% reduction from Tier 6c)
  - **Common Metrics Extraction** - Extracts shared font metrics (fontBoundingBox, baselines, pixelDensity) to avoid repetition
  - **Roundtrip Verification** - `minifyWithVerification()` method automatically verifies compress→expand integrity at build time
  - **Format Requirements** - All 204 characters from BitmapText.CHARACTER_SET must be present (no legacy format support)
  - **Total File Size** - Average ~1,560 bytes per font file (97.9% reduction from ~73KB original)

  **Value Indexing Algorithm (Tier 4)**:
  - **Glyph Values (Tier 7 Update)** - Magnitude-sorted for optimal delta encoding:
    - **Sorting Strategy**: Values sorted ascending by magnitude (0, 156, 1563, 1875...)
    - **Index Assignment**: Index = position in sorted array (0=smallest, 1=next smallest, ...)
    - **Rationale**: Enables efficient delta compression in Tier 7 (~2K avg deltas vs ~88K unsorted)
    - **Trade-off Analysis**: Magnitude sorting saves ~365 bytes on value array with no cost to tuplet indices
  - **Kerning Values** - Frequency-sorted for optimal index compression:
    - **Score Calculation**: `score = occurrences × string_length`
    - **Index Assignment**: Highest-scoring values get shortest indices (0-9 = 1 char, 10-99 = 2 chars)
    - **Rationale**: Kerning values remain as JSON array (not delta-encoded), so small indices save space
    - **Example**: Value `50` appearing 46 times: before 92 chars (46×2), after 18 chars (2 lookup + 46×1 index) = 74 chars saved
  - **Format** - Minified data includes:
    - 'kv' field: kerning value lookup array (frequency-sorted)
    - 'k' field: kerning table with indexed values
    - 'v' field: glyph value lookup (Tier 7: base64 delta-encoded string, Tier 6c: magnitude-sorted array)
    - 'g' field: glyph arrays with indexed values
  - **Real-World Performance** - Typical font:
    - Glyph values: ~108 unique from 862 total (12.5% uniqueness) → Tier 7: 55.7% compression on value array
    - Kerning values: ~5 unique from 107 total (4.7% uniqueness) → 51.0% compression

  **Font Metrics Expansion (src/builder/MetricsExpander.js)**:
  - **BitmapText.CHARACTER_SET-Based Ordering** - Always uses BitmapText.CHARACTER_SET for character order (all 204 characters in sorted order)
  - **Tier 7 Format** - Expects 8-element array format with backward compatibility for Tier 6c:
    - `[kv, k, b, v, t, g, s, cl]` where `t`, `g`, and `v` can be base64 strings
    - Element `v` handling:
      - **Tier 7**: Base64 string → decode VarInt → reconstruct deltas → magnitude-sorted array
      - **Tier 6c**: Array of integers (magnitude-sorted)
    - Throws error for any other format
  - **Multi-Parameter Registration** - `BitmapText.r(density, fontFamily, styleIdx, weightIdx, size, data)`:
    - 6 required parameters
    - Reconstructs full ID string from parameters automatically
  - **Binary Decoding** - Decodes base64-encoded binary data:
    - **Tuplet Indices**: Base64 → byte array (each byte = one index)
    - **Flattened Tuplets**: Base64 → VarInt decoding → zigzag decoding → signed integers
      - VarInt decoding: 7 bits per byte, MSB continuation bit
      - Zigzag decoding: 0→0, 1→-1, 2→1, 3→-2, 4→2
    - **Value Array (Tier 7)**: Base64 → VarInt decoding → delta reconstruction → magnitude-sorted array
      - Decodes base64 string to deltas: `[0, 156, 1407, ...]`
      - Reconstructs values: first value absolute, subsequent = previous + delta
      - Result: magnitude-sorted array `[0, 156, 1563, ...]` ready for index lookups
  - **Three-Pass Kerning Expansion** - Expands kerning in three passes:
    1. Left-side character range expansion (handles compact notation with dash-at-start)
    2. Right-side character range expansion
    3. Value lookup (replace indices with actual kerning values from 'kv' array)
  - **Negative Delimiter Unflattening** - Reconstructs tuplet arrays from flattened format:
    - Negative values mark tuplet boundaries
    - All indices shifted back by 1 (subtract 1 to restore 0-based indexing)
    - Example: `[3,2,-15,1,2,16,-8]` → `[[2,1,14],[0,1,15,7]]`
  - **Tuplet Lookup** - Reconstructs tuplet arrays from tuplet indices:
    1. Look up tuplet from 't' array using integer index from 'g' field
    2. Decompress variable-length tuplet based on array length (2/3/4/5 elements)
    3. Expand to full 5-element index array using common left index for 2-element case
  - **2-Element Tuplet Expansion** - Decompresses shortest format:
    - Input: `[w, a]` + common left index from 'cl' field
    - Output: `[w, cl, w, a, cl]` (left=cl, right=width, descent=cl)
  - **Glyph Value Lookup** - Reconstructs actual glyph metric values by looking up indices in 'v' array
  - **Array to Object Reconstruction** - Rebuilds full TextMetrics-compatible objects from indexed arrays
  - **Common Metrics Distribution** - Copies shared metrics (fontBoundingBox, baselines, pixelDensity) to each character
  - **Runtime Cost** - Minimal one-time expansion cost per font at load time (~1-2ms including binary decoding)

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
  2. **Black Text Fast Path**: Direct atlas-to-canvas rendering for default black color (#000000), bypassing temporary canvas and composite operations (2-3x faster than colored text)
  3. **Batch Rendering**: Multiple glyphs drawn from single atlas
  4. **Pixel-Aligned Rendering**: Coordinates rounded at draw stage for crisp rendering without subpixel antialiasing
  5. **Minimal DOM Operations**: Reuses canvases

  ## Sequence Diagrams

  ### Font Assets Building Workflow
  ```
  User → public/font-assets-builder.html → BitmapTextFAB → AtlasDataStoreFAB
    1. Load character set constant (BitmapText.CHARACTER_SET → 204 characters)
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
    9. Export metrics-*.js files + atlas-*-qoi.js files + font-registry.js (browser pipeline converts QOI → WebP)
  ```

  ### Runtime Font Loading Workflow (Static API)
  ```
  Browser (uses src/platform/FontLoader-browser.js):
    User → BitmapText.loadFonts(IDStrings, options)
      1. BitmapText delegates to FontLoader (platform-specific, included at build time)
      2. For each IDString: FontLoader.loadFont(IDString, bitmapTextClass)
      3. Load metrics: Create <script> tag → Await load → metrics file calls BitmapText.registerMetrics()
         → BitmapText.registerMetrics() delegates to FontLoaderBase.registerMetrics()
         → FontLoaderBase uses MetricsExpander.expand() to restore full metrics
         → FontMetricsStore.setFontMetrics()
      4. Load atlas: Delegates to loadAtlasFromJS() or loadAtlasFromWebP()
         - loadAtlasFromWebP(): Create <img> → Await load → TightAtlasReconstructor → AtlasDataStore.setAtlasData()
         - loadAtlasFromJS(): Create <script> → Await load → atlas file calls BitmapText.registerAtlas()
           → BitmapText.registerAtlas() reconstructs via TightAtlasReconstructor → AtlasDataStore.setAtlasData()
      5. Progress callbacks fire for each file (optional)
      6. Return Promise when complete

  Node.js (uses src/platform/FontLoader-node.js):
    User → BitmapText.configure({ fontDirectory, canvasFactory }) → BitmapText.loadFonts(IDStrings, options)
      1. BitmapText delegates to FontLoader (platform-specific, included at build time)
      2. For each IDString: FontLoader.loadFont(IDString, bitmapTextClass)
      3. Load metrics: fs.readFileSync() → eval with BitmapText in scope → calls BitmapText.registerMetrics()
         → BitmapText.registerMetrics() delegates to FontLoaderBase.registerMetrics()
         → FontLoaderBase uses MetricsExpander.expand() to restore full metrics
         → FontMetricsStore.setFontMetrics()
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
       b. Render glyph:
          - Fast path (black #000000): Draw directly from atlas (single operation)
          - Slow path (colors): Create colored glyph via composite operations
       c. Render to canvas at position
       d. Calculate advancement with kerning
    5. Return { rendered, status }

  Storage Query Flow:
    BitmapText.measureText() → FontMetricsStore.getFontMetrics()
    BitmapText.drawTextFromAtlas() → FontMetricsStore.getFontMetrics() + AtlasDataStore.getAtlasData()
  ```

  ## FontSetGenerator Architecture

  ### Design Purpose

  The FontSetGenerator is a general-purpose utility that provides memory-efficient generation of large font configuration sets from JSON specifications. It's designed for systematic testing, automated asset building, sample generation, exploratory rendering, and CI/CD pipelines that need to process thousands of font configurations.

  **Key Design Goals:**
  1. **Memory Efficiency**: Generate configurations on-demand rather than storing all instances
  2. **Declarative Specification**: JSON-based format for expressing complex font sets
  3. **Range Support**: Compact representation of numeric sequences (sizes, weights)
  4. **Multi-Set Union**: Combine different font families with different requirements

  ### Component Location

  - **Class**: `src/utils/FontSetGenerator.js` (general utility, not building-specific)
  - **Format Documentation**: `docs/FONT_SET_FORMAT.md`
  - **API Examples**: README.md (FontSetGenerator Class section)

  ### Architecture Pattern: Iterator with Lazy Generation

  **Problem**: Generating all font configurations upfront for large sets (10,000+ configs) would consume excessive memory.

  **Solution**: Iterator pattern with lazy generation - compute each FontPropertiesFAB instance only when requested.

  **Memory Usage:**
  - Pre-expansion: O(total_range_values) - Only expands numeric ranges into arrays
  - Iteration: O(1) - Generates one instance at a time
  - No bulk storage: Iterator state tracks array indices, not instances

  **Example:**
  ```
  Input:
    density: [1.0, 2.0]           → 2 values
    families: ["Arial"]           → 1 value
    styles: ["normal", "italic"]  → 2 values
    weights: [[100, 900, 100]]    → 9 values (expanded range)
    sizes: [[12, 24, 0.5]]        → 25 values (expanded range)

  Memory footprint:
    Pre-expanded arrays: 2 + 1 + 2 + 9 + 25 = 39 values
    Total configurations: 2 × 1 × 2 × 9 × 25 = 900 instances

  Without lazy generation: 900 FontProperties instances in memory
  With lazy generation: 39 values + iterator state + 1 current instance
  ```

  ### Data Structure Design

  **Input Structure (JSON):**
  ```json
  {
    "fontSets": [
      {
        "name": "optional",
        "density": [1.0, 2.0],
        "families": ["Arial"],
        "styles": ["normal", "italic"],
        "weights": ["normal", [400, 700, 100]],
        "sizes": [[12, 24, 0.5]]
      }
    ]
  }
  ```

  **Internal Structure (Expanded):**
  ```javascript
  {
    expandedSets: [
      {
        name: "optional",
        densities: [1.0, 2.0],
        families: ["Arial"],
        styles: ["normal", "italic"],
        weights: ["normal", 400, 500, 600, 700],
        sizes: [12, 12.5, 13, 13.5, ..., 24],
        count: 2 × 1 × 2 × 5 × 25 = 500
      }
    ],
    totalCount: 500
  }
  ```

  **Range Expansion Logic:**
  - Three-element numeric arrays `[start, stop, step]` are detected and expanded
  - Nested arrays are recursively flattened
  - Floating-point precision handled via rounding to 10 decimal places
  - Validation ensures start ≤ stop and step > 0

  ### Iterator Implementation

  **Cross-Product Generation:**
  The iterator generates the Cartesian product of all properties within each set.

  **Index Management:**
  ```javascript
  indices: {
    density: 0,
    family: 0,
    style: 0,
    weight: 0,
    size: 0    // Innermost dimension (increments fastest)
  }
  ```

  **Iteration Order (rightmost varies fastest):**
  ```
  For each density:
    For each family:
      For each style:
        For each weight:
          For each size:
            yield FontProperties(density, family, style, weight, size)
  ```

  **Multi-Set Union:**
  Sets are processed sequentially. When one set is exhausted, move to the next set and reset indices.

  **ES6 Iterator Protocol:**
  ```javascript
  iterator() {
    return {
      [Symbol.iterator]() { return this; },
      next() {
        // Generate next FontPropertiesFAB instance
        // Return { value: fontProps, done: false } or { done: true }
      }
    };
  }
  ```

  ### Validation Strategy

  **Three-Layer Validation:**

  1. **Structure Validation** (Constructor):
     - Spec must be object with `fontSets` array
     - Each set must have required fields (density, families, styles, weights, sizes)
     - All fields must be non-empty arrays

  2. **Range Validation** (Range Expansion):
     - Step must be positive
     - Start must be ≤ stop
     - All range elements must be numbers

  3. **Font Property Validation** (Iteration):
     - Built-in validation using same rules as FontPropertiesFAB
     - Validates density (positive), fontFamily (non-empty string)
     - Validates style (normal/italic/oblique), weight (valid values)
     - Validates fontSize (positive)
     - Creates FontProperties instances (runtime class) with validated values

  **Error Reporting:**
  Errors include set name/index and specific field for easy debugging:
  ```
  "Set 1: Missing required field 'families'"
  "Arial Standard: Invalid range: start (24) > stop (12)"
  ```

  ### Integration with Font Assets Building

  **Typical Workflow:**
  ```javascript
  // 1. Define font set specification
  const spec = { fontSets: [...] };

  // 2. Create generator
  const generator = new FontSetGenerator(spec);

  // 3. Preview what will be generated
  console.log(`Will generate ${generator.getCount()} fonts`);
  generator.getSetsInfo().forEach(set => {
    console.log(`${set.name}: ${set.count} configs`);
  });

  // 4. Process each configuration
  for (const fontProps of generator.iterator()) {
    // Build font assets
    const atlas = await AtlasBuilder.build(fontProps);
    const metrics = FontMetricsFAB.extract(fontProps);

    // Save to disk
    saveAtlas(fontProps.idString, atlas);
    saveMetrics(fontProps.idString, metrics);
  }
  ```

  **Use Cases:**

  1. **Testing**: Generate test suite covering font property space
     ```javascript
     generator.forEach((fontProps, index, total) => {
       test(`Render test ${index}/${total}`, async () => {
         await testRendering(fontProps);
       });
     });
     ```

  2. **Asset Building**: Batch generate font assets for deployment
     ```javascript
     const spec = loadSpec('production-fonts.json');
     const generator = new FontSetGenerator(spec);
     await buildAllAssets(generator);
     ```

  3. **Sample Generation**: Create demos and documentation examples
     ```javascript
     for (const fontProps of generator.iterator()) {
       const canvas = await renderSample(fontProps, "Sample Text");
       saveSample(fontProps.idString, canvas);
     }
     ```

  4. **CI/CD**: Validate font rendering across configurations
     ```javascript
     for (const fontProps of generator.iterator()) {
       const hash = await renderAndHash(fontProps);
       assertHashMatches(fontProps, hash, referenceHashes);
     }
     ```

  ### Design Trade-offs

  **✅ Advantages:**
  1. **Memory Efficient**: Can handle 10,000+ configurations without memory issues
  2. **Flexible**: Multi-set union allows different requirements per font family
  3. **Declarative**: JSON format is readable and versionable
  4. **Type Safe**: Validation ensures all generated configs are valid
  5. **Progress Tracking**: Count known upfront, forEach provides index/total

  **⚠️ Trade-offs:**
  1. **No Random Access**: Cannot jump to arbitrary configuration (iterator only)
  2. **Single Pass**: Iterator exhausts after one complete iteration (create new for re-iteration)
  3. **Pre-expansion Required**: Ranges must be expanded upfront (small memory cost)
  4. **No Filtering**: Cannot filter during iteration (must filter after generation)

  ### Performance Characteristics

  **Time Complexity:**
  - Constructor: O(R) where R = total values in all ranges (expansion cost)
  - getCount(): O(1) (pre-computed)
  - iterator().next(): O(1) per call
  - Complete iteration: O(N) where N = total configurations

  **Space Complexity:**
  - Storage: O(R) where R = total expanded range values
  - Iteration: O(1) additional space (just indices)

  **Typical Performance:**
  - Spec with 1000 configs: <1ms construction, <1µs per next()
  - Spec with 100,000 configs: ~10ms construction, <1µs per next()
  - Memory: ~1-10KB for typical specs (regardless of config count)

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