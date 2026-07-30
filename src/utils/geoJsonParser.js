
import proj4 from 'proj4';

const GEOJSON_PATH = '/data/Flyover_Roads.geojson';

// Source projection used in the exported shapefile
const UTM43N = '+proj=utm +zone=43 +datum=WGS84 +units=m +no_defs';
const WGS84 = 'EPSG:4326';

// Map Type to highway names
const highwayMap = {
    'F1': 'NH 150',
    'F2': 'NH 152',
    'F3': 'NH 155',
    'F4': 'NH 162'
};

// Map Type to risk status (you can make this dynamic later)
const riskStatusMap = {
    'F1': 'low',
    'F2': 'moderate',
    'F3': 'high',
    'F4': 'low'
};


const toWgs84 = ([x, y]) => proj4(UTM43N, WGS84, [x, y]);

// Recursively walk a GeoJSON coordinates array (any nesting depth:
// Polygon, MultiPolygon, etc.) and convert every leaf [x, y] point
const convertCoords = (coords) => {
    if (typeof coords[0] === 'number') {
        return toWgs84(coords);
    }
    return coords.map(convertCoords);
};

// Returns a new feature with its geometry reprojected to WGS84
const convertFeature = (feature) => ({
    ...feature,
    geometry: {
        ...feature.geometry,
        coordinates: convertCoords(feature.geometry.coordinates),
    },
});

/**
 * Generates alternating statuses along a simplified path (placeholder —
 * swap for real sensor/risk data later)
 */
const generatePointsAlongPath = (path) => {
    const statuses = ['normal', 'normal', 'alert', 'normal', 'critical', 'normal', 'alert', 'normal'];
    return path.map(([lat, lng], index) => ({
        lat,
        lng,
        status: statuses[index % statuses.length]
    }));
};

/**
 * Main function to load and parse GeoJSON
 */
export const loadFlyoverData = async () => {
    try {
        const response = await fetch(GEOJSON_PATH);
        if (!response.ok) {
            throw new Error(`Failed to fetch GeoJSON: ${response.status}`);
        }
        const geojson = await response.json();

        // Reproject every feature to WGS84 up front, once
        const convertedFeatures = geojson.features.map(convertFeature);

        // Group features by Type
        const grouped = {};
        convertedFeatures.forEach(feature => {
            const type = feature.properties.Type;
            if (!grouped[type]) {
                grouped[type] = [];
            }
            grouped[type].push(feature);
        });

        // Convert each group to flyover format
        const flyovers = Object.keys(grouped).map((type, index) => {
            const features = grouped[type];

            // Real GeoJSON layer for this highway — this is what gets
            // drawn on the map as the actual flyover footprint
            const featureCollection = {
                type: 'FeatureCollection',
                features
            };

            // Collect all coordinates from all features in this group
            // (used only to derive a center / simplified path for the card)
            const allCoordinates = [];
            features.forEach(feature => {
                try {
                    const coords = feature.geometry.coordinates[0][0];
                    allCoordinates.push(...coords);
                } catch (e) {
                    console.warn('Error processing feature:', e);
                }
            });

            if (allCoordinates.length === 0) {
                return null;
            }

            // Calculate center
            let latSum = 0, lngSum = 0;
            allCoordinates.forEach(([lng, lat]) => {
                latSum += lat;
                lngSum += lng;
            });
            const center = [latSum / allCoordinates.length, lngSum / allCoordinates.length];

            // Create simplified path (still used for FitBounds / fallback)
            const step = Math.max(1, Math.floor(allCoordinates.length / 15));
            const path = allCoordinates
                .filter((_, i) => i % step === 0)
                .map(([lng, lat]) => [lat, lng]);

            const points = generatePointsAlongPath(path);

            return {
                id: index + 1,
                highway: highwayMap[type] || `Highway ${type}`,
                riskStatus: riskStatusMap[type] || 'low',
                center,
                path,
                points,
                geojson: featureCollection, // NEW: actual polygon layer, in WGS84
                type
            };
        }).filter(f => f !== null);

        return flyovers;
    } catch (error) {
        console.error('Error loading GeoJSON:', error);
        return null;
    }
};

/**
 * Get stats from flyover data
 */
export const getStatsFromFlyovers = (flyovers) => {
    const total = flyovers.length;
    const low = flyovers.filter(f => f.riskStatus === 'low').length;
    const moderate = flyovers.filter(f => f.riskStatus === 'moderate').length;
    const high = flyovers.filter(f => f.riskStatus === 'high').length;
    return { total, low, moderate, high };
};