# BitmapText.js Performance Benchmarks

Comprehensive performance testing suite for BitmapText.js, comparing bundled/unbundled versions in browser and Node.js environments.

## Overview

The performance testing system measures:
- **Font loading time** - How quickly fonts are loaded and initialized
- **Rendering performance** - How many text blocks can be rendered while maintaining 60fps
- **Fast vs slow path** - Black text (optimized) vs colored text (composition)
- **Bundle comparison** - Bundled vs unbundled version performance
- **Platform differences** - Browser vs Node.js rendering characteristics

## Testing Methodology

### Browser Tests
Browser tests use a **three-phase progressive FPS testing approach** to handle asynchronous rendering:

**Phase 1 - Coarse Discovery (Rapid)**
1. Start with 10 text blocks
2. Render blocks each frame using `requestAnimationFrame`
3. Measure frame time with high-resolution RAF timestamps
4. Increase load every 30 frames with adaptive increments (20% → 50% → 100%)
5. Continue until 10 consecutive frames exceed 16.67ms (60fps threshold)

**Phase 2 - Medium Refinement (Efficient)**
1. Back off to last known good block count
2. Increase load by fixed 10% every 30 frames
3. Continue until 10 consecutive frames exceed threshold
4. Narrows down the performance ceiling efficiently

**Phase 3 - Fine Refinement (Precise)**
1. Back off to last known good block count
2. Increase load by fixed +5 blocks every 30 frames
3. Continue until 10 consecutive frames exceed threshold
4. Finds exact performance limit within ±5 blocks

This three-phase approach combines speed (coarse discovery), efficiency (medium refinement), and precision (fine refinement), accounting for browser asynchronous rendering while providing accurate measurements.

### Node.js Tests
Node.js tests use **adaptive iteration timing**:

1. Render a single block and measure time
2. If time < 10ms: render 100 blocks and divide time
3. If time < 1ms: render 1000 blocks and divide time
4. Ensure minimum test duration of 100ms for reliable measurements
5. Test both bundled and unbundled versions
6. Generate HTML report file

## Directory Structure

```
perf/
├── browser/
│   ├── rendering-benchmark.html           # Unbundled browser test
│   ├── rendering-benchmark-bundled.html   # Bundled browser test
│   ├── benchmark-core.js                  # Core benchmark logic
│   ├── fps-tester.js                      # Progressive FPS testing engine
│   ├── report-generator.js                # Browser report generator
│   └── styles.css                         # Report styling
├── node/
│   ├── run-benchmarks.sh                  # Runner script (builds + runs both)
│   ├── node-report-generator.js           # Node.js HTML report generator
│   └── dist/                              # Built executables (generated)
│       ├── rendering-benchmark-unbundled.bundle.js
│       ├── rendering-benchmark-bundled.js
│       ├── results-unbundled-[timestamp].json
│       ├── results-bundled-[timestamp].json
│       ├── results-combined-[timestamp].json
│       └── report-[timestamp].html
└── README.md                              # This file

Source files (used for building):
src/
├── node/
│   ├── rendering-benchmark-main.js        # Unbundled version source
│   └── rendering-benchmark-bundled-main.js # Bundled version source
└── shared/
    └── test-data.js                       # Shared test text blocks

Build scripts:
scripts/
└── build-rendering-benchmark.sh           # Builds both benchmark versions
```

## Running Browser Tests

### Option 1: Unbundled Version
Open in browser:
```
perf/browser/rendering-benchmark.html
```

### Option 2: Bundled Version
Open in browser:
```
perf/browser/rendering-benchmark-bundled.html
```

### Steps:
1. Click "Start Benchmark" button
2. Wait for tests to complete (typically 1-3 minutes per test)
   - BitmapText colored: ~30 seconds (low block count)
   - BitmapText black: ~1-2 minutes (medium block count)
   - Canvas: ~2-3 minutes (high block count, three-phase refinement)
3. Scroll down to view detailed HTML report
4. Report includes:
   - Test configuration
   - Font loading performance
   - Peak block counts at 60fps
   - Performance comparisons with ratios
   - Visual charts
   - Raw data

### What's Tested:
- BitmapText (black text) - Fast path optimization
- BitmapText (colored text) - Slow path with composition
- HTML5 Canvas (black text) - Native browser rendering baseline
- HTML5 Canvas (colored text) - Native colored text baseline

