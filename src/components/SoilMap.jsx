// src/components/SoilMap.jsx
import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Loader2, AlertTriangle, Maximize, Minimize } from "lucide-react";
import { useFlyoverData } from "../hooks/useFlyoverData";
import {
    getFlyoverColor,
    getFlyoverDisplayName,
    makeFlyoverIcon,
    formatPointName,
} from "./map/mapHelpers";

const SOIL_TAXO_COLORS = {
    "Fluventic Ustochrepts": "#4CAF50",
    "Natric Ustochrepts": "#FF5722",
    "Typic Haplustalfs": "#C6CE3D",
    "Typic Ustifluvents": "#4472C4",
    "Typic Ustochrepts": "#9C27B0",
    "Udic Ustochrepts": "#26C6DA",
};
const DEFAULT_SOIL_COLOR = "#9E9E9E";

const DEFAULT_SOIL_MAP_CENTER = [30.3, 76.7];

function getSoilColor(props) {
    return SOIL_TAXO_COLORS[props?.S_TAXO] || DEFAULT_SOIL_COLOR;
}

function soilStyle(feature) {
    return { fillColor: getSoilColor(feature.properties), weight: 1.5, opacity: 0.9, color: "#333333", fillOpacity: 0.7 };
}

function soilHighlightStyle(feature) {
    return { fillColor: getSoilColor(feature.properties), weight: 3, opacity: 1, color: "#1f2937", fillOpacity: 0.85 };
}

function onEachSoilFeature(feature, layer) {
    const props = feature.properties;
    layer.bindPopup(`
        <div style="font-size:12px; font-family: Arial, sans-serif; max-width:250px; padding:4px;">
            <div style="font-weight:bold; font-size:14px; color:#1f2937; border-bottom:1px solid #e5e7eb; padding-bottom:4px; margin-bottom:4px;">
                Soil ID: ${props.SOIL_ID || "N/A"}
            </div>
            <table style="width:100%; font-size:11px; border-collapse:collapse;">
                <tr><td style="padding:2px 0; color:#6b7280;">Texture:</td><td style="padding:2px 0; font-weight:600;">${props.S_TEXTURE || "N/A"}</td></tr>
                <tr><td style="padding:2px 0; color:#6b7280;">Depth:</td><td style="padding:2px 0; font-weight:600;">${props.SOIL_DEPTH || "N/A"}</td></tr>
                <tr><td style="padding:2px 0; color:#6b7280;">Taxonomy:</td><td style="padding:2px 0; font-weight:600;">${props.S_TAXO || "N/A"}</td></tr>
                <tr><td style="padding:2px 0; color:#6b7280;">Region:</td><td style="padding:2px 0; font-weight:600;">${props.S_REGION || "N/A"}</td></tr>
                <tr><td style="padding:2px 0; color:#6b7280;">Sub Region:</td><td style="padding:2px 0; font-weight:600;">${props.S_SUB_REG || "N/A"}</td></tr>
                <tr><td style="padding:2px 0; color:#6b7280;">Slope:</td><td style="padding:2px 0; font-weight:600;">${props.SL_CLASS || "N/A"}</td></tr>
                ${props.CLASS && props.CLASS !== "Nil" ? `<tr><td style="padding:2px 0; color:#6b7280;">Class:</td><td style="padding:2px 0; font-weight:600; color:#dc2626;">${props.CLASS}</td></tr>` : ""}
            </table>
        </div>
    `);
    layer.on({
        mouseover: (e) => e.target.setStyle(soilHighlightStyle(feature)),
        mouseout: (e) => e.target.setStyle(soilStyle(feature)),
    });
}

function FullscreenButton({ isFullscreen, onToggle }) {
    return (
        <button
            onClick={onToggle}
            className={`flex items-center justify-center w-[30px] h-[30px] bg-white rounded-md shadow-md border border-gray-200 transition-all duration-200 hover:bg-gray-50 hover:shadow-lg ${isFullscreen ? 'bg-blue-50 border-blue-300 text-blue-600' : 'text-gray-700'}`}
            aria-label="Toggle fullscreen"
        >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>
    );
}

