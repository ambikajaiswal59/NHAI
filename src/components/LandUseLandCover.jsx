// src/components/LandUseLandCover.jsx
import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-side-by-side";
import {
  Loader2,
  AlertTriangle,
  Layers,
  X,
  Maximize,
  Minimize,
  CircleDot,
  ChevronDown,
  Calendar,
} from "lucide-react";
import { AlertTriangle, Layers, X, Maximize, Minimize, ChevronDown } from "lucide-react";
import { useFlyoverData } from "../hooks/useFlyoverData";
import { useMovementPoints } from "../hooks/useMovementPoints";
import {
  getFlyoverColor,
  getFlyoverDisplayName,
  makeFlyoverIcon,
  formatPointName,
} from "./map/mapHelpers";

import MovementPointsChart from "./MovementPointsChart";
import MovementDiffChart from "./MovementDiffChart";

/* ============================================================================
 * CONSTANTS
 * ==========================================================================*/

const DEBUG = false;

const YEARS = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
const TILE_LAYER_URL =
  "https://mlinfomap.org/nhaiapi/tiles/{year}/{z}/{x}/{y}.png";

const DEFAULT_CENTER = [30.3, 76.7];
const DEFAULT_ZOOM = 10;
const MIN_ZOOM = 9;
const MAX_ZOOM = 20;

// How long the LULC show/hide crossfade takes (ms)
const LULC_FADE_MS = 250;

// LULC classes for the static legend
const LULC_CLASSES = [
  { color: "#055ac5", label: "Water" },
  { color: "#0b832a", label: "Trees" },
  { color: "#dae04e", label: "Crop" },
  { color: "#f14c40", label: "Builtup" },
  { color: "#ecfff8", label: "Bare Ground" },
  { color: "#99998f", label: "Rangeland" },
];

// Velocity color ranges for movement points
const VELOCITY_RANGES = [
  { min: -50, max: -26, color: "#e00f00" }, // Red
  { min: -25, max: -16, color: "#FFDF00" }, // Yellow
  { min: -15, max: 19, color: "#ffffff" }, // White
  { min: 20, max: 30, color: "#00FFFF" }, // Light Sky Blue
  { min: 31, max: 50, color: "#4B00E0" }, // Dark Blue
];

// --- Movement circle border scaling ---
const BASE_ZOOM = 14;
const BASE_WEIGHT = 1.5;
const MIN_WEIGHT = 0.5;
const MAX_WEIGHT = 4;
const HOVER_WEIGHT_BONUS = 1.5;

const NEUTRAL_FILL = "#8a0b68";
const NEUTRAL_BORDER = "#0d0101";
const VELOCITY_BORDER = "#333";
const HOVER_FILL = "#ff6b6b";
const HOVER_BORDER = "#ff0000";
const SELECT_FILL = "#ffd93d";
const SELECT_BORDER = "#f59f00";

/* ============================================================================
 * SMALL HELPERS
 * ==========================================================================*/

function log(...args) {
    if (DEBUG) console.log(...args);
}

function logError(...args) {
    console.error(...args);
}

function getVelocityColor(velocity) {
    for (const range of VELOCITY_RANGES) {
        if (velocity >= range.min && velocity <= range.max) {
            return range.color;
        }
    }
    return NEUTRAL_FILL;
}

function getWeightForZoom(zoom) {
    const scale = Math.pow(2, zoom - BASE_ZOOM);
    return Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, BASE_WEIGHT * scale));
}

function getRestingCircleStyle(selectedLayer, velocity, zoom) {
    const isVelocityMode = selectedLayer === "velocity";
    return {
        fillColor: isVelocityMode ? getVelocityColor(velocity) : NEUTRAL_FILL,
        color: isVelocityMode ? VELOCITY_BORDER : NEUTRAL_BORDER,
        weight: getWeightForZoom(zoom),
        opacity: 0.9,
        fillOpacity: 0.85,
    };
}

function getHoverCircleStyle(zoom) {
    return {
        fillColor: HOVER_FILL,
        color: HOVER_BORDER,
        weight: getWeightForZoom(zoom) + HOVER_WEIGHT_BONUS,
        fillOpacity: 0.9,
    };
}

function getSelectedCircleStyle(zoom) {
    return {
        fillColor: SELECT_FILL,
        color: SELECT_BORDER,
        weight: getWeightForZoom(zoom) + HOVER_WEIGHT_BONUS,
    };
}

function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function removeAllFromMap(map, layers) {
    layers.forEach((layer) => {
        if (map.hasLayer(layer)) map.removeLayer(layer);
    });
}

function addAllToMap(map, layers) {
    layers.forEach((layer) => {
        if (!map.hasLayer(layer)) map.addLayer(layer);
    });
}

/* ============================================================================
 * PRESENTATIONAL SUB-COMPONENTS
 * ==========================================================================*/

function VelocityLegend() {
    return (
        <div className="absolute bottom-3 right-35 z-[1500] bg-white/95 backdrop-blur-sm rounded-md shadow-md border border-gray-200 px-4 py-2 max-w-[200px]">
            <div className="text-[10px] font-medium text-gray-500 text-center mb-1">Velocity (mm/yr)</div>
            <div className="flex items-center gap-1">
                <span className="text-[9px] font-medium text-gray-600">-50</span>
                <div className="flex-1 h-3 rounded-full overflow-hidden flex" style={{ minWidth: "100px" }}>
                    {VELOCITY_RANGES.map((range, index) => {
                        const totalRange = 100;
                        const rangeSize = range.max - range.min + 1;
                        const percentage = (rangeSize / totalRange) * 100;
                        return (
                            <div
                                key={index}
                                style={{
                                    width: `${percentage}%`,
                                    backgroundColor: range.color,
                                    borderRight: index < VELOCITY_RANGES.length - 1 ? "1px solid rgba(0,0,0,0.1)" : "none",
                                }}
                            />
                        );
                    })}
                </div>
                <span className="text-[9px] font-medium text-gray-600">50</span>
            </div>
        </div>
    );
}

