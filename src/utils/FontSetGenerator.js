// FontSetGenerator - Expands font set specifications into FontProperties instances
// Supports multi-set union format with range expansion and memory-efficient iteration
//
// Purpose: Generate sets of font configurations for testing, asset building,
// sample generation, or any scenario requiring systematic font property exploration.
// Doesn't keep configurations into memory at once.
//
// Input Format: JSON specification with "fontSets" array
// Each set defines a cross-product of font properties using arrays and ranges
//
// See docs/FONT_SET_FORMAT.md for complete format documentation

class FontSetGenerator {

  // Validation constants (same as FontPropertiesFAB)
  static VALID_STYLES = ['normal', 'italic', 'oblique'];
  static VALID_WEIGHTS = ['normal', 'bold', 'bolder', 'lighter',
                          '100', '200', '300', '400', '500', '600', '700', '800', '900'];

  // Internal state for iteration
  #spec;
  #expandedSets;
  #totalCount;

  /**
   * Creates a new FontSetGenerator from a JSON specification
   *
   * @param {Object} spec - JSON specification with fontSets array
   * @param {Array<Object>} spec.fontSets - Array of font set definitions
   *
   * Each fontSet object contains:
   * @param {string} [fontSet.name] - Optional descriptive name for the set
   * @param {Array} fontSet.density - Pixel densities (e.g., [1.0, 2.0])
   * @param {Array} fontSet.families - Font family names (e.g., ["Arial", "Georgia"])
   * @param {Array} fontSet.styles - Font styles: 'normal', 'italic', 'oblique'
   * @param {Array} fontSet.weights - Font weights: 'normal', 'bold', etc. or numeric ranges
   * @param {Array} fontSet.sizes - Font sizes (numbers or ranges)
   *
   * Arrays can contain:
   * - Single values: 1.0, "Arial"
   * - Multiple values: [1.0, 2.0]
   * - Ranges (3-element arrays): [start, stop, step] - e.g., [12, 24, 0.5]
   *
   * Example:
   * {
   *   "fontSets": [
   *     {
   *       "name": "Arial Standard",
   *       "density": [1.0, 2.0],
   *       "families": ["Arial"],
   *       "styles": ["normal", "italic"],
   *       "weights": ["normal", [400, 700, 100]],
   *       "sizes": [[12, 24, 0.5]]
   *     }
   *   ]
   * }
   */
  constructor(spec) {
    this.#validateSpec(spec);
    this.#spec = spec;

    // Pre-expand sets for efficient iteration and counting
    // This expands ranges but doesn't create all FontProperties instances
    this.#expandedSets = this.#spec.fontSets.map(set => this.#expandSet(set));

    // Calculate total count across all sets
    this.#totalCount = this.#expandedSets.reduce((sum, set) => sum + set.count, 0);
  }

  /**
   * Returns the total number of font configurations in all sets
   * Calculated without generating all instances (memory-efficient)
   *
   * @returns {number} Total count of font configurations
   */
  getCount() {
    return this.#totalCount;
  }

  /**
   * Creates an iterator that yields FontProperties instances one at a time
   * Memory-efficient: generates instances on-demand rather than storing all
   *
   * @returns {Iterator<FontProperties>} Iterator yielding font configurations
   *
   * Usage:
   * const generator = new FontSetGenerator(spec);
   * const iterator = generator.iterator();
   *
   * for (const fontProps of iterator) {
   *   console.log(fontProps.idString);
   *   // Use fontProps for testing, asset building, sample generation, etc.
   * }
   */
  iterator() {
    return this.#createIterator();
  }

  /**
   * Convenience method to iterate over all font configurations
   * Calls callback function for each FontProperties instance
   *
   * @param {Function} callback - Function to call for each font configuration
   * @param {FontProperties} callback.fontProps - Current font configuration
   * @param {number} callback.index - Current index (0-based)
   * @param {number} callback.total - Total number of configurations
   *
   * Usage:
   * generator.forEach((fontProps, index, total) => {
   *   console.log(`[${index+1}/${total}] ${fontProps.idString}`);
   * });
   */
  forEach(callback) {
    let index = 0;
    const total = this.#totalCount;

    for (const fontProps of this.iterator()) {
      callback(fontProps, index, total);
      index++;
    }
  }

