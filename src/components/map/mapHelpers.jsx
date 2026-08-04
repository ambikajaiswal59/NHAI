import { useEffect, useState, useRef } from "react";
import { useMap, useMapEvents, GeoJSON } from "react-leaflet";
import L from "leaflet";

export function ZoomTracker({ onZoomChange }) {
  const map = useMap();
  useMapEvents({ zoomend: () => onZoomChange(map.getZoom()) });
  useEffect(() => {
    onZoomChange(map.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export function FadeInGeoJSON({ data, style, targetOpacity = 1, targetFillOpacity, ...rest }) {
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

export function findProp(props, keys) {
  if (!props) return null;
  for (const key of keys) {
    if (props[key] !== undefined && props[key] !== null && props[key] !== "") return props[key];
  }
  return null;
}

const FLYOVER_COLORS = [
  "#DC2626", "#2563EB", "#059669", "#D97706",
  "#7C3AED", "#DB2777", "#0891B2", "#65A30D",
];
export function getFlyoverColor(index) {
  return FLYOVER_COLORS[index % FLYOVER_COLORS.length];
}

// Display-only name — never shows the NH/highway number. Pulls a number
// out of the Type field ("F1" -> "1") and renders "Flyover 1". Falls back
// to a 1-based index if Type has no digit in it.
export function getFlyoverDisplayName(type, indexFallback = 0) {
  const match = (type || "").toString().match(/\d+/);
  const num = match ? match[0] : indexFallback + 1;
  return `Flyover ${num}`;
}

// Cleans up a raw point name like "FLYOVER-3" into "Flyover 3" for display.
export function formatPointName(rawName) {
  if (!rawName) return "";
  return rawName
    .toString()
    .replace(/[-_]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Highway-level fields (Risk category / score / segment type) — no
// highway/NH name included, only risk data.
export function getHighwayDetailFields(flyover) {
  const props = flyover?.geojson?.features?.[0]?.properties || {};
  const fields = [
    { label: "Risk", value: findProp(props, ["RiskCatego", "riskCategory"]) },
    { label: "Risk score", value: findProp(props, ["Risk SCore", "Risk Score", "riskScore"]) },
    { label: "Segment type", value: findProp(props, ["Type", "type"]) },
  ];
  return fields.filter((f) => f.value !== null && f.value !== undefined && f.value !== "");
}

// Point-level fields (Chainage/Descriptio/Length/Detail) from FlyOver_Name.
export function getPointDetailFields(point) {
  if (!point) return [];
  const fields = [
    { label: "Chainage", value: point.chainage },
    { label: "Type", value: point.description },
    { label: "Length", value: point.length },
    { label: "Structure", value: point.detail },
  ];
  return fields.filter((f) => f.value !== null && f.value !== undefined && f.value !== "");
}

// labelText: short chip text at low/medium zoom.
// detailed: renders a wider card with `name` + every field in detailFields.
export function makeFlyoverIcon({ color, labelText, detailed, name, detailFields = [] }) {
  const width = detailed ? 240 : 120;

  const detailRows = detailed
    ? detailFields
        .map(
          (f) => `
        <div style="display:flex; justify-content:space-between; gap:6px; padding:1.5px 0;">
          <span style="color:#9ca3af; font-size:9px; font-weight:600; text-transform:uppercase; letter-spacing:0.02em; flex-shrink:0;">${f.label}</span>
          <span style="color:#1f2937; font-size:10px; font-weight:600; text-align:right; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${f.value}</span>
        </div>`,
        )
        .join("")
    : "";

  const labelBlock = detailed
    ? `
      <div style="
          background: white;
          border: 1px solid ${color}55;
          border-top: 3px solid ${color};
          padding: 6px 9px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.25);
          width: ${width}px;
      ">
        ${
          name
            ? `<div style="font-size:12px; font-weight:700; color:#111827; margin-bottom:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${name}</div>`
            : ""
        }
        ${detailRows}
      </div>`
    : labelText
    ? `<div style="
          background: white;
          border: 1px solid ${color}55;
          padding: 2px 7px;
          border-radius: 6px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.2);
          font-size: 10px;
          font-weight: 600;
          color: #1f2937;
          white-space: nowrap;
          max-width: ${width - 10}px;
          overflow: hidden;
          text-overflow: ellipsis;
      ">${labelText}</div>`
    : "";

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
        ${labelBlock}
      </div>
    `,
    iconSize: [width, detailed ? 58 + detailFields.length * 14 : 58],
    iconAnchor: [width / 2, 26],
  });
}

// Fits the map to the given geojson's bounds when entering fullscreen, and
// restores the previous view on exit.
export function FullscreenFit({ data, isFullscreen, padding = [60, 60] }) {
  const map = useMap();
  const prevViewRef = useRef(null);

  useEffect(() => {
    if (isFullscreen) {
      prevViewRef.current = { center: map.getCenter(), zoom: map.getZoom() };
      const t = setTimeout(() => {
        map.invalidateSize();
        try {
          const bounds = getGeoJsonBounds(data);
          if (bounds) map.fitBounds(bounds, { padding });
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
  }, [isFullscreen, map, data]);

  return null;
}

// Flies the map to `latlng` whenever `triggerKey` changes.
export function FocusOnPoint({ latlng, triggerKey, zoom = 15 }) {
  const map = useMap();
  const prevTriggerRef = useRef(null);

  useEffect(() => {
    if (!latlng || triggerKey == null || triggerKey === prevTriggerRef.current) return;
    prevTriggerRef.current = triggerKey;
    map.flyTo(latlng, Math.max(map.getZoom(), zoom), { duration: 0.8 });
  }, [latlng, triggerKey, map, zoom]);

  return null;
}

function getGeoJsonBounds(geojson) {
  if (!geojson || !geojson.features || geojson.features.length === 0) return null;
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