function SoilLegend({ taxoValues }) {
    if (!taxoValues || taxoValues.length === 0) return null;
    return (
        <div className="absolute bottom-3 right-3 z-[500] bg-white/95 backdrop-blur-sm rounded-md shadow-md border border-gray-200 px-3 py-2 max-w-[220px]">
            <div className="text-[11px] font-semibold text-gray-700 mb-1.5">Soil Taxonomy</div>
            <div className="flex flex-col gap-1">
                {taxoValues.map((taxo) => (
                    <div key={taxo} className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-sm flex-shrink-0 border border-gray-400" style={{ backgroundColor: getSoilColor({ S_TAXO: taxo }) }} />
                        <span className="text-[10px] text-gray-600 leading-tight">{taxo}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function SoilMap({ mapCenter = DEFAULT_SOIL_MAP_CENTER, isActive = true }) {
    const SOIL_MAP_ZOOM = 10;

    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const geoJsonLayerRef = useRef(null);
    const soilDataRef = useRef(null);
    const flyoverLayersRef = useRef({});
    const flyoverMarkersRef = useRef([]);
    const isViewSetRef = useRef(false);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [soilData, setSoilData] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [taxoValues, setTaxoValues] = useState([]);

    const { flyovers, loading: flyoversLoading, error: flyoversError } = useFlyoverData();

    const fullscreenContainerRef = useRef(null);

    useEffect(() => {
        const fetchSoilData = async () => {
            try {
                const response = await fetch('/data/Soil.geojson');
                if (!response.ok) throw new Error(`Failed to load soil data: ${response.status}`);
                const data = await response.json();
                soilDataRef.current = data;
                setSoilData(data);
                setTaxoValues(Array.from(new Set((data.features || []).map(f => f.properties?.S_TAXO).filter(Boolean))).sort());
                setLoading(false);
            } catch (err) {
                console.error('Error loading soil data:', err);
                setError(err.message || 'Failed to load soil data');
                setLoading(false);
            }
        };

        fetchSoilData();
    }, []);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
            setTimeout(() => {
                if (mapRef.current) {
                    mapRef.current.invalidateSize();
                    if (geoJsonLayerRef.current) {
                        try {
                            const bounds = geoJsonLayerRef.current.getBounds();
                            if (bounds.isValid()) {
                                mapRef.current.setView(bounds.getCenter(), SOIL_MAP_ZOOM, { animate: false });
                            }
                        } catch (e) {
                            console.warn('Could not set view:', e);
                        }
                    }
                }
            }, 200);
        };
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, []);

    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            fullscreenContainerRef.current?.requestFullscreen?.();
        } else {
            document.exitFullscreen?.();
        }
    }, []);

    useEffect(() => {
        if (!isActive || !mapRef.current) return;
        const map = mapRef.current;
        const raf = requestAnimationFrame(() => {
            map.invalidateSize();
        });
        return () => cancelAnimationFrame(raf);
    }, [isActive]);

    const addFlyoverLayers = useCallback((map) => {
        if (!flyovers || flyovers.length === 0) return;

        Object.values(flyoverLayersRef.current).forEach(layer => {
            if (map.hasLayer(layer)) {
                map.removeLayer(layer);
            }
        });
        flyoverLayersRef.current = {};

        flyoverMarkersRef.current.forEach(marker => {
            if (map.hasLayer(marker)) {
                map.removeLayer(marker);
            }
        });
        flyoverMarkersRef.current = [];

        flyovers.forEach((flyover, index) => {
            const color = getFlyoverColor(index);
            const displayName = getFlyoverDisplayName(flyover.type, index);

            if (flyover.geojson) {
                const layer = L.geoJSON(flyover.geojson, {
                    style: {
                        color: color,
                        weight: 3,
                        opacity: 0.8,
                        fillColor: color,
                        fillOpacity: 0.2,
                    },
                }).addTo(map);

                flyoverLayersRef.current[flyover.id] = layer;
            }

            if (flyover.namedPoints && flyover.namedPoints.length > 0) {
                flyover.namedPoints.forEach((point) => {
                    const pointName = formatPointName(point.name);
                    const icon = makeFlyoverIcon({
                        color: color,
                        labelText: pointName,
                        detailed: false,
                        name: pointName,
                        detailFields: [],
                    });

                    const marker = L.marker(point.latlng, {
                        icon: icon,
                        riseOnHover: true,
                    }).addTo(map);

                    marker.bindPopup(`
                        <div style="padding: 8px; font-family: Arial, sans-serif;">
                            <h4 style="margin: 0 0 4px 0; color: ${color};">${pointName}</h4>
                            ${point.chainage ? `<p style="margin: 2px 0; font-size: 11px;"><strong>Chainage:</strong> ${point.chainage}</p>` : ''}
                            ${point.description ? `<p style="margin: 2px 0; font-size: 11px;"><strong>Type:</strong> ${point.description}</p>` : ''}
                            ${point.length ? `<p style="margin: 2px 0; font-size: 11px;"><strong>Length:</strong> ${point.length}</p>` : ''}
                            ${point.detail ? `<p style="margin: 2px 0; font-size: 11px;"><strong>Structure:</strong> ${point.detail}</p>` : ''}
                        </div>
                    `);

                    flyoverMarkersRef.current.push(marker);
                });
            }
        });
    }, [flyovers]);

    useEffect(() => {
        if (mapRef.current) {
            mapRef.current.remove();
            mapRef.current = null;
        }

        if (!mapContainerRef.current) return;

        const map = L.map(mapContainerRef.current, {
            center: mapCenter,
            zoom: SOIL_MAP_ZOOM,
            zoomControl: true,
            attributionControl: false,
        });

        const streetLayer = L.tileLayer("https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
            subdomains: ["mt0", "mt1", "mt2", "mt3"],
            maxZoom: 20,
            attribution: "",
        });

        const satelliteLayer = L.tileLayer("https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
            subdomains: ["mt0", "mt1", "mt2", "mt3"],
            maxZoom: 20,
            attribution: "",
        });

        streetLayer.addTo(map);
        L.control.attribution({ position: "bottomright", prefix: false }).addTo(map);
        L.control.layers(
            { "Streets": streetLayer, "Satellite": satelliteLayer },
            null,
            { position: 'topleft', collapsed: true }
        ).addTo(map);

        mapRef.current = map;
        isViewSetRef.current = false;

        if (soilDataRef.current) {
            if (geoJsonLayerRef.current) {
                map.removeLayer(geoJsonLayerRef.current);
            }
            geoJsonLayerRef.current = L.geoJSON(soilDataRef.current, {
                style: soilStyle,
                onEachFeature: onEachSoilFeature,
            }).addTo(map);

            try {
                const bounds = geoJsonLayerRef.current.getBounds();
                if (bounds.isValid()) {
                    map.setView(bounds.getCenter(), SOIL_MAP_ZOOM, { animate: false });
                    isViewSetRef.current = true;
                }
            } catch (e) {
                console.warn('Could not set view:', e);
            }
        }

        setTimeout(() => {
            if (mapRef.current && flyovers && flyovers.length > 0) {
                addFlyoverLayers(mapRef.current);
            }
        }, 500);

        setTimeout(() => {
            map.invalidateSize();
        }, 100);

        const resizeObserver = new ResizeObserver(() => {
            map.invalidateSize();
        });
        if (mapContainerRef.current) {
            resizeObserver.observe(mapContainerRef.current);
        }

        return () => {
            resizeObserver.disconnect();
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, [mapCenter, soilData, flyovers, addFlyoverLayers]);

    useEffect(() => {
        if (!mapRef.current || !soilData) return;

        if (geoJsonLayerRef.current) {
            mapRef.current.removeLayer(geoJsonLayerRef.current);
        }

        geoJsonLayerRef.current = L.geoJSON(soilData, {
            style: soilStyle,
            onEachFeature: onEachSoilFeature,
        }).addTo(mapRef.current);

        try {
            const bounds = geoJsonLayerRef.current.getBounds();
            if (bounds.isValid()) {
                mapRef.current.setView(bounds.getCenter(), SOIL_MAP_ZOOM, { animate: false });
                isViewSetRef.current = true;
            }
        } catch (e) {
            console.warn('Could not set view:', e);
        }

        mapRef.current.invalidateSize();
    }, [soilData]);

    return (
        <div className="flex flex-col h-full" ref={fullscreenContainerRef}>
            <div className="flex-1 min-h-0 relative rounded-lg overflow-hidden border border-gray-200">
                <div ref={mapContainerRef} className="absolute inset-0" />

                {!loading && !error && soilData && <SoilLegend taxoValues={taxoValues} />}

                <div className="absolute top-3 right-3 z-[500]">
                    <FullscreenButton isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
                </div>

                {(loading || flyoversLoading) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-[500]">
                        <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                            <Loader2 size={32} className="text-emerald-600 animate-spin" />
                            <p className="text-sm text-gray-700 font-medium">
                                {loading ? "Loading soil data..." : "Loading flyover data..."}
                            </p>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-center gap-2 shadow-lg max-w-md">
                        <AlertTriangle size={16} className="flex-shrink-0" />
                        <span>{error}</span>
                    </div>
                )}
            </div>
        </div>
    );
}









