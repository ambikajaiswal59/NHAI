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

import { loadFlyoverData } from "../utils/geoJsonParser";
import WeatherPanel from "./WeatherPanel";
import { createIDWLayer } from "./IDWLeafletLayer";
import { fetchIDWWeatherData } from "../services/api";

// Centered on Haryana
const REGION_CENTER = [30.3782, 76.7767];
const REGION_ZOOM = 10;

// One color per flyover
const FLYOVER_COLORS = [
    "#DC2626", // red
    "#2563EB", // blue
    "#059669", // green
    "#D97706", // amber
    "#7C3AED", // violet
    "#DB2777", // pink
];

function getFlyoverColor(index) {
    return FLYOVER_COLORS[index % FLYOVER_COLORS.length];
}

const DETAIL_LABEL_ZOOM = 16;

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

function ZoomTracker({ onZoomChange }) {
    const map = useMap();

    useMapEvents({
        zoomend: () => onZoomChange(map.getZoom()),
    });

    useEffect(() => {
        onZoomChange(map.getZoom());
    }, []);

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

function FullscreenButton({ targetRef }) {
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const handleChange = () =>
            setIsFullscreen(Boolean(document.fullscreenElement));
        document.addEventListener("fullscreenchange", handleChange);
        return () => document.removeEventListener("fullscreenchange", handleChange);
    }, []);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            targetRef.current?.requestFullscreen?.();
        } else {
            document.exitFullscreen?.();
        }
    };

    return (
        <button
            onClick={toggleFullscreen}
            className="flex items-center justify-center bg-white rounded-lg shadow-md ring-1 ring-gray-200 w-9 h-9 hover:bg-gray-50"
            aria-label="Toggle fullscreen"
        >
            {isFullscreen ? (
                <Minimize className="w-4 h-4 text-gray-600" />
            ) : (
                <Maximize className="w-4 h-4 text-gray-600" />
            )}
        </button>
    );
}

