//HomeMap.jsx file
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
    MapContainer,
    TileLayer,
    GeoJSON,
    Marker,
    useMap,
    useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
    MapPin,
    X,
    ChevronDown,
    Waypoints,
    Maximize,
    Minimize,
    Check,
    Layers,
    Calendar,
    TrafficCone,
} from "lucide-react";
import proj4 from "proj4";

import { loadFlyoverData } from "../utils/geoJsonParser";
import { useWeather } from "../hooks/useWeather";
import { useIDWWeather } from "../hooks/useIDWWeather";
import WeatherPanel from "../components/WeatherPanel";
import FullscreenButton from "./map/FullscreenButton";
import FlyoverDropdown from "./map/FlyoverDropdown";
import IdwLayerDropdown from "./map/IdwLayerDropdown";

import FlyoverDetailsPanel from "./map/FlyoverDetailsPanel";
import FlyoverMarkers from "./map/FlyoverMarkers";
import BaseLayerSwitcher, { BASE_LAYERS } from "./map/BaseLayerSwitcher";
import { createIDWLayer } from "./IDWLeafletLayer";
import {
    ZoomTracker,
    FullscreenFit,
    FocusOnPoint,
    getFlyoverColor,
    getFlyoverDisplayName,
} from "./map/mapHelpers";
import StatsOverview from "./StatsOverview";

import GoogleMapComponent from "./GoogleMapTraffic";

const REGION_CENTER = [30.30031525674896, 76.75438508247828];
const REGION_ZOOM = 11;
const MIN_ZOOM = 9;
const MAX_ZOOM = 17;
const POPUP_ZOOM_THRESHOLD = 16;

const UTM43N = "+proj=utm +zone=43 +datum=WGS84 +units=m +no_defs";
const WGS84 = "EPSG:4326";

function convertBufferToWGS84(geojson) {
    if (!geojson || !geojson.features) return geojson;

    const convertCoords = (coords) => {
        if (
            Array.isArray(coords) &&
            coords.length === 2 &&
            typeof coords[0] === "number" &&
            typeof coords[1] === "number"
        ) {
            if (coords[0] > 1000 || coords[1] > 1000) {
                try {
                    const [x, y] = coords;
                    const [lng, lat] = proj4(UTM43N, WGS84, [x, y]);
                    return [lng, lat];
                } catch (e) {
                    console.warn("Failed to convert coordinate:", coords, e);
                    return coords;
                }
            }
            return coords;
        }
        return coords.map(convertCoords);
    };

    return {
        ...geojson,
        features: geojson.features.map((f) => ({
            ...f,
            geometry: {
                ...f.geometry,
                coordinates: convertCoords(f.geometry.coordinates),
            },
        })),
    };
}



