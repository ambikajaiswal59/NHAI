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

            // ✅ FIX: Filter points that belong to THIS SPECIFIC flyover
            // Extract the number from the type (e.g., "F1" -> "1", "F2" -> "2")
            const typeNumberMatch = type.match(/\d+/);
            const typeNumber = typeNumberMatch ? typeNumberMatch[0] : null;

            let flyoverPoints = [];

            if (typeNumber) {
                // Filter points that match this flyover's number
                // e.g., "FLYOVER 2" should match type "F2"
                flyoverPoints = allPoints.filter(point => {
                    const pointNumberMatch = point.name.match(/\d+/);
                    const pointNumber = pointNumberMatch ? pointNumberMatch[0] : null;
                    return pointNumber === typeNumber;
                });
            } else {
                // Fallback: If no number in type, use all points (should not happen)
                flyoverPoints = allPoints;
            }

            // Sort by Chainage
            flyoverPoints.sort((a, b) => {
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
                namedPoints: flyoverPoints,  //  POINTS top up data is ATTACHED HERE
            };
        }).filter(f => f !== null);

        // Debug: Log what each flyover got
        // console.log('=== Flyover Data Loaded ===');
        // flyovers.forEach(f => {
        //     console.log(`${f.type} (${f.highway}): ${f.namedPoints.length} named points`);
        //     f.namedPoints.forEach(p => {
        //         console.log(`  - ${p.name} (${p.chainage})`);
        //     });
        // });

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