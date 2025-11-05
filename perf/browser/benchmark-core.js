/**
 * Benchmark Core Logic for BitmapText.js
 * Orchestrates performance testing for both BitmapText and HTML5 Canvas
 */

class BenchmarkCore {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      throw new Error(`Canvas with id '${canvasId}' not found`);
    }

    this.ctx = this.canvas.getContext('2d');
    this.options = {
      fontFamily: options.fontFamily || 'Arial',
      fontStyle: options.fontStyle || 'normal',
      fontWeight: options.fontWeight || 'normal',
      fontSize: options.fontSize || 19,
      pixelDensity: options.pixelDensity || 1,
      testBlock: options.testBlock || TEST_BLOCK_5_LINES,
      lineHeight: options.lineHeight || 25,
      targetFPS: options.targetFPS || 60,
      consecutiveFramesThreshold: options.consecutiveFramesThreshold || 10,
      ...options
    };

    this.fontProperties = null;
    this.results = {
      config: null,
      fontLoading: null,
      bitmapTextBlack: null,
      bitmapTextColored: null,
      canvasBlack: null,
      canvasColored: null,
      bundleType: options.bundleType || 'unbundled'
    };

    this.currentTest = null;
  }

  /**
   * Initialize and run all benchmarks
   */
  async runAllBenchmarks(progressCallback = null) {
    console.log('🚀 Starting benchmark suite...');

    // Store configuration
    this.results.config = {
      fontFamily: this.options.fontFamily,
      fontStyle: this.options.fontStyle,
      fontWeight: this.options.fontWeight,
      fontSize: this.options.fontSize,
      pixelDensity: this.options.pixelDensity,
      blockLineCount: this.options.testBlock.length,
      targetFPS: this.options.targetFPS,
      consecutiveFramesThreshold: this.options.consecutiveFramesThreshold,
      bundleType: this.results.bundleType,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    };

    // Load font
    if (progressCallback) progressCallback({ stage: 'font-loading', message: 'Loading font...' });
    await this.loadFont();

    // Run BitmapText tests
    if (progressCallback) progressCallback({ stage: 'bitmaptext-black', message: 'Testing BitmapText (black)...' });
    this.results.bitmapTextBlack = await this.runBitmapTextTest('#000000');

    if (progressCallback) progressCallback({ stage: 'bitmaptext-colored', message: 'Testing BitmapText (colored)...' });
    this.results.bitmapTextColored = await this.runBitmapTextTest('#0000FF');

    // Run Canvas tests
    if (progressCallback) progressCallback({ stage: 'canvas-black', message: 'Testing HTML5 Canvas (black)...' });
    this.results.canvasBlack = await this.runCanvasTest('#000000');

    if (progressCallback) progressCallback({ stage: 'canvas-colored', message: 'Testing HTML5 Canvas (colored)...' });
    this.results.canvasColored = await this.runCanvasTest('#0000FF');

    if (progressCallback) progressCallback({ stage: 'complete', message: 'Benchmark complete!' });

    console.log('✅ Benchmark suite complete');
    return this.results;
  }

  /**
   * Load BitmapText font
   */
  async loadFont() {
    const startTime = performance.now();

    this.fontProperties = new FontProperties(
      this.options.pixelDensity,
      this.options.fontFamily,
      this.options.fontStyle,
      this.options.fontWeight,
      this.options.fontSize
    );

    const isFileProtocol = window.location.href.includes("file://");

    try {
      await BitmapText.loadFont(this.fontProperties.idString, {
        isFileProtocol,
        onProgress: (loaded, total) => {
          console.log(`Font loading: ${loaded}/${total}`);
        }
      });

      const loadTime = performance.now() - startTime;
      this.results.fontLoading = {
        success: true,
        loadTime,
        fontId: this.fontProperties.idString
      };

      console.log(`✅ Font loaded in ${loadTime.toFixed(2)}ms`);
    } catch (error) {
      this.results.fontLoading = {
        success: false,
        error: error.message
      };
      throw error;
    }
  }

  /**
   * Run BitmapText performance test
   */
  runBitmapTextTest(color) {
    return new Promise((resolve) => {
      const textProperties = new TextProperties({
        textColor: color,
        textBaseline: 'top',
        textAlign: 'left',
        kerning: true
      });

      const tester = new FPSTester({
        targetFPS: this.options.targetFPS,
        consecutiveFramesThreshold: this.options.consecutiveFramesThreshold
      });

      const renderCallback = (blockCount) => {
        this.clearCanvas();
        this.renderBitmapTextBlocks(blockCount, textProperties);
      };

      const completeCallback = (results) => {
        resolve({
          method: 'BitmapText',
          color,
          ...results
        });
      };

      tester.start(renderCallback, null, completeCallback);
      this.currentTest = tester;
    });
  }

  /**
   * Run HTML5 Canvas performance test
   */
  runCanvasTest(color) {
    return new Promise((resolve) => {
      const tester = new FPSTester({
        targetFPS: this.options.targetFPS,
        consecutiveFramesThreshold: this.options.consecutiveFramesThreshold
      });

      const renderCallback = (blockCount) => {
        this.clearCanvas();
        this.renderCanvasBlocks(blockCount, color);
      };

      const completeCallback = (results) => {
        resolve({
          method: 'HTML5 Canvas',
          color,
          ...results
        });
      };

      tester.start(renderCallback, null, completeCallback);
      this.currentTest = tester;
    });
  }

  /**
   * Render multiple blocks using BitmapText
   */
  renderBitmapTextBlocks(blockCount, textProperties) {
    const blockHeight = this.options.testBlock.length * this.options.lineHeight;
    let yOffset = 10;

    for (let i = 0; i < blockCount; i++) {
      // Render each line in the block
      this.options.testBlock.forEach((line, lineIndex) => {
        const y = yOffset + (lineIndex * this.options.lineHeight);
        BitmapText.drawTextFromAtlas(this.ctx, line, 10, y, this.fontProperties, textProperties);
      });

      yOffset += blockHeight + 10; // Add spacing between blocks

      // Wrap to new column if needed
      if (yOffset > this.canvas.height - blockHeight) {
        yOffset = 10;
      }
    }
  }

  /**
   * Render multiple blocks using HTML5 Canvas
   */
  renderCanvasBlocks(blockCount, color) {
    const blockHeight = this.options.testBlock.length * this.options.lineHeight;
    let yOffset = 10;

    // Setup canvas font
    this.ctx.font = `${this.options.fontStyle} ${this.options.fontWeight} ${this.options.fontSize}px ${this.options.fontFamily}`;
    this.ctx.fillStyle = color;
    this.ctx.textBaseline = 'top';
    this.ctx.textAlign = 'left';

    for (let i = 0; i < blockCount; i++) {
      // Render each line in the block
      this.options.testBlock.forEach((line, lineIndex) => {
        const y = yOffset + (lineIndex * this.options.lineHeight);
        this.ctx.fillText(line, 10, y);
      });

      yOffset += blockHeight + 10; // Add spacing between blocks

      // Wrap to new column if needed
      if (yOffset > this.canvas.height - blockHeight) {
        yOffset = 10;
      }
    }
  }

  /**
   * Clear the canvas
   */
  clearCanvas() {
    this.ctx.fillStyle = 'white';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Stop current test
   */
  stopCurrentTest() {
    if (this.currentTest) {
      this.currentTest.stop();
      this.currentTest = null;
    }
  }

  /**
   * Get results
   */
  getResults() {
    return this.results;
  }
}
