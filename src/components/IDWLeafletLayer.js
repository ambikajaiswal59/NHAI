import L from 'leaflet';
import { renderIDWToCanvas } from '../utils/idwRenderer';

// ─── Global Cache ─────────────────────────────────────────────────────────────
// Use a global cache that can be accessed across components
const IDW_RENDER_CACHE = window.IDW_RENDER_CACHE || new Map();
window.IDW_RENDER_CACHE = IDW_RENDER_CACHE;

const IDW_CACHE_MAX = 60; // Increased to hold more months

function cacheGet(key) {
    if (!key) return null;
    const entry = IDW_RENDER_CACHE.get(key);
    if (!entry) return null;
    // Move to front for LRU
    IDW_RENDER_CACHE.delete(key);
    IDW_RENDER_CACHE.set(key, entry);
    return entry;
}

function cacheSet(key, entry) {
    if (!key) return;
    if (IDW_RENDER_CACHE.has(key)) {
        IDW_RENDER_CACHE.delete(key);
    } else if (IDW_RENDER_CACHE.size >= IDW_CACHE_MAX) {
        // Remove oldest entry
        const oldestKey = IDW_RENDER_CACHE.keys().next().value;
        IDW_RENDER_CACHE.delete(oldestKey);
    }
    IDW_RENDER_CACHE.set(key, entry);
}

