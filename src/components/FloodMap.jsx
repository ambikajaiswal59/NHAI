// src/components/FloodMap.jsx
import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Loader2, AlertTriangle, Maximize, Minimize, Droplets } from "lucide-react";
import { useFlyoverData } from "../hooks/useFlyoverData";
import {
    getFlyoverColor,
    getFlyoverDisplayName,
    makeFlyoverIcon,
    formatPointName,
} from "./map/mapHelpers";

const DEBUG = true;
const log = (...args) => DEBUG && console.log("[FloodMap]", ...args);
const logError = (...args) => console.error("[FloodMap]", ...args);

// WMS Configuration
const WMS_URL = "https://mlinfomap.biz/geoserver/NHAI/wms";
const WMS_LAYER = "2017";
const DEFAULT_FLOOD_MAP_CENTER = [30.3, 76.7];

const FLOOD_COLORS = {
    value1: { color: [240, 240, 240], label: "Low" },
    value2: { color: [180, 180, 180], label: "Moderate" },
    value3: { color: [120, 120, 120], label: "High" },
    value4: { color: [60, 60, 60], label: "Very High" },
    value5: { color: [20, 20, 20], label: "Extreme" },
};

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

function FloodLegend() {
    return (
        <div className="absolute bottom-3 right-3 z-[500] bg-white/95 backdrop-blur-sm rounded-md shadow-md border border-gray-200 px-3 py-2 max-w-[180px]">
            <div className="text-[11px] font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <Droplets size={14} className="text-blue-500" />
                Flood Risk
            </div>
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm flex-shrink-0 border border-gray-200" style={{ backgroundColor: `rgb(${FLOOD_COLORS.value1.color.join(',')})` }} />
                    <span className="text-[10px] text-gray-600 leading-tight">Low</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm flex-shrink-0 border border-gray-200" style={{ backgroundColor: `rgb(${FLOOD_COLORS.value2.color.join(',')})` }} />
                    <span className="text-[10px] text-gray-600 leading-tight">Moderate</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm flex-shrink-0 border border-gray-200" style={{ backgroundColor: `rgb(${FLOOD_COLORS.value3.color.join(',')})` }} />
                    <span className="text-[10px] text-gray-600 leading-tight">High</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm flex-shrink-0 border border-gray-200" style={{ backgroundColor: `rgb(${FLOOD_COLORS.value4.color.join(',')})` }} />
                    <span className="text-[10px] text-gray-600 leading-tight">Very High</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm flex-shrink-0 border border-gray-200" style={{ backgroundColor: `rgb(${FLOOD_COLORS.value5.color.join(',')})` }} />
                    <span className="text-[10px] text-gray-600 leading-tight">Extreme</span>
                </div>
            </div>
        </div>
    );
}