function LULCLegend() {
  return (
    <div className="absolute bottom-3 right-3 z-[1500] bg-white/95 backdrop-blur-sm rounded-md shadow-md border border-gray-200 px-3 py-2 max-w-[180px]">
      <div className="text-[11px] font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
        Land Cover
      </div>
      <div className="flex flex-col gap-1">
        {LULC_CLASSES.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-sm flex-shrink-0 border border-gray-200"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-[10px] text-gray-600 leading-tight">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function YearSelect({ label, value, onChange, disabledYears = [] }) {
    return (
        <div className="flex items-center gap-2">
            <label className="text-sm text-black-700 font-medium">{label}</label>
            <select
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="border border-gray-200 rounded-md px-2 py-1 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
                {YEARS.map((y) => {
                    const isDisabled = disabledYears.includes(y);
                    return (
                        <option
                            key={y}
                            value={y}
                            disabled={isDisabled}
                            className={isDisabled ? "text-gray-400 bg-gray-100" : "text-gray-900"}
                        >
                            {y}
                        </option>
                    );
                })}
            </select>
        </div>
    );
}

function FullscreenButton({ isFullscreen, onToggle }) {
    return (
        <button
            onClick={onToggle}
            className={`flex items-center justify-center w-[30px] h-[30px] bg-white rounded-md shadow-md border border-gray-200 transition-all duration-200 hover:bg-gray-50 hover:shadow-lg ${isFullscreen ? "bg-blue-50 border-blue-300 text-blue-600" : "text-gray-700"}`}
            aria-label="Toggle fullscreen"
        >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>
    );
}

function LayerSelector({ selectedLayer, onLayerChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const getLayerLabel = (layer) => {
        switch (layer) {
            case "velocity": return "Velocity";
            case "difference": return "Difference";
            case "none": return "None";
            default: return "Velocity";
        }
    };

    const getLayerColor = (layer) => {
        switch (layer) {
            case "velocity": return "bg-green-100 text-green-800 border-green-300 hover:bg-green-200";
            case "difference": return "bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200";
            case "none": return "bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200";
            default: return "bg-green-100 text-green-800 border-green-300 hover:bg-green-200";
        }
    };

    const options = ["velocity", "difference", "none"];

    return (
        <div className="relative flex items-center gap-1.5" ref={dropdownRef}>
            <span className="text-xs font-medium text-gray-700">Layer:</span>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center justify-between gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200 border min-w-[90px] h-[28px] ${getLayerColor(selectedLayer)}`}
            >
                <span>{getLayerLabel(selectedLayer)}</span>
                <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-[45px] mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1.5 z-[1600] min-w-[120px]">
                    {options.map((opt) => (
                        <button
                            key={opt}
                            onClick={() => {
                                onLayerChange(opt);
                                setIsOpen(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 hover:bg-gray-50 transition-colors text-xs ${selectedLayer === opt ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700"
                                }`}
                        >
                            {getLayerLabel(opt)}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function DateRangeSelector({
    availableDates = [],
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
}) {
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [isEndOpen, setIsEndOpen] = useState(false);
  const startRef = useRef(null);
  const endRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (startRef.current && !startRef.current.contains(event.target)) {
                setIsStartOpen(false);
            }
            if (endRef.current && !endRef.current.contains(event.target)) {
                setIsEndOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const formatDisplayDate = (dateStr) => {
        if (!dateStr) return "Select Date";
        const parts = dateStr.split("-");
        return `${parts[1]}/${parts[2]}/${parts[0]}`;
    };

    return (
        <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm px-3 rounded-md border border-blue-200 shadow-sm relative h-[34px]">
            <div className="relative" ref={startRef}>
                <button
                    onClick={() => setIsStartOpen(!isStartOpen)}
                    className="flex items-center justify-between gap-1 px-2 py-1 border border-gray-300 rounded bg-white hover:border-blue-400 transition-colors text-xs min-w-[70px]"
                >
                    <span className={startDate ? "text-gray-800" : "text-gray-400"}>
                        {startDate ? formatDisplayDate(startDate) : "Start"}
                    </span>
                    <ChevronDown size={12} className={`text-gray-400 transition-transform ${isStartOpen ? "rotate-180" : ""}`} />
                </button>
                {isStartOpen && availableDates.length > 0 && (
                    <div
                        className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto min-w-[110px]"
                        style={{ zIndex: 9999, position: "absolute" }}
                    >
                        {availableDates.map((date) => (
                            <button
                                key={date}
                                onClick={() => {
                                    onStartDateChange(date);
                                    setIsStartOpen(false);
                                    if (!endDate || endDate < date) {
                                        onEndDateChange(date);
                                    }
                                }}
                                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 transition-colors ${startDate === date ? "bg-blue-100 text-blue-700 font-medium" : "text-gray-700"
                                    }`}
                            >
                                {formatDisplayDate(date)}
                            </button>
                        ))}
                    </div>
                )}
            </div>

      <span className="text-gray-400 text-xs">→</span>

            <div className="relative" ref={endRef}>
                <button
                    onClick={() => setIsEndOpen(!isEndOpen)}
                    className="flex items-center justify-between gap-1 px-2 py-1 border border-gray-300 rounded bg-white hover:border-blue-400 transition-colors text-xs min-w-[70px]"
                >
                    <span className={endDate ? "text-gray-800" : "text-gray-400"}>
                        {endDate ? formatDisplayDate(endDate) : "End"}
                    </span>
                    <ChevronDown size={12} className={`text-gray-400 transition-transform ${isEndOpen ? "rotate-180" : ""}`} />
                </button>
                {isEndOpen && availableDates.length > 0 && (
                    <div
                        className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto min-w-[110px]"
                        style={{ zIndex: 9999, position: "absolute" }}
                    >
                        {availableDates
                            .filter((date) => !startDate || date >= startDate)
                            .map((date) => (
                                <button
                                    key={date}
                                    onClick={() => {
                                        onEndDateChange(date);
                                        setIsEndOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 transition-colors ${endDate === date ? "bg-blue-100 text-blue-700 font-medium" : "text-gray-700"
                                        }`}
                                >
                                    {formatDisplayDate(date)}
                                </button>
                            ))}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ============================================================================
 * MAIN COMPONENT
 * ==========================================================================*/

export default function LandUseLandCover({
    mapCenter = DEFAULT_CENTER,
    defaultLeftYear = YEARS[0],
    defaultRightYear = YEARS[YEARS.length - 1],
    className = "",
    isActive = true,
}) {
    /* ---------------- Refs --------------- */
    const mapContainerRef = useRef(null);
    const fullscreenContainerRef = useRef(null);
    const mapRef = useRef(null);
    const leftLayerRef = useRef(null);
    const rightLayerRef = useRef(null);
    const sideBySideRef = useRef(null);
    const lulcCreatedRef = useRef(false);
    const streetLayerRef = useRef(null);
    const satelliteLayerRef = useRef(null);
    const esriSatelliteLayerRef = useRef(null);
    const flyoverLayersRef = useRef([]);
    const flyoverMarkersRef = useRef([]);
    const movementMarkersRef = useRef([]);

    const tagRef = useRef(null);
    const dividerLineRef = useRef(null);
    const rafIdRef = useRef(null);
    const debounceRef = useRef(null);
    const dividerReadyTimeoutRef = useRef(null);
    const resizeObserverRef = useRef(null);
    const isMountedRef = useRef(true);
    const isMapReadyRef = useRef(false);
    const hasFitBoundsRef = useRef(false);
    const requestIdRef = useRef(0);

    /* ---------------- State ---------------- */
    const [showChart, setShowChart] = useState(false);
    const [selectedPointForChart, setSelectedPointForChart] = useState(null);
    const [selectedDetailForChart, setSelectedDetailForChart] = useState(null);

    const [showDiffChart, setShowDiffChart] = useState(false);
    const [diffPointData, setDiffPointData] = useState(null);
    const [diffDetailData, setDiffDetailData] = useState(null);
    const [diffStartDate, setDiffStartDate] = useState("");
    const [diffEndDate, setDiffEndDate] = useState("");

    const [selectedLayer, setSelectedLayer] = useState("velocity");

    const [yearLeft, setYearLeft] = useState(defaultLeftYear);
    const [yearRight, setYearRight] = useState(defaultRightYear);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isDividerReady, setIsDividerReady] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);
    const [activeLayers, setActiveLayers] = useState(["flyover", "movement"]);
    const [baseLayer, setBaseLayer] = useState("streets");
    const [showLULC, setShowLULC] = useState(false);

    /* ---------------- Data hooks ---------------- */
    const { flyovers, loading: flyoversLoading } = useFlyoverData();

    const {
        points: movementPoints,
        loading: movementLoading,
        error: movementError,
        availableDates,
        selectPoint,
    } = useMovementPoints();

    const availableLayers = [
        { id: "flyover", name: "Assets", color: "#3B82F6", type: "overlay" },
        { id: "lulc", name: "LULC", color: "#10B981", type: "overlay" },
    ];
    const showDifferenceUI = selectedLayer === "difference";
    const showVelocityUI = selectedLayer === "velocity";

    /* ==========================================================================
     * MOVEMENT POINTS
     * ========================================================================*/

    const updateCircleWeights = useCallback(() => {
        if (!mapRef.current) return;
        const zoom = mapRef.current.getZoom();
        const weight = getWeightForZoom(zoom);

        movementMarkersRef.current.forEach((marker) => {
            marker.options.weight = weight;
            marker.setStyle({ weight });
        });
    }, []);

    const addMovementPointsToMap = useCallback((map, points) => {
        if (!points || points.length === 0) return;

        removeAllFromMap(map, movementMarkersRef.current);
        movementMarkersRef.current = [];

        points.forEach((feature) => {
            const { id, longitude, latitude, velocity } = feature.data;

            const circle = L.circle([latitude, longitude], {
                pane: "movementPane",
                radius: 4,
                ...getRestingCircleStyle(selectedLayer, velocity, map.getZoom()),
            });

            circle.on("mouseover", function () {
                this.setStyle(getHoverCircleStyle(map.getZoom()));

                if (selectedLayer === "velocity") {
                    const tooltipContent = `
                        <div style="padding: 2px 6px; font-size: 12px; font-weight: 600; line-height: 1.3;">
                            Point ID: ${escapeHtml(id)}<br/>
                            Velocity: ${escapeHtml(velocity)} mm/yr
                        </div>
                    `;
                    this.bindTooltip(tooltipContent, {
                        permanent: false,
                        direction: "top",
                        offset: [0, -10],
                        className: "velocity-tooltip",
                    }).openTooltip();
                } else {
                    this.closeTooltip();
                }
            });

            circle.on("mouseout", function () {
                this.setStyle(getRestingCircleStyle(selectedLayer, velocity, map.getZoom()));
                this.closeTooltip();
            });

            circle.on("click", async function () {
                if (selectedLayer === "none") return;

                try {
                    this.setStyle(getSelectedCircleStyle(map.getZoom()));

            const detailData = await selectPoint(id);

                    if (detailData) {
                        if (selectedLayer === "difference" && diffStartDate && diffEndDate) {
                            setDiffPointData(feature);
                            setDiffDetailData(detailData);
                            setShowDiffChart(true);
                        } else {
                            setSelectedPointForChart(feature);
                            setSelectedDetailForChart(detailData);
                            setShowChart(true);
                        }
                    }
                } catch (err) {
                    logError("Error fetching point details:", err);
                } finally {
                    this.setStyle(getRestingCircleStyle(selectedLayer, velocity, map.getZoom()));
                }
            });

        movementMarkersRef.current.push(circle);
      });

        if (selectedLayer !== "none") {
            movementMarkersRef.current.forEach((marker) => marker.addTo(map));
            updateCircleWeights();
        }

        log(`✅ Added ${movementMarkersRef.current.length} movement point circles to map`);
    }, [selectedLayer, selectPoint, diffStartDate, diffEndDate, updateCircleWeights]);

    const updateMovementVisibility = useCallback(() => {
        if (!mapRef.current) return;

        if (selectedLayer === "none") {
            removeAllFromMap(mapRef.current, movementMarkersRef.current);
        } else {
            addAllToMap(mapRef.current, movementMarkersRef.current);
        }
    }, [selectedLayer]);

    /* ==========================================================================
     * SIDE-BY-SIDE TILE COMPARISON (LULC year vs year)
     * ========================================================================*/

    const handleDividerMove = useCallback(() => {
        if (rafIdRef.current) return;
        rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = null;
            if (!sideBySideRef.current) return;
            const pos = sideBySideRef.current.getPosition();
            const px = `${pos}px`;
            if (tagRef.current) tagRef.current.style.left = px;
            if (dividerLineRef.current) dividerLineRef.current.style.left = px;
        });
    }, []);

    // Creates the LULC tile layers + side-by-side control exactly once.
    const ensureLULCLayersExist = useCallback(() => {
        if (!mapRef.current || lulcCreatedRef.current) return;
        const map = mapRef.current;

        const leftLayer = L.tileLayer(TILE_LAYER_URL.replace("{year}", yearLeft), {
            tileSize: 256,
            minZoom: MIN_ZOOM,
            maxZoom: MAX_ZOOM,
            crossOrigin: true,
            opacity: 0,
            zIndex: 10,
        });

        const rightLayer = L.tileLayer(TILE_LAYER_URL.replace("{year}", yearRight), {
            tileSize: 256,
            minZoom: MIN_ZOOM,
            maxZoom: MAX_ZOOM,
            crossOrigin: true,
            opacity: 0,
            zIndex: 10,
        });

        leftLayer.addTo(map);
        rightLayer.addTo(map);

        const sideBySide = L.control.sideBySide([leftLayer], [rightLayer]).addTo(map);
        sideBySide.setPosition(0.5);
        sideBySide.on("dividermove", handleDividerMove);

        const controlEl = sideBySide._container;
        if (controlEl) {
            controlEl.style.transition = `opacity ${LULC_FADE_MS}ms ease`;
            controlEl.style.opacity = "0";
            controlEl.style.pointerEvents = "none";
        }

        leftLayerRef.current = leftLayer;
        rightLayerRef.current = rightLayer;
        sideBySideRef.current = sideBySide;
        lulcCreatedRef.current = true;

        requestAnimationFrame(() => requestAnimationFrame(handleDividerMove));

        if (!hasFitBoundsRef.current) {
            const bounds = map.getBounds();
            if (bounds.isValid()) {
                map.fitBounds(bounds);
                hasFitBoundsRef.current = true;
            }
        }

        setIsDividerReady(true);
    }, [yearLeft, yearRight, handleDividerMove]);

    // Fully tears down LULC layers
    const teardownLULCLayers = useCallback(() => {
        if (!mapRef.current) return;

        if (sideBySideRef.current) {
            mapRef.current.removeControl(sideBySideRef.current);
            sideBySideRef.current = null;
        }
        if (leftLayerRef.current && mapRef.current.hasLayer(leftLayerRef.current)) {
            mapRef.current.removeLayer(leftLayerRef.current);
        }
        if (rightLayerRef.current && mapRef.current.hasLayer(rightLayerRef.current)) {
            mapRef.current.removeLayer(rightLayerRef.current);
        }
        leftLayerRef.current = null;
        rightLayerRef.current = null;
        lulcCreatedRef.current = false;
        setIsDividerReady(false);
    }, []);

    /* ==========================================================================
     * FLYOVER LAYERS
     * ========================================================================*/

    const updateLayerVisibility = useCallback(() => {
        if (!mapRef.current) return;

        if (activeLayers.includes("flyover")) {
            addAllToMap(mapRef.current, flyoverLayersRef.current);
            addAllToMap(mapRef.current, flyoverMarkersRef.current);
        } else {
            removeAllFromMap(mapRef.current, flyoverLayersRef.current);
            removeAllFromMap(mapRef.current, flyoverMarkersRef.current);
        }
    }, [activeLayers]);

    const addFlyoverLayers = useCallback((map) => {
        if (!flyovers || flyovers.length === 0) return;

        try {
            requestAnimationFrame(() => {
                removeAllFromMap(map, flyoverLayersRef.current);
                flyoverLayersRef.current = [];

                removeAllFromMap(map, flyoverMarkersRef.current);
                flyoverMarkersRef.current = [];

          flyovers.forEach((flyover, index) => {
            try {
              const color = getFlyoverColor(index);
              const displayName = getFlyoverDisplayName(flyover.type, index);

                        if (flyover.geojson) {
                            try {
                                const layer = L.geoJSON(flyover.geojson, {
                                    style: {
                                        color,
                                        weight: 3,
                                        opacity: 0.8,
                                        fillColor: color,
                                        fillOpacity: 0.2,
                                    },
                                });
                                flyoverLayersRef.current.push(layer);
                            } catch (err) {
                                logError(`[LULC] Error adding flyover layer for ${displayName}:`, err);
                            }
                        }

                        if (flyover.namedPoints && flyover.namedPoints.length > 0) {
                            flyover.namedPoints.forEach((point) => {
                                try {
                                    const pointName = formatPointName(point.name);
                                    const icon = makeFlyoverIcon({
                                        color,
                                        labelText: pointName,
                                        detailed: false,
                                        name: pointName,
                                        detailFields: [],
                                    });

                                    const marker = L.marker(point.latlng, {
                                        icon,
                                        riseOnHover: true,
                                        zIndexOffset: 100,
                                    });

                    const popupContent = `
                                        <div style="padding: 8px; font-family: Arial, sans-serif;">
                                            <h4 style="margin: 0 0 4px 0; color: ${escapeHtml(color)};">${escapeHtml(pointName)}</h4>
                                            ${point.chainage ? `<p style="margin: 2px 0; font-size: 11px;"><strong>Chainage:</strong> ${escapeHtml(point.chainage)}</p>` : ""}
                                            ${point.description ? `<p style="margin: 2px 0; font-size: 11px;"><strong>Type:</strong> ${escapeHtml(point.description)}</p>` : ""}
                                            ${point.length ? `<p style="margin: 2px 0; font-size: 11px;"><strong>Length:</strong> ${escapeHtml(point.length)}</p>` : ""}
                                            ${point.detail ? `<p style="margin: 2px 0; font-size: 11px;"><strong>Structure:</strong> ${escapeHtml(point.detail)}</p>` : ""}
                                        </div>
                                    `;

                                    marker.bindPopup(popupContent, { maxWidth: 300, autoPan: true });

                                    flyoverMarkersRef.current.push(marker);
                                } catch (err) {
                                    logError(`[LULC] Error adding marker for ${point.name}:`, err);
                                }
                            });
                        }
                    } catch (err) {
                        logError(`[LULC] Error processing flyover ${index}:`, err);
                    }
                });

                updateLayerVisibility();
            });
        } catch (err) {
            logError("[LULC] Error in addFlyoverLayers:", err);
        }
    }, [flyovers, updateLayerVisibility]);

    /* ==========================================================================
     * UI HANDLERS
     * ========================================================================*/

    const handleLayerChange = useCallback((layer) => {
        log("🔄 Layer changed to:", layer);
        setSelectedLayer(layer);

        if (layer === "velocity") {
            setActiveLayers((prev) => {
                const next = prev.filter((id) => id !== "difference");
                if (!next.includes("movement")) next.push("movement");
                return next;
            });
            setShowDiffChart(false);
            setDiffPointData(null);
            setDiffDetailData(null);
        } else if (layer === "difference") {
            setActiveLayers((prev) => {
                const next = prev.filter((id) => id !== "movement");
                if (!next.includes("difference")) next.push("difference");
                return next;
            });
        } else if (layer === "none") {
            setActiveLayers((prev) => prev.filter((id) => id !== "movement" && id !== "difference"));
            setShowChart(false);
            setSelectedPointForChart(null);
            setSelectedDetailForChart(null);
            setShowDiffChart(false);
            setDiffPointData(null);
            setDiffDetailData(null);
        }
    }, []);

    const handleLayerToggle = useCallback((layerId) => {
        if (layerId === "lulc") {
            setShowLULC((prev) => !prev);
        } else {
            setActiveLayers((prev) =>
                prev.includes(layerId) ? prev.filter((id) => id !== layerId) : [...prev, layerId]
            );
        }
    }, []);

    const handleBaseLayerChange = useCallback((layerType) => {
        setBaseLayer(layerType);
        if (!mapRef.current) return;

        try {
            if (streetLayerRef.current && mapRef.current.hasLayer(streetLayerRef.current)) {
                mapRef.current.removeLayer(streetLayerRef.current);
            }
            if (satelliteLayerRef.current && mapRef.current.hasLayer(satelliteLayerRef.current)) {
                mapRef.current.removeLayer(satelliteLayerRef.current);
            }
            if (esriSatelliteLayerRef.current && mapRef.current.hasLayer(esriSatelliteLayerRef.current)) {
                mapRef.current.removeLayer(esriSatelliteLayerRef.current);
            }

            if (layerType === "streets" && streetLayerRef.current) {
                mapRef.current.addLayer(streetLayerRef.current);
            } else if (layerType === "satellite" && satelliteLayerRef.current) {
                mapRef.current.addLayer(satelliteLayerRef.current);
            } else if (layerType === "esri_satellite" && esriSatelliteLayerRef.current) {
                mapRef.current.addLayer(esriSatelliteLayerRef.current);
            }

            if (leftLayerRef.current && mapRef.current.hasLayer(leftLayerRef.current)) {
                leftLayerRef.current.setZIndex(10);
            }
            if (rightLayerRef.current && mapRef.current.hasLayer(rightLayerRef.current)) {
                rightLayerRef.current.setZIndex(10);
            }

            if (sideBySideRef.current && typeof sideBySideRef.current._updateClip === "function") {
                sideBySideRef.current._updateClip();
            }
        } catch (err) {
            logError("[LULC] Error switching base layer:", err);
        }
    }, []);

    const toggleFullscreen = useCallback(() => {
        try {
            const container = fullscreenContainerRef.current;
            if (!document.fullscreenElement) {
                container?.requestFullscreen?.();
            } else {
                document.exitFullscreen?.();
            }
        } catch (err) {
            logError("[LULC] Error toggling fullscreen:", err);
        }
    }, []);

    /* ==========================================================================
     * EFFECTS
     * ========================================================================*/

    useEffect(() => {
        if (availableDates && availableDates.length > 0 && !diffStartDate && !diffEndDate) {
            setDiffStartDate(availableDates[0]);
            setDiffEndDate(availableDates[availableDates.length - 1]);
        }
    }, [availableDates]);

    useEffect(() => {
        if (movementPoints && movementPoints.length > 0) {
            log(`✅ Movement Points loaded: ${movementPoints.length} points`);
            log("📊 Sample point:", movementPoints[0]);
        }
        if (movementError) {
            logError("❌ Movement Points Error:", movementError);
        }
        if (availableDates && availableDates.length > 0) {
            log("📅 Available dates:", availableDates);
        }
    }, [movementPoints, movementError, availableDates]);

    useEffect(() => {
        if (!mapRef.current || !isActive) return;
        if (!movementPoints || movementPoints.length === 0) return;

        const timeoutId = setTimeout(() => {
            try {
                addMovementPointsToMap(mapRef.current, movementPoints);
            } catch (err) {
                logError("[LULC] Error adding movement points:", err);
            }
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [movementPoints, isActive, addMovementPointsToMap]);

    useEffect(() => {
        if (!mapRef.current || !movementPoints || movementPoints.length === 0) return;

        if (selectedLayer === "none") {
            updateMovementVisibility();
        } else {
            addMovementPointsToMap(mapRef.current, movementPoints);
        }
    }, [selectedLayer, diffStartDate, diffEndDate, addMovementPointsToMap, updateMovementVisibility]);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 1024);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        const style = document.createElement("style");
        style.textContent = `
            .leaflet-interactive:focus,
            .leaflet-interactive:focus-visible {
                outline: none !important;
            }
            path.leaflet-interactive:focus {
                outline: none !important;
            }
        `;
        document.head.appendChild(style);
        return () => document.head.removeChild(style);
    }, []);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
            setTimeout(() => {
                try {
                    if (mapRef.current && mapContainerRef.current && document.contains(mapContainerRef.current)) {
                        mapRef.current.invalidateSize();
                    }
                } catch (err) {
                    logError("[LULC] Error during fullscreen change:", err);
                }
            }, 200);
        };
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, []);

    useEffect(() => {
        if (mapRef.current) updateLayerVisibility();
    }, [activeLayers, updateLayerVisibility]);

    // Keep LULC tile URLs in sync with selected years
    useEffect(() => {
        if (!leftLayerRef.current || !rightLayerRef.current) return;
        leftLayerRef.current.setUrl(TILE_LAYER_URL.replace("{year}", String(yearLeft)));
        rightLayerRef.current.setUrl(TILE_LAYER_URL.replace("{year}", String(yearRight)));
    }, [yearLeft, yearRight]);

    // Smooth LULC on/off toggle with opacity transition
    useEffect(() => {
        if (!mapRef.current) return;

        if (showLULC && !lulcCreatedRef.current) {
            ensureLULCLayersExist();
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (!isMountedRef.current) return;
                    leftLayerRef.current?.setOpacity(1);
                    rightLayerRef.current?.setOpacity(1);
                    const controlEl = sideBySideRef.current?._container;
                    if (controlEl) {
                        controlEl.style.opacity = "1";
                        controlEl.style.pointerEvents = "auto";
                    }
                    if (tagRef.current) tagRef.current.style.opacity = "1";
                    if (dividerLineRef.current) dividerLineRef.current.style.opacity = "1";
                });
            });
            return;
        }

        if (!lulcCreatedRef.current) return;

        const opacity = showLULC ? 1 : 0;
        leftLayerRef.current?.setOpacity(opacity);
        rightLayerRef.current?.setOpacity(opacity);

        const controlEl = sideBySideRef.current?._container;
        if (controlEl) {
            controlEl.style.opacity = String(opacity);
            controlEl.style.pointerEvents = showLULC ? "auto" : "none";
        }
        if (tagRef.current) tagRef.current.style.opacity = String(opacity);
        if (dividerLineRef.current) dividerLineRef.current.style.opacity = String(opacity);
    }, [showLULC, ensureLULCLayersExist]);

  // ---- Initialize map ----
  useEffect(() => {
    isMountedRef.current = true;
    if (mapRef.current || !mapContainerRef.current) return;

        try {
            const map = L.map(mapContainerRef.current, {
                center: mapCenter,
                zoom: DEFAULT_ZOOM,
                minZoom: MIN_ZOOM,
                maxZoom: MAX_ZOOM,
                zoomControl: true,
                attributionControl: false,
                fadeAnimation: true,
            });

      const streetLayer = L.tileLayer(
        "https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
        {
          subdomains: ["mt0", "mt1", "mt2", "mt3"],
          maxZoom: 25,
          attribution: "",
          zIndex: 1,
        },
      );

            const satelliteLayer = L.tileLayer("https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
                subdomains: ["mt0", "mt1", "mt2", "mt3"],
                maxZoom: 25,
                attribution: "",
                zIndex: 1,
            });

            const esriSatelliteLayer = L.tileLayer(
                "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                {
                    maxZoom: 25,
                    attribution: "",
                    zIndex: 1,
                }
            );

            streetLayerRef.current = streetLayer;
            satelliteLayerRef.current = satelliteLayer;
            esriSatelliteLayerRef.current = esriSatelliteLayer;

      streetLayer.addTo(map);

      L.control
        .attribution({ position: "bottomright", prefix: false })
        .addTo(map);

      mapRef.current = map;
      isMapReadyRef.current = true;

            map.createPane("movementPane");
            map.getPane("movementPane").style.zIndex = 550;
            map.getPane("movementPane").style.pointerEvents = "auto";

            map.on("zoomend", updateCircleWeights);

            const popupPane = map.getPane("popupPane");
            const mapPaneEl = map.getPane("mapPane");

            if (popupPane && mapPaneEl && popupPane.parentNode === mapPaneEl) {
                map.getContainer().appendChild(popupPane);
                popupPane.style.zIndex = "1400";
                popupPane.style.pointerEvents = "none";

                const syncPopupPanePosition = () => {
                    popupPane.style.transform = mapPaneEl.style.transform;
                };
                map.on("move zoom viewreset", syncPopupPanePosition);
                syncPopupPanePosition();
            }

            if (typeof ResizeObserver !== "undefined") {
                resizeObserverRef.current = new ResizeObserver(() => {
                    try {
                        if (mapRef.current && mapContainerRef.current && document.contains(mapContainerRef.current)) {
                            mapRef.current.invalidateSize();
                        }
                    } catch (err) {
                        logError("[LULC] Error in resize observer:", err);
                    }
                });
                resizeObserverRef.current.observe(mapContainerRef.current);
            }

            if (flyovers && flyovers.length > 0) {
                setTimeout(() => {
                    try {
                        addFlyoverLayers(map);
                    } catch (err) {
                        logError("[LULC] Error adding flyover layers:", err);
                    }
                }, 300);
            }

            setTimeout(() => {
                if (isMountedRef.current) setLoading(false);
            }, 200);

            return () => {
                isMountedRef.current = false;
                if (debounceRef.current) clearTimeout(debounceRef.current);
                if (dividerReadyTimeoutRef.current) clearTimeout(dividerReadyTimeoutRef.current);
                if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
                resizeObserverRef.current?.disconnect();
                sideBySideRef.current = null;
                leftLayerRef.current = null;
                rightLayerRef.current = null;
                lulcCreatedRef.current = false;
                if (mapRef.current) {
                    try {
                        mapRef.current.off("zoomend", updateCircleWeights);
                        mapRef.current.remove();
                        mapRef.current = null;
                    } catch (err) {
                        logError("[LULC] Error removing map:", err);
                    }
                }
                isMapReadyRef.current = false;
            };
        } catch (err) {
            logError("[LULC] Error initializing map:", err);
            setError("Failed to initialize map. Please try again.");
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!mapRef.current || !isActive) return;
        if (!flyovers || flyovers.length === 0) return;

        const timeoutId = setTimeout(() => {
            try {
                addFlyoverLayers(mapRef.current);
            } catch (err) {
                logError("[LULC] Error adding flyover layers:", err);
            }
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [flyovers, isActive, addFlyoverLayers]);

    useEffect(() => {
        if (isActive) return;
        teardownLULCLayers();
    }, [isActive, teardownLULCLayers]);

    useEffect(() => {
        if (!isActive || !mapRef.current || !mapContainerRef.current) return;

        const raf = requestAnimationFrame(() => {
            try {
                if (mapRef.current && mapContainerRef.current && document.contains(mapContainerRef.current)) {
                    mapRef.current.invalidateSize();
                }
            } catch (err) {
                logError("[LULC] Error invalidating size on active:", err);
            }
        });

    return () => cancelAnimationFrame(raf);
  }, [isActive]);

    /* ==========================================================================
     * RENDER
     * ========================================================================*/

    return (
        <div
            className={`flex flex-col h-full w-full ${className}`}
            ref={fullscreenContainerRef}
            style={{ background: "#ffffff", paddingTop: isFullscreen ? "10px" : "0px" }}
        >
            <div
                className="flex flex-wrap items-center justify-between gap-3 mb-2 px-3 py-2 rounded-lg relative z-[2000]"
                style={{
                    background: "linear-gradient(135deg, #e0e7ff 0%, #dbeafe 50%, #ede9fe 100%)",
                    borderRadius: "10px",
                    boxShadow: "0 2px 10px rgba(99, 102, 241, 0.1)",
                    border: "1px solid rgba(99, 102, 241, 0.1)",
                }}
            >
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-bold text-black text-md tracking-wide">Land Cover Comparison</span>

                    <LayerSelector selectedLayer={selectedLayer} onLayerChange={handleLayerChange} />

                    {showDifferenceUI && availableDates.length > 0 && (
                        <DateRangeSelector
                            availableDates={availableDates}
                            startDate={diffStartDate}
                            endDate={diffEndDate}
                            onStartDateChange={setDiffStartDate}
                            onEndDateChange={setDiffEndDate}
                        />
                    )}
                </div>

        <div className="flex items-center gap-4">
          <YearSelect
            label="Left"
            value={yearLeft}
            onChange={setYearLeft}
            disabledYears={[yearRight]}
          />
          <YearSelect
            label="Right"
            value={yearRight}
            onChange={setYearRight}
            disabledYears={[yearLeft]}
          />
        </div>
      </div>

      <div
        className="flex-1 min-h-0 relative rounded-lg overflow-hidden border border-gray-200"
        style={{
          height: isMobile ? "450px" : "100%",
          minHeight: isMobile ? "400px" : "auto",
        }}
      >
        <div ref={mapContainerRef} className="absolute inset-0" />

                {!loading && !error && (
                    <>
                        <LULCLegend />
                        {showVelocityUI && <VelocityLegend />}
                    </>
                )}

                <div className="absolute top-3 right-3 z-[1500]">
                    <FullscreenButton isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
                </div>

                {!loading && !error && (
                    <div className="absolute left-2.5 z-[1500]" style={{ top: isMobile ? "140px" : "80px" }}>
                        <button
                            onClick={() => setIsLayerPanelOpen(!isLayerPanelOpen)}
                            className={`
                                flex items-center justify-center w-[34px] h-[34px]
                                bg-white rounded-[4px] border-2
                                transition-all duration-200 hover:bg-gray-50
                                ${isLayerPanelOpen
                                    ? "border-blue-500 bg-blue-50 text-blue-600"
                                    : "border-gray-400 text-gray-700 hover:border-gray-500"
                                }
                                focus:outline-none focus:ring-0
                                leaflet-bar
                            `}
                            style={{ boxShadow: "0 1px 5px rgba(0,0,0,0.1)" }}
                            aria-label="Toggle layer control"
                        >
                            <Layers size={22} />
                        </button>

            {isLayerPanelOpen && (
              <div
                className={`
                                    absolute top-0 left-full ml-2 bg-white rounded-[4px] border-2 border-gray-300
                                    p-3 min-w-[120px] max-w-[170px]
                                    ${isMobile ? "min-w-[120px]" : ""}
                                    shadow-lg
                                `}
                                style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.15)" }}
                            >
                                <div className="flex items-center justify-between mb-1 pb-1 border-b border-gray-200">
                                    <h3 className="text-xs font-semibold text-gray-700">Layers</h3>
                                    <button
                                        onClick={() => setIsLayerPanelOpen(false)}
                                        className="text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full p-0.5 transition-all duration-200"
                                    >
                                        <X size={16} strokeWidth={3} />
                                    </button>
                                </div>

                                <div>
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Overlays</p>
                                    <div className="flex flex-col gap-1.5">
                                        {availableLayers.map((layer) => (
                                            <label
                                                key={layer.id}
                                                className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:text-blue-600 transition-colors"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={layer.id === "lulc" ? showLULC : activeLayers.includes(layer.id)}
                                                    onChange={() => handleLayerToggle(layer.id)}
                                                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                                />
                                                <span>{layer.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="mt-2 pt-1 border-t border-gray-100">
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Base Map</p>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:text-blue-600 transition-colors">
                                            <input
                                                type="radio"
                                                name="baseLayer"
                                                checked={baseLayer === "streets"}
                                                onChange={() => handleBaseLayerChange("streets")}
                                                className="w-3.5 h-3.5 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                            />
                                            <span>Streets</span>
                                        </label>
                                        <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:text-blue-600 transition-colors">
                                            <input
                                                type="radio"
                                                name="baseLayer"
                                                checked={baseLayer === "satellite"}
                                                onChange={() => handleBaseLayerChange("satellite")}
                                                className="w-3.5 h-3.5 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                            />
                                            <span>Google Satellite</span>
                                        </label>
                                        <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:text-blue-600 transition-colors">
                                            <input
                                                type="radio"
                                                name="baseLayer"
                                                checked={baseLayer === "esri_satellite"}
                                                onChange={() => handleBaseLayerChange("esri_satellite")}
                                                className="w-3.5 h-3.5 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                            />
                                            <span>Esri Satellite</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Divider tag + line with smooth opacity transitions */}
                <div
                    ref={tagRef}
                    className="absolute bottom-4 pointer-events-none"
                    style={{
                        left: "0px",
                        transform: "translateX(-50%)",
                        opacity: 0,
                        transition: `opacity ${LULC_FADE_MS}ms ease`,
                        zIndex: 400,
                    }}
                >
                    <div className="flex items-center gap-2 bg-gray-900/80 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg">
                        <span>{yearLeft}</span>
                        <span className="text-gray-400">|</span>
                        <span>{yearRight}</span>
                    </div>
                </div>

                <div
                    ref={dividerLineRef}
                    className="absolute top-0 bottom-0 pointer-events-none"
                    style={{
                        left: "0px",
                        width: "2px",
                        background: "rgba(59, 130, 246, 0.5)",
                        transform: "translateX(-50%)",
                        boxShadow: "0 0 10px rgba(59, 130, 246, 0.3)",
                        opacity: 0,
                        transition: `opacity ${LULC_FADE_MS}ms ease`,
                        zIndex: 399,
                    }}
                />

                {(loading || flyoversLoading || movementLoading) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm z-[500]">
                        <div className="flex flex-col items-center gap-2 bg-white px-5 py-4 rounded-xl shadow-lg border border-gray-200">
                            <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                            <p className="text-xs text-gray-500">
                                {loading
                                    ? "Initializing map..."
                                    : movementLoading
                                        ? "Loading movement points..."
                                        : "Loading flyover data..."}
                            </p>
                        </div>
                    </div>
                )}

                {(error || movementError) && (
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-center gap-2 shadow-lg max-w-md">
                        <AlertTriangle size={16} className="flex-shrink-0" />
                        <span>{error || movementError}</span>
                    </div>
                )}

                {showChart && selectedPointForChart && selectedDetailForChart && (
                    <MovementPointsChart
                        pointData={selectedPointForChart}
                        detailData={selectedDetailForChart}
                        onClose={() => {
                            setShowChart(false);
                            setSelectedPointForChart(null);
                            setSelectedDetailForChart(null);
                        }}
                    />
                )}

                {showDiffChart && diffPointData && diffDetailData && (
                    <MovementDiffChart
                        pointData={diffPointData}
                        detailData={diffDetailData}
                        startDate={diffStartDate}
                        endDate={diffEndDate}
                        onClose={() => {
                            setShowDiffChart(false);
                            setDiffPointData(null);
                            setDiffDetailData(null);
                        }}
                    />
                )}
            </div>
        </div>
    );
}