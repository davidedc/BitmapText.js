// Helpers shared by Node demo + benchmark entrypoints (src/node/*-main.js).
// Concatenated into both standalone bundles (build-node-demo.sh) and runtime-
// bundle versions (build-node-bundled-demos.sh / build-benchmark.sh); not
// loaded standalone. StatusCode is in scope by the time this runs.

// Map a StatusCode numeric value to its short symbolic name. Used for compact
// log output in the demos (e.g. "Status: NO_METRICS"); runtime's
// getStatusDescription is verbose English and not interchangeable.
function getStatusName(code) {
  const statusNames = {
    [StatusCode.SUCCESS]: 'SUCCESS',
    [StatusCode.NO_METRICS]: 'NO_METRICS',
    [StatusCode.PARTIAL_METRICS]: 'PARTIAL_METRICS',
    [StatusCode.NO_ATLAS]: 'NO_ATLAS',
    [StatusCode.PARTIAL_ATLAS]: 'PARTIAL_ATLAS'
  };
  return statusNames[code] || `UNKNOWN(${code})`;
}

// Measurement benchmark: time per call over a fixed iteration count after a
// 100-call warm-up. Used by measurement-benchmark-*-main.js.
function measurePerformance(fn, iterations = 10000) {
  // Warm up (avoid JIT compilation effects)
  for (let i = 0; i < 100; i++) fn();

  // Actual measurement
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const elapsed = performance.now() - start;

  return {
    totalTime: elapsed,
    avgTime: elapsed / iterations,
    opsPerSec: (1000 * iterations) / elapsed,
    iterations
  };
}

// Rendering benchmark: adaptive iteration count — ramps until the run lasts
// minDuration ms, then measures one more pass. Used by rendering-benchmark-*-
// main.js.
function measureTime(fn, minDuration = 100) {
  let iterations = 1;
  let duration = 0;

  // Find appropriate iteration count
  while (duration < minDuration && iterations < 10000) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      fn();
    }
    duration = performance.now() - start;

    if (duration < minDuration) {
      iterations *= 10;
    }
  }

  // Perform final measurement
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const totalTime = performance.now() - start;
  const avgTime = totalTime / iterations;

  return {
    iterations,
    totalTime,
    avgTime,
    opsPerSecond: 1000 / avgTime
  };
}
