import React, { useRef, useState, useEffect, useMemo } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  TrafficLayer,
} from "@react-google-maps/api";
import { useFlyoverData } from "../hooks/useFlyoverData";
import {
  getFlyoverColor,
  getFlyoverDisplayName,
  createGoogleMapsMarkerIcon,
  formatPointName,
} from "../components/map/mapHelpers";

const containerStyle = {
  width: "100%",
  height: "100vh",
  position: "relative",
};

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
  const [currentZoom, setCurrentZoom] = useState(11);
  const [isMapLoading, setIsMapLoading] = useState(true);
  // ✅ ADD THIS LINE - declare isMobile state
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 640);

  // ✅ SINGLE info window instance - reused for all markers
  const infoWindowRef = useRef(null);

  const controlsRef = useRef(null);
  const originalParentRef = useRef(null);

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

        return features.map(feature => ({
          ...feature,
          properties: {
            ...feature.properties,
            riskStatus: flyover.riskStatus || 'low',
            displayName: displayName,
            flyoverId: flyover.id,
            type: type,
            namedPoints: flyover.namedPoints || [],
            layerIndex: index,
          }
        }));
      })
    };
  }, [flyovers]);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-maps-script",
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  // Hide loading when map is loaded
  useEffect(() => {
    if (isLoaded) {
      setTimeout(() => {
        setIsMapLoading(false);
      }, 500);
    }
  }, [isLoaded]);

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

  // Handle map load - store reference and setup listeners
  const handleMapLoad = (map) => {
    mapRef.current = map;

    map.addListener('zoom_changed', () => {
      const zoom = map.getZoom();
      setCurrentZoom(zoom);

      if (flyoverDataLoaded && storedGeojson) {
        labelMarkers.forEach((marker) => {
          marker.setMap(null);
        });
        setLabelMarkers([]);
        setTimeout(() => {
          addFlyoverLabels(map, storedGeojson);
        }, 100);
      }
    });

    console.log("Map loaded");
    setIsMapLoading(false);
  };

  // Add flyover GeoJSON to the map
  const addFlyoverLayer = (map, data) => {
    try {
      map.data.addGeoJson(data);

      map.data.setStyle((feature) => {
        const layerIndex = feature.getProperty('layerIndex');
        const color = getFlyoverColor(layerIndex || 0);

        return {
          fillColor: color,
          strokeColor: color,
          strokeWeight: 2,
          fillOpacity: 0.4,
          strokeOpacity: 0.8,
        };
      });

      setTimeout(() => {
        addFlyoverLabels(map, data);
      }, 200);

      setFlyoverDataLoaded(true);
      console.log("Flyover layer added successfully");
    } catch (error) {
      console.error("Error adding flyover layer:", error);
    }
  };

  // Add custom flyover labels with point-level popups
  const addFlyoverLabels = (map, data) => {
    try {
      const flyoverGroups = {};

      data.features.forEach((feature) => {
        const flyoverId = feature.properties?.flyoverId || 'unknown';
        if (!flyoverGroups[flyoverId]) {
          flyoverGroups[flyoverId] = {
            name: feature.properties?.displayName || `Flyover ${flyoverId}`,
            features: [],
            namedPoints: feature.properties?.namedPoints || [],
            detailFields: [],
            layerIndex: feature.properties?.layerIndex || 0,
          };
        }
        flyoverGroups[flyoverId].features.push(feature);

        const props = feature.properties || {};
        const detailFields = [];
        if (props.Chainage) detailFields.push({ label: "Chainage", value: props.Chainage });
        if (props.Length) detailFields.push({ label: "Length", value: props.Length });
        if (props.Descriptio) detailFields.push({ label: "Type", value: props.Descriptio });
        if (props.Detail) detailFields.push({ label: "Structure", value: props.Detail });
        if (detailFields.length > 0) {
          flyoverGroups[flyoverId].detailFields = detailFields;
        }
      });

      const newMarkers = [];
      const isDetailed = currentZoom >= 16;
      const flyoverIds = Object.keys(flyoverGroups).sort();

      flyoverIds.forEach((flyoverId, index) => {
        const group = flyoverGroups[flyoverId];
        const features = group.features;
        const displayName = group.name;
        const detailFields = group.detailFields;
        const namedPoints = group.namedPoints || [];
        const layerIndex = group.layerIndex || index;
        const color = getFlyoverColor(layerIndex);

        // Calculate center point
        let centerLat = 0, centerLng = 0;
        let allCoords = [];

        features.forEach((feature) => {
          const geometry = feature.geometry;
          const geomType = geometry?.type;

          let coords = [];
          if (geomType === 'Polygon') {
            coords = geometry.coordinates[0] || [];
          } else if (geomType === 'MultiPolygon') {
            geometry.coordinates.forEach(polygon => {
              if (polygon[0]) {
                coords = coords.concat(polygon[0]);
              }
            });
          } else if (geomType === 'LineString') {
            coords = geometry.coordinates || [];
          } else if (geomType === 'MultiLineString') {
            geometry.coordinates.forEach(line => {
              coords = coords.concat(line);
            });
          } else if (geomType === 'Point') {
            coords = [geometry.coordinates];
          }

          coords.forEach((coord) => {
            if (Array.isArray(coord) && coord.length >= 2) {
              const lng = coord[0];
              const lat = coord[1];
              if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
                allCoords.push({ lat, lng });
              }
            }
          });
        });

        if (allCoords.length > 0) {
          let latSum = 0, lngSum = 0;
          allCoords.forEach(({ lat, lng }) => {
            latSum += lat;
            lngSum += lng;
          });
          centerLat = latSum / allCoords.length;
          centerLng = lngSum / allCoords.length;
        }

        if (namedPoints.length > 0 && namedPoints[0].latlng) {
          centerLat = namedPoints[0].latlng[0];
          centerLng = namedPoints[0].latlng[1];
        }

        if (centerLat !== 0 && centerLng !== 0) {
          // Create marker for EACH named point (like SoilMap)
          namedPoints.forEach((point) => {
            const pointName = formatPointName(point.name);

            const markerIcon = createGoogleMapsMarkerIcon({
              color: color,
              labelText: pointName,
              detailed: isDetailed,
              name: pointName,
              detailFields: [
                { label: "Chainage", value: point.chainage || 'N/A' },
                { label: "Type", value: point.description || 'N/A' },
                { label: "Length", value: point.length || 'N/A' },
                { label: "Structure", value: point.detail || 'N/A' },
              ]
            });

            const marker = new google.maps.Marker({
              position: { lat: point.latlng[0], lng: point.latlng[1] },
              map: map,
              icon: markerIcon,
              optimized: false,
              zIndex: 1000,
              title: pointName,
            });

            // ✅ FIX: Use a SINGLE info window instance
            marker.addListener('click', () => {
              // Close any previously opened info window
              if (infoWindowRef.current) {
                infoWindowRef.current.close();
                infoWindowRef.current = null;
              }

              const riskStatus = features[0]?.properties?.riskStatus || 'low';
              const riskColor = RISK_COLORS[riskStatus]?.fill || '#6b7280';

              // Build popup content (matches SoilMap style)
              let popupContent = `
                                <div style="padding: 8px; font-family: Arial, sans-serif; max-width: 250px;">
                                    <h4 style="margin: 0 0 4px 0; color: ${color}; font-size: 13px; font-weight: 700;">${pointName}</h4>
                                    <p style="margin: 2px 0; font-size: 11px; display: flex; justify-content: space-between;">
                                        <span style="color: #6b7280;">Risk:</span>
                                        <span style="font-weight: 500; color: ${riskColor}; text-transform: capitalize;">${riskStatus}</span>
                                    </p>
                            `;

              // Add point details (like SoilMap)
              if (point.chainage) {
                popupContent += `
                                    <p style="margin: 2px 0; font-size: 11px; display: flex; justify-content: space-between;">
                                        <span style="color: #6b7280;">Chainage:</span>
                                        <span style="font-weight: 500; color: #1f2937;">${point.chainage}</span>
                                    </p>
                                `;
              }
              if (point.description) {
                popupContent += `
                                    <p style="margin: 2px 0; font-size: 11px; display: flex; justify-content: space-between;">
                                        <span style="color: #6b7280;">Type:</span>
                                        <span style="font-weight: 500; color: #1f2937;">${point.description}</span>
                                    </p>
                                `;
              }
              if (point.length) {
                popupContent += `
                                    <p style="margin: 2px 0; font-size: 11px; display: flex; justify-content: space-between;">
                                        <span style="color: #6b7280;">Length:</span>
                                        <span style="font-weight: 500; color: #1f2937;">${point.length}</span>
                                    </p>
                                `;
              }
              if (point.detail) {
                popupContent += `
                                    <p style="margin: 2px 0; font-size: 11px; display: flex; justify-content: space-between;">
                                        <span style="color: #6b7280;">Structure:</span>
                                        <span style="font-weight: 500; color: #1f2937;">${point.detail}</span>
                                    </p>
                                `;
              }

              popupContent += `</div>`;

              // ✅ Create a new info window (only one at a time)
              const infoWindow = new google.maps.InfoWindow({
                content: popupContent,
                maxWidth: 300,
              });

              // Open the info window
              infoWindow.open(map, marker);

              // ✅ Store reference to the current info window
              infoWindowRef.current = infoWindow;

              // ✅ Clear reference when closed
              infoWindow.addListener('closeclick', () => {
                infoWindowRef.current = null;
              });
            });

            newMarkers.push(marker);
          });
        }
      });

      setLabelMarkers(newMarkers);
      console.log(`Added ${newMarkers.length} flyover markers with point-level popups`);
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

      // ✅ Close any open info window when toggling off
      if (infoWindowRef.current) {
        infoWindowRef.current.close();
        infoWindowRef.current = null;
      }

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
              boxShadow: showTraffic ? "0 0 12px rgba(34,197,94,0.3)" : "none",

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
            textAlign: "center",
            marginTop: "80px",
            color: "#666",
          }}
        >
          Error loading Google Maps: {loadError.message}
        </div>
      </div>
    );
  }

  if (!isLoaded || loading || isMapLoading) {
    return (
      <div style={{ position: "relative", width: "100%", height: "100vh", background: "#f5f5f5" }}>
        {controls}
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
          zIndex: 1000,
        }}>
          <div style={{
            display: "inline-block",
            width: "40px",
            height: "40px",
            border: "4px solid #e5e7eb",
            borderTop: "4px solid #3b82f6",
            borderRadius: "50%",
            animation: "spin 1s linear infinite"
          }} />
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
      <div style={{ position: "relative", width: "100%", height: "100vh" }}>
        {controls}
        <div style={{
          padding: "20px",
          color: "red",
          marginTop: "80px",
          marginLeft: "20px",
          textAlign: "center"
        }}>
          <p style={{ color: "#ef4444", fontSize: "18px", fontWeight: "600" }}>Error loading flyover data</p>
          <p style={{ color: "#6b7280", marginTop: "8px" }}>{error}</p>
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
      <div ref={controlsRef}>
        {controls}
      </div>
      <div style={{ width: "100%", height: "100%" }}>
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
            fullscreenControlOptions: {
              position: window.google?.maps?.ControlPosition?.TOP_RIGHT,
            },
          }}
        >
          {showTraffic && <TrafficLayer />}
        </GoogleMap>
      </div>
    </div>
  );
}