export default function HomeMap() {
    const [flyoversList, setFlyoversList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingStatus, setLoadingStatus] = useState("Initializing map...");
    const [overlayVisible, setOverlayVisible] = useState(true);
    const [selectedHighway, setSelectedHighway] = useState(null);
    const [selectedPoint, setSelectedPoint] = useState(null);
    const [visibleFlyoverIds, setVisibleFlyoverIds] = useState(new Set());
    const [currentZoom, setCurrentZoom] = useState(REGION_ZOOM);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showTrafficMap, setShowTrafficMap] = useState(false);
    const [baseLayer, setBaseLayer] = useState("streets");

    // Use the IDW Weather Hook instead of managing state directly
    const {
        weatherData,
        loading: idwLoading,
        error: idwError,
        selectedDate,
        fetchWeather,
        clearData,
        changeLayer
    } = useIDWWeather();

    const [idwLayer, setIdwLayer] = useState(null);
    const [idwLayerInstance, setIdwLayerInstance] = useState(null);
    const [bufferBoundary, setBufferBoundary] = useState(null);
    const [isIdwLayerLoading, setIsIdwLayerLoading] = useState(false);

    const mapWrapperRef = useRef(null);
    const mapRef = useRef(null);

    const flyoverMarkers = useMemo(() => {
        const markers = flyoversList.map((flyover, index) => {
            const color = getFlyoverColor(index);
            const displayName = getFlyoverDisplayName(flyover.type, index);

            return {
                ...flyover,
                color: color,
                displayName: displayName,
            };
        });

        return markers;
    }, [flyoversList]);

    const isDetailZoom = currentZoom >= POPUP_ZOOM_THRESHOLD;

    const weatherTarget = useMemo(() => {
        if (selectedPoint) {
            return {
                flyoverId: selectedPoint.id,
                lat: selectedPoint.latlng[0],
                lng: selectedPoint.latlng[1],
            };
        }
        if (selectedHighway) {
            return {
                flyoverId: selectedHighway.id,
                lat: selectedHighway.center[0],
                lng: selectedHighway.center[1],
            };
        }
        return null;
    }, [selectedPoint, selectedHighway]);

    const fullscreenFitData = useMemo(() => {
        if (selectedHighway) return selectedHighway.geojson || null;
        const visible = flyoverMarkers.filter((f) => visibleFlyoverIds.has(f.id));
        if (visible.length === 0) return null;
        return {
            type: "FeatureCollection",
            features: visible.flatMap((f) => f.geojson?.features || []),
        };
    }, [selectedHighway, flyoverMarkers, visibleFlyoverIds]);

    const focusTarget = useMemo(() => {
        if (selectedPoint) {
            return {
                latlng: selectedPoint.latlng,
                key: `point-${selectedPoint.id}`,
            };
        }
        if (selectedHighway) {
            return {
                latlng: selectedHighway.center,
                key: `highway-${selectedHighway.id}`,
            };
        }
        return { latlng: null, key: null };
    }, [selectedPoint, selectedHighway]);

    const { weather, loading: weatherLoadingFromHook } =
        useWeather(weatherTarget);
    const isWeatherLoading = idwLoading || weatherLoadingFromHook;

    // Handle IDW layer selection - using the hook's changeLayer
    const handleIdwSelect = useCallback(
        (layerId) => {
            setIdwLayer(layerId);
            if (layerId !== null) {
                changeLayer(layerId);
            }

            if (layerId === null) {
                if (idwLayerInstance && mapRef.current) {
                    try {
                        mapRef.current.removeLayer(idwLayerInstance);
                    } catch (e) { }
                    setIdwLayerInstance(null);
                }
                setIsIdwLayerLoading(false);
                clearData();
            }
        },
        [idwLayerInstance, changeLayer, clearData],
    );

    // Handle date change - using the hook's fetchWeather
    const handleDateChange = useCallback(
        (date) => {
            fetchWeather(date);
        },
        [fetchWeather],
    );

    // Load buffer boundary for clipping
    useEffect(() => {
        let cancelled = false;

        const loadBufferBoundary = async () => {
            try {
                const response = await fetch("/data/AOI_Buffer.geojson");
                if (!response.ok) {
                    console.warn(`Buffer.geojson request failed: ${response.status}`);
                    return;
                }
                const data = await response.json();

                if (!cancelled) {
                    const isUTM = data.crs?.properties?.name?.includes("32643");
                    const isCRS84 = data.crs?.properties?.name?.includes("CRS84");

                    let processedData = data;

                    if (isUTM) {
                        processedData = convertBufferToWGS84(data);
                    } else if (isCRS84) {
                        // already correct
                    } else {
                        const firstCoord =
                            data?.features?.[0]?.geometry?.coordinates?.[0]?.[0];
                        if (
                            firstCoord &&
                            Array.isArray(firstCoord) &&
                            firstCoord.length === 2
                        ) {
                            const [x, y] = firstCoord;
                            if (x > 1000 || y > 1000) {
                                processedData = convertBufferToWGS84(data);
                            }
                        }
                    }

                    setBufferBoundary(processedData);
                }
            } catch (error) {
                console.warn(
                    "Could not load Buffer.geojson, IDW will not be clipped:",
                    error,
                );
            }
        };

        loadBufferBoundary();
        return () => {
            cancelled = true;
        };
    }, []);

    // Create IDW layer when data is available
    useEffect(() => {
        // Remove existing IDW layer
        if (idwLayerInstance && mapRef.current) {
            try {
                mapRef.current.removeLayer(idwLayerInstance);
            } catch (e) { }
            setIdwLayerInstance(null);
        }

        // If no IDW layer selected OR no weather data, don't show loader
        if (
            !idwLayer ||
            !weatherData ||
            weatherData.length === 0 ||
            !mapRef.current
        ) {
            setIsIdwLayerLoading(false);
            return;
        }

        const propertyMap = {
            temperature: "temp_c",
            rainfall: "precip_mm",
            wind: "wind_kph",
        };
        const property = propertyMap[idwLayer];

        if (!property) {
            setIsIdwLayerLoading(false);
            return;
        }

        // Show loader only when IDW is selected and we're creating the layer
        setIsIdwLayerLoading(true);

        // Use setTimeout to allow UI to update before heavy computation
        setTimeout(() => {
            try {
                const newLayer = createIDWLayer(
                    weatherData,
                    property,
                    {
                        opacity: 0.85,
                        zIndex: 100,
                        clipPolygon: bufferBoundary,
                        cacheKey: `${selectedDate || "latest"}::${property}`,
                    }
                );

                newLayer.addTo(mapRef.current);
                setIdwLayerInstance(newLayer);

                // Hide loader after layer is added
                setIsIdwLayerLoading(false);
            } catch (error) {
                console.error("Error creating IDW layer:", error);
                setIsIdwLayerLoading(false);
            }
        }, 100);

        return () => {
            if (idwLayerInstance && mapRef.current) {
                try {
                    mapRef.current.removeLayer(idwLayerInstance);
                } catch (e) { }
                setIdwLayerInstance(null);
            }
            setIsIdwLayerLoading(false);
        };
    }, [idwLayer, weatherData, bufferBoundary, selectedDate]);

    // Load initial weather data for today
    useEffect(() => {
        const today = new Date().toISOString().split("T")[0];
        fetchWeather(today);
    }, [fetchWeather]);

    const loadFlyovers = useCallback(async () => {
        try {
            const flyovers = await loadFlyoverData();
            if (flyovers && flyovers.length > 0) {
                const list = flyovers.map((flyover, index) => ({
                    id: flyover.id ?? `flyover-${index + 1}`,
                    geojson: flyover.geojson,
                    riskStatus: flyover.riskStatus,
                    center: flyover.center,
                    type: flyover.type,
                    namedPoints: flyover.namedPoints || [],
                }));
                setFlyoversList(list);
                setVisibleFlyoverIds(new Set(list.map((f) => f.id)));
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
        const loadBaseLayers = async () => {
            try {
                setLoadingStatus("Loading map layers...");
                await loadFlyovers();
            } catch (err) {
                console.error(err);
                setLoadingStatus("Failed to load map data");
                setLoading(false);
            }
        };
        loadBaseLayers();
    }, [loadFlyovers]);

    useEffect(() => {
        if (!loading) {
            const timeout = setTimeout(() => setOverlayVisible(false), 500);
            return () => clearTimeout(timeout);
        }
    }, [loading]);

    useEffect(() => {
        const handleChange = () =>
            setIsFullscreen(Boolean(document.fullscreenElement));
        document.addEventListener("fullscreenchange", handleChange);
        return () => document.removeEventListener("fullscreenchange", handleChange);
    }, []);

    useEffect(() => {
        if (!mapWrapperRef.current) return;

        const resizeObserver = new ResizeObserver(() => {
            if (mapRef.current) {
                mapRef.current.invalidateSize();
            }
        });

        resizeObserver.observe(mapWrapperRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            mapWrapperRef.current?.requestFullscreen?.();
        } else {
            document.exitFullscreen?.();
        }
    }, []);

    const handleSelectHighway = useCallback((highway) => {
        setSelectedHighway(highway);
        setSelectedPoint(null);
    }, []);

    const handleSelectPoint = useCallback((point, highway) => {
        setSelectedPoint(point);
        setSelectedHighway(highway || null);
    }, []);

    const handleToggleFlyover = useCallback((id) => {
        setVisibleFlyoverIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
        setSelectedHighway((prev) => {
            if (prev?.id === id) {
                setSelectedPoint(null);
                return null;
            }
            return prev;
        });
    }, []);

    const handleToggleAllFlyovers = useCallback(() => {
        setVisibleFlyoverIds((prev) =>
            prev.size === flyoverMarkers.length && flyoverMarkers.length > 0
                ? new Set()
                : new Set(flyoverMarkers.map((f) => f.id)),
        );
    }, [flyoverMarkers]);

    const handleToggleTrafficMap = useCallback(() => {
        setShowTrafficMap((prev) => !prev);
    }, []);

    const activeBaseLayerUrl = BASE_LAYERS.find((l) => l.id === baseLayer)?.url;

    return (
        <div
            ref={mapWrapperRef}
            className={`w-full h-auto lg:h-[480px] min-h-0 flex flex-col gap-3 bg-transparent ${showTrafficMap ? 'lg:flex-col' : 'lg:flex-row'
                }`}
        >
            <div className={`relative w-full h-[320px] lg:h-auto lg:flex-1 min-w-0 min-h-[300px] rounded-xl2 overflow-hidden shadow-card ring-2 ring-gray-200 ${showTrafficMap ? 'w-full' : ''
                }`}>
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

                {/* IDW Layer Loading Overlay - Only over the map */}
                {isIdwLayerLoading && !loading && (
                    <div
                        className="absolute inset-0 z-[900] flex items-center justify-center bg-white/60 backdrop-blur-sm"
                    >
                        <div className="flex flex-col items-center gap-3 bg-white/90 rounded-xl px-6 py-4 shadow-lg border border-gray-200">
                            <div className="h-8 w-8 rounded-full border-4 border-gray-300 border-t-[#81198c] animate-spin" />
                            <p className="text-sm font-medium text-gray-700">
                                Creating IDW Layer...
                            </p>
                            <p className="text-xs text-gray-500">
                                {idwLayer === 'temperature' && 'Interpolating temperature data'}
                                {idwLayer === 'rainfall' && 'Interpolating rainfall data'}
                                {idwLayer === 'wind' && 'Interpolating wind data'}
                            </p>
                        </div>
                    </div>
                )}

                {/* LEFT CONTROLS — only in Leaflet view */}
                {!showTrafficMap && (
                    <div
                        className="
              absolute
              left-[10px]
              top-[135px]
              z-[1500]
              flex
              flex-col
              gap-2
              sm:top-[75px]
            "
                    >
                        <FullscreenButton
                            isFullscreen={isFullscreen}
                            onToggle={toggleFullscreen}
                        />
                        <BaseLayerSwitcher
                            activeLayer={baseLayer}
                            onSelect={setBaseLayer}
                        />
                    </div>
                )}

                {/* EXIT BUTTON - Only show when traffic view is active, positioned on left */}
                {showTrafficMap && (
                    <div
                        className="
              absolute
              left-[19px]
              sm:left-[22px]
              top-[150px]
              z-[1500]
              sm:top-[104px]
            "
                    >
                        <button
                            onClick={handleToggleTrafficMap}
                            className="
                flex items-center justify-center gap-1
                px-2 py-1
                rounded-lg
                shadow-md
                transition-all duration-200
                text-[12px] font-semibold
                whitespace-nowrap
                bg-blue-500 text-white hover:bg-blue-600
              "
                        >
                            <span>Exit</span>
                        </button>
                    </div>
                )}

                {/* TOP RIGHT CONTROLS - RESPONSIVE */}
                <div
                    className="
            absolute
            top-2
            left-1
            right-1
            z-[1500]
            flex
            flex-row
            flex-nowrap
            items-center
            justify-end
            gap-2
            sm:top-3
            sm:left-auto
            sm:right-3
            overflow-visible
          "
                >
                    {/* TRAFFIC BUTTON - Only show when NOT in traffic view */}
                    {!showTrafficMap && (
                        <div
                            className="
                shrink-0
                isolate
                [zoom:0.57]
                sm:[zoom:1]
              "
                        >
                            <button
                                onClick={handleToggleTrafficMap}
                                className="
                  flex items-center justify-center gap-1
                  px-2 py-1
                  rounded-lg
                  shadow-md
                  transition-all duration-200
                  text-[12px] font-semibold
                  whitespace-nowrap
                  bg-white text-gray-700 hover:bg-gray-50 border border-gray-200
                "
                            >
                                <TrafficCone className="w-4 h-4 shrink-0 text-blue-500" />
                                <span>Traffic</span>
                            </button>
                        </div>
                    )}

                    {!showTrafficMap && (
                        <>
                            <div
                                className="
                  shrink-0
                  [zoom:0.57]
                  sm:[zoom:1]
                "
                            >
                                <div className="hidden sm:block">
                                    <FlyoverDropdown
                                        flyovers={flyoverMarkers}
                                        visibleIds={visibleFlyoverIds}
                                        onToggle={handleToggleFlyover}
                                        onToggleAll={handleToggleAllFlyovers}
                                    />
                                </div>
                                <div className="block sm:hidden">
                                    <FlyoverDropdown
                                        flyovers={flyoverMarkers}
                                        visibleIds={visibleFlyoverIds}
                                        onToggle={handleToggleFlyover}
                                        onToggleAll={handleToggleAllFlyovers}
                                        compact={true}
                                    />
                                </div>
                            </div>

                            <div
                                className="
                  shrink-0
                  [zoom:0.57]
                  sm:[zoom:1]
                "
                            >
                                <div className="hidden md:block">
                                    <IdwLayerDropdown
                                        selectedId={idwLayer}
                                        onSelect={handleIdwSelect}
                                        selectedDate={selectedDate}
                                        onDateChange={handleDateChange}
                                        isLoading={isWeatherLoading || isIdwLayerLoading}
                                        dataCount={weatherData?.length || 0}
                                        error={idwError}
                                    />
                                </div>
                                <div className="block md:hidden">
                                    <IdwLayerDropdown
                                        selectedId={idwLayer}
                                        onSelect={handleIdwSelect}
                                        selectedDate={selectedDate}
                                        onDateChange={handleDateChange}
                                        isLoading={isWeatherLoading || isIdwLayerLoading}
                                        dataCount={weatherData?.length || 0}
                                        error={idwError}
                                        compact={true}
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {showTrafficMap ? (
                    <div style={{ height: "100%", width: "100%" }}>
                        <GoogleMapComponent />
                    </div>
                ) : (
                    <>
                        <MapContainer
                            ref={mapRef}
                            center={REGION_CENTER}
                            zoom={REGION_ZOOM}
                            minZoom={MIN_ZOOM}
                            maxZoom={MAX_ZOOM}
                            scrollWheelZoom
                            zoomControl
                            attributionControl={false}
                            style={{ height: "100%", width: "100%" }}
                        >
                            <ZoomTracker onZoomChange={setCurrentZoom} />

                            <FullscreenFit
                                data={fullscreenFitData}
                                isFullscreen={isFullscreen}
                            />

                            <TileLayer
                                key={baseLayer}
                                url={activeBaseLayerUrl}
                                subdomains={["mt0", "mt1", "mt2", "mt3"]}
                                maxZoom={20}
                                attribution="&copy; Google"
                            />

                            <FocusOnPoint
                                latlng={focusTarget.latlng}
                                triggerKey={focusTarget.key}
                                zoom={15}
                            />

                            <FlyoverMarkers
                                flyoverMarkers={flyoverMarkers}
                                visibleFlyoverIds={visibleFlyoverIds}
                                isDetailZoom={isDetailZoom}
                                isFullscreen={isFullscreen}
                                weather={weather}
                                weatherLoading={isWeatherLoading}
                                onSelectHighway={handleSelectHighway}
                                onSelectPoint={handleSelectPoint}
                            />
                        </MapContainer>
                    </>
                )}
            </div>

            {!isFullscreen && !showTrafficMap && (
                <div className="w-full lg:w-[380px] shrink-0 h-[420px] lg:h-full min-h-0">
                    <div className="w-full h-full min-h-0 flex flex-col gap-3">
                        <div className="flex-1 min-h-0 w-full rounded-xl2 overflow-hidden shadow-card ring-2 ring-gray-200 bg-white flex flex-col">
                            <div className="flex-1 min-h-0 overflow-y-auto">
                                <FlyoverDetailsPanel
                                    selectedHighway={selectedHighway}
                                    selectedPoint={selectedPoint}
                                    flyoverMarkers={flyoverMarkers}
                                    visibleFlyoverIds={visibleFlyoverIds}
                                    onSelectHighway={handleSelectHighway}
                                    onSelectPoint={handleSelectPoint}
                                />
                                {(selectedHighway || selectedPoint) && (
                                    <div className="px-3">
                                        <p className="text-sm font-bold text-gray-700 mb-2 px-1">Weather</p>
                                        <div className="h-[480px]">
                                            <WeatherPanel weather={weather} loading={isWeatherLoading} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}






//idwRenderer.jsx file
import L from 'leaflet';


function idwInterpolate(points, targetX, targetY, power = 2) {
    let numerator = 0;
    let denominator = 0;

    for (const point of points) {
        const dx = targetX - point.x;
        const dy = targetY - point.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;

        // Standard IDW weight (like ol-ext)
        const weight = 1 / Math.pow(dist, power);

        // IMPORTANT: Multiply by 'count' value (like ol-ext's weight: 'count')
        // In ol-ext, 'count' is the weight factor
        // Your Angular code passes count as the weight
        const countWeight = point.count || 1;

        numerator += weight * point.value * countWeight;
        denominator += weight * countWeight;
    }

    return numerator / denominator;
}

/**
 * VIBRANT color gradient for IDW
 */
function getColor(value) {
    const v = Math.max(0, Math.min(1, value));

    // 10-stop vibrant gradient
    const stops = [
        { pos: 0.00, r: 10, g: 20, b: 80 },      // Deep Navy
        { pos: 0.10, r: 20, g: 50, b: 130 },     // Dark Blue
        { pos: 0.25, r: 30, g: 90, b: 190 },     // Blue
        { pos: 0.40, r: 60, g: 160, b: 220 },    // Light Blue
        { pos: 0.50, r: 80, g: 200, b: 220 },    // Cyan
        { pos: 0.60, r: 120, g: 220, b: 140 },   // Light Green
        { pos: 0.70, r: 200, g: 230, b: 60 },    // Yellow-Green
        { pos: 0.80, r: 255, g: 210, b: 40 },    // Yellow
        { pos: 0.90, r: 255, g: 150, b: 20 },    // Orange
        { pos: 1.00, r: 220, g: 20, b: 20 },     // Red
    ];

    let i = 0;
    while (i < stops.length - 1 && stops[i + 1].pos < v) i++;

    if (i >= stops.length - 1) {
        const last = stops[stops.length - 1];
        return [last.r, last.g, last.b];
    }

    const from = stops[i];
    const to = stops[i + 1];
    const t = (v - from.pos) / (to.pos - from.pos);
    const smooth = t * t * (3 - 2 * t);

    return [
        Math.round(from.r + (to.r - from.r) * smooth),
        Math.round(from.g + (to.g - from.g) * smooth),
        Math.round(from.b + (to.b - from.b) * smooth)
    ];
}

/**
 * Main IDW Renderer - Matching Angular/ol-ext behavior
 */
export function renderIDWToCanvas(data, property, bounds, width, height) {
    return new Promise((resolve, reject) => {
        if (!data || data.length === 0) {
            reject(new Error('No data provided'));
            return;
        }

        try {
            console.time('IDW Render');
            console.log(`🎨 Starting IDW: ${width}x${height}, ${data.length} stations`);

            // Convert points to projected coordinates with COUNT
            // count = normalized value (0-100) like in Angular
            let minVal = Infinity;
            let maxVal = -Infinity;

            // First pass: calculate min/max
            data.forEach(item => {
                const value = parseFloat(item[property]);
                if (!Number.isNaN(value)) {
                    if (value < minVal) minVal = value;
                    if (value > maxVal) maxVal = value;
                }
            });
            const range = maxVal - minVal || 1;

            // Second pass: create points with count (like Angular)
            const points = data
                .map(item => {
                    const value = parseFloat(item[property]);
                    if (Number.isNaN(value) || value === null) return null;

                    const coord = L.CRS.EPSG3857.project(
                        L.latLng(item.latitude, item.longitude)
                    );

                    // Calculate count like Angular does
                    // count = percentage of max value (0-100)
                    const normalized = (value - minVal) / range;
                    const count = Math.max(1, Math.round(normalized * 100));

                    return {
                        x: coord.x,
                        y: coord.y,
                        value: value,
                        count: count, // ← This matches Angular's 'count'
                        lat: item.latitude,
                        lng: item.longitude
                    };
                })
                .filter(Boolean);

            if (points.length < 3) {
                reject(new Error(`Not enough points: ${points.length}`));
                return;
            }

            // Get map bounds
            const sw = L.CRS.EPSG3857.project(L.latLng(bounds.minLat, bounds.minLng));
            const ne = L.CRS.EPSG3857.project(L.latLng(bounds.maxLat, bounds.maxLng));

            const minX = sw.x;
            const maxX = ne.x;
            const minY = sw.y;
            const maxY = ne.y;

            // Calculate map dimensions
            const mapWidth = maxX - minX;
            const mapHeight = maxY - minY;

            console.log(`📊 Range: ${minVal.toFixed(2)} to ${maxVal.toFixed(2)}`);
            console.log(`📍 Map size: ${(mapWidth / 1000).toFixed(0)}km x ${(mapHeight / 1000).toFixed(0)}km`);

            // Create canvas with HIGH quality
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            // Use power=2 like ol-ext default
            const gridSize = 1; // Full resolution
            const power = 2.0; // Standard IDW power (matches ol-ext)

            const imageData = ctx.createImageData(width, height);
            const dataArray = imageData.data;

            const scaleX = (maxX - minX) / width;
            const scaleY = (maxY - minY) / height;

            let pixelsRendered = 0;

            // Render each pixel - using ALL points (no search radius)
            // This matches ol-ext's behavior exactly
            for (let py = 0; py < height; py += gridSize) {
                for (let px = 0; px < width; px += gridSize) {
                    const x = minX + px * scaleX;
                    const y = minY + py * scaleY;

                    // Skip outside bounds
                    if (x < minX || x > maxX || y < minY || y > maxY) {
                        continue;
                    }

                    // Interpolate using ALL points (like ol-ext)
                    const value = idwInterpolate(points, x, y, power);
                    const normalized = Math.max(0, Math.min(1, (value - minVal) / range));
                    const [r, g, b] = getColor(normalized);

                    const idx = (py * width + px) * 4;
                    if (idx < dataArray.length) {
                        dataArray[idx] = r;
                        dataArray[idx + 1] = g;
                        dataArray[idx + 2] = b;
                        dataArray[idx + 3] = 255; // FULL OPAQUE
                    }
                    pixelsRendered++;
                }
            }

            ctx.putImageData(imageData, 0, 0);

            console.log(`✅ Rendered ${pixelsRendered} pixels`);
            console.timeEnd('IDW Render');
            resolve(canvas);

        } catch (error) {
            console.error('❌ IDW Error:', error);
            reject(error);
        }
    });
}

export { getColor };






//idwlayerDropdown.jsx
import { useState } from "react";
import { ChevronDown, CloudSun, Calendar } from "lucide-react";

const IDW_LAYER_OPTIONS = [
    { id: "temperature", label: "Temperature" },
    { id: "rainfall", label: "Rainfall" },
    { id: "wind", label: "Wind" },
];


const toLocalDateStr = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
};

const parseLocalDateStr = (dateStr) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
};

export default function IdwLayerDropdown({
    selectedId,
    onSelect,
    selectedDate,
    onDateChange,
    isLoading,
    dataCount,
    error
}) {
    const [open, setOpen] = useState(false);
    const [datePickerOpen, setDatePickerOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // Pin "today" at local midnight once per render.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = toLocalDateStr(today);

    // Last selectable day = today + 7 (8 selectable days total, inclusive).
    const maxSelectable = new Date(today);
    maxSelectable.setDate(maxSelectable.getDate() + 2);
    const maxSelectableStr = toLocalDateStr(maxSelectable);

    // Use selectedDate or today as default
    const displayDate = selectedDate || todayStr;

    const selectedLabel =
        IDW_LAYER_OPTIONS.find((o) => o.id === selectedId)?.label || "Weather";

    const formatDisplayDate = (dateStr) => {
        if (!dateStr) return "Select Date";
        const date = parseLocalDateStr(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    // Get days in month
    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const days = [];

        const startDay = firstDay.getDay();

        for (let i = 0; i < startDay; i++) {
            days.push(null);
        }

        for (let i = 1; i <= lastDay.getDate(); i++) {
            const dateObj = new Date(year, month, i);
            const dateStr = toLocalDateStr(dateObj);
            days.push({
                day: i,
                date: dateStr,
                isToday: dateStr === todayStr,
                isSelected: dateStr === displayDate,
                isPast: dateStr < todayStr,
                isBeyondRange: dateStr > maxSelectableStr,
                isFuture: dateStr > todayStr
            });
        }

        return days;
    };

    const handleDateSelect = (dateStr) => {
        if (dateStr) {
            onDateChange(dateStr);
            setDatePickerOpen(false);
        }
    };

    const changeMonth = (increment) => {
        setCurrentMonth(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(prev.getMonth() + increment);
            return newDate;
        });
    };

    const monthYearDisplay = currentMonth.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
    });

    const days = getDaysInMonth(currentMonth);

    // Check if a valid IDW option is selected
    const hasValidSelection = selectedId && IDW_LAYER_OPTIONS.some(opt => opt.id === selectedId);

    return (
        <div className="relative flex items-center gap-1.5">
            {/* ===== IDW LAYER DROPDOWN ===== */}
            <div className="relative">
                <button
                    onClick={() => setOpen((o) => !o)}
                    className="flex items-center gap-2 bg-white rounded-lg shadow-md ring-1 ring-gray-200 px-3 py-1 text-[12px] font-semibold text-gray-700 hover:bg-gray-50"
                >
                    <CloudSun className="w-3.5 h-3.5 text-blue-500" />
                    {selectedLabel}
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                </button>

                {open && (
                    <>
                        <div className="fixed inset-0 z-[499]" onClick={() => setOpen(false)} />
                        <div className="absolute right-0 mt-1 w-32 bg-white rounded-lg shadow-lg ring-1 ring-gray-200 py-1 z-[500] overflow-hidden">
                            <button
                                onClick={() => {
                                    onSelect(null);
                                    setOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-[12px] font-medium hover:bg-gray-50 ${!selectedId ? "text-blue-600 bg-blue-50" : "text-gray-700"
                                    }`}
                            >
                                None
                            </button>
                            {IDW_LAYER_OPTIONS.map((opt) => (
                                <button
                                    key={opt.id}
                                    onClick={() => {
                                        onSelect(opt.id);
                                        setOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between text-left px-3 py-2 text-[12px] font-medium hover:bg-gray-50 ${selectedId === opt.id
                                        ? "text-blue-600 bg-blue-100"
                                        : "text-gray-700"
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* ===== DATE PICKER - Only show when valid option is selected ===== */}
            {hasValidSelection && (
                <div className="relative">
                    <button
                        onClick={() => setDatePickerOpen(!datePickerOpen)}
                        className="flex items-center gap-1.5 bg-white rounded-lg shadow-md ring-1 ring-gray-200 px-2.5 py-1 text-[12px] font-semibold text-gray-700 hover:bg-gray-50"
                    >
                        <Calendar className="w-3.5 h-3.5 text-blue-500" />
                        <span className="min-w-[70px]">{formatDisplayDate(displayDate)}</span>
                        <ChevronDown className="w-3 h-3 text-gray-400" />
                    </button>

                    {datePickerOpen && (
                        <>
                            <div className="fixed inset-0 z-[499]" onClick={() => setDatePickerOpen(false)} />
                            <div className="absolute right-0 mt-1 top-full bg-white rounded-lg shadow-lg ring-1 ring-gray-200 p-2 z-[500] w-[160px]">
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center justify-between px-1">
                                        <button
                                            onClick={() => changeMonth(-1)}
                                            className="p-0.5 hover:bg-gray-100 rounded-md transition-colors"
                                        >
                                            <ChevronDown className="w-3.5 h-3.5 text-gray-500 rotate-90" />
                                        </button>
                                        <span className="text-[11px] font-semibold text-gray-700">
                                            {monthYearDisplay}
                                        </span>
                                        <button
                                            onClick={() => changeMonth(1)}
                                            className="p-0.5 hover:bg-gray-100 rounded-md transition-colors"
                                        >
                                            <ChevronDown className="w-3.5 h-3.5 text-gray-500 -rotate-90" />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-7 gap-0.5 text-center">
                                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                                            <div key={day} className="text-[9px] font-semibold text-gray-600">
                                                {day}
                                            </div>
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-7 gap-0.5">
                                        {days.map((day, index) => {
                                            if (day === null) {
                                                return <div key={`empty-${index}`} className="h-6" />;
                                            }

                                            const isDisabled = day.isPast || day.isBeyondRange;
                                            const isSelected = day.date === displayDate;
                                            const isToday = day.date === todayStr;

                                            return (
                                                <button
                                                    key={day.date}
                                                    onClick={() => !isDisabled && handleDateSelect(day.date)}
                                                    disabled={isDisabled}
                                                    className={`
                            h-6 w-6 rounded text-[10px] font-medium transition-colors flex items-center justify-center
                            ${isDisabled ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-blue-50'}
                            ${isSelected ? 'bg-blue-500 text-white hover:bg-blue-600' : ''}
                            ${isToday && !isSelected ? 'bg-blue-50 text-blue-600' : ''}
                            ${!isDisabled && !isSelected && !isToday ? 'text-gray-700' : ''}
                          `}
                                                >
                                                    {day.day}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}












//useIDWWeather.jsx
import { useState, useCallback } from "react";
import { fetchIDWWeatherData } from "../services/api";


export function useIDWWeather() {
    const [weatherData, setWeatherData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedLayer, setSelectedLayer] = useState('rainfall'); // 'rainfall' | 'wind' | 'temperature'

    // Fetch weather data for a specific date

    const fetchWeather = useCallback(async (date) => {
        if (!date) {
            setError('Please select a date');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetchIDWWeatherData(date);

            if (response && response.data) {
                setWeatherData(response.data);
                setSelectedDate(date);
                console.log(`✅ Weather data loaded for ${date}:`, response.data.length, 'stations');
            } else {
                throw new Error('No data received from server');
            }
        } catch (err) {
            setError(err.message || 'Failed to fetch weather data');
            console.error('❌ Error fetching weather:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Change the active layer (only rainfall, wind, temperature)
    const changeLayer = useCallback((layer) => {
        if (['rainfall', 'wind', 'temperature'].includes(layer)) {
            setSelectedLayer(layer);
        } else {
            console.warn(`⚠️ Unknown layer: ${layer}`);
        }


    }, []);

    // Clear the current data
    const clearData = useCallback(() => {
        setWeatherData(null);
        setSelectedDate(null);
        setError(null);
    }, []);

    return {
        weatherData,
        loading,
        error,
        selectedDate,
        selectedLayer,
        fetchWeather,
        changeLayer,
        clearData,
    };

}