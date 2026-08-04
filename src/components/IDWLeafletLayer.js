// src/components/IDWLeafletLayer.js
import L from 'leaflet';
import { renderIDWToCanvas } from '../utils/idwRenderer';

// ---------------------------------------------------------------------------
// In-memory IDW render cache, shared across every IDWLeafletLayer instance.
//
// The raster is now computed once over a FIXED geographic extent (the clip
// polygon's own bounds) rather than the current viewport, so panning/zooming
// never needs to touch this cache — Leaflet just reprojects the existing
// image. This cache exists for switching BETWEEN layers/dates: e.g. going
// rainfall -> wind -> rainfall, or Aug 3 -> Aug 4 -> Aug 3, reuses the
// already-computed image instead of recomputing the IDW raster from scratch.
// ---------------------------------------------------------------------------
const IDW_RENDER_CACHE = new Map(); // key -> { dataUrl, imageBounds, createdAt }
const IDW_CACHE_MAX_ENTRIES = 20;

function idwCacheGet(key) {
    if (!key) return null;
    const entry = IDW_RENDER_CACHE.get(key);
    if (!entry) return null;
    // Refresh recency (Map preserves insertion order, so delete+set moves
    // this key to the "most recently used" end for the eviction below).
    IDW_RENDER_CACHE.delete(key);
    IDW_RENDER_CACHE.set(key, entry);
    return entry;
}

function idwCacheSet(key, entry) {
    if (!key) return;
    if (IDW_RENDER_CACHE.has(key)) {
        IDW_RENDER_CACHE.delete(key);
    } else if (IDW_RENDER_CACHE.size >= IDW_CACHE_MAX_ENTRIES) {
        // Evict the least-recently-used entry (first key in the Map)
        const oldestKey = IDW_RENDER_CACHE.keys().next().value;
        IDW_RENDER_CACHE.delete(oldestKey);
    }
    IDW_RENDER_CACHE.set(key, entry);
}

/** Clear the whole IDW render cache — e.g. call after a manual data refresh
 * if you want to force every cached layer/date to be recomputed. */
export function clearIDWRenderCache() {
    IDW_RENDER_CACHE.clear();
}

// Fixed raster resolution for the long edge of the rendered extent. This is
// independent of screen/viewport size — the image is computed once and
// Leaflet scales it visually for whatever zoom level you're at, same as any
// other image overlay (a satellite tile doesn't get re-rendered when you
// zoom either).
const IDW_RASTER_LONG_EDGE = 900;
// Padding added around the clip polygon's bounding box so the raster fully
// covers the polygon edge (avoids thin unclipped/blank slivers from
// floating point rounding right at the boundary).
const IDW_BOUNDS_PADDING_RATIO = 0.08;

/**
 * Custom Leaflet layer for IDW rendering with polygon clipping.
 *
 * Renders once per (data, property, clipPolygon) combination, over that
 * polygon's own fixed geographic extent — NOT the current map viewport.
 * Panning and zooming never trigger a re-render; Leaflet's normal image
 * overlay reprojection handles that for free.
 */