// // src/components/SoilMap.jsx
// import { useEffect, useRef, useState, useCallback } from "react";
// import L from "leaflet";
// import "leaflet/dist/leaflet.css";
// import { Loader2, AlertTriangle, Maximize, Minimize } from "lucide-react";
// import { useFlyoverData } from "../hooks/useFlyoverData";
// import {
//     getFlyoverColor,
//     getFlyoverDisplayName,
//     makeFlyoverIcon,
//     formatPointName,
// } from "./map/mapHelpers";

// const SOIL_TAXO_COLORS = {
//     "Fluventic Ustochrepts": "#4CAF50",
//     "Natric Ustochrepts": "#FF5722",
//     "Typic Haplustalfs": "#C6CE3D",
//     "Typic Ustifluvents": "#4472C4",
//     "Typic Ustochrepts": "#9C27B0",
//     "Udic Ustochrepts": "#26C6DA",
// };
// const DEFAULT_SOIL_COLOR = "#9E9E9E";

// // Stable module-level reference — see the identical note in FloodMap.jsx.
// // An inline default like `mapCenter = [30.3, 76.7]` creates a new array on
// // every render, which breaks any effect keyed on [mapCenter].
// const DEFAULT_SOIL_MAP_CENTER = [30.3, 76.7];

// function getSoilColor(props) {
//     return SOIL_TAXO_COLORS[props?.S_TAXO] || DEFAULT_SOIL_COLOR;
// }

