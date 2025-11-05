/**
 * FPS Testing Engine for BitmapText.js
 * Three-phase progressive load testing:
 *
 * PHASE 1 - COARSE DISCOVERY (rapid):
 * - Adaptive jumps every 30 frames (20% → 50% → 100% max)
 * - Continues until 10 consecutive slow frames
 * - Finds approximate performance ceiling quickly
 *
 * PHASE 2 - MEDIUM REFINEMENT (efficient):
 * - Backs off to last known good block count
 * - Fixed 10% increments every 30 frames
 * - Narrows down the range efficiently
 * - Continues until 10 consecutive slow frames
 *
 * PHASE 3 - FINE REFINEMENT (precise):
 * - Backs off to last known good block count
 * - Fixed +5 block increments every 30 frames
 * - Finds exact limit within ±5 blocks
 * - Stops when 10 consecutive slow frames
 *
 * Max: 20000 blocks, 180 seconds (3 minutes)
 */

class FPSTester {
  constructor(options = {}) {
    this.targetFPS = options.targetFPS || 60;
    this.targetFrameTime = 1000 / this.targetFPS; // 16.67ms for 60fps
    this.consecutiveFramesThreshold = options.consecutiveFramesThreshold || 10;
    this.framesUntilIncrease = options.framesUntilIncrease || 30; // Increase every 30 frames (twice per second)
    this.incrementPercentage = options.incrementPercentage || 0.2; // 20% increase (initial)
    this.mediumRefinementPercentage = options.mediumRefinementPercentage || 0.1; // 10% in medium refinement
    this.fineRefinementIncrement = options.fineRefinementIncrement || 5; // +5 blocks in fine refinement
    this.initialBlockCount = options.initialBlockCount || 10;
    this.maxBlockCount = options.maxBlockCount || 20000; // Safety limit (increased for very fast renderers)
    this.maxDuration = options.maxDuration || 180000; // 180 seconds (3 minutes) max

    // State
    this.currentBlockCount = this.initialBlockCount;
    this.previousBlockCount = this.initialBlockCount; // Track last known good count
    this.frameTimings = [];
    this.consecutiveSlowFrames = 0;
    this.framesSinceLastIncrease = 0;
    this.totalIncreases = 0;
    this.phase = 1; // 1 = coarse discovery, 2 = medium refinement, 3 = fine refinement
    this.isRunning = false;
    this.animationFrameId = null;
    this.lastFrameTime = 0;
    this.testStartTime = 0;
    this.testComplete = false;
    this.peakBlockCount = 0;
    this.averageFrameTime = 0;
    this.hitMaxLimit = false;

    // Callbacks
    this.renderCallback = null;
    this.progressCallback = null;
    this.completeCallback = null;
  }

  /**
   * Start the FPS test
   * @param {Function} renderCallback - Called each frame with (blockCount, ctx)
   * @param {Function} progressCallback - Called with progress updates (optional)
   * @param {Function} completeCallback - Called when test completes with results (optional)
   */
  start(renderCallback, progressCallback = null, completeCallback = null) {
    if (this.isRunning) {
      console.warn('FPS test already running');
      return;
    }

    this.renderCallback = renderCallback;
    this.progressCallback = progressCallback;
    this.completeCallback = completeCallback;

    this.reset();
    this.isRunning = true;
    // Timestamps will be initialized on first frame using RAF timestamp

    // Start the animation loop
    this.animationFrameId = requestAnimationFrame((timestamp) => this.testLoop(timestamp));
  }

  /**
   * Main test loop executed each frame
   */
  testLoop(timestamp) {
    if (!this.isRunning || this.testComplete) {
      return;
    }

    // Initialize timing on first frame
    if (this.frameTimings.length === 0) {
      this.lastFrameTime = timestamp;
      this.testStartTime = timestamp;
      this.frameTimings.push(0); // Placeholder for initialization frame (filtered out in statistics)
      this.animationFrameId = requestAnimationFrame((t) => this.testLoop(t));
      return;
    }

    // Calculate frame time
    const frameTime = timestamp - this.lastFrameTime;
    this.lastFrameTime = timestamp;

    // Track frame timing
    this.frameTimings.push(frameTime);

    // Render the text blocks
    if (this.renderCallback) {
      this.renderCallback(this.currentBlockCount, timestamp);
    }

    // Check safety limits
    const elapsed = timestamp - this.testStartTime;

    if (this.currentBlockCount >= this.maxBlockCount) {
      console.warn(`⚠️ Hit maximum block limit (${this.maxBlockCount}). Test complete.`);
      this.hitMaxLimit = true;
      this.complete();
      return;
    }
    if (elapsed >= this.maxDuration) {
      console.warn(`⚠️ Hit maximum duration (${this.maxDuration}ms). Test complete.`);
      this.hitMaxLimit = true;
      this.complete();
      return;
    }

    // Analyze frame performance
    if (frameTime >= this.targetFrameTime) {
      // Slow frame detected
      this.consecutiveSlowFrames++;

      // Check if we've hit the threshold
      if (this.consecutiveSlowFrames >= this.consecutiveFramesThreshold) {
        if (this.phase === 1) {
          // PHASE 1: Coarse discovery complete, move to medium refinement
          console.log(`🔍 Phase 1 complete at ${this.currentBlockCount} blocks (10 consecutive slow frames). Entering Phase 2...`);
          this.phase = 2;
          this.currentBlockCount = this.previousBlockCount; // Back off to last known good
          this.consecutiveSlowFrames = 0; // Reset counter
          this.framesSinceLastIncrease = 0; // Reset frame counter
          console.log(`↩️  Backed off to ${this.currentBlockCount} blocks. Starting 10% increments...`);
        } else if (this.phase === 2) {
          // PHASE 2: Medium refinement complete, move to fine refinement
          console.log(`🔍 Phase 2 complete at ${this.currentBlockCount} blocks (10 consecutive slow frames). Entering Phase 3...`);
          this.phase = 3;
          this.currentBlockCount = this.previousBlockCount; // Back off to last known good
          this.consecutiveSlowFrames = 0; // Reset counter
          this.framesSinceLastIncrease = 0; // Reset frame counter
          console.log(`↩️  Backed off to ${this.currentBlockCount} blocks. Starting precise +${this.fineRefinementIncrement} increments...`);
        } else {
          // PHASE 3: Fine refinement complete, test done
          this.complete();
          return;
        }
      }
    } else {
      // Fast frame - reset counter
      this.consecutiveSlowFrames = 0;
    }

    // Increase load every N frames (regardless of performance)
    this.framesSinceLastIncrease++;
    if (this.framesSinceLastIncrease >= this.framesUntilIncrease) {
      this.increaseLoad(timestamp);
    }

    // Update progress
    if (this.progressCallback) {
      this.progressCallback({
        blockCount: this.currentBlockCount,
        frameTime: frameTime,
        consecutiveSlowFrames: this.consecutiveSlowFrames,
        framesSinceLastIncrease: this.framesSinceLastIncrease,
        averageFrameTime: this.getAverageFrameTime(),
        phase: this.phase
      });
    }

    // Continue loop
    this.animationFrameId = requestAnimationFrame((t) => this.testLoop(t));
  }