  /**
   * Returns array of set metadata (name and count) without generating instances
   * Useful for displaying set information before iteration
   *
   * @returns {Array<{name: string, count: number}>} Array of set information
   */
  getSetsInfo() {
    return this.#expandedSets.map((set, index) => ({
      name: set.name || `Set ${index + 1}`,
      count: set.count
    }));
  }

  // ============================================================================
  // PRIVATE METHODS - Validation
  // ============================================================================

  /**
   * Validates the JSON specification structure
   * Throws descriptive errors for invalid input
   */
  #validateSpec(spec) {
    if (!spec || typeof spec !== 'object') {
      throw new Error('Font set specification must be an object');
    }

    if (!Array.isArray(spec.fontSets)) {
      throw new Error('Font set specification must contain "fontSets" array');
    }

    if (spec.fontSets.length === 0) {
      throw new Error('Font sets array cannot be empty');
    }

    // Validate each set
    spec.fontSets.forEach((set, index) => {
      const setName = set.name || `Set ${index + 1}`;

      // Required fields
      const requiredFields = ['density', 'families', 'styles', 'weights', 'sizes'];
      for (const field of requiredFields) {
        if (!set[field]) {
          throw new Error(`${setName}: Missing required field "${field}"`);
        }
      }

      // Validate array structure
      for (const field of requiredFields) {
        const value = set[field];
        if (!Array.isArray(value)) {
          throw new Error(`${setName}: Field "${field}" must be an array`);
        }
        if (value.length === 0) {
          throw new Error(`${setName}: Field "${field}" cannot be empty`);
        }
      }
    });
  }

  /**
   * Validates a single font property configuration
   * Throws descriptive errors for invalid values
   */
  #validateFontProperties(density, family, style, weight, size, setName) {
    // Validate pixel density
    if (!density || density <= 0) {
      throw new Error(`${setName}: Invalid pixelDensity: ${density} - must be positive number`);
    }

    // Validate font family
    if (!family || typeof family !== 'string') {
      throw new Error(`${setName}: Invalid fontFamily: ${family} - must be non-empty string`);
    }

    // Validate font style
    if (!FontSetGenerator.VALID_STYLES.includes(style)) {
      throw new Error(`${setName}: Invalid fontStyle: ${style} - must be one of: ${FontSetGenerator.VALID_STYLES.join(', ')}`);
    }

    // Validate font weight
    if (!FontSetGenerator.VALID_WEIGHTS.includes(weight)) {
      throw new Error(`${setName}: Invalid fontWeight: ${weight} - must be one of: ${FontSetGenerator.VALID_WEIGHTS.join(', ')}`);
    }

    // Validate font size
    if (!size || size <= 0) {
      throw new Error(`${setName}: Invalid fontSize: ${size} - must be positive number`);
    }
  }

  // ============================================================================
  // PRIVATE METHODS - Expansion
  // ============================================================================

  /**
   * Expands a single font set into arrays of values and calculates count
   * Expands ranges but doesn't create FontProperties instances yet
   *
   * @returns {Object} Expanded set with arrays and count
   */
  #expandSet(set) {
    const expanded = {
      name: set.name,
      densities: this.#expandArray(set.density),
      families: this.#expandArray(set.families),
      styles: this.#expandArray(set.styles),
      weights: this.#expandArray(set.weights),
      sizes: this.#expandArray(set.sizes)
    };

    // Calculate cross-product count
    expanded.count =
      expanded.densities.length *
      expanded.families.length *
      expanded.styles.length *
      expanded.weights.length *
      expanded.sizes.length;

    return expanded;
  }

  /**
   * Expands an array that may contain values, arrays, or ranges
   * Handles nested arrays and flattens the result
   *
   * @param {Array} arr - Array that may contain single values or ranges
   * @returns {Array} Flattened array of values
   *
   * Examples:
   * [1.0] → [1.0]
   * [1.0, 2.0] → [1.0, 2.0]
   * [[1.0, 2.0, 0.5]] → [1.0, 1.5, 2.0]
   * ["normal", [400, 600, 100]] → ["normal", 400, 500, 600]
   */
  #expandArray(arr) {
    if (!Array.isArray(arr)) {
      return [arr];
    }

    const result = [];

    for (const item of arr) {
      if (Array.isArray(item)) {
        // Check if it's a range (3-element array of numbers)
        if (item.length === 3 &&
            typeof item[0] === 'number' &&
            typeof item[1] === 'number' &&
            typeof item[2] === 'number') {
          // Expand range: [start, stop, step]
          const rangeValues = this.#expandRange(item[0], item[1], item[2]);
          result.push(...rangeValues);
        } else {
          // Nested array - recursively expand
          result.push(...this.#expandArray(item));
        }
      } else {
        // Single value
        result.push(item);
      }
    }

    return result;
  }

  /**
   * Expands a numeric range into an array of values
   * Handles floating-point precision issues
   *
   * @param {number} start - Range start (inclusive)
   * @param {number} stop - Range stop (inclusive)
   * @param {number} step - Step size
   * @returns {Array<number>} Array of values in the range
   *
   * Example: expandRange(12, 14, 0.5) → [12, 12.5, 13, 13.5, 14]
   */
  #expandRange(start, stop, step) {
    if (step <= 0) {
      throw new Error(`Invalid range step: ${step} (must be positive)`);
    }

    if (start > stop) {
      throw new Error(`Invalid range: start (${start}) > stop (${stop})`);
    }

    const result = [];
    // Use integer arithmetic to avoid floating-point precision issues
    const steps = Math.round((stop - start) / step);

    for (let i = 0; i <= steps; i++) {
      const value = start + (i * step);
      // Round to avoid floating-point precision issues (e.g., 12.300000000001)
      result.push(Number(value.toFixed(10)));
    }

    return result;
  }

  // ============================================================================
  // PRIVATE METHODS - Iterator Implementation
  // ============================================================================

  /**
   * Creates an ES6-compatible iterator
   * Yields FontProperties instances one at a time across all sets
   */
  #createIterator() {
    const expandedSets = this.#expandedSets;
    let setIndex = 0;
    let indices = null;

    return {
      [Symbol.iterator]() {
        return this;
      },

      next() {
        // Iterate through all sets
        while (setIndex < expandedSets.length) {
          const set = expandedSets[setIndex];

          // Initialize indices for current set on first access
          if (indices === null) {
            indices = {
              density: 0,
              family: 0,
              style: 0,
              weight: 0,
              size: 0
            };
          }

          // Check if current set is exhausted
          if (indices.size >= set.sizes.length) {
            // Move to next set
            setIndex++;
            indices = null;
            continue;
          }

          // Get current values
          const density = set.densities[indices.density];
          const family = set.families[indices.family];
          const style = set.styles[indices.style];
          const weight = set.weights[indices.weight];
          const size = set.sizes[indices.size];

          // Convert weight to string if it's a number
          const weightStr = typeof weight === 'number' ? String(weight) : weight;

          // Validate before creating instance
          const setName = set.name || `Set ${setIndex + 1}`;
          try {
            FontSetGenerator.prototype.#validateFontProperties.call(
              this,
              density, family, style, weightStr, size, setName
            );
          } catch (error) {
            throw error;
          }

          // Create FontProperties instance (runtime class, no FAB)
          const fontProps = new FontProperties(density, family, style, weightStr, size);

          // Increment indices (rightmost/innermost dimension first)
          indices.size++;

          if (indices.size >= set.sizes.length) {
            indices.size = 0;
            indices.weight++;

            if (indices.weight >= set.weights.length) {
              indices.weight = 0;
              indices.style++;

              if (indices.style >= set.styles.length) {
                indices.style = 0;
                indices.family++;

                if (indices.family >= set.families.length) {
                  indices.family = 0;
                  indices.density++;
                }
              }
            }
          }

          return { value: fontProps, done: false };
        }

        // All sets exhausted
        return { done: true };
      }
    };
  }
}
