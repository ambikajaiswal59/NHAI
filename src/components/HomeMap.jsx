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
import MonthTimelineBar from "./map/MonthTimelineBar";

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

import IDWLegend from "./map/IDWLegend";

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

  // Use the IDW Weather Hook
  const {
    weatherData,
    allMonthlyData,
    loading: idwLoading,
    error: idwError,
    selectedMonth,
    selectedLayer,
    months,
    currentMonthIndex,
    isPlaying,
    isRendering,
    fetchAllMonthlyData,
    changeMonth,
    nextMonth,
    prevMonth,
    startPlayback,
    stopPlayback,
    clearData,
    changeLayer
  } = useIDWWeather();

  const [idwLayer, setIdwLayer] = useState(null);
  const idwLayerRef = useRef(null);
  const [bufferBoundary, setBufferBoundary] = useState(null);
  const preRenderStartedRef = useRef(false); // ✅ Track if pre-rendering has started

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

  // Handle IDW layer selection
  const handleIdwSelect = useCallback(
    (layerId) => {
      setIdwLayer(layerId);

      if (layerId !== null) {
        preRenderStartedRef.current = false;
        changeLayer(layerId);
      }

      if (layerId === null) {
        if (idwLayerRef.current && mapRef.current) {
          try {
            mapRef.current.removeLayer(idwLayerRef.current);
            idwLayerRef.current = null;
          } catch (e) { }
        }
        preRenderStartedRef.current = false;
        clearData();
      }
    },
    [changeLayer, clearData],
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

  // ✅ UPDATED: Create or UPDATE IDW layer with pre-rendering trigger

  useEffect(() => {
    // If no IDW layer selected, remove layer and return
    if (!idwLayer) {
      if (idwLayerRef.current) {
        try {
          mapRef.current?.removeLayer(idwLayerRef.current);
          idwLayerRef.current = null;
        } catch (e) { }
      }
      preRenderStartedRef.current = false;
      return;
    }

    // ✅ If weatherData is null but allMonthlyData exists, try to get data
    let currentData = weatherData;
    if (!currentData || currentData.length === 0) {
      if (selectedMonth && allMonthlyData) {
        currentData = allMonthlyData.filter(item =>
          `${item.year}-${String(item.month).padStart(2, '0')}` === selectedMonth
        );
        // ✅ Update weatherData so it's available for future renders
        if (currentData && currentData.length > 0) {
          setWeatherData(currentData);
        }
      } else if (allMonthlyData && months.length > 0) {
        const firstMonth = months[0];
        currentData = allMonthlyData.filter(item =>
          `${item.year}-${String(item.month).padStart(2, '0')}` === firstMonth
        );
        if (currentData && currentData.length > 0) {
          setWeatherData(currentData);
          setSelectedMonth(firstMonth);
        }
      }
    }

    // If still no data, return
    if (!currentData || currentData.length === 0 || !mapRef.current) {
      return;
    }

    const propertyMap = {
      temperature: "avg_temp",
      rainfall: "rain_precip",
      wind: "wind",
    };
    const property = propertyMap[idwLayer];
    if (!property) return;

    // ✅ If layer exists, update it
    if (idwLayerRef.current) {
      console.log('🔄 Updating existing IDW layer for month:', selectedMonth);
      try {
        idwLayerRef.current.updateData(
          currentData,
          property,
          `${selectedMonth || "latest"}::${property}`
        );
      } catch (error) {
        console.error("Error updating IDW layer:", error);
      }
      return;
    }

    // ✅ CREATE NEW LAYER
    console.log('🎨 Creating NEW IDW layer for:', idwLayer);

    (async () => {
      try {
        const newLayer = createIDWLayer(
          currentData,
          property,
          {
            opacity: 0.85,
            zIndex: 100,
            clipPolygon: bufferBoundary,
            cacheKey: `${selectedMonth || "latest"}::${property}`,
            propertyMap: propertyMap,
          }
        );

        // ✅ Pre-render current month first
        console.log('⏳ Pre-rendering current month before adding to map...');
        const currentMonthData = allMonthlyData?.filter(item =>
          `${item.year}-${String(item.month).padStart(2, '0')}` === selectedMonth
        ) || currentData;

        await newLayer.preRenderAllMonths(
          currentMonthData,
          idwLayer,
          propertyMap
        );
        console.log('✅ Current month pre-rendered — adding layer to map now');

        // ✅ ADD LAYER TO MAP
        if (!mapRef.current) return;
        newLayer.addTo(mapRef.current);
        idwLayerRef.current = newLayer;

        // ✅ Pre-render remaining months in background
        if (allMonthlyData?.length && !preRenderStartedRef.current) {
          preRenderStartedRef.current = true;
          console.log('🔥 Background pre-rendering ALL layers × ALL months...');

          newLayer.preRenderAllLayers(
            allMonthlyData,
            ['temperature', 'rainfall', 'wind'],
            propertyMap
          ).catch(err => console.warn('Background pre-render failed:', err));
        }

      } catch (error) {
        console.error("Error creating IDW layer:", error);
      }
    })();

    return () => {
      // Cleanup on unmount
      if (idwLayerRef.current && mapRef.current) {
        try {
          mapRef.current.removeLayer(idwLayerRef.current);
          idwLayerRef.current = null;
        } catch (e) { }
      }
    };
  }, [idwLayer, weatherData, bufferBoundary, selectedMonth, allMonthlyData, months]);



  // Load initial monthly data
  useEffect(() => {
    fetchAllMonthlyData();
  }, [fetchAllMonthlyData]);

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
      className={`w-full max-w-full h-auto lg:h-[480px] min-h-0 flex flex-col gap-3 bg-transparent overflow-x-hidden ${showTrafficMap ? 'lg:flex-col' : 'lg:flex-row'
        }`}
    >
      {/* <div className={`relative w-full max-w-full h-[320px] lg:h-auto lg:flex-1 min-w-0 min-h-[300px] rounded-xl2 overflow-hidden shadow-card ring-2 ring-gray-200 ${showTrafficMap ? 'w-full' : ''
        } ${idwLayer && months.length > 0 && !showTrafficMap ? 'pb-14' : ''}`}> */}
      <div className={`relative w-full max-w-full h-[320px] lg:h-auto lg:flex-1 min-w-0 min-h-[300px] rounded-xl2 overflow-hidden shadow-card ring-2 ring-gray-200 ${showTrafficMap ? 'w-full' : ''}`}>
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
                    selectedMonth={selectedMonth}
                    isLoading={isWeatherLoading}
                    dataCount={weatherData?.length || 0}
                    error={idwError}
                    months={months}
                    currentMonthIndex={currentMonthIndex}
                    isPlaying={isPlaying}
                    isRendering={isRendering}
                    onPlay={startPlayback}
                    onPause={stopPlayback}
                    onNextMonth={nextMonth}
                    onPrevMonth={prevMonth}
                  />
                </div>
                <div className="block md:hidden">
                  <IdwLayerDropdown
                    selectedId={idwLayer}
                    onSelect={handleIdwSelect}
                    selectedMonth={selectedMonth}
                    isLoading={isWeatherLoading}
                    dataCount={weatherData?.length || 0}
                    error={idwError}
                    months={months}
                    currentMonthIndex={currentMonthIndex}
                    isPlaying={isPlaying}
                    isRendering={isRendering}
                    onPlay={startPlayback}
                    onPause={stopPlayback}
                    onNextMonth={nextMonth}
                    onPrevMonth={prevMonth}
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
          <MapContainer
            ref={mapRef}
            center={REGION_CENTER}
            zoom={REGION_ZOOM}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            scrollWheelZoom
            zoomControl
            attributionControl={false}
            style={{
              height: "100%",
              width: "100%",
              flex: "1",
              minWidth: "0"
            }}
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

            {/* IDW Legend - Bottom Left */}
            {idwLayer && weatherData && weatherData.length > 0 && (
              <IDWLegend
                data={weatherData}
                property={idwLayer === 'temperature' ? 'avg_temp' :
                  idwLayer === 'rainfall' ? 'rain_precip' : 'wind'}
              />
            )}

            {/* Month Timeline Bar - Bottom Center */}
            {idwLayer && months.length > 0 && !showTrafficMap && (
              <MonthTimelineBar
                months={months}
                currentMonthIndex={currentMonthIndex}
                isPlaying={isPlaying}
                onPlay={startPlayback}
                onPause={stopPlayback}
                onSelectMonth={changeMonth}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[500]"
              />
            )}
          </MapContainer>
        )}
      </div>

      {!isFullscreen && !showTrafficMap && (
        <div className="w-full lg:w-[380px] shrink-0 h-[420px] lg:h-full min-h-0 flex-shrink-0">
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
