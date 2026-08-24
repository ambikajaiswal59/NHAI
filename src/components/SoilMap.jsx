// src/components/SoilMap.jsx
import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Loader2, AlertTriangle, Maximize, Minimize, Layers, X } from "lucide-react";
import { useFlyoverData } from "../hooks/useFlyoverData";
import {
    getFlyoverColor,
    getFlyoverDisplayName,
    makeFlyoverIcon,
    formatPointName,
} from "./map/mapHelpers";

// Add these constants
const DEFAULT_SOIL_MAP_CENTER = [30.3, 76.7];
const MIN_ZOOM = 9;
const MAX_ZOOM = 17;
const DEFAULT_ZOOM = 10;

const SOIL_TAXO_COLORS = {
    "Fluventic Ustochrepts": "#4CAF50",
    "Natric Ustochrepts": "#FF5722",
    "Typic Haplustalfs": "#C6CE3D",
    "Typic Ustifluvents": "#4472C4",
    "Typic Ustochrepts": "#9C27B0",
    "Udic Ustochrepts": "#26C6DA",
};
const DEFAULT_SOIL_COLOR = "#9E9E9E";

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

    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const geoJsonLayerRef = useRef(null);
    const soilDataRef = useRef(null);
    const streetLayerRef = useRef(null);
    const satelliteLayerRef = useRef(null);
    const flyoverLayersRef = useRef([]);
    const flyoverMarkersRef = useRef([]);
    const flyoversAddedRef = useRef(false);
    const isMapReadyRef = useRef(false);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [soilData, setSoilData] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [taxoValues, setTaxoValues] = useState([]);
    const [isLayerAdded, setIsLayerAdded] = useState(false);

    // Layer Control States
    const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);
    const [activeLayers, setActiveLayers] = useState(['flyover']);
    const [baseLayer, setBaseLayer] = useState('streets');

    // Mobile state
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    const { flyovers, loading: flyoversLoading } = useFlyoverData();

    const fullscreenContainerRef = useRef(null);

    // Define available layers
    const availableLayers = [
        {
            id: 'flyover',
            name: 'Flyover',
            color: '#3B82F6',
            icon: true,
            type: 'overlay'
        },
    ];

    // Track mobile breakpoint
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // Handle layer toggling
    const handleLayerToggle = useCallback((layerId) => {
        setActiveLayers(prev => {
            if (prev.includes(layerId)) {
                return prev.filter(id => id !== layerId);
            } else {
                return [...prev, layerId];
            }
        });
    }, []);

    // Handle base layer change
    const handleBaseLayerChange = useCallback((layerType) => {
        setBaseLayer(layerType);
        if (!mapRef.current) return;

        try {
            if (layerType === 'streets') {
                if (satelliteLayerRef.current && mapRef.current.hasLayer(satelliteLayerRef.current)) {
                    mapRef.current.removeLayer(satelliteLayerRef.current);
                }
                if (streetLayerRef.current && !mapRef.current.hasLayer(streetLayerRef.current)) {
                    mapRef.current.addLayer(streetLayerRef.current);
                }
            } else if (layerType === 'satellite') {
                if (streetLayerRef.current && mapRef.current.hasLayer(streetLayerRef.current)) {
                    mapRef.current.removeLayer(streetLayerRef.current);
                }
                if (satelliteLayerRef.current && !mapRef.current.hasLayer(satelliteLayerRef.current)) {
                    mapRef.current.addLayer(satelliteLayerRef.current);
                }
            }
        } catch (err) {
            console.error("[SoilMap] Error switching base layer:", err);
        }
    }, []);

    // Update layer visibility based on active layers
    const updateLayerVisibility = useCallback(() => {
        if (!mapRef.current) return;

        // Handle flyover layer visibility
        if (activeLayers.includes('flyover')) {
            // Show flyover layers
            flyoverLayersRef.current.forEach(layer => {
                if (!mapRef.current.hasLayer(layer)) {
                    mapRef.current.addLayer(layer);
                }
            });
            flyoverMarkersRef.current.forEach(marker => {
                if (!mapRef.current.hasLayer(marker)) {
                    mapRef.current.addLayer(marker);
                }
            });
        } else {
            // Hide flyover layers
            flyoverLayersRef.current.forEach(layer => {
                if (mapRef.current.hasLayer(layer)) {
                    mapRef.current.removeLayer(layer);
                }
            });
            flyoverMarkersRef.current.forEach(marker => {
                if (mapRef.current.hasLayer(marker)) {
                    mapRef.current.removeLayer(marker);
                }
            });
        }
    }, [activeLayers]);

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
                try {
                    if (mapRef.current && mapContainerRef.current) {
                        if (document.contains(mapContainerRef.current)) {
                            mapRef.current.invalidateSize();
                            if (geoJsonLayerRef.current) {
                                try {
                                    const bounds = geoJsonLayerRef.current.getBounds();
                                    if (bounds.isValid()) {
                                        mapRef.current.setView(bounds.getCenter(), DEFAULT_ZOOM, { animate: false });
                                    }
                                } catch (e) {
                                    console.warn('Could not set view:', e);
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error("[SoilMap] Error during fullscreen change:", err);
                }
            }, 200);
        };
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, []);

    const toggleFullscreen = useCallback(() => {
        try {
            if (!document.fullscreenElement) {
                fullscreenContainerRef.current?.requestFullscreen?.();
            } else {
                document.exitFullscreen?.();
            }
        } catch (err) {
            console.error("[SoilMap] Error toggling fullscreen:", err);
        }
    }, []);

    useEffect(() => {
        if (!isActive || !mapRef.current) return;
        const map = mapRef.current;
        const raf = requestAnimationFrame(() => {
            try {
                if (mapRef.current && mapContainerRef.current) {
                    if (document.contains(mapContainerRef.current)) {
                        map.invalidateSize();
                    }
                }
            } catch (err) {
                console.error("[SoilMap] Error invalidating size on active:", err);
            }
        });
        return () => cancelAnimationFrame(raf);
    }, [isActive]);

    // Update visibility when activeLayers change
    useEffect(() => {
        if (mapRef.current && isMapReadyRef.current) {
            updateLayerVisibility();
        }
    }, [activeLayers, updateLayerVisibility]);

    // ---- Add flyover layers (same pattern as Flood component) ----
    const addFlyoverLayers = useCallback((map) => {
        if (!flyovers || flyovers.length === 0) {
            return;
        }

        if (flyoversAddedRef.current) {
            return;
        }

        try {
            // Clear existing layers
            flyoverLayersRef.current.forEach(layer => {
                try {
                    if (map.hasLayer(layer)) {
                        map.removeLayer(layer);
                    }
                } catch (err) {
                    console.error("[SoilMap] Error removing flyover layer:", err);
                }
            });
            flyoverLayersRef.current = [];

            flyoverMarkersRef.current.forEach(marker => {
                try {
                    if (map.hasLayer(marker)) {
                        map.removeLayer(marker);
                    }
                } catch (err) {
                    console.error("[SoilMap] Error removing flyover marker:", err);
                }
            });
            flyoverMarkersRef.current = [];

            flyovers.forEach((flyover, index) => {
                try {
                    const color = getFlyoverColor(index);
                    const displayName = getFlyoverDisplayName(flyover.type, index);

                    if (flyover.geojson) {
                        try {
                            const layer = L.geoJSON(flyover.geojson, {
                                style: {
                                    color: color,
                                    weight: 3,
                                    opacity: 0.8,
                                    fillColor: color,
                                    fillOpacity: 0.2,
                                },
                                zIndex: 20,
                            });

                            flyoverLayersRef.current.push(layer);
                        } catch (err) {
                            console.error(`[SoilMap] Error adding flyover layer for ${displayName}:`, err);
                        }
                    }

                    if (flyover.namedPoints && flyover.namedPoints.length > 0) {
                        flyover.namedPoints.forEach((point) => {
                            try {
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
                                    zIndexOffset: 100,
                                });

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
                            } catch (err) {
                                console.error(`[SoilMap] Error adding marker for ${point.name}:`, err);
                            }
                        });
                    }
                } catch (err) {
                    console.error(`[SoilMap] Error processing flyover ${index}:`, err);
                }
            });

            flyoversAddedRef.current = true;

            // Apply visibility based on active layers
            updateLayerVisibility();
        } catch (err) {
            console.error("[SoilMap] Error in addFlyoverLayers:", err);
        }
    }, [flyovers, updateLayerVisibility]);

    // ---- Initialize map exactly once ----
    useEffect(() => {
        if (!mapContainerRef.current) return;

        if (mapRef.current) {
            try {
                mapRef.current.remove();
                mapRef.current = null;
            } catch (err) {
                console.error("[SoilMap] Error removing existing map:", err);
            }
            setIsLayerAdded(false);
            isMapReadyRef.current = false;
        }

        try {
            const map = L.map(mapContainerRef.current, {
                center: mapCenter,
                zoom: DEFAULT_ZOOM,
                minZoom: MIN_ZOOM,
                maxZoom: MAX_ZOOM,
                zoomControl: true,
                attributionControl: false,
            });

            // Google Streets Base Layer
            const streetLayer = L.tileLayer("https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
                subdomains: ["mt0", "mt1", "mt2", "mt3"],
                maxZoom: 20,
                attribution: "",
            });

            // Google Satellite Base Layer
            const satelliteLayer = L.tileLayer("https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
                subdomains: ["mt0", "mt1", "mt2", "mt3"],
                maxZoom: 20,
                attribution: "",
            });

            // Store references
            streetLayerRef.current = streetLayer;
            satelliteLayerRef.current = satelliteLayer;

            // Add Google Streets as base (default)
            streetLayer.addTo(map);

            // Add Soil Layer
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
                        map.setView(bounds.getCenter(), DEFAULT_ZOOM, { animate: false });
                    }
                } catch (e) {
                    console.warn('Could not set view:', e);
                }
            }

            // Attribution
            L.control.attribution({ position: "bottomright", prefix: false }).addTo(map);

            mapRef.current = map;
            isMapReadyRef.current = true;
            setIsLayerAdded(true);
            flyoversAddedRef.current = false;

            // Force map to render correctly
            setTimeout(() => {
                try {
                    if (mapRef.current && mapContainerRef.current) {
                        if (document.contains(mapContainerRef.current)) {
                            mapRef.current.invalidateSize();
                        }
                    }
                } catch (err) {
                    console.error("[SoilMap] Error invalidating map size:", err);
                }
            }, 100);

            // Resize observer
            const resizeObserver = new ResizeObserver(() => {
                try {
                    if (mapRef.current && mapContainerRef.current) {
                        if (document.contains(mapContainerRef.current)) {
                            mapRef.current.invalidateSize();
                        }
                    }
                } catch (err) {
                    console.error("[SoilMap] Error in resize observer:", err);
                }
            });
            if (mapContainerRef.current) {
                resizeObserver.observe(mapContainerRef.current);
            }

            // Add flyovers after map is ready
            if (flyovers && flyovers.length > 0) {
                setTimeout(() => {
                    try {
                        addFlyoverLayers(map);
                    } catch (err) {
                        console.error("[SoilMap] Error adding flyover layers:", err);
                    }
                }, 300);
            }

            return () => {
                try {
                    resizeObserver.disconnect();
                    if (mapRef.current) {
                        mapRef.current.remove();
                        mapRef.current = null;
                    }
                } catch (err) {
                    console.error("[SoilMap] Error during cleanup:", err);
                }
                setIsLayerAdded(false);
                flyoversAddedRef.current = false;
                isMapReadyRef.current = false;
            };

        } catch (err) {
            console.error("[SoilMap] Error initializing map:", err);
            setError("Failed to initialize map. Please try again.");
            setLoading(false);
        }
    }, [mapCenter]);

    // ---- Handle active state ----
    useEffect(() => {
        if (!mapRef.current || !isMapReadyRef.current) return;

        if (!isActive) {
            try {
                flyoverLayersRef.current.forEach(layer => {
                    if (mapRef.current.hasLayer(layer)) {
                        mapRef.current.removeLayer(layer);
                    }
                });
                flyoverLayersRef.current = [];

                flyoverMarkersRef.current.forEach(marker => {
                    if (mapRef.current.hasLayer(marker)) {
                        mapRef.current.removeLayer(marker);
                    }
                });
                flyoverMarkersRef.current = [];

                flyoversAddedRef.current = false;
            } catch (err) {
                console.error("[SoilMap] Error removing layers on inactive:", err);
            }
            return;
        }

        if (isActive && !flyoversAddedRef.current && flyovers && flyovers.length > 0) {
            try {
                addFlyoverLayers(mapRef.current);
            } catch (err) {
                console.error("[SoilMap] Error adding layers on active:", err);
            }
        }
    }, [isActive, flyovers, addFlyoverLayers]);

    // ---- Add flyovers when flyover data changes ----
    useEffect(() => {
        if (!mapRef.current || !isActive) return;
        if (!flyovers || flyovers.length === 0) return;

        flyoversAddedRef.current = false;
        try {
            addFlyoverLayers(mapRef.current);
        } catch (err) {
            console.error("[SoilMap] Error adding flyovers on data change:", err);
        }
    }, [flyovers, isActive, addFlyoverLayers]);

    // ---- Handle soil data updates ----
    useEffect(() => {
        if (!mapRef.current || !soilData || !isMapReadyRef.current) return;

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
                mapRef.current.setView(bounds.getCenter(), DEFAULT_ZOOM, { animate: false });
            }
        } catch (e) {
            console.warn('Could not set view:', e);
        }

        mapRef.current.invalidateSize();
    }, [soilData]);

    return (
        <div className="flex flex-col h-full w-full" ref={fullscreenContainerRef}>
            <div
                className="flex-1 min-h-0 relative rounded-lg overflow-hidden border border-gray-200"
                style={{
                    height: isMobile ? "400px" : "100%",
                    minHeight: isMobile ? "350px" : "auto",
                }}
            >
                <div ref={mapContainerRef} className="absolute inset-0" />

                {isLayerAdded && soilData && <SoilLegend taxoValues={taxoValues} />}

                {/* Layer Control - Click to open/close */}
                {isLayerAdded && soilData && (
                    <div
                        className="absolute left-2.5 z-[500]"
                        style={{ top: isMobile ? '140px' : '80px' }}
                    >
                        {/* Layer Control Button */}
                        <button
                            onClick={() => setIsLayerPanelOpen(!isLayerPanelOpen)}
                            className={`
                                flex items-center justify-center w-[34px] h-[34px] 
                                bg-white rounded-[4px] border-2
                                transition-all duration-200 hover:bg-gray-50
                                ${isLayerPanelOpen
                                    ? 'border-blue-500 bg-blue-50 text-blue-600'
                                    : 'border-gray-400 text-gray-700 hover:border-gray-500'
                                }
                                focus:outline-none focus:ring-0
                                leaflet-bar
                            `}
                            style={{
                                boxShadow: '0 1px 5px rgba(0,0,0,0.1)',
                            }}
                            aria-label="Toggle layer control"
                            title="Layer Control"
                        >
                            <Layers size={22} />
                        </button>

                        {/* Layer Control Panel */}
                        {isLayerPanelOpen && (
                            <div
                                className={`
                                    absolute top-0 left-full ml-2 bg-white rounded-[4px] border-2 border-gray-300
                                    p-3 min-w-[120px] max-w-[150px]
                                    ${isMobile ? 'min-w-[120px]' : ''}
                                    shadow-lg
                                `}
                                style={{
                                    boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
                                }}
                            >
                                {/* Panel header */}
                                <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200">
                                    <h3 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                                        Layers
                                    </h3>
                                    <button
                                        onClick={() => setIsLayerPanelOpen(false)}
                                        className="text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full p-0.5 transition-all duration-200"
                                    >
                                        <X size={16} strokeWidth={3} />
                                    </button>
                                </div>

                                {/* Base Layer Section - Radio buttons */}
                                <div className="mb-2 pb-2 border-b border-gray-100">
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Base Map</p>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:text-blue-600 transition-colors">
                                            <input
                                                type="radio"
                                                name="baseLayer"
                                                checked={baseLayer === 'streets'}
                                                onChange={() => handleBaseLayerChange('streets')}
                                                className="w-3.5 h-3.5 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                            />
                                            <span className="flex items-center gap-1.5">
                                                Streets
                                            </span>
                                        </label>
                                        <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:text-blue-600 transition-colors">
                                            <input
                                                type="radio"
                                                name="baseLayer"
                                                checked={baseLayer === 'satellite'}
                                                onChange={() => handleBaseLayerChange('satellite')}
                                                className="w-3.5 h-3.5 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                            />
                                            <span className="flex items-center gap-1.5">
                                                Satellite
                                            </span>
                                        </label>
                                    </div>
                                </div>

                                {/* Overlay Layers Section - Checkboxes */}
                                <div>
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Overlays</p>
                                    <div className="flex flex-col gap-1.5">
                                        {availableLayers.filter(l => l.type === 'overlay').map((layer) => (
                                            <label
                                                key={layer.id}
                                                className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:text-blue-600 transition-colors group"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={activeLayers.includes(layer.id)}
                                                    onChange={() => handleLayerToggle(layer.id)}
                                                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer transition-all duration-200"
                                                />
                                                <span className="flex items-center gap-1.5">
                                                    {layer.name}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Fullscreen Button */}
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