// function soilStyle(feature) {
//     return { fillColor: getSoilColor(feature.properties), weight: 1.5, opacity: 0.9, color: "#333333", fillOpacity: 0.7 };
// }

// function soilHighlightStyle(feature) {
//     return { fillColor: getSoilColor(feature.properties), weight: 3, opacity: 1, color: "#1f2937", fillOpacity: 0.85 };
// }

// function onEachSoilFeature(feature, layer) {
//     const props = feature.properties;
//     layer.bindPopup(`
//         <div style="font-size:12px; font-family: Arial, sans-serif; max-width:250px; padding:4px;">
//             <div style="font-weight:bold; font-size:14px; color:#1f2937; border-bottom:1px solid #e5e7eb; padding-bottom:4px; margin-bottom:4px;">
//                 Soil ID: ${props.SOIL_ID || "N/A"}
//             </div>
//             <table style="width:100%; font-size:11px; border-collapse:collapse;">
//                 <tr><td style="padding:2px 0; color:#6b7280;">Texture:</td><td style="padding:2px 0; font-weight:600;">${props.S_TEXTURE || "N/A"}</td></tr>
//                 <tr><td style="padding:2px 0; color:#6b7280;">Depth:</td><td style="padding:2px 0; font-weight:600;">${props.SOIL_DEPTH || "N/A"}</td></tr>
//                 <tr><td style="padding:2px 0; color:#6b7280;">Taxonomy:</td><td style="padding:2px 0; font-weight:600;">${props.S_TAXO || "N/A"}</td></tr>
//                 <tr><td style="padding:2px 0; color:#6b7280;">Region:</td><td style="padding:2px 0; font-weight:600;">${props.S_REGION || "N/A"}</td></tr>
//                 <tr><td style="padding:2px 0; color:#6b7280;">Sub Region:</td><td style="padding:2px 0; font-weight:600;">${props.S_SUB_REG || "N/A"}</td></tr>
//                 <tr><td style="padding:2px 0; color:#6b7280;">Slope:</td><td style="padding:2px 0; font-weight:600;">${props.SL_CLASS || "N/A"}</td></tr>
//                 ${props.CLASS && props.CLASS !== "Nil" ? `<tr><td style="padding:2px 0; color:#6b7280;">Class:</td><td style="padding:2px 0; font-weight:600; color:#dc2626;">${props.CLASS}</td></tr>` : ""}
//             </table>
//         </div>
//     `);
//     layer.on({
//         mouseover: (e) => e.target.setStyle(soilHighlightStyle(feature)),
//         mouseout: (e) => e.target.setStyle(soilStyle(feature)),
//     });
// }

