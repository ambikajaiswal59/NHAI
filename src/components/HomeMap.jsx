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
} from "lucide-react";

import { loadFlyoverData } from "../utils/geoJsonParser";
// Adjust this path if WeatherPanel lives somewhere else in your project.
import WeatherPanel from "./WeatherPanel";
// import indiaBoundaryData from "../data/indiaBoundary.json";

// Centered on Haryana (adjust to Punjab center [31.1471, 75.3412] if you'd rather default there)
const REGION_CENTER = [30.3782, 76.7767];
const REGION_ZOOM = 10;

// One color per flyover — used for both the boundary line and the marker/label,
// so the dropdown swatch, the pin, and the line on the map all match up.
// Cycles if you have more than 6 flyovers.
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

// Zoom level at which labels switch from a small tag to the detailed
// name + NH number. Tweak to taste — 16 is "zoomed in a lot" on OSM tiles.
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

// Tracks the map's current zoom level and lifts it into parent state so
// marker labels can swap between "small" and "detailed" content.
function ZoomTracker({ onZoomChange }) {
  const map = useMap();

  useMapEvents({
    zoomend: () => onZoomChange(map.getZoom()),
  });

  useEffect(() => {
    onZoomChange(map.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

// Pulls a representative [lat, lng] point out of a flyover's GeoJSON (first
// coordinate of its first feature) so we can drop a marker icon on it.
function getRepresentativeLatLng(geojson) {
  if (!geojson || !geojson.features || geojson.features.length === 0)
    return null;
  const geometry = geojson.features[0].geometry;
  if (!geometry || !geometry.coordinates) return null;

  const flatten = (coords) => {
    if (typeof coords[0] === "number") return coords; // [lng, lat]
    return flatten(coords[0]);
  };

  const [lng, lat] = flatten(geometry.coordinates);
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return [lat, lng];
}

// Grabs a property off a flyover's first feature, trying several possible
// key spellings since we don't know the exact API/GeoJSON schema.
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
    "nh_number",
    "NH_Number",
    "nhNumber",
    "NH_NO",
    "highway",
    "road_no",
    "road_number",
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

// Colored circular marker icon with a small text label chip underneath.
// labelText/detailed content is decided by the caller based on zoom.
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
        ${
          labelText
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

// Fullscreen toggle button
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

// Top-right dropdown — now a multi-select checklist. Each row toggles that
// flyover's line + marker on/off directly (replaces the old Layers-control
// checkboxes, which duplicated this).
function FlyoverDropdown({ flyovers, visibleIds, onToggle, onToggleAll }) {
  const [open, setOpen] = useState(false);

  const allSelected = flyovers.length > 0 && visibleIds.size === flyovers.length;
  const noneSelected = visibleIds.size === 0;

  const label = allSelected
    ? "All Flyovers"
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

// IDW interpolation layer options. UI-only for now — selecting one just
// tracks state; the actual interpolation rendering can be wired in later.
const IDW_LAYER_OPTIONS = [
  { id: "temperature", label: "Temperature" },
  { id: "rainfall", label: "Rainfall" },
  { id: "wind", label: "Wind" },
];

function IdwLayerDropdown({ selectedId, onSelect }) {
  const [open, setOpen] = useState(false);

  const selectedLabel =
    IDW_LAYER_OPTIONS.find((o) => o.id === selectedId)?.label || "IDW Layer";

  return (
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
              className={`w-full text-left px-3 py-2 text-[12px] font-medium hover:bg-gray-50 ${
                !selectedId ? "text-blue-600 bg-blue-50" : "text-gray-700"
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
                className={`w-full flex items-center justify-between text-left px-3 py-2 text-[12px] font-medium hover:bg-gray-50 ${
                  selectedId === opt.id
                    ? "text-blue-600 bg-blue-50"
                    : "text-gray-700"
                }`}
              >
                {opt.label}
                <span className="text-[9px] uppercase tracking-wide text-gray-300">
                  soon
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Small stat chip used inside the details panel's summary grid.
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

// Right-hand details panel — restyled to echo WeatherPanel's hero-card +
// stat-chip layout, but themed around whichever flyover is selected
// (accent color, structure info) instead of weather data.
//
// With nothing selected, shows a summary list of every flyover currently
// visible on the map. Clicking a row (or a marker/line on the map) switches
// to the detailed single-flyover view.
function FlyoverDetailsPanel({ selectedFeature, meta, visibleFlyovers, onSelectFlyover }) {
  if (!selectedFeature) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <MapPin className="w-4 h-4 text-blue-400" />
          <p className="text-sm font-bold text-gray-700">All Flyovers</p>
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
    "nh_number",
    "NH_Number",
    "nhNumber",
    "NH_NO",
    "highway",
    "road_no",
    "road_number",
  ]);
  const structureId = findProp(props, [
    "structure_id",
    "structureId",
    "STRUCT_ID",
  ]);
  const status = findProp(props, ["status", "condition", "riskLevel", "risk_level"]);
  const length = findProp(props, ["length", "length_m", "LENGTH"]);
  const lanes = findProp(props, ["lanes", "no_of_lanes"]);
  const yearBuilt = findProp(props, ["year_built", "yearBuilt", "construction_year"]);
  const lastInspection = findProp(props, [
    "last_inspection",
    "lastInspection",
    "inspection_date",
  ]);

  const accentColor = meta?.color || "#8f1b8b";

  const knownKeys = new Set([
    "name", "flyover_name", "NAME",
    "nh_number", "NH_Number", "nhNumber", "NH_NO", "highway", "road_no", "road_number",
    "structure_id", "structureId", "STRUCT_ID",
    "status", "condition", "riskLevel", "risk_level",
    "length", "length_m", "LENGTH",
    "lanes", "no_of_lanes",
    "year_built", "yearBuilt", "construction_year",
    "last_inspection", "lastInspection", "inspection_date",
  ]);
  const otherEntries = Object.entries(props).filter(([key]) => !knownKeys.has(key));

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
        {/* Hero card, tinted with the flyover's assigned color */}
        {/* <div
          className="relative overflow-hidden rounded-xl p-3 mb-4"
          style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)` }}
        >
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 blur-md pointer-events-none" />
          <p className="text-[11px] text-white/80 mb-0.5 relative">Structure</p>
          <p className="text-lg font-bold text-white relative mb-1">
            {structureId || name}
          </p>
          {nh && (
            <span className="inline-flex items-center gap-1 text-xs text-white/90 bg-white/15 backdrop-blur-sm px-2 py-0.5 rounded-full w-fit relative">
              {nh}
            </span>
          )}
        </div> */}

        {/* Quick stats grid */}
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

        {/* Anything else the API returns, shown without hardcoding fields */}
        {/* {otherEntries.length > 0 && (
          <div>
            <p className="text-sm font-bold text-gray-700 mb-1.5">
              Additional details
            </p>
            <div className="space-y-2">
              {otherEntries.map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 text-[12px]"
                >
                  <span className="text-gray-500 capitalize truncate">
                    {key.replace(/_/g, " ")}
                  </span>
                  <span className="font-semibold text-gray-800 text-right truncate">
                    {String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )} */}
      </div>
    </div>
  );
}

export default function HomeMap() {
  // const [indiaData, setIndiaData] = useState(null);
  // const [stateBoundaryData, setStateBoundaryData] = useState(null);
  const [flyoversList, setFlyoversList] = useState([]); // raw list: [{ id, name, geojson }, ...]
  const [loading, setLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState("Initializing map...");
  const [overlayVisible, setOverlayVisible] = useState(true);
  // const [districtBoundaryData, setDistrictBoundaryData] = useState(null);
  // const [builtupLayerData, setBuiltupLayerData] = useState(null); // builtup boundary
  const [selectedFeature, setSelectedFeature] = useState(null); // clicked map feature
  const [selectedFlyoverMeta, setSelectedFlyoverMeta] = useState(null); // { name, color, id }
  const [visibleFlyoverIds, setVisibleFlyoverIds] = useState(new Set()); // which flyovers are shown
  const [currentZoom, setCurrentZoom] = useState(REGION_ZOOM);
  const [idwLayer, setIdwLayer] = useState(null); // "temperature" | "rainfall" | "wind" | null — UI only for now

  const mapWrapperRef = useRef(null); // for fullscreen toggle

  //build up layer
  // const builtupUrl = '/data/Haryana_builtup.geojson';

  // const stateBoundaryUrl =
  //     "https://mlinfomap.biz/geoserver/Aaj_Ka_Bharat_CONCOR/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=Aaj_Ka_Bharat_CONCOR%3AState%20Boundary&outputFormat=application/json&featureID=State%20Boundary.11";

  // const districtBoundaryUrl =
  //     "https://mlinfomap.biz/geoserver/Aaj_Ka_Bharat_CONCOR/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=Aaj_Ka_Bharat_CONCOR:Aaj_Ka_Bharat2&outputFormat=application/json&CQL_FILTER=state_ut='Haryana'";

  useEffect(() => {
    //setIndiaData(indiaBoundaryData);

    // const fetchLayer = async (url) => {
    //     debugger
    //   const response = await fetch(url);
    //   if (!response.ok) throw new Error(`HTTP ${response.status}`);
    //   console.log(`Fetched layer from ${url}`);
    //   return response.json();
    // };

    const loadBaseLayers = async () => {
      try {
        setLoadingStatus("Loading map layers...");

        // const stateBoundary = await fetchLayer(stateBoundaryUrl);
        // setStateBoundaryData(stateBoundary);

        // const districtBoundary = await fetchLayer(districtBoundaryUrl);
        // setDistrictBoundaryData(districtBoundary);

        //Builtup layer
        // const builtupBoundary = await fetchLayer(builtupUrl);
        // setBuiltupLayerData(builtupBoundary);

        // Flyovers no longer depend on a state-boundary zoom event — load them directly
        await loadFlyovers();
      } catch (err) {
        console.error(err);
        setLoadingStatus("Failed to load map data");
        setLoading(false);
      }
    };

    loadBaseLayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFlyovers = useCallback(async () => {
    try {
      const flyovers = await loadFlyoverData();

      if (flyovers && flyovers.length > 0) {
        const list = flyovers.map((flyover, index) => ({
          id: flyover.id ?? `flyover-${index + 1}`,
          name: flyover.name ?? `Flyover ${index + 1}`,
          geojson: flyover.geojson,
        }));
        setFlyoversList(list);
        // Everything visible by default
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

  // Derived per-flyover metadata: color, representative point, short/detailed
  // label text. Recomputed only when the flyover list itself changes.
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
      {/* Left: the map itself */}
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

        {/* Top-right controls: fullscreen + flyovers dropdown */}
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
          <IdwLayerDropdown selectedId={idwLayer} onSelect={setIdwLayer} />
        </div>

        <MapContainer
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

              {/* India / State / District boundary layers intentionally removed */}

              {/* <LayersControl.Overlay checked name="Builtup Boundary">
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
                            </LayersControl.Overlay> */}
            </LayersControl>
          </div>

          {/* Flyover boundaries — one color per flyover, visibility driven by the dropdown */}
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

          {/* Flyover markers + labels — small tag by default, name + NH number at high zoom */}
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

      {/* Right: flyover summary/details on top, weather below — both scroll together */}
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

          <div className=" px-3 ">
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