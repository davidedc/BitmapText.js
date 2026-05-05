// MetricsBundleStore - Density-agnostic store of minified metrics records
//
// The metrics bundle ships one record per (fontFamily, fontStyle, fontWeight, fontSize)
// with no density baked in. This store holds those records after bundle decode,
// keyed by `family:style:weight:size`. FontMetricsStore lazy-materialises a
// density-specific FontMetrics from a record on first lookup.
//
// Density-1 and density-2 metrics differ only in `pixelDensity`; the bundle
// stores the record once and the runtime injects density at materialisation time.

class MetricsBundleStore {
  static #records = new Map(); // "family:style:weight:size" → minified array

  static #key(fontFamily, fontStyle, fontWeight, fontSize) {
    return `${fontFamily}:${fontStyle}:${fontWeight}:${fontSize}`;
  }

  static setRecord(fontFamily, fontStyle, fontWeight, fontSize, minified) {
    MetricsBundleStore.#records.set(
      MetricsBundleStore.#key(fontFamily, fontStyle, fontWeight, fontSize),
      minified
    );
  }

  static getRecord(fontProperties) {
    return MetricsBundleStore.#records.get(
      MetricsBundleStore.#key(
        fontProperties.fontFamily,
        fontProperties.fontStyle,
        fontProperties.fontWeight,
        fontProperties.fontSize
      )
    );
  }

  static hasRecord(fontProperties) {
    return MetricsBundleStore.#records.has(
      MetricsBundleStore.#key(
        fontProperties.fontFamily,
        fontProperties.fontStyle,
        fontProperties.fontWeight,
        fontProperties.fontSize
      )
    );
  }

  static size() {
    return MetricsBundleStore.#records.size;
  }

  static clear() {
    MetricsBundleStore.#records.clear();
  }
}
