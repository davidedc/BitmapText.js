/**
 * HTML Report Generator for BitmapText.js Performance Benchmarks
 * Generates visual reports with tables and charts
 */

class ReportGenerator {
  constructor(results) {
    this.results = results;
  }

  /**
   * Generate complete HTML report
   */
  generate() {
    const reportContainer = document.getElementById('report');
    if (!reportContainer) {
      console.error('Report container not found');
      return;
    }

    reportContainer.innerHTML = '';

    // Add sections
    this.addTitle(reportContainer);
    this.addConfigSection(reportContainer);
    this.addFontLoadingSection(reportContainer);
    this.addResultsTable(reportContainer);
    this.addComparisonSection(reportContainer);
    this.addChartsSection(reportContainer);
    this.addRawDataSection(reportContainer);
  }

  /**
   * Add title
   */
  addTitle(container) {
    const title = document.createElement('h1');
    title.textContent = 'BitmapText.js Performance Benchmark Report';
    container.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.className = 'subtitle';
    subtitle.textContent = `Generated on ${new Date(this.results.config.timestamp).toLocaleString()}`;
    container.appendChild(subtitle);
  }

  /**
   * Add configuration section
   */
  addConfigSection(container) {
    const section = this.createSection('Test Configuration', container);

    const config = this.results.config;
    const table = this.createTable([
      ['Parameter', 'Value'],
      ['Bundle Type', config.bundleType],
      ['Font', `${config.fontStyle} ${config.fontWeight} ${config.fontSize}px ${config.fontFamily}`],
      ['Pixel Density', config.pixelDensity],
      ['Test Block Lines', config.blockLineCount],
      ['Target FPS', `${config.targetFPS} fps (${(1000 / config.targetFPS).toFixed(2)}ms/frame)`],
      ['Consecutive Frames Threshold', config.consecutiveFramesThreshold],
      ['User Agent', config.userAgent]
    ]);

    section.appendChild(table);
  }

  /**
   * Add font loading section
   */
  addFontLoadingSection(container) {
    const section = this.createSection('Font Loading Performance', container);

    const loading = this.results.fontLoading;
    if (loading.success) {
      const table = this.createTable([
        ['Metric', 'Value'],
        ['Font ID', loading.fontId],
        ['Load Time', `${loading.loadTime.toFixed(2)}ms`],
        ['Status', '✅ Success']
      ]);
      section.appendChild(table);
    } else {
      const error = document.createElement('p');
      error.className = 'error';
      error.textContent = `❌ Error: ${loading.error}`;
      section.appendChild(error);
    }
  }

  /**
   * Add results table
   */
  addResultsTable(container) {
    const section = this.createSection('Performance Results', container);

    const data = [
      ['Test', 'Peak Blocks', 'Avg Frame Time', 'Min Frame Time', 'Max Frame Time', 'Total Frames']
    ];

    // Add results
    this.addResultRow(data, this.results.bitmapTextBlack, 'BitmapText (Black)');
    this.addResultRow(data, this.results.bitmapTextColored, 'BitmapText (Colored)');
    this.addResultRow(data, this.results.canvasBlack, 'HTML5 Canvas (Black)');
    this.addResultRow(data, this.results.canvasColored, 'HTML5 Canvas (Colored)');

    const table = this.createTable(data);
    section.appendChild(table);
  }

  /**
   * Add result row to table data
   */
  addResultRow(data, result, label) {
    if (result) {
      let peakBlocksDisplay = result.peakBlockCount.toString();
      if (result.hitMaxLimit) {
        peakBlocksDisplay = `${result.peakBlockCount} ⚠️ (hit limit)`;
      }

      data.push([
        label,
        peakBlocksDisplay,
        `${result.averageFrameTime.toFixed(2)}ms`,
        `${result.minFrameTime.toFixed(2)}ms`,
        `${result.maxFrameTime.toFixed(2)}ms`,
        result.totalFrames.toString()
      ]);
    }
  }

  /**
   * Add comparison section
   */
  addComparisonSection(container) {
    const section = this.createSection('Performance Comparisons', container);

    const comparisons = [];

    // BitmapText Black vs Canvas Black
    if (this.results.bitmapTextBlack && this.results.canvasBlack) {
      const ratio = this.results.bitmapTextBlack.peakBlockCount / this.results.canvasBlack.peakBlockCount;
      comparisons.push([
        'BitmapText (Black) vs Canvas (Black)',
        this.formatRatio(ratio),
        this.formatPerformance(ratio)
      ]);
    }

    // BitmapText Colored vs Canvas Colored
    if (this.results.bitmapTextColored && this.results.canvasColored) {
      const ratio = this.results.bitmapTextColored.peakBlockCount / this.results.canvasColored.peakBlockCount;
      comparisons.push([
        'BitmapText (Colored) vs Canvas (Colored)',
        this.formatRatio(ratio),
        this.formatPerformance(ratio)
      ]);
    }

    // BitmapText Black vs BitmapText Colored
    if (this.results.bitmapTextBlack && this.results.bitmapTextColored) {
      const ratio = this.results.bitmapTextBlack.peakBlockCount / this.results.bitmapTextColored.peakBlockCount;
      comparisons.push([
        'BitmapText Black vs Colored',
        this.formatRatio(ratio),
        'Fast path vs slow path'
      ]);
    }

    // Canvas Black vs Canvas Colored
    if (this.results.canvasBlack && this.results.canvasColored) {
      const ratio = this.results.canvasBlack.peakBlockCount / this.results.canvasColored.peakBlockCount;
      comparisons.push([
        'Canvas Black vs Colored',
        this.formatRatio(ratio),
        'Native rendering comparison'
      ]);
    }

    if (comparisons.length > 0) {
      const data = [['Comparison', 'Ratio', 'Analysis'], ...comparisons];
      const table = this.createTable(data);
      section.appendChild(table);
    }
  }

