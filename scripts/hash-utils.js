/**
 * Shared utilities for hash generation and verification scripts
 *
 * This module provides common functionality used by both:
 * - generate-reference-hashes.js (hash generation)
 * - verify-reference-hashes.js (hash verification)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * Parse command line arguments
 * @param {string[]} argv - Process argv array
 * @returns {Object} Argument parser with getArg and hasFlag methods
 */
function parseArgs(argv) {
  const args = argv.slice(2);

  return {
    getArg: function(name, defaultValue) {
      const index = args.indexOf(`--${name}`);
      if (index !== -1 && args[index + 1]) {
        return args[index + 1];
      }

      // Also check --name=value format
      const prefixArg = args.find(arg => arg.startsWith(`--${name}=`));
      if (prefixArg) {
        return prefixArg.split('=')[1];
      }

      return defaultValue;
    },

    hasFlag: function(name) {
      return args.includes(`--${name}`);
    }
  };
}

/**
 * Start simple HTTP server to serve project files
 * @param {number} port - Port number
 * @param {string} rootDir - Root directory to serve
 * @returns {Promise<http.Server|null>} Server instance or null if already running
 */
function startServer(port, rootDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      // Parse URL and handle query strings
      const url = new URL(req.url, `http://localhost:${port}`);
      let filePath = path.join(rootDir, url.pathname);

      // Default to index.html for directories
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }

      // Read and serve file
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not found: ' + url.pathname);
          return;
        }

        // Set content type based on file extension
        const ext = path.extname(filePath);
        const contentTypes = {
          '.html': 'text/html',
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.webp': 'image/webp',
          '.qoi': 'application/octet-stream'
        };
        const contentType = contentTypes[ext] || 'application/octet-stream';

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      });
    });

    server.listen(port, () => {
      console.log(`✅ HTTP server started on http://localhost:${port}`);
      resolve(server);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`⚠️  Port ${port} is already in use, assuming server is running...`);
        resolve(null); // Server already running, continue anyway
      } else {
        reject(err);
      }
    });
  });
}

/**
 * Load and validate font specification from JSON file
 * @param {string} specPath - Path to font specification JSON file
 * @returns {Object} Parsed font specification
 * @throws {Error} If file not found or invalid
 */
function loadFontSpec(specPath) {
  const fullPath = path.resolve(specPath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Font specification file not found: ${fullPath}`);
  }

  const content = fs.readFileSync(fullPath, 'utf8');

  let spec;
  try {
    spec = JSON.parse(content);
  } catch (e) {
    throw new Error(`Invalid JSON in font specification: ${e.message}`);
  }

  if (!spec.fontSets || !Array.isArray(spec.fontSets)) {
    throw new Error('Font specification must contain a "fontSets" array');
  }

  return spec;
}

/**
 * Parse reference hash file and extract hash object
 * @param {string} filePath - Path to reference hash file
 * @returns {Object} Hash object with key-value pairs
 * @throws {Error} If file not found or cannot be parsed
 */
function parseReferenceHashFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Reference hash file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');

  // Extract hash object using regex
  const match = content.match(/const storedReferenceCrispTextRendersHashes = \{([^}]*)\}/s);

  if (!match) {
    throw new Error('Could not parse reference hash file - expected format not found');
  }

  const hashBlock = match[1];
  const hashes = {};

  // Parse each hash entry
  const hashRegex = /"([^"]+)":"([^"]+)"/g;
  let hashMatch;

  while ((hashMatch = hashRegex.exec(hashBlock)) !== null) {
    hashes[hashMatch[1]] = hashMatch[2];
  }

  // Also extract positioning hashes from comments (if any)
  const positioningRegex = /\/\/ ([^:]+): ([a-f0-9]+)/g;
  while ((hashMatch = positioningRegex.exec(content)) !== null) {
    const key = hashMatch[1].trim();
    const value = hashMatch[2].trim();
    // Only add if it looks like a font ID (contains "density-")
    if (key.includes('density-')) {
      hashes[key] = value;
    }
  }

  return hashes;
}

/**
 * Calculate total font count from font specification
 * @param {Object} fontSpec - Font specification object
 * @returns {number} Total number of font configurations
 */
function calculateFontCount(fontSpec) {
  let count = 0;

  for (const set of fontSpec.fontSets) {
    const densities = Array.isArray(set.density) ? set.density.length : 1;
    const families = Array.isArray(set.families) ? set.families.length : 1;
    const styles = Array.isArray(set.styles) ? set.styles.length : 1;
    const weights = Array.isArray(set.weights) ? set.weights.length : 1;

    // Handle size ranges: [start, end, step] format
    let sizeCount = 1;
    if (Array.isArray(set.sizes)) {
      if (set.sizes.length > 0 && Array.isArray(set.sizes[0])) {
        // Range format: [[12, 24, 0.5]]
        const [start, end, step] = set.sizes[0];
        sizeCount = Math.floor((end - start) / step) + 1;
      } else {
        // Explicit sizes: [12, 18, 24]
        sizeCount = set.sizes.length;
      }
    }

    count += densities * families * styles * weights * sizeCount;
  }

  return count;
}

module.exports = {
  parseArgs,
  startServer,
  loadFontSpec,
  parseReferenceHashFile,
  calculateFontCount
};
