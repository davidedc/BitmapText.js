// FontMetricsStoreFAB - Font Assets Building Class
// 
// This class extends FontMetricsStore to provide font assets building capabilities
// for font metrics data including glyph measurements, kerning tables, and positioning.
//
// DISTRIBUTION ROLE:
// - Part of "full toolkit" distribution for font assets building applications
// - Extends FontMetricsStore with building, validation, and optimization features
// - Provides extraction methods to create clean runtime FontMetricsStore instances
//
// ARCHITECTURE:
// - Inherits all runtime functionality from FontMetricsStore
// - Adds font assets building-specific methods and data structures  
// - Validates and optimizes font metrics during the building process
// - Generates minified metrics data for distribution
//
// KEY METHODS:
// - extractFontMetricsStoreInstance(): Creates clean runtime instance
// - Building-specific metrics calculation and validation methods
// - Integration with font assets building pipeline
class FontMetricsStoreFAB extends FontMetricsStore {
  constructor() {
    super();
  }

  // Extract a clean FontMetricsStore instance for runtime distribution
  // This removes FAB-specific functionality and provides only runtime data
  extractFontMetricsStoreInstance() {
    const instance = new FontMetricsStore();
    instance.kerningTables = this.kerningTables;
    instance.glyphsTextMetrics = this.glyphsTextMetrics;
    instance.spaceAdvancementOverrideForSmallSizesInPx = this.spaceAdvancementOverrideForSmallSizesInPx;
    instance.fontMetrics = this.fontMetrics;
    return instance;
  }

  // FAB-specific method to clear all kerning tables (used during regeneration)
  clearKerningTables() {
    this.kerningTables.clear();
  }

  // FAB-specific method to check if kerning table exists for a font
  kerningTableExists(fontProperties) {
    return this.kerningTables.has(fontProperties.key);
  }

  // Override parent method to add FAB-specific functionality if needed
  setKerningTable(fontProperties, kerningTable) {
    // Use parent class method which uses Maps
    super.setKerningTable(fontProperties, kerningTable);
  }

  // FAB-specific method to calculate and set font metrics from glyph data
  // This method is called during atlas building to extract positioning data
  calculateAndSetFontMetrics(fontProperties, glyphs) {
    for (let letter in glyphs) {
      let glyph = glyphs[letter];
      let letterTextMetrics = this.getGlyphsTextMetrics(fontProperties, letter);

      // Skip glyphs without valid tight canvas box
      if (!glyph.tightCanvasBox?.bottomRightCorner || !glyph.tightCanvasBox?.topLeftCorner) {
        continue;
      }

      // Calculate tight dimensions from glyph bounds
      const tightWidth =
        glyph.tightCanvasBox.bottomRightCorner.x -
        glyph.tightCanvasBox.topLeftCorner.x +
        1;
      const tightHeight =
        glyph.tightCanvasBox.bottomRightCorner.y -
        glyph.tightCanvasBox.topLeftCorner.y +
        1;

      // Calculate positioning offsets for atlas rendering
      const dx = - Math.round(letterTextMetrics.actualBoundingBoxLeft) * fontProperties.pixelDensity + glyph.tightCanvasBox.topLeftCorner.x;
      const dy = - tightHeight - glyph.tightCanvas.distanceBetweenBottomAndBottomOfCanvas + 1 * fontProperties.pixelDensity;

      // Set the calculated metrics
      const glyphKey = `${fontProperties.key}:${letter}`;
      this.fontMetrics.tightWidth.set(glyphKey, tightWidth);
      this.fontMetrics.tightHeight.set(glyphKey, tightHeight);
      this.fontMetrics.dx.set(glyphKey, dx);
      this.fontMetrics.dy.set(glyphKey, dy);
    }
  }

  // FAB-specific method to set xInAtlas positioning after atlas is built
  setGlyphPositionInAtlas(fontProperties, letter, xPosition) {
    const glyphKey = `${fontProperties.key}:${letter}`;
    this.fontMetrics.xInAtlas.set(glyphKey, xPosition);
  }

  setGlyphTextMetrics(fontProperties, letter, metrics) {
    const glyphKey = `${fontProperties.key}:${letter}`;
    this.glyphsTextMetrics.set(glyphKey, metrics);
  }

  // FAB-specific method to validate that all required metrics are present
  validateFontMetrics(fontProperties, expectedLetters) {
    const missingMetrics = [];
    
    for (const letter of expectedLetters) {
      const glyphKey = `${fontProperties.key}:${letter}`;
      const requiredMetrics = ['tightWidth', 'tightHeight', 'dx', 'dy', 'xInAtlas'];
      
      for (const metricType of requiredMetrics) {
        if (!this.fontMetrics[metricType].has(glyphKey)) {
          missingMetrics.push(`${letter}:${metricType}`);
        }
      }
      
      if (!this.glyphsTextMetrics.has(glyphKey)) {
        missingMetrics.push(`${letter}:textMetrics`);
      }
    }
    
    return missingMetrics;
  }
}