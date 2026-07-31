// components/FlyoverMap.jsx
import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Maximize2,
  Minimize2,
  CloudRain,
  Cloud,
  Sun,
  CloudSun,
  CloudDrizzle,
  CloudLightning,
  CloudSnow,
  Wind,
  Droplets,
  Eye,
  Loader2,
  MapPin,
} from "lucide-react";
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
          console.warn("Error fitting bounds on fullscreen:", e);
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
      console.warn("Error fitting bounds:", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, contentKey]);
  return null;
}

function getGeoJsonBounds(geojson) {
  if (!geojson || !geojson.features || geojson.features.length === 0)
    return null;
  const lats = [];
  const lngs = [];
  const walk = (coords) => {
    if (typeof coords[0] === "number") {
      const [lng, lat] = coords;
      lats.push(lat);
      lngs.push(lng);
      return;
    }
    coords.forEach(walk);
  };
  geojson.features.forEach((f) => walk(f.geometry.coordinates));
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
        fullscreen ? (
          <Minimize2 size={15} className="text-gray-700" />
        ) : (
          <Maximize2 size={15} className="text-gray-700" />
        ),
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

// ---- condition -> visual language -----------------------------------
// The card itself is a single neutral dark-glass surface (see
// CARD_BACKGROUND below) so it holds up against any map terrain —
// green farmland, gray city blocks, blue coastline, dark satellite.
// Only the icon badge and its glow carry the condition's color, so the
// weather is still legible at a glance without recoloring the whole card.
const CONDITIONS = {
  clear: { icon: Sun, accent: "#fdba55", glow: "rgba(253,186,85,0.35)" },
  "partly cloudy": { icon: CloudSun, accent: "#63b3ed", glow: "rgba(99,179,237,0.3)" },
  cloudy: { icon: Cloud, accent: "#9aa5b1", glow: "rgba(154,165,177,0.25)" },
  rain: { icon: CloudRain, accent: "#4fa3d1", glow: "rgba(79,163,209,0.3)" },
  drizzle: { icon: CloudDrizzle, accent: "#7ec8e3", glow: "rgba(126,200,227,0.28)" },
  storm: { icon: CloudLightning, accent: "#b39ddb", glow: "rgba(179,157,219,0.35)" },
  snow: { icon: CloudSnow, accent: "#d9ecfb", glow: "rgba(217,236,251,0.35)" },
};

// One dark glass surface, used for every condition, so the card always
// reads as a distinct floating panel no matter what's underneath it.
const CARD_BACKGROUND =
  "linear-gradient(165deg, rgba(30,35,46,0.94) 0%, rgba(14,17,23,0.96) 100%)";

function resolveCondition(conditionCode) {
  const key = (conditionCode || "").toLowerCase();
  if (key.includes("clear") || key.includes("sun")) return CONDITIONS.clear;
  if (key.includes("partly")) return CONDITIONS["partly cloudy"];
  if (key.includes("storm") || key.includes("thunder")) return CONDITIONS.storm;
  if (key.includes("drizzle")) return CONDITIONS.drizzle;
  if (key.includes("rain")) return CONDITIONS.rain;
  if (key.includes("snow")) return CONDITIONS.snow;
  if (key.includes("cloud")) return CONDITIONS.cloudy;
  return CONDITIONS["partly cloudy"];
}

// Compact weather card rendered inside the Leaflet popup. Handles its own
// loading state so the popup can open the instant the marker is placed,
// before the weather API response has come back. Same name/props as
// before (`weather`, `loading`) so nothing else in this file needs to
// change — only the internals are redesigned.
function WeatherPopupCard({ weather, loading }) {
  if (loading || !weather) {
    return (
      <div className="w-72 rounded-[28px] bg-white/90 backdrop-blur-xl p-6 shadow-2xl ring-1 ring-black/5">
        <div className="flex items-center justify-center gap-2 text-sm font-medium text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          Fetching weather…
        </div>
      </div>
    );
  }

  const theme = resolveCondition(weather.conditionCode || weather.condition);
  const Icon = theme.icon;

  const stats = [
    { icon: Wind, value: weather.wind, unit: "km/h", label: "Wind" },
    { icon: Droplets, value: weather.humidity, unit: "%", label: "Humidity" },
    { icon: CloudRain, value: weather.rainfall, unit: "mm", label: "Rainfall" },
    { icon: Eye, value: weather.visibility, unit: "km", label: "Visibility" },
  ];

  return (
    <div
      className="relative w-72 overflow-hidden rounded-[28px] p-5 text-white shadow-[0_24px_60px_-12px_rgba(0,0,0,0.65)] ring-2 ring-white/15 backdrop-blur-xl"
      style={{ background: CARD_BACKGROUND }}
    >
      {/* faint top sheen so the glass panel reads as a lit surface, not a flat fill */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.06] via-transparent to-transparent" />

      {/* header */}
      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-1.5">
          <MapPin size={13} className="text-white/60" strokeWidth={2.5} />
          <p className="text-[14px] font-semibold tracking-wide text-white/90">
            {weather.location}
          </p>
        </div>
        <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/70 ring-1 ring-white/10">
          Live
        </span>
      </div>

      {/* hero temperature */}
      <div className="relative mt-4 flex items-center justify-between">
        <div>
          <div className="flex items-start leading-none">
            <span className="text-[56px] font-bold tracking-tight">
              {weather.temp}
            </span>
            <span className="mt-1.5 text-2xl font-semibold text-white/50">°</span>
          </div>
          <p className="mt-1 text-sm font-medium text-white/70">
            {weather.condition}
          </p>
        </div>

        {/* the only place condition color shows up: icon + its glow */}
        <div className="relative flex h-16 w-16 items-center justify-center">
          <div
            className="pointer-events-none absolute inset-0 rounded-2xl blur-xl"
            style={{ background: theme.glow }}
          />
          <div
            className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.06] ring-1 ring-white/10"
          >
            <Icon size={32} strokeWidth={1.8} style={{ color: theme.accent }} />
          </div>
        </div>
      </div>

      {/* divider */}
      <div className="relative mt-5 h-px w-full bg-white/10" />

      {/* stats row — compact glass pills instead of four heavy tiles */}
      <div className="relative mt-4 grid grid-cols-4 gap-2">
        {stats.map(({ icon: StatIcon, value, unit, label }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-1.5 rounded-2xl bg-white/[0.06] py-3 ring-1 ring-white/10"
          >
            <StatIcon size={15} className="text-white/70" strokeWidth={2} />
            <p className="text-[13px] font-bold leading-none text-white">
              {value}
              <span className="ml-0.5 text-[9px] font-medium text-white/50">
                {unit}
              </span>
            </p>
            <p className="text-[9px] font-medium uppercase tracking-wide text-white/45">
              {label}
            </p>
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
      key={JSON.stringify(data.features.map((f) => f.properties?.OBJECTID))}
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
    const hasCritical = points.some((p) => p.status === "critical");
    const hasAlert = points.some((p) => p.status === "alert");
    if (hasCritical) return "#ef4444";
    if (hasAlert) return "#f97316";
    return "#22c55e";
  };

  const pathColor = getOverallRiskColor();
  const validCenter =
    center && center.length === 2 ? center : [28.6139, 77.229];

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

        /* Popup chrome now defers almost entirely to the card itself —
           the card carries its own rounded corners, gradient and shadow,
           so the wrapper just needs to get out of the way. The default
           white triangle tip is dropped since it no longer matches a
           colored, condition-driven card; the marker below is anchor
           enough to read where the popup belongs. */
        .weather-popup .leaflet-popup-content-wrapper {
          padding: 0;
          border-radius: 28px;
          overflow: hidden;
          background: transparent;
          box-shadow: none;
        }
        .weather-popup .leaflet-popup-content {
          margin: 0;
        }
        .leaflet-popup-pane {
          z-index: 1200;
        }
        .weather-popup .leaflet-popup-tip-container {
          display: none;
        }
        .weather-popup .leaflet-popup-close-button {
          color: rgba(255,255,255,0.55) !important;
          top: 10px !important;
          right: 10px !important;
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
        style={{
          height: "100%",
          width: "100%",
          minHeight: "200px",
          cursor: "pointer",
        }}
        className="rounded-lg"
      >
        <ResizeHandler />
        <FitBounds geojson={geojson} />
        <FullscreenFit geojson={geojson} isFullscreen={isFullscreen} />
        <MapClickHandler onMapClick={handleClick} />
        <FullscreenControl containerRef={containerRef} />
        <PopupOpener
          markerRef={markerRef}
          markerPosition={markerPosition}
          isFullscreen={isFullscreen}
        />

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
              <Popup
                className="weather-popup"
                closeButton={true}
                autoPan={true}
                offset={[0, -6]}
              >
                <WeatherPopupCard weather={weather} loading={weatherLoading} />
              </Popup>
            )}
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}