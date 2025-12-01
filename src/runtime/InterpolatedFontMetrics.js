// InterpolatedFontMetrics - Wrapper for FontMetrics that scales metric values
//
// This is a RUNTIME class used by BitmapText to support font sizes < 9px.
//
// USAGE:
// - Font sizes < 9px interpolate metrics from size 9px
// - All metric values (widths, kerning, baselines) are scaled proportionally
// - Marker property `isInterpolatedMetrics` enables conditional rounding in BitmapText
//
// ARCHITECTURE:
// - Wraps a FontMetrics instance (typically size 9px)
// - Scales all metric values by interpolationFactor = targetSize / 9
// - Delegates glyph checking and kerning table access to base metrics
// - Used exclusively for rendering placeholder rectangles (atlases never loaded)
//
// DEPENDENCIES:
// - Requires FontMetrics.js to be loaded first
// - Used by BitmapText.js for sizes < MIN_RENDERABLE_SIZE (9px)
//
/**
 * InterpolatedFontMetrics - Wrapper for FontMetrics that scales all values
 *
 * Used for font sizes < 9px which interpolate metrics from size 9px.
 * All metric values (widths, kerning, baselines) are scaled proportionally.
 *
 * Marker property `isInterpolatedMetrics` enables conditional rounding in
 * calculateAdvancement_CssPx() to preserve linear scaling behavior.
 */
class InterpolatedFontMetrics {
  constructor(baseFontMetrics, targetSize) {
    this.baseFontMetrics = baseFontMetrics;
    this.targetSize = targetSize;
    this.interpolationFactor = targetSize / 9;  // MIN_RENDERABLE_SIZE constant value

    // Marker for detection in calculateAdvancement_CssPx()
    // Enables float positioning instead of integer rounding
    this.isInterpolatedMetrics = true;
  }

  // Interpolate character metrics by scaling all values
  getCharacterMetrics(char) {
    const origMetrics = this.baseFontMetrics.getCharacterMetrics(char);
    if (!origMetrics) return null;

    return {
      actualBoundingBoxLeft: origMetrics.actualBoundingBoxLeft * this.interpolationFactor,
      actualBoundingBoxRight: origMetrics.actualBoundingBoxRight * this.interpolationFactor,
      actualBoundingBoxAscent: origMetrics.actualBoundingBoxAscent * this.interpolationFactor,
      actualBoundingBoxDescent: origMetrics.actualBoundingBoxDescent * this.interpolationFactor,
      fontBoundingBoxAscent: origMetrics.fontBoundingBoxAscent * this.interpolationFactor,
      fontBoundingBoxDescent: origMetrics.fontBoundingBoxDescent * this.interpolationFactor,
      width: origMetrics.width * this.interpolationFactor
    };
  }

  // Delegate glyph checking to base metrics
  hasGlyph(char) {
    return this.baseFontMetrics.hasGlyph(char);
  }

  // Interpolate kerning adjustment by scaling
  getKerningAdjustment(leftChar, rightChar) {
    const origKerning = this.baseFontMetrics.getKerningAdjustment(leftChar, rightChar);
    return origKerning * this.interpolationFactor;
  }

  // Delegate kerning table getter to base metrics
  getKerningTable() {
    return this.baseFontMetrics.getKerningTable();
  }

  // Interpolate space advancement override if present
  getSpaceAdvancementOverride() {
    const override = this.baseFontMetrics.getSpaceAdvancementOverride();
    return override !== null ? override * this.interpolationFactor : null;
  }

  // Property getters
  get fontSize() {
    return this.targetSize;
  }

  get alphabeticBaseline_ab() {
    return this.baseFontMetrics.alphabeticBaseline_ab * this.interpolationFactor;
  }

  get hangingBaseline_ab() {
    return this.baseFontMetrics.hangingBaseline_ab * this.interpolationFactor;
  }

  get ideographicBaseline_ab() {
    return this.baseFontMetrics.ideographicBaseline_ab * this.interpolationFactor;
  }

  get middleBaseline_ab() {
    return this.baseFontMetrics.middleBaseline_ab * this.interpolationFactor;
  }

  get topBaseline_ab() {
    return this.baseFontMetrics.topBaseline_ab * this.interpolationFactor;
  }
}
