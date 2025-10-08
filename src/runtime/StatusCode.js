// StatusCode - Core Runtime Constants
//
// This is a CORE RUNTIME module designed for minimal bundle size (~0.5KB).
// It provides status code constants and pre-created status objects for performance optimization.
//
// DISTRIBUTION ROLE:
// - Part of "runtime-only" distribution for production applications
// - Used by BitmapText for efficient status reporting
// - No dependencies, pure constants and helper objects
//
// PERFORMANCE OPTIMIZATIONS:
// - Numeric codes for faster comparisons than strings
// - Pre-created immutable SUCCESS_STATUS object to avoid allocations
// - Frozen objects for memory safety and immutability

/**
 * Status codes for BitmapText operations
 * Using numeric values for optimal performance in comparisons
 */
const StatusCode = Object.freeze({
  SUCCESS: 0,           // Everything worked perfectly
  NO_METRICS: 1,        // No FontMetrics found at all for this font configuration
  PARTIAL_METRICS: 2,   // Some characters missing metrics data
  NO_ATLAS: 3,          // No atlas available (will render placeholder rectangles)
  PARTIAL_ATLAS: 4      // Some characters missing from atlas (partial placeholders)
});

/**
 * Pre-created immutable success status object for performance
 * Reused for all successful operations to avoid object allocation overhead
 */
const SUCCESS_STATUS = Object.freeze({
  code: StatusCode.SUCCESS
});

/**
 * Helper function to create error status objects
 * @param {number} code - StatusCode value
 * @param {Object} details - Additional details object
 * @returns {Object} Immutable status object
 */
function createErrorStatus(code, details = {}) {
  return Object.freeze({
    code,
    ...details
  });
}

/**
 * Helper function to check if a status indicates success
 * @param {Object} status - Status object with code property
 * @returns {boolean} True if status indicates success
 */
function isSuccess(status) {
  return status?.code === StatusCode.SUCCESS;
}

/**
 * Helper function to check if a status indicates complete failure
 * (NO_METRICS or PARTIAL_METRICS - cannot render at all)
 * @param {Object} status - Status object with code property
 * @returns {boolean} True if status indicates complete failure
 */
function isCompleteFailure(status) {
  return status && (
    status.code === StatusCode.NO_METRICS ||
    status.code === StatusCode.PARTIAL_METRICS
  );
}

/**
 * Helper function to check if a status indicates partial success
 * (NO_ATLAS or PARTIAL_ATLAS - can render with placeholders)
 * @param {Object} status - Status object with code property
 * @returns {boolean} True if status indicates partial success
 */
function isPartialSuccess(status) {
  return status && (
    status.code === StatusCode.NO_ATLAS ||
    status.code === StatusCode.PARTIAL_ATLAS
  );
}

/**
 * Helper function to get human-readable status description
 * @param {Object} status - Status object with code property
 * @returns {string} Human-readable description
 */
function getStatusDescription(status) {
  if (!status || typeof status.code !== 'number') {
    return 'Invalid status';
  }

  switch (status.code) {
    case StatusCode.SUCCESS:
      return 'Success';
    case StatusCode.NO_METRICS:
      return 'No font metrics available';
    case StatusCode.PARTIAL_METRICS:
      return `Missing metrics for characters: ${status.missingChars ? [...status.missingChars].join('') : 'unknown'}`;
    case StatusCode.NO_ATLAS:
      return 'No atlas available (using placeholders)';
    case StatusCode.PARTIAL_ATLAS:
      return `Missing atlas data for characters: ${status.missingAtlasChars ? [...status.missingAtlasChars].join('') : 'unknown'} (using placeholders)`;
    default:
      return `Unknown status code: ${status.code}`;
  }
}