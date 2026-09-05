// src/components/GoogleMapComponent.jsx
import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { GoogleMap, useJsApiLoader, TrafficLayer } from "@react-google-maps/api";
import { useFlyoverData } from "../hooks/useFlyoverData";
import {
  getFlyoverColor,
  getFlyoverDisplayName,
  createGoogleMapsMarkerIcon,
  formatPointName,
} from "../components/map/mapHelpers";
import TrafficAnalysisPanel from "./TrafficAnalysisPanel";
import { Layers, X, Maximize, Minimize } from "lucide-react";

const center = {
  lat: 30.30031525674896,
  lng: 76.75438508247828,
};

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Zoom limits
const MIN_ZOOM = 10;
const MAX_ZOOM = 17;
const DEFAULT_ZOOM = 11;

// Risk color mapping
const RISK_COLORS = {
  low: { fill: "#22c55e", stroke: "#16a34a" },
  moderate: { fill: "#f97316", stroke: "#ea580c" },
  high: { fill: "#ef4444", stroke: "#dc2626" },
};

function FullscreenButton({ isFullscreen, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center justify-center w-[30px] h-[30px] bg-white rounded-md shadow-md border border-gray-200 transition-all duration-200 hover:bg-gray-50 hover:shadow-lg ${isFullscreen ? 'bg-blue-50 border-blue-300 text-blue-600' : 'text-gray-700'}`}
      style={{ boxShadow: '0 1px 5px rgba(0,0,0,0.1)' }}
      aria-label="Toggle fullscreen"
      title="Fullscreen"
    >
      {isFullscreen ? <Minimize size={18} className="text-gray-700" /> : <Maximize size={18} className="text-gray-700" />}
    </button>
  );
}

// Loading component
function LoadingOverlay({ message }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-white/90 backdrop-blur-sm z-[1000]">
      <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-xl shadow-xl border border-gray-200">
        <div className="w-8 h-8 border-3 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-sm font-semibold text-gray-800">{message || "Loading..."}</p>
      </div>
    </div>
  );
}

export default function GoogleMapComponent() {
  const { flyovers, loading, error } = useFlyoverData();

  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const fullscreenContainerRef = useRef(null);
  const [mapType, setMapType] = useState("roadmap");
  const [showTrafficLayer, setShowTrafficLayer] = useState(true);
  const [flyoverDataLoaded, setFlyoverDataLoaded] = useState(false);
  const [storedGeojson, setStoredGeojson] = useState(null);
  const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 640);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Layer Control States
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);
  const [activeLayers, setActiveLayers] = useState(['flyover', 'traffic']);
  const [baseLayer, setBaseLayer] = useState('roadmap');

  // Refs for flyover layers
  const markersRef = useRef([]);
  const markerDataMapRef = useRef(new Map());
  const flyoverLayerIdsRef = useRef([]);
  const openInfoWindowsRef = useRef([]);

  // Zoom threshold for showing popups
  const POPUP_ZOOM_THRESHOLD = 16;

  // State for traffic panel
  const [selectedFlyoverForTraffic, setSelectedFlyoverForTraffic] = useState(null);
  const [showTrafficPanel, setShowTrafficPanel] = useState(false);

  // Define available layers
  const availableLayers = [
    {
      id: 'flyover',
      name: 'Flyover',
      color: '#3B82F6',
      type: 'overlay'
    },
    {
      id: 'traffic',
      name: 'Traffic',
      color: '#EF4444',
      type: 'overlay'
    },
  ];

  // Sync traffic layer with activeLayers on mount
  useEffect(() => {
    if (activeLayers.includes('traffic')) {
      setShowTrafficLayer(true);
    } else {
      setShowTrafficLayer(false);
    }
  }, []);

  // Close traffic panel
  const closeTrafficPanel = () => {
    setShowTrafficPanel(false);
    setSelectedFlyoverForTraffic(null);
  };

  // Close all info windows
  const closeAllInfoWindows = () => {
    openInfoWindowsRef.current.forEach((iw) => iw.close());
    openInfoWindowsRef.current = [];
  };

  // Handle layer toggling
  const handleLayerToggle = useCallback((layerId) => {
    setActiveLayers(prev => {
      if (prev.includes(layerId)) {
        return prev.filter(id => id !== layerId);
      } else {
        return [...prev, layerId];
      }
    });

    // Handle traffic layer separately
    if (layerId === 'traffic') {
      setShowTrafficLayer(prev => !prev);
    }

    // Reset flyoverDataLoaded when toggling flyover layer on
    if (layerId === 'flyover') {
      const isCurrentlyActive = activeLayers.includes('flyover');
      if (!isCurrentlyActive) {
        setFlyoverDataLoaded(false);
      }
    }
  }, [activeLayers]);

  // Handle base layer change
  const handleBaseLayerChange = useCallback((layerType) => {
    setBaseLayer(layerType);
    if (!mapRef.current) return;

    try {
      mapRef.current.setMapTypeId(layerType);
    } catch (err) {
      console.error("[GoogleMap] Error switching base layer:", err);
    }
  }, []);

  // Update layer visibility
  const updateLayerVisibility = useCallback(() => {
    if (!mapRef.current) return;

    // Handle flyover markers visibility
    if (activeLayers.includes('flyover')) {
      markersRef.current.forEach(marker => {
        marker.setMap(mapRef.current);
      });
    } else {
      markersRef.current.forEach(marker => {
        marker.setMap(null);
      });
    }
  }, [activeLayers]);

  // Prepare GeoJSON data from flyovers - only once when flyovers change
  const { combinedGeoJSON, flyoverLookup } = useMemo(() => {
    if (!flyovers || flyovers.length === 0) return { combinedGeoJSON: null, flyoverLookup: {} };

    const lookup = {};
    const features = [];

    flyovers.forEach((flyover, index) => {
      const flyoverFeatures = flyover.geojson?.features || [];
      let type = flyover.type;
      if (!type && flyoverFeatures.length > 0) {
        type = flyoverFeatures[0]?.properties?.Type;
      }
      const displayName = getFlyoverDisplayName(type, index);

      lookup[flyover.id] = {
        id: flyover.id,
        namedPoints: flyover.namedPoints || [],
        riskStatus: flyover.riskStatus || 'low',
        displayName: displayName,
        color: getFlyoverColor(index),
        layerIndex: index,
        features: flyoverFeatures
      };

      flyoverFeatures.forEach(feature => {
        features.push({
          ...feature,
          properties: {
            ...feature.properties,
            riskStatus: flyover.riskStatus || 'low',
            displayName: displayName,
            flyoverId: flyover.id,
            type: type,
            layerIndex: index,
          }
        });
      });
    });

    return {
      combinedGeoJSON: {
        type: "FeatureCollection",
        features: features
      },
      flyoverLookup: lookup
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

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
      setTimeout(() => {
        if (mapRef.current) {
          google.maps.event.trigger(mapRef.current, 'resize');
        }
      }, 200);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Track mobile breakpoint
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Store geojson data when it arrives - only once
  useEffect(() => {
    if (combinedGeoJSON && combinedGeoJSON.features && combinedGeoJSON.features.length > 0) {
      setStoredGeojson(combinedGeoJSON);
    }
  }, [combinedGeoJSON]);

  // Update visibility when activeLayers change
  useEffect(() => {
    updateLayerVisibility();
  }, [activeLayers, updateLayerVisibility]);

  // Handle map load
  const handleMapLoad = (map) => {
    mapRef.current = map;
    setIsMapReady(true);

    map.addListener('zoom_changed', () => {
      const zoom = map.getZoom();
      setCurrentZoom(zoom);

      if (markersRef.current.length > 0) {
        handleZoomPopups(zoom);
      }
    });

    setIsMapLoading(false);
  };

  // Handle showing/hiding popups based on zoom
  const handleZoomPopups = (zoom) => {
    closeAllInfoWindows();

    if (zoom >= POPUP_ZOOM_THRESHOLD) {
      const currentCenter = mapRef.current?.getCenter();

      let popupCount = 0;
      markerDataMapRef.current.forEach((data, marker) => {
        const { point, pointName, color, riskStatus } = data;

        const infoWindow = new google.maps.InfoWindow({
          content: buildPopupContent(point, pointName, color, riskStatus),
          maxWidth: 300,
          disableAutoPan: true,
          pixelOffset: new google.maps.Size(0, -8), // negative y = moves popup up, away from marker
        });

        infoWindow.open(mapRef.current, marker);
        openInfoWindowsRef.current.push(infoWindow);
        popupCount++;

        infoWindow.addListener('closeclick', () => {
          openInfoWindowsRef.current = openInfoWindowsRef.current.filter(
            (iw) => iw !== infoWindow
          );
        });
      });

      if (currentCenter && mapRef.current) {
        const newCenter = mapRef.current.getCenter();
        if (newCenter && (newCenter.lat() !== currentCenter.lat() || newCenter.lng() !== currentCenter.lng())) {
          mapRef.current.setCenter(currentCenter);
        }
      }
    }
  };

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    try {
      const container = fullscreenContainerRef.current;
      if (!document.fullscreenElement) {
        if (container?.requestFullscreen) {
          container.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      }
    } catch (err) {
      console.error("[GoogleMap] Error toggling fullscreen:", err);
    }
  }, []);

  // Clear all markers from map
  const clearMarkers = () => {
    markersRef.current.forEach(marker => {
      marker.setMap(null);
    });
    markersRef.current = [];
    markerDataMapRef.current = new Map();
    flyoverLayerIdsRef.current = [];
    closeAllInfoWindows();
  };

  // Add flyover GeoJSON to the map
  const addFlyoverLayer = (map, data) => {
    try {
      // Clear existing data first
      if (map.data) {
        map.data.forEach((feature) => {
          map.data.remove(feature);
        });
      }

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

      // Store layer IDs for reference
      flyoverLayerIdsRef.current = [];
      map.data.forEach((feature) => {
        flyoverLayerIdsRef.current.push(feature.getId());
      });

      // Add markers after layer is added
      setTimeout(() => {
        addFlyoverLabels(map, data, currentZoom);
      }, 200);
    } catch (error) {
      console.error("Error adding flyover layer:", error);
    }
  };

  // Build popup content
  const buildPopupContent = (point, pointName, color, riskStatus) => {
    const riskColor = RISK_COLORS[riskStatus]?.fill || '#6b7280';

    let popupContent = `
      <div style="padding: 8px; font-family: Arial, sans-serif; max-width: 250px;">
          <h4 style="margin: 0 0 4px 0; color: ${color}; font-size: 13px; font-weight: 700;">${pointName}</h4>
          <p style="margin: 2px 0; font-size: 11px; display: flex; justify-content: space-between;">
              <span style="color: #6b7280;">Risk:</span>
              <span style="font-weight: 500; color: ${riskColor}; text-transform: capitalize;">${riskStatus}</span>
          </p>
    `;

    if (point.chainage) {
      popupContent += `
        <p style="margin: 2px 0; font-size: 11px; display: flex; justify-content: space-between;">
            <span style="color: #6b7280;">Chainage:</span>
            <span style="font-weight: 500; color: #1f2937;">${point.chainage}</span>
        </p>`;
    }
    if (point.description) {
      popupContent += `
        <p style="margin: 2px 0; font-size: 11px; display: flex; justify-content: space-between;">
            <span style="color: #6b7280;">Type:</span>
            <span style="font-weight: 500; color: #1f2937;">${point.description}</span>
        </p>`;
    }
    if (point.length) {
      popupContent += `
        <p style="margin: 2px 0; font-size: 11px; display: flex; justify-content: space-between;">
            <span style="color: #6b7280;">Length:</span>
            <span style="font-weight: 500; color: #1f2937;">${point.length}</span>
        </p>`;
    }
    if (point.detail) {
      popupContent += `
        <p style="margin: 2px 0; font-size: 11px; display: flex; justify-content: space-between;">
            <span style="color: #6b7280;">Structure:</span>
            <span style="font-weight: 500; color: #1f2937;">${point.detail}</span>
        </p>`;
    }

    popupContent += `</div>`;
    return popupContent;
  };

  // Add custom flyover labels with point-level popups
  const addFlyoverLabels = (map, data, zoom) => {
    try {
      const lookup = flyoverLookup;

      const flyoverIds = new Set();
      data.features.forEach((feature) => {
        const id = feature.properties?.flyoverId;
        if (id) flyoverIds.add(id);
      });

      const isDetailed = zoom >= POPUP_ZOOM_THRESHOLD;

      flyoverIds.forEach((flyoverId) => {
        const flyoverData = lookup[flyoverId];
        if (!flyoverData) return;

        const { namedPoints, color, riskStatus } = flyoverData;
        if (!namedPoints || namedPoints.length === 0) return;

        namedPoints.forEach((point, idx) => {
          const pointName = formatPointName(point.name);

          const markerIcon = createGoogleMapsMarkerIcon({
            color: color,
            labelText: pointName,
            detailed: false,
            name: pointName,
          });

          const marker = new google.maps.Marker({
            position: { lat: point.latlng[0], lng: point.latlng[1] },
            map: map,
            icon: markerIcon,
            optimized: false,
            zIndex: 1000,
            title: pointName,
          });

          // Store marker data for popup generation on zoom
          markerDataMapRef.current.set(marker, {
            point: point,
            pointName: pointName,
            color: color,
            riskStatus: riskStatus,
          });

          // Click handler for traffic panel
          marker.addListener('click', () => {
            const flyoverName = `FLYOVER ${flyoverId}`;
            const position = marker.getPosition();
            const lat = position.lat();
            const lng = position.lng();

            setSelectedFlyoverForTraffic(flyoverName);
            setShowTrafficPanel(true);

            if (mapRef.current) {
              mapRef.current.panTo({ lat, lng });
              setTimeout(() => {
                mapRef.current.setZoom(14);
              }, 600);
            }
          });

          markersRef.current.push(marker);
        });
      });

      setFlyoverDataLoaded(true);
      setIsInitialLoad(false);

      // Apply visibility based on active layers
      updateLayerVisibility();

      // Show popups if zoom is already at threshold
      if (zoom >= POPUP_ZOOM_THRESHOLD) {
        setTimeout(() => {
          handleZoomPopups(zoom);
        }, 300);
      }
    } catch (error) {
      console.error("Error adding labels:", error);
      setIsInitialLoad(false);
    }
  };

  // SIMPLE FIX: Load flyovers after a small delay when map is ready
  useEffect(() => {
    if (isMapReady && storedGeojson && !flyoverDataLoaded && activeLayers.includes('flyover') && isInitialLoad) {
      console.log("Loading flyover layer...");
      // Small delay to ensure map tiles are loading
      const timer = setTimeout(() => {
        clearMarkers();
        addFlyoverLayer(mapRef.current, storedGeojson);
      }, 500); // 500ms delay gives map time to render base tiles

      return () => clearTimeout(timer);
    }
  }, [isMapReady, storedGeojson, flyoverDataLoaded, activeLayers, isInitialLoad]);

  // Remove flyover layer when toggled off
  useEffect(() => {
    if (!mapRef.current) return;

    if (!activeLayers.includes('flyover') && flyoverDataLoaded) {
      if (mapRef.current.data) {
        mapRef.current.data.forEach((feature) => {
          mapRef.current.data.remove(feature);
        });
      }
      markersRef.current.forEach(marker => {
        marker.setMap(null);
      });
      flyoverLayerIdsRef.current = [];
      setFlyoverDataLoaded(false);
      setIsInitialLoad(true);
    }
  }, [activeLayers, flyoverDataLoaded]);

  // ===== LOADING / ERROR STATES =====
  if (loadError) {
    return (
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <div style={{ padding: "20px", textAlign: "center", marginTop: "80px", color: "#666" }}>
          Error loading Google Maps: {loadError.message}
        </div>
      </div>
    );
  }

  if (!isLoaded || loading || isMapLoading) {
    return (
      <div style={{ position: "relative", width: "100%", height: "100vh", background: "#f5f5f5" }}>
        <LoadingOverlay message="Loading Google Maps..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ position: "relative", width: "100%", height: "100vh" }}>
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
        minHeight: isMobile ? (showTrafficPanel ? "calc(100vh - 100px)" : "100%") : "100%",
        height: isMobile ? (showTrafficPanel ? "auto" : "100%") : "100%",
        overflow: isMobile ? "visible" : "hidden",
        ...(isFullscreen ? { width: "100vw", height: "100vh" } : {}),
      }}
    >
      <div
        ref={fullscreenContainerRef}
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          width: "100%",
          height: "100%",
          gap: isMobile ? "8px" : "12px",
          padding: isMobile ? "8px" : "12px",
          boxSizing: "border-box",
          overflow: "hidden",
          background: '#ffffff',
        }}
      >
        {/* Map Container */}
        <div style={{
          flexGrow: showTrafficPanel ? (isMobile ? 0 : 1) : 1,
          flexShrink: isMobile ? 0 : 1,
          flexBasis: isMobile ? "auto" : "0%",
          height: isMobile ? (showTrafficPanel ? "350px" : "100%") : "100%",
          minHeight: isMobile ? (showTrafficPanel ? "300px" : "100%") : "auto",
          width: isMobile ? "100%" : "auto",
          minWidth: showTrafficPanel ? (isMobile ? "100%" : "60%") : "100%",
          transition: "all 0.3s ease",
          position: "relative",
          borderRadius: "12px",
          overflow: "hidden",
        }}>
          <GoogleMap
            mapContainerStyle={{
              width: "100%",
              height: "100%",
              borderRadius: "12px",
              overflow: "hidden",
            }}
            center={center}
            zoom={DEFAULT_ZOOM}
            mapTypeId={mapType}
            onLoad={handleMapLoad}
            options={{
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: false,
              zoomControl: false,
              gestureHandling: "greedy",
              minZoom: MIN_ZOOM,
              maxZoom: MAX_ZOOM,
              disableDefaultUI: true,
            }}
          >
            {showTrafficLayer && <TrafficLayer />}
          </GoogleMap>

          {/* Custom Zoom Controls - Top Left */}
          <div
            className="absolute z-[500]"
            style={{
              top: isMobile ? '70px' : '20px',
              left: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '1px',
            }}
          >
            <button
              onClick={() => {
                if (mapRef.current) {
                  const currentZoom = mapRef.current.getZoom();
                  if (currentZoom < MAX_ZOOM) {
                    mapRef.current.setZoom(currentZoom + 1);
                  }
                }
              }}
              className="flex items-center justify-center w-[34px] h-[34px] bg-white rounded-t-[4px] border-2 border-gray-400 hover:border-gray-500 transition-all duration-200 hover:bg-gray-50 focus:outline-none focus:ring-0 leaflet-bar"
              style={{ boxShadow: '0 1px 5px rgba(0,0,0,0.1)', borderBottom: '1px solid #ccc' }}
              aria-label="Zoom in"
              title="Zoom in"
            >
              <span style={{ fontSize: '22px', fontWeight: 'bold', lineHeight: '34px', color: '#333' }}>+</span>
            </button>

            <button
              onClick={() => {
                if (mapRef.current) {
                  const currentZoom = mapRef.current.getZoom();
                  if (currentZoom > MIN_ZOOM) {
                    mapRef.current.setZoom(currentZoom - 1);
                  }
                }
              }}
              className="flex items-center justify-center w-[34px] h-[34px] bg-white rounded-b-[4px] border-2 border-gray-400 hover:border-gray-500 transition-all duration-200 hover:bg-gray-50 focus:outline-none focus:ring-0 leaflet-bar"
              style={{ boxShadow: '0 1px 5px rgba(0,0,0,0.1)', borderTop: 'none' }}
              aria-label="Zoom out"
              title="Zoom out"
            >
              <span style={{ fontSize: '22px', fontWeight: 'bold', lineHeight: '34px', color: '#333' }}>−</span>
            </button>
          </div>

          {/* Fullscreen Button - Top Right */}
          <div className="absolute top-3 right-3 z-[500]">
            <FullscreenButton isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
          </div>

          {/* Layer Control */}
          <div
            className="absolute z-[500]"
            style={{
              top: isMobile ? '170px' : '120px',
              left: '12px',
            }}
          >
            <button
              onClick={() => setIsLayerPanelOpen(!isLayerPanelOpen)}
              className={`
                flex items-center justify-center w-[34px] h-[34px] 
                bg-white rounded-[4px] border-2
                transition-all duration-200 hover:bg-gray-50
                ${isLayerPanelOpen
                  ? 'border-blue-500 bg-blue-50 text-blue-600'
                  : 'border-gray-400 text-gray-700 hover:border-gray-500'
                }
                focus:outline-none focus:ring-0
                leaflet-bar
              `}
              style={{ boxShadow: '0 1px 5px rgba(0,0,0,0.1)' }}
              aria-label="Toggle layer control"
              title="Layer Control"
            >
              <Layers size={22} />
            </button>

            {isLayerPanelOpen && (
              <div
                className={`absolute top-0 left-full ml-2 bg-white rounded-[4px] border-2 border-gray-300 p-2 min-w-[110px] max-w-[140px]
                  ${isMobile ? 'min-w-[110px]' : ''}
                  shadow-lg
                `}
                style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.15)' }}
              >
                <div className="flex items-center justify-between mb-1 pb-1 border-b border-gray-200">
                  <h3 className="text-[11px] font-semibold text-gray-700">Layers</h3>
                  <button
                    onClick={() => setIsLayerPanelOpen(false)}
                    className="text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full p-0.5"
                  >
                    <X size={14} strokeWidth={3} />
                  </button>
                </div>

                {/* Base Map Section - Radio buttons */}
                <div className="mb-1 pb-1 border-b border-gray-100">
                  <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Base Map</p>
                  <div className="flex flex-col gap-0.5">
                    <label className="flex items-center gap-1.5 text-[11px] text-gray-700 cursor-pointer hover:text-blue-600">
                      <input
                        type="radio"
                        name="baseLayer"
                        checked={baseLayer === 'roadmap'}
                        onChange={() => handleBaseLayerChange('roadmap')}
                        className="w-3 h-3 text-blue-600 cursor-pointer"
                      />
                      <span>Streets</span>
                    </label>

                    <label className="flex items-center gap-1.5 text-[11px] text-gray-700 cursor-pointer hover:text-blue-600">
                      <input
                        type="radio"
                        name="baseLayer"
                        checked={baseLayer === 'hybrid'}
                        onChange={() => handleBaseLayerChange('hybrid')}
                        className="w-3 h-3 text-blue-600 cursor-pointer"
                      />
                      <span>Satellite</span>
                    </label>
                  </div>
                </div>

                {/* Overlay Section - Checkboxes */}
                <div>
                  <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Overlays</p>
                  <div className="flex flex-col gap-0.5">
                    {availableLayers.map((layer) => (
                      <label
                        key={layer.id}
                        className="flex items-center gap-1.5 text-[11px] text-gray-700 cursor-pointer hover:text-blue-600"
                      >
                        <input
                          type="checkbox"
                          checked={activeLayers.includes(layer.id)}
                          onChange={() => handleLayerToggle(layer.id)}
                          className="w-3 h-3 rounded border-gray-300 text-blue-600 cursor-pointer"
                        />
                        <span>{layer.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>

        {/* Traffic Panel */}
        {showTrafficPanel && (
          <TrafficAnalysisPanel
            selectedFlyoverForTraffic={selectedFlyoverForTraffic}
            onClose={closeTrafficPanel}
            isMobile={isMobile}
          />
        )}
      </div>
    </div>
  );
}









// // src/components/GoogleMapComponent.jsx
// import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
// import { GoogleMap, useJsApiLoader, TrafficLayer } from "@react-google-maps/api";
// import { useFlyoverData } from "../hooks/useFlyoverData";
// import {
//   getFlyoverColor,
//   getFlyoverDisplayName,
//   createGoogleMapsMarkerIcon,
//   formatPointName,
// } from "../components/map/mapHelpers";
// import TrafficAnalysisPanel from "./TrafficAnalysisPanel";
// import { Layers, X, Maximize, Minimize } from "lucide-react";

// const center = {
//   lat: 30.30031525674896,
//   lng: 76.75438508247828,
// };

// const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// // Zoom limits
// const MIN_ZOOM = 10;
// const MAX_ZOOM = 17;
// const DEFAULT_ZOOM = 11;

// // Risk color mapping
// const RISK_COLORS = {
//   low: { fill: "#22c55e", stroke: "#16a34a" },
//   moderate: { fill: "#f97316", stroke: "#ea580c" },
//   high: { fill: "#ef4444", stroke: "#dc2626" },
// };

// function FullscreenButton({ isFullscreen, onToggle }) {
//   return (
//     <button
//       onClick={onToggle}
//       className={`flex items-center justify-center w-[30px] h-[30px] bg-white rounded-md shadow-md border border-gray-200 transition-all duration-200 hover:bg-gray-50 hover:shadow-lg ${isFullscreen ? 'bg-blue-50 border-blue-300 text-blue-600' : 'text-gray-700'}`}
//       style={{ boxShadow: '0 1px 5px rgba(0,0,0,0.1)' }}
//       aria-label="Toggle fullscreen"
//       title="Fullscreen"
//     >
//       {isFullscreen ? <Minimize size={18} className="text-gray-700" /> : <Maximize size={18} className="text-gray-700" />}
//     </button>
//   );
// }

// // Loading component
// function LoadingOverlay({ message }) {
//   return (
//     <div className="absolute inset-0 flex items-center justify-center bg-white/90 backdrop-blur-sm z-[1000]">
//       <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-xl shadow-xl border border-gray-200">
//         <div className="w-8 h-8 border-3 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
//         <p className="text-sm font-semibold text-gray-800">{message || "Loading..."}</p>
//       </div>
//     </div>
//   );
// }

// export default function GoogleMapComponent() {
//   const { flyovers, loading, error } = useFlyoverData();

//   const mapRef = useRef(null);
//   const containerRef = useRef(null);
//   const fullscreenContainerRef = useRef(null);
//   const [mapType, setMapType] = useState("roadmap");
//   const [showTrafficLayer, setShowTrafficLayer] = useState(true);
//   const [flyoverDataLoaded, setFlyoverDataLoaded] = useState(false);
//   const [storedGeojson, setStoredGeojson] = useState(null);
//   const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM);
//   const [isMapLoading, setIsMapLoading] = useState(true);
//   const [isMobile, setIsMobile] = useState(window.innerWidth <= 640);
//   const [isFullscreen, setIsFullscreen] = useState(false);
//   const [isMapReady, setIsMapReady] = useState(false);
//   const [isInitialLoad, setIsInitialLoad] = useState(true);

//   // Layer Control States
//   const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);
//   const [activeLayers, setActiveLayers] = useState(['flyover', 'traffic']);
//   const [baseLayer, setBaseLayer] = useState('roadmap');

//   // Refs for flyover layers
//   const markersRef = useRef([]);
//   const markerDataMapRef = useRef(new Map());
//   const flyoverLayerIdsRef = useRef([]);
//   const openInfoWindowsRef = useRef([]);

//   // Zoom threshold for showing popups
//   const POPUP_ZOOM_THRESHOLD = 16;

//   // State for traffic panel
//   const [selectedFlyoverForTraffic, setSelectedFlyoverForTraffic] = useState(null);
//   const [showTrafficPanel, setShowTrafficPanel] = useState(false);

//   // Define available layers
//   const availableLayers = [
//     {
//       id: 'flyover',
//       name: 'Flyover',
//       color: '#3B82F6',
//       type: 'overlay'
//     },
//     {
//       id: 'traffic',
//       name: 'Traffic',
//       color: '#EF4444',
//       type: 'overlay'
//     },
//   ];

//   // Sync traffic layer with activeLayers on mount
//   useEffect(() => {
//     if (activeLayers.includes('traffic')) {
//       setShowTrafficLayer(true);
//     } else {
//       setShowTrafficLayer(false);
//     }
//   }, []);

//   // Close traffic panel
//   const closeTrafficPanel = () => {
//     setShowTrafficPanel(false);
//     setSelectedFlyoverForTraffic(null);
//   };

//   // Close all info windows
//   const closeAllInfoWindows = () => {
//     openInfoWindowsRef.current.forEach((iw) => iw.close());
//     openInfoWindowsRef.current = [];
//   };

//   // Handle layer toggling
//   const handleLayerToggle = useCallback((layerId) => {
//     setActiveLayers(prev => {
//       if (prev.includes(layerId)) {
//         return prev.filter(id => id !== layerId);
//       } else {
//         return [...prev, layerId];
//       }
//     });

//     // Handle traffic layer separately
//     if (layerId === 'traffic') {
//       setShowTrafficLayer(prev => !prev);
//     }

//     // Reset flyoverDataLoaded when toggling flyover layer on
//     if (layerId === 'flyover') {
//       const isCurrentlyActive = activeLayers.includes('flyover');
//       if (!isCurrentlyActive) {
//         setFlyoverDataLoaded(false);
//       }
//     }
//   }, [activeLayers]);

//   // Handle base layer change
//   const handleBaseLayerChange = useCallback((layerType) => {
//     setBaseLayer(layerType);
//     if (!mapRef.current) return;

//     try {
//       mapRef.current.setMapTypeId(layerType);
//     } catch (err) {
//       console.error("[GoogleMap] Error switching base layer:", err);
//     }
//   }, []);

//   // Update layer visibility
//   const updateLayerVisibility = useCallback(() => {
//     if (!mapRef.current) return;

//     // Handle flyover markers visibility
//     if (activeLayers.includes('flyover')) {
//       markersRef.current.forEach(marker => {
//         marker.setMap(mapRef.current);
//       });
//     } else {
//       markersRef.current.forEach(marker => {
//         marker.setMap(null);
//       });
//     }
//   }, [activeLayers]);

//   // Prepare GeoJSON data from flyovers - only once when flyovers change
//   const { combinedGeoJSON, flyoverLookup } = useMemo(() => {
//     if (!flyovers || flyovers.length === 0) return { combinedGeoJSON: null, flyoverLookup: {} };

//     const lookup = {};
//     const features = [];

//     flyovers.forEach((flyover, index) => {
//       const flyoverFeatures = flyover.geojson?.features || [];
//       let type = flyover.type;
//       if (!type && flyoverFeatures.length > 0) {
//         type = flyoverFeatures[0]?.properties?.Type;
//       }
//       const displayName = getFlyoverDisplayName(type, index);

//       lookup[flyover.id] = {
//         id: flyover.id,
//         namedPoints: flyover.namedPoints || [],
//         riskStatus: flyover.riskStatus || 'low',
//         displayName: displayName,
//         color: getFlyoverColor(index),
//         layerIndex: index,
//         features: flyoverFeatures
//       };

//       flyoverFeatures.forEach(feature => {
//         features.push({
//           ...feature,
//           properties: {
//             ...feature.properties,
//             riskStatus: flyover.riskStatus || 'low',
//             displayName: displayName,
//             flyoverId: flyover.id,
//             type: type,
//             layerIndex: index,
//           }
//         });
//       });
//     });

//     return {
//       combinedGeoJSON: {
//         type: "FeatureCollection",
//         features: features
//       },
//       flyoverLookup: lookup
//     };
//   }, [flyovers]);

//   const { isLoaded, loadError } = useJsApiLoader({
//     id: "google-maps-script",
//     googleMapsApiKey: GOOGLE_MAPS_API_KEY,
//   });

//   // Hide loading when map is loaded
//   useEffect(() => {
//     if (isLoaded) {
//       setTimeout(() => {
//         setIsMapLoading(false);
//       }, 500);
//     }
//   }, [isLoaded]);

//   useEffect(() => {
//     const handleFullscreenChange = () => {
//       setIsFullscreen(Boolean(document.fullscreenElement));
//       setTimeout(() => {
//         if (mapRef.current) {
//           google.maps.event.trigger(mapRef.current, 'resize');
//         }
//       }, 200);
//     };
//     document.addEventListener("fullscreenchange", handleFullscreenChange);
//     return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
//   }, []);

//   // Track mobile breakpoint
//   useEffect(() => {
//     const handleResize = () => setIsMobile(window.innerWidth <= 640);
//     window.addEventListener("resize", handleResize);
//     return () => window.removeEventListener("resize", handleResize);
//   }, []);

//   // Store geojson data when it arrives - only once
//   useEffect(() => {
//     if (combinedGeoJSON && combinedGeoJSON.features && combinedGeoJSON.features.length > 0) {
//       setStoredGeojson(combinedGeoJSON);
//     }
//   }, [combinedGeoJSON]);

//   // Update visibility when activeLayers change
//   useEffect(() => {
//     updateLayerVisibility();
//   }, [activeLayers, updateLayerVisibility]);

//   // Handle map load
//   const handleMapLoad = (map) => {
//     mapRef.current = map;
//     setIsMapReady(true);

//     map.addListener('zoom_changed', () => {
//       const zoom = map.getZoom();
//       setCurrentZoom(zoom);

//       if (markersRef.current.length > 0) {
//         handleZoomPopups(zoom);
//       }
//     });

//     setIsMapLoading(false);
//   };

//   // Handle showing/hiding popups based on zoom
//   const handleZoomPopups = (zoom) => {
//     closeAllInfoWindows();

//     if (zoom >= POPUP_ZOOM_THRESHOLD) {
//       const currentCenter = mapRef.current?.getCenter();

//       let popupCount = 0;
//       markerDataMapRef.current.forEach((data, marker) => {
//         const { point, pointName, color, riskStatus } = data;

//         const infoWindow = new google.maps.InfoWindow({
//           content: buildPopupContent(point, pointName, color, riskStatus),
//           maxWidth: 300,
//           disableAutoPan: true,
//           pixelOffset: new google.maps.Size(0, -8), // negative y = moves popup up, away from marker
//         });

//         infoWindow.open(mapRef.current, marker);
//         openInfoWindowsRef.current.push(infoWindow);
//         popupCount++;

//         infoWindow.addListener('closeclick', () => {
//           openInfoWindowsRef.current = openInfoWindowsRef.current.filter(
//             (iw) => iw !== infoWindow
//           );
//         });
//       });

//       if (currentCenter && mapRef.current) {
//         const newCenter = mapRef.current.getCenter();
//         if (newCenter && (newCenter.lat() !== currentCenter.lat() || newCenter.lng() !== currentCenter.lng())) {
//           mapRef.current.setCenter(currentCenter);
//         }
//       }
//     }
//   };

//   // Toggle fullscreen
//   const toggleFullscreen = useCallback(() => {
//     try {
//       const container = fullscreenContainerRef.current;
//       if (!document.fullscreenElement) {
//         if (container?.requestFullscreen) {
//           container.requestFullscreen();
//         }
//       } else {
//         if (document.exitFullscreen) {
//           document.exitFullscreen();
//         }
//       }
//     } catch (err) {
//       console.error("[GoogleMap] Error toggling fullscreen:", err);
//     }
//   }, []);

//   // Clear all markers from map
//   const clearMarkers = () => {
//     markersRef.current.forEach(marker => {
//       marker.setMap(null);
//     });
//     markersRef.current = [];
//     markerDataMapRef.current = new Map();
//     flyoverLayerIdsRef.current = [];
//     closeAllInfoWindows();
//   };

//   // Add flyover GeoJSON to the map
//   const addFlyoverLayer = (map, data) => {
//     try {
//       // Clear existing data first
//       if (map.data) {
//         map.data.forEach((feature) => {
//           map.data.remove(feature);
//         });
//       }

//       map.data.addGeoJson(data);

//       map.data.setStyle((feature) => {
//         const layerIndex = feature.getProperty('layerIndex');
//         const color = getFlyoverColor(layerIndex || 0);
//         return {
//           fillColor: color,
//           strokeColor: color,
//           strokeWeight: 2,
//           fillOpacity: 0.4,
//           strokeOpacity: 0.8,
//         };
//       });

//       // Store layer IDs for reference
//       flyoverLayerIdsRef.current = [];
//       map.data.forEach((feature) => {
//         flyoverLayerIdsRef.current.push(feature.getId());
//       });

//       // Add markers after layer is added
//       setTimeout(() => {
//         addFlyoverLabels(map, data, currentZoom);
//       }, 200);
//     } catch (error) {
//       console.error("Error adding flyover layer:", error);
//     }
//   };

//   // Build popup content
//   const buildPopupContent = (point, pointName, color, riskStatus) => {
//     const riskColor = RISK_COLORS[riskStatus]?.fill || '#6b7280';

//     let popupContent = `
//       <div style="padding: 8px; font-family: Arial, sans-serif; max-width: 250px;">
//           <h4 style="margin: 0 0 4px 0; color: ${color}; font-size: 13px; font-weight: 700;">${pointName}</h4>
//           <p style="margin: 2px 0; font-size: 11px; display: flex; justify-content: space-between;">
//               <span style="color: #6b7280;">Risk:</span>
//               <span style="font-weight: 500; color: ${riskColor}; text-transform: capitalize;">${riskStatus}</span>
//           </p>
//     `;

//     if (point.chainage) {
//       popupContent += `
//         <p style="margin: 2px 0; font-size: 11px; display: flex; justify-content: space-between;">
//             <span style="color: #6b7280;">Chainage:</span>
//             <span style="font-weight: 500; color: #1f2937;">${point.chainage}</span>
//         </p>`;
//     }
//     if (point.description) {
//       popupContent += `
//         <p style="margin: 2px 0; font-size: 11px; display: flex; justify-content: space-between;">
//             <span style="color: #6b7280;">Type:</span>
//             <span style="font-weight: 500; color: #1f2937;">${point.description}</span>
//         </p>`;
//     }
//     if (point.length) {
//       popupContent += `
//         <p style="margin: 2px 0; font-size: 11px; display: flex; justify-content: space-between;">
//             <span style="color: #6b7280;">Length:</span>
//             <span style="font-weight: 500; color: #1f2937;">${point.length}</span>
//         </p>`;
//     }
//     if (point.detail) {
//       popupContent += `
//         <p style="margin: 2px 0; font-size: 11px; display: flex; justify-content: space-between;">
//             <span style="color: #6b7280;">Structure:</span>
//             <span style="font-weight: 500; color: #1f2937;">${point.detail}</span>
//         </p>`;
//     }

//     popupContent += `</div>`;
//     return popupContent;
//   };

//   // Add custom flyover labels with point-level popups
//   const addFlyoverLabels = (map, data, zoom) => {
//     try {
//       const lookup = flyoverLookup;

//       const flyoverIds = new Set();
//       data.features.forEach((feature) => {
//         const id = feature.properties?.flyoverId;
//         if (id) flyoverIds.add(id);
//       });

//       const isDetailed = zoom >= POPUP_ZOOM_THRESHOLD;

//       flyoverIds.forEach((flyoverId) => {
//         const flyoverData = lookup[flyoverId];
//         if (!flyoverData) return;

//         const { namedPoints, color, riskStatus } = flyoverData;
//         if (!namedPoints || namedPoints.length === 0) return;

//         namedPoints.forEach((point, idx) => {
//           const pointName = formatPointName(point.name);

//           const markerIcon = createGoogleMapsMarkerIcon({
//             color: color,
//             labelText: pointName,
//             detailed: false,
//             name: pointName,
//           });

//           const marker = new google.maps.Marker({
//             position: { lat: point.latlng[0], lng: point.latlng[1] },
//             map: map,
//             icon: markerIcon,
//             optimized: false,
//             zIndex: 1000,
//             title: pointName,
//           });

//           // Store marker data for popup generation on zoom
//           markerDataMapRef.current.set(marker, {
//             point: point,
//             pointName: pointName,
//             color: color,
//             riskStatus: riskStatus,
//           });

//           // Click handler for traffic panel
//           marker.addListener('click', () => {
//             const flyoverName = `FLYOVER ${flyoverId}`;
//             const position = marker.getPosition();
//             const lat = position.lat();
//             const lng = position.lng();

//             setSelectedFlyoverForTraffic(flyoverName);
//             setShowTrafficPanel(true);

//             if (mapRef.current) {
//               mapRef.current.panTo({ lat, lng });
//               setTimeout(() => {
//                 mapRef.current.setZoom(14);
//               }, 600);
//             }
//           });

//           markersRef.current.push(marker);
//         });
//       });

//       setFlyoverDataLoaded(true);
//       setIsInitialLoad(false);

//       // Apply visibility based on active layers
//       updateLayerVisibility();

//       // Show popups if zoom is already at threshold
//       if (zoom >= POPUP_ZOOM_THRESHOLD) {
//         setTimeout(() => {
//           handleZoomPopups(zoom);
//         }, 300);
//       }
//     } catch (error) {
//       console.error("Error adding labels:", error);
//       setIsInitialLoad(false);
//     }
//   };

//   // SIMPLE FIX: Load flyovers after a small delay when map is ready
//   useEffect(() => {
//     if (isMapReady && storedGeojson && !flyoverDataLoaded && activeLayers.includes('flyover') && isInitialLoad) {
//       console.log("Loading flyover layer...");
//       // Small delay to ensure map tiles are loading
//       const timer = setTimeout(() => {
//         clearMarkers();
//         addFlyoverLayer(mapRef.current, storedGeojson);
//       }, 500); // 500ms delay gives map time to render base tiles

//       return () => clearTimeout(timer);
//     }
//   }, [isMapReady, storedGeojson, flyoverDataLoaded, activeLayers, isInitialLoad]);

//   // Remove flyover layer when toggled off
//   useEffect(() => {
//     if (!mapRef.current) return;

//     if (!activeLayers.includes('flyover') && flyoverDataLoaded) {
//       if (mapRef.current.data) {
//         mapRef.current.data.forEach((feature) => {
//           mapRef.current.data.remove(feature);
//         });
//       }
//       markersRef.current.forEach(marker => {
//         marker.setMap(null);
//       });
//       flyoverLayerIdsRef.current = [];
//       setFlyoverDataLoaded(false);
//       setIsInitialLoad(true);
//     }
//   }, [activeLayers, flyoverDataLoaded]);

//   // ===== LOADING / ERROR STATES =====
//   if (loadError) {
//     return (
//       <div style={{ position: "relative", width: "100%", height: "100%" }}>
//         <div style={{ padding: "20px", textAlign: "center", marginTop: "80px", color: "#666" }}>
//           Error loading Google Maps: {loadError.message}
//         </div>
//       </div>
//     );
//   }

//   if (!isLoaded || loading || isMapLoading) {
//     return (
//       <div style={{ position: "relative", width: "100%", height: "100vh", background: "#f5f5f5" }}>
//         <LoadingOverlay message="Loading Google Maps..." />
//       </div>
//     );
//   }

//   if (error) {
//     return (
//       <div style={{ position: "relative", width: "100%", height: "100vh" }}>
//         <div style={{
//           padding: "20px",
//           color: "red",
//           marginTop: "80px",
//           marginLeft: "20px",
//           textAlign: "center"
//         }}>
//           <p style={{ color: "#ef4444", fontSize: "18px", fontWeight: "600" }}>Error loading flyover data</p>
//           <p style={{ color: "#6b7280", marginTop: "8px" }}>{error}</p>
//         </div>
//       </div>
//     );
//   }

//   // ===== MAP + CONTROLS =====
//   return (
//     <div
//       ref={containerRef}
//       style={{
//         position: "relative",
//         width: "100%",
//         minHeight: isMobile ? (showTrafficPanel ? "calc(100vh - 100px)" : "100%") : "100%",
//         height: isMobile ? (showTrafficPanel ? "auto" : "100%") : "100%",
//         overflow: isMobile ? "visible" : "hidden",
//         ...(isFullscreen ? { width: "100vw", height: "100vh" } : {}),
//       }}
//     >
//       <div
//         ref={fullscreenContainerRef}
//         style={{
//           display: "flex",
//           flexDirection: isMobile ? "column" : "row",
//           width: "100%",
//           height: "100%",
//           gap: isMobile ? "8px" : "12px",
//           padding: isMobile ? "8px" : "12px",
//           boxSizing: "border-box",
//           overflow: "hidden",
//           background: '#ffffff',
//         }}
//       >
//         {/* Map Container */}
//         <div style={{
//           flexGrow: showTrafficPanel ? (isMobile ? 0 : 1) : 1,
//           flexShrink: isMobile ? 0 : 1,
//           flexBasis: isMobile ? "auto" : "0%",
//           height: isMobile ? (showTrafficPanel ? "350px" : "100%") : "100%",
//           minHeight: isMobile ? (showTrafficPanel ? "300px" : "100%") : "auto",
//           width: isMobile ? "100%" : "auto",
//           minWidth: showTrafficPanel ? (isMobile ? "100%" : "60%") : "100%",
//           transition: "all 0.3s ease",
//           position: "relative",
//           borderRadius: "12px",
//           overflow: "hidden",
//         }}>
//           <GoogleMap
//             mapContainerStyle={{
//               width: "100%",
//               height: "100%",
//               borderRadius: "12px",
//               overflow: "hidden",
//             }}
//             center={center}
//             zoom={DEFAULT_ZOOM}
//             mapTypeId={mapType}
//             onLoad={handleMapLoad}
//             options={{
//               streetViewControl: false,
//               mapTypeControl: false,
//               fullscreenControl: false,
//               zoomControl: false,
//               gestureHandling: "greedy",
//               minZoom: MIN_ZOOM,
//               maxZoom: MAX_ZOOM,
//               disableDefaultUI: true,
//             }}
//           >
//             {showTrafficLayer && <TrafficLayer />}
//           </GoogleMap>

//           {/* Custom Zoom Controls - Top Left */}
//           <div
//             className="absolute z-[500]"
//             style={{
//               top: isMobile ? '70px' : '20px',
//               left: '12px',
//               display: 'flex',
//               flexDirection: 'column',
//               gap: '1px',
//             }}
//           >
//             <button
//               onClick={() => {
//                 if (mapRef.current) {
//                   const currentZoom = mapRef.current.getZoom();
//                   if (currentZoom < MAX_ZOOM) {
//                     mapRef.current.setZoom(currentZoom + 1);
//                   }
//                 }
//               }}
//               className="flex items-center justify-center w-[34px] h-[34px] bg-white rounded-t-[4px] border-2 border-gray-400 hover:border-gray-500 transition-all duration-200 hover:bg-gray-50 focus:outline-none focus:ring-0 leaflet-bar"
//               style={{ boxShadow: '0 1px 5px rgba(0,0,0,0.1)', borderBottom: '1px solid #ccc' }}
//               aria-label="Zoom in"
//               title="Zoom in"
//             >
//               <span style={{ fontSize: '22px', fontWeight: 'bold', lineHeight: '34px', color: '#333' }}>+</span>
//             </button>

//             <button
//               onClick={() => {
//                 if (mapRef.current) {
//                   const currentZoom = mapRef.current.getZoom();
//                   if (currentZoom > MIN_ZOOM) {
//                     mapRef.current.setZoom(currentZoom - 1);
//                   }
//                 }
//               }}
//               className="flex items-center justify-center w-[34px] h-[34px] bg-white rounded-b-[4px] border-2 border-gray-400 hover:border-gray-500 transition-all duration-200 hover:bg-gray-50 focus:outline-none focus:ring-0 leaflet-bar"
//               style={{ boxShadow: '0 1px 5px rgba(0,0,0,0.1)', borderTop: 'none' }}
//               aria-label="Zoom out"
//               title="Zoom out"
//             >
//               <span style={{ fontSize: '22px', fontWeight: 'bold', lineHeight: '34px', color: '#333' }}>−</span>
//             </button>
//           </div>

//           {/* Fullscreen Button - Top Right */}
//           <div className="absolute top-3 right-3 z-[500]">
//             <FullscreenButton isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
//           </div>

//           {/* Layer Control */}
//           <div
//             className="absolute z-[500]"
//             style={{
//               top: isMobile ? '170px' : '120px',
//               left: '12px',
//             }}
//           >
//             <button
//               onClick={() => setIsLayerPanelOpen(!isLayerPanelOpen)}
//               className={`
//                 flex items-center justify-center w-[34px] h-[34px]
//                 bg-white rounded-[4px] border-2
//                 transition-all duration-200 hover:bg-gray-50
//                 ${isLayerPanelOpen
//                   ? 'border-blue-500 bg-blue-50 text-blue-600'
//                   : 'border-gray-400 text-gray-700 hover:border-gray-500'
//                 }
//                 focus:outline-none focus:ring-0
//                 leaflet-bar
//               `}
//               style={{ boxShadow: '0 1px 5px rgba(0,0,0,0.1)' }}
//               aria-label="Toggle layer control"
//               title="Layer Control"
//             >
//               <Layers size={22} />
//             </button>

//             {isLayerPanelOpen && (
//               <div
//                 className={`absolute top-0 left-full ml-2 bg-white rounded-[4px] border-2 border-gray-300 p-2 min-w-[110px] max-w-[140px]
//                   ${isMobile ? 'min-w-[110px]' : ''}
//                   shadow-lg
//                 `}
//                 style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.15)' }}
//               >
//                 <div className="flex items-center justify-between mb-1 pb-1 border-b border-gray-200">
//                   <h3 className="text-[11px] font-semibold text-gray-700">Layers</h3>
//                   <button
//                     onClick={() => setIsLayerPanelOpen(false)}
//                     className="text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full p-0.5"
//                   >
//                     <X size={14} strokeWidth={3} />
//                   </button>
//                 </div>

//                 {/* Base Map Section - Radio buttons */}
//                 <div className="mb-1 pb-1 border-b border-gray-100">
//                   <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Base Map</p>
//                   <div className="flex flex-col gap-0.5">
//                     <label className="flex items-center gap-1.5 text-[11px] text-gray-700 cursor-pointer hover:text-blue-600">
//                       <input
//                         type="radio"
//                         name="baseLayer"
//                         checked={baseLayer === 'roadmap'}
//                         onChange={() => handleBaseLayerChange('roadmap')}
//                         className="w-3 h-3 text-blue-600 cursor-pointer"
//                       />
//                       <span>Streets</span>
//                     </label>

//                     <label className="flex items-center gap-1.5 text-[11px] text-gray-700 cursor-pointer hover:text-blue-600">
//                       <input
//                         type="radio"
//                         name="baseLayer"
//                         checked={baseLayer === 'hybrid'}
//                         onChange={() => handleBaseLayerChange('hybrid')}
//                         className="w-3 h-3 text-blue-600 cursor-pointer"
//                       />
//                       <span>Satellite</span>
//                     </label>
//                   </div>
//                 </div>

//                 {/* Overlay Section - Checkboxes */}
//                 <div>
//                   <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Overlays</p>
//                   <div className="flex flex-col gap-0.5">
//                     {availableLayers.map((layer) => (
//                       <label
//                         key={layer.id}
//                         className="flex items-center gap-1.5 text-[11px] text-gray-700 cursor-pointer hover:text-blue-600"
//                       >
//                         <input
//                           type="checkbox"
//                           checked={activeLayers.includes(layer.id)}
//                           onChange={() => handleLayerToggle(layer.id)}
//                           className="w-3 h-3 rounded border-gray-300 text-blue-600 cursor-pointer"
//                         />
//                         <span>{layer.name}</span>
//                       </label>
//                     ))}
//                   </div>
//                 </div>
//               </div>
//             )}

//           </div>

//         </div>

//         {/* Traffic Panel */}
//         {showTrafficPanel && (
//           <TrafficAnalysisPanel
//             selectedFlyoverForTraffic={selectedFlyoverForTraffic}
//             onClose={closeTrafficPanel}
//             isMobile={isMobile}
//           />
//         )}
//       </div>
//     </div>
//   );
// }





// // // src/components/GoogleMapComponent.jsx
// // import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
// // import { GoogleMap, useJsApiLoader, TrafficLayer } from "@react-google-maps/api";
// // import { useFlyoverData } from "../hooks/useFlyoverData";
// // import {
// //   getFlyoverColor,
// //   getFlyoverDisplayName,
// //   createGoogleMapsMarkerIcon,
// //   formatPointName,
// // } from "../components/map/mapHelpers";
// // import TrafficAnalysisPanel from "./TrafficAnalysisPanel";
// // import { Layers, X, Maximize, Minimize } from "lucide-react";

// // const center = {
// //   lat: 30.30031525674896,
// //   lng: 76.75438508247828,
// // };

// // const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// // // Zoom limits
// // const MIN_ZOOM = 10;
// // const MAX_ZOOM = 17;
// // const DEFAULT_ZOOM = 11;

// // // Risk color mapping
// // const RISK_COLORS = {
// //   low: { fill: "#22c55e", stroke: "#16a34a" },
// //   moderate: { fill: "#f97316", stroke: "#ea580c" },
// //   high: { fill: "#ef4444", stroke: "#dc2626" },
// // };

// // function FullscreenButton({ isFullscreen, onToggle }) {
// //   return (
// //     <button
// //       onClick={onToggle}
// //       className={`flex items-center justify-center w-[30px] h-[30px] bg-white rounded-md shadow-md border border-gray-200 transition-all duration-200 hover:bg-gray-50 hover:shadow-lg ${isFullscreen ? 'bg-blue-50 border-blue-300 text-blue-600' : 'text-gray-700'}`}
// //       style={{ boxShadow: '0 1px 5px rgba(0,0,0,0.1)' }}
// //       aria-label="Toggle fullscreen"
// //       title="Fullscreen"
// //     >
// //       {isFullscreen ? <Minimize size={18} className="text-gray-700" /> : <Maximize size={18} className="text-gray-700" />}
// //     </button>
// //   );
// // }

// // // Loading component
// // function LoadingOverlay({ message }) {
// //   return (
// //     <div className="absolute inset-0 flex items-center justify-center bg-white/90 backdrop-blur-sm z-[1000]">
// //       <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-xl shadow-xl border border-gray-200">
// //         <div className="w-8 h-8 border-3 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
// //         <p className="text-sm font-semibold text-gray-800">{message || "Loading..."}</p>
// //       </div>
// //     </div>
// //   );
// // }

// // export default function GoogleMapComponent() {
// //   const { flyovers, loading, error } = useFlyoverData();

// //   const mapRef = useRef(null);
// //   const containerRef = useRef(null);
// //   const fullscreenContainerRef = useRef(null);
// //   const [mapType, setMapType] = useState("roadmap");
// //   const [showTrafficLayer, setShowTrafficLayer] = useState(true);
// //   const [flyoverDataLoaded, setFlyoverDataLoaded] = useState(false);
// //   const [storedGeojson, setStoredGeojson] = useState(null);
// //   const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM);
// //   const [isMapLoading, setIsMapLoading] = useState(true);
// //   const [isMobile, setIsMobile] = useState(window.innerWidth <= 640);
// //   const [isFullscreen, setIsFullscreen] = useState(false);
// //   const [isMapReady, setIsMapReady] = useState(false);
// //   const [isInitialLoad, setIsInitialLoad] = useState(true);

// //   // Layer Control States
// //   const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);
// //   const [activeLayers, setActiveLayers] = useState(['flyover', 'traffic']);
// //   const [baseLayer, setBaseLayer] = useState('roadmap');

// //   // Refs for flyover layers
// //   const markersRef = useRef([]);
// //   const markerDataMapRef = useRef(new Map());
// //   const flyoverLayerIdsRef = useRef([]);
// //   const openInfoWindowsRef = useRef([]);

// //   // Zoom threshold for showing popups
// //   const POPUP_ZOOM_THRESHOLD = 16;

// //   // State for traffic panel
// //   const [selectedFlyoverForTraffic, setSelectedFlyoverForTraffic] = useState(null);
// //   const [showTrafficPanel, setShowTrafficPanel] = useState(false);

// //   // Define available layers
// //   const availableLayers = [
// //     {
// //       id: 'flyover',
// //       name: 'Flyover',
// //       color: '#3B82F6',
// //       type: 'overlay'
// //     },
// //     {
// //       id: 'traffic',
// //       name: 'Traffic',
// //       color: '#EF4444',
// //       type: 'overlay'
// //     },
// //   ];

// //   // Sync traffic layer with activeLayers on mount
// //   useEffect(() => {
// //     if (activeLayers.includes('traffic')) {
// //       setShowTrafficLayer(true);
// //     } else {
// //       setShowTrafficLayer(false);
// //     }
// //   }, []);

// //   // Close traffic panel
// //   const closeTrafficPanel = () => {
// //     setShowTrafficPanel(false);
// //     setSelectedFlyoverForTraffic(null);
// //   };

// //   // Close all info windows
// //   const closeAllInfoWindows = () => {
// //     openInfoWindowsRef.current.forEach((iw) => iw.close());
// //     openInfoWindowsRef.current = [];
// //   };

// //   // Handle layer toggling
// //   const handleLayerToggle = useCallback((layerId) => {
// //     setActiveLayers(prev => {
// //       if (prev.includes(layerId)) {
// //         return prev.filter(id => id !== layerId);
// //       } else {
// //         return [...prev, layerId];
// //       }
// //     });

// //     // Handle traffic layer separately
// //     if (layerId === 'traffic') {
// //       setShowTrafficLayer(prev => !prev);
// //     }

// //     // Reset flyoverDataLoaded when toggling flyover layer on
// //     if (layerId === 'flyover') {
// //       const isCurrentlyActive = activeLayers.includes('flyover');
// //       if (!isCurrentlyActive) {
// //         setFlyoverDataLoaded(false);
// //       }
// //     }
// //   }, [activeLayers]);

// //   // Handle base layer change
// //   const handleBaseLayerChange = useCallback((layerType) => {
// //     setBaseLayer(layerType);
// //     if (!mapRef.current) return;

// //     try {
// //       mapRef.current.setMapTypeId(layerType);
// //     } catch (err) {
// //       console.error("[GoogleMap] Error switching base layer:", err);
// //     }
// //   }, []);

// //   // Update layer visibility
// //   const updateLayerVisibility = useCallback(() => {
// //     if (!mapRef.current) return;

// //     // Handle flyover markers visibility
// //     if (activeLayers.includes('flyover')) {
// //       markersRef.current.forEach(marker => {
// //         marker.setMap(mapRef.current);
// //       });
// //     } else {
// //       markersRef.current.forEach(marker => {
// //         marker.setMap(null);
// //       });
// //     }
// //   }, [activeLayers]);

// //   // Prepare GeoJSON data from flyovers - only once when flyovers change
// //   const { combinedGeoJSON, flyoverLookup } = useMemo(() => {
// //     if (!flyovers || flyovers.length === 0) return { combinedGeoJSON: null, flyoverLookup: {} };

// //     const lookup = {};
// //     const features = [];

// //     flyovers.forEach((flyover, index) => {
// //       const flyoverFeatures = flyover.geojson?.features || [];
// //       let type = flyover.type;
// //       if (!type && flyoverFeatures.length > 0) {
// //         type = flyoverFeatures[0]?.properties?.Type;
// //       }
// //       const displayName = getFlyoverDisplayName(type, index);

// //       lookup[flyover.id] = {
// //         id: flyover.id,
// //         namedPoints: flyover.namedPoints || [],
// //         riskStatus: flyover.riskStatus || 'low',
// //         displayName: displayName,
// //         color: getFlyoverColor(index),
// //         layerIndex: index,
// //         features: flyoverFeatures
// //       };

// //       flyoverFeatures.forEach(feature => {
// //         features.push({
// //           ...feature,
// //           properties: {
// //             ...feature.properties,
// //             riskStatus: flyover.riskStatus || 'low',
// //             displayName: displayName,
// //             flyoverId: flyover.id,
// //             type: type,
// //             layerIndex: index,
// //           }
// //         });
// //       });
// //     });

// //     return {
// //       combinedGeoJSON: {
// //         type: "FeatureCollection",
// //         features: features
// //       },
// //       flyoverLookup: lookup
// //     };
// //   }, [flyovers]);

// //   const { isLoaded, loadError } = useJsApiLoader({
// //     id: "google-maps-script",
// //     googleMapsApiKey: GOOGLE_MAPS_API_KEY,
// //   });

// //   // Hide loading when map is loaded
// //   useEffect(() => {
// //     if (isLoaded) {
// //       setTimeout(() => {
// //         setIsMapLoading(false);
// //       }, 500);
// //     }
// //   }, [isLoaded]);

// //   useEffect(() => {
// //     const handleFullscreenChange = () => {
// //       setIsFullscreen(Boolean(document.fullscreenElement));
// //       setTimeout(() => {
// //         if (mapRef.current) {
// //           google.maps.event.trigger(mapRef.current, 'resize');
// //         }
// //       }, 200);
// //     };
// //     document.addEventListener("fullscreenchange", handleFullscreenChange);
// //     return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
// //   }, []);

// //   // Track mobile breakpoint
// //   useEffect(() => {
// //     const handleResize = () => setIsMobile(window.innerWidth <= 640);
// //     window.addEventListener("resize", handleResize);
// //     return () => window.removeEventListener("resize", handleResize);
// //   }, []);

// //   // Store geojson data when it arrives - only once
// //   useEffect(() => {
// //     if (combinedGeoJSON && combinedGeoJSON.features && combinedGeoJSON.features.length > 0) {
// //       setStoredGeojson(combinedGeoJSON);
// //     }
// //   }, [combinedGeoJSON]);

// //   // Update visibility when activeLayers change
// //   useEffect(() => {
// //     updateLayerVisibility();
// //   }, [activeLayers, updateLayerVisibility]);

// //   // Handle map load
// //   const handleMapLoad = (map) => {
// //     mapRef.current = map;
// //     setIsMapReady(true);

// //     map.addListener('zoom_changed', () => {
// //       const zoom = map.getZoom();
// //       setCurrentZoom(zoom);

// //       if (markersRef.current.length > 0) {
// //         handleZoomPopups(zoom);
// //       }
// //     });

// //     setIsMapLoading(false);
// //   };

// //   // Handle showing/hiding popups based on zoom
// //   const handleZoomPopups = (zoom) => {
// //     closeAllInfoWindows();

// //     if (zoom >= POPUP_ZOOM_THRESHOLD) {
// //       const currentCenter = mapRef.current?.getCenter();

// //       let popupCount = 0;
// //       markerDataMapRef.current.forEach((data, marker) => {
// //         const { point, pointName, color, riskStatus } = data;

// //         const infoWindow = new google.maps.InfoWindow({
// //           content: buildPopupContent(point, pointName, color, riskStatus),
// //           maxWidth: 300,
// //           disableAutoPan: true,
// //           pixelOffset: new google.maps.Size(0, -8), // negative y = moves popup up, away from marker
// //         });

// //         infoWindow.open(mapRef.current, marker);
// //         openInfoWindowsRef.current.push(infoWindow);
// //         popupCount++;

// //         infoWindow.addListener('closeclick', () => {
// //           openInfoWindowsRef.current = openInfoWindowsRef.current.filter(
// //             (iw) => iw !== infoWindow
// //           );
// //         });
// //       });

// //       if (currentCenter && mapRef.current) {
// //         const newCenter = mapRef.current.getCenter();
// //         if (newCenter && (newCenter.lat() !== currentCenter.lat() || newCenter.lng() !== currentCenter.lng())) {
// //           mapRef.current.setCenter(currentCenter);
// //         }
// //       }
// //     }
// //   };

// //   // Toggle fullscreen
// //   const toggleFullscreen = useCallback(() => {
// //     try {
// //       const container = fullscreenContainerRef.current;
// //       if (!document.fullscreenElement) {
// //         if (container?.requestFullscreen) {
// //           container.requestFullscreen();
// //         }
// //       } else {
// //         if (document.exitFullscreen) {
// //           document.exitFullscreen();
// //         }
// //       }
// //     } catch (err) {
// //       console.error("[GoogleMap] Error toggling fullscreen:", err);
// //     }
// //   }, []);

// //   // Clear all markers from map
// //   const clearMarkers = () => {
// //     markersRef.current.forEach(marker => {
// //       marker.setMap(null);
// //     });
// //     markersRef.current = [];
// //     markerDataMapRef.current = new Map();
// //     flyoverLayerIdsRef.current = [];
// //     closeAllInfoWindows();
// //   };

// //   // Add flyover GeoJSON to the map
// //   const addFlyoverLayer = (map, data) => {
// //     try {
// //       // Clear existing data first
// //       if (map.data) {
// //         map.data.forEach((feature) => {
// //           map.data.remove(feature);
// //         });
// //       }

// //       map.data.addGeoJson(data);

// //       map.data.setStyle((feature) => {
// //         const layerIndex = feature.getProperty('layerIndex');
// //         const color = getFlyoverColor(layerIndex || 0);
// //         return {
// //           fillColor: color,
// //           strokeColor: color,
// //           strokeWeight: 2,
// //           fillOpacity: 0.4,
// //           strokeOpacity: 0.8,
// //         };
// //       });

// //       // Store layer IDs for reference
// //       flyoverLayerIdsRef.current = [];
// //       map.data.forEach((feature) => {
// //         flyoverLayerIdsRef.current.push(feature.getId());
// //       });

// //       // Add markers after layer is added
// //       setTimeout(() => {
// //         addFlyoverLabels(map, data, currentZoom);
// //       }, 200);
// //     } catch (error) {
// //       console.error("Error adding flyover layer:", error);
// //     }
// //   };

// //   // Build popup content
// //   const buildPopupContent = (point, pointName, color, riskStatus) => {
// //     const riskColor = RISK_COLORS[riskStatus]?.fill || '#6b7280';

// //     let popupContent = `
// //       <div style="padding: 8px; font-family: Arial, sans-serif; max-width: 250px;">
// //           <h4 style="margin: 0 0 4px 0; color: ${color}; font-size: 13px; font-weight: 700;">${pointName}</h4>
// //           <p style="margin: 2px 0; font-size: 11px; display: flex; justify-content: space-between;">
// //               <span style="color: #6b7280;">Risk:</span>
// //               <span style="font-weight: 500; color: ${riskColor}; text-transform: capitalize;">${riskStatus}</span>
// //           </p>
// //     `;

// //     if (point.chainage) {
// //       popupContent += `
// //         <p style="margin: 2px 0; font-size: 11px; display: flex; justify-content: space-between;">
// //             <span style="color: #6b7280;">Chainage:</span>
// //             <span style="font-weight: 500; color: #1f2937;">${point.chainage}</span>
// //         </p>`;
// //     }
// //     if (point.description) {
// //       popupContent += `
// //         <p style="margin: 2px 0; font-size: 11px; display: flex; justify-content: space-between;">
// //             <span style="color: #6b7280;">Type:</span>
// //             <span style="font-weight: 500; color: #1f2937;">${point.description}</span>
// //         </p>`;
// //     }
// //     if (point.length) {
// //       popupContent += `
// //         <p style="margin: 2px 0; font-size: 11px; display: flex; justify-content: space-between;">
// //             <span style="color: #6b7280;">Length:</span>
// //             <span style="font-weight: 500; color: #1f2937;">${point.length}</span>
// //         </p>`;
// //     }
// //     if (point.detail) {
// //       popupContent += `
// //         <p style="margin: 2px 0; font-size: 11px; display: flex; justify-content: space-between;">
// //             <span style="color: #6b7280;">Structure:</span>
// //             <span style="font-weight: 500; color: #1f2937;">${point.detail}</span>
// //         </p>`;
// //     }

// //     popupContent += `</div>`;
// //     return popupContent;
// //   };

// //   // Add custom flyover labels with point-level popups
// //   const addFlyoverLabels = (map, data, zoom) => {
// //     try {
// //       const lookup = flyoverLookup;

// //       const flyoverIds = new Set();
// //       data.features.forEach((feature) => {
// //         const id = feature.properties?.flyoverId;
// //         if (id) flyoverIds.add(id);
// //       });

// //       const isDetailed = zoom >= POPUP_ZOOM_THRESHOLD;

// //       flyoverIds.forEach((flyoverId) => {
// //         const flyoverData = lookup[flyoverId];
// //         if (!flyoverData) return;

// //         const { namedPoints, color, riskStatus } = flyoverData;
// //         if (!namedPoints || namedPoints.length === 0) return;

// //         namedPoints.forEach((point, idx) => {
// //           const pointName = formatPointName(point.name);

// //           const markerIcon = createGoogleMapsMarkerIcon({
// //             color: color,
// //             labelText: pointName,
// //             detailed: false,
// //             name: pointName,
// //           });

// //           const marker = new google.maps.Marker({
// //             position: { lat: point.latlng[0], lng: point.latlng[1] },
// //             map: map,
// //             icon: markerIcon,
// //             optimized: false,
// //             zIndex: 1000,
// //             title: pointName,
// //           });

// //           // Store marker data for popup generation on zoom
// //           markerDataMapRef.current.set(marker, {
// //             point: point,
// //             pointName: pointName,
// //             color: color,
// //             riskStatus: riskStatus,
// //           });

// //           // Click handler for traffic panel
// //           marker.addListener('click', () => {
// //             const flyoverName = `FLYOVER ${flyoverId}`;
// //             const position = marker.getPosition();
// //             const lat = position.lat();
// //             const lng = position.lng();

// //             setSelectedFlyoverForTraffic(flyoverName);
// //             setShowTrafficPanel(true);

// //             if (mapRef.current) {
// //               mapRef.current.panTo({ lat, lng });
// //               setTimeout(() => {
// //                 mapRef.current.setZoom(14);
// //               }, 600);
// //             }
// //           });

// //           markersRef.current.push(marker);
// //         });
// //       });

// //       setFlyoverDataLoaded(true);
// //       setIsInitialLoad(false);

// //       // Apply visibility based on active layers
// //       updateLayerVisibility();

// //       // Show popups if zoom is already at threshold
// //       if (zoom >= POPUP_ZOOM_THRESHOLD) {
// //         setTimeout(() => {
// //           handleZoomPopups(zoom);
// //         }, 300);
// //       }
// //     } catch (error) {
// //       console.error("Error adding labels:", error);
// //       setIsInitialLoad(false);
// //     }
// //   };

// //   // SINGLE useEffect to load flyovers when map and data are ready
// //   useEffect(() => {
// //     // Only load if: map is ready, data exists, not already loaded, and flyover layer is active
// //     if (
// //       isMapReady &&
// //       storedGeojson &&
// //       !flyoverDataLoaded &&
// //       activeLayers.includes('flyover') &&
// //       isInitialLoad
// //     ) {
// //       console.log("Loading flyover layer once...");
// //       clearMarkers();
// //       addFlyoverLayer(mapRef.current, storedGeojson);
// //     }
// //   }, [isMapReady, storedGeojson, flyoverDataLoaded, activeLayers, isInitialLoad]);

// //   // Remove flyover layer when toggled off
// //   useEffect(() => {
// //     if (!mapRef.current) return;

// //     if (!activeLayers.includes('flyover') && flyoverDataLoaded) {
// //       if (mapRef.current.data) {
// //         mapRef.current.data.forEach((feature) => {
// //           mapRef.current.data.remove(feature);
// //         });
// //       }
// //       markersRef.current.forEach(marker => {
// //         marker.setMap(null);
// //       });
// //       flyoverLayerIdsRef.current = [];
// //       setFlyoverDataLoaded(false);
// //       setIsInitialLoad(true);
// //     }
// //   }, [activeLayers, flyoverDataLoaded]);

// //   // ===== LOADING / ERROR STATES =====
// //   if (loadError) {
// //     return (
// //       <div style={{ position: "relative", width: "100%", height: "100%" }}>
// //         <div style={{ padding: "20px", textAlign: "center", marginTop: "80px", color: "#666" }}>
// //           Error loading Google Maps: {loadError.message}
// //         </div>
// //       </div>
// //     );
// //   }

// //   if (!isLoaded || loading || isMapLoading) {
// //     return (
// //       <div style={{ position: "relative", width: "100%", height: "100vh", background: "#f5f5f5" }}>
// //         <LoadingOverlay message="Loading Google Maps..." />
// //       </div>
// //     );
// //   }

// //   if (error) {
// //     return (
// //       <div style={{ position: "relative", width: "100%", height: "100vh" }}>
// //         <div style={{
// //           padding: "20px",
// //           color: "red",
// //           marginTop: "80px",
// //           marginLeft: "20px",
// //           textAlign: "center"
// //         }}>
// //           <p style={{ color: "#ef4444", fontSize: "18px", fontWeight: "600" }}>Error loading flyover data</p>
// //           <p style={{ color: "#6b7280", marginTop: "8px" }}>{error}</p>
// //         </div>
// //       </div>
// //     );
// //   }

// //   // ===== MAP + CONTROLS =====
// //   return (
// //     <div
// //       ref={containerRef}
// //       style={{
// //         position: "relative",
// //         width: "100%",
// //         minHeight: isMobile ? (showTrafficPanel ? "calc(100vh - 100px)" : "100%") : "100%",
// //         height: isMobile ? (showTrafficPanel ? "auto" : "100%") : "100%",
// //         overflow: isMobile ? "visible" : "hidden",
// //         ...(isFullscreen ? { width: "100vw", height: "100vh" } : {}),
// //       }}
// //     >
// //       <div
// //         ref={fullscreenContainerRef}
// //         style={{
// //           display: "flex",
// //           flexDirection: isMobile ? "column" : "row",
// //           width: "100%",
// //           height: "100%",
// //           gap: isMobile ? "8px" : "12px",
// //           padding: isMobile ? "8px" : "12px",
// //           boxSizing: "border-box",
// //           overflow: "hidden",
// //           background: '#ffffff',
// //         }}
// //       >
// //         {/* Map Container */}
// //         <div style={{
// //           flexGrow: showTrafficPanel ? (isMobile ? 0 : 1) : 1,
// //           flexShrink: isMobile ? 0 : 1,
// //           flexBasis: isMobile ? "auto" : "0%",
// //           height: isMobile ? (showTrafficPanel ? "350px" : "100%") : "100%",
// //           minHeight: isMobile ? (showTrafficPanel ? "300px" : "100%") : "auto",
// //           width: isMobile ? "100%" : "auto",
// //           minWidth: showTrafficPanel ? (isMobile ? "100%" : "60%") : "100%",
// //           transition: "all 0.3s ease",
// //           position: "relative",
// //           borderRadius: "12px",
// //           overflow: "hidden",
// //         }}>
// //           <GoogleMap
// //             mapContainerStyle={{
// //               width: "100%",
// //               height: "100%",
// //               borderRadius: "12px",
// //               overflow: "hidden",
// //             }}
// //             center={center}
// //             zoom={DEFAULT_ZOOM}
// //             mapTypeId={mapType}
// //             onLoad={handleMapLoad}
// //             options={{
// //               streetViewControl: false,
// //               mapTypeControl: false,
// //               fullscreenControl: false,
// //               zoomControl: false,
// //               gestureHandling: "greedy",
// //               minZoom: MIN_ZOOM,
// //               maxZoom: MAX_ZOOM,
// //               disableDefaultUI: true,
// //             }}
// //           >
// //             {showTrafficLayer && <TrafficLayer />}
// //           </GoogleMap>

// //           {/* Custom Zoom Controls - Top Left */}
// //           <div
// //             className="absolute z-[500]"
// //             style={{
// //               top: isMobile ? '70px' : '20px',
// //               left: '12px',
// //               display: 'flex',
// //               flexDirection: 'column',
// //               gap: '1px',
// //             }}
// //           >
// //             <button
// //               onClick={() => {
// //                 if (mapRef.current) {
// //                   const currentZoom = mapRef.current.getZoom();
// //                   if (currentZoom < MAX_ZOOM) {
// //                     mapRef.current.setZoom(currentZoom + 1);
// //                   }
// //                 }
// //               }}
// //               className="flex items-center justify-center w-[34px] h-[34px] bg-white rounded-t-[4px] border-2 border-gray-400 hover:border-gray-500 transition-all duration-200 hover:bg-gray-50 focus:outline-none focus:ring-0 leaflet-bar"
// //               style={{ boxShadow: '0 1px 5px rgba(0,0,0,0.1)', borderBottom: '1px solid #ccc' }}
// //               aria-label="Zoom in"
// //               title="Zoom in"
// //             >
// //               <span style={{ fontSize: '22px', fontWeight: 'bold', lineHeight: '34px', color: '#333' }}>+</span>
// //             </button>

// //             <button
// //               onClick={() => {
// //                 if (mapRef.current) {
// //                   const currentZoom = mapRef.current.getZoom();
// //                   if (currentZoom > MIN_ZOOM) {
// //                     mapRef.current.setZoom(currentZoom - 1);
// //                   }
// //                 }
// //               }}
// //               className="flex items-center justify-center w-[34px] h-[34px] bg-white rounded-b-[4px] border-2 border-gray-400 hover:border-gray-500 transition-all duration-200 hover:bg-gray-50 focus:outline-none focus:ring-0 leaflet-bar"
// //               style={{ boxShadow: '0 1px 5px rgba(0,0,0,0.1)', borderTop: 'none' }}
// //               aria-label="Zoom out"
// //               title="Zoom out"
// //             >
// //               <span style={{ fontSize: '22px', fontWeight: 'bold', lineHeight: '34px', color: '#333' }}>−</span>
// //             </button>
// //           </div>

// //           {/* Fullscreen Button - Top Right */}
// //           <div className="absolute top-3 right-3 z-[500]">
// //             <FullscreenButton isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
// //           </div>

// //           {/* Layer Control */}
// //           <div
// //             className="absolute z-[500]"
// //             style={{
// //               top: isMobile ? '170px' : '120px',
// //               left: '12px',
// //             }}
// //           >
// //             <button
// //               onClick={() => setIsLayerPanelOpen(!isLayerPanelOpen)}
// //               className={`
// //                 flex items-center justify-center w-[34px] h-[34px]
// //                 bg-white rounded-[4px] border-2
// //                 transition-all duration-200 hover:bg-gray-50
// //                 ${isLayerPanelOpen
// //                   ? 'border-blue-500 bg-blue-50 text-blue-600'
// //                   : 'border-gray-400 text-gray-700 hover:border-gray-500'
// //                 }
// //                 focus:outline-none focus:ring-0
// //                 leaflet-bar
// //               `}
// //               style={{ boxShadow: '0 1px 5px rgba(0,0,0,0.1)' }}
// //               aria-label="Toggle layer control"
// //               title="Layer Control"
// //             >
// //               <Layers size={22} />
// //             </button>

// //             {isLayerPanelOpen && (
// //               <div
// //                 className={`absolute top-0 left-full ml-2 bg-white rounded-[4px] border-2 border-gray-300 p-2 min-w-[110px] max-w-[140px]
// //                   ${isMobile ? 'min-w-[110px]' : ''}
// //                   shadow-lg
// //                 `}
// //                 style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.15)' }}
// //               >
// //                 <div className="flex items-center justify-between mb-1 pb-1 border-b border-gray-200">
// //                   <h3 className="text-[11px] font-semibold text-gray-700">Layers</h3>
// //                   <button
// //                     onClick={() => setIsLayerPanelOpen(false)}
// //                     className="text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full p-0.5"
// //                   >
// //                     <X size={14} strokeWidth={3} />
// //                   </button>
// //                 </div>

// //                 {/* Base Map Section - Radio buttons */}
// //                 <div className="mb-1 pb-1 border-b border-gray-100">
// //                   <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Base Map</p>
// //                   <div className="flex flex-col gap-0.5">
// //                     <label className="flex items-center gap-1.5 text-[11px] text-gray-700 cursor-pointer hover:text-blue-600">
// //                       <input
// //                         type="radio"
// //                         name="baseLayer"
// //                         checked={baseLayer === 'roadmap'}
// //                         onChange={() => handleBaseLayerChange('roadmap')}
// //                         className="w-3 h-3 text-blue-600 cursor-pointer"
// //                       />
// //                       <span>Streets</span>
// //                     </label>

// //                     <label className="flex items-center gap-1.5 text-[11px] text-gray-700 cursor-pointer hover:text-blue-600">
// //                       <input
// //                         type="radio"
// //                         name="baseLayer"
// //                         checked={baseLayer === 'hybrid'}
// //                         onChange={() => handleBaseLayerChange('hybrid')}
// //                         className="w-3 h-3 text-blue-600 cursor-pointer"
// //                       />
// //                       <span>Satellite</span>
// //                     </label>
// //                   </div>
// //                 </div>

// //                 {/* Overlay Section - Checkboxes */}
// //                 <div>
// //                   <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Overlays</p>
// //                   <div className="flex flex-col gap-0.5">
// //                     {availableLayers.map((layer) => (
// //                       <label
// //                         key={layer.id}
// //                         className="flex items-center gap-1.5 text-[11px] text-gray-700 cursor-pointer hover:text-blue-600"
// //                       >
// //                         <input
// //                           type="checkbox"
// //                           checked={activeLayers.includes(layer.id)}
// //                           onChange={() => handleLayerToggle(layer.id)}
// //                           className="w-3 h-3 rounded border-gray-300 text-blue-600 cursor-pointer"
// //                         />
// //                         <span>{layer.name}</span>
// //                       </label>
// //                     ))}
// //                   </div>
// //                 </div>
// //               </div>
// //             )}

// //           </div>

// //         </div>

// //         {/* Traffic Panel */}
// //         {showTrafficPanel && (
// //           <TrafficAnalysisPanel
// //             selectedFlyoverForTraffic={selectedFlyoverForTraffic}
// //             onClose={closeTrafficPanel}
// //             isMobile={isMobile}
// //           />
// //         )}
// //       </div>
// //     </div>
// //   );
// // }