function FlyoverDropdown({ flyovers, visibleIds, onToggle, onToggleAll }) {
    const [open, setOpen] = useState(false);

    const allSelected = flyovers.length > 0 && visibleIds.size === flyovers.length;
    const noneSelected = visibleIds.size === 0;

    const label = allSelected
        ? "Flyovers"
        : noneSelected
            ? "No Flyovers"
            : `${visibleIds.size} of ${flyovers.length} Flyovers`;

    return (
        <div className="relative">
            <button
                onClick={() => setOpen((o) => !o)}
                className="flex items-center gap-2 bg-white rounded-lg shadow-md ring-1 ring-gray-200 px-3 py-2 text-[12px] font-semibold text-gray-700 hover:bg-gray-50"
            >
                <Waypoints className="w-3.5 h-3.5 text-blue-500" />
                {label}
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>

            {open && (
                <>
                    <div
                        className="fixed inset-0 z-[499]"
                        onClick={() => setOpen(false)}
                    />
                    <div className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg ring-1 ring-gray-200 py-1 z-[500] overflow-hidden">
                        <button
                            onClick={onToggleAll}
                            className="w-full text-left px-3 py-2 text-[12px] font-semibold text-blue-600 hover:bg-blue-50 border-b border-gray-100"
                        >
                            {allSelected ? "Clear all" : "Select all"}
                        </button>
                        {flyovers.map((f) => {
                            const checked = visibleIds.has(f.id);
                            return (
                                <button
                                    key={f.id}
                                    onClick={() => onToggle(f.id)}
                                    className="w-full flex items-center gap-2 text-left px-3 py-2 text-[12px] font-medium text-gray-700 hover:bg-gray-50"
                                >
                                    <span
                                        className="w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0"
                                        style={{
                                            background: checked ? f.color : "transparent",
                                            border: `1.5px solid ${f.color}`,
                                        }}
                                    >
                                        {checked && <Check className="w-2.5 h-2.5 text-white" />}
                                    </span>
                                    <span className="truncate">{f.name}</span>
                                </button>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}

// ============================================================
// IDW LAYER DROPDOWN WITH PROPER CALENDAR DATE PICKER
// ============================================================
const IDW_LAYER_OPTIONS = [
    { id: "temperature", label: "Temperature" },
    { id: "rainfall", label: "Rainfall" },
    { id: "wind", label: "Wind" },
];

function IdwLayerDropdown({ selectedId, onSelect, selectedDate, onDateChange, isLoading, dataCount, error }) {
    const [open, setOpen] = useState(false);
    const [datePickerOpen, setDatePickerOpen] = useState(false);
    const [tempDate, setTempDate] = useState(selectedDate || '');

    const selectedLabel =
        IDW_LAYER_OPTIONS.find((o) => o.id === selectedId)?.label || "IDW Layer";

    const formatDisplayDate = (dateStr) => {
        if (!dateStr) return "Select Date";
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const handleDateInputChange = (e) => {
        const value = e.target.value;
        setTempDate(value);
        if (value) {
            onDateChange(value);
            setDatePickerOpen(false);
        }
    };

    // Get today's date for min attribute
    const today = new Date().toISOString().split('T')[0];

    // Get date 7 days from today for max attribute
    const maxDateObj = new Date();
    maxDateObj.setDate(maxDateObj.getDate() + 7);
    const maxDate = maxDateObj.toISOString().split('T')[0];

    // Get dates for quick buttons
    const getDates = () => {
        const todayDate = new Date();
        const tomorrow = new Date(todayDate);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dayAfterTomorrow = new Date(todayDate);
        dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

        const formatDate = (date) => date.toISOString().split('T')[0];
        return {
            today: formatDate(todayDate),
            tomorrow: formatDate(tomorrow),
            dayAfterTomorrow: formatDate(dayAfterTomorrow)
        };
    };

    const dates = getDates();

    return (
        <div className="relative flex items-center gap-1.5">
            {/* Calendar Date Picker */}
            <div className="relative">
                <button
                    onClick={() => setDatePickerOpen(!datePickerOpen)}
                    className="flex items-center gap-1.5 bg-white rounded-lg shadow-md ring-1 ring-gray-200 px-2.5 py-2 text-[12px] font-semibold text-gray-700 hover:bg-gray-50"
                >
                    <Calendar className="w-3.5 h-3.5 text-gray-500" />
                    <span className="min-w-[70px]">{formatDisplayDate(selectedDate)}</span>
                    <ChevronDown className="w-3 h-3 text-gray-400" />
                </button>

                {datePickerOpen && (
                    <>
                        <div className="fixed inset-0 z-[499]" onClick={() => setDatePickerOpen(false)} />
                        <div className="absolute right-0 mt-1 top-full bg-white rounded-lg shadow-lg ring-1 ring-gray-200 p-3 z-[500] w-[240px]">
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-[11px] font-medium text-gray-600">Select Date</label>
                                    <span className="text-[9px] text-gray-400">(Next 7 days)</span>
                                </div>
                                <input
                                    type="date"
                                    value={tempDate || selectedDate || ''}
                                    onChange={handleDateInputChange}
                                    min={today}
                                    max={maxDate}
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    autoFocus
                                />
                                {/* <div className="flex gap-1.5 mt-1">
                                    <button
                                        onClick={() => {
                                            const todayStr = new Date().toISOString().split('T')[0];
                                            setTempDate(todayStr);
                                            onDateChange(todayStr);
                                            setDatePickerOpen(false);
                                        }}
                                        className="flex-1 px-2 py-1 text-[11px] font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100"
                                    >
                                        Today
                                    </button>
                                    <button
                                        onClick={() => {
                                            const tomorrow = new Date();
                                            tomorrow.setDate(tomorrow.getDate() + 1);
                                            const tomorrowStr = tomorrow.toISOString().split('T')[0];
                                            setTempDate(tomorrowStr);
                                            onDateChange(tomorrowStr);
                                            setDatePickerOpen(false);
                                        }}
                                        className="flex-1 px-2 py-1 text-[11px] font-medium text-gray-600 bg-gray-50 rounded-md hover:bg-gray-100"
                                    >
                                        Tomorrow
                                    </button>
                                    <button
                                        onClick={() => {
                                            const dayAfter = new Date();
                                            dayAfter.setDate(dayAfter.getDate() + 2);
                                            const dayAfterStr = dayAfter.toISOString().split('T')[0];
                                            setTempDate(dayAfterStr);
                                            onDateChange(dayAfterStr);
                                            setDatePickerOpen(false);
                                        }}
                                        className="flex-1 px-2 py-1 text-[11px] font-medium text-gray-600 bg-gray-50 rounded-md hover:bg-gray-100"
                                    >
                                        +2 Days
                                    </button>
                                </div> */}
                                <div className="text-[9px] text-gray-400 mt-1 text-center">
                                    Showing 1-7 August (next 7 days)
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* IDW Layer Dropdown */}
            <div className="relative">
                <button
                    onClick={() => setOpen((o) => !o)}
                    className="flex items-center gap-2 bg-white rounded-lg shadow-md ring-1 ring-gray-200 px-3 py-2 text-[12px] font-semibold text-gray-700 hover:bg-gray-50"
                >
                    <Layers className="w-3.5 h-3.5 text-blue-500" />
                    {selectedLabel}
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                </button>

                {open && (
                    <>
                        <div
                            className="fixed inset-0 z-[499]"
                            onClick={() => setOpen(false)}
                        />
                        <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg ring-1 ring-gray-200 py-1 z-[500] overflow-hidden">
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
                                        ? "text-blue-600 bg-blue-50"
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

            {/* Status indicator */}
            {isLoading && (
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] text-blue-600 font-medium">Loading...</span>
                </div>
            )}
            {error && !isLoading && (
                <span className="text-[10px] text-red-600 font-medium">{error}</span>
            )}
            {!isLoading && !error && dataCount > 0 && selectedId && (
                <span className="text-[10px] text-green-600 font-medium">
                    {dataCount} stations
                </span>
            )}
        </div>
    );
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

function FlyoverDetailsPanel({ selectedFeature, meta, visibleFlyovers, onSelectFlyover }) {
    if (!selectedFeature) {
        return (
            <div className="p-4">
                <div className="flex items-center gap-2 mb-1">
                    <MapPin className="w-4 h-4 text-blue-400" />
                    <p className="text-sm font-bold text-gray-700">Flyovers</p>
                </div>

                {visibleFlyovers.length === 0 ? (
                    <p className="text-[12px] text-gray-400 mt-2">
                        No flyovers are currently visible — turn one on from the dropdown
                        above the map.
                    </p>
                ) : (
                    <>
                        <p className="text-[11px] text-gray-400 mb-3">
                            {visibleFlyovers.length} flyover
                            {visibleFlyovers.length > 1 ? "s" : ""} on the map. Select one
                            for full details.
                        </p>
                        <div className="space-y-2">
                            {visibleFlyovers.map((f) => (
                                <button
                                    key={f.id}
                                    onClick={() => onSelectFlyover(f)}
                                    className="w-full flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 hover:border-gray-200 hover:bg-gray-50 text-left transition-colors"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span
                                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                            style={{ background: f.color }}
                                        />
                                        <span className="text-[12px] font-semibold text-gray-800 truncate">
                                            {f.name}
                                        </span>
                                    </div>
                                    {f.nh && (
                                        <span className="text-[10px] text-gray-400 flex-shrink-0">
                                            {f.nh}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>
        );
    }

    const props = selectedFeature.properties || {};
    const name =
        meta?.name || findProp(props, ["name", "flyover_name", "NAME"]) || "Selected Flyover";
    const nh = findProp(props, [
        "nh_number", "NH_Number", "nhNumber", "NH_NO", "highway", "road_no", "road_number",
    ]);
    const status = findProp(props, ["status", "condition", "riskLevel", "risk_level"]);
    const length = findProp(props, ["length", "length_m", "LENGTH"]);
    const lanes = findProp(props, ["lanes", "no_of_lanes"]);
    const yearBuilt = findProp(props, ["year_built", "yearBuilt", "construction_year"]);
    const lastInspection = findProp(props, [
        "last_inspection", "lastInspection", "inspection_date",
    ]);

    const accentColor = meta?.color || "#8f1b8b";

    return (
        <div>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2 min-w-0">
                    <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: accentColor }}
                    />
                    <h3 className="text-sm font-bold text-gray-900 truncate">{name}</h3>
                </div>
            </div>

            <div className="px-4 py-3">
                {(status || length || lanes || yearBuilt || lastInspection) && (
                    <div className="grid grid-cols-2 gap-1.5 mb-4">
                        {status && <StatChip label="Status" value={status} />}
                        {length && <StatChip label="Length" value={`${length} m`} />}
                        {lanes && <StatChip label="Lanes" value={lanes} />}
                        {yearBuilt && <StatChip label="Built" value={yearBuilt} />}
                        {lastInspection && (
                            <StatChip label="Last inspection" value={lastInspection} />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ============================================================
// MAIN HOMEMAP COMPONENT WITH IDW LOGIC
// ============================================================
export default function HomeMap() {
    const [flyoversList, setFlyoversList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingStatus, setLoadingStatus] = useState("Initializing map...");
    const [overlayVisible, setOverlayVisible] = useState(true);
    const [selectedFeature, setSelectedFeature] = useState(null);
    const [selectedFlyoverMeta, setSelectedFlyoverMeta] = useState(null);
    const [visibleFlyoverIds, setVisibleFlyoverIds] = useState(new Set());
    const [currentZoom, setCurrentZoom] = useState(REGION_ZOOM);

    // ============================================================
    // IDW STATE
    // ============================================================
    const [idwLayer, setIdwLayer] = useState(null);
    const [weatherData, setWeatherData] = useState([]);
    const [weatherLoading, setWeatherLoading] = useState(false);
    const [weatherError, setWeatherError] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [idwLayerInstance, setIdwLayerInstance] = useState(null);
    // Buffer polygon used to clip the IDW heatmap so it only paints inside
    // the highway buffer, not the whole map viewport.
    const [bufferBoundary, setBufferBoundary] = useState(null);

    const mapWrapperRef = useRef(null);
    const mapRef = useRef(null);
    const initialLoadDone = useRef(false);

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
    // IDW LAYER HANDLER
    // ============================================================
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
    // INITIAL WEATHER LOAD - Only once
    // ============================================================
    useEffect(() => {
        if (!initialLoadDone.current) {
            const today = new Date().toISOString().split('T')[0];
            setSelectedDate(today);
            fetchWeatherData(today);
            initialLoadDone.current = true;
        }
    }, [fetchWeatherData]);

    // ============================================================
    // LOAD BUFFER BOUNDARY - Only once, used to clip the IDW layer
    // ============================================================
    useEffect(() => {
        let cancelled = false;

        const loadBufferBoundary = async () => {
            try {
                const response = await fetch('/data/Buffer.geojson');
                if (!response.ok) {
                    console.warn(`⚠️ Buffer.geojson request failed: ${response.status}`);
                    return;
                }
                const data = await response.json();
                if (!cancelled) {
                    setBufferBoundary(data);
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
    // IDW LAYER INTEGRATION
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
            const newLayer = createIDWLayer(weatherData, property, {
                opacity: 0.85,
                zIndex: 1000,
                clipPolygon: bufferBoundary,
                // Cache per date+property so flipping between rainfall/wind/
                // temperature, or back to a previously viewed date, reuses
                // the already-rendered image instead of recomputing it.
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
    // FLYOVER DATA LOADING
    // ============================================================
    const loadFlyovers = useCallback(async () => {
        try {
            const flyovers = await loadFlyoverData();
            if (flyovers && flyovers.length > 0) {
                const list = flyovers.map((flyover, index) => ({
                    id: flyover.id ?? `flyover-${index + 1}`,
                    name: flyover.highway ?? `Flyover ${index + 1}`,
                    geojson: flyover.geojson,
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
        loadFlyovers();
    }, [loadFlyovers]);

    useEffect(() => {
        if (!loading) {
            const timeout = setTimeout(() => setOverlayVisible(false), 500);
            return () => clearTimeout(timeout);
        }
    }, [loading]);

    const handleSelectFeature = useCallback((feature, meta) => {
        setSelectedFeature(feature);
        setSelectedFlyoverMeta(meta);
    }, []);

    const handleToggleFlyover = useCallback((id) => {
        setVisibleFlyoverIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
        setSelectedFlyoverMeta((prevMeta) => {
            if (prevMeta?.id === id) {
                setSelectedFeature(null);
                return null;
            }
            return prevMeta;
        });
    }, []);

    const handleToggleAllFlyovers = useCallback(() => {
        setVisibleFlyoverIds((prev) =>
            prev.size === flyoversList.length && flyoversList.length > 0
                ? new Set()
                : new Set(flyoversList.map((f) => f.id)),
        );
    }, [flyoversList]);

    const flyoverMarkers = useMemo(() => {
        return flyoversList
            .map((flyover, index) => {
                const latlng = getRepresentativeLatLng(flyover.geojson);
                if (!latlng) return null;
                const color = getFlyoverColor(index);
                const shortLabel = getShortCode(flyover, index);
                const nh = getNhNumber(flyover);
                const detailedLabel = `${flyover.name}${nh ? ` • ${nh}` : ""}`;
                return { ...flyover, latlng, color, shortLabel, detailedLabel, nh };
            })
            .filter(Boolean);
    }, [flyoversList]);

    const isDetailZoom = currentZoom >= DETAIL_LABEL_ZOOM;

    return (
        <div
            ref={mapWrapperRef}
            className="w-full h-[540px] flex flex-col lg:flex-row gap-3 bg-white"
        >
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
                    <FullscreenButton targetRef={mapWrapperRef} />
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
                        isLoading={weatherLoading}
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

                    {flyoverMarkers
                        .filter((flyover) => visibleFlyoverIds.has(flyover.id))
                        .map((flyover) => (
                            <FadeInGeoJSON
                                key={flyover.id}
                                data={flyover.geojson}
                                style={{ color: flyover.color, weight: 4, opacity: 1 }}
                                onEachFeature={(feature, layer) => {
                                    layer.on("click", () =>
                                        handleSelectFeature(feature, {
                                            name: flyover.name,
                                            color: flyover.color,
                                            id: flyover.id,
                                        }),
                                    );
                                }}
                            />
                        ))}

                    {flyoverMarkers
                        .filter((flyover) => visibleFlyoverIds.has(flyover.id))
                        .map((flyover) => (
                            <Marker
                                key={flyover.id}
                                position={flyover.latlng}
                                icon={makeFlyoverIcon({
                                    color: flyover.color,
                                    labelText: isDetailZoom ? flyover.detailedLabel : flyover.shortLabel,
                                    detailed: isDetailZoom,
                                })}
                                eventHandlers={{
                                    click: () => {
                                        const firstFeature = flyover.geojson?.features?.[0];
                                        if (firstFeature) {
                                            handleSelectFeature(firstFeature, {
                                                name: flyover.name,
                                                color: flyover.color,
                                                id: flyover.id,
                                            });
                                        }
                                    },
                                }}
                            />
                        ))}
                </MapContainer>
            </div>

            <div className="lg:basis-1/3 rounded-xl2 overflow-hidden shadow-card ring-2 ring-gray-200 bg-white flex flex-col">
                <div className="flex-1 overflow-y-auto">
                    <FlyoverDetailsPanel
                        selectedFeature={selectedFeature}
                        meta={selectedFlyoverMeta}
                        visibleFlyovers={flyoverMarkers.filter((f) => visibleFlyoverIds.has(f.id))}
                        onSelectFlyover={(f) => {
                            const firstFeature = f.geojson?.features?.[0];
                            if (firstFeature) {
                                handleSelectFeature(firstFeature, {
                                    name: f.name,
                                    color: f.color,
                                    id: f.id,
                                });
                            }
                        }}
                    />

                    <div className="px-3">
                        <p className="text-sm font-bold text-gray-700 mb-2 px-1">Weather</p>
                        <div className="h-[480px]">
                            <WeatherPanel />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}


