// components/FlyoverMap.jsx
import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Maximize2, Minimize2, CloudRain, Cloud, Sun, Wind, Droplets, Loader2 } from "lucide-react";
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

function FitBounds({ geojson }) {
  const map = useMap();
  useEffect(() => {
    try {
      const bounds = getGeoJsonBounds(geojson);
      if (bounds) {
        map.fitBounds(bounds, { padding: [30, 30] });
      }
    } catch (e) {
      console.warn('Error fitting bounds:', e);
    }
  }, [map, geojson]);
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
      <div className="w-[190px] bg-gradient-to-br from-primary to-secondary p-3 flex items-center justify-center gap-2 text-white text-xs font-medium">
        <Loader2 size={14} className="animate-spin" />
        Fetching weather…
      </div>
    );
  }

  const Icon = conditionIconFor(weather.conditionCode);

  return (
    <div className="w-[190px] bg-gradient-to-br from-primary to-secondary p-3">
      <p className="text-[10px] text-white/70 mb-1 truncate">{weather.location}</p>
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-white leading-none">{weather.temp}°</span>
          <span className="text-xs text-white/70">C</span>
        </div>
        <Icon size={22} className="text-white" />
      </div>
      <p className="text-[11px] text-white/90 font-medium mt-0.5 truncate">{weather.condition}</p>

      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/20">
        <div className="flex items-center gap-1">
          <Wind size={11} className="text-white/80" />
          <span className="text-[10px] text-white font-semibold">{weather.wind} km/h</span>
        </div>
        <div className="flex items-center gap-1">
          <Droplets size={11} className="text-white/80" />
          <span className="text-[10px] text-white font-semibold">{weather.humidity}%</span>
        </div>
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
          background: #2563EB;
        }
        .weather-popup .leaflet-popup-close-button {
          color: rgba(255,255,255,0.85) !important;
          z-index: 10;
        }
        .weather-popup .leaflet-popup-close-button:hover {
          color: #ffffff !important;
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