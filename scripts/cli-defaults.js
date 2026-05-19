/**
 * Shared defaults for scripts/*.js CLIs.
 *
 * Single source of truth for values that multiple top-level CLI scripts
 * default to. Keep this module dependency-free.
 */

module.exports = {
  // Local HTTP server port used by Playwright-based CLIs (verify- /
  // generate-reference-hashes.js, automated-font-builder.js, screenshot-
  // with-playwright.js). Picked to avoid common dev-server collisions
  // (3000, 5173, 8000, 8080).
  DEFAULT_HTTP_PORT: 8765,
};
