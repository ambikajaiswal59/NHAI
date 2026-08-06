import proj4 from 'proj4';

const ROADS_GEOJSON_PATH = '/data/Flyover_Roads.geojson';
const NAMES_GEOJSON_PATH = '/data/FlyOver_Name.geojson';

const UTM43N = '+proj=utm +zone=43 +datum=WGS84 +units=m +no_defs';
const WGS84 = 'EPSG:4326';

// Map Type to highway names - ALL set to NH 152
const highwayMap = {
    'F1': 'NH 152',
    'F2': 'NH 152',
    'F3': 'NH 152',
    'F4': 'NH 152'
};

// Map Type to risk status
const riskStatusMap = {
    'F1': 'low',
    'F2': 'moderate',
    'F3': 'high',
    'F4': 'low'
};

const toWgs84 = ([x, y]) => proj4(UTM43N, WGS84, [x, y]);

const convertCoords = (coords) => {
    if (typeof coords[0] === 'number') {
        return toWgs84(coords);
    }
    return coords.map(convertCoords);
};

const convertFeature = (feature) => ({
    ...feature,
    geometry: {
        ...feature.geometry,
        coordinates: convertCoords(feature.geometry.coordinates),
    },
});

const normalizeHighway = (value) =>
    (value || '').toString().toUpperCase().replace(/\s+/g, '');

const findProp = (props, keys) => {
    if (!props) return null;
    for (const key of keys) {
        if (props[key] !== undefined && props[key] !== null && props[key] !== '') {
            return props[key];
        }
    }
    return null;
};

const loadNamedPointsByHighway = async () => {
    try {
        const response = await fetch(NAMES_GEOJSON_PATH);
        if (!response.ok) {
            throw new Error(`Failed to fetch named points GeoJSON: ${response.status}`);
        }
        const geojson = await response.json();

        const byHighway = {};
        (geojson.features || []).forEach((feature, index) => {
            const props = feature.properties || {};
            const remarks = findProp(props, ['Remarks', 'remarks']);
            const highwayKey = normalizeHighway(remarks);
            if (!highwayKey) return;

            const [lng, lat] = feature.geometry?.coordinates || [];
            if (typeof lat !== 'number' || typeof lng !== 'number') return;

            const point = {
                id: findProp(props, ['id', 'ID']) ?? `point-${index + 1}`,
                name: findProp(props, ['NAME', 'name']) || `Flyover ${index + 1}`,
                chainage: findProp(props, ['Chainage', 'chainage']),
                description: findProp(props, ['Descriptio', 'Description', 'description']),
                length: findProp(props, ['Length', 'length']),
                detail: findProp(props, ['Detail', 'detail', 'Details']),
                remarks,
                latlng: [lat, lng],
            };

            if (!byHighway[highwayKey]) byHighway[highwayKey] = [];
            byHighway[highwayKey].push(point);
        });

        return byHighway;
    } catch (error) {
        console.error('Error loading named points GeoJSON:', error);
        return {};
    }
};

export const loadFlyoverData = async () => {
    try {
        const response = await fetch(ROADS_GEOJSON_PATH);
        if (!response.ok) {
            throw new Error(`Failed to fetch GeoJSON: ${response.status}`);
        }
        const geojson = await response.json();

        const convertedFeatures = geojson.features.map(convertFeature);

        const namedPointsByHighway = await loadNamedPointsByHighway();

        const grouped = {};
        convertedFeatures.forEach(feature => {
            const type = feature.properties.Type;
            if (!grouped[type]) {
                grouped[type] = [];
            }
            grouped[type].push(feature);
        });

        const flyovers = Object.keys(grouped).map((type, index) => {
            const features = grouped[type];

            const featureCollection = {
                type: 'FeatureCollection',
                features
            };

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

            let latSum = 0, lngSum = 0;
            allCoordinates.forEach(([lng, lat]) => {
                latSum += lat;
                lngSum += lng;
            });
            const center = [latSum / allCoordinates.length, lngSum / allCoordinates.length];

            const step = Math.max(1, Math.floor(allCoordinates.length / 15));
            const path = allCoordinates
                .filter((_, i) => i % step === 0)
                .map(([lng, lat]) => [lat, lng]);

            const highway = highwayMap[type] || `Highway ${type}`;

            // Get all points for this highway
            const allPoints = namedPointsByHighway[normalizeHighway(highway)] || [];

            // Sort by Chainage
            allPoints.sort((a, b) => {
                if (a.chainage && b.chainage) {
                    return a.chainage.localeCompare(b.chainage);
                }
                return a.id - b.id;
            });

            return {
                id: index + 1,
                highway,
                riskStatus: riskStatusMap[type] || 'low',
                center,
                path,
                geojson: featureCollection,
                type,
                namedPoints: allPoints, // ALL points go to ALL flyovers
            };
        }).filter(f => f !== null);

        return flyovers;
    } catch (error) {
        console.error('Error loading GeoJSON:', error);
        return null;
    }
};

