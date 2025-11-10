# Font Set Specification Format

## Overview

The Font Set Format is a JSON-based specification for defining collections of font configurations as unions of cross-products. It's useful for automated testing, automated asset building, automated sample generation, and any scenario requiring systematic font property exploration.

**Key Features:**
- Define multiple font sets and union them together
- Express cross-products of font properties (density × families × styles × weights × sizes)
- Use ranges for numeric values (e.g., sizes 12 to 24 with step 0.5)
- Memory-efficient iteration over potentially thousands of font configurations

**Use Cases:**
- Automated font asset generation for multiple font families and sizes
- Comprehensive testing across font property combinations
- Sample and demo generation for documentation or showcases
- CI/CD pipelines that need to validate font rendering
- Exploratory rendering across font property space

## Format Structure

```json
{
  "fontSets": [
    {
      "name": "Optional descriptive name",
      "density": [1.0, 2.0],
      "families": ["Arial", "Georgia"],
      "styles": ["normal", "italic", "oblique"],
      "weights": ["normal", "bold", [100, 900, 100]],
      "sizes": [[12, 24, 0.5], 48]
    }
  ]
}
```

### Root Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fontSets` | Array | Yes | Array of font set definitions (see below) |

### Font Set Definition

Each object in the `fontSets` array defines a cross-product of font properties.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | String | No | Optional descriptive name for documentation |
| `density` | Array | Yes | Pixel densities (e.g., `[1.0]`, `[1.0, 2.0]`) |
| `families` | Array | Yes | Font family names (e.g., `["Arial", "Courier New"]`) |
| `styles` | Array | Yes | Font styles: `"normal"`, `"italic"`, `"oblique"` |
| `weights` | Array | Yes | Font weights (see Weight Values below) |
| `sizes` | Array | Yes | Font sizes in CSS pixels (numbers or ranges) |

### Array Value Types

Arrays can contain three types of values:

1. **Single values**: `1.0`, `"Arial"`, `"normal"`
2. **Multiple values**: `[1.0, 2.0]`, `["Arial", "Georgia"]`
3. **Ranges (numeric only)**: `[start, stop, step]`

**Range Format**: Three-element array `[start, stop, step]` where:
- `start`: Starting value (inclusive)
- `stop`: Ending value (inclusive)
- `step`: Increment step

**Range Examples:**
```json
[12, 24, 0.5]     → [12, 12.5, 13, 13.5, ..., 24]
[100, 900, 100]   → [100, 200, 300, 400, 500, 600, 700, 800, 900]
[1.0, 2.0, 0.5]   → [1.0, 1.5, 2.0]
```

### Font Property Values

#### Density (pixelDensity)
- **Type**: Positive number (float or integer)
- **Common values**: `1.0` (standard), `2.0` (Retina/HiDPI)
- **Examples**: `[1.0]`, `[1.0, 2.0]`, `[1.0, 1.5, 2.0]`

#### Families (fontFamily)
- **Type**: String (font family name)
- **Examples**: `["Arial"]`, `["Arial", "Georgia", "Times New Roman"]`
- **Note**: Must be installed/available in the environment

#### Styles (fontStyle)
- **Type**: String
- **Valid values**: `"normal"`, `"italic"`, `"oblique"`
- **Examples**: `["normal"]`, `["normal", "italic"]`, `["normal", "italic", "oblique"]`

#### Weights (fontWeight)
- **Type**: String or number
- **Valid values**:
  - Named weights: `"normal"`, `"bold"`, `"bolder"`, `"lighter"`
  - Numeric weights: `100`, `200`, `300`, `400`, `500`, `600`, `700`, `800`, `900`
  - Numeric strings: `"100"`, `"200"`, ..., `"900"`
- **Examples**:
  ```json
  ["normal"]
  ["normal", "bold"]
  [400, 700]
  ["normal", [400, 900, 100]]
  ```
- **Note**: Numeric values are automatically converted to strings during generation

#### Sizes (fontSize)
- **Type**: Positive number (CSS pixels)
- **Examples**:
  ```json
  [12, 14, 16, 18]              // Explicit sizes
  [[12, 24, 0.5]]               // Range: 12 to 24 with 0.5 steps
  [[12, 24, 1], 48, 64]         // Range plus specific sizes
  ```