## Running Node.js Tests

### Quick Start (Recommended)
From project root:
```bash
./perf/node/run-benchmarks.sh
```

This script will:
1. Build both unbundled and bundled benchmarks
2. Run unbundled benchmark
3. Run bundled benchmark
4. Combine results
5. Generate HTML report
6. Print summary statistics

### Manual Build & Run
```bash
# Build benchmarks
./scripts/build-rendering-benchmark.sh

# Run individual benchmarks
node perf/node/dist/rendering-benchmark-unbundled.bundle.js
node perf/node/dist/rendering-benchmark-bundled.js
```

### Output
The benchmark generates:
- `results-unbundled-[timestamp].json` - Unbundled version results
- `results-bundled-[timestamp].json` - Bundled version results
- `results-combined-[timestamp].json` - Combined comparison data
- `report-[timestamp].html` - Visual HTML report
- Console summary with key statistics

### What's Tested:
- Single block (black) - Minimum overhead
- Single block (colored) - Fast vs slow path
- 10 blocks (black) - Moderate load
- 10 blocks (colored) - Moderate load, slow path
- 50 blocks (black) - High load
- 50 blocks (colored) - High load, slow path

## Test Configuration

### Browser Test Parameters
```javascript
{
  fontFamily: 'Arial',
  fontStyle: 'normal',
  fontWeight: 'normal',
  fontSize: 19,
  pixelDensity: 1,
  testBlock: TEST_BLOCK_5_LINES,  // 5 pangram lines
  lineHeight: 25,
  targetFPS: 60,                  // 16.67ms per frame
  consecutiveFramesThreshold: 10, // 10 frames to confirm (all phases)
  framesUntilIncrease: 30,        // Increase every 30 frames (0.5s)
  maxBlockCount: 20000,           // Safety limit for very fast renderers
  maxDuration: 180000,            // 180 seconds (3 minutes) max
  bundleType: 'unbundled' | 'bundled'
}
```

### Node.js Test Parameters
```javascript
{
  testBlock: TEST_BLOCK_5_LINES,  // 5 pangram lines
  blockCounts: [1, 10, 50],       // Blocks to test
  colors: ['#000000', '#0000FF'], // Black and blue
  minDuration: 100                // Minimum 100ms per test
}
```

## Understanding Results

### Browser Report Sections

**1. Test Configuration**
- Font details, target FPS, threshold settings
- Browser user agent

**2. Font Loading Performance**
- Time to load font assets (atlas images + metrics)

**3. Performance Results Table**
- Peak block count: Maximum blocks rendered while maintaining 60fps (higher = better)
  - Found using three-phase testing (accurate within ±5 blocks)
  - Represents the performance ceiling for each renderer
- Average frame time: Mean rendering time per frame across entire test
- Min/max frame times: Fastest and slowest individual frames
- Total frames tested: Number of frames rendered during all three phases

**4. Performance Comparisons**
- BitmapText vs Canvas ratios
- Black vs colored text comparisons
- Analysis of performance differences

**5. Performance Charts**
- Visual bar charts of peak blocks
- Frame time comparisons

**6. Raw Data**
- Complete JSON results for further analysis

### Node.js Report Sections

**1. Platform Information**
- OS, Node.js version, architecture

**2. Font Loading Performance**
- Unbundled vs bundled load times

**3. Bundled vs Unbundled Comparison**
- Side-by-side performance comparison
- Ratio analysis
- Percentage differences

**4. Detailed Results**
- Iterations performed
- Average time per operation
- Operations per second

**5. Performance Charts**
- Visual comparison of render times

**6. Raw Data**
- Complete JSON for analysis

## Interpreting Performance Ratios

### BitmapText vs Canvas
Ratios are calculated as: `BitmapText peak blocks / Canvas peak blocks`

- **> 1.2x (faster)** - BitmapText significantly faster
- **1.05x - 1.2x (faster)** - BitmapText slightly faster
- **0.95x - 1.05x** - Similar performance
- **0.8x - 0.95x (Nx slower)** - BitmapText slightly slower (e.g., "0.90x (1.11x slower)")
- **< 0.8x (Nx slower)** - BitmapText significantly slower (e.g., "0.20x (5.00x slower)")

