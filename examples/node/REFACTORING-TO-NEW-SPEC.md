Current State Analysis

  Currently we have:
  - BitmapGlyphStore - stores both metrics AND atlases (glyph sheets)
  - FontLoader - loads both metrics AND atlases
  - manifest-loader.js - poorly organized set of functions that coordinates loading
  - Global variables for manifest data

  Current Pain Points

  - BitmapGlyphStore mixes metrics and atlas storage (violates SRP)
  - manifest-loader.js has misnamed functions and mixed responsibilities
  - FontLoader partially handles loading but not ingestion
  - Global state dependencies everywhere


I want you to deeply refactor this project along a different architectural approach that is more orthogonal in concept.

  FontManifest . Note that there is only one font manifest, immutable, so this class can also load it.

  FontMetricsLoader
  FontMetricsStore containing instances of...
  FontMetrics

  FontAtlasLoader
  FontAtlasStore (was: BitmapGlyphStore) containing instances of...
  FontAtlas

  All the loading/ingesting could be then done via / orchestrated by another class:
  FontAssets

  The loading of assets should
  1. all the metrics from the manifests MUST be loaded at once. I.e. deferred loading of metrics is not supported
  2. The user can decide to load all the atlases in the manifest at once, or to load them dynamically (because *all of them* might be too much memory)
  3. tolerate the scenario where metrics are found but not atlases - in which case glyphs are rendered as rectangles (in which case the drawing routine should return a
  warning that this is happening, in some way, so that the user can decide to load the atlas dynamically and re-do the drawing)
  
  However, the VERY top level methods for triggering the loads/ingestions and measuring/drawing methods should be in BitmapText.


  Benefits Over Current Architecture:
  - Orthogonal: Clear separation between Manifest/Metrics/Atlas
  - No global state: Everything properly encapsulated
  - Memory efficient: Dynamic atlas loading with explicit control
  - Developer friendly: Single FontAssets API with intuitive methods


  Deep Analysis of Requirements

  The manifest and metrics loading reveal critical design considerations. Font management isn't just about storing identifiers, but capturing a comprehensive ecosystem of
  typographic resources.

  Metrics emerge as a foundational element, underpinning text rendering capabilities. Their compact nature and critical role suggest an upfront, comprehensive loading
  strategy that ensures immediate rendering readiness.

  Atlas loading demands a more nuanced, memory-conscious approach. Large image data requires dynamic, on-demand retrieval, with intelligent fallback mechanisms to maintain
  system responsiveness.

  The FontAssets facade crystallizes these insights into a clean, intuitive API. Users can interact with font systems through a simple, predictable interface that abstracts
  complex loading and rendering mechanics.

  Composition principles guide the architecture, ensuring flexibility and maintainability. Each class serves a distinct, well-defined purpose within a cohesive system.

  Key design strategies emerge: immutability for stability, interfaces for abstraction, and careful management of object creation and state. The approach prioritizes clean,
  efficient font asset management through thoughtful object-oriented design principles.

  Implementing immutable domain objects like FontManifest and FontMetrics ensures data integrity. By using Object.freeze() and providing defensive copy accessors, we prevent
  unintended modifications while allowing safe data retrieval. Static factory methods and builder patterns could further enhance object creation flexibility.

  The design emphasizes protecting internal state, using primitive types appropriately, and creating clear, predictable interfaces for font-related operations. Defensive
  programming techniques minimize potential runtime errors and unexpected mutations.

  The FontMetricsStore manages a mapping of font metrics using a key generation strategy. It supports adding, retrieving, and checking for font metrics based on specific font
   properties. The internal Map allows efficient storage and lookup of font-related measurement information.

  The FontAtlasStore appears designed with a parallel structure to FontMetricsStore, suggesting a consistent approach to managing font-related resources through keyed storage
   mechanisms. However, metrics are loaded all at once, while Atlases CAN be, or they CAN be loaded dynamically. The Map-based implementation enables flexible tracking of font atlases across different property configurations.

  The FontAssets class acts as a central facade for font asset management, coordinating multiple specialized stores. It provides a streamlined interface for loading font
  manifests, metrics, and atlases. The constructor initializes stores for metrics and atlases, with a loader configured to
  interact with these stores.

  Key methods enable loading font resources asynchronously, including individual and bulk loading of manifests, metrics, and atlases. Accessor methods retrieve stored font
  information, while utility methods like measureText and drawText offer high-level text rendering capabilities.


