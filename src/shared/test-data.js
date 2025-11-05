/**
 * Shared test data for performance benchmarking
 * Multi-line text blocks for realistic rendering scenarios
 */

// 5-line pangram block for testing
const TEST_BLOCK_5_LINES = [
  "The quick brown fox jumps over the lazy dog",
  "Pack my box with five dozen liquor jugs",
  "How vexingly quick daft zebras jump",
  "Sphinx of black quartz, judge my vow",
  "Two driven jocks help fax my big quiz"
];

// 10-line extended test block
const TEST_BLOCK_10_LINES = [
  "The quick brown fox jumps over the lazy dog",
  "Pack my box with five dozen liquor jugs",
  "How vexingly quick daft zebras jump",
  "Sphinx of black quartz, judge my vow",
  "Two driven jocks help fax my big quiz",
  "Amazingly few discotheques provide jukeboxes",
  "The five boxing wizards jump quickly",
  "Jackdaws love my big sphinx of quartz",
  "Bright vixens jump; dozy fowl quack",
  "Quick zephyrs blow, vexing daft Jim"
];

// Single long line for stress testing
const TEST_LONG_LINE = "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs. How vexingly quick daft zebras jump. Sphinx of black quartz, judge my vow. Two driven jocks help fax my big quiz. The five boxing wizards jump quickly.";

// Export for both browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
  // Node.js
  module.exports = {
    TEST_BLOCK_5_LINES,
    TEST_BLOCK_10_LINES,
    TEST_LONG_LINE
  };
}
// Browser globals will be available via script tag