When performance is slower, the report shows both the ratio and its inverse for clarity: `0.20x (5.00x slower)` means BitmapText can handle only 20% of the blocks Canvas can, or equivalently, Canvas is 5x faster.

### Black vs Colored Text
- Black text uses optimized fast path (direct bitmap copy)
- Colored text uses slow path (canvas composition operations)
- Expect 1.5x - 3x performance difference

### Bundled vs Unbundled
- Should have similar runtime performance
- Bundled has smaller file size (~32-33KB vs many files)
- Bundled may have slightly faster initial load

## Test Data

Multi-line pangram blocks used for realistic text rendering:

```javascript
TEST_BLOCK_5_LINES = [
  "The quick brown fox jumps over the lazy dog",
  "Pack my box with five dozen liquor jugs",
  "How vexingly quick daft zebras jump",
  "Sphinx of black quartz, judge my vow",
  "Two driven jocks help fax my big quiz"
];
```

## Performance Optimization Tips

Based on benchmark results:

1. **Use black text when possible** - 1.5-3x faster than colored text
2. **Pre-load fonts** - Load all required fonts at startup, not on-demand
3. **Batch rendering** - Render multiple text strings in one frame rather than spreading across frames
4. **Choose appropriate bundle** - Use bundled version for production (smaller size, faster initial load)
5. **Monitor FPS** - If rendering many text strings, test on target hardware to ensure 60fps

## Troubleshooting

### Browser Tests

**Canvas not visible:**
- Check canvas element exists with id "benchmark-canvas"
- Ensure canvas dimensions are reasonable (1200x800)

**Tests not starting:**
- Open browser console for errors
- Check font files are accessible at `../../font-assets/`
- For file:// protocol, ensure JS-wrapped font assets exist

**Tests too fast/slow:**
- Adjust `targetFPS` (try 30 or 45 instead of 60)
- Adjust `consecutiveFramesThreshold` (try 5 instead of 10 for faster confirmation)
- Modify `framesUntilIncrease` (default 30, try 60 for slower progression)
- Adjust `maxDuration` if tests timeout (default 180 seconds)
- For very fast renderers, increase `maxBlockCount` (default 20000)

### Node.js Tests

**Module not found errors:**
- Ensure you're in the correct directory
- Check all source files exist in `../../src/`
- Verify bundle exists at `../../dist/bitmaptext-node.min.js`

**Tests complete too quickly:**
- Increase `minDuration` parameter (default 100ms)
- Test with more blocks

**Memory issues:**
- Reduce block counts being tested
- Clear Node.js cache: `node --expose-gc rendering-benchmark.js`

## Extending Tests

### Adding New Test Scenarios

**Browser:**
Edit `benchmark-core.js` to add new test methods:
```javascript
async runCustomTest(params) {
  // Custom test implementation
}
```

**Node.js:**
Edit `rendering-benchmark.js` testCases array:
```javascript
const testCases = [
  // Add new test case
  { name: 'Custom test', color: '#FF0000', blockCount: 100 }
];
```

### Changing Test Parameters

**FPS Target:**
```javascript
targetFPS: 30  // Test at 30fps instead of 60fps
```

**Consecutive Frames:**
```javascript
consecutiveFramesThreshold: 5  // Faster confirmation
```

**Test Block:**
```javascript
testBlock: TEST_BLOCK_10_LINES  // Use 10-line blocks
```

## CI/CD Integration

### Automated Browser Tests
Use headless browser testing:
```bash
# Example with Puppeteer
npm install puppeteer
node scripts/run-browser-benchmark.js
```

### Automated Node.js Tests
```bash
# Run and save results
node perf/node/rendering-benchmark.js
# Results saved to perf/node/results-[timestamp].json
```

### Performance Regression Detection
Compare results over time:
```bash
# Save baseline
cp perf/node/results-latest.json perf/node/baseline.json

# After changes, compare
node scripts/compare-performance.js baseline.json results-latest.json
```

## Contributing

When adding performance tests:
1. Follow existing patterns (FPSTester for browser, measureTime for Node)
2. Document test methodology in comments
3. Generate HTML reports for visual analysis
4. Include raw JSON data for programmatic analysis
5. Test on multiple platforms/browsers
6. Update this README with new test descriptions

## License

MIT - Same as BitmapText.js
