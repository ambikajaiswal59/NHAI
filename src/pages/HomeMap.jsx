import { useEffect, useState, useCallback, useRef } from "react";
import {
    MapContainer,
    TileLayer,
    GeoJSON,
    useMap,
    LayersControl,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
    CloudRain,
    Wind,
    Droplets,
    Eye,
    Thermometer,
    CloudSun,
    Layers
} from "lucide-react";

import { loadFlyoverData } from "../utils/geoJsonParser";
import indiaBoundaryData from "../data/indiaBoundary.json";

const INDIA_CENTER = [22.9734, 78.6569];
const INDIA_ZOOM = 6;

// Weather parameters configuration
const WEATHER_PARAMS = [
    { id: 'rainfall', label: 'Rainfall', icon: CloudRain, color: 'blue' },
    { id: 'wind', label: 'Wind', icon: Wind, color: 'teal' },
    { id: 'humidity', label: 'Humidity', icon: Droplets, color: 'cyan' },
    { id: 'visibility', label: 'Visibility', icon: Eye, color: 'amber' },
    { id: 'temperature', label: 'Temperature', icon: Thermometer, color: 'red' },
];

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

// Weather Parameter Button Component
// Weather Parameter Button Component - Enhanced Version
function WeatherButtonFull({ param, isActive, onClick }) {
    const Icon = param.icon;

    const colorClasses = {
        blue: 'hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600',
        teal: 'hover:bg-teal-50 hover:border-teal-300 hover:text-teal-600',
        cyan: 'hover:bg-cyan-50 hover:border-cyan-300 hover:text-cyan-600',
        amber: 'hover:bg-amber-50 hover:border-amber-300 hover:text-amber-600',
        red: 'hover:bg-red-50 hover:border-red-300 hover:text-red-600',
    };

    const activeColorClasses = {
        blue: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-500 shadow-lg shadow-blue-200',
        teal: 'bg-gradient-to-r from-teal-500 to-teal-600 text-white border-teal-500 shadow-lg shadow-teal-200',
        cyan: 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white border-cyan-500 shadow-lg shadow-cyan-200',
        amber: 'bg-gradient-to-r from-amber-500 to-amber-600 text-white border-amber-500 shadow-lg shadow-amber-200',
        red: 'bg-gradient-to-r from-red-500 to-red-600 text-white border-red-500 shadow-lg shadow-red-200',
    };

    const iconColorClasses = {
        blue: 'text-blue-500',
        teal: 'text-teal-500',
        cyan: 'text-cyan-500',
        amber: 'text-amber-500',
        red: 'text-red-500',
    };

    return (
        <button
            onClick={() => onClick(param.id)}
            className={`
                flex-1 flex items-center justify-center gap-2.5
                px-3 sm:px-4 py-2.5 sm:py-3
                rounded-xl text-[10px] sm:text-sm lg:text-base
                font-semibold border-2 transition-all duration-300
                min-w-[55px] sm:min-w-[70px] relative overflow-hidden
                ${isActive
                    ? `${activeColorClasses[param.color]} scale-105 ring-4 ring-opacity-30 ${param.color === 'blue' ? 'ring-blue-200' : param.color === 'teal' ? 'ring-teal-200' : param.color === 'cyan' ? 'ring-cyan-200' : param.color === 'amber' ? 'ring-amber-200' : 'ring-red-200'}`
                    : `bg-white/90 border-gray-200 text-gray-700 ${colorClasses[param.color]} hover:scale-102`
                }
                hover:shadow-xl hover:-translate-y-0.5
            `}
        >
            {/* Animated background pulse effect when active */}
            {isActive && (
                <span className="absolute inset-0 bg-white/20 animate-pulse" />
            )}

            {/* Icon with glow effect */}
            <span className={`
                relative z-10
                ${isActive ? 'text-white drop-shadow-glow' : iconColorClasses[param.color]}
                transition-all duration-300
            `}>
                <Icon size={isActive ? 20 : 18} className="shrink-0" />
            </span>

            {/* Label with better visibility */}
            <span className={`
                relative z-10 truncate
                ${isActive ? 'text-white' : 'text-gray-700'}
                transition-all duration-300
            `}>
                {param.label}
            </span>

            {/* Active indicator dot */}
            {isActive && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full shadow-lg animate-bounce" />
            )}
        </button>
    );
}

