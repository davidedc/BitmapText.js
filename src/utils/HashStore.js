class HashStore {
  constructor(referenceHashes = {}) {
      this.currentHashes = {};
      this.referenceHashes = referenceHashes;
  }

  // Add a new hash to the current run
  addHash(key, hashString) {
      this.currentHashes[key] = hashString;
  }

  // Compare a hash with the reference hash
  compareHash(key, hashString) {
      this.addHash(key, hashString);

      if (this.referenceHashes[key] === undefined) {
          return {
              status: 'no_reference',
              message: "ℹ️ No stored hash"
          };
      }

      const matches = this.referenceHashes[key] === hashString;
      return {
          status: matches ? 'match' : 'mismatch',
          message: matches ? "✔ Same hash as stored one" : "✘ Different hash from stored one"
      };
  }

  // Get all current hashes
  getCurrentHashes() {
      return this.currentHashes;
  }

  // Get formatted string for clipboard
  getFormattedHashString() {
      const sortedKeys = Object.keys(this.currentHashes).sort();
      const filteredKeys = sortedKeys.filter(key => key.includes('atlas'));

      return `// Note that some are missing because we fail to render some very small sizes\n`
           + `const storedReferenceCrispTextRendersHashes = {\n`
           + `${filteredKeys.map(key => ` "${key}":"${this.currentHashes[key]}"`).join(',\n')}\n`
           + `};\n`
           + `\n`
           + `const hashStore = new HashStore(storedReferenceCrispTextRendersHashes);`;
  }

  // Copy hashes to clipboard
  async copyHashesToClipboard() {
    try {
          await navigator.clipboard.writeText(this.getFormattedHashString());
          return true;
      } catch (error) {
          console.error('Failed to copy to clipboard:', error);
          return false;
      }
  }

  // Reset current hashes
  reset() {
      this.currentHashes = {};
  }

  // Update reference hashes
  updateReferenceHashes(newReferenceHashes) {
      this.referenceHashes = newReferenceHashes;
  }
}