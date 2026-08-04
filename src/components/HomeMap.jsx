import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { MapContainer, TileLayer, LayersControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { loadFlyoverData } from "../utils/geoJsonParser";
import { useWeather } from "../hooks/useWeather";
import WeatherPanel from "../components/WeatherPanel";
import FullscreenButton from "./map/FullscreenButton";
import FlyoverDropdown from "./map/FlyoverDropdown";
import IdwLayerDropdown from "./map/IdwLayerDropdown";
import FlyoverDetailsPanel from "./map/FlyoverDetailsPanel";
import FlyoverMarkers from "./map/FlyoverMarkers";
import {
  ZoomTracker,
  FullscreenFit,
  FocusOnPoint,
  getFlyoverColor,getFlyoverDisplayName,
} from "./map/mapHelpers";

const REGION_CENTER = [30.3782, 76.7767];
const REGION_ZOOM = 10;
const DETAIL_LABEL_ZOOM = 16;

export default function HomeMap() {
  const [flyoversList, setFlyoversList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState("Initializing map...");
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [selectedHighway, setSelectedHighway] = useState(null);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [visibleFlyoverIds, setVisibleFlyoverIds] = useState(new Set());
  const [currentZoom, setCurrentZoom] = useState(REGION_ZOOM);
  const [idwLayer, setIdwLayer] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const mapWrapperRef = useRef(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      mapWrapperRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

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
    if (!loading) {
      const timeout = setTimeout(() => setOverlayVisible(false), 500);
      return () => clearTimeout(timeout);
    }
  }, [loading]);

  const flyoverMarkers = useMemo(() => {
    return flyoversList.map((flyover, index) => ({
      ...flyover,
      color: getFlyoverColor(index),
      displayName: getFlyoverDisplayName(flyover.type, index),
    }));
  }, [flyoversList]);

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

  const isDetailZoom = currentZoom >= DETAIL_LABEL_ZOOM;

  const weatherTarget = useMemo(() => {
    if (selectedPoint) {
      return { flyoverId: selectedPoint.id, lat: selectedPoint.latlng[0], lng: selectedPoint.latlng[1] };
    }
    if (selectedHighway) {
      return { flyoverId: selectedHighway.id, lat: selectedHighway.center[0], lng: selectedHighway.center[1] };
    }
    return null;
  }, [selectedPoint, selectedHighway]);

  const { weather, loading: weatherLoading } = useWeather(weatherTarget);

  const fullscreenFitData = useMemo(() => {
    if (selectedHighway) return selectedHighway.geojson || null;
    const visible = flyoverMarkers.filter((f) => visibleFlyoverIds.has(f.id));
    if (visible.length === 0) return null;
    return {
      type: "FeatureCollection",
      features: visible.flatMap((f) => f.geojson?.features || []),
    };
  }, [selectedHighway, flyoverMarkers, visibleFlyoverIds]);

  const focusTarget = selectedPoint
    ? { latlng: selectedPoint.latlng, key: `point-${selectedPoint.id}` }
    : selectedHighway
    ? { latlng: selectedHighway.center, key: `highway-${selectedHighway.id}` }
    : { latlng: null, key: null };

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
            weatherLoading={weatherLoading}
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
                  <WeatherPanel weather={weather} loading={weatherLoading} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}