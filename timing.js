const timers = new Map();

function startTiming(key) {
  timers.set(key, performance.now());
}

function stopTiming(key) {
  const startTime = timers.get(key);
  if (startTime === undefined) {
    console.warn(`No timer found for key: ${key}`);
    return null;
  }
  const endTime = performance.now();
  timers.delete(key);
  return endTime - startTime;
}
