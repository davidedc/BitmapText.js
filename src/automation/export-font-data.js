// Helper: deflate-raw + base64 encode a string in the browser using
// CompressionStream. Pairs with BundleCodec.decodeBundle on the runtime side.
// Kept inline (not in BundleCodec) because the producer path is browser-only
// and uses CompressionStream directly; BundleCodec's helpers are decode-only.
async function _deflateRawBase64InBrowser(jsonString) {
    const u8 = new TextEncoder().encode(jsonString);
    const cs = new Response(u8).body.pipeThrough(new CompressionStream('deflate-raw'));
    const compressed = new Uint8Array(await new Response(cs).arrayBuffer());
    return BundleCodec.bytesToBase64(compressed);
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

// Comparator for deterministic record ordering — keeps bundle bytes stable
// across builds for the same font set.
function _bundleSort(a, b) {
    if (a.family !== b.family) return a.family < b.family ? -1 : 1;
    if (a.styleIdx !== b.styleIdx) return a.styleIdx - b.styleIdx;
    const aw = typeof a.weightIdx === 'number' ? a.weightIdx : 0;
    const bw = typeof b.weightIdx === 'number' ? b.weightIdx : 0;
    if (aw !== bw) return aw - bw;
    return a.size - b.size;
}

// Resolve the list of fonts to export from caller options. Two modes:
// - Automation: options.* are null → enumerate every font registered in AtlasDataStoreFAB.
// - UI: options.* point at one (density, family, style, weight) → enumerate sizes only.
function _resolveFontList(options, isAutomationMode) {
    const availableFonts = AtlasDataStoreFAB.getAvailableFonts();
    const out = [];
    if (isAutomationMode) {
        console.log('Automation mode: exporting ALL built fonts');
        for (const fontKey of availableFonts) {
            // Font key format: "pixelDensity:fontFamily:fontStyle:fontWeight:fontSize"
            const parts = fontKey.split(':');
            if (parts.length === 5) {
                out.push({
                    pixelDensity: parseFloat(parts[0]),
                    fontFamily: parts[1],
                    fontStyle: parts[2],
                    fontWeight: parts[3],
                    fontSize: parseFloat(parts[4])
                });
            }
        }
        console.log(`Found ${out.length} font(s) to export`);
    } else {
        const { pixelDensity, fontFamily, fontStyle, fontWeight } = options;
        const sizes = new Set();
        const baseKeyPrefix = `${pixelDensity}:${fontFamily}:${fontStyle}:${fontWeight}:`;
        for (const fontKey of availableFonts) {
            if (fontKey.startsWith(baseKeyPrefix)) {
                sizes.add(parseFloat(fontKey.substring(baseKeyPrefix.length)));
            }
        }
        if (sizes.size > 0) {
            console.log(`Found ${sizes.size} font size(s) to export:`, Array.from(sizes));
            sizes.forEach(size => out.push({
                pixelDensity, fontFamily, fontStyle, fontWeight, fontSize: size
            }));
        }
    }
    return out;
}

// FontAssetExporter — per-export build state. One instance per downloadFontAssets call.
// Owns the JSZip, the density-agnostic bundle accumulator, and the per-density
// positioning accumulator. Methods correspond to the phases of the export:
// _processSingleFont fans out into _addAtlasToZip / _selectCharacterMetrics /
// _recordMinifiedMetrics / _recordPositioning, then _emitMetricsBundleFile and
// _emitPositioningBundleFiles produce the bundle artifacts and _finalizeZip
// hands back the base64 zip (and optionally triggers a UI download).
class FontAssetExporter {
    constructor(options, isAutomationMode, fontsToExport) {
        this.options = options;
        this.isAutomationMode = isAutomationMode;
        this.fontsToExport = fontsToExport;
        this.zip = new JSZip();
        this.folder = this.zip.folder("fontAssets");
        // Timezone-corrected date: JSZip interprets stored dates as local time.
        const now = new Date();
        this.folderDate = new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000);
        // Density-agnostic minified records, keyed by `family|styleIdx|weightIdx|size`.
        this.bundleRecords = new Map();
        // density → array of {family, styleIdx, weightIdx, size, arrays}.
        this.positioningBundlesByDensity = new Map();
    }

    async export() {
        for (const fontConfig of this.fontsToExport) {
            this._processSingleFont(fontConfig);
        }
        await Promise.all([
            this._emitMetricsBundleFile(),
            ...this._emitPositioningBundleFiles(),
        ]);
        return this._finalizeZip();
    }

    _processSingleFont(fontConfig) {
        const fontProperties = new FontPropertiesFAB(
            fontConfig.pixelDensity,
            fontConfig.fontFamily,
            fontConfig.fontStyle,
            fontConfig.fontWeight,
            fontConfig.fontSize
        );

        console.log(`\n=== Exporting ${fontProperties.key} ===`);

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

        console.log(`Building Atlas for ${fontProperties.key}...`);
        const atlasResult = AtlasDataStoreFAB.buildAtlas(fontProperties);
        if (!atlasResult || !atlasResult.canvas) {
            console.error(`Failed to build atlas for ${fontProperties.key}, skipping export`);
            return;
        }
        console.log(`Atlas built successfully: ${atlasResult.canvas.width}x${atlasResult.canvas.height}`);

        const canvas = atlasResult.canvas;
        if (!canvas.getContext) {
            console.warn(`Invalid canvas from AtlasImage for ${fontProperties.key}, skipping export`);
            return;
        }
        if (canvas.width === 0 || canvas.height === 0) {
            console.warn(`Canvas has 0x0 dimensions for ${fontProperties.key}, skipping export`);
            return;
        }

        this._addAtlasToZip(fontProperties.idString, canvas);

        const fontMetrics = FontMetricsStoreFAB.getFontMetrics(fontProperties);
        if (!fontMetrics) {
            console.warn(`No FontMetrics found for ${fontProperties.key}, skipping export`);
            return;
        }

        const generatedMetrics = fontMetrics._characterMetrics;
        if (Object.keys(generatedMetrics).length === 0) {
            console.warn(`No glyphs found for ${fontProperties.key}, skipping export`);
            return;
        }

        const characterMetrics = this._selectCharacterMetrics(generatedMetrics, fontProperties);
        const idParts = this._decomposeIdString(fontProperties.idString);

        this._recordMinifiedMetrics(idParts, fontMetrics, characterMetrics);
        this._recordPositioning(fontConfig, fontProperties, glyphs, atlasResult, idParts);
    }

    _addAtlasToZip(idString, canvas) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const qoiBuffer = QOIEncode(imageData.data, {
            width: canvas.width,
            height: canvas.height,
            channels: 4, // RGBA
            colorspace: 0 // sRGB with linear alpha
        });
        const qoiUint8Array = new Uint8Array(qoiBuffer);
        const qoiBase64 = btoa(String.fromCharCode(...qoiUint8Array));
        this.folder.file(`atlas-${idString}.qoi`, qoiBase64, { base64: true, date: this.folderDate });
    }

    // Resolve the character-set for this font. Standard fonts ship all
    // CharacterSets.FONT_SPECIFIC_CHARS (with placeholders for missing glyphs).
    // BitmapTextInvariant uses its smaller invariant set. Throws if the font
    // contains characters outside FONT_SPECIFIC_CHARS — a sign that the
    // character set needs extending.
    _selectCharacterMetrics(generatedMetrics, fontProperties) {
        const isInvariantFont = fontProperties.fontFamily === 'BitmapTextInvariant';

        if (isInvariantFont) {
            const targetSet = Array.from(window.CharacterSets.FONT_INVARIANT_CHARS);
            const out = {};
            for (const char of targetSet) {
                if (generatedMetrics[char]) {
                    out[char] = generatedMetrics[char];
                } else {
                    console.warn(`⚠️  Custom character '${char}' not found in generated metrics, skipping`);
                }
            }
            console.log(`📝 Font has custom character set, exporting ${Object.keys(out).length} characters: ${targetSet.join('')}`);
            return out;
        }

        // Standard font: include all FONT_SPECIFIC_CHARS, generate placeholders for missing.
        const firstChar = Object.keys(generatedMetrics)[0];
        const fallback = generatedMetrics[firstChar];
        const placeholder = () => ({
            width: 0,
            actualBoundingBoxLeft: 0,
            actualBoundingBoxRight: 0,
            actualBoundingBoxAscent: 0,
            actualBoundingBoxDescent: 0,
            fontBoundingBoxAscent: fallback.fontBoundingBoxAscent,
            fontBoundingBoxDescent: fallback.fontBoundingBoxDescent,
            hangingBaseline: fallback.hangingBaseline,
            alphabeticBaseline: fallback.alphabeticBaseline,
            ideographicBaseline: fallback.ideographicBaseline,
            pixelDensity: fallback.pixelDensity
        });

        const out = {};
        for (const char of CharacterSets.FONT_SPECIFIC_CHARS) {
            out[char] = generatedMetrics[char] || placeholder();
        }

        const missingChars = Array.from(CharacterSets.FONT_SPECIFIC_CHARS).filter(char => !generatedMetrics[char]);
        if (missingChars.length > 0) {
            console.warn(`⚠️  Generated placeholder metrics for ${missingChars.length} missing characters: ${missingChars.slice(0, 10).join('')}${missingChars.length > 10 ? '...' : ''}`);
        }

        const extraChars = Object.keys(generatedMetrics).filter(char => !CharacterSets.FONT_SPECIFIC_CHARS.includes(char));
        if (extraChars.length > 0) {
            throw new Error(
                `Font contains ${extraChars.length} characters not in CharacterSets.FONT_SPECIFIC_CHARS: ${extraChars.join(', ')}\n` +
                `Please update CharacterSets.FONT_SPECIFIC_CHARS in src/runtime/BitmapText.js to include these characters.`
            );
        }

        return out;
    }

    // Decompose the FontProperties ID string into bundle-record fields.
    // ID string format: <pad>-<densInt>-<densFrac>-<family>-<...>-<style>-<...>-<weight>-<...>-<sizeInt>-<sizeFrac>
    // Density is not used in bundle keys (bundle is density-agnostic).
    _decomposeIdString(idString) {
        const parts = idString.split('-');
        const family = parts[3];
        const style = parts[5];   // "normal" | "italic" | "oblique"
        const weight = parts[7];  // "normal" | "bold" | numeric
        const sizeStr = parts[9] + (parts[10] === '0' ? '' : '.' + parts[10]);
        return {
            family,
            styleIdx: style === 'normal' ? 0 : (style === 'italic' ? 1 : 2),
            weightIdx: weight === 'normal' ? 0 : (weight === 'bold' ? 1 : weight),
            size: parseFloat(sizeStr)
        };
    }

    // Accumulate one density-agnostic minified record. Subsequent densities of the
    // same (family, style, weight, size) re-use the first entry — only pixelDensity
    // differs across densities and the runtime injects it at MetricsExpander.expand.
    _recordMinifiedMetrics(idParts, fontMetrics, characterMetrics) {
        const isInvariant = idParts.family === 'BitmapTextInvariant';
        const characterSet = isInvariant
            ? Array.from(window.CharacterSets.FONT_INVARIANT_CHARS)
            : CharacterSets.FONT_SPECIFIC_CHARS;
        if (isInvariant) {
            console.log(`📝 Using font-invariant character set for ${idParts.family}`);
        }

        const metricsData = {
            kerningTable: fontMetrics._kerningTable,
            characterMetrics: characterMetrics,
            spaceAdvancementOverrideForSmallSizesInPx: fontMetrics._spaceAdvancementOverride
        };

        // minifyWithVerification catches compression bugs immediately during
        // build — throws if characterMetrics isn't in the expected order.
        const minified = MetricsMinifier.minifyWithVerification(metricsData, characterSet);

        const bundleKey = `${idParts.family}|${idParts.styleIdx}|${idParts.weightIdx}|${idParts.size}`;
        if (!this.bundleRecords.has(bundleKey)) {
            this.bundleRecords.set(bundleKey, {
                family: idParts.family,
                styleIdx: idParts.styleIdx,
                weightIdx: idParts.weightIdx,
                size: idParts.size,
                minified: _stripDensityFromBaseline(minified),
            });
        }
    }

    // Build the per-(font, density) positioning record. Same glyphs we just
    // packed into the tight atlas, in the same sorted-character order — the
    // runtime PositioningBundleStore zips these arrays with the character
    // set on materialisation.
    //
    // For multi-row atlases (wide italic-bold density-2 sizes that exceed
    // cwebp's 16383px limit), AtlasBuilder returns per-glyph yInAtlas. Wire
    // that into AtlasPositioningFAB so serialiseAsBundleRecord emits a 5th
    // (yInAtlas) array. Single-row atlases get 4 arrays as before.
    _recordPositioning(fontConfig, fontProperties, glyphs, atlasResult, idParts) {
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
        const positioningEncoded = positioningFAB.serialiseAsBundleRecord();

        const density = fontConfig.pixelDensity;
        if (!this.positioningBundlesByDensity.has(density)) {
            this.positioningBundlesByDensity.set(density, []);
        }
        this.positioningBundlesByDensity.get(density).push({
            family: idParts.family,
            styleIdx: idParts.styleIdx,
            weightIdx: idParts.weightIdx,
            size: idParts.size,
            arrays: positioningEncoded,
        });
    }

    // Metrics bundle: envelope { formatVersion, records: [...] }. The runtime
    // refuses to load a mismatched version, so this version is in lockstep with
    // BitmapText.BUNDLE_SCHEMA_VERSION.
    _emitMetricsBundleFile() {
        const recordsArr = Array.from(this.bundleRecords.values()).sort(_bundleSort);
        const records = recordsArr.map(r => [r.family, r.styleIdx, r.weightIdx, r.size, r.minified]);
        const envelope = { formatVersion: BitmapText.BUNDLE_SCHEMA_VERSION, records };
        const json = JSON.stringify(envelope);
        console.log(`📦 Metrics bundle: ${recordsArr.length} records, JSON size: ${json.length} bytes`);
        return _deflateRawBase64InBrowser(json).then(b64 => {
            const wrapped = `BitmapText.rBundle('${b64}');\n`;
            this.folder.file('metrics-bundle.js', wrapped, { date: this.folderDate });
            console.log(`📦 metrics-bundle.js: ${wrapped.length} bytes (${b64.length} base64 chars)`);
        });
    }

    // Per-density positioning bundles. One file per density; consumers download
    // only the bundle for the density their app uses.
    _emitPositioningBundleFiles() {
        const promises = [];
        for (const [density, records] of this.positioningBundlesByDensity.entries()) {
            records.sort(_bundleSort);
            const recordsArr = records.map(r => [r.family, r.styleIdx, r.weightIdx, r.size, r.arrays]);
            const envelope = { formatVersion: BitmapText.BUNDLE_SCHEMA_VERSION, density, records: recordsArr };
            const json = JSON.stringify(envelope);
            console.log(`📦 Positioning bundle (density ${density}): ${records.length} records, JSON size: ${json.length} bytes`);
            promises.push(
                _deflateRawBase64InBrowser(json).then(b64 => {
                    const wrapped = `BitmapText.pBundle(${density},'${b64}');\n`;
                    this.folder.file(`positioning-bundle-density-${density}.js`, wrapped, { date: this.folderDate });
                    console.log(`📦 positioning-bundle-density-${density}.js: ${wrapped.length} bytes (${b64.length} base64 chars)`);
                })
            );
        }
        return promises;
    }

    _finalizeZip() {
        return this.zip.generateAsync({ type: "base64" }).then(base64Content => {
            console.log('✅ ZIP generated successfully, ready for transfer');

            // In UI context with FileSaver, trigger download. Don't do this in
            // automation mode (Playwright saves via the returned base64).
            if (typeof saveAs === 'function' && !this.isAutomationMode) {
                const byteCharacters = atob(base64Content);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'application/zip' });
                saveAs(blob, "fontAssets.zip");
            }

            // Always return base64 (automation context needs it).
            return base64Content;
        });
    }
}

// Public entry point. Preserves the existing UI alert and automation rejection
// behaviours; the heavy lifting is in FontAssetExporter.
function downloadFontAssets(options) {
    const isAutomationMode = options.pixelDensity === null && options.fontFamily === null &&
        options.fontStyle === null && options.fontWeight === null;

    const fontsToExport = _resolveFontList(options, isAutomationMode);

    if (fontsToExport.length === 0) {
        if (!isAutomationMode) {
            alert('No fonts have been built yet. Please select a font configuration and wait for glyphs to render before downloading.');
            return;
        }
        console.error('No fonts available to export');
        return Promise.reject(new Error('No fonts available to export'));
    }

    return new FontAssetExporter(options, isAutomationMode, fontsToExport).export();
}
