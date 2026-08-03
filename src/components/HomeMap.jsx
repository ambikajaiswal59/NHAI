// src/components/HomeMap.jsx
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
    MapContainer,
    TileLayer,
    GeoJSON,
    useMap,
    LayersControl,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, X } from "lucide-react";

import { loadFlyoverData } from "../utils/geoJsonParser";
import indiaBoundaryData from "../data/indiaBoundary.json";
import { createIDWLayer } from "../components/IDWLeafletLayer";

// ============================================================
// INTERNAL HELPER COMPONENTS
// ============================================================

const INDIA_CENTER = [22.9734, 78.6569];
const INDIA_ZOOM = 6;

function ZoomToLayer({ data, onZoomComplete, extraZoom = 1 }) {
    const map = useMap();

    useEffect(() => {
        if (!data || data.features.length === 0) return;

        const layer = L.geoJSON(data);
        const bounds = layer.getBounds();

        if (bounds.isValid()) {
            map.once("moveend", () => {
                map.setZoom(map.getZoom() + extraZoom, { animate: true });
                onZoomComplete && onZoomComplete();
            });

            map.flyToBounds(bounds, {
                padding: [2, 2],
                maxZoom: 15,
                duration: 1.2,
            });
        }
    }, [data, map, onZoomComplete, extraZoom]);

    return null;
}

function FadeInGeoJSON({ data, style, targetOpacity = 1, targetFillOpacity, ...rest }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const raf = requestAnimationFrame(() => setVisible(true));
        return () => cancelAnimationFrame(raf);
    }, [data]);

    const computedStyle = (feature) => {
        const base = typeof style === "function" ? style(feature) : style || {};
        return {
            ...base,
            opacity: visible ? (base.opacity ?? targetOpacity) : 0,
            fillOpacity: visible
                ? (base.fillOpacity ?? targetFillOpacity ?? 0)
                : 0,
        };
    };

    return <GeoJSON data={data} style={computedStyle} {...rest} />;
}

// ============================================================
// MAP DETAILS PANEL
// ============================================================

