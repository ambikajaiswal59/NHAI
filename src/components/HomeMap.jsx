import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
    MapContainer,
    TileLayer,
    GeoJSON,
    Marker,
    useMap,
    useMapEvents,
    LayersControl,
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
} from "lucide-react";
import proj4 from 'proj4';

import { loadFlyoverData } from "../utils/geoJsonParser";
import { useWeather } from "../hooks/useWeather";
import WeatherPanel from "../components/WeatherPanel";
import FullscreenButton from "./map/FullscreenButton";
import FlyoverDropdown from "./map/FlyoverDropdown";
import IdwLayerDropdown from "./map/IdwLayerDropdown";
import FlyoverDetailsPanel from "./map/FlyoverDetailsPanel";
import FlyoverMarkers from "./map/FlyoverMarkers";
import { createIDWLayer } from "./IDWLeafletLayer";
import { fetchIDWWeatherData } from "../services/api";
import {
    ZoomTracker,
    FullscreenFit,
    FocusOnPoint,
    getFlyoverColor,
    getFlyoverDisplayName,
} from "./map/mapHelpers";

const REGION_CENTER = [30.353237, 76.731678];
const REGION_ZOOM = 12;
const DETAIL_LABEL_ZOOM = 16;

// ============================================================
// UTM to WGS84 Conversion Helper
// ============================================================
const UTM43N = '+proj=utm +zone=43 +datum=WGS84 +units=m +no_defs';
const WGS84 = 'EPSG:4326';

function convertBufferToWGS84(geojson) {
    if (!geojson || !geojson.features) return geojson;

    const convertCoords = (coords) => {
        // Check if this is a coordinate pair [x, y]
        if (Array.isArray(coords) && coords.length === 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
            // Check if it looks like UTM (large numbers > 1000)
            if (coords[0] > 1000 || coords[1] > 1000) {
                try {
                    const [x, y] = coords;
                    const [lng, lat] = proj4(UTM43N, WGS84, [x, y]);
                    return [lng, lat];
                } catch (e) {
                    console.warn('Failed to convert coordinate:', coords, e);
                    return coords;
                }
            }
            // Already WGS84 or small numbers, return as is
            return coords;
        }
        return coords.map(convertCoords);
    };

    return {
        ...geojson,
        features: geojson.features.map(f => ({
            ...f,
            geometry: {
                ...f.geometry,
                coordinates: convertCoords(f.geometry.coordinates)
            }
        }))
    };
}

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

function FadeInGeoJSON({
    data,
    style,
    targetOpacity = 1,
    targetFillOpacity,
    ...rest
}) {
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
            fillOpacity: visible ? (base.fillOpacity ?? targetFillOpacity ?? 0) : 0,
        };
    };

    return <GeoJSON data={data} style={computedStyle} {...rest} />;
}

function getRepresentativeLatLng(geojson) {
    if (!geojson || !geojson.features || geojson.features.length === 0)
        return null;
    const geometry = geojson.features[0].geometry;
    if (!geometry || !geometry.coordinates) return null;

    const flatten = (coords) => {
        if (typeof coords[0] === "number") return coords;
        return flatten(coords[0]);
    };

    const [lng, lat] = flatten(geometry.coordinates);
    if (typeof lat !== "number" || typeof lng !== "number") return null;
    return [lat, lng];
}

function findProp(props, keys) {
    if (!props) return null;
    for (const key of keys) {
        if (props[key] !== undefined && props[key] !== null && props[key] !== "") {
            return props[key];
        }
    }
    return null;
}

function getFlyoverProps(flyover) {
    return flyover?.geojson?.features?.[0]?.properties || {};
}

function getNhNumber(flyover) {
    return findProp(getFlyoverProps(flyover), [
        "nh_number", "NH_Number", "nhNumber", "NH_NO", "highway", "road_no", "road_number",
    ]);
}

function getShortCode(flyover, index) {
    const props = getFlyoverProps(flyover);
    return (
        findProp(props, ["code", "short_code", "structure_id", "structureId"]) ||
        flyover.id ||
        `F${index + 1}`
    );
}

