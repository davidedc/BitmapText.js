# BitmapText.js Performance Profiling Suite

Comprehensive profiling infrastructure for analyzing and optimizing BitmapText.js performance.

## Quick Start

### Run Node.js Profiling

```bash
# Profile both benchmarks
./profile-node-simple.sh

# Generate comprehensive report
node generate-node-only-report.js
```

### Profile Browser Benchmarks

```bash
# Open browser profiling suite
open profile-browser-manual.html

# Follow on-screen instructions for Chrome DevTools profiling
```

## Reports

### 📄 Main Report (Start Here!)
**[PERFORMANCE_ANALYSIS_REPORT.md](./PERFORMANCE_ANALYSIS_REPORT.md)**
- Comprehensive analysis with code-level details
- Ranked optimization opportunities
- Specific implementation recommendations
- Expected performance gains
- Code locations and examples

### 📋 Summary
**[SUMMARY.md](./SUMMARY.md)**
- Executive summary
- Quick reference for hotspots
- Implementation roadmap
- Expected outcomes

## Profiling Results

### Node.js Benchmarks

#### Measurement Benchmark
- **CPU Time:** 649.8ms
- **Top Hotspot:** `calculateAdvancement_CssPx` (45%)
- **Profile:** `output/node/measurement/*.cpuprofile`

#### Rendering Benchmark
- **CPU Time:** 5,890.3ms
- **Top Hotspot:** Anonymous function (62%)
- **Profile:** `output/node/rendering/*.cpuprofile`

### Browser Benchmarks
- **Tool:** `profile-browser-manual.html`
- **Method:** Manual profiling with Chrome DevTools
- **Features:** Live instrumentation, data export

## Viewing CPU Profiles

### Chrome DevTools
1. Open: `chrome://inspect`
2. Click: "Open dedicated DevTools for Node"
3. Go to: Profiler tab
4. Click: Load button
5. Select: `output/node/**/*.cpuprofile`

### Analysis
- Flame graph shows function call hierarchy
- Self time indicates function-specific CPU usage
- Total time includes all nested calls

## Top 6 Optimization Opportunities

| Rank | Function | Impact | Gain | Priority |
|------|----------|--------|------|----------|
| 1 | calculateAdvancement_CssPx | 45% | 35-40% | 🔴 CRITICAL |
| 2 | measureText loop | 18.5% | 20-25% | 🔴 HIGH |
| 3 | hasGlyph validation | 13.3% | 30-40% | 🟠 HIGH |
| 4 | Anonymous function | 62% | 50-70% | 🔴 CRITICAL |
| 5 | drawImage batching | 10.6% | 15-20% | 🟠 MEDIUM |
| 6 | hasPositioning cache | 7.5% | 40-50% | 🟠 MEDIUM |

**Total Expected Gain: 2-3x faster performance**

## Files

### Profiling Scripts
- `profile-node-simple.sh` - Run Node.js profiling
- `profile-browser-manual.html` - Browser profiling suite
- `analyze-node-profiles.js` - Profile analyzer
- `generate-node-only-report.js` - Report generator
- `generate-comprehensive-report.js` - Full report (requires browser data)
- `profile-node-benchmarks.sh` - Advanced Node profiling (requires 0x)
- `profile-browser-benchmarks.js` - Automated browser profiling (requires Puppeteer)

### Output
- `output/node/measurement/` - Measurement benchmark profiles
- `output/node/rendering/` - Rendering benchmark profiles
- `output/node/analysis/` - Analyzed results
- `output/reports/` - Generated reports

### Documentation
- `README.md` - This file
- `PERFORMANCE_ANALYSIS_REPORT.md` - Main analysis report
- `SUMMARY.md` - Executive summary
- `package.json` - Node.js dependencies (optional)

## Re-running Profiling

After implementing optimizations:

```bash
# Re-profile
./profile-node-simple.sh

# Regenerate reports
node generate-node-only-report.js

# Compare results
diff output/reports/performance-report-*.txt
```

## Optimization Implementation Order

### Phase 1: Quick Wins (Week 1)
Target: 40-50% improvement in measurement

1. Inline `calculateAdvancement_CssPx`
   - Location: `src/runtime/BitmapText.js:547`
   - Move logic into measureText loop

2. Optimize measureText loop
   - Location: `src/runtime/BitmapText.js:333-344`
   - Batch metrics lookups
   - Inline calculations

3. Batch `hasGlyph` validation
   - Location: `src/runtime/BitmapText.js:307-311`
   - Single Set intersection

### Phase 2: Investigation (Week 2)
Target: Identify 62% hotspot

1. Identify anonymous function
   - Add named functions everywhere
   - Re-profile with better source maps

### Phase 3: Rendering (Week 3)
Target: 50-70% improvement in rendering

1. Fix identified anonymous function
2. Batch drawImage operations
3. Cache positioning checks

## Dependencies

### Required (Already Available)
- Node.js v14+ (for profiling)
- Chrome/Chromium (for viewing profiles)

### Optional (For Advanced Features)
```bash
# Install optional dependencies
npm install

# For flame graphs
npm install -g 0x

# For automated browser profiling
npm install puppeteer
```

## Troubleshooting

### "No profile generated"
- Ensure benchmarks are built: `cd ../../scripts && ./build-measurement-benchmark.sh`
- Check permissions: `chmod +x *.sh`

### "Cannot find module"
- Benchmarks need to be built first
- Run: `npm run build` from project root

### "Puppeteer install failed"
- Normal - automated browser profiling is optional
- Use `profile-browser-manual.html` instead

## Additional Resources

- **CPU Profiling:** [Node.js Profiling Guide](https://nodejs.org/en/docs/guides/simple-profiling/)
- **Chrome DevTools:** [Performance Profiling](https://developer.chrome.com/docs/devtools/performance/)
- **Flame Graphs:** [Brendan Gregg's Guide](https://www.brendangregg.com/flamegraphs.html)

## Support

For questions or issues:
1. Review `PERFORMANCE_ANALYSIS_REPORT.md` for detailed explanations
2. Examine CPU profiles in Chrome DevTools
3. Check source code locations mentioned in reports

---

**Last Updated:** 2025-11-06
**Status:** ✅ Profiling Complete, Ready for Optimization
