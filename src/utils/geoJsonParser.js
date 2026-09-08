import proj4 from 'proj4';

const ROADS_GEOJSON_PATH = '/data/Flyover_Roads.geojson';
const NAMES_GEOJSON_PATH = '/data/FlyOver_Name.geojson';

const UTM43N = '+proj=utm +zone=43 +datum=WGS84 +units=m +no_defs';
const WGS84 = 'EPSG:4326';

const highwayMap = {
    'F1': 'NH 152',
    'F2': 'NH 152',
    'F3': 'NH 152',
    'F4': 'NH 152'
};

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

// Rough planar distance is fine at this regional scale (few km),
// no need for haversine here.
const dist2 = (aLat, aLng, bLat, bLng) => {
    const dLat = aLat - bLat;
    const dLng = aLng - bLng;
    return dLat * dLat + dLng * dLng;
};

// Load ALL named points (flat list), independent of any highway grouping.
// We no longer try to bucket by "Remarks -> highway" and then split again
// by parsing digits out of NAME — that's what was silently dropping points
// like "ROB-0+930" / "ROB-5+362".
const loadAllNamedPoints = async () => {
    try {
        const response = await fetch(NAMES_GEOJSON_PATH);
        if (!response.ok) {
            throw new Error(`Failed to fetch named points GeoJSON: ${response.status}`);
        }
        const geojson = await response.json();
        // console.log("Named Points GeoJSON Loaded:", geojson);

        const points = [];
        (geojson.features || []).forEach((feature, index) => {
            const props = feature.properties || {};
            const [lng, lat] = feature.geometry?.coordinates || [];
            if (typeof lat !== 'number' || typeof lng !== 'number') return;

            points.push({
                id: findProp(props, ['id', 'ID']) ?? `point-${index + 1}`,
                name: findProp(props, ['NAME', 'name']) || `Flyover ${index + 1}`,
                chainage: findProp(props, ['Chainage', 'chainage']),
                description: findProp(props, ['Descriptio', 'Description', 'description']),
                length: findProp(props, ['Length', 'length']),
                detail: findProp(props, ['Detail', 'detail', 'Details']),
                remarks: findProp(props, ['Remarks', 'remarks']),
                latlng: [lat, lng],
            });
        });

        return points;
    } catch (error) {
        console.error('Error loading named points GeoJSON:', error);
        return [];
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
        const allNamedPoints = await loadAllNamedPoints();

        const grouped = {};
        convertedFeatures.forEach(feature => {
            const type = feature.properties.Type;
            if (!grouped[type]) {
                grouped[type] = [];
            }
            grouped[type].push(feature);
        });

        // First pass: build flyover segments (no named points yet)
        const flyoverShells = Object.keys(grouped).map((type, index) => {
            const features = grouped[type];
            const featureCollection = { type: 'FeatureCollection', features };

            const allCoordinates = [];
            features.forEach(feature => {
                try {
                    const coords = feature.geometry.coordinates[0][0];
                    allCoordinates.push(...coords);
                } catch (e) {
                    console.warn('Error processing feature:', e);
                }
            });

            if (allCoordinates.length === 0) return null;

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

            return {
                id: index + 1,
                highway,
                riskStatus: riskStatusMap[type] || 'low',
                center,
                path,
                geojson: featureCollection,
                type,
                namedPoints: [], // filled in below
            };
        }).filter(f => f !== null);

        // Second pass: assign each named point to its geographically
        // nearest flyover segment (checked against every path vertex,
        // not just the center, so long segments still get the right points).
        allNamedPoints.forEach(point => {
            const [pLat, pLng] = point.latlng;
            let best = null;
            let bestDist = Infinity;

            flyoverShells.forEach(flyover => {
                const candidates = flyover.path.length > 0 ? flyover.path : [flyover.center];
                candidates.forEach(([lat, lng]) => {
                    const d = dist2(pLat, pLng, lat, lng);
                    if (d < bestDist) {
                        bestDist = d;
                        best = flyover;
                    }
                });
            });

            if (best) {
                best.namedPoints.push(point);
            }
        });

        // Sort each flyover's points by chainage
        flyoverShells.forEach(flyover => {
            flyover.namedPoints.sort((a, b) => {
                if (a.chainage && b.chainage) {
                    return a.chainage.localeCompare(b.chainage);
                }
                return (a.id ?? 0) - (b.id ?? 0);
            });
        });

        return flyoverShells;
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