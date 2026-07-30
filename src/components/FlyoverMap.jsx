// components/FlyoverMap.jsx
import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Maximize2, Minimize2, CloudRain, Cloud, Sun, Wind, Droplets, Eye, Loader2 } from "lucide-react";
import { createRoot } from "react-dom/client";

function ResizeHandler() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

// Deliberately re-focuses the map on the layer's full extent the moment
// this card enters fullscreen — the zoom/center chosen for the small card
// view rarely makes sense once the container is the whole screen. Restores
// the pre-fullscreen view on exit so the card looks the same as before.
function FullscreenFit({ geojson, isFullscreen }) {
  const map = useMap();
  const prevViewRef = useRef(null);

  useEffect(() => {
    if (isFullscreen) {
      prevViewRef.current = { center: map.getCenter(), zoom: map.getZoom() };
      // small delay lets the native fullscreen transition/resize settle
      // before we measure the container and compute new bounds
      const t = setTimeout(() => {
        map.invalidateSize();
        try {
          const bounds = getGeoJsonBounds(geojson);
          if (bounds) {
            map.fitBounds(bounds, { padding: [60, 60] });
          }
        } catch (e) {
          console.warn('Error fitting bounds on fullscreen:', e);
        }
      }, 150);
      return () => clearTimeout(t);
    } else if (prevViewRef.current) {
      const { center, zoom } = prevViewRef.current;
      const t = setTimeout(() => {
        map.invalidateSize();
        map.setView(center, zoom);
      }, 150);
      return () => clearTimeout(t);
    }
  }, [isFullscreen, map, geojson]);

  return null;
}

function FitBounds({ geojson }) {
  const map = useMap();
  const hasFitRef = useRef(false);
  // Stable content-based key instead of the raw geojson reference — if the
  // parent re-renders and passes a new object/array reference for the same
  // data (which happens on state changes elsewhere, e.g. toggling
  // fullscreen), this won't re-trigger a refit and change the zoom level.
  const contentKey = geojson?.features
    ? JSON.stringify(geojson.features.map((f) => f.properties?.OBJECTID))
    : null;

  useEffect(() => {
    if (hasFitRef.current) return;
    try {
      const bounds = getGeoJsonBounds(geojson);
      if (bounds) {
        map.fitBounds(bounds, { padding: [30, 30] });
        hasFitRef.current = true;
      }
    } catch (e) {
      console.warn('Error fitting bounds:', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, contentKey]);
  return null;
}

function getGeoJsonBounds(geojson) {
  if (!geojson || !geojson.features || geojson.features.length === 0) return null;
  const lats = [];
  const lngs = [];
  const walk = (coords) => {
    if (typeof coords[0] === 'number') {
      const [lng, lat] = coords;
      lats.push(lat);
      lngs.push(lng);
      return;
    }
    coords.forEach(walk);
  };
  geojson.features.forEach(f => walk(f.geometry.coordinates));
  if (lats.length === 0) return null;
  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ];
}

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng;
      if (onMapClick) onMapClick(lat, lng);
    },
  });
  return null;
}

// Fullscreen toggle rendered as a native Leaflet control, positioned next
// to the zoom buttons. Re-renders its own icon (Maximize2 <-> Minimize2)
// on every fullscreenchange event instead of staying fixed on one icon.
function FullscreenControl({ containerRef }) {
  const map = useMap();

  useEffect(() => {
    let root;
    let iconEl;

    const renderIcon = (fullscreen) => {
      if (!root) return;
      root.render(
        fullscreen
          ? <Minimize2 size={15} className="text-gray-700" />
          : <Maximize2 size={15} className="text-gray-700" />
      );
    };

    const Control = L.Control.extend({
      onAdd: () => {
        const el = L.DomUtil.create("div", "leaflet-bar leaflet-control");
        el.style.background = "white";
        el.style.width = "30px";
        el.style.height = "30px";
        el.style.display = "flex";
        el.style.alignItems = "center";
        el.style.justifyContent = "center";
        el.style.cursor = "pointer";
        L.DomEvent.disableClickPropagation(el);
        L.DomEvent.on(el, "click", () => {
          if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen?.();
          } else {
            document.exitFullscreen?.();
          }
        });

        iconEl = el;
        root = createRoot(el);
        renderIcon(false);
        return el;
      },
    });
    const control = new Control({ position: "topright" });
    control.addTo(map);

    const handleChange = () => {
      renderIcon(document.fullscreenElement === containerRef.current);
      setTimeout(() => map.invalidateSize(), 100);
    };
    document.addEventListener("fullscreenchange", handleChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleChange);
      control.remove();
    };
  }, [map, containerRef]);

  return null;
}