⏺ Architecture Summary - Refined

  Core Components

  1. FontManifest (Singleton-like, Immutable)

  - Loads and parses manifest data once
  - Provides query methods for available fonts
  - Rich domain object with search/filter capabilities

  2. FontMetricsLoader

  - Only has loadAll(manifest) method - loads all metrics at once
  - Batch loads with progress tracking via callbacks

  3. FontMetricsStore

  - Stores FontMetrics instances by key
  - No removal methods - metrics persist once loaded
  - Methods: add(), get(), has()

  4. FontMetrics (Immutable Domain Object)

  - Encapsulates all metric data for a specific font configuration
  - Methods: getGlyphMetrics(), getKerningAdjustment(), hasGlyph()

  5. FontAtlasLoader

  - Methods:
    - loadOne(fontId) - single atlas
    - loadBatch(fontIds) - multiple atlases, loads one at a time with pause in between
    - loadAll(manifest) - all atlases from manifest
  - Request for an already loaded Atlas does nothing
  - No retry logic
  - No complex preloading strategies

  6. FontAtlasStore

  - Stores FontAtlas instances by key
  - Methods: add(), get(), has(), remove(), getMemoryUsage()
  - Basic memory management (manual removal only for now)
  - No auto-eviction

  7. FontAtlas (Domain Object)

  - Wraps image data and metadata
  - Methods: extractGlyph(), get memoryUsage()
  - Knows how to extract individual glyphs from sheet

  8. FontAssets (Orchestration Facade)

  - Coordinates loading and storage of all font resources
  - Methods:
    - initialize(manifestPath) - loads manifest and ALL metrics
    - loadAtlas(fontProperties) - load single atlas
    - loadAllAtlases() - load all atlases from manifest
    - ensureAtlasLoaded(fontProperties) - load if not present

  9. Status (Return Object)

  - Tracks rendering operation results
  - Can be either:
     - Success
     - Metrics not available at all ( no render possible at all )
     - Metrics not available for glyphs: '[chars missing]'. Also in this case no render possible at all. If empty or null chars, means that metrics are not available at all.
     - Atlas not available at all (render done with placeholder rects)
     - Atlas not available for glyphs: '[chars missing]'. If empty or null chars, means that Atlas are not available at all. Some glyphs are correct, some are with placeholder rects.
  - Can be turned into a console warning

  10. BitmapText (High-level API)
  - Top-level API for text operations
  - (calls FontAssets) initialize(manifestPath) - loads manifest and ALL metrics
  - (calls FontAssets) loadAtlas(fontProperties) - load single atlas
  - (calls FontAssets) loadAllAtlases() - load all atlases from manifest
  - (calls FontAssets) ensureAtlasLoaded(fontProperties) - load if not present
  - measureText() - immediate, fails if font metrics are not loaded or if the metrics for some glyphs are missing (returns status object with result)
  - drawText() - immediate, may use rectangles for all glyphs or some glyphs (returns status object with result)

  Key Design Principles
  1. Asymmetric Loading:
    - Metrics: Always loaded upfront, all at once
    - Atlases: Can be loaded all at once OR on-demand
  2. Clear Separation:
  3. No Global State:
    - Everything encapsulated in class instances
    - No global variables
  4. Error Handling:
    - Missing atlas = rectangle fallback (not error)
    - Missing metrics = error
    - No pixelDensity fallback (exact match required)
  5. Memory Management:
    - Atlases stored in memory (not IndexedDB)
    - Manual removal only (no auto-eviction yet)
    - Memory usage tracking available
  6. Loading Coordination:
    - Queue system prevents browser overwhelming
    - Callbacks for progress/completion
  7. Status Reporting:
    - Structured status objects returned
    - No console warnings in library code
    - Consumer decides how to handle warnings

  Data Flow

  1. Initialization:
  FontManifest.load() → FontMetricsLoader.loadAll() → All metrics in memory
  2. Atlas Loading (Option A - Eager):
  FontAtlasLoader.loadAll() → All atlases in memory
  3. Atlas Loading (Option B - Lazy):
  BitmapText.drawText() → Missing atlas detected → Rectangle fallback + status
  Consumer reads status → FontAssets.loadAtlas() → Retry drawing
  4. Rendering:
  BitmapText.measureText() → Uses metrics only (always available)
  BitmapText.drawText() → Uses metrics + atlas (atlas optional, rectangles if missing)

  Benefits

  - Clean Architecture: Orthogonal concepts, single responsibility
  - Memory Efficient: Dynamic atlas loading is possible
  - Developer Friendly: Clear APIs, predictable behavior
  - Resilient: Graceful degradation with rectangle fallback
  - Flexible: Supports both eager and lazy loading patterns
  - Testable: No global state, clear dependencies


