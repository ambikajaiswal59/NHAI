import { useEffect, useState, useRef } from "react";
import { useMap, useMapEvents, GeoJSON } from "react-leaflet";
import L from "leaflet";

// ============================================================
// EXISTING FUNCTIONS (keep these as they are)
// ============================================================

export function ZoomTracker({ onZoomChange }) {
  const map = useMap();
  useMapEvents({ zoomend: () => onZoomChange(map.getZoom()) });
  useEffect(() => {
    onZoomChange(map.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export function FadeInGeoJSON({
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

export function findProp(props, keys) {
  if (!props) return null;
  for (const key of keys) {
    if (props[key] !== undefined && props[key] !== null && props[key] !== "")
      return props[key];
  }
  return null;
}

const FLYOVER_COLORS = [
  "#DC2626",
  "#2563EB",
  "#059669",
  "#D97706",
  "#7C3AED",
  "#DB2777",
  "#0891B2",
  "#65A30D",
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
  return (
    rawName
      .toString()
     // .replace(/[-_]+/g, " ")
      // .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

// Highway-level fields (Risk category / score / segment type) — no
// highway/NH name included, only risk data.
export function getHighwayDetailFields(flyover) {
  const props = flyover?.geojson?.features?.[0]?.properties || {};
  const fields = [
    { label: "Risk", value: findProp(props, ["RiskCatego", "riskCategory"]) },
    {
      label: "Risk score",
      value: findProp(props, ["Risk SCore", "Risk Score", "riskScore"]),
    },
    { label: "Segment type", value: findProp(props, ["Type", "type"]) },
  ];
  return fields.filter(
    (f) => f.value !== null && f.value !== undefined && f.value !== "",
  );
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
  return fields.filter(
    (f) => f.value !== null && f.value !== undefined && f.value !== "",
  );
}

// ============================================================
// UNIFIED CANVAS ICON GENERATOR - Works for BOTH Leaflet & Google Maps
// ============================================================

// --- Pin geometry constants -----------------------------------------
// These control how the circular pin is drawn on the canvas.
// TOP_PADDING is the distance from the top edge of the canvas to the
// CENTER of the pin circle. It must be large enough that the circle's
// radius + its white border + its drop shadow all fit inside the
// canvas without being clipped by the top edge — that clipping is what
// was making the icons look "cut off" instead of a full circular ring.
const PIN_RADIUS = 14;
const PIN_BORDER_WIDTH = 3;
const PIN_SHADOW_BLUR = 6;
const PIN_SHADOW_OFFSET_Y = 2;
const TOP_PADDING = PIN_RADIUS + PIN_BORDER_WIDTH / 2 + PIN_SHADOW_BLUR + PIN_SHADOW_OFFSET_Y + 4; // ~29, rounded below
const LABEL_GAP = 6; // gap between the bottom of the pin ring and the label box

/**
 * Helper: Draw rounded rectangle on canvas
 */
function roundRect(ctx, x, y, w, h, r) {
  if (r > w / 2) r = w / 2;
  if (r > h / 2) r = h / 2;
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  return ctx;
}

/**
 * Draw the pin icon on canvas — a full circular ring (colored fill +
 * white border) with a small white dot in the center. Uses PIN_RADIUS /
 * PIN_BORDER_WIDTH / PIN_SHADOW_BLUR so the whole ring always has room
 * to render without being clipped by the canvas edge.
 */
function drawPin(ctx, color, pinX, pinY) {
  const radius = PIN_RADIUS;

  // Pin shadow
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = PIN_SHADOW_OFFSET_Y;

  // Main circle
  ctx.beginPath();
  ctx.arc(pinX, pinY, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // Reset shadow
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // White border (the "ring") — full stroke, no clipping
  ctx.beginPath();
  ctx.arc(pinX, pinY, pinRadius, 0, Math.PI * 2);
  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Pin icon (simplified pin shape)
  ctx.fillStyle = "white";
  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;

  // Draw pin icon
  ctx.beginPath();
  ctx.arc(pinX, pinY, 4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fill();
  ctx.stroke();

  // Inner circle
  ctx.beginPath();
  ctx.arc(pinX, pinY + 1, 3, 0, Math.PI * 2);
  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  ctx.stroke();
}

/**
 * Draw the label on canvas
 */
function drawLabel(
  ctx,
  { color, labelText, detailed, name, detailFields = [] },
  labelX,
  pinY,
  labelHeight,
) {
  if (detailed) {
    // ... detailed layout logic stays same, just positioned at labelX / pinY - labelHeight/2
  } else if (labelText) {
    ctx.font = "800 10px Arial, sans-serif";
    const textWidth = ctx.measureText(labelText).width;
    const padding = 2;
    const labelWidth = textWidth + padding * 4 + 4;
    const labelY = pinY - labelHeight / 2; // vertically centered on pin

    ctx.shadowColor = "rgba(0,0,0,0.2)";
    ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;

    ctx.fillStyle = "white";
    ctx.beginPath();
    roundRect(ctx, labelX, labelY, labelWidth, labelHeight, 5);
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.strokeStyle = color + "55";
    ctx.lineWidth = 1;
    ctx.beginPath();
    roundRect(ctx, labelX, labelY, labelWidth, labelHeight, 5);
    ctx.stroke();

    ctx.fillStyle = "#1f2937";
    ctx.font = "600 10px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(labelText, labelX + labelWidth / 2, labelY + labelHeight / 2);

    return labelWidth; // caller needs this to size the canvas
  }
  return 0;
}

/**
 * Compute the total canvas height needed for a given icon configuration,
 * and the y-position where the label box should start. Centralized here
 * so createUnifiedMarkerIcon, makeFlyoverIcon, and createGoogleMapsMarkerIcon
 * always agree on the same layout.
 */
function getIconLayout({ detailed, detailFields = [] }) {
  const labelStartY = TOP_PADDING + PIN_RADIUS + LABEL_GAP;
  const height = detailed
    ? labelStartY + 26 + detailFields.length * 14
    : labelStartY + 18 + 8;
  return { labelStartY, height };
}

/**
 * UNIFIED ICON GENERATOR - Creates canvas-based icon for BOTH Leaflet and Google Maps
 * This is the ONLY function you should use for creating icons
 */
export function createUnifiedMarkerIcon({
  color,
  labelText,
  detailed = false,
  name = "",
  detailFields = [],
}) {
  const pinRadius = 14;
  const pinDiameter = pinRadius * 2;
  const gap = 4;
  const labelHeight = detailed ? 20 + detailFields.length * 14 : 18;

  // Measure text first to size the canvas correctly
  const measureCanvas = document.createElement("canvas");
  const mctx = measureCanvas.getContext("2d");
  mctx.font = "800 10px Arial, sans-serif";
  const textWidth = labelText ? mctx.measureText(labelText).width : 0;
  const padding = 3;
  const labelWidth = labelText ? textWidth + padding * 4 + 4 : 0;

  const pinX = pinRadius + 4; // small left padding
  const pinY = Math.max(pinRadius + 4, labelHeight / 2 + 2); // center pin so label fits vertically

  const width = pinX + pinRadius + (labelText ? gap + labelWidth : 0) + 6;
  const height = Math.max(pinY + pinRadius + 6, labelHeight + 4);

  const canvas = document.createElement("canvas");
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext("2d");
  ctx.scale(2, 2);

  ctx.clearRect(0, 0, width, height);

  // Draw pin first (left side)
  drawPin(ctx, color, pinX, pinY);

  // Draw label to the right, vertically centered on the pin
  const labelX = pinX + pinRadius + gap;
  drawLabel(
    ctx,
    { color, labelText, detailed, name, detailFields },
    labelX,
    pinY,
    labelHeight,
  );

  return {
    dataUrl: canvas.toDataURL("image/png"),
    width,
    height,
    pinX,
    pinY,
    pinRadius,
  };
}

// ============================================================
// LEAFLET ICON - Uses the unified canvas generator
// ============================================================

export function makeFlyoverIcon({
  color,
  labelText,
  detailed,
  name,
  detailFields = [],
}) {
  const { dataUrl, width, height, pinX, pinY } = createUnifiedMarkerIcon({
    color,
    labelText,
    detailed,
    name,
    detailFields,
  });

  const img = document.createElement("img");
  img.src = dataUrl;
  img.style.width = width + "px";
  img.style.height = height + "px";
  img.style.display = "block";

  return L.divIcon({
    className: "flyover-marker-icon unified-marker",
    html: img.outerHTML,
    iconSize: [width, height],
    // anchor at the PIN (left side), not center of the whole icon —
    // this keeps the lat/lng point accurate under the pin, with label
    // floating to the right of it
    iconAnchor: [pinX, pinY],
    popupAnchor: [width / 2 - pinX, -(pinY + 10)],
  });
}

// ============================================================
// GOOGLE MAPS ICON - Uses the unified canvas generator
// ============================================================

export function createGoogleMapsMarkerIcon({
  color,
  labelText,
  detailed = false,
  name = "",
  detailFields = [],
}) {
  const { dataUrl, width, height, pinX, pinY } = createUnifiedMarkerIcon({
    color,
    labelText,
    detailed,
    name,
    detailFields,
  });

  return {
    url: dataUrl,
    scaledSize: new google.maps.Size(width, height),
    anchor: new google.maps.Point(pinX, pinY),
  };
}

// ============================================================
// LEGACY FUNCTIONS (kept for backward compatibility)
// ============================================================

/**
 * @deprecated Use createUnifiedMarkerIcon instead
 */
export function buildMarkerLabelHTML({
  color,
  labelText,
  detailed,
  name,
  detailFields = [],
}) {
  // Kept for backward compatibility but no longer used
  return "";
}

/**
 * @deprecated Use createUnifiedMarkerIcon instead
 */
export function buildMarkerHTML({
  color,
  labelText,
  detailed,
  name,
  detailFields = [],
}) {
  // Kept for backward compatibility but no longer used
  return "";
}

// ============================================================
// EXISTING FUNCTIONS (keep these as they are)
// ============================================================

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

export function FocusOnPoint({ latlng, triggerKey, zoom = 15 }) {
  const map = useMap();
  const prevTriggerRef = useRef(null);

  useEffect(() => {
    if (!latlng || triggerKey == null || triggerKey === prevTriggerRef.current)
      return;
    prevTriggerRef.current = triggerKey;
    map.flyTo(latlng, Math.max(map.getZoom(), zoom), { duration: 0.8 });
  }, [latlng, triggerKey, map, zoom]);

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

export function FitToVisibleFlyovers({ data }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !data || !data.features || data.features.length === 0) return;

    try {
      const layer = L.geoJSON(data);
      const bounds = layer.getBounds();

      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [60, 60],
          maxZoom: 15, // avoid over-zooming when only 1 point/segment is visible
          animate: true,
        });
      }
    } catch (e) {
      console.warn("FitToVisibleFlyovers: failed to fit bounds", e);
    }
  }, [data, map]);

  return null;
}