// Classic map-pin (location marker) — teardrop outline with a hollow
// center circle, matching lucide's MapPin glyph, in brand gradient.
const locationIcon = L.divIcon({
  className: "flyover-location-marker",
  html: `
        <div class="pin-pop">
            <div class="pin-pulse"></div>
            <svg width="30" height="36" viewBox="0 0 24 30" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 0C6.48 0 2 4.48 2 10c0 7.5 10 20 10 20s10-12.5 10-20c0-5.52-4.48-10-10-10z"
                      fill="url(#pinGrad)" stroke="#ffffff" stroke-width="1.5"/>
                <circle cx="12" cy="10" r="4" fill="#ffffff"/>
                <defs>
                    <linearGradient id="pinGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#2563EB"/>
                        <stop offset="100%" stop-color="#0EA5E9"/>
                    </linearGradient>
                </defs>
            </svg>
        </div>
    `,
  iconSize: [30, 36],
  iconAnchor: [15, 34],
  popupAnchor: [0, -30],
});

const conditionIconFor = (code) => {
  if (code === "rain" || code === "storm") return CloudRain;
  if (code === "cloudy" || code === "clouds") return Cloud;
  return Sun;
};

// Compact weather card rendered inside the Leaflet popup. Handles its own
// loading state so the popup can open the instant the marker is placed,
// before the weather API response has come back.
function WeatherPopupCard({ weather, loading }) {
  if (loading || !weather) {
    return (
      <div className="w-[210px] bg-white p-3.5 flex items-center justify-center gap-2 text-gray-500 text-xs font-medium">
        <Loader2 size={14} className="animate-spin" />
        Fetching weather…
      </div>
    );
  }

  const Icon = conditionIconFor(weather.conditionCode);

  const stats = [
    { icon: Wind, value: `${weather.wind} km/h`, label: "Wind" },
    { icon: Droplets, value: `${weather.humidity}%`, label: "Humidity" },
    { icon: CloudRain, value: `${weather.rainfall} mm`, label: "Rainfall" },
    { icon: Eye, value: `${weather.visibility} km`, label: "Visibility" },
  ];

  return (
    <div className="w-[210px] bg-white p-3.5">
      <p className="text-sm font-bold text-gray-800 truncate mb-2">{weather.location}</p>

      <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
        <div className="bg-blue-50 rounded-full p-2 shrink-0">
          <Icon size={22} className="text-blue-500" />
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline gap-0.5">
            <span className="text-2xl font-bold text-gray-800 leading-none">{weather.temp}°</span>
            <span className="text-xs text-gray-400 font-medium">C</span>
          </div>
          <p className="text-xs text-gray-500 truncate mt-0.5">{weather.condition}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 mt-3">
        {stats.map(({ icon: StatIcon, value, label }) => (
          <div key={label} className="flex items-center gap-1.5 min-w-0">
            <StatIcon size={14} className="text-slate-400 shrink-0" />
            <div className="min-w-0 leading-tight">
              <p className="text-[13px] font-semibold text-gray-700 truncate">{value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FlyoverGeoJsonLayer({ data, color, isActive, onFeatureClick }) {
  if (!data || !data.features || data.features.length === 0) return null;

  const style = () => ({
    color,
    weight: isActive ? 3 : 2,
    opacity: 0.9,
    fillColor: color,
    fillOpacity: isActive ? 0.45 : 0.3,
  });

  const onEachFeature = (feature, layer) => {
    layer.on({
      click: (e) => {
        L.DomEvent.stopPropagation(e);
        const { lat, lng } = e.latlng;
        if (onFeatureClick) onFeatureClick(lat, lng);
      },
      mouseover: (e) => {
        e.target.setStyle({ fillOpacity: 0.55, weight: 3 });
      },
      mouseout: (e) => {
        e.target.setStyle(style());
      },
    });
  };

  return (
    <GeoJSON
      key={JSON.stringify(data.features.map(f => f.properties?.OBJECTID))}
      data={data}
      style={style}
      onEachFeature={onEachFeature}
    />
  );
}

export default function FlyoverMap({
  center,
  zoom,
  points,
  geojson,
  riskStatus,
  onMapClick,
  isActive,
  markerPosition,
  weather,
  weatherLoading,
}) {
  const containerRef = useRef(null);
  const markerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const riskColorMap = { low: "#22c55e", moderate: "#f97316", high: "#ef4444" };

  // Compare against this card's own container — with multiple map cards on
  // the page, a global fullscreenchange event fires for whichever one went
  // fullscreen, so each card must check it's actually the one in question.
  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  const getOverallRiskColor = () => {
    if (riskStatus && riskColorMap[riskStatus]) return riskColorMap[riskStatus];
    if (!points || points.length === 0) return "#facc15";
    const hasCritical = points.some(p => p.status === "critical");
    const hasAlert = points.some(p => p.status === "alert");
    if (hasCritical) return "#ef4444";
    if (hasAlert) return "#f97316";
    return "#22c55e";
  };

  const pathColor = getOverallRiskColor();
  const validCenter = center && center.length === 2 ? center : [28.6139, 77.2290];

  const handleClick = (lat, lng) => {
    if (onMapClick) onMapClick(lat, lng);
  };

// Must live *inside* MapContainer to use useMap(). Invalidates the map's
// cached size before opening the popup — right after a fullscreen
// transition Leaflet's internal size can be stale, which throws off the
// popup's pixel position and makes it render off-screen (looks like no
// popup shows up at all). Only opens the popup when this card is the one
// currently in fullscreen — in the normal grid view, a click should just
// update the side WeatherPanel, not pop anything up on the map.
function PopupOpener({ markerRef, markerPosition, isFullscreen }) {
  const map = useMap();
  useEffect(() => {
    if (markerPosition && markerRef.current && isFullscreen) {
      map.invalidateSize();
      requestAnimationFrame(() => {
        markerRef.current?.openPopup();
      });
    }
  }, [markerPosition, map, markerRef, isFullscreen]);
  return null;
}

  return (
    <div ref={containerRef} className="w-full h-full bg-black">
      <style>{`
        .pin-pop {
          position: relative;
          animation: pinPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .pin-pulse {
          position: absolute;
          top: 8px;
          left: 50%;
          transform: translateX(-50%);
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: rgba(37, 99, 235, 0.45);
          animation: pinPulse 1.4s ease-out infinite;
        }
        @keyframes pinPop {
          0% { transform: translateY(-16px) scale(0.4); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes pinPulse {
          0% { transform: translateX(-50%) scale(1); opacity: 0.6; }
          100% { transform: translateX(-50%) scale(2.8); opacity: 0; }
        }
        :fullscreen .leaflet-container { border-radius: 0 !important; }

        .weather-popup .leaflet-popup-content-wrapper {
          padding: 0;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 8px 24px rgba(0,0,0,0.25);
        }
        .weather-popup .leaflet-popup-content {
          margin: 0;
        }
        .leaflet-popup-pane {
          z-index: 1200;
        }
        .weather-popup .leaflet-popup-tip {
          background: #ffffff;
        }
        .weather-popup .leaflet-popup-close-button {
          color: #9ca3af !important;
        }
        .weather-popup .leaflet-popup-close-button:hover {
          color: #374151 !important;
        }
      `}</style>

      <MapContainer
        center={validCenter}
        zoom={zoom || 15}
        scrollWheelZoom={true}
        dragging={true}
        doubleClickZoom={true}
        zoomControl={true}
        touchZoom={true}
        attributionControl={false}
        style={{ height: "100%", width: "100%", minHeight: "200px", cursor: 'pointer' }}
        className="rounded-lg"
      >
        <ResizeHandler />
        <FitBounds geojson={geojson} />
        <FullscreenFit geojson={geojson} isFullscreen={isFullscreen} />
        <MapClickHandler onMapClick={handleClick} />
        <FullscreenControl containerRef={containerRef} />
        <PopupOpener markerRef={markerRef} markerPosition={markerPosition} isFullscreen={isFullscreen} />

        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution='&copy; <a href="https://www.esri.com">Esri</a>'
        />

        <FlyoverGeoJsonLayer
          data={geojson}
          color={pathColor}
          isActive={isActive}
          onFeatureClick={handleClick}
        />

        {markerPosition && (
          <Marker
            key={`${markerPosition.lat}-${markerPosition.lng}`}
            position={[markerPosition.lat, markerPosition.lng]}
            icon={locationIcon}
            ref={markerRef}
          >
            {isFullscreen && (
              <Popup className="weather-popup" closeButton={true} autoPan={true} offset={[0, -6]}>
                <WeatherPopupCard weather={weather} loading={weatherLoading} />
              </Popup>
            )}
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}