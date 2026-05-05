// FontMetricsStore - Core Runtime Static Class
//
// Holds FontMetrics instances for fast O(1) lookup keyed by `fontProperties.key`
// (which includes pixelDensity).
//
// SOURCE OF TRUTH: MetricsBundleStore. The metrics bundle ships density-agnostic
// records keyed by (family, style, weight, size). On the first lookup for a
// given (fontProperties), this store materialises a density-specific FontMetrics
// from the bundle record (via MetricsExpander.expand with the runtime density)
// and caches it.
//
// Density-1 and density-2 are 99% identical at the data level (only `pixelDensity`
// varies), so the bundle stores the record once and pays the small cost of
// per-density materialisation on demand.

class FontMetricsStore {
  // Density-aware cache: fontProperties.key → FontMetrics instance
  static #fontMetrics = new Map();

  static getFontMetrics(fontProperties) {
    const cached = FontMetricsStore.#fontMetrics.get(fontProperties.key);
    if (cached) return cached;

    // Lazy materialise from the bundle store on first access.
    if (typeof MetricsBundleStore === 'undefined' || typeof MetricsExpander === 'undefined') {
      return undefined;
    }
    const record = MetricsBundleStore.getRecord(fontProperties);
    if (!record) return undefined;

    let characterSet;
    if (typeof CharacterSets !== 'undefined' &&
        fontProperties.fontFamily === CharacterSets.INVARIANT_FONT_FAMILY) {
      characterSet = Array.from(CharacterSets.FONT_INVARIANT_CHARS);
    }

    const fontMetrics = MetricsExpander.expand(record, characterSet, fontProperties.pixelDensity);
    FontMetricsStore.#fontMetrics.set(fontProperties.key, fontMetrics);
    return fontMetrics;
  }

  static setFontMetrics(fontProperties, fontMetrics) {
    FontMetricsStore.#fontMetrics.set(fontProperties.key, fontMetrics);
  }

  static hasFontMetrics(fontProperties) {
    if (FontMetricsStore.#fontMetrics.has(fontProperties.key)) return true;
    if (typeof MetricsBundleStore !== 'undefined' && MetricsBundleStore.hasRecord(fontProperties)) return true;
    return false;
  }

  static deleteFontMetrics(fontProperties) {
    return FontMetricsStore.#fontMetrics.delete(fontProperties.key);
  }

  static getAvailableFonts() {
    return Array.from(FontMetricsStore.#fontMetrics.keys());
  }

  static clear() {
    FontMetricsStore.#fontMetrics.clear();
  }

  static size() {
    return FontMetricsStore.#fontMetrics.size;
  }
}
