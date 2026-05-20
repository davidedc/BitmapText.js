// AtlasLRU - Bounded-size atlas cache layered on BitmapText's runtime stores.
//
// The actual atlas bytes live in AtlasDataStore (BitmapText's own store); this
// class is an ordering structure that decides when to call
// `BitmapText.loadFont(idString)` and `BitmapText.unloadAtlas(idString)`,
// keeping `AtlasDataStore.size() ≤ capacity` (K).
//
// LOADING THIS FILE:
//   Classic <script> tag (no module wrapper). The demo at
//   public/lru-atlas-loading-demo-bundled.html includes it via
//   <script src="../src/utils/AtlasLRU.js"></script>; the class then lives
//   in the page's top-level scope alongside BitmapText. For ES-module
//   consumers, package.json's `"./utils/*": "./src/utils/*"` wildcard exposes
//   the path directly.
//
// PUBLIC API:
//   new AtlasLRU(capacity)
//   request(idString)        — load if missing + bump recency. Returns a
//                              Promise resolving when the atlas is resident
//                              ('loaded' | 'evicted-during-load'). Triggers
//                              eviction synchronously (before kicking off
//                              the load) if entries.size would exceed K.
//   beingUsed(idString)      — bump recency only (no load side effect). Used
//                              by consumers to keep an atlas pinned across a
//                              wait that constitutes a "use" in their domain.
//   setCapacity(newCapacity) — shrink or grow K. Shrinks evict down to n as
//                              far as the pin window allows; entries.size may
//                              temporarily exceed n if too many entries are
//                              pinned/loading.
//   loadStats()              — { p50, p95, max, n } percentile wall-clock
//                              load times over the last LOAD_HISTORY_CAP loads.
//   size (getter)            — current entries.size
//   loadedCount (getter)     — entries.size minus in-flight loads
//
// EVICTION POLICY (#evictOne):
//   • Skip entries with state !== 'loaded' (in-flight loads are NEVER
//     evictable — the load can't be cancelled mid-flight).
//   • Skip entries whose pinUntil > now.
//   • Among the rest, evict the smallest lastUsed.
//   • If no eligible victim, return false; the caller proceeds and
//     entries.size temporarily exceeds capacity.
//
// DEPENDENCIES IN SCOPE AT RUNTIME:
//   • BitmapText (from dist/bitmaptext{,-node}.min.js)
//   • performance.now()
//   • (optional) isFileProtocol — referenced as a load option; the runtime
//     loader tolerates undefined.

// Pin window — never evict freshly-touched / just-loaded entries.
const PIN_GRACE_MS = 250;
// Cap on the rolling load-duration buffer used by loadStats().
const LOAD_HISTORY_CAP = 50;

class AtlasLRU {
  constructor(capacity) {
    this.capacity     = capacity;
    this.entries      = new Map();   // idString -> entry record (see below)
    this.pendingCount = 0;
    this.reloadCount  = 0;           // diagnostic: how many times we re-loaded an evicted atlas
    this.loadDurationsMs = [];       // ring buffer of recent load wall times
  }

  // "I'm using this atlas right now — refresh its recency." No load side effect:
  // returns silently if the atlas isn't tracked. Use this from contexts that
  // constitute a real "use" of the atlas in the calling app's domain (e.g.
  // editing text in a textbox), as opposed to passive on-screen presence
  // (which the LRU has no way to observe and which the caller usually
  // doesn't want to count). Pairs with request(): request = "load if
  // missing + bump recency", beingUsed = "bump recency only".
  beingUsed(idString) {
    const e = this.entries.get(idString);
    if (!e) return false;
    const now = performance.now();
    e.lastUsed = now;
    e.pinUntil = now + PIN_GRACE_MS;
    return true;
  }

  // Called by a TextBox at every paint. Returns a Promise that resolves when the
  // atlas is in AtlasDataStore. If already there, resolves immediately and bumps recency.
  request(idString) {
    const now = performance.now();
    let e = this.entries.get(idString);

    if (e) {
      e.lastUsed = now;
      e.pinUntil = now + PIN_GRACE_MS;
      return e.state === 'loaded' ? Promise.resolve('loaded') : e.promise;
    }

    // New idString — find a slot.
    while (this.entries.size >= this.capacity) {
      if (!this.#evictOne(now)) break;   // no evictable victim; proceed (capacity will be temporarily over)
    }

    // Reserve and kick off the load.
    const tStart = performance.now();
    const promise = BitmapText.loadFont(idString, { isFileProtocol })
      .then(() => {
        const x = this.entries.get(idString);
        if (!x) {
          // Slot was removed under us (only happens on load failure path or capacity=0).
          return 'evicted-during-load';
        }
        x.state    = 'loaded';
        x.lastUsed = performance.now();        // KEY: load completion = a fresh use
        x.pinUntil = x.lastUsed + PIN_GRACE_MS; // protect briefly so requester can paint
        this.pendingCount--;
        this.#recordLoadDuration(performance.now() - tStart);
        return 'loaded';
      })
      .catch(err => {
        this.entries.delete(idString);
        this.pendingCount--;
        throw err;
      });

    e = { state: 'loading', lastUsed: now, pinUntil: now + PIN_GRACE_MS, promise };
    this.entries.set(idString, e);
    this.pendingCount++;
    return promise;
  }

  #recordLoadDuration(ms) {
    this.loadDurationsMs.push(ms);
    if (this.loadDurationsMs.length > LOAD_HISTORY_CAP) {
      this.loadDurationsMs.shift();
    }
  }

  // p50/p95/max wall-clock load duration (fetch + decode + reconstruction)
  // over the last LOAD_HISTORY_CAP loads. Surfaces the actual signal behind
  // the FPS spikes: the runtime emits per-load [atlas-fetch] / [atlas-reconstruct]
  // log lines, but their per-line firehose makes them unreadable at 30+
  // textboxes spawning. This collapses them to one number.
  loadStats() {
    const n = this.loadDurationsMs.length;
    if (n === 0) return { p50: 0, p95: 0, max: 0, n: 0 };
    const sorted = [...this.loadDurationsMs].sort((a, b) => a - b);
    const pick = q => sorted[Math.min(n - 1, Math.floor(n * q))];
    return { p50: pick(0.5), p95: pick(0.95), max: sorted[n - 1], n };
  }

  // Returns true if a victim was evicted, false if no eligible victim was found.
  #evictOne(now) {
    let victimId = null, victimT = Infinity;
    for (const [id, e] of this.entries) {
      if (e.state !== 'loaded') continue;     // never touch in-flight loads
      if (now < e.pinUntil)     continue;     // never evict freshly-touched/just-loaded
      if (e.lastUsed < victimT) { victimT = e.lastUsed; victimId = id; }
    }
    if (!victimId) return false;
    BitmapText.unloadAtlas(victimId);
    this.entries.delete(victimId);
    return true;
  }

  // Slider lowered K below current size — shrink as much as the pin window allows.
  setCapacity(newCapacity) {
    this.capacity = newCapacity;
    const now = performance.now();
    while (this.entries.size > this.capacity) {
      if (!this.#evictOne(now)) break;
    }
  }

  get size()        { return this.entries.size; }
  get loadedCount() { return this.entries.size - this.pendingCount; }
}