// function FullscreenButton({ isFullscreen, onToggle }) {
//     return (
//         <button
//             onClick={onToggle}
//             className={`flex items-center justify-center w-[30px] h-[30px] bg-white rounded-md shadow-md border border-gray-200 transition-all duration-200 hover:bg-gray-50 hover:shadow-lg ${isFullscreen ? 'bg-blue-50 border-blue-300 text-blue-600' : 'text-gray-700'}`}
//             aria-label="Toggle fullscreen"
//         >
//             {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
//         </button>
//     );
// }

// function SoilLegend({ taxoValues }) {
//     if (!taxoValues || taxoValues.length === 0) return null;
//     return (
//         <div className="absolute bottom-3 right-3 z-[500] bg-white/95 backdrop-blur-sm rounded-md shadow-md border border-gray-200 px-3 py-2 max-w-[220px]">
//             <div className="text-[11px] font-semibold text-gray-700 mb-1.5">Soil Taxonomy</div>
//             <div className="flex flex-col gap-1">
//                 {taxoValues.map((taxo) => (
//                     <div key={taxo} className="flex items-center gap-2">
//                         <span className="w-3 h-3 rounded-sm flex-shrink-0 border border-gray-400" style={{ backgroundColor: getSoilColor({ S_TAXO: taxo }) }} />
//                         <span className="text-[10px] text-gray-600 leading-tight">{taxo}</span>
//                     </div>
//                 ))}
//             </div>
//         </div>
//     );
// }

// export default function SoilMap({ mapCenter = DEFAULT_SOIL_MAP_CENTER, isActive = true }) {
//     const SOIL_MAP_ZOOM = 10;

//     const mapContainerRef = useRef(null);
//     const mapRef = useRef(null);
//     const geoJsonLayerRef = useRef(null);
//     const soilDataRef = useRef(null);
//     const flyoverLayersRef = useRef({});
//     const flyoverMarkersRef = useRef([]);
//     const isViewSetRef = useRef(false);

//     const [loading, setLoading] = useState(true);
//     const [error, setError] = useState(null);
//     const [soilData, setSoilData] = useState(null);
//     const [isFullscreen, setIsFullscreen] = useState(false);
//     const [taxoValues, setTaxoValues] = useState([]);

//     // Get flyover data using the hook
//     const { flyovers, loading: flyoversLoading, error: flyoversError } = useFlyoverData();

//     const fullscreenContainerRef = useRef(null);

//     // Fetch soil data
//     useEffect(() => {
//         const fetchSoilData = async () => {
//             try {
//                 const response = await fetch('/data/Soil.geojson');
//                 if (!response.ok) throw new Error(`Failed to load soil data: ${response.status}`);
//                 const data = await response.json();
//                 soilDataRef.current = data;
//                 setSoilData(data);
//                 setTaxoValues(Array.from(new Set((data.features || []).map(f => f.properties?.S_TAXO).filter(Boolean))).sort());
//                 setLoading(false);
//             } catch (err) {
//                 console.error('Error loading soil data:', err);
//                 setError(err.message || 'Failed to load soil data');
//                 setLoading(false);
//             }
//         };

//         fetchSoilData();
//     }, []);

//     // Fullscreen handler
//     useEffect(() => {
//         const handleFullscreenChange = () => {
//             setIsFullscreen(!!document.fullscreenElement);
//             setTimeout(() => {
//                 if (mapRef.current) {
//                     mapRef.current.invalidateSize();
//                     if (geoJsonLayerRef.current) {
//                         try {
//                             const bounds = geoJsonLayerRef.current.getBounds();
//                             if (bounds.isValid()) {
//                                 mapRef.current.setView(bounds.getCenter(), SOIL_MAP_ZOOM, { animate: false });
//                             }
//                         } catch (e) {
//                             console.warn('Could not set view:', e);
//                         }
//                     }
//                 }
//             }, 200);
//         };
//         document.addEventListener("fullscreenchange", handleFullscreenChange);
//         return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
//     }, []);