export default function FloodMap({ mapCenter = DEFAULT_FLOOD_MAP_CENTER, isActive = true }) {
    const FLOOD_MAP_ZOOM = 10;

    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const floodLayerRef = useRef(null);
    const flyoverLayersRef = useRef([]);
    const flyoverMarkersRef = useRef([]);
    const flyoversAddedRef = useRef(false);
    const isMapReadyRef = useRef(false);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isLayerAdded, setIsLayerAdded] = useState(false);

    const { flyovers, loading: flyoversLoading } = useFlyoverData();

    const fullscreenContainerRef = useRef(null);

    // ---- Initialize map exactly once ----
    useEffect(() => {
        if (!mapContainerRef.current) return;

        if (mapRef.current) {
            mapRef.current.remove();
            mapRef.current = null;
            setIsLayerAdded(false);
            isMapReadyRef.current = false;
        }

        log("🗺️ Initializing Flood map");

        const map = L.map(mapContainerRef.current, {
            //  crs: L.CRS.EPSG4326,
            center: mapCenter,
            zoom: FLOOD_MAP_ZOOM,
            zoomControl: true,
            attributionControl: false,
        });

        // Base layers
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
        L.tileLayer(
            "http://192.168.1.28:8877/tiles/{z}/{x}/{y}.png",
            {

            }
        ).addTo(map);

        // ✅ FIX: Add street layer FIRST
        streetLayer.addTo(map);

        // ✅ Then add WMS Raster Layer on top
        const rasterLayer = L.tileLayer.wms(
            WMS_URL,
            {
                layers: WMS_LAYER,
                format: "image/png",
                transparent: true,
                opacity: 1,
                // Add zIndex to ensure it's on top
                zIndex: 10,
                // Add version and SRS for better compatibility
                version: "1.1.0",
                // srs: "EPSG:4326",

            }
        );

        rasterLayer.addTo(map);

        // Store reference for debugging
        floodLayerRef.current = rasterLayer;

        L.control.attribution({ position: "bottomright", prefix: false }).addTo(map);
        L.control.layers(
            { "Streets": streetLayer, "Satellite": satelliteLayer },
            null,
            { position: 'topleft', collapsed: true }
        ).addTo(map);

        mapRef.current = map;
        isMapReadyRef.current = true;
        setIsLayerAdded(true);
        setLoading(false);
        flyoversAddedRef.current = false;

        // Force map to render correctly
        setTimeout(() => {
            map.invalidateSize();
        }, 100);

        const resizeObserver = new ResizeObserver(() => {
            map.invalidateSize();
        });
        if (mapContainerRef.current) {
            resizeObserver.observe(mapContainerRef.current);
        }

        // Add flyovers after map is ready
        if (flyovers && flyovers.length > 0) {
            log("🛣️ Adding flyovers on map init");
            setTimeout(() => {
                addFlyoverLayers(map);
            }, 300);
        }

        return () => {
            resizeObserver.disconnect();
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
            setIsLayerAdded(false);
            flyoversAddedRef.current = false;
            isMapReadyRef.current = false;
        };
    }, [mapCenter]);

    // ---- Add flyover layers ----
    const addFlyoverLayers = useCallback((map) => {
        if (!flyovers || flyovers.length === 0) {
            log("ℹ️ No flyovers to add");
            return;
        }

        if (flyoversAddedRef.current) {
            log("ℹ️ Flyovers already added");
            return;
        }

        log(`🛣️ Adding ${flyovers.length} flyover layers...`);

        // Clear existing layers
        flyoverLayersRef.current.forEach(layer => {
            if (map.hasLayer(layer)) {
                map.removeLayer(layer);
            }
        });
        flyoverLayersRef.current = [];

        flyoverMarkersRef.current.forEach(marker => {
            if (map.hasLayer(marker)) {
                map.removeLayer(marker);
            }
        });
        flyoverMarkersRef.current = [];

        flyovers.forEach((flyover, index) => {
            const color = getFlyoverColor(index);
            const displayName = getFlyoverDisplayName(flyover.type, index);

            log(`  📍 Adding flyover ${index + 1}: ${displayName}`);

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
                        // Ensure flyovers are on top of raster
                        zIndex: 20,
                    });

                    layer.addTo(map);
                    flyoverLayersRef.current.push(layer);
                    log(`    ✅ GeoJSON layer added`);
                } catch (err) {
                    logError(`Error adding flyover layer for ${displayName}:`, err);
                }
            }

            if (flyover.namedPoints && flyover.namedPoints.length > 0) {
                log(`    📍 Adding ${flyover.namedPoints.length} markers`);
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
                            zIndexOffset: 100, // Ensure markers are on top
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

                        marker.addTo(map);
                        flyoverMarkersRef.current.push(marker);
                    } catch (err) {
                        logError(`Error adding marker for ${point.name}:`, err);
                    }
                });
            }
        });

        flyoversAddedRef.current = true;
        log(`✅ Added ${flyovers.length} flyover layers with ${flyoverMarkersRef.current.length} markers`);
    }, [flyovers]);

    // ---- Handle active state ----
    useEffect(() => {
        if (!mapRef.current || !isMapReadyRef.current) return;

        // When inactive, remove everything EXCEPT the base raster layer
        if (!isActive) {
            log("🔴 Flood inactive - removing flyovers only");

            // Remove only flyovers, keep the WMS raster layer
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
            return;
        }

        // When active, add flyovers if not present
        if (isActive && !flyoversAddedRef.current && flyovers && flyovers.length > 0) {
            log("🟢 Flood active - adding flyovers");
            addFlyoverLayers(mapRef.current);
        }
    }, [isActive, flyovers, addFlyoverLayers]);

    // ---- Add flyovers when flyover data changes ----
    useEffect(() => {
        if (!mapRef.current || !isActive) return;
        if (!flyovers || flyovers.length === 0) return;

        flyoversAddedRef.current = false;
        addFlyoverLayers(mapRef.current);
    }, [flyovers, isActive, addFlyoverLayers]);

    // ---- Force resize when active ----
    useEffect(() => {
        if (!isActive || !mapRef.current) return;
        const map = mapRef.current;

        const raf = requestAnimationFrame(() => {
            map.invalidateSize();
        });

        return () => cancelAnimationFrame(raf);
    }, [isActive]);

    // ---- Fullscreen handler ----
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
            setTimeout(() => {
                if (mapRef.current) {
                    mapRef.current.invalidateSize();
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

    return (
        <div className="flex flex-col h-full" ref={fullscreenContainerRef}>
            <div className="flex-1 min-h-0 relative rounded-lg overflow-hidden border border-gray-200">
                <div ref={mapContainerRef} className="absolute inset-0" />

                {isLayerAdded && <FloodLegend />}

                <div className="absolute top-3 right-3 z-[500]">
                    <FullscreenButton isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
                </div>

                {(loading || flyoversLoading) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-[500]">
                        <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                            <Loader2 size={32} className="text-blue-600 animate-spin" />
                            <p className="text-sm text-gray-700 font-medium">
                                {loading ? "Loading flood data..." : "Loading flyover data..."}
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