export const IDWLeafletLayer = L.Layer.extend({
    initialize: function (data, property, options = {}) {
        L.setOptions(this, options);
        this._data = data || [];
        this._property = property || 'precip_mm';
        this._opacity = options.opacity || 0.7;
        this._zIndex = options.zIndex || 1000;
        this._clipPolygon = options.clipPolygon || null;
        // Optional explicit cache key, e.g. `${date}::${property}`. If not
        // given, one is derived automatically from the data + property so
        // caching still works without the caller wiring anything up.
        this._cacheKey = options.cacheKey || null;
        this._imageOverlay = null;
        this._isRendering = false;
        this._pendingRerender = false; // true if setData/setClipPolygon arrived mid-render
        this._initTimeout = null;
    },

    onAdd: function (map) {
        this._map = map;

        // No moveend/zoomend/resize listeners on purpose — the rendered
        // image is anchored to fixed lat/lng bounds, so Leaflet repositions
        // and rescales it automatically as the map is panned or zoomed,
        // exactly like it does for any other image overlay or tile layer.
        // Re-rendering the IDW raster itself is only ever needed when the
        // underlying data, property, or clip polygon actually changes.

        this._initTimeout = setTimeout(() => {
            this._initTimeout = null;
            this._render();
        }, 0);
    },

    onRemove: function (map) {
        if (this._imageOverlay) {
            map.removeLayer(this._imageOverlay);
            this._imageOverlay = null;
        }

        if (this._initTimeout) {
            clearTimeout(this._initTimeout);
            this._initTimeout = null;
        }

        this._map = null;
    },

    /**
     * Figure out the fixed geographic extent to render over: the clip
     * polygon's own bounding box (padded a little), falling back to the
     * bounding box of the data points, and finally the current map view
     * only if neither is available.
     */
    _computeRenderBounds: function () {
        const ringsToBBox = (rings) => {
            let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
            rings.forEach((ring) => {
                ring.forEach(([lng, lat]) => {
                    if (typeof lat !== 'number' || typeof lng !== 'number') return;
                    if (lat < minLat) minLat = lat;
                    if (lat > maxLat) maxLat = lat;
                    if (lng < minLng) minLng = lng;
                    if (lng > maxLng) maxLng = lng;
                });
            });
            if (!isFinite(minLat) || !isFinite(maxLat) || !isFinite(minLng) || !isFinite(maxLng)) {
                return null;
            }
            return { minLat, maxLat, minLng, maxLng };
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

        if (this._data && this._data.length > 0) {
            let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
            this._data.forEach((d) => {
                const lat = parseFloat(d.latitude);
                const lng = parseFloat(d.longitude);
                if (isNaN(lat) || isNaN(lng)) return;
                if (lat < minLat) minLat = lat;
                if (lat > maxLat) maxLat = lat;
                if (lng < minLng) minLng = lng;
                if (lng > maxLng) maxLng = lng;
            });
            if (isFinite(minLat) && isFinite(maxLat) && isFinite(minLng) && isFinite(maxLng)) {
                const latPad = (maxLat - minLat) * IDW_BOUNDS_PADDING_RATIO || 0.05;
                const lngPad = (maxLng - minLng) * IDW_BOUNDS_PADDING_RATIO || 0.05;
                return { minLat: minLat - latPad, maxLat: maxLat + latPad, minLng: minLng - lngPad, maxLng: maxLng + lngPad };
            }
        }

        // Last resort: current viewport (old behavior)
        if (this._map) {
            try {
                const b = this._map.getBounds();
                if (b && b.isValid()) {
                    return {
                        minLat: b.getSouthWest().lat,
                        maxLat: b.getNorthEast().lat,
                        minLng: b.getSouthWest().lng,
                        maxLng: b.getNorthEast().lng,
                    };
                }
            } catch (e) { /* map not ready */ }
        }

        return null;
    },

    /** Pixel resolution for the raster, aspect-matched to the render bounds. */
    _computeResolution: function (geoBounds) {
        const latRange = geoBounds.maxLat - geoBounds.minLat;
        const lngRange = geoBounds.maxLng - geoBounds.minLng;
        // Rough correction so pixels aren't badly stretched at this
        // latitude (longitude degrees are "shorter" than latitude degrees).
        const avgLatRad = ((geoBounds.minLat + geoBounds.maxLat) / 2) * (Math.PI / 180);
        const adjustedLngRange = lngRange * Math.cos(avgLatRad);
        const aspect = adjustedLngRange > 0 ? (latRange / adjustedLngRange) : 1;

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

    /** Derive a stable cache key when the caller didn't pass one explicitly. */
    _deriveCacheKey: function () {
        if (this._cacheKey) return this._cacheKey;
        // Cheap signature: property + point count + a sample of values.
        // Good enough to distinguish "different dataset" from "same
        // dataset re-rendered" without hashing the whole payload.
        const n = this._data.length;
        const sample = this._data
            .slice(0, Math.min(n, 5))
            .map((d) => `${d.latitude},${d.longitude},${d[this._property]}`)
            .join('|');
        return `auto::${this._property}::${n}::${sample}`;
    },

    _render: async function () {
        if (this._isRendering) {
            // A newer render was requested while one was already running —
            // remember to run again once this one finishes.
            this._pendingRerender = true;
            return;
        }
        if (!this._map) return;

        if (!this._data || this._data.length === 0) {
            console.warn('No weather data available for IDW rendering');
            return;
        }

        this._isRendering = true;

        try {
            const cacheKey = this._deriveCacheKey();
            const cached = idwCacheGet(cacheKey);
            if (cached) {
                console.log(`⚡ IDW cache hit for ${this._property} — skipping recompute`);
                this._applyOverlay(cached.dataUrl, cached.imageBounds);
                return;
            }

            const geoBounds = this._computeRenderBounds();
            if (!geoBounds || geoBounds.minLat === geoBounds.maxLat || geoBounds.minLng === geoBounds.maxLng) {
                console.warn('IDW layer: could not determine a valid render extent');
                return;
            }

            const { width, height } = this._computeResolution(geoBounds);

            console.log(`🎨 Rendering IDW (once, fixed extent): ${width}x${height}, ${this._data.length} stations`);

            const canvas = await renderIDWToCanvas(this._data, this._property, geoBounds, width, height);

            if (!this._map) return; // removed while awaiting
            if (!canvas) {
                console.warn('Failed to render IDW canvas');
                return;
            }

            let dataUrl = canvas.toDataURL('image/png');

            if (this._clipPolygon) {
                try {
                    dataUrl = await this._applyPolygonClip(canvas, geoBounds);
                } catch (clipError) {
                    console.warn('Failed to apply polygon clip, using unclipped version');
                }
            }

            if (!this._map) return;

            const imageBounds = [
                [geoBounds.minLat, geoBounds.minLng],
                [geoBounds.maxLat, geoBounds.maxLng],
            ];

            idwCacheSet(cacheKey, { dataUrl, imageBounds, createdAt: Date.now() });
            this._applyOverlay(dataUrl, imageBounds);
            console.log('✅ IDW layer rendered and cached');

        } catch (error) {
            console.error('Error rendering IDW layer:', error);
        } finally {
            this._isRendering = false;
            if (this._pendingRerender) {
                this._pendingRerender = false;
                this._render();
            }
        }
    },

    /** Swap in a new image overlay at the given fixed geographic bounds. */
    _applyOverlay: function (dataUrl, imageBounds) {
        if (!this._map) return;

        if (this._imageOverlay) {
            this._map.removeLayer(this._imageOverlay);
            this._imageOverlay = null;
        }

        this._imageOverlay = L.imageOverlay(dataUrl, imageBounds, {
            opacity: this._opacity,
            zIndex: this._zIndex,
            interactive: false,
            className: 'idw-leaflet-overlay',
        });

        this._imageOverlay.addTo(this._map);
    },

    /**
     * Apply polygon clipping to the canvas
     */
    _applyPolygonClip: function (canvas, boundsObj) {
        return new Promise((resolve) => {
            try {
                const width = canvas.width;
                const height = canvas.height;

                if (width <= 0 || height <= 0) {
                    resolve(canvas.toDataURL('image/png'));
                    return;
                }

                // Get ALL polygon rings (every part of a MultiPolygon, every
                // feature in a FeatureCollection) as pixel coordinates.
                const polygonRings = this._getPolygonPixelRings(boundsObj, width, height);

                if (!polygonRings || polygonRings.length === 0) {
                    resolve(canvas.toDataURL('image/png'));
                    return;
                }

                // Create a temporary canvas for clipping
                const clippedCanvas = document.createElement('canvas');
                clippedCanvas.width = width;
                clippedCanvas.height = height;
                const ctx = clippedCanvas.getContext('2d');

                // Draw the original IDW image
                ctx.drawImage(canvas, 0, 0);

                // Build ONE path made of all rings (one subpath per ring) so
                // every disjoint polygon in the buffer clips its own area —
                // previously only the first ring of the first polygon was
                // used, silently dropping every other part of the buffer.
                ctx.save();
                ctx.beginPath();

                polygonRings.forEach((ring) => {
                    ring.forEach(([x, y], index) => {
                        if (index === 0) {
                            ctx.moveTo(x, y);
                        } else {
                            ctx.lineTo(x, y);
                        }
                    });
                    ctx.closePath();
                });

                // Clip using destination-in (nonzero winding unions all rings)
                ctx.globalCompositeOperation = 'destination-in';
                ctx.fill();
                ctx.restore();

                resolve(clippedCanvas.toDataURL('image/png'));
            } catch (error) {
                console.warn('Error in polygon clipping:', error);
                resolve(canvas.toDataURL('image/png'));
            }
        });
    },

    /**
     * Convert a single [lng, lat] pair to a pixel coordinate within the
     * current canvas/viewport bounds. GeoJSON coordinates are always
     * [lng, lat] — no need to guess the order.
     */
    _lngLatToPixel: function ([lng, lat], boundsObj, canvasWidth, canvasHeight) {
        const { minLat, maxLat, minLng, maxLng } = boundsObj;

        if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
            return null;
        }

        const x = ((lng - minLng) / (maxLng - minLng)) * canvasWidth;
        const y = ((maxLat - lat) / (maxLat - minLat)) * canvasHeight;

        // NOTE: intentionally NOT clamped to [0, width]/[0, height] here.
        // Clamping every ring point to the canvas edge turns a polygon that
        // partially leaves the viewport into a shape that hugs the canvas
        // border, which can balloon the clip area out to the edges instead
        // of just clipping off-screen. Points are allowed to fall outside
        // the canvas; the fill still clips correctly.
        return [x, y];
    },

    /**
     * Convert every ring of the clip polygon(s) to pixel coordinates.
     * Returns an array of rings, where each ring is an array of [x, y]
     * pixel points — e.g. for a MultiPolygon with 2 parts you get back
     * [ring0, ring1], not just ring0.
     */
    _getPolygonPixelRings: function (boundsObj, canvasWidth, canvasHeight) {
        try {
            const lngLatRings = this._extractRings(this._clipPolygon);

            if (!lngLatRings || lngLatRings.length === 0) {
                return null;
            }

            const pixelRings = lngLatRings
                .map((ring) =>
                    ring
                        .map((coord) => {
                            if (!Array.isArray(coord) || coord.length < 2) return null;
                            return this._lngLatToPixel(coord, boundsObj, canvasWidth, canvasHeight);
                        })
                        .filter((pt) => pt !== null)
                )
                .filter((ring) => ring.length >= 3);

            return pixelRings.length > 0 ? pixelRings : null;
        } catch (error) {
            console.warn('Error converting polygon coordinates:', error);
            return null;
        }
    },

    /**
     * Extract every outer ring from the clip source, whatever shape it's
     * in: a single Polygon, a MultiPolygon with any number of parts, a
     * Feature/FeatureCollection wrapping either, or a GeometryCollection.
     * Returns an array of rings (array of [lng, lat] arrays).
     */
    _extractRings: function (input) {
        if (!input) return [];

        try {
            // FeatureCollection — gather rings from every feature, not just the first
            if (input.type === 'FeatureCollection') {
                return (input.features || []).flatMap((feature) =>
                    this._extractRings(feature.geometry)
                );
            }

            if (input.type === 'Feature') {
                return this._extractRings(input.geometry);
            }

            if (input.type === 'GeometryCollection') {
                return (input.geometries || []).flatMap((geom) => this._extractRings(geom));
            }

            if (input.type === 'Polygon') {
                // [0] = outer ring only; holes (index > 0) are ignored on
                // purpose since a buffer polygon normally has none, and
                // subtracting holes would need an even-odd fill rule instead.
                return input.coordinates?.[0] ? [input.coordinates[0]] : [];
            }

            if (input.type === 'MultiPolygon') {
                // Outer ring of EVERY polygon part, not just the first.
                return (input.coordinates || [])
                    .map((polygon) => polygon?.[0])
                    .filter(Boolean);
            }

            // Already a plain ring / array of [lng, lat] pairs
            if (Array.isArray(input)) {
                return [input];
            }
        } catch (error) {
            console.warn('Error extracting coordinates:', error);
        }

        return [];
    },

    // Public methods
    setData: function (data, property, cacheKey) {
        this._data = data || [];
        this._property = property || this._property;
        if (cacheKey !== undefined) this._cacheKey = cacheKey;
        if (this._map) {
            this._render();
        }
    },

    setClipPolygon: function (polygon) {
        this._clipPolygon = polygon;
        if (this._map) {
            this._render();
        }
    },

    /** Explicitly set/replace the cache key (e.g. `${date}::${property}`). */
    setCacheKey: function (cacheKey) {
        this._cacheKey = cacheKey || null;
    },

    setOpacity: function (opacity) {
        this._opacity = opacity;
        if (this._imageOverlay) {
            this._imageOverlay.setOpacity(opacity);
        }
    },

    getData: function () {
        return this._data;
    },

    getProperty: function () {
        return this._property;
    },

    isVisible: function () {
        return this._imageOverlay !== null && this._map !== null;
    },

    remove: function () {
        if (this._map) {
            this._map.removeLayer(this);
        }
    }
});

/**
 * Helper function to create IDW layer
 */
export function createIDWLayer(data, property, options = {}) {
    return new IDWLeafletLayer(data, property, options);
}



