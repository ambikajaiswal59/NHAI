// src/components/IDWLeafletLayer.js
import L from 'leaflet';
import { renderIDWToCanvas } from '../utils/idwRenderer';

/**
 * Custom Leaflet layer for IDW rendering using OpenLayers
 * Extends L.Layer to integrate with Leaflet's layer system
 */
export const IDWLeafletLayer = L.Layer.extend({
    initialize: function (data, property, options = {}) {
        L.setOptions(this, options);
        this._data = data || [];
        this._property = property || 'precip_mm';
        this._opacity = options.opacity || 0.7;
        this._zIndex = options.zIndex || 1000;
        this._imageOverlay = null;
        this._isRendering = false;
        this._renderTimeout = null;
    },

    onAdd: function (map) {
        this._map = map;

        // Listen to map events to re-render
        map.on('moveend', this._scheduleRender, this);
        map.on('zoomend', this._scheduleRender, this);
        map.on('resize', this._scheduleRender, this);

        // Initial render
        this._scheduleRender();
    },

    onRemove: function (map) {
        // Remove image overlay if exists
        if (this._imageOverlay) {
            map.removeLayer(this._imageOverlay);
            this._imageOverlay = null;
        }

        // Remove event listeners
        map.off('moveend', this._scheduleRender, this);
        map.off('zoomend', this._scheduleRender, this);
        map.off('resize', this._scheduleRender, this);

        // Clear timeout
        if (this._renderTimeout) {
            clearTimeout(this._renderTimeout);
            this._renderTimeout = null;
        }
    },

    _scheduleRender: function () {
        // Debounce render calls
        if (this._renderTimeout) {
            clearTimeout(this._renderTimeout);
        }
        this._renderTimeout = setTimeout(() => {
            this._render();
        }, 300);
    },

    _render: async function () {
        if (!this._map || this._isRendering) return;
        if (!this._data || this._data.length === 0) return;

        this._isRendering = true;

        try {
            // Get map bounds and size
            const bounds = this._map.getBounds();
            const size = this._map.getSize();

            // Prepare bounds object
            const boundsObj = {
                minLat: bounds.getSouthWest().lat,
                maxLat: bounds.getNorthEast().lat,
                minLng: bounds.getSouthWest().lng,
                maxLng: bounds.getNorthEast().lng,
            };

            // Render IDW to canvas using OpenLayers
            const canvas = await renderIDWToCanvas(
                this._data,
                this._property,
                boundsObj,
                size.x,
                size.y
            );

            if (!canvas) {
                this._isRendering = false;
                return;
            }

            // Convert canvas to data URL
            const dataUrl = canvas.toDataURL('image/png');

            // Create image bounds for Leaflet
            const imageBounds = [
                [boundsObj.minLat, boundsObj.minLng],
                [boundsObj.maxLat, boundsObj.maxLng]
            ];

            // Remove existing image overlay
            if (this._imageOverlay) {
                this._map.removeLayer(this._imageOverlay);
                this._imageOverlay = null;
            }

            // Create new image overlay
            this._imageOverlay = L.imageOverlay(dataUrl, imageBounds, {
                opacity: this._opacity,
                zIndex: this._zIndex,
                interactive: false,
                className: 'idw-leaflet-overlay',
            });

            // Add to map
            this._imageOverlay.addTo(this._map);

        } catch (error) {
            console.error('Error rendering IDW layer:', error);
        } finally {
            this._isRendering = false;
        }
    },

    // Public method to update data
    setData: function (data, property) {
        this._data = data || [];
        this._property = property || this._property;

        // Re-render if map exists
        if (this._map) {
            this._scheduleRender();
        }
    },

    // Public method to update opacity
    setOpacity: function (opacity) {
        this._opacity = opacity;
        if (this._imageOverlay) {
            this._imageOverlay.setOpacity(opacity);
        }
    },

    // Public method to get current data
    getData: function () {
        return this._data;
    },

    // Public method to get current property
    getProperty: function () {
        return this._property;
    },

    // Public method to check if layer is visible
    isVisible: function () {
        return this._imageOverlay !== null && this._map !== null;
    },

    // Public method to remove layer
    remove: function () {
        if (this._map) {
            this._map.removeLayer(this);
        }
    }
});

/**
 * Helper function to create IDW layer
 * @param {Array} data - Weather data points
 * @param {string} property - Property to interpolate
 * @param {Object} options - Layer options
 * @returns {IDWLeafletLayer} IDW layer instance
 */
export function createIDWLayer(data, property, options = {}) {
    return new IDWLeafletLayer(data, property, options);
}