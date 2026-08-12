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
import WeatherPanel from "../components/WeatherPanel";
import FullscreenButton from "./map/FullscreenButton";
import FlyoverDropdown from "./map/FlyoverDropdown";
import IdwLayerDropdown from "./map/IdwLayerDropdown";
import FlyoverDetailsPanel from "./map/FlyoverDetailsPanel";
import FlyoverMarkers from "./map/FlyoverMarkers";
import BaseLayerSwitcher, { BASE_LAYERS } from "./map/BaseLayerSwitcher";
import { createIDWLayer } from "./IDWLeafletLayer";
import { fetchIDWWeatherData } from "../services/api";
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
const DETAIL_LABEL_ZOOM = 16;

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

  const [idwLayer, setIdwLayer] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [weatherData, setWeatherData] = useState([]);
  const [weatherError, setWeatherError] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [idwLayerInstance, setIdwLayerInstance] = useState(null);
  const [bufferBoundary, setBufferBoundary] = useState(null);

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

  const isDetailZoom = currentZoom >= DETAIL_LABEL_ZOOM;

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
  const isWeatherLoading = weatherLoading || weatherLoadingFromHook;

  const fetchWeatherData = useCallback(async (date) => {
    if (!date) {
      setWeatherError("Please select a date");
      return;
    }

    setWeatherLoading(true);
    setWeatherError(null);

    try {
      const response = await fetchIDWWeatherData(date);
      if (response && response.data) {
        setWeatherData(response.data);
        setSelectedDate(date);
      } else {
        throw new Error("No data received from server");
      }
    } catch (err) {
      setWeatherError(err.message || "Failed to fetch weather data");
      console.error("Error fetching weather:", err);
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  const handleIdwSelect = useCallback(
    (layerId) => {
      setIdwLayer(layerId);
      if (layerId === null) {
        if (idwLayerInstance && mapRef.current) {
          try {
            mapRef.current.removeLayer(idwLayerInstance);
          } catch (e) { }
          setIdwLayerInstance(null);
        }
      }
    },
    [idwLayerInstance],
  );

  const handleDateChange = useCallback(
    (date) => {
      setSelectedDate(date);
      fetchWeatherData(date);
    },
    [fetchWeatherData],
  );

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

  useEffect(() => {
    if (idwLayerInstance && mapRef.current) {
      try {
        mapRef.current.removeLayer(idwLayerInstance);
      } catch (e) { }
      setIdwLayerInstance(null);
    }

    if (
      !idwLayer ||
      !weatherData ||
      weatherData.length === 0 ||
      !mapRef.current
    ) {
      return;
    }

    const propertyMap = {
      temperature: "temp_c",
      rainfall: "precip_mm",
      wind: "wind_kph",
    };
    const property = propertyMap[idwLayer];

    if (!property) return;

    try {
      const newLayer = createIDWLayer(weatherData, property, {
        opacity: 0.85,
        zIndex: 100,
        clipPolygon: bufferBoundary,
        cacheKey: `${selectedDate || "latest"}::${property}`,
      });

      newLayer.addTo(mapRef.current);
      setIdwLayerInstance(newLayer);
    } catch (error) {
      console.error("Error creating IDW layer:", error);
      setWeatherError("Failed to render IDW layer");
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

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    setSelectedDate(today);
    fetchWeatherData(today);
  }, [fetchWeatherData]);

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
      className="w-full min-h-[560px] h-full flex flex-col lg:flex-row gap-3 bg-transparent"
    >
      <div className="relative flex-1 min-w-0 min-h-[400px] rounded-xl2 overflow-hidden shadow-card ring-2 ring-gray-200">
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

        {/* LEFT CONTROLS — only in Leaflet view, since traffic view's
            spot there is occupied by GoogleMapComponent's own
            "MAP TYPE" panel */}
        {!showTrafficMap && (
          <div
            className="
              absolute
              left-[11.1px]
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
          {/* FULLSCREEN — only in traffic view, sits next to Exit */}
          {showTrafficMap && (
            <div className="shrink-0 isolate [zoom:0.57] sm:[zoom:1]">
              <FullscreenButton
                isFullscreen={isFullscreen}
                onToggle={toggleFullscreen}
              />
            </div>
          )}

          {/* TRAFFIC / EXIT */}
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
              className={`
                flex items-center justify-center gap-1
                px-2 py-1
                rounded-lg
                shadow-md
                transition-all duration-200
              text-[12px] font-semibold text-gray-700 hover:bg-gray-50
                whitespace-nowrap
                ${showTrafficMap
                  ? "bg-blue-500 text-white hover:bg-blue-600"
                  : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
                }
              `}
            >
              <TrafficCone className="w-4 h-4 shrink-0" />
              <span>{showTrafficMap ? "Exit" : "Traffic"}</span>
            </button>
          </div>

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
                    isLoading={isWeatherLoading}
                    dataCount={weatherData.length}
                    error={weatherError}
                  />
                </div>
                <div className="block md:hidden">
                  <IdwLayerDropdown
                    selectedId={idwLayer}
                    onSelect={handleIdwSelect}
                    selectedDate={selectedDate}
                    onDateChange={handleDateChange}
                    isLoading={isWeatherLoading}
                    dataCount={weatherData.length}
                    error={weatherError}
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
        <div className=" w-full lg:w-[380px] shrink-0">
          <div className="w-full h-full flex flex-col gap-3">
            <div className="flex-1 min-h-0 w-full rounded-xl2 overflow-hidden shadow-card ring-2 ring-gray-200 bg-white flex flex-col">
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
                    <p className="text-sm font-bold text-gray-700 mb-2 px-1">
                      Weather
                    </p>
                    <div className="h-[480px]">
                      <WeatherPanel
                        weather={weather}
                        loading={isWeatherLoading}
                      />
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