export function clearIDWRenderCache() {
    IDW_RENDER_CACHE.clear();
    window.IDW_RENDER_CACHE = IDW_RENDER_CACHE;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const IDW_RASTER_LONG_EDGE = 400;
const IDW_BOUNDS_PADDING_RATIO = 0.08;

// ─── Layer ────────────────────────────────────────────────────────────────────
export const IDWLeafletLayer = L.Layer.extend({

    initialize(data, property, options = {}) {
        L.setOptions(this, options);
        this._data = data || [];
        this._property = property || 'precip_mm';
        this._opacity = options.opacity ?? 0.7;
        this._zIndex = options.zIndex ?? 1000;
        this._clipPolygon = options.clipPolygon || null;
        this._cacheKey = options.cacheKey || null;
        this._propertyMap = options.propertyMap || {
            temperature: 'avg_temp',
            rainfall: 'rain_precip',
            wind: 'wind'
        };

        // Persistent canvas — never removed/re-added
        this._canvas = document.createElement('canvas');
        this._canvas.style.cssText = `
            position: absolute;
            pointer-events: none;
            opacity: ${this._opacity};
            z-index: ${this._zIndex};
            image-rendering: pixelated;
            transition: opacity 200ms ease-out;
        `;

        this._isRendering = false;
        this._pendingRender = false;
        this._geoBounds = null;
        this._currentCacheKey = null;
    },

    // ── Lifecycle ──────────────────────────────────────────────────────────────

    onAdd(map) {
        this._map = map;
        // Insert canvas directly into Leaflet's overlay pane
        map.getPanes().overlayPane.appendChild(this._canvas);

        map.on('moveend zoom', this._repositionCanvas, this);
        map.on('zoomanim', this._onZoomAnim, this);

        this._render();
    },

    onRemove(map) {
        map.off('moveend zoom', this._repositionCanvas, this);
        map.off('zoomanim', this._onZoomAnim, this);

        if (this._canvas.parentNode) {
            this._canvas.parentNode.removeChild(this._canvas);
        }
        this._map = null;
    },

    // ── Public API ─────────────────────────────────────────────────────────────

    updateData(data, property, cacheKey) {
        this._data = data || [];
        this._property = property || this._property;
        if (cacheKey !== undefined) this._cacheKey = cacheKey;
        if (this._map) {
            // Small delay to let the UI breathe
            setTimeout(() => this._render(), 10);
        }
    },

    setOpacity(opacity) {
        this._opacity = opacity;
        this._canvas.style.opacity = opacity;
    },

    // ─── Pre-render all months for a single property ──────────────────────────
    preRenderAllMonths: async function (allMonthlyData, property, layerPropertyMap) {
        if (!allMonthlyData?.length) return;

        const prop = layerPropertyMap?.[property] || property;

        // Get unique months
        const uniqueMonths = [...new Set(allMonthlyData.map(item =>
            `${item.year}-${String(item.month).padStart(2, '0')}`
        ))].sort();

        console.log(`🔥 Pre-rendering ${uniqueMonths.length} months into cache...`);

        for (const monthKey of uniqueMonths) {
            const monthData = allMonthlyData.filter(item =>
                `${item.year}-${String(item.month).padStart(2, '0')}` === monthKey
            );

            const cacheKey = `${monthKey}::${prop}`;

            // Skip if already cached
            if (cacheGet(cacheKey)) {
                console.log(`⚡ Already cached: ${cacheKey}`);
                continue;
            }

            try {
                const geoBounds = this._computeRenderBoundsFromData(monthData);
                if (!geoBounds) continue;

                const { width, height } = this._computeResolution(geoBounds);

                // Render offscreen — user sees nothing, no blink possible
                const offscreen = await renderIDWToCanvas(monthData, prop, geoBounds, width, height);
                if (!offscreen) continue;

                let finalCanvas = offscreen;
                if (this._clipPolygon) {
                    try {
                        finalCanvas = await this._applyPolygonClip(offscreen, geoBounds);
                    } catch { finalCanvas = offscreen; }
                }

                cacheSet(cacheKey, { canvas: finalCanvas, geoBounds });
                console.log(`✅ Pre-cached: ${cacheKey}`);

            } catch (err) {
                console.warn(`Failed to pre-render ${cacheKey}:`, err);
            }
        }

        console.log('🎉 All months pre-rendered — zero blink guaranteed');
    },

    // ─── NEW: Pre-render ALL layers for ALL months ───────────────────────────
    preRenderAllLayers: async function (allMonthlyData, properties, layerPropertyMap) {
        if (!allMonthlyData?.length) return;

        const uniqueMonths = [...new Set(allMonthlyData.map(item =>
            `${item.year}-${String(item.month).padStart(2, '0')}`
        ))].sort();

        console.log(`🔥 Pre-rendering ALL layers (${properties.join(', ')}) for ${uniqueMonths.length} months...`);

        for (const layerId of properties) {
            const prop = layerPropertyMap?.[layerId] || layerId;

            for (const monthKey of uniqueMonths) {
                const cacheKey = `${monthKey}::${prop}`;
                if (cacheGet(cacheKey)) {
                    console.log(`⚡ Already cached: ${cacheKey}`);
                    continue; // already cached, skip
                }

                const monthData = allMonthlyData.filter(item =>
                    `${item.year}-${String(item.month).padStart(2, '0')}` === monthKey
                );
                if (monthData.length === 0) continue;

                // Yield to the browser between every single render —
                // this is what keeps background prefetch invisible to the user
                await new Promise((resolve) =>
                    (window.requestIdleCallback || window.requestAnimationFrame)(resolve)
                );

                try {
                    const geoBounds = this._computeRenderBoundsFromData(monthData);
                    if (!geoBounds) continue;
                    const { width, height } = this._computeResolution(geoBounds);

                    const offscreen = await renderIDWToCanvas(monthData, prop, geoBounds, width, height);
                    if (!offscreen) continue;

                    let finalCanvas = offscreen;
                    if (this._clipPolygon) {
                        try {
                            finalCanvas = await this._applyPolygonClip(offscreen, geoBounds);
                        } catch { finalCanvas = offscreen; }
                    }

                    cacheSet(cacheKey, { canvas: finalCanvas, geoBounds });
                    console.log(`✅ Pre-cached: ${cacheKey}`);

                } catch (err) {
                    console.warn(`Prefetch failed for ${cacheKey}:`, err);
                }
            }
        }

        console.log('🎉 All layers × all months pre-rendered — every switch is now instant');
    },

    // ─── Helper to compute bounds from a specific data array ────────────────
    _computeRenderBoundsFromData(data) {
        if (this._clipPolygon) {
            const rings = this._extractRings(this._clipPolygon);
            if (rings.length > 0) {
                let minLat = Infinity, maxLat = -Infinity;
                let minLng = Infinity, maxLng = -Infinity;
                rings.forEach(ring => ring.forEach(([lng, lat]) => {
                    if (typeof lat !== 'number' || typeof lng !== 'number') return;
                    if (lat < minLat) minLat = lat;
                    if (lat > maxLat) maxLat = lat;
                    if (lng < minLng) minLng = lng;
                    if (lng > maxLng) maxLng = lng;
                }));
                if (isFinite(minLat)) {
                    const latPad = (maxLat - minLat) * IDW_BOUNDS_PADDING_RATIO || 0.01;
                    const lngPad = (maxLng - minLng) * IDW_BOUNDS_PADDING_RATIO || 0.01;
                    return {
                        minLat: minLat - latPad, maxLat: maxLat + latPad,
                        minLng: minLng - lngPad, maxLng: maxLng + lngPad,
                    };
                }
            }
        }

        if (!data?.length) return null;
        let minLat = Infinity, maxLat = -Infinity;
        let minLng = Infinity, maxLng = -Infinity;
        data.forEach(d => {
            const lat = parseFloat(d.latitude);
            const lng = parseFloat(d.longitude);
            if (isNaN(lat) || isNaN(lng)) return;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
        });
        if (!isFinite(minLat)) return null;
        const latPad = (maxLat - minLat) * IDW_BOUNDS_PADDING_RATIO || 0.05;
        const lngPad = (maxLng - minLng) * IDW_BOUNDS_PADDING_RATIO || 0.05;
        return {
            minLat: minLat - latPad, maxLat: maxLat + latPad,
            minLng: minLng - lngPad, maxLng: maxLng + lngPad,
        };
    },

    // ── Rendering ──────────────────────────────────────────────────────────────

    _render: async function () {
        if (this._isRendering) {
            this._pendingRender = true;
            return;
        }
        if (!this._map || !this._data?.length) return;

        this._isRendering = true;

        try {
            const cacheKey = this._deriveCacheKey();
            this._currentCacheKey = cacheKey;

            // ✅ Check global cache first
            const cached = cacheGet(cacheKey);

            if (cached) {
                // Cache hit — paint instantly, zero blink
                console.log(`⚡ IDW cache hit: ${cacheKey}`);
                this._paintCachedFrame(cached);
                return;
            }

            console.log(`🎨 Rendering IDW: ${cacheKey}`);
            const geoBounds = this._computeRenderBounds();
            if (!geoBounds) return;

            const { width, height } = this._computeResolution(geoBounds);

            // Render IDW into an offscreen canvas (async, chunked)
            const offscreen = await renderIDWToCanvas(
                this._data, this._property, geoBounds, width, height
            );
            if (!this._map || !offscreen) return;

            // Apply clip if needed
            let finalCanvas = offscreen;
            if (this._clipPolygon) {
                try {
                    finalCanvas = await this._applyPolygonClip(offscreen, geoBounds);
                } catch {
                    finalCanvas = offscreen;
                }
            }

            // ✅ Store in global cache
            cacheSet(cacheKey, { canvas: finalCanvas, geoBounds });
            console.log(`✅ IDW cached: ${cacheKey}`);

            // Paint directly — one synchronous drawImage, no img loading gap
            this._paintFrame(finalCanvas, geoBounds);

        } catch (err) {
            console.error('IDW render error:', err);
        } finally {
            this._isRendering = false;
            if (this._pendingRender) {
                this._pendingRender = false;
                this._render();
            }
        }
    },

    /**
     * KEY METHOD: paint a rendered canvas directly onto our persistent canvas.
     * This is synchronous and atomic — no img tag, no load event, no blink.
     */
    _paintFrame(sourceCanvas, geoBounds) {
        if (!this._map) return;

        this._geoBounds = geoBounds;

        const { width, height } = this._getCanvasPixelSize(geoBounds);

        // Only resize if dimensions changed
        if (this._canvas.width !== width || this._canvas.height !== height) {
            this._canvas.width = width;
            this._canvas.height = height;
        }

        const ctx = this._canvas.getContext('2d');
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(sourceCanvas, 0, 0, width, height);

        this._repositionCanvas();
    },

    _paintCachedFrame({ canvas, geoBounds }) {
        this._paintFrame(canvas, geoBounds);
    },

    // ── Canvas positioning ─────────────────────────────────────────────────────

    /**
     * Repositions the canvas on every map move/zoom so it stays aligned
     * with the geographic bounds it was rendered for.
     */
    _repositionCanvas() {
        if (!this._map || !this._geoBounds) return;

        const { minLat, maxLat, minLng, maxLng } = this._geoBounds;

        const topLeft = this._map.latLngToLayerPoint([maxLat, minLng]);
        const bottomRight = this._map.latLngToLayerPoint([minLat, maxLng]);

        const width = bottomRight.x - topLeft.x;
        const height = bottomRight.y - topLeft.y;

        // Move and scale the canvas to match current map viewport
        this._canvas.style.left = `${topLeft.x}px`;
        this._canvas.style.top = `${topLeft.y}px`;
        this._canvas.style.width = `${width}px`;
        this._canvas.style.height = `${height}px`;
    },

    _onZoomAnim(e) {
        // Hide during zoom animation (same as Leaflet's own layers)
        // Leaflet re-fires 'zoom' after animation ends, which calls _repositionCanvas
    },

    _getCanvasPixelSize(geoBounds) {
        const { width, height } = this._computeResolution(geoBounds);
        return { width, height };
    },

    // ── Bounds & resolution ────────────────────────────────────────────────────

    _computeRenderBounds() {
        const ringsToBBox = (rings) => {
            let minLat = Infinity, maxLat = -Infinity;
            let minLng = Infinity, maxLng = -Infinity;
            rings.forEach(ring => ring.forEach(([lng, lat]) => {
                if (typeof lat !== 'number' || typeof lng !== 'number') return;
                if (lat < minLat) minLat = lat;
                if (lat > maxLat) maxLat = lat;
                if (lng < minLng) minLng = lng;
                if (lng > maxLng) maxLng = lng;
            }));
            return isFinite(minLat) ? { minLat, maxLat, minLng, maxLng } : null;
        };

        if (this._clipPolygon) {
            const rings = this._extractRings(this._clipPolygon);
            const bbox = rings.length > 0 ? ringsToBBox(rings) : null;
            if (bbox) {
                const latPad = (bbox.maxLat - bbox.minLat) * IDW_BOUNDS_PADDING_RATIO || 0.01;
                const lngPad = (bbox.maxLng - bbox.minLng) * IDW_BOUNDS_PADDING_RATIO || 0.01;
                return {
                    minLat: bbox.minLat - latPad,
                    maxLat: bbox.maxLat + latPad,
                    minLng: bbox.minLng - lngPad,
                    maxLng: bbox.maxLng + lngPad,
                };
            }
        }

        if (this._data?.length > 0) {
            let minLat = Infinity, maxLat = -Infinity;
            let minLng = Infinity, maxLng = -Infinity;
            this._data.forEach(d => {
                const lat = parseFloat(d.latitude);
                const lng = parseFloat(d.longitude);
                if (isNaN(lat) || isNaN(lng)) return;
                if (lat < minLat) minLat = lat;
                if (lat > maxLat) maxLat = lat;
                if (lng < minLng) minLng = lng;
                if (lng > maxLng) maxLng = lng;
            });
            if (isFinite(minLat)) {
                const latPad = (maxLat - minLat) * IDW_BOUNDS_PADDING_RATIO || 0.05;
                const lngPad = (maxLng - minLng) * IDW_BOUNDS_PADDING_RATIO || 0.05;
                return {
                    minLat: minLat - latPad, maxLat: maxLat + latPad,
                    minLng: minLng - lngPad, maxLng: maxLng + lngPad,
                };
            }
        }

        return null;
    },

    _computeResolution(geoBounds) {
        const latRange = geoBounds.maxLat - geoBounds.minLat;
        const lngRange = geoBounds.maxLng - geoBounds.minLng;
        const avgLatRad = ((geoBounds.minLat + geoBounds.maxLat) / 2) * (Math.PI / 180);
        const adjustedLng = lngRange * Math.cos(avgLatRad);
        const aspect = adjustedLng > 0 ? latRange / adjustedLng : 1;

        let width, height;
        if (aspect >= 1) {
            height = IDW_RASTER_LONG_EDGE;
            width = Math.max(64, Math.round(IDW_RASTER_LONG_EDGE / aspect));
        } else {
            width = IDW_RASTER_LONG_EDGE;
            height = Math.max(64, Math.round(IDW_RASTER_LONG_EDGE * aspect));
        }
        return { width, height };
    },

    _deriveCacheKey() {
        if (this._cacheKey) return this._cacheKey;
        const n = this._data.length;
        const sample = this._data.slice(0, 5)
            .map(d => `${d.latitude},${d.longitude},${d[this._property]}`)
            .join('|');
        return `auto::${this._property}::${n}::${sample}`;
    },

    // ── Clipping (unchanged from your original) ────────────────────────────────

    _applyPolygonClip(canvas, boundsObj) {
        return new Promise((resolve) => {
            try {
                const { width, height } = canvas;
                if (width <= 0 || height <= 0) {
                    resolve(canvas); return;
                }

                const polygonRings = this._getPolygonPixelRings(boundsObj, width, height);
                if (!polygonRings?.length) {
                    resolve(canvas); return;
                }

                const clipped = document.createElement('canvas');
                clipped.width = width;
                clipped.height = height;
                const ctx = clipped.getContext('2d');

                ctx.drawImage(canvas, 0, 0);
                ctx.save();
                ctx.beginPath();

                polygonRings.forEach(ring => {
                    ring.forEach(([x, y], i) => {
                        if (i === 0) ctx.moveTo(x, y);
                        else ctx.lineTo(x, y);
                    });
                    ctx.closePath();
                });

                ctx.globalCompositeOperation = 'destination-in';
                ctx.fill();
                ctx.restore();

                resolve(clipped);
            } catch (e) {
                console.warn('Clip error:', e);
                resolve(canvas);
            }
        });
    },

    _lngLatToPixel([lng, lat], boundsObj, w, h) {
        const { minLat, maxLat, minLng, maxLng } = boundsObj;
        if (typeof lat !== 'number' || typeof lng !== 'number') return null;
        return [
            ((lng - minLng) / (maxLng - minLng)) * w,
            ((maxLat - lat) / (maxLat - minLat)) * h,
        ];
    },

    _getPolygonPixelRings(boundsObj, w, h) {
        try {
            const rings = this._extractRings(this._clipPolygon);
            if (!rings?.length) return null;

            const pixelRings = rings
                .map(ring => ring
                    .map(coord => Array.isArray(coord) && coord.length >= 2
                        ? this._lngLatToPixel(coord, boundsObj, w, h)
                        : null)
                    .filter(Boolean))
                .filter(ring => ring.length >= 3);

            return pixelRings.length > 0 ? pixelRings : null;
        } catch (e) {
            console.warn('Ring pixel error:', e);
            return null;
        }
    },

    _extractRings(input) {
        if (!input) return [];
        try {
            if (input.type === 'FeatureCollection')
                return (input.features || []).flatMap(f => this._extractRings(f.geometry));
            if (input.type === 'Feature')
                return this._extractRings(input.geometry);
            if (input.type === 'GeometryCollection')
                return (input.geometries || []).flatMap(g => this._extractRings(g));
            if (input.type === 'Polygon')
                return input.coordinates?.[0] ? [input.coordinates[0]] : [];
            if (input.type === 'MultiPolygon')
                return (input.coordinates || []).map(p => p?.[0]).filter(Boolean);
            if (Array.isArray(input)) return [input];
        } catch (e) {
            console.warn('Extract rings error:', e);
        }
        return [];
    },

    // ── Public shims ──────────────────────────────────────────────────────────
    isVisible() { return !!this._map && !!this._geoBounds; },
    getData() { return this._data; },
    getProperty() { return this._property; },
    remove() { if (this._map) this._map.removeLayer(this); },
});

export function createIDWLayer(data, property, options = {}) {
    return new IDWLeafletLayer(data, property, options);
}








// import L from 'leaflet';
// import { renderIDWToCanvas } from '../utils/idwRenderer';

// // ─── Global Cache ─────────────────────────────────────────────────────────────
// // Use a global cache that can be accessed across components
// const IDW_RENDER_CACHE = window.IDW_RENDER_CACHE || new Map();
// window.IDW_RENDER_CACHE = IDW_RENDER_CACHE;

// const IDW_CACHE_MAX = 60; // Increased to hold more months

// function cacheGet(key) {
//     if (!key) return null;
//     const entry = IDW_RENDER_CACHE.get(key);
//     if (!entry) return null;
//     // Move to front for LRU
//     IDW_RENDER_CACHE.delete(key);
//     IDW_RENDER_CACHE.set(key, entry);
//     return entry;
// }

// function cacheSet(key, entry) {
//     if (!key) return;
//     if (IDW_RENDER_CACHE.has(key)) {
//         IDW_RENDER_CACHE.delete(key);
//     } else if (IDW_RENDER_CACHE.size >= IDW_CACHE_MAX) {
//         // Remove oldest entry
//         const oldestKey = IDW_RENDER_CACHE.keys().next().value;
//         IDW_RENDER_CACHE.delete(oldestKey);
//     }
//     IDW_RENDER_CACHE.set(key, entry);
// }

// export function clearIDWRenderCache() {
//     IDW_RENDER_CACHE.clear();
//     window.IDW_RENDER_CACHE = IDW_RENDER_CACHE;
// }

// // ─── Constants ────────────────────────────────────────────────────────────────
// const IDW_RASTER_LONG_EDGE = 400;
// const IDW_BOUNDS_PADDING_RATIO = 0.08;

// // ─── Layer ────────────────────────────────────────────────────────────────────
// export const IDWLeafletLayer = L.Layer.extend({

//     initialize(data, property, options = {}) {
//         L.setOptions(this, options);
//         this._data = data || [];
//         this._property = property || 'precip_mm';
//         this._opacity = options.opacity ?? 0.7;
//         this._zIndex = options.zIndex ?? 1000;
//         this._clipPolygon = options.clipPolygon || null;
//         this._cacheKey = options.cacheKey || null;
//         this._propertyMap = options.propertyMap || {
//             temperature: 'avg_temp',
//             rainfall: 'rain_precip',
//             wind: 'wind'
//         };

//         // Persistent canvas — never removed/re-added
//         this._canvas = document.createElement('canvas');
//         this._canvas.style.cssText = `
//             position: absolute;
//             pointer-events: none;
//             opacity: ${this._opacity};
//             z-index: ${this._zIndex};
//             image-rendering: pixelated;
//             transition: opacity 200ms ease-out;
//         `;

//         this._isRendering = false;
//         this._pendingRender = false;
//         this._geoBounds = null;
//         this._currentCacheKey = null;
//     },

//     // ── Lifecycle ──────────────────────────────────────────────────────────────

//     onAdd(map) {
//         this._map = map;
//         // Insert canvas directly into Leaflet's overlay pane
//         map.getPanes().overlayPane.appendChild(this._canvas);

//         map.on('moveend zoom', this._repositionCanvas, this);
//         map.on('zoomanim', this._onZoomAnim, this);

//         this._render();
//     },

//     onRemove(map) {
//         map.off('moveend zoom', this._repositionCanvas, this);
//         map.off('zoomanim', this._onZoomAnim, this);

//         if (this._canvas.parentNode) {
//             this._canvas.parentNode.removeChild(this._canvas);
//         }
//         this._map = null;
//     },

//     // ── Public API ─────────────────────────────────────────────────────────────

//     updateData(data, property, cacheKey) {
//         this._data = data || [];
//         this._property = property || this._property;
//         if (cacheKey !== undefined) this._cacheKey = cacheKey;
//         if (this._map) {
//             // Small delay to let the UI breathe
//             setTimeout(() => this._render(), 10);
//         }
//     },

//     setOpacity(opacity) {
//         this._opacity = opacity;
//         this._canvas.style.opacity = opacity;
//     },

//     // ─── NEW: Pre-render all months into cache ────────────────────────────────
//     preRenderAllMonths: async function (allMonthlyData, property, layerPropertyMap) {
//         if (!allMonthlyData?.length) return;

//         const prop = layerPropertyMap?.[property] || property;

//         // Get unique months
//         const uniqueMonths = [...new Set(allMonthlyData.map(item =>
//             `${item.year}-${String(item.month).padStart(2, '0')}`
//         ))].sort();

//         console.log(`🔥 Pre-rendering ${uniqueMonths.length} months into cache...`);

//         for (const monthKey of uniqueMonths) {
//             const monthData = allMonthlyData.filter(item =>
//                 `${item.year}-${String(item.month).padStart(2, '0')}` === monthKey
//             );

//             const cacheKey = `${monthKey}::${prop}`;

//             // Skip if already cached
//             if (cacheGet(cacheKey)) {
//                 console.log(`⚡ Already cached: ${cacheKey}`);
//                 continue;
//             }

//             try {
//                 const geoBounds = this._computeRenderBoundsFromData(monthData);
//                 if (!geoBounds) continue;

//                 const { width, height } = this._computeResolution(geoBounds);

//                 // Render offscreen — user sees nothing, no blink possible
//                 const offscreen = await renderIDWToCanvas(monthData, prop, geoBounds, width, height);
//                 if (!offscreen) continue;

//                 let finalCanvas = offscreen;
//                 if (this._clipPolygon) {
//                     try {
//                         finalCanvas = await this._applyPolygonClip(offscreen, geoBounds);
//                     } catch { finalCanvas = offscreen; }
//                 }

//                 cacheSet(cacheKey, { canvas: finalCanvas, geoBounds });
//                 console.log(`✅ Pre-cached: ${cacheKey}`);

//             } catch (err) {
//                 console.warn(`Failed to pre-render ${cacheKey}:`, err);
//             }
//         }

//         console.log('🎉 All months pre-rendered — zero blink guaranteed');
//     },

//     // ─── NEW: Helper to compute bounds from a specific data array ────────────
//     _computeRenderBoundsFromData(data) {
//         if (this._clipPolygon) {
//             const rings = this._extractRings(this._clipPolygon);
//             if (rings.length > 0) {
//                 let minLat = Infinity, maxLat = -Infinity;
//                 let minLng = Infinity, maxLng = -Infinity;
//                 rings.forEach(ring => ring.forEach(([lng, lat]) => {
//                     if (typeof lat !== 'number' || typeof lng !== 'number') return;
//                     if (lat < minLat) minLat = lat;
//                     if (lat > maxLat) maxLat = lat;
//                     if (lng < minLng) minLng = lng;
//                     if (lng > maxLng) maxLng = lng;
//                 }));
//                 if (isFinite(minLat)) {
//                     const latPad = (maxLat - minLat) * IDW_BOUNDS_PADDING_RATIO || 0.01;
//                     const lngPad = (maxLng - minLng) * IDW_BOUNDS_PADDING_RATIO || 0.01;
//                     return {
//                         minLat: minLat - latPad, maxLat: maxLat + latPad,
//                         minLng: minLng - lngPad, maxLng: maxLng + lngPad,
//                     };
//                 }
//             }
//         }

//         if (!data?.length) return null;
//         let minLat = Infinity, maxLat = -Infinity;
//         let minLng = Infinity, maxLng = -Infinity;
//         data.forEach(d => {
//             const lat = parseFloat(d.latitude);
//             const lng = parseFloat(d.longitude);
//             if (isNaN(lat) || isNaN(lng)) return;
//             if (lat < minLat) minLat = lat;
//             if (lat > maxLat) maxLat = lat;
//             if (lng < minLng) minLng = lng;
//             if (lng > maxLng) maxLng = lng;
//         });
//         if (!isFinite(minLat)) return null;
//         const latPad = (maxLat - minLat) * IDW_BOUNDS_PADDING_RATIO || 0.05;
//         const lngPad = (maxLng - minLng) * IDW_BOUNDS_PADDING_RATIO || 0.05;
//         return {
//             minLat: minLat - latPad, maxLat: maxLat + latPad,
//             minLng: minLng - lngPad, maxLng: maxLng + lngPad,
//         };
//     },

//     // ── Rendering ──────────────────────────────────────────────────────────────

//     _render: async function () {
//         if (this._isRendering) {
//             this._pendingRender = true;
//             return;
//         }
//         if (!this._map || !this._data?.length) return;

//         this._isRendering = true;

//         try {
//             const cacheKey = this._deriveCacheKey();
//             this._currentCacheKey = cacheKey;

//             // ✅ Check global cache first
//             const cached = cacheGet(cacheKey);

//             if (cached) {
//                 // Cache hit — paint instantly, zero blink
//                 console.log(`⚡ IDW cache hit: ${cacheKey}`);
//                 this._paintCachedFrame(cached);
//                 return;
//             }

//             console.log(`🎨 Rendering IDW: ${cacheKey}`);
//             const geoBounds = this._computeRenderBounds();
//             if (!geoBounds) return;

//             const { width, height } = this._computeResolution(geoBounds);

//             // Render IDW into an offscreen canvas (async, chunked)
//             const offscreen = await renderIDWToCanvas(
//                 this._data, this._property, geoBounds, width, height
//             );
//             if (!this._map || !offscreen) return;

//             // Apply clip if needed
//             let finalCanvas = offscreen;
//             if (this._clipPolygon) {
//                 try {
//                     finalCanvas = await this._applyPolygonClip(offscreen, geoBounds);
//                 } catch {
//                     finalCanvas = offscreen;
//                 }
//             }

//             // ✅ Store in global cache
//             cacheSet(cacheKey, { canvas: finalCanvas, geoBounds });
//             console.log(`✅ IDW cached: ${cacheKey}`);

//             // Paint directly — one synchronous drawImage, no img loading gap
//             this._paintFrame(finalCanvas, geoBounds);

//         } catch (err) {
//             console.error('IDW render error:', err);
//         } finally {
//             this._isRendering = false;
//             if (this._pendingRender) {
//                 this._pendingRender = false;
//                 this._render();
//             }
//         }
//     },

//     /**
//      * KEY METHOD: paint a rendered canvas directly onto our persistent canvas.
//      * This is synchronous and atomic — no img tag, no load event, no blink.
//      */
//     _paintFrame(sourceCanvas, geoBounds) {
//         if (!this._map) return;

//         this._geoBounds = geoBounds;

//         const { width, height } = this._getCanvasPixelSize(geoBounds);

//         // Only resize if dimensions changed
//         if (this._canvas.width !== width || this._canvas.height !== height) {
//             this._canvas.width = width;
//             this._canvas.height = height;
//         }

//         const ctx = this._canvas.getContext('2d');
//         ctx.clearRect(0, 0, width, height);
//         ctx.drawImage(sourceCanvas, 0, 0, width, height);

//         this._repositionCanvas();
//     },

//     _paintCachedFrame({ canvas, geoBounds }) {
//         this._paintFrame(canvas, geoBounds);
//     },

//     // ── Canvas positioning ─────────────────────────────────────────────────────

//     /**
//      * Repositions the canvas on every map move/zoom so it stays aligned
//      * with the geographic bounds it was rendered for.
//      */
//     _repositionCanvas() {
//         if (!this._map || !this._geoBounds) return;

//         const { minLat, maxLat, minLng, maxLng } = this._geoBounds;

//         const topLeft = this._map.latLngToLayerPoint([maxLat, minLng]);
//         const bottomRight = this._map.latLngToLayerPoint([minLat, maxLng]);

//         const width = bottomRight.x - topLeft.x;
//         const height = bottomRight.y - topLeft.y;

//         // Move and scale the canvas to match current map viewport
//         this._canvas.style.left = `${topLeft.x}px`;
//         this._canvas.style.top = `${topLeft.y}px`;
//         this._canvas.style.width = `${width}px`;
//         this._canvas.style.height = `${height}px`;
//     },

//     _onZoomAnim(e) {
//         // Hide during zoom animation (same as Leaflet's own layers)
//         // Leaflet re-fires 'zoom' after animation ends, which calls _repositionCanvas
//     },

//     _getCanvasPixelSize(geoBounds) {
//         const { width, height } = this._computeResolution(geoBounds);
//         return { width, height };
//     },

//     // ── Bounds & resolution ────────────────────────────────────────────────────

//     _computeRenderBounds() {
//         const ringsToBBox = (rings) => {
//             let minLat = Infinity, maxLat = -Infinity;
//             let minLng = Infinity, maxLng = -Infinity;
//             rings.forEach(ring => ring.forEach(([lng, lat]) => {
//                 if (typeof lat !== 'number' || typeof lng !== 'number') return;
//                 if (lat < minLat) minLat = lat;
//                 if (lat > maxLat) maxLat = lat;
//                 if (lng < minLng) minLng = lng;
//                 if (lng > maxLng) maxLng = lng;
//             }));
//             return isFinite(minLat) ? { minLat, maxLat, minLng, maxLng } : null;
//         };

//         if (this._clipPolygon) {
//             const rings = this._extractRings(this._clipPolygon);
//             const bbox = rings.length > 0 ? ringsToBBox(rings) : null;
//             if (bbox) {
//                 const latPad = (bbox.maxLat - bbox.minLat) * IDW_BOUNDS_PADDING_RATIO || 0.01;
//                 const lngPad = (bbox.maxLng - bbox.minLng) * IDW_BOUNDS_PADDING_RATIO || 0.01;
//                 return {
//                     minLat: bbox.minLat - latPad,
//                     maxLat: bbox.maxLat + latPad,
//                     minLng: bbox.minLng - lngPad,
//                     maxLng: bbox.maxLng + lngPad,
//                 };
//             }
//         }

//         if (this._data?.length > 0) {
//             let minLat = Infinity, maxLat = -Infinity;
//             let minLng = Infinity, maxLng = -Infinity;
//             this._data.forEach(d => {
//                 const lat = parseFloat(d.latitude);
//                 const lng = parseFloat(d.longitude);
//                 if (isNaN(lat) || isNaN(lng)) return;
//                 if (lat < minLat) minLat = lat;
//                 if (lat > maxLat) maxLat = lat;
//                 if (lng < minLng) minLng = lng;
//                 if (lng > maxLng) maxLng = lng;
//             });
//             if (isFinite(minLat)) {
//                 const latPad = (maxLat - minLat) * IDW_BOUNDS_PADDING_RATIO || 0.05;
//                 const lngPad = (maxLng - minLng) * IDW_BOUNDS_PADDING_RATIO || 0.05;
//                 return {
//                     minLat: minLat - latPad, maxLat: maxLat + latPad,
//                     minLng: minLng - lngPad, maxLng: maxLng + lngPad,
//                 };
//             }
//         }

//         return null;
//     },

//     _computeResolution(geoBounds) {
//         const latRange = geoBounds.maxLat - geoBounds.minLat;
//         const lngRange = geoBounds.maxLng - geoBounds.minLng;
//         const avgLatRad = ((geoBounds.minLat + geoBounds.maxLat) / 2) * (Math.PI / 180);
//         const adjustedLng = lngRange * Math.cos(avgLatRad);
//         const aspect = adjustedLng > 0 ? latRange / adjustedLng : 1;

//         let width, height;
//         if (aspect >= 1) {
//             height = IDW_RASTER_LONG_EDGE;
//             width = Math.max(64, Math.round(IDW_RASTER_LONG_EDGE / aspect));
//         } else {
//             width = IDW_RASTER_LONG_EDGE;
//             height = Math.max(64, Math.round(IDW_RASTER_LONG_EDGE * aspect));
//         }
//         return { width, height };
//     },

//     _deriveCacheKey() {
//         if (this._cacheKey) return this._cacheKey;
//         const n = this._data.length;
//         const sample = this._data.slice(0, 5)
//             .map(d => `${d.latitude},${d.longitude},${d[this._property]}`)
//             .join('|');
//         return `auto::${this._property}::${n}::${sample}`;
//     },

//     // ── Clipping (unchanged from your original) ────────────────────────────────

//     _applyPolygonClip(canvas, boundsObj) {
//         return new Promise((resolve) => {
//             try {
//                 const { width, height } = canvas;
//                 if (width <= 0 || height <= 0) {
//                     resolve(canvas); return;
//                 }

//                 const polygonRings = this._getPolygonPixelRings(boundsObj, width, height);
//                 if (!polygonRings?.length) {
//                     resolve(canvas); return;
//                 }

//                 const clipped = document.createElement('canvas');
//                 clipped.width = width;
//                 clipped.height = height;
//                 const ctx = clipped.getContext('2d');

//                 ctx.drawImage(canvas, 0, 0);
//                 ctx.save();
//                 ctx.beginPath();

//                 polygonRings.forEach(ring => {
//                     ring.forEach(([x, y], i) => {
//                         if (i === 0) ctx.moveTo(x, y);
//                         else ctx.lineTo(x, y);
//                     });
//                     ctx.closePath();
//                 });

//                 ctx.globalCompositeOperation = 'destination-in';
//                 ctx.fill();
//                 ctx.restore();

//                 resolve(clipped);
//             } catch (e) {
//                 console.warn('Clip error:', e);
//                 resolve(canvas);
//             }
//         });
//     },

//     _lngLatToPixel([lng, lat], boundsObj, w, h) {
//         const { minLat, maxLat, minLng, maxLng } = boundsObj;
//         if (typeof lat !== 'number' || typeof lng !== 'number') return null;
//         return [
//             ((lng - minLng) / (maxLng - minLng)) * w,
//             ((maxLat - lat) / (maxLat - minLat)) * h,
//         ];
//     },

//     _getPolygonPixelRings(boundsObj, w, h) {
//         try {
//             const rings = this._extractRings(this._clipPolygon);
//             if (!rings?.length) return null;

//             const pixelRings = rings
//                 .map(ring => ring
//                     .map(coord => Array.isArray(coord) && coord.length >= 2
//                         ? this._lngLatToPixel(coord, boundsObj, w, h)
//                         : null)
//                     .filter(Boolean))
//                 .filter(ring => ring.length >= 3);

//             return pixelRings.length > 0 ? pixelRings : null;
//         } catch (e) {
//             console.warn('Ring pixel error:', e);
//             return null;
//         }
//     },

//     _extractRings(input) {
//         if (!input) return [];
//         try {
//             if (input.type === 'FeatureCollection')
//                 return (input.features || []).flatMap(f => this._extractRings(f.geometry));
//             if (input.type === 'Feature')
//                 return this._extractRings(input.geometry);
//             if (input.type === 'GeometryCollection')
//                 return (input.geometries || []).flatMap(g => this._extractRings(g));
//             if (input.type === 'Polygon')
//                 return input.coordinates?.[0] ? [input.coordinates[0]] : [];
//             if (input.type === 'MultiPolygon')
//                 return (input.coordinates || []).map(p => p?.[0]).filter(Boolean);
//             if (Array.isArray(input)) return [input];
//         } catch (e) {
//             console.warn('Extract rings error:', e);
//         }
//         return [];
//     },

//     // ── Public shims ──────────────────────────────────────────────────────────
//     isVisible() { return !!this._map && !!this._geoBounds; },
//     getData() { return this._data; },
//     getProperty() { return this._property; },
//     remove() { if (this._map) this._map.removeLayer(this); },
// });

// export function createIDWLayer(data, property, options = {}) {
//     return new IDWLeafletLayer(data, property, options);
// }