⏺ FontProperties as a Domain Class - Analysis

  Yes, making FontProperties a proper class would be highly beneficial. Here's why and how:

  Benefits of a FontProperties Class

  1. Centralized Validation:
    - Ensure all required properties are present
    - Validate values (e.g., fontSize > 0, valid fontStyle values)
    - Fail fast with clear errors
  2. Key Generation:
    - Single source of truth for key generation
    - Consistent ordering and formatting
    - Bidirectional (can parse keys back to properties)
  3. Immutability:
    - Prevent accidental mutation after creation
    - Safe to pass around without defensive copying
  4. Type Safety:
    - Clear contract for what constitutes valid font properties
    - Better IDE support and documentation
  5. Domain Logic:
    - Comparison methods
    - Serialization/deserialization
    - Default values handling

  Proposed Design

  class FontProperties {
    // Static constants for valid values
    static VALID_STYLES = ['normal', 'italic', 'oblique'];
    static VALID_WEIGHTS = ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'];

    constructor(fontSize, fontFamily, fontStyle, fontWeight, pixelDensity) {
      // Validation
      this.#validate(fontSize, fontFamily, fontStyle, fontWeight, pixelDensity);

      // Immutable properties
      Object.defineProperties(this, {
        fontSize: { value: fontSize, enumerable: true },
        fontFamily: { value: fontFamily, enumerable: true },
        fontStyle: { value: fontStyle, enumerable: true },
        fontWeight: { value: fontWeight, enumerable: true },
        pixelDensity: { value: pixelDensity, enumerable: true }
      });

      // Cache the key for performance
      this._key = this.#generateKey();
      Object.freeze(this);
    }

    // Factory method from plain object
    static fromObject(obj) {
      return new FontProperties(
        obj.fontSize,
        obj.fontFamily,
        obj.fontStyle || 'normal',
        obj.fontWeight || 'normal',
        obj.pixelDensity || 1
      );
    }

    // Factory method from key string
    static fromKey(key) {
      const parts = key.split(':');
      if (parts.length !== 5) {
        throw new Error(`Invalid font key: ${key}`);
      }
      return new FontProperties(
        parseFloat(parts[4]),
        parts[1],
        parts[2],
        parts[3],
        parseFloat(parts[0])
      );
    }

    // Get the canonical key
    get key() {
      return this._key;
    }

    // Generate storage/lookup key
    #generateKey() {
      return `${this.pixelDensity}:${this.fontFamily}:${this.fontStyle}:${this.fontWeight}:${this.fontSize}`;
    }

    // Validation
    #validate(fontSize, fontFamily, fontStyle, fontWeight, pixelDensity) {
      if (!fontSize || fontSize <= 0) {
        throw new Error(`Invalid fontSize: ${fontSize}`);
      }
      if (!fontFamily || typeof fontFamily !== 'string') {
        throw new Error(`Invalid fontFamily: ${fontFamily}`);
      }
      if (!FontProperties.VALID_STYLES.includes(fontStyle)) {
        throw new Error(`Invalid fontStyle: ${fontStyle}`);
      }
      if (!FontProperties.VALID_WEIGHTS.includes(fontWeight)) {
        throw new Error(`Invalid fontWeight: ${fontWeight}`);
      }
      if (!pixelDensity || pixelDensity <= 0) {
        throw new Error(`Invalid pixelDensity: ${pixelDensity}`);
      }
    }

    // Comparison
    equals(other) {
      if (!(other instanceof FontProperties)) return false;
      return this._key === other._key;
    }

    // Create a modified copy
    withSize(newSize) {
      return new FontProperties(
        newSize,
        this.fontFamily,
        this.fontStyle,
        this.fontWeight,
        this.pixelDensity
      );
    }

    withPixelDensity(newDensity) {
      return new FontProperties(
        this.fontSize,
        this.fontFamily,
        this.fontStyle,
        this.fontWeight,
        newDensity
      );
    }

    // For debugging
    toString() {
      return `FontProperties(${this.fontFamily} ${this.fontSize}px ${this.fontStyle} ${this.fontWeight} @${this.pixelDensity}x)`;
    }

    // For serialization
    toJSON() {
      return {
        fontSize: this.fontSize,
        fontFamily: this.fontFamily,
        fontStyle: this.fontStyle,
        fontWeight: this.fontWeight,
        pixelDensity: this.pixelDensity
      };
    }
  }

  Integration Benefits

  With this class, the rest of the architecture becomes cleaner:

  // FontMetricsStore
  class FontMetricsStore {
    add(fontProperties, metrics) {
      // fontProperties.key is already available
      this.#store.set(fontProperties.key, metrics);
    }

    get(fontProperties) {
      return this.#store.get(fontProperties.key);
    }
  }

  // FontAtlasStore - same pattern
  class FontAtlasStore {
    get(fontProperties) {
      return this.#store.get(fontProperties.key);
    }
  }

  // Usage becomes more explicit
  const props = new FontProperties(18, "Arial", "normal", "normal", 1);
  // or
  const props = FontProperties.fromObject({
    fontSize: 18,
    fontFamily: "Arial",
    fontStyle: "normal",
    fontWeight: "normal",
    pixelDensity: window.devicePixelRatio || 1
  });

  Additional Considerations

  1. Builder Pattern (optional):
  const props = FontProperties.builder()
    .size(18)
    .family("Arial")
    .pixelDensity(window.devicePixelRatio || 1)
    .build(); // uses defaults for style/weight

  2. Constants for Common Configurations:
  FontProperties.DEFAULT_ARIAL_18 = new FontProperties(18, "Arial", "normal", "normal", 1);

  3. Validation Flexibility:
    - Could accept number strings for fontWeight ("400" vs 400)
    - Could normalize font family names (trim, lowercase for comparison)