// KerningCalculator - Font Assets Building Service
//
// This service class handles kerning calculation and table generation
// based on font specifications.
//
// DISTRIBUTION ROLE:
// - Part of "full toolkit" distribution for font assets building applications
// - Used by BitmapTextFAB during font assets building process
// - NOT included in runtime-only distribution (build-time only)
//
// ARCHITECTURE:
// - Encapsulates kerning calculation logic separate from BitmapTextFAB
// - Depends on Specs instance for accessing kerning specifications
// - Stateless calculations based on fontProperties and character pairs
// - Single Responsibility: All kerning-related calculations
//
// SEPARATION RATIONALE:
// - Extracted from BitmapTextFAB to improve testability
// - Makes kerning logic reusable across different contexts
// - Reduces complexity of BitmapTextFAB class (207 → ~165 lines)
// - Enables independent unit testing of kerning calculations
// - Follows Single Responsibility Principle
//
// DESIGN DECISIONS:
// - Service class with constructor injection (not static utility)
// - Stores Specs reference to avoid passing it to every method
// - Returns calculated values, does NOT manage storage
// - Immutable after construction (Object.freeze)
//
// TECHNICAL DEBT:
// - characterSet parameter still required (not injected as dependency)
// - TODO: Consider injecting characterSet in constructor for full DI
//
class KerningCalculator {
  /**
   * Construct kerning calculator with specs dependency
   *
   * @param {Specs} specs - Font specifications instance containing kerning rules
   * @throws {Error} If specs is null or undefined
   */
  constructor(specs) {
    if (!specs) {
      throw new Error('KerningCalculator requires Specs instance');
    }

    this.specs = specs;

    // Freeze for immutability (safe to cache, no side effects)
    Object.freeze(this);
  }

  /**
   * Calculate kerning correction for a character pair
   *
   * This method determines the kerning adjustment (in 1/1000 em units) that should
   * be applied between two adjacent characters based on the font specifications.
   *
   * Algorithm:
   * 1. Check kerning cutoff (optimization for small fonts)
   * 2. Check if kerning specs exist for this font
   * 3. Find matching size range in kerning specs
   * 4. Find matching character pair rule (supports "*any*" wildcard)
   * 5. Return adjustment value (0 if no match)
   *
   * @param {FontProperties} fontProperties - Font configuration
   * @param {string} leftChar - Left character in pair (single code point)
   * @param {string} rightChar - Right character in pair (single code point)
   * @returns {number} Kerning adjustment value (0 if no correction needed)
   *
   * @example
   * // Get kerning for "Wi" in Arial 19px
   * const correction = calculator.calculateCorrection(
   *   fontProperties, 'W', 'i'
   * ); // Returns -50 (from default specs)
   */
  calculateCorrection(fontProperties, leftChar, rightChar) {
    const { fontSize } = fontProperties;

    // OPTIMIZATION: Check kerning cutoff for small fonts
    // If fontSize <= cutoff, kerning is disabled for performance
    if (this.specs.specCombinationExists(fontProperties, "Kerning cutoff")) {
      if (fontSize <= this.specs.kerningCutoff(fontProperties)) {
        return 0;
      }
    }

    // Check if kerning specs exist for this font family/style/weight
    if (!this.specs.specCombinationExists(fontProperties, "Kerning")) {
      return 0;
    }

    // Iterate through kerning entries to find matching size range and character pair
    for (const kerningEntry of this.specs.kerning(fontProperties)) {
      // Check if size range matches current fontSize
      if (
        kerningEntry.sizeRange.from <= fontSize &&
        kerningEntry.sizeRange.to >= fontSize
      ) {
        // Check each kerning rule in this size range
        for (const kerning of kerningEntry.kerning) {
          // Check if character pair matches (supports "*any*" wildcard)
          // Match if: (leftChar in left-chars OR "*any*" in left-chars)
          //       AND (rightChar in right-chars OR "*any*" in right-chars)
          if (
            (kerning.left.includes(leftChar) ||
              kerning.left.includes("*any*")) &&
            (kerning.right.includes(rightChar) ||
              kerning.right.includes("*any*"))
          ) {
            return kerning.adjustment;
          }
        }
      }
    }

    // No matching kerning rule found
    return 0;
  }

  /**
   * Build complete kerning table for a font
   *
   * Generates kerning corrections for all character pairs in the character set.
   * Only stores non-zero corrections to minimize table size.
   * Prunes characters that have no kerning corrections with any other character.
   *
   * Algorithm:
   * 1. For each left character in characterSet
   * 2.   For each right character in characterSet
   * 3.     Calculate kerning correction
   * 4.     Store only if non-zero
   * 5. Prune left characters with no corrections
   *
   * Performance: O(n²) where n = characterSet.length (~95 chars = ~9000 pairs)
   * Typical execution time: ~10-20ms per font
   *
   * @param {FontProperties} fontProperties - Font configuration
   * @param {string[]} characterSet - Array/string of characters to build table for
   * @returns {Object} Kerning table in format:
   *   {
   *     [leftChar]: {
   *       [rightChar]: adjustment,
   *       ...
   *     },
   *     ...
   *   }
   *   Empty object if no kerning corrections needed
   *
   * @example
   * // Build kerning table for Arial 19px
   * const table = calculator.buildTable(fontProperties, characterSet);
   * // Returns: { 'W': { 'i': -50 }, 'y': { 'w': -50 }, ... }
   */
  buildTable(fontProperties, characterSet) {
    const kerningTable = {};

    // Calculate kerning for all character pairs
    for (const leftChar of characterSet) {
      kerningTable[leftChar] = {};

      for (const rightChar of characterSet) {
        const correction = this.calculateCorrection(
          fontProperties,
          leftChar,
          rightChar
        );

        // Only store non-zero corrections to minimize table size
        if (correction !== 0) {
          kerningTable[leftChar][rightChar] = correction;
        }
      }
    }

    // Prune characters with no kerning corrections
    // This significantly reduces table size (typically 95 chars → 20-30 chars)
    for (const leftChar in kerningTable) {
      if (Object.keys(kerningTable[leftChar]).length === 0) {
        delete kerningTable[leftChar];
      }
    }

    return kerningTable;
  }

  /**
   * Get space advancement override for small font sizes
   *
   * Some fonts at small sizes need manual space width correction because
   * the browser's native space advancement may be incorrect or inconsistent.
   * This retrieves the override value from specs if specified.
   *
   * @param {FontProperties} fontProperties - Font configuration
   * @returns {number|null} Override value in pixels, or null if not specified
   *
   * @example
   * // Get space override for Arial 15px
   * const override = calculator.getSpaceAdvancementOverride(fontProperties);
   * // Returns: 5 (if specified in specs) or null
   */
  getSpaceAdvancementOverride(fontProperties) {
    return this.specs.getSingleFloatCorrection(
      fontProperties,
      "Space advancement override for small sizes in px"
    );
  }
}
