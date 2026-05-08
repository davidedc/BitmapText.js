// Helper: deflate-raw + base64 encode a string in the browser using CompressionStream.
async function _deflateRawBase64InBrowser(jsonString) {
    const u8 = new TextEncoder().encode(jsonString);
    const cs = new Response(u8).body.pipeThrough(new CompressionStream('deflate-raw'));
    const compressed = new Uint8Array(await new Response(cs).arrayBuffer());
    // base64 in chunks to avoid stack overflow on very large inputs.
    const CHUNK = 0x8000;
    let binary = '';
    for (let i = 0; i < compressed.length; i += CHUNK) {
        binary += String.fromCharCode.apply(null, compressed.subarray(i, i + CHUNK));
    }
    return btoa(binary);
}

// Helper: drop pixelDensity from baseline[5]. Bundle records are density-agnostic;
// the runtime injects pixelDensity at MetricsExpander.expand time.
function _stripDensityFromBaseline(minified) {
    const baseline = minified[2];
    if (!Array.isArray(baseline) || baseline.length !== 6) {
        throw new Error(`Expected 6-element baseline, got ${baseline?.length}`);
    }
    const out = minified.slice();
    out[2] = [baseline[0], baseline[1], baseline[2], baseline[3], baseline[4], null];
    return out;
}

