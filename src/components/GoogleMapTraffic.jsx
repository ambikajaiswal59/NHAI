import React, { useRef, useState, useEffect, useMemo } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  TrafficLayer,
} from "@react-google-maps/api";
import { useFlyoverData } from "../hooks/useFlyoverData";

const center = {
  lat: 30.30031525674896,
  lng: 76.75438508247828,
};

const GOOGLE_MAPS_API_KEY = "AIzaSyCa3Mm5ZcgYiwrlo5fcicXQL0gwEzymlq8";

// Risk color mapping
const RISK_COLORS = {
  low: { fill: "#22c55e", stroke: "#16a34a" },
  moderate: { fill: "#f97316", stroke: "#ea580c" },
  high: { fill: "#ef4444", stroke: "#dc2626" },
};

// Same function from mapHelpers.jsx
function getFlyoverDisplayName(type, indexFallback = 0) {
  const match = (type || "").toString().match(/\d+/);
  const num = match ? match[0] : indexFallback + 1;
  return `Flyover ${num}`;
}

export default function GoogleMapComponent() {
  const { flyovers, loading, error } = useFlyoverData();

  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const [mapType, setMapType] = useState("roadmap");
  const [showTraffic, setShowTraffic] = useState(true);
  const [showFlyovers, setShowFlyovers] = useState(false);
  const [flyoverDataLoaded, setFlyoverDataLoaded] = useState(false);
  const [storedGeojson, setStoredGeojson] = useState(null);
  const [labelMarkers, setLabelMarkers] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 640 : false,
  );

  // Prepare GeoJSON data from flyovers
  const combinedGeoJSON = useMemo(() => {
    if (!flyovers || flyovers.length === 0) return null;

    return {
      type: "FeatureCollection",
      features: flyovers.flatMap((flyover, index) => {
        const features = flyover.geojson?.features || [];

        let type = flyover.type;
        if (!type && features.length > 0) {
          type = features[0]?.properties?.Type;
        }

        const displayName = getFlyoverDisplayName(type, index);

        return features.map((feature) => ({
          ...feature,
          properties: {
            ...feature.properties,
            riskStatus: flyover.riskStatus || "low",
            displayName: displayName,
            flyoverId: flyover.id,
            type: type,
          },
        }));
      }),
    };
  }, [flyovers]);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-maps-script",
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  // FIX: restored — was missing, so isFullscreen never updated,
  // which is why the toggle appeared to work once then get stuck.
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener(
        "fullscreenchange",
        handleFullscreenChange,
      );
  }, []);

  // Track mobile breakpoint
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Store geojson data when it arrives
  useEffect(() => {
    if (
      combinedGeoJSON &&
      combinedGeoJSON.features &&
      combinedGeoJSON.features.length > 0
    ) {
      setStoredGeojson(combinedGeoJSON);
    }
  }, [combinedGeoJSON]);

  // Handle map load - just store reference
  const handleMapLoad = (map) => {
    mapRef.current = map;
    console.log("Map loaded");
  };

  // Add flyover GeoJSON to the map
  const addFlyoverLayer = (map, data) => {
    try {
      map.data.addGeoJson(data);

      map.data.setStyle((feature) => {
        const risk = feature.getProperty("riskStatus") || "low";
        const colors = RISK_COLORS[risk] || RISK_COLORS.low;

        return {
          fillColor: colors.fill,
          strokeColor: colors.stroke,
          strokeWeight: 2,
          fillOpacity: 0.4,
          strokeOpacity: 0.8,
        };
      });

      addFlyoverLabels(map, data);

      setFlyoverDataLoaded(true);
      console.log("Flyover layer added successfully");
    } catch (error) {
      console.error("Error adding flyover layer:", error);
    }
  };

  const addFlyoverLabels = (map, data) => {
    try {
      const flyoverGroups = {};

      data.features.forEach((feature) => {
        const flyoverId = feature.properties?.flyoverId || "unknown";
        if (!flyoverGroups[flyoverId]) {
          flyoverGroups[flyoverId] = {
            name: feature.properties?.displayName || `Flyover ${flyoverId}`,
            features: [],
          };
        }
        flyoverGroups[flyoverId].features.push(feature);
      });

      const newMarkers = [];

      Object.keys(flyoverGroups).forEach((flyoverId) => {
        const group = flyoverGroups[flyoverId];
        const features = group.features;
        const displayName = group.name;

        let latSum = 0,
          lngSum = 0,
          count = 0;

        features.forEach((feature) => {
          const geometry = feature.geometry;
          const geomType = geometry?.type;

          let coords = [];
          if (geomType === "Polygon") {
            coords = geometry.coordinates[0];
          } else if (geomType === "MultiPolygon") {
            geometry.coordinates.forEach((polygon) => {
              coords = coords.concat(polygon[0]);
            });
          } else if (geomType === "LineString") {
            coords = geometry.coordinates;
          } else if (geomType === "MultiLineString") {
            geometry.coordinates.forEach((line) => {
              coords = coords.concat(line);
            });
          }

          coords.forEach((coord) => {
            const lng = coord[0];
            const lat = coord[1];
            if (typeof lat === "number" && typeof lng === "number") {
              latSum += lat;
              lngSum += lng;
              count++;
            }
          });
        });

        if (count > 0) {
          const centerLat = latSum / count;
          const centerLng = lngSum / count;

          const marker = new google.maps.Marker({
            position: { lat: centerLat, lng: centerLng },
            map: map,
            label: {
              text: displayName,
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: "bold",
              fontFamily: "Arial, sans-serif",
              strokeColor: "#000000",
              strokeWeight: 3,
            },
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: "transparent",
              fillOpacity: 0,
              strokeWeight: 0,
              scale: 0,
            },
            optimized: false,
            zIndex: 1000,
          });
          newMarkers.push(marker);
        }
      });

      setLabelMarkers(newMarkers);
      console.log(`Added ${newMarkers.length} labels`);
    } catch (error) {
      console.error("Error adding labels:", error);
    }
  };

  useEffect(() => {
    if (showFlyovers && mapRef.current && storedGeojson && !flyoverDataLoaded) {
      addFlyoverLayer(mapRef.current, storedGeojson);
    }

    if (!showFlyovers && mapRef.current && flyoverDataLoaded) {
      mapRef.current.data.forEach((feature) => {
        mapRef.current.data.remove(feature);
      });

      labelMarkers.forEach((marker) => {
        marker.setMap(null);
      });
      setLabelMarkers([]);

      setFlyoverDataLoaded(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFlyovers, storedGeojson, flyoverDataLoaded]);

  // ===== CONTROLS WITH STYLISH TOGGLES =====
  const controls = (
    <div
      style={{
        position: "absolute",
        zIndex: 1000,
        top: isMobile ? "8px" : "20px",
        left: isMobile ? "8px" : "20px",
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(10px)",
        padding: isMobile ? "8px 10px" : "16px 20px",
        borderRadius: isMobile ? "8px" : "12px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
        minWidth: isMobile ? "120px" : "180px",
        width: isMobile ? "130px" : "auto",
        maxWidth: isMobile ? "130px" : "none",
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: isMobile ? "11px" : "14px",
        pointerEvents: "auto",
        border: "1px solid rgba(255,255,255,0.2)",
        boxSizing: "border-box",
      }}
    >
      <label
        style={{
          fontWeight: "600",
          fontSize: isMobile ? "9px" : "12px",
          color: "#6b7280",
          display: "block",
          marginBottom: isMobile ? "5px" : "8px",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        Map Type
      </label>

      <select
        value={mapType}
        onChange={(e) => {
          setMapType(e.target.value);
          if (mapRef.current) {
            mapRef.current.setMapTypeId(e.target.value);
          }
        }}
        style={{
          padding: isMobile ? "5px 6px" : "8px 12px",
          borderRadius: isMobile ? "5px" : "8px",
          border: "1px solid #e5e7eb",
          width: "100%",
          cursor: "pointer",
          fontSize: isMobile ? "10px" : "13px",
          background: "#f9fafb",
          color: "#1f2937",
          fontWeight: "500",
          outline: "none",
          transition: "all 0.2s ease",
        }}
      >
        <option value="roadmap">Road Map</option>
        <option value="satellite">Satellite</option>
        <option value="hybrid">Hybrid</option>
        <option value="terrain">Terrain</option>
      </select>

      <div
        style={{
          marginTop: isMobile ? "8px" : "14px",
          borderTop: "1px solid #f3f4f6",
          paddingTop: isMobile ? "7px" : "14px",
          display: "flex",
          flexDirection: "column",
          gap: isMobile ? "5px" : "10px",
        }}
      >
        {/* Traffic */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            fontSize: isMobile ? "10px" : "13px",
            fontWeight: "500",
            color: "#374151",
            padding: isMobile ? "2px 0" : "4px 0",
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: isMobile ? "5px" : "8px",
            }}
          >
            <span
              style={{
                width: isMobile ? "6px" : "8px",
                height: isMobile ? "6px" : "8px",
                borderRadius: "50%",
                background: showTraffic ? "#22c55e" : "#9ca3af",
              }}
            />
            Traffic
          </span>

          <div
            onClick={() => setShowTraffic(!showTraffic)}
            style={{
              width: isMobile ? "32px" : "44px",
              height: isMobile ? "18px" : "24px",
              borderRadius: isMobile ? "9px" : "12px",
              background: showTraffic ? "#22c55e" : "#d1d5db",
              cursor: "pointer",
              position: "relative",
              transition: "all 0.3s ease",
            }}
          >
            <div
              style={{
                width: isMobile ? "14px" : "18px",
                height: isMobile ? "14px" : "18px",
                borderRadius: "50%",
                background: "white",
                position: "absolute",
                top: isMobile ? "2px" : "3px",
                left: showTraffic
                  ? isMobile
                    ? "16px"
                    : "23px"
                  : isMobile
                    ? "2px"
                    : "3px",
                transition: "all 0.3s ease",
                boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
              }}
            />
          </div>
        </label>

        {/* Flyovers */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            fontSize: isMobile ? "10px" : "13px",
            fontWeight: "500",
            color: "#374151",
            padding: isMobile ? "2px 0" : "4px 0",
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: isMobile ? "5px" : "8px",
            }}
          >
            <span
              style={{
                width: isMobile ? "6px" : "8px",
                height: isMobile ? "6px" : "8px",
                borderRadius: "50%",
                background: showFlyovers ? "#3b82f6" : "#9ca3af",
              }}
            />
            Flyovers
          </span>

          <div
            onClick={() => setShowFlyovers(!showFlyovers)}
            style={{
              width: isMobile ? "32px" : "44px",
              height: isMobile ? "18px" : "24px",
              borderRadius: isMobile ? "9px" : "12px",
              background: showFlyovers ? "#3b82f6" : "#d1d5db",
              cursor: "pointer",
              position: "relative",
              transition: "all 0.3s ease",
            }}
          >
            <div
              style={{
                width: isMobile ? "14px" : "18px",
                height: isMobile ? "14px" : "18px",
                borderRadius: "50%",
                background: "white",
                position: "absolute",
                top: isMobile ? "2px" : "3px",
                left: showFlyovers
                  ? isMobile
                    ? "16px"
                    : "23px"
                  : isMobile
                    ? "2px"
                    : "3px",
                transition: "all 0.3s ease",
                boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
              }}
            />
          </div>
        </label>
      </div>
    </div>
  );

  // ===== LOADING / ERROR STATES =====
  if (loadError) {
    return (
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        {controls}
        <div
          style={{
            padding: "20px",
            color: "red",
            marginTop: "80px",
            marginLeft: "20px",
            textAlign: "center",
          }}
        >
          Error loading Google Maps: {loadError.message}
        </div>
      </div>
    );
  }

  if (!isLoaded || loading) {
    return (
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        {controls}
        <div
          style={{
            padding: "20px",
            textAlign: "center",
            marginTop: "80px",
            color: "#666",
          }}
        >
          <div
            style={{
              display: "inline-block",
              width: "30px",
              height: "30px",
              border: "3px solid #f3f3f3",
              borderTop: "3px solid #3498db",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />
          <style>{`
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    `}</style>
          <p style={{ marginTop: "10px" }}>
            {loading ? "Loading flyover data..." : "Loading Google Maps..."}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        {controls}
        <div
          style={{
            padding: "20px",
            color: "red",
            marginTop: "80px",
            marginLeft: "20px",
            textAlign: "center",
          }}
        >
          <p className="text-red-500 text-lg">Error loading flyover data</p>
          <p className="text-gray-500 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  // ===== MAP + CONTROLS =====
  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        ...(isFullscreen
          ? {
              width: "100vw",
              height: "100vh",
            }
          : {}),
      }}
    >
      <div>{controls}</div>
      <div className="google-map-container w-full h-full">
        <GoogleMap
          mapContainerStyle={{
            width: "100%",
            height: "100%",
          }}
          center={center}
          zoom={11}
          mapTypeId={mapType}
          onLoad={handleMapLoad}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            // FIX: disabled — was fighting the parent's fullscreen toggle
            fullscreenControl: false,
            
            zoomControl: true,
            gestureHandling: "greedy",
          }}
        >
          {showTraffic && <TrafficLayer />}
        </GoogleMap>
      </div>
    </div>
  );
}