export const getStatsFromFlyovers = (flyovers) => {
    const total = flyovers.length;
    const low = flyovers.filter(f => f.riskStatus === 'low').length;
    const moderate = flyovers.filter(f => f.riskStatus === 'moderate').length;
    const high = flyovers.filter(f => f.riskStatus === 'high').length;
    return { total, low, moderate, high };
};












// import proj4 from 'proj4';

// const ROADS_GEOJSON_PATH = '/data/Flyover_Roads.geojson';
// const NAMES_GEOJSON_PATH = '/data/FlyOver_Name.geojson'; // adjust if your actual filename differs

// // Source projection used in the exported shapefile (Flyover_Roads only —
// // FlyOver_Name is already WGS84 / CRS84, no reprojection needed there)
// const UTM43N = '+proj=utm +zone=43 +datum=WGS84 +units=m +no_defs';
// const WGS84 = 'EPSG:4326';

// // Map Type to highway names
// const highwayMap = {
//     'F1': 'NH 150',
//     'F2': 'NH 152',
//     'F3': 'NH 155',
//     'F4': 'NH 162'
// };

// // Map Type to risk status (you can make this dynamic later)
// const riskStatusMap = {
//     'F1': 'low',
//     'F2': 'moderate',
//     'F3': 'high',
//     'F4': 'low'
// };

// const toWgs84 = ([x, y]) => proj4(UTM43N, WGS84, [x, y]);

// // Recursively walk a GeoJSON coordinates array (any nesting depth:
// // Polygon, MultiPolygon, etc.) and convert every leaf [x, y] point
// const convertCoords = (coords) => {
//     if (typeof coords[0] === 'number') {
//         return toWgs84(coords);
//     }
//     return coords.map(convertCoords);
// };

// // Returns a new feature with its geometry reprojected to WGS84
// const convertFeature = (feature) => ({
//     ...feature,
//     geometry: {
//         ...feature.geometry,
//         coordinates: convertCoords(feature.geometry.coordinates),
//     },
// });

// // Normalizes a highway string for matching regardless of spacing/case
// // differences between files (e.g. "NH 152" vs "NH152" vs "nh152").
// const normalizeHighway = (value) =>
//     (value || '').toString().toUpperCase().replace(/\s+/g, '');

// // Pulls a value off a feature's properties, trying multiple possible key
// // spellings, since exported shapefiles/GeoJSON often vary slightly.
// const findProp = (props, keys) => {
//     if (!props) return null;
//     for (const key of keys) {
//         if (props[key] !== undefined && props[key] !== null && props[key] !== '') {
//             return props[key];
//         }
//     }
//     return null;
// };

// // Loads the named-points file (FlyOver_Name.geojson) and groups its point
// // features by highway (via the Remarks field, e.g. "NH 152"), so each
// // highway group in loadFlyoverData can attach the points that belong to it.
// // Points are already in WGS84 (CRS84), so no reprojection is applied here.
// const loadNamedPointsByHighway = async () => {
//     try {
//         const response = await fetch(NAMES_GEOJSON_PATH);
//         if (!response.ok) {
//             throw new Error(`Failed to fetch named points GeoJSON: ${response.status}`);
//         }
//         const geojson = await response.json();

//         const byHighway = {};
//         (geojson.features || []).forEach((feature, index) => {
//             const props = feature.properties || {};
//             const remarks = findProp(props, ['Remarks', 'remarks']);
//             const highwayKey = normalizeHighway(remarks);
//             if (!highwayKey) return;

//             const [lng, lat] = feature.geometry?.coordinates || [];
//             if (typeof lat !== 'number' || typeof lng !== 'number') return;