function makeFlyoverIcon({ color, labelText, detailed }) {
    const width = detailed ? 240 : 120;
    return L.divIcon({
        className: "flyover-marker-icon",
        html: `
      <div style="display:flex; flex-direction:column; align-items:center; gap:3px; width:${width}px;">
        <div style="
                width: 28px; height: 28px;
                border-radius: 9999px;
                background: ${color};
                border: 2px solid white;
                box-shadow: 0 2px 6px rgba(0,0,0,0.35);
                display: flex; align-items: center; justify-content: center;
            ">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-7.58 8-13a8 8 0 1 0-16 0c0 5.42 8 13 8 13Z"></path>
            <circle cx="12" cy="9" r="2.5"></circle>
          </svg>
        </div>
        ${labelText
                ? `<div style="
                  background: white;
                  border: 1px solid ${color}55;
                  padding: 2px 7px;
                  border-radius: 6px;
                  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
                  font-size: ${detailed ? 11 : 10}px;
                  font-weight: 600;
                  color: #1f2937;
                  white-space: nowrap;
                  max-width: ${width - 10}px;
                  overflow: hidden;
                  text-overflow: ellipsis;
              ">${labelText}</div>`
                : ""
            }
      </div>
    `,
        iconSize: [width, 58],
        iconAnchor: [width / 2, 26],
    });
}

function StatChip({ label, value }) {
    return (
        <div className="flex flex-col gap-0.5 bg-gray-50 rounded-lg px-2 py-1.5 min-w-0 border border-gray-100">
            <span className="text-[9px] text-gray-400 uppercase tracking-wide truncate">
                {label}
            </span>
            <span className="text-[13px] font-bold text-gray-800 truncate">
                {value}
            </span>
        </div>
    );
}

// ============================================================
// MAIN HOMEMAP COMPONENT
// ============================================================
export default function HomeMap() {
    // ============================================================
    // 1. ALL STATE DECLARATIONS
    // ============================================================
    const [flyoversList, setFlyoversList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingStatus, setLoadingStatus] = useState("Initializing map...");
    const [overlayVisible, setOverlayVisible] = useState(true);
    const [selectedHighway, setSelectedHighway] = useState(null);
    const [selectedPoint, setSelectedPoint] = useState(null);
    const [visibleFlyoverIds, setVisibleFlyoverIds] = useState(new Set());
    const [currentZoom, setCurrentZoom] = useState(REGION_ZOOM);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // ===== IDW STATE =====
    const [idwLayer, setIdwLayer] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [weatherData, setWeatherData] = useState([]);
    const [weatherError, setWeatherError] = useState(null);
    const [weatherLoading, setWeatherLoading] = useState(false);
    const [idwLayerInstance, setIdwLayerInstance] = useState(null);
    const [bufferBoundary, setBufferBoundary] = useState(null);
    // ================================

    const mapWrapperRef = useRef(null);
    const mapRef = useRef(null);

    // ============================================================
    // 2. DERIVED DATA (useMemo)
    // ============================================================
    const flyoverMarkers = useMemo(() => {
        return flyoversList.map((flyover, index) => ({
            ...flyover,
            color: getFlyoverColor(index),
            displayName: getFlyoverDisplayName(flyover.type, index),
        }));
    }, [flyoversList]);

    const isDetailZoom = currentZoom >= DETAIL_LABEL_ZOOM;

    const weatherTarget = useMemo(() => {
        if (selectedPoint) {
            return {
                flyoverId: selectedPoint.id,
                lat: selectedPoint.latlng[0],
                lng: selectedPoint.latlng[1]
            };
        }
        if (selectedHighway) {
            return {
                flyoverId: selectedHighway.id,
                lat: selectedHighway.center[0],
                lng: selectedHighway.center[1]
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
                key: `point-${selectedPoint.id}`
            };
        }
        if (selectedHighway) {
            return {
                latlng: selectedHighway.center,
                key: `highway-${selectedHighway.id}`
            };
        }
        return { latlng: null, key: null };
    }, [selectedPoint, selectedHighway]);

    // ============================================================
    // 3. useWeather HOOK
    // ============================================================
    const { weather, loading: weatherLoadingFromHook } = useWeather(weatherTarget);
    const isWeatherLoading = weatherLoading || weatherLoadingFromHook;

    // ============================================================
    // 4. IDW HANDLERS
    // ============================================================
    const fetchWeatherData = useCallback(async (date) => {
        if (!date) {
            setWeatherError('Please select a date');
            return;
        }

        setWeatherLoading(true);
        setWeatherError(null);

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
            setWeatherError(err.message || 'Failed to fetch weather data');
            console.error('❌ Error fetching weather:', err);
        } finally {
            setWeatherLoading(false);
        }
    }, []);

    const handleIdwSelect = useCallback((layerId) => {
        setIdwLayer(layerId);
        if (layerId === null) {
            if (idwLayerInstance && mapRef.current) {
                try {
                    mapRef.current.removeLayer(idwLayerInstance);
                } catch (e) { }
                setIdwLayerInstance(null);
            }
        }
    }, [idwLayerInstance]);

    const handleDateChange = useCallback((date) => {
        setSelectedDate(date);
        fetchWeatherData(date);
    }, [fetchWeatherData]);

    // ============================================================
    // 5. LOAD BUFFER BOUNDARY WITH AUTO-CONVERSION
    // ============================================================
    useEffect(() => {
        let cancelled = false;

        const loadBufferBoundary = async () => {
            try {
                const response = await fetch('/data/AOI_Buffer.geojson');
                if (!response.ok) {
                    console.warn(`⚠️ Buffer.geojson request failed: ${response.status}`);
                    return;
                }
                const data = await response.json();

                if (!cancelled) {
                    // Check if the buffer needs conversion from UTM to WGS84
                    const isUTM = data.crs?.properties?.name?.includes('32643');
                    const isCRS84 = data.crs?.properties?.name?.includes('CRS84');

                    let processedData = data;

                    if (isUTM) {
                        console.log('🔄 Converting buffer from UTM (EPSG:32643) to WGS84...');
                        processedData = convertBufferToWGS84(data);
                        console.log('✅ Buffer converted to WGS84 successfully');
                    } else if (isCRS84) {
                        console.log('✅ Buffer already in WGS84 (CRS84) format');
                    } else {
                        // Check coordinates to determine if conversion is needed
                        const firstCoord = data?.features?.[0]?.geometry?.coordinates?.[0]?.[0];
                        if (firstCoord && Array.isArray(firstCoord) && firstCoord.length === 2) {
                            const [x, y] = firstCoord;
                            // If coordinates are large numbers (> 1000), they're likely UTM
                            if (x > 1000 || y > 1000) {
                                console.log('🔄 Detected UTM coordinates, converting to WGS84...');
                                processedData = convertBufferToWGS84(data);
                                console.log('✅ Buffer converted to WGS84 successfully');
                            } else {
                                console.log('✅ Buffer already in WGS84 format');
                            }
                        }
                    }

                    setBufferBoundary(processedData);
                    console.log('✅ Buffer boundary loaded for IDW clipping');
                }
            } catch (error) {
                console.warn('⚠️ Could not load Buffer.geojson, IDW will not be clipped:', error);
            }
        };

        loadBufferBoundary();
        return () => {
            cancelled = true;
        };
    }, []);

    // ============================================================
    // 6. IDW LAYER INTEGRATION
    // ============================================================
    useEffect(() => {
        if (idwLayerInstance && mapRef.current) {
            try {
                mapRef.current.removeLayer(idwLayerInstance);
            } catch (e) { }
            setIdwLayerInstance(null);
        }

        if (!idwLayer || !weatherData || weatherData.length === 0 || !mapRef.current) {
            return;
        }

        const propertyMap = {
            'temperature': 'temp_c',
            'rainfall': 'precip_mm',
            'wind': 'wind_kph'
        };
        const property = propertyMap[idwLayer];

        if (!property) return;

        try {
            console.log('🔍 Creating IDW layer with buffer:', {
                property,
                dataPoints: weatherData.length,
                hasBuffer: !!bufferBoundary,
                bufferType: bufferBoundary?.crs?.properties?.name || 'unknown'
            });

            const newLayer = createIDWLayer(weatherData, property, {
                opacity: 0.85,
                zIndex: 1000,
                clipPolygon: bufferBoundary,
                cacheKey: `${selectedDate || 'latest'}::${property}`,
            });

            newLayer.addTo(mapRef.current);
            setIdwLayerInstance(newLayer);

            console.log(`✅ IDW layer added for ${idwLayer}:`, {
                property: property,
                dataPoints: weatherData.length,
                clippedToBuffer: !!bufferBoundary,
            });

        } catch (error) {
            console.error('Error creating IDW layer:', error);
            setWeatherError('Failed to render IDW layer');
        }

        return () => {
            if (idwLayerInstance && mapRef.current) {
                try {
                    mapRef.current.removeLayer(idwLayerInstance);
                } catch (e) { }
                setIdwLayerInstance(null);
            }
        };
    }, [idwLayer, weatherData, bufferBoundary, selectedDate]);

    // ============================================================
    // 7. INITIAL WEATHER LOAD
    // ============================================================
    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        setSelectedDate(today);
        fetchWeatherData(today);
    }, [fetchWeatherData]);

    // ============================================================
    // 8. FLYOVER DATA LOADING
    // ============================================================
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

    // ============================================================
    // 9. EFFECTS
    // ============================================================
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
        const handleChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
        document.addEventListener("fullscreenchange", handleChange);
        return () => document.removeEventListener("fullscreenchange", handleChange);
    }, []);

    // ============================================================
    // 10. CALLBACKS
    // ============================================================
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

    // ============================================================
    // 11. RENDER
    // ============================================================
    return (
        <div ref={mapWrapperRef} className="w-full h-[540px] flex flex-col lg:flex-row gap-3 bg-white">
            <div className="relative flex-1 lg:basis-2/3 rounded-xl2 overflow-hidden shadow-card ring-2 ring-gray-200">
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

                <div className="absolute bottom-3 left-3 z-[500]">
                    <FullscreenButton isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
                </div>

                <div className="absolute top-3 right-3 z-[500] flex items-center gap-2">
                    <FlyoverDropdown
                        flyovers={flyoverMarkers}
                        visibleIds={visibleFlyoverIds}
                        onToggle={handleToggleFlyover}
                        onToggleAll={handleToggleAllFlyovers}
                    />
                    <IdwLayerDropdown
                        selectedId={idwLayer}
                        onSelect={handleIdwSelect}
                        selectedDate={selectedDate}
                        onDateChange={handleDateChange}
                        isLoading={isWeatherLoading}
                        dataCount={weatherData.length}
                        error={weatherError}
                    />
                </div>

                <MapContainer
                    ref={mapRef}
                    center={REGION_CENTER}
                    zoom={REGION_ZOOM}
                    scrollWheelZoom
                    zoomControl
                    attributionControl={false}
                    style={{ height: "100%", width: "100%" }}
                >
                    <ZoomTracker onZoomChange={setCurrentZoom} />
                    <FullscreenFit data={fullscreenFitData} isFullscreen={isFullscreen} />
                    <FocusOnPoint latlng={focusTarget.latlng} triggerKey={focusTarget.key} zoom={15} />

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
                        </LayersControl>
                    </div>

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
            </div>

            {!isFullscreen && (
                <div className="lg:basis-1/3 rounded-xl2 overflow-hidden shadow-card ring-2 ring-gray-200 bg-white flex flex-col">
                    <div className="flex-1 overflow-y-auto">
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
            )}
        </div>
    );
}







// import { useEffect, useState, useCallback, useRef, useMemo } from "react";
// import {
//     MapContainer,
//     TileLayer,
//     GeoJSON,
//     Marker,
//     useMap,
//     useMapEvents,
//     LayersControl,
// } from "react-leaflet";
// import L from "leaflet";
// import "leaflet/dist/leaflet.css";
// import {
//     MapPin,
//     X,
//     ChevronDown,
//     Waypoints,
//     Maximize,
//     Minimize,
//     Check,
//     Layers,
//     Calendar,
// } from "lucide-react";

// import { loadFlyoverData } from "../utils/geoJsonParser";
// import { useWeather } from "../hooks/useWeather";
// import WeatherPanel from "../components/WeatherPanel";
// import FullscreenButton from "./map/FullscreenButton";
// import FlyoverDropdown from "./map/FlyoverDropdown";
// import IdwLayerDropdown from "./map/IdwLayerDropdown";
// import FlyoverDetailsPanel from "./map/FlyoverDetailsPanel";
// import FlyoverMarkers from "./map/FlyoverMarkers";
// import { createIDWLayer } from "./IDWLeafletLayer";
// import { fetchIDWWeatherData } from "../services/api";
// import {
//     ZoomTracker,
//     FullscreenFit,
//     FocusOnPoint,
//     getFlyoverColor,
//     getFlyoverDisplayName,
// } from "./map/mapHelpers";

// const REGION_CENTER = [30.353237, 76.731678];
// const REGION_ZOOM = 12;
// const DETAIL_LABEL_ZOOM = 16;

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

// function FadeInGeoJSON({
//     data,
//     style,
//     targetOpacity = 1,
//     targetFillOpacity,
//     ...rest
// }) {
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
//             fillOpacity: visible ? (base.fillOpacity ?? targetFillOpacity ?? 0) : 0,
//         };
//     };

//     return <GeoJSON data={data} style={computedStyle} {...rest} />;
// }

// function getRepresentativeLatLng(geojson) {
//     if (!geojson || !geojson.features || geojson.features.length === 0)
//         return null;
//     const geometry = geojson.features[0].geometry;
//     if (!geometry || !geometry.coordinates) return null;

//     const flatten = (coords) => {
//         if (typeof coords[0] === "number") return coords;
//         return flatten(coords[0]);
//     };

//     const [lng, lat] = flatten(geometry.coordinates);
//     if (typeof lat !== "number" || typeof lng !== "number") return null;
//     return [lat, lng];
// }

// function findProp(props, keys) {
//     if (!props) return null;
//     for (const key of keys) {
//         if (props[key] !== undefined && props[key] !== null && props[key] !== "") {
//             return props[key];
//         }
//     }
//     return null;
// }

// function getFlyoverProps(flyover) {
//     return flyover?.geojson?.features?.[0]?.properties || {};
// }

// function getNhNumber(flyover) {
//     return findProp(getFlyoverProps(flyover), [
//         "nh_number", "NH_Number", "nhNumber", "NH_NO", "highway", "road_no", "road_number",
//     ]);
// }

// function getShortCode(flyover, index) {
//     const props = getFlyoverProps(flyover);
//     return (
//         findProp(props, ["code", "short_code", "structure_id", "structureId"]) ||
//         flyover.id ||
//         `F${index + 1}`
//     );
// }

// function makeFlyoverIcon({ color, labelText, detailed }) {
//     const width = detailed ? 240 : 120;
//     return L.divIcon({
//         className: "flyover-marker-icon",
//         html: `
//       <div style="display:flex; flex-direction:column; align-items:center; gap:3px; width:${width}px;">
//         <div style="
//                 width: 28px; height: 28px;
//                 border-radius: 9999px;
//                 background: ${color};
//                 border: 2px solid white;
//                 box-shadow: 0 2px 6px rgba(0,0,0,0.35);
//                 display: flex; align-items: center; justify-content: center;
//             ">
//           <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
//             <path d="M12 22s8-7.58 8-13a8 8 0 1 0-16 0c0 5.42 8 13 8 13Z"></path>
//             <circle cx="12" cy="9" r="2.5"></circle>
//           </svg>
//         </div>
//         ${labelText
//                 ? `<div style="
//                   background: white;
//                   border: 1px solid ${color}55;
//                   padding: 2px 7px;
//                   border-radius: 6px;
//                   box-shadow: 0 1px 4px rgba(0,0,0,0.2);
//                   font-size: ${detailed ? 11 : 10}px;
//                   font-weight: 600;
//                   color: #1f2937;
//                   white-space: nowrap;
//                   max-width: ${width - 10}px;
//                   overflow: hidden;
//                   text-overflow: ellipsis;
//               ">${labelText}</div>`
//                 : ""
//             }
//       </div>
//     `,
//         iconSize: [width, 58],
//         iconAnchor: [width / 2, 26],
//     });
// }

// function StatChip({ label, value }) {
//     return (
//         <div className="flex flex-col gap-0.5 bg-gray-50 rounded-lg px-2 py-1.5 min-w-0 border border-gray-100">
//             <span className="text-[9px] text-gray-400 uppercase tracking-wide truncate">
//                 {label}
//             </span>
//             <span className="text-[13px] font-bold text-gray-800 truncate">
//                 {value}
//             </span>
//         </div>
//     );
// }

// // ============================================================
// // MAIN HOMEMAP COMPONENT
// // ============================================================
// export default function HomeMap() {
//     // ============================================================
//     // 1. ALL STATE DECLARATIONS
//     // ============================================================
//     const [flyoversList, setFlyoversList] = useState([]);
//     const [loading, setLoading] = useState(true);
//     const [loadingStatus, setLoadingStatus] = useState("Initializing map...");
//     const [overlayVisible, setOverlayVisible] = useState(true);
//     const [selectedHighway, setSelectedHighway] = useState(null);
//     const [selectedPoint, setSelectedPoint] = useState(null);
//     const [visibleFlyoverIds, setVisibleFlyoverIds] = useState(new Set());
//     const [currentZoom, setCurrentZoom] = useState(REGION_ZOOM);
//     const [isFullscreen, setIsFullscreen] = useState(false);

//     // ===== IDW STATE - ADD THESE =====
//     const [idwLayer, setIdwLayer] = useState(null);
//     const [selectedDate, setSelectedDate] = useState(null);
//     const [weatherData, setWeatherData] = useState([]);
//     const [weatherError, setWeatherError] = useState(null);
//     const [weatherLoading, setWeatherLoading] = useState(false);
//     const [idwLayerInstance, setIdwLayerInstance] = useState(null);
//     const [bufferBoundary, setBufferBoundary] = useState(null);
//     // ================================

//     const mapWrapperRef = useRef(null);
//     const mapRef = useRef(null);

//     // ============================================================
//     // 2. DERIVED DATA (useMemo)
//     // ============================================================
//     const flyoverMarkers = useMemo(() => {
//         return flyoversList.map((flyover, index) => ({
//             ...flyover,
//             color: getFlyoverColor(index),
//             displayName: getFlyoverDisplayName(flyover.type, index),
//         }));
//     }, [flyoversList]);

//     const isDetailZoom = currentZoom >= DETAIL_LABEL_ZOOM;

//     const weatherTarget = useMemo(() => {
//         if (selectedPoint) {
//             return {
//                 flyoverId: selectedPoint.id,
//                 lat: selectedPoint.latlng[0],
//                 lng: selectedPoint.latlng[1]
//             };
//         }
//         if (selectedHighway) {
//             return {
//                 flyoverId: selectedHighway.id,
//                 lat: selectedHighway.center[0],
//                 lng: selectedHighway.center[1]
//             };
//         }
//         return null;
//     }, [selectedPoint, selectedHighway]);

//     const fullscreenFitData = useMemo(() => {
//         if (selectedHighway) return selectedHighway.geojson || null;
//         const visible = flyoverMarkers.filter((f) => visibleFlyoverIds.has(f.id));
//         if (visible.length === 0) return null;
//         return {
//             type: "FeatureCollection",
//             features: visible.flatMap((f) => f.geojson?.features || []),
//         };
//     }, [selectedHighway, flyoverMarkers, visibleFlyoverIds]);

//     const focusTarget = useMemo(() => {
//         if (selectedPoint) {
//             return {
//                 latlng: selectedPoint.latlng,
//                 key: `point-${selectedPoint.id}`
//             };
//         }
//         if (selectedHighway) {
//             return {
//                 latlng: selectedHighway.center,
//                 key: `highway-${selectedHighway.id}`
//             };
//         }
//         return { latlng: null, key: null };
//     }, [selectedPoint, selectedHighway]);

//     // ============================================================
//     // 3. useWeather HOOK
//     // ============================================================
//     const { weather, loading: weatherLoadingFromHook } = useWeather(weatherTarget);
//     const isWeatherLoading = weatherLoading || weatherLoadingFromHook;

//     // ============================================================
//     // 4. IDW HANDLERS - ADD THESE
//     // ============================================================
//     const fetchWeatherData = useCallback(async (date) => {
//         if (!date) {
//             setWeatherError('Please select a date');
//             return;
//         }

//         setWeatherLoading(true);
//         setWeatherError(null);

//         try {
//             const response = await fetchIDWWeatherData(date);
//             if (response && response.data) {
//                 setWeatherData(response.data);
//                 setSelectedDate(date);
//                 console.log(`✅ Weather data loaded for ${date}:`, response.data.length, 'stations');
//             } else {
//                 throw new Error('No data received from server');
//             }
//         } catch (err) {
//             setWeatherError(err.message || 'Failed to fetch weather data');
//             console.error('❌ Error fetching weather:', err);
//         } finally {
//             setWeatherLoading(false);
//         }
//     }, []);

//     const handleIdwSelect = useCallback((layerId) => {
//         setIdwLayer(layerId);
//         if (layerId === null) {
//             if (idwLayerInstance && mapRef.current) {
//                 try {
//                     mapRef.current.removeLayer(idwLayerInstance);
//                 } catch (e) { }
//                 setIdwLayerInstance(null);
//             }
//         }
//     }, [idwLayerInstance]);

//     const handleDateChange = useCallback((date) => {
//         setSelectedDate(date);
//         fetchWeatherData(date);
//     }, [fetchWeatherData]);

//     // ============================================================
//     // 5. LOAD BUFFER BOUNDARY - ADD THIS
//     // ============================================================
//     useEffect(() => {
//         let cancelled = false;

//         const loadBufferBoundary = async () => {
//             try {
//                 const response = await fetch('/data/Buffer.geojson');
//                 if (!response.ok) {
//                     console.warn(`⚠️ Buffer.geojson request failed: ${response.status}`);
//                     return;
//                 }
//                 const data = await response.json();
//                 if (!cancelled) {
//                     setBufferBoundary(data);
//                     console.log('✅ Buffer boundary loaded for IDW clipping');
//                 }
//             } catch (error) {
//                 console.warn('⚠️ Could not load Buffer.geojson, IDW will not be clipped:', error);
//             }
//         };

//         loadBufferBoundary();
//         return () => {
//             cancelled = true;
//         };
//     }, []);

//     // ============================================================
//     // 6. IDW LAYER INTEGRATION - ADD THIS
//     // ============================================================
//     useEffect(() => {
//         if (idwLayerInstance && mapRef.current) {
//             try {
//                 mapRef.current.removeLayer(idwLayerInstance);
//             } catch (e) { }
//             setIdwLayerInstance(null);
//         }

//         if (!idwLayer || !weatherData || weatherData.length === 0 || !mapRef.current) {
//             return;
//         }

//         const propertyMap = {
//             'temperature': 'temp_c',
//             'rainfall': 'precip_mm',
//             'wind': 'wind_kph'
//         };
//         const property = propertyMap[idwLayer];

//         if (!property) return;

//         try {
//             const newLayer = createIDWLayer(weatherData, property, {
//                 opacity: 0.85,
//                 zIndex: 1000,
//                 clipPolygon: bufferBoundary,
//                 cacheKey: `${selectedDate || 'latest'}::${property}`,
//             });

//             newLayer.addTo(mapRef.current);
//             setIdwLayerInstance(newLayer);

//             console.log(`✅ IDW layer added for ${idwLayer}:`, {
//                 property: property,
//                 dataPoints: weatherData.length,
//                 clippedToBuffer: !!bufferBoundary,
//             });

//         } catch (error) {
//             console.error('Error creating IDW layer:', error);
//             setWeatherError('Failed to render IDW layer');
//         }

//         return () => {
//             if (idwLayerInstance && mapRef.current) {
//                 try {
//                     mapRef.current.removeLayer(idwLayerInstance);
//                 } catch (e) { }
//                 setIdwLayerInstance(null);
//             }
//         };
//     }, [idwLayer, weatherData, bufferBoundary, selectedDate]);

//     // ============================================================
//     // 7. INITIAL WEATHER LOAD - ADD THIS
//     // ============================================================
//     useEffect(() => {
//         const today = new Date().toISOString().split('T')[0];
//         setSelectedDate(today);
//         fetchWeatherData(today);
//     }, [fetchWeatherData]);

//     // ============================================================
//     // 8. FLYOVER DATA LOADING
//     // ============================================================
//     const loadFlyovers = useCallback(async () => {
//         try {
//             const flyovers = await loadFlyoverData();
//             if (flyovers && flyovers.length > 0) {
//                 const list = flyovers.map((flyover, index) => ({
//                     id: flyover.id ?? `flyover-${index + 1}`,
//                     geojson: flyover.geojson,
//                     riskStatus: flyover.riskStatus,
//                     center: flyover.center,
//                     type: flyover.type,
//                     namedPoints: flyover.namedPoints || [],
//                 }));
//                 setFlyoversList(list);
//                 setVisibleFlyoverIds(new Set(list.map((f) => f.id)));
//             }
//             setLoadingStatus("Ready");
//         } catch (err) {
//             console.error(err);
//             setLoadingStatus("Failed to load flyover data");
//         } finally {
//             setLoading(false);
//         }
//     }, []);

//     // ============================================================
//     // 9. EFFECTS
//     // ============================================================
//     useEffect(() => {
//         const loadBaseLayers = async () => {
//             try {
//                 setLoadingStatus("Loading map layers...");
//                 await loadFlyovers();
//             } catch (err) {
//                 console.error(err);
//                 setLoadingStatus("Failed to load map data");
//                 setLoading(false);
//             }
//         };
//         loadBaseLayers();
//     }, [loadFlyovers]);

//     useEffect(() => {
//         if (!loading) {
//             const timeout = setTimeout(() => setOverlayVisible(false), 500);
//             return () => clearTimeout(timeout);
//         }
//     }, [loading]);

//     useEffect(() => {
//         const handleChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
//         document.addEventListener("fullscreenchange", handleChange);
//         return () => document.removeEventListener("fullscreenchange", handleChange);
//     }, []);

//     // ============================================================
//     // 10. CALLBACKS
//     // ============================================================
//     const toggleFullscreen = useCallback(() => {
//         if (!document.fullscreenElement) {
//             mapWrapperRef.current?.requestFullscreen?.();
//         } else {
//             document.exitFullscreen?.();
//         }
//     }, []);

//     const handleSelectHighway = useCallback((highway) => {
//         setSelectedHighway(highway);
//         setSelectedPoint(null);
//     }, []);

//     const handleSelectPoint = useCallback((point, highway) => {
//         setSelectedPoint(point);
//         setSelectedHighway(highway || null);
//     }, []);

//     const handleToggleFlyover = useCallback((id) => {
//         setVisibleFlyoverIds((prev) => {
//             const next = new Set(prev);
//             if (next.has(id)) next.delete(id);
//             else next.add(id);
//             return next;
//         });
//         setSelectedHighway((prev) => {
//             if (prev?.id === id) {
//                 setSelectedPoint(null);
//                 return null;
//             }
//             return prev;
//         });
//     }, []);

//     const handleToggleAllFlyovers = useCallback(() => {
//         setVisibleFlyoverIds((prev) =>
//             prev.size === flyoverMarkers.length && flyoverMarkers.length > 0
//                 ? new Set()
//                 : new Set(flyoverMarkers.map((f) => f.id)),
//         );
//     }, [flyoverMarkers]);

//     // ============================================================
//     // 11. RENDER
//     // ============================================================
//     return (
//         <div ref={mapWrapperRef} className="w-full h-[540px] flex flex-col lg:flex-row gap-3 bg-white">
//             <div className="relative flex-1 lg:basis-2/3 rounded-xl2 overflow-hidden shadow-card ring-2 ring-gray-200">
//                 {overlayVisible && (
//                     <div
//                         className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/70 backdrop-blur-sm transition-opacity duration-500"
//                         style={{ opacity: loading ? 1 : 0 }}
//                     >
//                         <div className="flex flex-col items-center gap-3">
//                             <div className="h-8 w-8 rounded-full border-4 border-gray-300 border-t-[#81198c] animate-spin" />
//                             <p className="text-sm text-gray-700">{loadingStatus}</p>
//                         </div>
//                     </div>
//                 )}

//                 <div className="absolute bottom-3 left-3 z-[500]">
//                     <FullscreenButton isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
//                 </div>

//                 <div className="absolute top-3 right-3 z-[500] flex items-center gap-2">
//                     <FlyoverDropdown
//                         flyovers={flyoverMarkers}
//                         visibleIds={visibleFlyoverIds}
//                         onToggle={handleToggleFlyover}
//                         onToggleAll={handleToggleAllFlyovers}
//                     />
//                     {/* ===== IDW LAYER DROPDOWN - ADD THIS ===== */}
//                     <IdwLayerDropdown
//                         selectedId={idwLayer}
//                         onSelect={handleIdwSelect}
//                         selectedDate={selectedDate}
//                         onDateChange={handleDateChange}
//                         isLoading={isWeatherLoading}
//                         dataCount={weatherData.length}
//                         error={weatherError}
//                     />
//                 </div>

//                 <MapContainer
//                     ref={mapRef}
//                     center={REGION_CENTER}
//                     zoom={REGION_ZOOM}
//                     scrollWheelZoom
//                     zoomControl
//                     attributionControl={false}
//                     style={{ height: "100%", width: "100%" }}
//                 >
//                     <ZoomTracker onZoomChange={setCurrentZoom} />
//                     <FullscreenFit data={fullscreenFitData} isFullscreen={isFullscreen} />
//                     <FocusOnPoint latlng={focusTarget.latlng} triggerKey={focusTarget.key} zoom={15} />

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
//                         </LayersControl>
//                     </div>

//                     <FlyoverMarkers
//                         flyoverMarkers={flyoverMarkers}
//                         visibleFlyoverIds={visibleFlyoverIds}
//                         isDetailZoom={isDetailZoom}
//                         isFullscreen={isFullscreen}
//                         weather={weather}
//                         weatherLoading={isWeatherLoading}
//                         onSelectHighway={handleSelectHighway}
//                         onSelectPoint={handleSelectPoint}
//                     />
//                 </MapContainer>
//             </div>

//             {!isFullscreen && (
//                 <div className="lg:basis-1/3 rounded-xl2 overflow-hidden shadow-card ring-2 ring-gray-200 bg-white flex flex-col">
//                     <div className="flex-1 overflow-y-auto">
//                         <FlyoverDetailsPanel
//                             selectedHighway={selectedHighway}
//                             selectedPoint={selectedPoint}
//                             flyoverMarkers={flyoverMarkers}
//                             visibleFlyoverIds={visibleFlyoverIds}
//                             onSelectHighway={handleSelectHighway}
//                             onSelectPoint={handleSelectPoint}
//                         />

//                         {(selectedHighway || selectedPoint) && (
//                             <div className="px-3">
//                                 <p className="text-sm font-bold text-gray-700 mb-2 px-1">Weather</p>
//                                 <div className="h-[480px]">
//                                     <WeatherPanel weather={weather} loading={isWeatherLoading} />
//                                 </div>
//                             </div>
//                         )}
//                     </div>
//                 </div>
//             )}
//         </div>
//     );
// }