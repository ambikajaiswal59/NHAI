import L from 'leaflet';
import { renderIDWToCanvas } from '../utils/idwRenderer';

const IDW_RENDER_CACHE = new Map(); // key -> { dataUrl, imageBounds, createdAt }
const IDW_CACHE_MAX_ENTRIES = 20;

function idwCacheGet(key) {
    if (!key) return null;
    const entry = IDW_RENDER_CACHE.get(key);
    if (!entry) return null;

    IDW_RENDER_CACHE.delete(key);
    IDW_RENDER_CACHE.set(key, entry);
    return entry;
}

function idwCacheSet(key, entry) {
    if (!key) return;
    if (IDW_RENDER_CACHE.has(key)) {
        IDW_RENDER_CACHE.delete(key);
    } else if (IDW_RENDER_CACHE.size >= IDW_CACHE_MAX_ENTRIES) {
        const oldestKey = IDW_RENDER_CACHE.keys().next().value;
        IDW_RENDER_CACHE.delete(oldestKey);
    }
    IDW_RENDER_CACHE.set(key, entry);
}

export function clearIDWRenderCache() {
    IDW_RENDER_CACHE.clear();
}

const IDW_RASTER_LONG_EDGE = 900;
const IDW_BOUNDS_PADDING_RATIO = 0.08;
const DEFAULT_TRANSITION_MS = 350;

export const IDWLeafletLayer = L.Layer.extend({
    initialize: function (data, property, options = {}) {
        L.setOptions(this, options);
        this._data = data || [];
        this._property = property || 'precip_mm';
        this._opacity = options.opacity || 0.7;
        this._zIndex = options.zIndex || 1000;
        this._clipPolygon = options.clipPolygon || null;
        this._transitionMs = options.transitionMs ?? DEFAULT_TRANSITION_MS;

        this._cacheKey = options.cacheKey || null;
        this._imageOverlay = null;
        this._isRendering = false;
        this._pendingRerender = false;
        this._initTimeout = null;
        this._pendingCleanupTimeout = null;
    },

    onAdd: function (map) {
        this._map = map;

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

        if (this._pendingCleanupTimeout) {
            clearTimeout(this._pendingCleanupTimeout);
            this._pendingCleanupTimeout = null;
        }

        this._map = null;
    },

    /**
     * CRITICAL: Update the layer with new data WITHOUT removing/re-adding
     * This is the key method for smooth month transitions
     */
    updateData: function (data, property, cacheKey) {
        this._data = data || [];
        this._property = property || this._property;
        if (cacheKey !== undefined) this._cacheKey = cacheKey;

        // If the layer is on the map, re-render in place
        if (this._map) {
            // Cancel any pending render
            if (this._initTimeout) {
                clearTimeout(this._initTimeout);
                this._initTimeout = null;
            }
            this._render();
        }
    },

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

    _computeResolution: function (geoBounds) {
        const latRange = geoBounds.maxLat - geoBounds.minLat;
        const lngRange = geoBounds.maxLng - geoBounds.minLng;
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

    _deriveCacheKey: function () {
        if (this._cacheKey) return this._cacheKey;
        const n = this._data.length;
        const sample = this._data
            .slice(0, Math.min(n, 5))
            .map((d) => `${d.latitude},${d.longitude},${d[this._property]}`)
            .join('|');
        return `auto::${this._property}::${n}::${sample}`;
    },

    _render: async function () {
        if (this._isRendering) {
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

            if (!this._map) return;
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

    /**
     * Swap in a new image overlay with crossfade
     * This prevents the blank frame jerk on month changes
     */
    _applyOverlay: function (dataUrl, imageBounds) {
        if (!this._map) return;

        const prevOverlay = this._imageOverlay;

        const newOverlay = L.imageOverlay(dataUrl, imageBounds, {
            opacity: prevOverlay ? 0 : this._opacity,
            zIndex: this._zIndex,
            interactive: false,
            className: 'idw-leaflet-overlay',
        });

        newOverlay.addTo(this._map);
        this._imageOverlay = newOverlay;

        if (this._pendingCleanupTimeout) {
            clearTimeout(this._pendingCleanupTimeout);
            this._pendingCleanupTimeout = null;
        }

        if (!prevOverlay) return;

        const imgEl = newOverlay.getElement();
        if (imgEl) {
            imgEl.style.transition = `opacity ${this._transitionMs}ms ease-out`;
            void imgEl.offsetHeight;
        }

        requestAnimationFrame(() => {
            newOverlay.setOpacity(this._opacity);
        });

        this._pendingCleanupTimeout = setTimeout(() => {
            this._pendingCleanupTimeout = null;
            if (this._map && prevOverlay !== this._imageOverlay) {
                this._map.removeLayer(prevOverlay);
            }
        }, this._transitionMs + 50);
    },

    _applyPolygonClip: function (canvas, boundsObj) {
        return new Promise((resolve) => {
            try {
                const width = canvas.width;
                const height = canvas.height;

                if (width <= 0 || height <= 0) {
                    resolve(canvas.toDataURL('image/png'));
                    return;
                }

                const polygonRings = this._getPolygonPixelRings(boundsObj, width, height);

                if (!polygonRings || polygonRings.length === 0) {
                    resolve(canvas.toDataURL('image/png'));
                    return;
                }

                const clippedCanvas = document.createElement('canvas');
                clippedCanvas.width = width;
                clippedCanvas.height = height;
                const ctx = clippedCanvas.getContext('2d');

                ctx.drawImage(canvas, 0, 0);

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

    _lngLatToPixel: function ([lng, lat], boundsObj, canvasWidth, canvasHeight) {
        const { minLat, maxLat, minLng, maxLng } = boundsObj;

        if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
            return null;
        }

        const x = ((lng - minLng) / (maxLng - minLng)) * canvasWidth;
        const y = ((maxLat - lat) / (maxLat - minLat)) * canvasHeight;

        return [x, y];
    },

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

    _extractRings: function (input) {
        if (!input) return [];

        try {
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
                return input.coordinates?.[0] ? [input.coordinates[0]] : [];
            }

            if (input.type === 'MultiPolygon') {
                return (input.coordinates || [])
                    .map((polygon) => polygon?.[0])
                    .filter(Boolean);
            }

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

export function createIDWLayer(data, property, options = {}) {
    return new IDWLeafletLayer(data, property, options);
}