export default function HomeMap() {
    const [indiaData, setIndiaData] = useState(null);
    const [stateBoundaryData, setStateBoundaryData] = useState(null);
    const [flyoverGeoJSON, setFlyoverGeoJSON] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadingStatus, setLoadingStatus] = useState("Initializing map...");
    const [overlayVisible, setOverlayVisible] = useState(true);
    const [districtBoundaryData, setDistrictBoundaryData] = useState(null);

    // State for weather parameter selection
    const [activeWeatherParam, setActiveWeatherParam] = useState(null);

    const stateBoundaryUrl =
        "https://mlinfomap.biz/geoserver/Aaj_Ka_Bharat_CONCOR/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=Aaj_Ka_Bharat_CONCOR%3AState%20Boundary&outputFormat=application/json&featureID=State%20Boundary.11";

    const districtBoundaryUrl =
        "https://mlinfomap.biz/geoserver/Aaj_Ka_Bharat_CONCOR/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=Aaj_Ka_Bharat_CONCOR:Aaj_Ka_Bharat2&outputFormat=application/json&CQL_FILTER=state_ut='Haryana'";

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
            } catch (err) {
                console.error(err);
                setLoadingStatus("Failed to load map data");
                setLoading(false);
            }
        };

        loadBaseLayers();
    }, []);

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
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!loading) {
            const timeout = setTimeout(() => setOverlayVisible(false), 500);
            return () => clearTimeout(timeout);
        }
    }, [loading]);

    // Handle weather parameter click
    const handleWeatherParamClick = (paramId) => {
        if (activeWeatherParam === paramId) {
            setActiveWeatherParam(null); // Deselect if already active
        } else {
            setActiveWeatherParam(paramId);
            console.log(` Weather parameter selected: ${paramId}`);
            // Future: Add logic to fetch/show weather data for this parameter
        }
    };

    return (
        // Outer wrapper is now a column: [weather bar] then [map], instead of
        // the weather bar floating absolutely on top of the map.
        <div className="w-full h-full flex flex-col gap-3">

            {/* Weather Toolbar - separate bar, sits in normal flow above the map */}
            <div className="w-full rounded-xl2 shadow-card ring-2 ring-gray-200 overflow-hidden">
                {/* Gradient Background Header */}
                <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 px-4 sm:px-6 py-1.5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CloudSun size={16} className="text-white/90" />
                            <span className="text-xs font-bold text-white uppercase tracking-wider">Weather </span>
                        </div>
                        <span className="text-[8px] text-white/60 uppercase tracking-widest">● Live Data</span>
                    </div>
                </div>

                {/* Weather Controls - with subtle background pattern */}
                <div className="bg-gradient-to-br from-gray-50/90 to-gray-100/70 backdrop-blur-sm px-3 sm:px-4 py-3 relative">
                    {/* Subtle pattern overlay */}
                    <div className="absolute inset-0 opacity-5" style={{
                        backgroundImage: `radial-gradient(circle at 20% 50%, #2563EB 1px, transparent 1px)`,
                        backgroundSize: '20px 20px'
                    }} />

                    <div className="flex flex-col sm:flex-row items-center gap-2 relative">
                        {/* Weather Label with badge */}
                        <div className="flex items-center gap-2 pr-0 sm:pr-4 border-b sm:border-b-0 sm:border-r border-gray-200/70 shrink-0 w-full sm:w-auto justify-center sm:justify-start pb-2 sm:pb-0">
                            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-1.5 rounded-lg shadow-md shadow-blue-200">
                                <CloudSun size={16} className="text-white" />
                            </div>
                            <div>
                                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Weather</span>
                                <span className="hidden sm:inline text-[8px] text-gray-400 ml-1.5 font-medium">• Select parameter</span>
                            </div>
                        </div>

                        {/* Parameter Buttons - Full width with flex-1 */}
                        <div className="flex gap-1.5 w-full sm:w-auto sm:flex-1">
                            {WEATHER_PARAMS.map((param) => (
                                <WeatherButtonFull
                                    key={param.id}
                                    param={param}
                                    isActive={activeWeatherParam === param.id}
                                    onClick={handleWeatherParamClick}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Map container - now just the map, no toolbar overlay on it */}
            <div className="relative w-full flex-1 rounded-xl2 overflow-hidden shadow-card ring-2 ring-gray-200">
                {overlayVisible && (
                    <div
                        className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/70 backdrop-blur-sm transition-opacity duration-500"
                        style={{ opacity: loading ? 1 : 0 }}
                    >
                        <div className="flex flex-col items-center gap-3">
                            <div className="h-8 w-8 rounded-full border-4 border-gray-300 border-t-[#81198c] animate-spin" />
                            <p className="text-sm text-gray-700">{loadingStatus}</p>
                        </div>
                    </div>
                )}

                <MapContainer
                    center={INDIA_CENTER}
                    zoom={INDIA_ZOOM}
                    scrollWheelZoom
                    zoomControl
                    attributionControl={false}
                    style={{ height: "100%", width: "100%" }}
                >
                    <div className="compact-layer-control">
                        <LayersControl position="topleft">
                            <LayersControl.BaseLayer checked name="Satellite">
                                <TileLayer
                                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                    attribution="&copy; Esri"
                                />
                            </LayersControl.BaseLayer>

                            <LayersControl.BaseLayer name="Streets">
                                <TileLayer
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
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

                            <LayersControl.Overlay checked name="Flyovers">
                                {flyoverGeoJSON && (
                                    <FadeInGeoJSON
                                        data={flyoverGeoJSON}
                                        style={{
                                            color: "#8f1b8b",
                                            weight: 4,
                                            opacity: 1,
                                        }}
                                    />
                                )}
                            </LayersControl.Overlay>

                        </LayersControl>
                    </div>
                </MapContainer>
            </div>
        </div>
    );
}