//     const toggleFullscreen = useCallback(() => {
//         if (!document.fullscreenElement) {
//             fullscreenContainerRef.current?.requestFullscreen?.();
//         } else {
//             document.exitFullscreen?.();
//         }
//     }, []);

//     // Force a proper resize when this panel becomes the active (displayed)
//     // tab — see the identical, more detailed comment in FloodMap.jsx.
//     // Soil's own layer is vector (L.geoJSON), not raster, so it was never
//     // vulnerable to the cross-layer pixel bleeding bug, but it still needs
//     // this so the map doesn't stay laid out at a stale 0x0 size after being
//     // hidden with display:none.
//     useEffect(() => {
//         if (!isActive || !mapRef.current) return;
//         const map = mapRef.current;
//         const raf = requestAnimationFrame(() => {
//             map.invalidateSize();
//         });
//         return () => cancelAnimationFrame(raf);
//     }, [isActive]);

//     // Add flyover layers to map
//     const addFlyoverLayers = useCallback((map) => {
//         if (!flyovers || flyovers.length === 0) return;

//         // Clear existing flyover layers
//         Object.values(flyoverLayersRef.current).forEach(layer => {
//             if (map.hasLayer(layer)) {
//                 map.removeLayer(layer);
//             }
//         });
//         flyoverLayersRef.current = {};

//         // Clear existing markers
//         flyoverMarkersRef.current.forEach(marker => {
//             if (map.hasLayer(marker)) {
//                 map.removeLayer(marker);
//             }
//         });
//         flyoverMarkersRef.current = [];

//         flyovers.forEach((flyover, index) => {
//             const color = getFlyoverColor(index);
//             const displayName = getFlyoverDisplayName(flyover.type, index);

//             // Add flyover GeoJSON layer
//             if (flyover.geojson) {
//                 const layer = L.geoJSON(flyover.geojson, {
//                     style: {
//                         color: color,
//                         weight: 3,
//                         opacity: 0.8,
//                         fillColor: color,
//                         fillOpacity: 0.2,
//                     },
//                 }).addTo(map);

//                 flyoverLayersRef.current[flyover.id] = layer;

//                 // Add click handler to select flyover
//                 // layer.on('click', () => {
//                 //     console.log(`Selected ${displayName}`);
//                 // });
//             }

//             // Add markers for named points comming from geojsonParser.js
//             if (flyover.namedPoints && flyover.namedPoints.length > 0) {
//                 flyover.namedPoints.forEach((point) => {
//                     const pointName = formatPointName(point.name);
//                     const icon = makeFlyoverIcon({
//                         color: color,
//                         labelText: pointName,
//                         detailed: false,
//                         name: pointName,
//                         detailFields: [],
//                     });

//                     const marker = L.marker(point.latlng, {
//                         icon: icon,
//                         riseOnHover: true,
//                     }).addTo(map);

//                     // Add popup with point details
//                     marker.bindPopup(`
//                         <div style="padding: 8px; font-family: Arial, sans-serif;">
//                             <h4 style="margin: 0 0 4px 0; color: ${color};">${pointName}</h4>
//                             ${point.chainage ? `<p style="margin: 2px 0; font-size: 11px;"><strong>Chainage:</strong> ${point.chainage}</p>` : ''}
//                             ${point.description ? `<p style="margin: 2px 0; font-size: 11px;"><strong>Type:</strong> ${point.description}</p>` : ''}
//                             ${point.length ? `<p style="margin: 2px 0; font-size: 11px;"><strong>Length:</strong> ${point.length}</p>` : ''}
//                             ${point.detail ? `<p style="margin: 2px 0; font-size: 11px;"><strong>Structure:</strong> ${point.detail}</p>` : ''}
//                         </div>
//                     `);

//                     flyoverMarkersRef.current.push(marker);
//                 });
//             }
//         });


//     }, [flyovers]);

//     // Initialize map and add layers
//     useEffect(() => {
//         // Clean up previous map instance
//         if (mapRef.current) {
//             mapRef.current.remove();
//             mapRef.current = null;
//         }

//         if (!mapContainerRef.current) return;

//         // Create map
//         const map = L.map(mapContainerRef.current, {
//             center: mapCenter,
//             zoom: SOIL_MAP_ZOOM,
//             zoomControl: true,
//             attributionControl: false,
//         });

//         // Base layers
//         const streetLayer = L.tileLayer("https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
//             subdomains: ["mt0", "mt1", "mt2", "mt3"],
//             maxZoom: 20,
//             attribution: "",
//         });

