// PositioningBundleStore - Per-density store of pre-computed atlas positioning
//
// The positioning bundle ships per-(density, family, style, weight, size) records
// in sorted-character order: [tightWidth[], tightHeight[], dx[], dy[]]. Replaces
// the runtime pixel-scan reconstruction (TightAtlasReconstructor) — these values
// were already computed at build time by AtlasPositioningFAB and are now shipped.
//
// xInAtlas is implicit: cumsum(tightWidth). yInAtlas is always 0 (single-row tight
// atlas). Both are reconstituted at materialisation, not stored.
//
// Per-density (not density-agnostic like metrics): physical-pixel offsets and
// rasteriser rounding genuinely differ across densities.

class PositioningBundleStore {
  // "density:family:style:weight:size" → { tightWidth: [], tightHeight: [], dx: [], dy: [] }
  static #records = new Map();

  // Cache of materialised AtlasPositioning instances, keyed by FontProperties.key.
  static #atlasPositioning = new Map();

  static #key(pixelDensity, fontFamily, fontStyle, fontWeight, fontSize) {
    return `${pixelDensity}:${fontFamily}:${fontStyle}:${fontWeight}:${fontSize}`;
  }

  static setRecord(pixelDensity, fontFamily, fontStyle, fontWeight, fontSize, arrays) {
    PositioningBundleStore.#records.set(
      PositioningBundleStore.#key(pixelDensity, fontFamily, fontStyle, fontWeight, fontSize),
      arrays
    );
  }

  static getRecord(fontProperties) {
    return PositioningBundleStore.#records.get(
      PositioningBundleStore.#key(
        fontProperties.pixelDensity,
        fontProperties.fontFamily,
        fontProperties.fontStyle,
        fontProperties.fontWeight,
        fontProperties.fontSize
      )
    );
  }

  static hasRecord(fontProperties) {
    return PositioningBundleStore.#records.has(
      PositioningBundleStore.#key(
        fontProperties.pixelDensity,
        fontProperties.fontFamily,
        fontProperties.fontStyle,
        fontProperties.fontWeight,
        fontProperties.fontSize
      )
    );
  }

  // Lazy-materialise an AtlasPositioning for `fontProperties`. Arrays are in the
  // SAME sorted order as `fontMetrics.getAvailableCharacters().sort()` — same
  // invariant the build pipeline (AtlasBuilder + AtlasPositioningFAB) uses.
  //
  // Record shapes:
  //   4 arrays: [tightWidth, tightHeight, dx, dy] — single-row tight atlas;
  //             yInAtlas is implicit 0, xInAtlas is cumsum(tightWidth).
  //   5 arrays: [tightWidth, tightHeight, dx, dy, yInAtlas] — multi-row tight atlas
  //             (used when total width would exceed cwebp's 16383px limit);
  //             xInAtlas is cumsum(tightWidth) restarted on each y change.
  static getPositioning(fontProperties, fontMetrics) {
    const cached = PositioningBundleStore.#atlasPositioning.get(fontProperties.key);
    if (cached) return cached;

    const arrays = PositioningBundleStore.getRecord(fontProperties);
    if (!arrays) return undefined;

    const characters = fontMetrics.getAvailableCharacters().sort();
    const [tightWidthArr, tightHeightArr, dxArr, dyArr, yInAtlasArr] = arrays;

    if (tightWidthArr.length !== characters.length) {
      throw new Error(
        `PositioningBundleStore: record length ${tightWidthArr.length} does not match ` +
        `character set length ${characters.length} for ${fontProperties.key}`
      );
    }

    const tightWidth = {};
    const tightHeight = {};
    const dx = {};
    const dy = {};
    const xInAtlas = {};
    const yInAtlas = {};

    let runningX = 0;
    let prevY = 0;
    for (let i = 0; i < characters.length; i++) {
      const char = characters[i];
      tightWidth[char] = tightWidthArr[i];
      tightHeight[char] = tightHeightArr[i];
      dx[char] = dxArr[i];
      dy[char] = dyArr[i];
      const y = yInAtlasArr ? yInAtlasArr[i] : 0;
      // Reset xInAtlas at the start of each new row, mirroring AtlasBuilder's pack order.
      if (y !== prevY) { runningX = 0; prevY = y; }
      xInAtlas[char] = runningX;
      yInAtlas[char] = y;
      runningX += tightWidthArr[i];
    }

    const positioning = new AtlasPositioning({
      tightWidth, tightHeight, dx, dy, xInAtlas, yInAtlas
    });
    PositioningBundleStore.#atlasPositioning.set(fontProperties.key, positioning);
    return positioning;
  }

  static size() {
    return PositioningBundleStore.#records.size;
  }

  static clear() {
    PositioningBundleStore.#records.clear();
    PositioningBundleStore.#atlasPositioning.clear();
  }

  // Clear records + materialised AtlasPositionings for one density only.
  // Both maps key on "${pixelDensity}:family:style:weight:size" (see #key above and
  // FontProperties.key), so a prefix match is exact. Already-loaded AtlasData
  // instances hold their own AtlasPositioning reference and keep rendering
  // correctly until the atlas itself is unloaded — the cache here is only
  // consulted on the next bundle->positioning materialisation.
  static clearDensity(pixelDensity) {
    const prefix = `${pixelDensity}:`;
    for (const k of [...PositioningBundleStore.#records.keys()]) {
      if (k.startsWith(prefix)) PositioningBundleStore.#records.delete(k);
    }
    for (const k of [...PositioningBundleStore.#atlasPositioning.keys()]) {
      if (k.startsWith(prefix)) PositioningBundleStore.#atlasPositioning.delete(k);
    }
  }
}