## Cross-Product Calculation

Each font set generates a cross-product of all its properties:

**Formula**: `density_count × families_count × styles_count × weights_count × sizes_count`

**Example**:
```json
{
  "density": [1.0, 2.0],           // 2 values
  "families": ["Arial"],           // 1 value
  "styles": ["normal", "italic"],  // 2 values
  "weights": ["normal", "bold"],   // 2 values
  "sizes": [[12, 14, 1]]           // 3 values (12, 13, 14)
}
```
**Total**: 2 × 1 × 2 × 2 × 3 = **24 font configurations**

## Multi-Set Union

Multiple font sets are combined via **union** (not cross-product between sets).

**Example**:
```json
{
  "fontSets": [
    {
      "name": "Arial Small Sizes",
      "density": [1.0],
      "families": ["Arial"],
      "styles": ["normal"],
      "weights": ["normal"],
      "sizes": [[8, 12, 1]]        // 5 sizes: 8, 9, 10, 11, 12
    },
    {
      "name": "Georgia Large Sizes",
      "density": [1.0],
      "families": ["Georgia"],
      "styles": ["normal"],
      "weights": ["normal"],
      "sizes": [[18, 24, 2]]       // 4 sizes: 18, 20, 22, 24
    }
  ]
}
```
**Total**: 5 + 4 = **9 font configurations**

This allows different font families to have different size ranges or weight options.

## Complete Examples

### Example 1: Single Font, Multiple Sizes

Simple testing of one font family across size range:

```json
{
  "fontSets": [
    {
      "name": "Arial Size Testing",
      "density": [1.0],
      "families": ["Arial"],
      "styles": ["normal"],
      "weights": ["normal"],
      "sizes": [[12, 24, 0.5]]
    }
  ]
}
```

**Total**: 1 × 1 × 1 × 1 × 25 = **25 configurations**

### Example 2: Multiple Fonts with Styles

Testing font families with different styles:

```json
{
  "fontSets": [
    {
      "name": "Serif and Sans-Serif Styles",
      "density": [1.0, 2.0],
      "families": ["Arial", "Georgia", "Courier New"],
      "styles": ["normal", "italic"],
      "weights": ["normal"],
      "sizes": [14, 16, 18, 20]
    }
  ]
}
```

**Total**: 2 × 3 × 2 × 1 × 4 = **48 configurations**

### Example 3: Weight Ranges

Testing all numeric weights for a font:

```json
{
  "fontSets": [
    {
      "name": "Arial Weight Spectrum",
      "density": [1.0],
      "families": ["Arial"],
      "styles": ["normal"],
      "weights": [[100, 900, 100]],
      "sizes": [16]
    }
  ]
}
```

**Total**: 1 × 1 × 1 × 9 × 1 = **9 configurations**
- Weights: 100, 200, 300, 400, 500, 600, 700, 800, 900

### Example 4: Complex Multi-Set

Comprehensive specification with different requirements per font:

```json
{
  "fontSets": [
    {
      "name": "UI Fonts - Standard Sizes",
      "density": [1.0, 2.0],
      "families": ["Arial", "Helvetica"],
      "styles": ["normal", "italic"],
      "weights": ["normal", "bold", [400, 700, 100]],
      "sizes": [[12, 18, 2]]
    },
    {
      "name": "Monospace - Code Editor Sizes",
      "density": [1.0],
      "families": ["Courier New", "Monaco"],
      "styles": ["normal"],
      "weights": ["normal"],
      "sizes": [10, 11, 12, 13, 14, 16]
    },
    {
      "name": "Display Fonts - Large Sizes",
      "density": [2.0],
      "families": ["Georgia", "Times New Roman"],
      "styles": ["normal", "italic"],
      "weights": ["normal", "bold"],
      "sizes": [[24, 48, 4]]
    }
  ]
}
```

**Totals**:
- Set 1: 2 × 2 × 2 × 7 × 4 = 448
- Set 2: 1 × 2 × 1 × 1 × 6 = 12
- Set 3: 1 × 2 × 2 × 2 × 7 = 56

