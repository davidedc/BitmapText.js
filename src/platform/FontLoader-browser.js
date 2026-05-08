// FontLoader - Browser-Specific Font Loader
//
// Browser implementation of the FontLoaderBase abstract methods.
//
// METRICS:
//   The whole metrics corpus is shipped as one file: `font-assets/metrics-bundle.js`.
//   On first metrics request the file is injected as a `<script>` tag (works under
//   `file://` because there is no `fetch` involved). The script wrapper calls
//   `BitmapText.registerBundle("<base64>")`, which sets `FontLoaderBase._bundleDecodePromise`
//   to the async base64 → deflate-raw → JSON decode. We await that promise after
//   `script.onload` fires.
//
// ATLAS:
//   Per-font, as before — direct WebP fetch over HTTP(S), or base64-WebP via a
//   `<script>` tag under `file://`.

class FontLoader extends FontLoaderBase {
  // ============================================
  // File Name Constants
  // ============================================

  static ATLAS_PREFIX = 'atlas-';
  static JS_EXTENSION = '.js';
  static WEBP_EXTENSION = '.webp';
  static METRICS_BUNDLE_FILENAME = 'metrics-bundle.js';
  static POSITIONING_BUNDLE_PREFIX = 'positioning-bundle-density-';

  // ============================================
  // Browser-Specific Loading Implementation
  // ============================================

  /**
   * Inject the metrics-bundle script tag once and await full decode.
   * Singleton-safe: `FontLoaderBase.loadMetricsFile` calls this only on the first invocation.
   * @returns {Promise<void>} Resolves once every record is in MetricsBundleStore.
   */
  static async loadBundleFile() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const fontDirectory = FontLoaderBase.getFontDirectory();
      script.src = `${fontDirectory}${FontLoader.METRICS_BUNDLE_FILENAME}`;

      script.onload = () => {
        const decodePromise = FontLoaderBase._bundleDecodePromise;
        if (!decodePromise) {
          reject(new Error('metrics-bundle.js loaded but did not call BitmapText.registerBundle'));
          return;
        }
        decodePromise.then(resolve, reject);
      };

      script.onerror = () => {
        script.remove();
        reject(new Error(`Failed to load metrics bundle from ${script.src}`));
      };

