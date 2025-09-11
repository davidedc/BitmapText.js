// Shared utility for loading bitmap font data with error handling
class FontLoader {
  constructor(atlasStore, onProgress = null) {
    this.atlasStore = atlasStore;
    this.onProgress = onProgress;
    this.loadedCount = 0;
    this.totalCount = 0;
  }

  // Load font data for a single ID string
  loadFont(IDString, isFileProtocol = false) {
    this.totalCount += 2; // Each font has 2 files (metrics + image)
    
    return this.loadMetrics(IDString)
      .then(() => this.loadAtlas(IDString, isFileProtocol))
      .catch(error => {
        // Even if loading fails, we still count it as processed to prevent hanging
        console.warn(`Font loading failed for ${IDString}:`, error.message);
      });
  }

  // Load multiple fonts from an array of ID strings
  loadFonts(IDStrings, isFileProtocol = false) {
    this.totalCount = IDStrings.length * 2;
    this.loadedCount = 0;
    
    const promises = IDStrings.map(IDString => this.loadFont(IDString, isFileProtocol));
    
    return Promise.all(promises);
  }

  // Load metrics JS file
  loadMetrics(IDString) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = FontLoaderConfig.getMetricsPath(IDString);
      
      script.onload = () => {
        this.incrementProgress();
        resolve();
      };
      
      script.onerror = () => {
        script.remove();
        console.warn(FontLoaderConfig.messages.metricsNotFound(IDString));
        
        // Count both missing files to maintain expected count
        this.incrementProgress(); // Missing metrics
        this.incrementProgress(); // Missing image (won't be loaded)
        
        reject(new Error(`Metrics not found for ${IDString}`));
      };
      
      document.head.appendChild(script);
    });
  }

  // Load atlas based on protocol
  loadAtlas(IDString, isFileProtocol) {
    if (isFileProtocol) {
      return this.loadAtlasFromJS(IDString);
    } else {
      return this.loadAtlasFromPNG(IDString);
    }
  }

  // Load atlas from JS file (for file:// protocol)
  loadAtlasFromJS(IDString) {
    return new Promise((resolve, reject) => {
      const imageScript = document.createElement('script');
      imageScript.src = FontLoaderConfig.getImageJsPath(IDString);
      
      imageScript.onload = () => {
        const imageData = window.imagesFromJs && window.imagesFromJs[IDString];
        
        if (!imageData) {
          console.warn(FontLoaderConfig.messages.imageDataMissing(IDString));
          imageScript.remove();
          this.incrementProgress();
          resolve(); // Not a failure - will use placeholder rectangles
          return;
        }

        const img = new Image();
        img.src = `data:image/png;base64,${imageData}`;
        
        img.onload = () => {
          const fontProperties = FontProperties.fromIDString(IDString);
          this.atlasStore.setAtlas(fontProperties, img);
          
          imageScript.remove();
          delete window.imagesFromJs[IDString];
          
          this.incrementProgress();
          resolve();
        };
        
        img.onerror = () => {
          console.warn(FontLoaderConfig.messages.base64DecodeFailed(IDString));
          imageScript.remove();
          delete window.imagesFromJs[IDString];
          this.incrementProgress();
          resolve(); // Not a failure - will use placeholder rectangles
        };
      };
      
      imageScript.onerror = () => {
        console.warn(FontLoaderConfig.messages.jsImageNotFound(IDString));
        imageScript.remove();
        this.incrementProgress();
        resolve(); // Not a failure - will use placeholder rectangles
      };
      
      document.head.appendChild(imageScript);
    });
  }

  // Load atlas from PNG file (for http:// protocol)
  loadAtlasFromPNG(IDString) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = FontLoaderConfig.getPngPath(IDString);
      
      img.onload = () => {
        const fontProperties = FontProperties.fromIDString(IDString);
        this.atlasStore.setAtlas(fontProperties, img);
        
        this.incrementProgress();
        resolve();
      };
      
      img.onerror = () => {
        console.warn(FontLoaderConfig.messages.pngImageNotFound(IDString));
        this.incrementProgress();
        resolve(); // Not a failure - will use placeholder rectangles
      };
    });
  }

  // Increment progress counter and call callback
  incrementProgress() {
    this.loadedCount++;
    if (this.onProgress) {
      this.onProgress(this.loadedCount, this.totalCount);
    }
  }

  // Check if loading is complete
  isComplete() {
    return this.loadedCount >= this.totalCount;
  }
}