**Grand Total**: **516 configurations**

### Example 5: HiDPI Asset Generation

Creating assets for both standard and high-DPI displays:

```json
{
  "fontSets": [
    {
      "name": "Cross-Platform Font Assets",
      "density": [1.0, 2.0],
      "families": ["Arial", "Roboto", "Open Sans"],
      "styles": ["normal", "italic", "oblique"],
      "weights": ["normal", "bold", [300, 700, 100]],
      "sizes": [[8, 32, 0.5]]
    }
  ]
}
```

**Total**: 2 × 3 × 3 × 7 × 49 = **6,174 configurations**

## Usage with FontSetGenerator

See README.md for API usage examples and docs/ARCHITECTURE.md for implementation details.

**Basic Usage**:
```javascript
// Load the JSON specification
const spec = {
  fontSets: [
    {
      density: [1.0],
      families: ["Arial"],
      styles: ["normal"],
      weights: ["normal"],
      sizes: [[12, 24, 1]]
    }
  ]
};

// Create generator
const generator = new FontSetGenerator(spec);

// Get count without generating instances
console.log(`Total fonts: ${generator.getCount()}`);

// Iterate over font configurations
for (const fontProps of generator.iterator()) {
  console.log(fontProps.idString);
  // Use fontProps for testing, asset building, sample generation, etc.
}
```

## Validation Rules

The FontSetGenerator validates specifications and throws descriptive errors:

1. **Structure validation**:
   - Root must contain `fontSets` array
   - `fontSets` cannot be empty
   - Each set must have all required fields

2. **Field validation**:
   - All required fields must be arrays
   - Arrays cannot be empty
   - Values must match valid options (styles, weights)

3. **Range validation**:
   - Step must be positive
   - Start must be ≤ stop
   - All range elements must be numbers

4. **Font property validation**:
   - Density must be positive
   - Font family must be non-empty string
   - Style must be one of: `normal`, `italic`, `oblique`
   - Weight must be valid named or numeric value
   - Font size must be positive

**Example error messages**:
```
"Font set specification must contain 'fontSets' array"
"Set 1: Missing required field 'families'"
"Set 2: Field 'sizes' cannot be empty"
"Invalid range: start (24) > stop (12)"
"Invalid fontWeight: 1000 - must be one of: normal, bold, ..."
```

## Memory Efficiency

The FontSetGenerator is designed for memory efficiency:

1. **Lazy generation**: Font configurations are generated on-demand during iteration
2. **No bulk storage**: The iterator doesn't store all instances in memory
3. **Range pre-expansion**: Only ranges are pre-expanded (typically small arrays)
4. **Count calculation**: Total count computed without generating instances

**Memory usage**: O(total_range_values) not O(total_configurations)

**Example**:
```json
{
  "sizes": [[8, 100, 0.5]]  // 185 size values
}
```
- Pre-expanded array: 185 numbers (small)
- Total configurations (with other properties): Could be thousands
- Memory used: Only stores the 185 size values, not thousands of font objects

This allows generation of massive font sets (10,000+ configurations) without memory issues.

## Best Practices

1. **Use named sets**: Add `name` field for documentation and debugging
2. **Start small**: Test with small counts before scaling up
3. **Validate early**: Run generator on sample spec to catch errors
4. **Monitor count**: Use `getCount()` before iteration to verify expectations
5. **Organize by purpose**: Group similar fonts in same set (e.g., UI fonts, display fonts)
6. **Use ranges wisely**: Ranges are efficient but ensure step size makes sense
7. **Consider cross-products**: Each property multiplies the total count

## See Also

- **README.md**: API usage examples and quick start
- **docs/ARCHITECTURE.md**: FontSetGenerator implementation details
- **scripts/README.md**: Automated font builder script documentation
- **scripts/automated-font-builder.js**: Automated font generation from JSON specifications
- **specs/font-sets/test-font-spec.json**: Example font set specification (Arial 18, 18.5, 19)
- **src/builder/FontPropertiesFAB.js**: Font property validation and construction