//         const satelliteLayer = L.tileLayer("https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
//             subdomains: ["mt0", "mt1", "mt2", "mt3"],
//             maxZoom: 20,
//             attribution: "",
//         });

//         streetLayer.addTo(map);
//         L.control.attribution({ position: "bottomright", prefix: false }).addTo(map);
//         L.control.layers(
//             { "Streets": streetLayer, "Satellite": satelliteLayer },
//             null,
//             { position: 'topleft', collapsed: true }
//         ).addTo(map);

//         mapRef.current = map;
//         isViewSetRef.current = false;

//         // If data is already loaded, add GeoJSON layer
//         if (soilDataRef.current) {
//             if (geoJsonLayerRef.current) {
//                 map.removeLayer(geoJsonLayerRef.current);
//             }
//             geoJsonLayerRef.current = L.geoJSON(soilDataRef.current, {
//                 style: soilStyle,
//                 onEachFeature: onEachSoilFeature,
//             }).addTo(map);

//             try {
//                 const bounds = geoJsonLayerRef.current.getBounds();
//                 if (bounds.isValid()) {
//                     map.setView(bounds.getCenter(), SOIL_MAP_ZOOM, { animate: false });
//                     isViewSetRef.current = true;
//                 }
//             } catch (e) {
//                 console.warn('Could not set view:', e);
//             }
//         }

//         // Add flyover layers after a delay
//         setTimeout(() => {
//             if (mapRef.current && flyovers && flyovers.length > 0) {
//                 addFlyoverLayers(mapRef.current);
//             }
//         }, 500);

//         // Invalidate size after a delay to ensure proper rendering
//         setTimeout(() => {
//             map.invalidateSize();
//         }, 100);

//         // Handle resize
//         const resizeObserver = new ResizeObserver(() => {
//             map.invalidateSize();
//         });
//         if (mapContainerRef.current) {
//             resizeObserver.observe(mapContainerRef.current);
//         }

//         return () => {
//             resizeObserver.disconnect();
//             if (mapRef.current) {
//                 mapRef.current.remove();
//                 mapRef.current = null;
//             }
//         };
//     }, [mapCenter, soilData, flyovers, addFlyoverLayers]);

//     // Update GeoJSON layer when data changes
//     useEffect(() => {
//         if (!mapRef.current || !soilData) return;

//         if (geoJsonLayerRef.current) {
//             mapRef.current.removeLayer(geoJsonLayerRef.current);
//         }

//         geoJsonLayerRef.current = L.geoJSON(soilData, {
//             style: soilStyle,
//             onEachFeature: onEachSoilFeature,
//         }).addTo(mapRef.current);

//         try {
//             const bounds = geoJsonLayerRef.current.getBounds();
//             if (bounds.isValid()) {
//                 mapRef.current.setView(bounds.getCenter(), SOIL_MAP_ZOOM, { animate: false });
//                 isViewSetRef.current = true;
//             }
//         } catch (e) {
//             console.warn('Could not set view:', e);
//         }

//         mapRef.current.invalidateSize();
//     }, [soilData]);

//     return (
//         <div className="flex flex-col h-full" ref={fullscreenContainerRef}>
//             <div className="flex-1 min-h-0 relative rounded-lg overflow-hidden border border-gray-200">
//                 <div ref={mapContainerRef} className="absolute inset-0" />

//                 {!loading && !error && soilData && <SoilLegend taxoValues={taxoValues} />}

//                 <div className="absolute top-3 right-3 z-[500]">
//                     <FullscreenButton isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
//                 </div>

//                 {(loading || flyoversLoading) && (
//                     <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-[500]">
//                         <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-xl shadow-lg border border-gray-200">
//                             <Loader2 size={32} className="text-emerald-600 animate-spin" />
//                             <p className="text-sm text-gray-700 font-medium">
//                                 {loading ? "Loading soil data..." : "Loading flyover data..."}
//                             </p>
//                         </div>
//                     </div>
//                 )}

//                 {error && (
//                     <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-center gap-2 shadow-lg max-w-md">
//                         <AlertTriangle size={16} className="flex-shrink-0" />
//                         <span>{error}</span>
//                     </div>
//                 )}
//             </div>
//         </div>
//     );
// }