  /**
   * Increase the rendering load (adaptive in phase 1, percentage in phase 2, fixed in phase 3)
   */
  increaseLoad(timestamp) {
    // Save current count before increasing
    this.previousBlockCount = this.currentBlockCount;

    let increase;
    if (this.phase === 1) {
      // PHASE 1: Adaptive percentage-based increases (capped at 100%)
      let adaptivePercentage = this.incrementPercentage; // Default 20%

      if (this.totalIncreases >= 8) {
        adaptivePercentage = 1.0; // 100% (double) after 8 increases - MAX
      } else if (this.totalIncreases >= 5) {
        adaptivePercentage = 0.5; // 50% after 5 increases
      }

      increase = Math.max(1, Math.floor(this.currentBlockCount * adaptivePercentage));
      this.currentBlockCount += increase;
      this.totalIncreases++;

      console.log(`📈 Increased load to ${this.currentBlockCount} blocks (+${adaptivePercentage * 100}%)`);
    } else if (this.phase === 2) {
      // PHASE 2: Fixed 10% increments
      increase = Math.max(1, Math.floor(this.currentBlockCount * this.mediumRefinementPercentage));
      this.currentBlockCount += increase;

      console.log(`📈 Increased load to ${this.currentBlockCount} blocks (+${this.mediumRefinementPercentage * 100}%)`);
    } else {
      // PHASE 3: Fixed small increments
      increase = this.fineRefinementIncrement;
      this.currentBlockCount += increase;

      console.log(`📈 Increased load to ${this.currentBlockCount} blocks (+${increase})`);
    }

    this.framesSinceLastIncrease = 0;
  }

  /**
   * Complete the test
   */
  complete() {
    this.testComplete = true;
    this.isRunning = false;
    this.peakBlockCount = this.currentBlockCount;
    this.averageFrameTime = this.getAverageFrameTime();

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    const results = this.getResults();

    console.log('✅ FPS test complete');
    console.log(`Peak blocks at ${this.targetFPS}fps: ${this.peakBlockCount}`);
    console.log(`Average frame time: ${this.averageFrameTime.toFixed(2)}ms`);

    if (this.completeCallback) {
      this.completeCallback(results);
    }
  }

  /**
   * Stop the test
   */
  stop() {
    this.isRunning = false;
    this.testComplete = true;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Reset the test state
   */
  reset() {
    this.currentBlockCount = this.initialBlockCount;
    this.previousBlockCount = this.initialBlockCount;
    this.frameTimings = [];
    this.consecutiveSlowFrames = 0;
    this.framesSinceLastIncrease = 0;
    this.totalIncreases = 0;
    this.phase = 1;
    this.testComplete = false;
    this.peakBlockCount = 0;
    this.averageFrameTime = 0;
    this.hitMaxLimit = false;
    this.testStartTime = 0;
  }

  /**
   * Calculate average frame time
   */
  getAverageFrameTime() {
    // Filter out initialization frame (0ms)
    const validFrameTimings = this.frameTimings.filter(t => t > 0);
    if (validFrameTimings.length === 0) return 0;
    const sum = validFrameTimings.reduce((a, b) => a + b, 0);
    return sum / validFrameTimings.length;
  }

  /**
   * Get test results
   */
  getResults() {
    // Filter out initialization frame (0ms) from statistics
    const validFrameTimings = this.frameTimings.filter(t => t > 0);

    return {
      targetFPS: this.targetFPS,
      targetFrameTime: this.targetFrameTime,
      peakBlockCount: this.peakBlockCount,
      averageFrameTime: this.averageFrameTime,
      totalFrames: validFrameTimings.length,
      frameTimings: [...validFrameTimings],
      minFrameTime: Math.min(...validFrameTimings),
      maxFrameTime: Math.max(...validFrameTimings),
      medianFrameTime: this.getMedianFrameTime(validFrameTimings),
      hitMaxLimit: this.hitMaxLimit,
      maxBlockCount: this.maxBlockCount,
      maxDuration: this.maxDuration
    };
  }

  /**
   * Calculate median frame time
   */
  getMedianFrameTime(frameTimings = null) {
    const timings = frameTimings || this.frameTimings;
    if (timings.length === 0) return 0;
    const sorted = [...timings].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }
}