function downloadFontAssets(options) {
    const {
        pixelDensity,
        fontFamily,
        fontStyle,
        fontWeight,
        includeNonMinifiedMetrics = false
    } = options;

    // Note: atlasDataStoreFAB and fontMetricsStoreFAB are now static classes
    // accessed directly via AtlasDataStoreFAB.* and FontMetricsStoreFAB.*

    // Create FontPropertiesFAB for this font configuration (without fontSize yet)
    // We'll create specific instances for each size below

    const zip = new JSZip();
    const folder = zip.folder("fontAssets");

    // Find all available fonts/sizes by examining glyphs in atlasDataStoreFAB
    // We look at glyphs (not atlases) because that's what actually got built

    // Get all available font keys
    const availableFonts = AtlasDataStoreFAB.getAvailableFonts();

    // If parameters are null, export ALL fonts (automation mode)
    // Otherwise, export only fonts matching the specified parameters (UI mode)
    const isAutomationMode = pixelDensity === null && fontFamily === null &&
        fontStyle === null && fontWeight === null;

    let fontsToExport = [];

    if (isAutomationMode) {
        // Export ALL fonts that have been built
        console.log('Automation mode: exporting ALL built fonts');

        // Parse all available font keys to get unique configurations
        for (const fontKey of availableFonts) {
            // Font key format: "pixelDensity:fontFamily:fontStyle:fontWeight:fontSize"
            const parts = fontKey.split(':');
            if (parts.length === 5) {
                fontsToExport.push({
                    pixelDensity: parseFloat(parts[0]),
                    fontFamily: parts[1],
                    fontStyle: parts[2],
                    fontWeight: parts[3],
                    fontSize: parseFloat(parts[4])
                });
            }
        }

        console.log(`Found ${fontsToExport.length} font(s) to export`);

    } else {
        // UI mode: export only fonts matching specified parameters
        const sizes = new Set();
        const baseKeyPrefix = `${pixelDensity}:${fontFamily}:${fontStyle}:${fontWeight}:`;

        for (const fontKey of availableFonts) {
            if (fontKey.startsWith(baseKeyPrefix)) {
                // Extract fontSize from fontKey
                const fontSize = fontKey.substring(baseKeyPrefix.length);
                sizes.add(parseFloat(fontSize));
            }
        }

        if (sizes.size === 0) {
            alert('No fonts have been built yet. Please select a font configuration and wait for glyphs to render before downloading.');
            return;
        }

        console.log(`Found ${sizes.size} font size(s) to export:`, Array.from(sizes));

        // Convert sizes to fontsToExport format
        sizes.forEach(size => {
            fontsToExport.push({
                pixelDensity,
                fontFamily,
                fontStyle,
                fontWeight,
                fontSize: size
            });
        });
    }

    if (fontsToExport.length === 0) {
        console.error('No fonts available to export');
        return Promise.reject(new Error('No fonts available to export'));
    }


    // Collect density-agnostic minified records here. We emit one
    // `font-assets/metrics-bundle.js` at the end of the loop holding all of them.
    // Map keyed by `family|styleIdx|weightIdx|size`.
    const bundleRecords = new Map();

    // Collect per-density positioning records. Map: density → array of records.
    // Each record: [family, styleIdx, weightIdx, size, [tightWidth[], tightHeight[], dx[], dy[]]].
    // Emitted as one `positioning-bundle-density-<density>.js` per density.
    const positioningBundlesByDensity = new Map();

    // Format version for both metrics and positioning bundles. Bumped when the
    // on-disk bundle layout changes incompatibly. Must match the runtime's
    // FontLoaderBase.BUNDLE_FORMAT_VERSION.
    const BUNDLE_FORMAT_VERSION = 1;

    fontsToExport.forEach(fontConfig => {
        // Create FontPropertiesFAB for this specific font configuration
        const fontProperties = new FontPropertiesFAB(
            fontConfig.pixelDensity,
            fontConfig.fontFamily,
            fontConfig.fontStyle,
            fontConfig.fontWeight,
            fontConfig.fontSize
        );

        console.log(`\n=== Exporting ${fontProperties.key} ===`);

        // Check if glyphs exist for this font
        const glyphs = AtlasDataStoreFAB.getGlyphsForFont(fontProperties);
        const glyphCount = Object.keys(glyphs).length;
        console.log(`Found ${glyphCount} glyphs for ${fontProperties.key}`);

        if (glyphCount === 0) {
            console.warn(`No glyphs found for ${fontProperties.key}, skipping export`);
            return;
        }

        // Log first few glyphs to verify they have canvases
        const sampleChars = Object.keys(glyphs).slice(0, 3);
        for (const char of sampleChars) {
            const glyph = glyphs[char];
            console.log(`  Glyph '${char}': canvas=${!!glyph.canvas}, tightCanvas=${!!glyph.tightCanvas}`);
            if (glyph.canvas) {
                console.log(`    canvas dimensions: ${glyph.canvas.width}x${glyph.canvas.height}`);
            }
        }

        // Build Atlas (variable-width cells) instead of tight atlas
        // Use AtlasDataStoreFAB.buildAtlas() which properly wraps AtlasBuilder
        console.log(`Building Atlas for ${fontProperties.key}...`);
        const atlasResult = AtlasDataStoreFAB.buildAtlas(fontProperties);

        // Skip if atlas building failed
        if (!atlasResult || !atlasResult.canvas) {
            console.error(`Failed to build atlas for ${fontProperties.key}, skipping export`);
            return;
        }

        console.log(`Atlas built successfully: ${atlasResult.canvas.width}x${atlasResult.canvas.height}`);
        const canvas = atlasResult.canvas;

        if (!canvas || !canvas.getContext) {
            console.warn(`Invalid canvas from AtlasImage for ${fontProperties.key}, skipping export`);
            return;
        }

        // Skip canvases with 0x0 dimensions (nothing to export)
        if (canvas.width === 0 || canvas.height === 0) {
            console.warn(`Canvas has 0x0 dimensions for ${fontProperties.key}, skipping export`);
            return;
        }

        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Encode to QOI format
        const qoiBuffer = QOIEncode(imageData.data, {
            width: canvas.width,
            height: canvas.height,
            channels: 4, // RGBA
            colorspace: 0 // sRGB with linear alpha
        });

        // Convert ArrayBuffer to base64 for zip storage
        const qoiUint8Array = new Uint8Array(qoiBuffer);
        const qoiBase64 = btoa(String.fromCharCode(...qoiUint8Array));

        // Use pre-computed ID string from FontPropertiesFAB
        const IDString = fontProperties.idString;

        // Add QOI to zip with timezone-corrected date
        // JavaScript Date() gives UTC, but JSZip interprets as local time
        // We need to adjust for the timezone offset to get the correct local time
        const now = new Date();
        const timezoneOffset = now.getTimezoneOffset(); // minutes difference from UTC
        const currentDate = new Date(now.getTime() - (timezoneOffset * 60 * 1000));
        folder.file(`atlas-${IDString}.qoi`, qoiBase64, { base64: true, date: currentDate });

        // NO positioning data exported - will be reconstructed at runtime from Atlas image
        // The Atlas format (variable-width cells) allows runtime reconstruction of tight atlas + positioning

        // Get FontMetrics instance for this font configuration
        const fontMetrics = FontMetricsStoreFAB.getFontMetrics(fontProperties);

        if (!fontMetrics) {
            console.warn(`No FontMetrics found for ${fontProperties.key}, skipping export`);
            return;
        }

        // Extract character metrics directly from FontMetrics instance
        const generatedMetrics = fontMetrics._characterMetrics;

        // Check if we have any glyphs to export
        if (Object.keys(generatedMetrics).length === 0) {
            console.warn(`No glyphs found for ${fontProperties.key}, skipping export`);
            return;
        }

        // REQUIRED: ALL 204 characters from CharacterSets.FONT_SPECIFIC_CHARS must be included for standard fonts
        // For custom character set fonts, only the custom characters are included
        // Create metrics for all 204 characters in CharacterSets.FONT_SPECIFIC_CHARS order
        let characterMetrics = {};

        // Get baseline metrics from first generated character for fallback
        const firstChar = Object.keys(generatedMetrics)[0];
        const fallbackMetrics = generatedMetrics[firstChar];

        // Create placeholder metrics for missing characters (zero width, invisible)
        const createPlaceholderMetrics = () => ({
            width: 0,
            actualBoundingBoxLeft: 0,
            actualBoundingBoxRight: 0,
            actualBoundingBoxAscent: 0,
            actualBoundingBoxDescent: 0,
            fontBoundingBoxAscent: fallbackMetrics.fontBoundingBoxAscent,
            fontBoundingBoxDescent: fallbackMetrics.fontBoundingBoxDescent,
            hangingBaseline: fallbackMetrics.hangingBaseline,
            alphabeticBaseline: fallbackMetrics.alphabeticBaseline,
            ideographicBaseline: fallbackMetrics.ideographicBaseline,
            pixelDensity: fallbackMetrics.pixelDensity
        });

        // Check if this font has a custom character set
        // Determine target character set
        let targetCharacterSet = CharacterSets.FONT_SPECIFIC_CHARS;
        let isInvariantFont = false;

        if (fontProperties.fontFamily === 'BitmapTextInvariant') {
            targetCharacterSet = Array.from(window.CharacterSets.FONT_INVARIANT_CHARS);
            isInvariantFont = true;
        }

        if (isInvariantFont) {
            // For font-invariant fonts:
            // Only include characters that are in the font-invariant character set
            characterMetrics = {};
            for (const char of targetCharacterSet) {
                if (generatedMetrics[char]) {
                    characterMetrics[char] = generatedMetrics[char];
                } else {
                    console.warn(`⚠️  Custom character '${char}' not found in generated metrics, skipping`);
                }
            }
            console.log(`📝 Font has custom character set, exporting ${Object.keys(characterMetrics).length} characters: ${Array.from(targetCharacterSet).join('')}`);
        } else {
            // For standard fonts: Add all 204 characters from CharacterSets.FONT_SPECIFIC_CHARS
            for (const char of CharacterSets.FONT_SPECIFIC_CHARS) {
                if (generatedMetrics[char]) {
                    // Use generated metrics if available
                    characterMetrics[char] = generatedMetrics[char];
                } else {
                    // Use placeholder for missing characters
                    characterMetrics[char] = createPlaceholderMetrics();
                }
            }

            // Warn about missing characters (should not happen in normal operation)
            const missingChars = Array.from(CharacterSets.FONT_SPECIFIC_CHARS).filter(char => !generatedMetrics[char]);
            if (missingChars.length > 0) {
                console.warn(`⚠️  Generated placeholder metrics for ${missingChars.length} missing characters: ${missingChars.slice(0, 10).join('')}${missingChars.length > 10 ? '...' : ''}`);
            }

            // Verify no extra characters outside CharacterSets.FONT_SPECIFIC_CHARS
            const extraChars = Object.keys(generatedMetrics).filter(char => !CharacterSets.FONT_SPECIFIC_CHARS.includes(char));
            if (extraChars.length > 0) {
                throw new Error(
                    `Font contains ${extraChars.length} characters not in CharacterSets.FONT_SPECIFIC_CHARS: ${extraChars.join(', ')}\n` +
                    `Please update CharacterSets.FONT_SPECIFIC_CHARS in src/runtime/BitmapText.js to include these characters.`
                );
            }
        }

        // Metrics data (positioning data NO LONGER exported - reconstructed at runtime)
        const metricsData = {
            kerningTable: fontMetrics._kerningTable,
            characterMetrics: characterMetrics,
            spaceAdvancementOverrideForSmallSizesInPx: fontMetrics._spaceAdvancementOverride
        };

        // Minify with automatic roundtrip verification
        // Now supports both standard and font-invariant fonts via characterSet argument
        // Use window.BitmapText to ensure consistent scoping with readiness check
        let characterSet = CharacterSets.FONT_SPECIFIC_CHARS;
        if (fontProperties.fontFamily === 'BitmapTextInvariant') {
            console.log(`📝 Using font-invariant character set for ${fontProperties.fontFamily}`);
            characterSet = Array.from(window.CharacterSets.FONT_INVARIANT_CHARS);
        }

        // This catches compression bugs immediately during build
        // Will throw error if characterMetrics is not in the expected character set order
        const minified = MetricsMinifier.minifyWithVerification(metricsData, characterSet);

        // TIER 6b: Decompose font ID for multi-parameter format
        const parts = IDString.split('-');
        const density = parts[1] + (parts[2] === '0' ? '' : '.' + parts[2]); // "1" or "1.5"
        const fontFamilyFromID = parts[3];
        const styleFromID = parts[5]; // "normal", "italic", "oblique"
        const weightFromID = parts[7]; // "normal", "bold", or numeric
        const sizeStr = parts[9] + (parts[10] === '0' ? '' : '.' + parts[10]); // "18" or "18.5"

        // Compress style and weight to indices
        const styleIdx = styleFromID === 'normal' ? 0 : (styleFromID === 'italic' ? 1 : 2);
        const weightIdx = weightFromID === 'normal' ? 0 : (weightFromID === 'bold' ? 1 : weightFromID);

        // Stash this minified record in the bundle accumulator. The bundle is
        // density-agnostic — different densities of the same (family,style,weight,size)
        // collapse to one record (only `pixelDensity` differs and the runtime injects
        // it at MetricsExpander.expand time).
        const sizeNum = parseFloat(sizeStr);
        const bundleKey = `${fontFamilyFromID}|${styleIdx}|${weightIdx}|${sizeNum}`;
        if (!bundleRecords.has(bundleKey)) {
            bundleRecords.set(bundleKey, {
                family: fontFamilyFromID,
                styleIdx,
                weightIdx,
                size: sizeNum,
                minified: _stripDensityFromBaseline(minified),
            });
        }
        // Note: `includeNonMinifiedMetrics` is no longer wired to per-file output;
        // the bundle is the only metrics artifact shipped.

        // Build the per-(font, density) positioning record. Same glyphs we just
        // packed into the tight atlas, in the same sorted-character order — the
        // runtime PositioningBundleStore zips these arrays with the character
        // set on materialisation.
        //
        // For multi-row atlases (wide italic-bold density-2 sizes that exceed
        // cwebp's 16383px limit), AtlasBuilder returns per-glyph yInAtlas. Wire
        // that into AtlasPositioningFAB so serialiseAsBundleRecord emits a 5th
        // (yInAtlas) array. Single-row atlases get 4 arrays as before.
        const positioningFAB = new AtlasPositioningFAB();
        positioningFAB.calculatePositioning(glyphs, fontProperties, FontMetricsStoreFAB);
        if (atlasResult.yInAtlas) {
          for (const char of atlasResult.characters) {
            // xInAtlas is implicit (runtime cumsums tightWidth within a row);
            // pass 0 here — setGlyphPositionInAtlas just stores it for hashing
            // and serialiseAsBundleRecord doesn't read xInAtlas.
            positioningFAB.setGlyphPositionInAtlas(char, 0, atlasResult.yInAtlas[char] || 0);
          }
        }
        const positioningArrays = positioningFAB.serialiseAsBundleRecord();

        const densityNum = fontConfig.pixelDensity;
        if (!positioningBundlesByDensity.has(densityNum)) {
            positioningBundlesByDensity.set(densityNum, []);
        }
        positioningBundlesByDensity.get(densityNum).push({
            family: fontFamilyFromID,
            styleIdx,
            weightIdx,
            size: sizeNum,
            arrays: positioningArrays,
        });
    });

    // Comparator for deterministic record ordering — keeps bundle bytes stable
    // across builds for the same font set.
    const _bundleSort = (a, b) => {
        if (a.family !== b.family) return a.family < b.family ? -1 : 1;
        if (a.styleIdx !== b.styleIdx) return a.styleIdx - b.styleIdx;
        const aw = typeof a.weightIdx === 'number' ? a.weightIdx : 0;
        const bw = typeof b.weightIdx === 'number' ? b.weightIdx : 0;
        if (aw !== bw) return aw - bw;
        return a.size - b.size;
    };

    const folderDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60 * 1000);

    // Metrics bundle. Envelope shape: { formatVersion, records: [...] }. The
    // runtime refuses to load a mismatched version, so this version is in
    // lockstep with FontLoaderBase.BUNDLE_FORMAT_VERSION.
    const metricsBundlePromise = (() => {
        const recordsArr = Array.from(bundleRecords.values()).sort(_bundleSort);
        const records = recordsArr.map(r => [r.family, r.styleIdx, r.weightIdx, r.size, r.minified]);
        const envelope = { formatVersion: BUNDLE_FORMAT_VERSION, records };
        const json = JSON.stringify(envelope);
        console.log(`📦 Metrics bundle: ${recordsArr.length} records, JSON size: ${json.length} bytes`);
        return _deflateRawBase64InBrowser(json).then(b64 => {
            const wrapped = `BitmapText.rBundle('${b64}');\n`;
            folder.file('metrics-bundle.js', wrapped, { date: folderDate });
            console.log(`📦 metrics-bundle.js: ${wrapped.length} bytes (${b64.length} base64 chars)`);
        });
    })();

    // Per-density positioning bundles. One file per density; consumers download
    // only the bundle for the density their app uses.
    const positioningBundlePromises = [];
    for (const [density, records] of positioningBundlesByDensity.entries()) {
        records.sort(_bundleSort);
        const records5 = records.map(r => [r.family, r.styleIdx, r.weightIdx, r.size, r.arrays]);
        const envelope = { formatVersion: BUNDLE_FORMAT_VERSION, density, records: records5 };
        const json = JSON.stringify(envelope);
        console.log(`📦 Positioning bundle (density ${density}): ${records.length} records, JSON size: ${json.length} bytes`);
        positioningBundlePromises.push(
            _deflateRawBase64InBrowser(json).then(b64 => {
                const wrapped = `BitmapText.pBundle(${density},'${b64}');\n`;
                folder.file(`positioning-bundle-density-${density}.js`, wrapped, { date: folderDate });
                console.log(`📦 positioning-bundle-density-${density}.js: ${wrapped.length} bytes (${b64.length} base64 chars)`);
            })
        );
    }

    // Wait for every bundle to be written, then generate the zip.
    return Promise.all([metricsBundlePromise, ...positioningBundlePromises])
        .then(() => zip.generateAsync({ type: "base64" }))
        .then(base64Content => {
            console.log('✅ ZIP generated successfully, ready for transfer');

            // In browser UI context with FileSaver available, trigger download
            // Note: Always return base64 even if we also trigger download
            // Don't trigger download in automation mode to avoid page reload conflicts
            if (typeof saveAs === 'function' && !isAutomationMode) {
                // Convert base64 back to blob for FileSaver
                const byteCharacters = atob(base64Content);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'application/zip' });

                // Trigger download but don't wait for it
                saveAs(blob, "fontAssets.zip");
            }

            // ALWAYS return base64 for automation/Playwright context
            return base64Content;
        });
}