function MapDetailsPanel({ selectedFeature, onClear }) {
    if (!selectedFeature) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-2">
                <div className="w-11 h-11 rounded-full bg-blue-50 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-blue-400" />
                </div>
                <p className="text-sm font-semibold text-gray-600">No selection yet</p>
                <p className="text-[12px] text-gray-400 max-w-[220px]">
                    Click a flyover marker or line on the map to see its details here.
                </p>
            </div>
        );
    }

    const props = selectedFeature.properties || {};
    const name = props.name || props.flyover_name || props.NAME || "Selected Feature";
    const entries = Object.entries(props).filter(
        ([key]) => !["name", "flyover_name", "NAME"].includes(key)
    );

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2 min-w-0">
                    <MapPin className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <h3 className="text-sm font-bold text-gray-900 truncate">{name}</h3>
                </div>
                <button
                    onClick={onClear}
                    className="p-1 rounded-md hover:bg-gray-100 flex-shrink-0"
                    aria-label="Clear selection"
                >
                    <X className="w-4 h-4 text-gray-400" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
                {entries.length === 0 ? (
                    <p className="text-[12px] text-gray-400">No additional properties available.</p>
                ) : (
                    entries.map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between gap-3 text-[12px]">
                            <span className="text-gray-500 capitalize truncate">
                                {key.replace(/_/g, " ")}
                            </span>
                            <span className="font-semibold text-gray-800 text-right truncate">
                                {String(value)}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

// ============================================================
// WEATHER CONTROLS - INTERNAL COMPONENT
// ============================================================

function WeatherControls({
    selectedDate,
    onDateChange,
    selectedLayer,
    onLayerChange,
    isLoading,
    dataCount,
    error
}) {
    // Get dates for Today, Tomorrow, Day After Tomorrow
    const getDates = useCallback(() => {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dayAfterTomorrow = new Date(today);
        dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

        const formatDate = (date) => date.toISOString().split('T')[0];

        return {
            today: formatDate(today),
            tomorrow: formatDate(tomorrow),
            dayAfterTomorrow: formatDate(dayAfterTomorrow)
        };
    }, []);

    const dates = useMemo(getDates, []);

    return (
        <div className="bg-white rounded-xl shadow-card p-3 mb-3">
            <div className="flex flex-wrap items-center gap-3">
                {/* Date Selection */}
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700">Date:</label>
                    <div className="flex gap-1.5">
                        <button
                            onClick={() => onDateChange(dates.today)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedDate === dates.today
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            Today
                        </button>
                        <button
                            onClick={() => onDateChange(dates.tomorrow)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedDate === dates.tomorrow
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            Tomorrow
                        </button>
                        <button
                            onClick={() => onDateChange(dates.dayAfterTomorrow)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedDate === dates.dayAfterTomorrow
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            Day After
                        </button>
                    </div>
                </div>

                {/* Layer Selection */}
                <div className="flex gap-2">
                    <button
                        onClick={() => onLayerChange('rainfall')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedLayer === 'rainfall'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        🌧️ Rainfall
                    </button>
                    <button
                        onClick={() => onLayerChange('wind')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedLayer === 'wind'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        💨 Wind
                    </button>
                    <button
                        onClick={() => onLayerChange('temperature')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedLayer === 'temperature'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        🌡️ Temperature
                    </button>
                </div>

                {/* Status Indicators */}
                {isLoading && (
                    <span className="text-sm text-blue-600 animate-pulse">
                        Loading weather data...
                    </span>
                )}
                {error && (
                    <span className="text-sm text-red-600">
                        Error: {error}
                    </span>
                )}
                {!isLoading && dataCount > 0 && (
                    <span className="text-sm text-green-600">
                        ✅ {dataCount} weather stations loaded
                    </span>
                )}
            </div>
        </div>
    );
}

// ============================================================
// MAIN HOMEMAP COMPONENT
// ============================================================

export default function HomeMap() {
    // ============================================================
    // IDW WEATHER STATE
    // ============================================================
    const [weatherData, setWeatherData] = useState([]);
    const [weatherLoading, setWeatherLoading] = useState(false);
    const [weatherError, setWeatherError] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedLayer, setSelectedLayer] = useState('rainfall');

    // ============================================================
    // MAP STATE
    // ============================================================
    const [indiaData, setIndiaData] = useState(null);
    const [stateBoundaryData, setStateBoundaryData] = useState(null);
    const [flyoverGeoJSON, setFlyoverGeoJSON] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingStatus, setLoadingStatus] = useState("Initializing map...");
    const [overlayVisible, setOverlayVisible] = useState(true);
    const [districtBoundaryData, setDistrictBoundaryData] = useState(null);
    const [builtupLayerData, setBuiltupLayerData] = useState(null);
    const [selectedFeature, setSelectedFeature] = useState(null);
    const [idwLayerInstance, setIdwLayerInstance] = useState(null);

    const mapRef = useRef(null);

    // API URLs
    const builtupUrl = '/data/Haryana_builtup.geojson';
    const stateBoundaryUrl = "https://mlinfomap.biz/geoserver/Aaj_Ka_Bharat_CONCOR/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=Aaj_Ka_Bharat_CONCOR%3AState%20Boundary&outputFormat=application/json&featureID=State%20Boundary.11";
    const districtBoundaryUrl = "https://mlinfomap.biz/geoserver/Aaj_Ka_Bharat_CONCOR/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=Aaj_Ka_Bharat_CONCOR:Aaj_Ka_Bharat2&outputFormat=application/json&CQL_FILTER=state_ut='Haryana'";

    // ============================================================
    // WEATHER DATA FETCHING
    // ============================================================
    const fetchWeatherData = useCallback(async (date) => {
        if (!date) {
            setWeatherError('Please select a date');
            return;
        }

        setWeatherLoading(true);
        setWeatherError(null);

        try {
            // Dynamic import to avoid circular dependency
            const { fetchIDWWeatherData } = await import('../services/api');
            const response = await fetchIDWWeatherData(date);

            if (response && response.data) {
                setWeatherData(response.data);
                setSelectedDate(date);
                console.log(`✅ Weather data loaded for ${date}:`, response.data.length, 'stations');
            } else {
                throw new Error('No data received from server');
            }
        } catch (err) {
            setWeatherError(err.message || 'Failed to fetch weather data');
            console.error('❌ Error fetching weather:', err);
        } finally {
            setWeatherLoading(false);
        }
    }, []);

    // ============================================================
    // LAYER CHANGE
    // ============================================================
    const handleLayerChange = useCallback((layer) => {
        if (['rainfall', 'wind', 'temperature'].includes(layer)) {
            setSelectedLayer(layer);
        } else {
            console.warn(`⚠️ Unknown layer: ${layer}`);
        }
    }, []);

    // ============================================================
    // DATE CHANGE
    // ============================================================
    const handleDateChange = useCallback((date) => {
        setSelectedDate(date);
        fetchWeatherData(date);
    }, [fetchWeatherData]);

    // ============================================================
    // INITIAL WEATHER LOAD
    // ============================================================
    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        setSelectedDate(today);
        fetchWeatherData(today);
    }, [fetchWeatherData]);

    // ============================================================
    // MAP LAYER LOADING
    // ============================================================
    useEffect(() => {
        setIndiaData(indiaBoundaryData);

        const fetchLayer = async (url) => {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        };

        const loadBaseLayers = async () => {
            try {
                setLoadingStatus("Loading map layers...");

                const stateBoundary = await fetchLayer(stateBoundaryUrl);
                setStateBoundaryData(stateBoundary);

                const districtBoundary = await fetchLayer(districtBoundaryUrl);
                setDistrictBoundaryData(districtBoundary);

                const builtupBoundary = await fetchLayer(builtupUrl);
                setBuiltupLayerData(builtupBoundary);

            } catch (err) {
                console.error(err);
                setLoadingStatus("Failed to load map data");
                setIsLoading(false);
            }
        };

        loadBaseLayers();
    }, []);

    // ============================================================
    // FLYOVER DATA LOADING
    // ============================================================
    const handleZoomComplete = useCallback(async () => {
        try {
            const flyovers = await loadFlyoverData();

            if (flyovers && flyovers.length > 0) {
                const allFeatures = flyovers.flatMap(
                    (flyover) => flyover.geojson?.features || []
                );

                setFlyoverGeoJSON({
                    type: "FeatureCollection",
                    features: allFeatures,
                });
            }

            setLoadingStatus("Ready");
        } catch (err) {
            console.error(err);
            setLoadingStatus("Failed to load flyover data");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isLoading) {
            const timeout = setTimeout(() => setOverlayVisible(false), 500);
            return () => clearTimeout(timeout);
        }
    }, [isLoading]);

    // ============================================================
    // FLYOVER CLICK HANDLER
    // ============================================================
    const bindFlyoverClicks = useCallback((feature, layer) => {
        layer.on("click", () => {
            setSelectedFeature(feature);
        });
    }, []);

    // ============================================================
    // IDW LAYER INTEGRATION
    // ============================================================
    useEffect(() => {
        // Remove existing IDW layer
        if (idwLayerInstance && mapRef.current) {
            mapRef.current.removeLayer(idwLayerInstance);
            setIdwLayerInstance(null);
        }

        if (!weatherData || weatherData.length === 0 || !mapRef.current) {
            return;
        }

        // Determine which property to use based on selected layer
        const propertyMap = {
            'rainfall': 'precip_mm',
            'wind': 'wind_kph',
            'temperature': 'temp_c'
        };
        const property = propertyMap[selectedLayer] || 'precip_mm';
        const layerName = selectedLayer.charAt(0).toUpperCase() + selectedLayer.slice(1);

        try {
            // Create IDW layer using our custom Leaflet layer
            const newLayer = createIDWLayer(weatherData, property, {
                opacity: 0.6,
                zIndex: 1000,
            });

            // Add to map
            newLayer.addTo(mapRef.current);
            setIdwLayerInstance(newLayer);

            console.log(`✅ IDW layer added for ${layerName}:`, {
                property: property,
                dataPoints: weatherData.length
            });

        } catch (error) {
            console.error('Error creating IDW layer:', error);
        }

        // Cleanup on unmount or when data/layer changes
        return () => {
            if (idwLayerInstance && mapRef.current) {
                mapRef.current.removeLayer(idwLayerInstance);
                setIdwLayerInstance(null);
            }
        };
    }, [weatherData, selectedLayer]);

    // ============================================================
    // RENDER
    // ============================================================
    return (
        <div className="w-full h-[540px] flex flex-col lg:flex-row gap-3">
            {/* Left: Map with weather controls */}
            <div className="relative flex-1 lg:basis-2/3 rounded-xl2 overflow-hidden shadow-card ring-2 ring-gray-200">
                {/* Weather Controls - positioned at top of map */}
                <div className="absolute top-2 left-2 right-2 z-[1000]">
                    <WeatherControls
                        selectedDate={selectedDate}
                        onDateChange={handleDateChange}
                        selectedLayer={selectedLayer}
                        onLayerChange={handleLayerChange}
                        isLoading={weatherLoading}
                        dataCount={weatherData.length}
                        error={weatherError}
                    />
                </div>

                {/* Loading Overlay */}
                {overlayVisible && (
                    <div
                        className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/70 backdrop-blur-sm transition-opacity duration-500"
                        style={{ opacity: isLoading ? 1 : 0 }}
                    >
                        <div className="flex flex-col items-center gap-3">
                            <div className="h-8 w-8 rounded-full border-4 border-gray-300 border-t-[#81198c] animate-spin" />
                            <p className="text-sm text-gray-700">{loadingStatus}</p>
                        </div>
                    </div>
                )}

                {/* Map Container */}
                <MapContainer
                    ref={mapRef}
                    center={INDIA_CENTER}
                    zoom={INDIA_ZOOM}
                    scrollWheelZoom
                    zoomControl
                    attributionControl={false}
                    style={{ height: "100%", width: "100%" }}
                >
                    <div className="compact-layer-control">
                        <LayersControl position="topleft">
                            <LayersControl.BaseLayer checked name="Streets">
                                <TileLayer
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                />
                            </LayersControl.BaseLayer>

                            <LayersControl.BaseLayer name="Satellite">
                                <TileLayer
                                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                    attribution="&copy; Esri"
                                />
                            </LayersControl.BaseLayer>

                            <LayersControl.Overlay checked name="India Boundary">
                                {indiaData && (
                                    <FadeInGeoJSON
                                        data={indiaData}
                                        style={{
                                            color: "#81198c",
                                            weight: 2,
                                            opacity: 0.8,
                                            fillOpacity: 0.05,
                                        }}
                                    />
                                )}
                            </LayersControl.Overlay>

                            <LayersControl.Overlay checked name="State Boundary">
                                {stateBoundaryData && (
                                    <FadeInGeoJSON
                                        data={stateBoundaryData}
                                        style={{
                                            color: "red",
                                            weight: 3,
                                            opacity: 1,
                                            fillOpacity: 0.2,
                                        }}
                                    />
                                )}
                                <ZoomToLayer
                                    data={stateBoundaryData}
                                    onZoomComplete={handleZoomComplete}
                                    extraZoom={1}
                                />
                            </LayersControl.Overlay>

                            <LayersControl.Overlay checked name="District Boundary">
                                {districtBoundaryData && (
                                    <FadeInGeoJSON
                                        data={districtBoundaryData}
                                        style={{
                                            color: "#12648a",
                                            weight: 2,
                                            opacity: 0.8,
                                            fillOpacity: 0.1,
                                        }}
                                    />
                                )}
                            </LayersControl.Overlay>

                            <LayersControl.Overlay checked name="Builtup Boundary">
                                {builtupLayerData && (
                                    <FadeInGeoJSON
                                        data={builtupLayerData}
                                        style={{
                                            color: "#10786d",
                                            weight: 2,
                                            opacity: 0.9,
                                            fillOpacity: 0.2,
                                        }}
                                    />
                                )}
                            </LayersControl.Overlay>

                            <LayersControl.Overlay checked name="Flyovers">
                                {flyoverGeoJSON && (
                                    <FadeInGeoJSON
                                        data={flyoverGeoJSON}
                                        style={{
                                            color: "#8f1b8b",
                                            weight: 4,
                                            opacity: 1,
                                        }}
                                        onEachFeature={bindFlyoverClicks}
                                    />
                                )}
                            </LayersControl.Overlay>
                        </LayersControl>
                    </div>
                </MapContainer>
            </div>

            {/* Right: Details panel */}
            <div className="lg:basis-1/3 rounded-xl2 overflow-hidden shadow-card ring-2 ring-gray-200 bg-white">
                <MapDetailsPanel
                    selectedFeature={selectedFeature}
                    onClear={() => setSelectedFeature(null)}
                />
            </div>
        </div>
    );
}








// // src/components/HomeMap.jsx
// import { useEffect, useState, useCallback, useRef } from "react";
// import {
//     MapContainer,
//     TileLayer,
//     GeoJSON,
//     useMap,
//     LayersControl,
// } from "react-leaflet";
// import L from "leaflet";
// import "leaflet/dist/leaflet.css";
// import { MapPin, X } from "lucide-react";

// import { loadFlyoverData } from "../utils/geoJsonParser";
// import indiaBoundaryData from "../data/indiaBoundary.json";
// import { createIDWLayer } from "../components/IDWLeafletLayer";

// const INDIA_CENTER = [22.9734, 78.6569];
// const INDIA_ZOOM = 6;

// function ZoomToLayer({ data, onZoomComplete, extraZoom = 1 }) {
//     const map = useMap();

//     useEffect(() => {
//         if (!data || data.features.length === 0) return;

//         const layer = L.geoJSON(data);
//         const bounds = layer.getBounds();

//         if (bounds.isValid()) {
//             map.once("moveend", () => {
//                 map.setZoom(map.getZoom() + extraZoom, { animate: true });
//                 onZoomComplete && onZoomComplete();
//             });

//             map.flyToBounds(bounds, {
//                 padding: [2, 2],
//                 maxZoom: 15,
//                 duration: 1.2,
//             });
//         }
//     }, [data, map, onZoomComplete, extraZoom]);

//     return null;
// }

// function FadeInGeoJSON({ data, style, targetOpacity = 1, targetFillOpacity, ...rest }) {
//     const [visible, setVisible] = useState(false);

//     useEffect(() => {
//         const raf = requestAnimationFrame(() => setVisible(true));
//         return () => cancelAnimationFrame(raf);
//     }, [data]);

//     const computedStyle = (feature) => {
//         const base = typeof style === "function" ? style(feature) : style || {};
//         return {
//             ...base,
//             opacity: visible ? (base.opacity ?? targetOpacity) : 0,
//             fillOpacity: visible
//                 ? (base.fillOpacity ?? targetFillOpacity ?? 0)
//                 : 0,
//         };
//     };

//     return <GeoJSON data={data} style={computedStyle} {...rest} />;
// }

// // Right-hand details panel
// function MapDetailsPanel({ selectedFeature, onClear }) {
//     if (!selectedFeature) {
//         return (
//             <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-2">
//                 <div className="w-11 h-11 rounded-full bg-blue-50 flex items-center justify-center">
//                     <MapPin className="w-5 h-5 text-blue-400" />
//                 </div>
//                 <p className="text-sm font-semibold text-gray-600">No selection yet</p>
//                 <p className="text-[12px] text-gray-400 max-w-[220px]">
//                     Click a flyover marker or line on the map to see its details here.
//                 </p>
//             </div>
//         );
//     }

//     const props = selectedFeature.properties || {};
//     const name = props.name || props.flyover_name || props.NAME || "Selected Feature";
//     const entries = Object.entries(props).filter(
//         ([key]) => !["name", "flyover_name", "NAME"].includes(key)
//     );

//     return (
//         <div className="flex flex-col h-full">
//             <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
//                 <div className="flex items-center gap-2 min-w-0">
//                     <MapPin className="w-4 h-4 text-blue-500 flex-shrink-0" />
//                     <h3 className="text-sm font-bold text-gray-900 truncate">{name}</h3>
//                 </div>
//                 <button
//                     onClick={onClear}
//                     className="p-1 rounded-md hover:bg-gray-100 flex-shrink-0"
//                     aria-label="Clear selection"
//                 >
//                     <X className="w-4 h-4 text-gray-400" />
//                 </button>
//             </div>

//             <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
//                 {entries.length === 0 ? (
//                     <p className="text-[12px] text-gray-400">No additional properties available.</p>
//                 ) : (
//                     entries.map(([key, value]) => (
//                         <div key={key} className="flex items-center justify-between gap-3 text-[12px]">
//                             <span className="text-gray-500 capitalize truncate">
//                                 {key.replace(/_/g, " ")}
//                             </span>
//                             <span className="font-semibold text-gray-800 text-right truncate">
//                                 {String(value)}
//                             </span>
//                         </div>
//                     ))
//                 )}
//             </div>
//         </div>
//     );
// }

// export default function HomeMap({ weatherData, loading, selectedLayer }) {
//     const [indiaData, setIndiaData] = useState(null);
//     const [stateBoundaryData, setStateBoundaryData] = useState(null);
//     const [flyoverGeoJSON, setFlyoverGeoJSON] = useState(null);
//     const [isLoading, setIsLoading] = useState(true);
//     const [loadingStatus, setLoadingStatus] = useState("Initializing map...");
//     const [overlayVisible, setOverlayVisible] = useState(true);
//     const [districtBoundaryData, setDistrictBoundaryData] = useState(null);
//     const [builtupLayerData, setBuiltupLayerData] = useState(null);
//     const [selectedFeature, setSelectedFeature] = useState(null);
//     const [idwLayerInstance, setIdwLayerInstance] = useState(null);

//     const mapRef = useRef(null);

//     const builtupUrl = '/data/Haryana_builtup.geojson';
//     const stateBoundaryUrl = "https://mlinfomap.biz/geoserver/Aaj_Ka_Bharat_CONCOR/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=Aaj_Ka_Bharat_CONCOR%3AState%20Boundary&outputFormat=application/json&featureID=State%20Boundary.11";
//     const districtBoundaryUrl = "https://mlinfomap.biz/geoserver/Aaj_Ka_Bharat_CONCOR/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=Aaj_Ka_Bharat_CONCOR:Aaj_Ka_Bharat2&outputFormat=application/json&CQL_FILTER=state_ut='Haryana'";

//     // Load India boundary and base layers
//     useEffect(() => {
//         setIndiaData(indiaBoundaryData);

//         const fetchLayer = async (url) => {
//             const response = await fetch(url);
//             if (!response.ok) throw new Error(`HTTP ${response.status}`);
//             return response.json();
//         };

//         const loadBaseLayers = async () => {
//             try {
//                 setLoadingStatus("Loading map layers...");

//                 const stateBoundary = await fetchLayer(stateBoundaryUrl);
//                 setStateBoundaryData(stateBoundary);

//                 const districtBoundary = await fetchLayer(districtBoundaryUrl);
//                 setDistrictBoundaryData(districtBoundary);

//                 const builtupBoundary = await fetchLayer(builtupUrl);
//                 setBuiltupLayerData(builtupBoundary);

//             } catch (err) {
//                 console.error(err);
//                 setLoadingStatus("Failed to load map data");
//                 setIsLoading(false);
//             }
//         };

//         loadBaseLayers();
//     }, []);

//     // Handle zoom complete and load flyovers
//     const handleZoomComplete = useCallback(async () => {
//         try {
//             const flyovers = await loadFlyoverData();

//             if (flyovers && flyovers.length > 0) {
//                 const allFeatures = flyovers.flatMap(
//                     (flyover) => flyover.geojson?.features || []
//                 );

//                 setFlyoverGeoJSON({
//                     type: "FeatureCollection",
//                     features: allFeatures,
//                 });
//             }

//             setLoadingStatus("Ready");
//         } catch (err) {
//             console.error(err);
//             setLoadingStatus("Failed to load flyover data");
//         } finally {
//             setIsLoading(false);
//         }
//     }, []);

//     useEffect(() => {
//         if (!isLoading) {
//             const timeout = setTimeout(() => setOverlayVisible(false), 500);
//             return () => clearTimeout(timeout);
//         }
//     }, [isLoading]);

//     const bindFlyoverClicks = useCallback((feature, layer) => {
//         layer.on("click", () => {
//             setSelectedFeature(feature);
//         });
//     }, []);

//     // ============================================================
//     // IDW LAYER INTEGRATION - Using OpenLayers via custom layer
//     // ============================================================
//     useEffect(() => {
//         // Remove existing IDW layer
//         if (idwLayerInstance && mapRef.current) {
//             mapRef.current.removeLayer(idwLayerInstance);
//             setIdwLayerInstance(null);
//         }

//         if (!weatherData || weatherData.length === 0 || !mapRef.current) {
//             return;
//         }

//         // Determine which property to use based on selected layer
//         let property = '';
//         let layerName = '';

//         switch (selectedLayer) {
//             case 'rainfall':
//                 property = 'precip_mm';
//                 layerName = 'Rainfall';
//                 break;
//             case 'wind':
//                 property = 'wind_kph';
//                 layerName = 'Wind';
//                 break;
//             case 'temperature':
//                 property = 'temp_c';
//                 layerName = 'Temperature';
//                 break;
//             default:
//                 property = 'precip_mm';
//                 layerName = 'Rainfall';
//         }

//         try {
//             // Create IDW layer using our custom Leaflet layer
//             const newLayer = createIDWLayer(weatherData, property, {
//                 opacity: 0.6,
//                 zIndex: 1000,
//             });

//             // Add to map
//             newLayer.addTo(mapRef.current);
//             setIdwLayerInstance(newLayer);

//             console.log(`✅ IDW layer added for ${layerName}:`, {
//                 property: property,
//                 dataPoints: weatherData.length
//             });

//         } catch (error) {
//             console.error('Error creating IDW layer:', error);
//         }

//         // Cleanup on unmount or when data/layer changes
//         return () => {
//             if (idwLayerInstance && mapRef.current) {
//                 mapRef.current.removeLayer(idwLayerInstance);
//                 setIdwLayerInstance(null);
//             }
//         };
//     }, [weatherData, selectedLayer]);

//     return (
//         <div className="w-full h-[540px] flex flex-col lg:flex-row gap-3">
//             {/* Left: the map itself */}
//             <div className="relative flex-1 lg:basis-2/3 rounded-xl2 overflow-hidden shadow-card ring-2 ring-gray-200">
//                 {overlayVisible && (
//                     <div
//                         className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/70 backdrop-blur-sm transition-opacity duration-500"
//                         style={{ opacity: isLoading ? 1 : 0 }}
//                     >
//                         <div className="flex flex-col items-center gap-3">
//                             <div className="h-8 w-8 rounded-full border-4 border-gray-300 border-t-[#81198c] animate-spin" />
//                             <p className="text-sm text-gray-700">{loadingStatus}</p>
//                         </div>
//                     </div>
//                 )}

//                 <MapContainer
//                     ref={mapRef}
//                     center={INDIA_CENTER}
//                     zoom={INDIA_ZOOM}
//                     scrollWheelZoom
//                     zoomControl
//                     attributionControl={false}
//                     style={{ height: "100%", width: "100%" }}
//                 >
//                     <div className="compact-layer-control">
//                         <LayersControl position="topleft">

//                             <LayersControl.BaseLayer checked name="Streets">
//                                 <TileLayer
//                                     url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
//                                     attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
//                                 />
//                             </LayersControl.BaseLayer>

//                             <LayersControl.BaseLayer name="Satellite">
//                                 <TileLayer
//                                     url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
//                                     attribution="&copy; Esri"
//                                 />
//                             </LayersControl.BaseLayer>

//                             <LayersControl.Overlay checked name="India Boundary">
//                                 {indiaData && (
//                                     <FadeInGeoJSON
//                                         data={indiaData}
//                                         style={{
//                                             color: "#81198c",
//                                             weight: 2,
//                                             opacity: 0.8,
//                                             fillOpacity: 0.05,
//                                         }}
//                                     />
//                                 )}
//                             </LayersControl.Overlay>

//                             <LayersControl.Overlay checked name="State Boundary">
//                                 {stateBoundaryData && (
//                                     <FadeInGeoJSON
//                                         data={stateBoundaryData}
//                                         style={{
//                                             color: "red",
//                                             weight: 3,
//                                             opacity: 1,
//                                             fillOpacity: 0.2,
//                                         }}
//                                     />
//                                 )}
//                                 <ZoomToLayer
//                                     data={stateBoundaryData}
//                                     onZoomComplete={handleZoomComplete}
//                                     extraZoom={1}
//                                 />
//                             </LayersControl.Overlay>

//                             <LayersControl.Overlay checked name="District Boundary">
//                                 {districtBoundaryData && (
//                                     <FadeInGeoJSON
//                                         data={districtBoundaryData}
//                                         style={{
//                                             color: "#12648a",
//                                             weight: 2,
//                                             opacity: 0.8,
//                                             fillOpacity: 0.1,
//                                         }}
//                                     />
//                                 )}
//                             </LayersControl.Overlay>

//                             <LayersControl.Overlay checked name="Builtup Boundary">
//                                 {builtupLayerData && (
//                                     <FadeInGeoJSON
//                                         data={builtupLayerData}
//                                         style={{
//                                             color: "#10786d",
//                                             weight: 2,
//                                             opacity: 0.9,
//                                             fillOpacity: 0.2,
//                                         }}
//                                     />
//                                 )}
//                             </LayersControl.Overlay>

//                             <LayersControl.Overlay checked name="Flyovers">
//                                 {flyoverGeoJSON && (
//                                     <FadeInGeoJSON
//                                         data={flyoverGeoJSON}
//                                         style={{
//                                             color: "#8f1b8b",
//                                             weight: 4,
//                                             opacity: 1,
//                                         }}
//                                         onEachFeature={bindFlyoverClicks}
//                                     />
//                                 )}
//                             </LayersControl.Overlay>

//                         </LayersControl>
//                     </div>
//                 </MapContainer>
//             </div>

//             {/* Right: details panel */}
//             <div className="lg:basis-1/3 rounded-xl2 overflow-hidden shadow-card ring-2 ring-gray-200 bg-white">
//                 <MapDetailsPanel
//                     selectedFeature={selectedFeature}
//                     onClear={() => setSelectedFeature(null)}
//                 />
//             </div>
//         </div>
//     );
// }