      document.head.appendChild(script);
    });
  }

  /**
   * Inject the per-density positioning-bundle script tag once and await full
   * decode. Singleton-safe per density: `FontLoaderBase.loadPositioningFile`
   * calls this only on the first invocation for each density.
   * @param {number} pixelDensity
   * @returns {Promise<void>} Resolves once every record is in PositioningBundleStore.
   */
  static async loadPositioningBundleFile(pixelDensity) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const fontDirectory = FontLoaderBase.getFontDirectory();
      script.src = `${fontDirectory}${FontLoader.POSITIONING_BUNDLE_PREFIX}${pixelDensity}.js`;

      script.onload = () => {
        const decodePromise = FontLoaderBase._positioningBundleDecodePromises.get(pixelDensity);
        if (!decodePromise) {
          reject(new Error(`positioning-bundle-density-${pixelDensity}.js loaded but did not call BitmapText.registerPositioningBundle`));
          return;
        }
        decodePromise.then(resolve, reject);
      };

      script.onerror = () => {
        script.remove();
        reject(new Error(`Failed to load positioning bundle from ${script.src}`));
      };

      document.head.appendChild(script);
    });
  }

  /**
   * Load atlas file (chooses strategy based on protocol)
   * @param {string} idString - Font ID string
   * @param {boolean} isFileProtocol - Whether using file:// protocol
   * @param {Object} bitmapTextClass - BitmapText class reference
   * @returns {Promise} Resolves when atlas is loaded
   */
  static async loadAtlasFile(idString, isFileProtocol, bitmapTextClass) {
    if (isFileProtocol) {
      return FontLoader._loadAtlasFromJS(idString, bitmapTextClass);
    } else {
      return FontLoader._loadAtlasFromWebP(idString, bitmapTextClass);
    }
  }

  // ============================================
  // Browser-Specific Atlas Loading Strategies
  // ============================================

  /**
   * Load atlas from JS file (for file:// protocol)
   * JS file contains base64-encoded WebP data
   * @private
   * @param {string} idString - Font ID string
   * @param {Object} bitmapTextClass - BitmapText class reference
   * @returns {Promise} Resolves when atlas is loaded
   */
  static _loadAtlasFromJS(idString, bitmapTextClass) {
    return new Promise((resolve, reject) => {
      const tFetchStart = performance.now();
      const imageScript = document.createElement('script');
      const fontDirectory = FontLoaderBase.getFontDirectory();
      imageScript.src = `${fontDirectory}${FontLoader.ATLAS_PREFIX}${idString}-webp${FontLoader.JS_EXTENSION}`;

      imageScript.onload = () => {
        const pkg = FontLoaderBase._tempAtlasPackages[idString];

        if (!pkg || !pkg.base64Data) {
          console.warn(`Image data not found in JS file for ${idString} - will use placeholder rectangles`);
          imageScript.remove();
          resolve();
          return;
        }

        const img = new Image();
        img.src = `data:image/webp;base64,${pkg.base64Data}`;

        img.onload = async () => {
          const tImgOnload = performance.now();
          try {
            // Force the WebP decode to complete off-main-thread before the
            // reconstructor reads pixels (otherwise the first getImageData
            // call would synchronously trigger the decode on the UI thread).
            // decode() is supported in all modern browsers; if it isn't, we
            // fall back to assuming onload is sufficient.
            if (typeof img.decode === 'function') {
              try { await img.decode(); } catch (_) { /* fall through */ }
            }
            const tDecoded = performance.now();
            // Atlas will be reconstructed now or later when metrics are available
            await FontLoaderBase._loadAtlasFromPackage(idString, img, bitmapTextClass);
            console.log(
              `[atlas-fetch] ${idString} (file://): ` +
              `script=${(tImgOnload - tFetchStart).toFixed(1)}ms ` +
              `decode=${(tDecoded - tImgOnload).toFixed(1)}ms`
            );
          } finally {
            imageScript.remove();
            resolve();
          }
        };

        img.onerror = () => {
          console.warn(`Failed to decode base64 WebP data for ${idString} - will use placeholder rectangles`);
          imageScript.remove();
          delete FontLoaderBase._tempAtlasPackages[idString];
          resolve();
        };
      };

      imageScript.onerror = () => {
        console.warn(`Atlas JS not found: atlas-${idString}-webp.js - will use placeholder rectangles`);
        imageScript.remove();
        resolve();
      };

      document.head.appendChild(imageScript);
    });
  }

  /**
   * Load atlas from WebP file directly (for http/https protocols)
   * @private
   * @param {string} idString - Font ID string
   * @param {Object} bitmapTextClass - BitmapText class reference
   * @returns {Promise} Resolves when atlas is loaded
   */
  static _loadAtlasFromWebP(idString, bitmapTextClass) {
    return new Promise((resolve, reject) => {
      const tFetchStart = performance.now();
      const img = new Image();
      const fontDirectory = FontLoaderBase.getFontDirectory();
      img.src = `${fontDirectory}${FontLoader.ATLAS_PREFIX}${idString}${FontLoader.WEBP_EXTENSION}`;

      img.onload = async () => {
        const tImgOnload = performance.now();
        try {
          // Force the WebP decode to complete off-main-thread before the
          // reconstructor reads pixels. Without this, the first getImageData
          // call (inside the reconstructor) synchronously decodes the image
          // on the UI thread — a major contributor to per-load FPS spikes.
          if (typeof img.decode === 'function') {
            try { await img.decode(); } catch (_) { /* fall through */ }
          }
          const tDecoded = performance.now();
          // Atlas will be reconstructed now or later when metrics are available
          await FontLoaderBase._loadAtlasFromPackage(idString, img, bitmapTextClass);
          console.log(
            `[atlas-fetch] ${idString} (http): ` +
            `fetch=${(tImgOnload - tFetchStart).toFixed(1)}ms ` +
            `decode=${(tDecoded - tImgOnload).toFixed(1)}ms`
          );
        } finally {
          resolve();
        }
      };

      img.onerror = () => {
        console.warn(`Atlas image not found: atlas-${idString}.webp - will use placeholder rectangles`);
        resolve();
      };
    });
  }
}