  /**
   * Format ratio
   */
  formatRatio(ratio) {
    if (ratio >= 1) {
      return `${ratio.toFixed(2)}x (faster)`;
    } else {
      const inverseFactor = (1 / ratio).toFixed(2);
      return `${ratio.toFixed(2)}x (${inverseFactor}x slower)`;
    }
  }

  /**
   * Format performance analysis
   */
  formatPerformance(ratio) {
    if (ratio >= 1.2) return '✅ Significantly faster';
    if (ratio >= 1.05) return '✅ Slightly faster';
    if (ratio >= 0.95) return '≈ Similar performance';
    if (ratio >= 0.8) return '⚠️ Slightly slower';
    return '❌ Significantly slower';
  }

  /**
   * Add charts section
   */
  addChartsSection(container) {
    const section = this.createSection('Performance Charts', container);

    // Peak blocks chart
    this.addBarChart(section, 'Peak Block Count Comparison', [
      { label: 'BitmapText\n(Black)', value: this.results.bitmapTextBlack?.peakBlockCount || 0, color: '#4CAF50' },
      { label: 'BitmapText\n(Colored)', value: this.results.bitmapTextColored?.peakBlockCount || 0, color: '#2196F3' },
      { label: 'Canvas\n(Black)', value: this.results.canvasBlack?.peakBlockCount || 0, color: '#FF9800' },
      { label: 'Canvas\n(Colored)', value: this.results.canvasColored?.peakBlockCount || 0, color: '#F44336' }
    ]);

    // Average frame time chart
    this.addBarChart(section, 'Average Frame Time (lower is better)', [
      { label: 'BitmapText\n(Black)', value: this.results.bitmapTextBlack?.averageFrameTime || 0, color: '#4CAF50' },
      { label: 'BitmapText\n(Colored)', value: this.results.bitmapTextColored?.averageFrameTime || 0, color: '#2196F3' },
      { label: 'Canvas\n(Black)', value: this.results.canvasBlack?.averageFrameTime || 0, color: '#FF9800' },
      { label: 'Canvas\n(Colored)', value: this.results.canvasColored?.averageFrameTime || 0, color: '#F44336' }
    ], 'ms');
  }

  /**
   * Add bar chart
   */
  addBarChart(container, title, data, unit = '') {
    const chartContainer = document.createElement('div');
    chartContainer.className = 'chart-container';

    const chartTitle = document.createElement('h4');
    chartTitle.textContent = title;
    chartContainer.appendChild(chartTitle);

    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 400;
    chartContainer.appendChild(canvas);

    const ctx = canvas.getContext('2d');

    // Draw chart
    const maxValue = Math.max(...data.map(d => d.value));
    const barWidth = 150;
    const barSpacing = 50;
    const chartHeight = 300;
    const chartTop = 50;

    data.forEach((item, index) => {
      const x = 50 + (index * (barWidth + barSpacing));
      const barHeight = (item.value / maxValue) * chartHeight;
      const y = chartTop + chartHeight - barHeight;

      // Draw bar
      ctx.fillStyle = item.color;
      ctx.fillRect(x, y, barWidth, barHeight);

      // Draw value
      ctx.fillStyle = '#000';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${item.value.toFixed(1)}${unit}`, x + barWidth / 2, y - 10);

      // Draw label
      ctx.font = '12px Arial';
      const lines = item.label.split('\n');
      lines.forEach((line, lineIndex) => {
        ctx.fillText(line, x + barWidth / 2, chartTop + chartHeight + 20 + (lineIndex * 15));
      });
    });

    container.appendChild(chartContainer);
  }

  /**
   * Add raw data section
   */
  addRawDataSection(container) {
    const section = this.createSection('Raw Data', container);

    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(this.results, null, 2);
    section.appendChild(pre);
  }

  /**
   * Create section
   */
  createSection(title, container) {
    const section = document.createElement('div');
    section.className = 'section';

    const heading = document.createElement('h2');
    heading.textContent = title;
    section.appendChild(heading);

    container.appendChild(section);
    return section;
  }

  /**
   * Create table
   */
  createTable(data) {
    const table = document.createElement('table');

    data.forEach((row, rowIndex) => {
      const tr = document.createElement('tr');

      row.forEach(cell => {
        const td = document.createElement(rowIndex === 0 ? 'th' : 'td');
        td.textContent = cell;
        tr.appendChild(td);
      });

      table.appendChild(tr);
    });

    return table;
  }
}