//             const point = {
//                 id: findProp(props, ['id', 'ID']) ?? `point-${index + 1}`,
//                 name: findProp(props, ['NAME', 'name']) || `Flyover ${index + 1}`,
//                 chainage: findProp(props, ['Chainage', 'chainage']),
//                 description: findProp(props, ['Descriptio', 'Description', 'description']),
//                 length: findProp(props, ['Length', 'length']),
//                 detail: findProp(props, ['Detail', 'detail', 'Details']),
//                 remarks,
//                 latlng: [lat, lng],
//             };

//             if (!byHighway[highwayKey]) byHighway[highwayKey] = [];
//             byHighway[highwayKey].push(point);
//         });

//         return byHighway;
//     } catch (error) {
//         console.error('Error loading named points GeoJSON:', error);
//         return {};
//     }
// };

// export const loadFlyoverData = async () => {
//     try {
//         const response = await fetch(ROADS_GEOJSON_PATH);
//         if (!response.ok) {
//             throw new Error(`Failed to fetch GeoJSON: ${response.status}`);
//         }
//         const geojson = await response.json();

//         // Reproject every feature to WGS84 up front, once
//         const convertedFeatures = geojson.features.map(convertFeature);

//         // Load named points (Chainage/Descriptio/Length/Detail) and group
//         // them by highway so we can attach the right ones to each group below
//         const namedPointsByHighway = await loadNamedPointsByHighway();

//         // Group features by Type
//         const grouped = {};
//         convertedFeatures.forEach(feature => {
//             const type = feature.properties.Type;
//             if (!grouped[type]) {
//                 grouped[type] = [];
//             }
//             grouped[type].push(feature);
//         });

//         // Convert each group to flyover format
//         const flyovers = Object.keys(grouped).map((type, index) => {
//             const features = grouped[type];

//             // Real GeoJSON layer for this highway — this is what gets
//             // drawn on the map as the actual flyover footprint
//             const featureCollection = {
//                 type: 'FeatureCollection',
//                 features
//             };

//             // Collect all coordinates from all features in this group
//             // (used only to derive a center / simplified path for the card)
//             const allCoordinates = [];
//             features.forEach(feature => {
//                 try {
//                     const coords = feature.geometry.coordinates[0][0];
//                     allCoordinates.push(...coords);
//                 } catch (e) {
//                     console.warn('Error processing feature:', e);
//                 }
//             });

//             if (allCoordinates.length === 0) {
//                 return null;
//             }

//             // Calculate center
//             let latSum = 0, lngSum = 0;
//             allCoordinates.forEach(([lng, lat]) => {
//                 latSum += lat;
//                 lngSum += lng;
//             });
//             const center = [latSum / allCoordinates.length, lngSum / allCoordinates.length];

//             // Create simplified path (still used for FitBounds / fallback)
//             const step = Math.max(1, Math.floor(allCoordinates.length / 15));
//             const path = allCoordinates
//                 .filter((_, i) => i % step === 0)
//                 .map(([lng, lat]) => [lat, lng]);

//             const highway = highwayMap[type] || `Highway ${type}`;

//             // Attach the named points (labels/details) whose Remarks field
//             // matches this highway — points are label-only, the dropdown
//             // and details panel stay grouped at the highway level.
//             const namedPoints = namedPointsByHighway[normalizeHighway(highway)] || [];

//             return {
//                 id: index + 1,
//                 highway,
//                 riskStatus: riskStatusMap[type] || 'low',
//                 center,
//                 path,
//                 geojson: featureCollection, // actual polygon layer, in WGS84
//                 type,
//                 namedPoints,
//             };
//         }).filter(f => f !== null);

//         return flyovers;
//     } catch (error) {
//         console.error('Error loading GeoJSON:', error);
//         return null;
//     }
// };

// /**
//  * Get stats from flyover data
//  */
// export const getStatsFromFlyovers = (flyovers) => {
//     const total = flyovers.length;
//     const low = flyovers.filter(f => f.riskStatus === 'low').length;
//     const moderate = flyovers.filter(f => f.riskStatus === 'moderate').length;
//     const high = flyovers.filter(f => f.riskStatus === 'high').length;
//     return { total, low, moderate, high };
// };