
// // src/components/FloodMap.jsx
// import { useEffect, useRef, useState, useCallback } from "react";
// import Map from "ol/Map";
// import View from "ol/View";
// import TileLayer from "ol/layer/Tile";
// import TileWMS from "ol/source/TileWMS";
// import VectorLayer from "ol/layer/Vector";
// import VectorSource from "ol/source/Vector";
// import { XYZ, OSM } from "ol/source";
// import { fromLonLat } from "ol/proj";
// import { Feature } from "ol";
// import { Point } from "ol/geom";
// import { Style, Fill, Stroke, Circle, Text } from "ol/style";
// import { defaults as defaultControls } from "ol/control";
// import { GeoJSON } from "ol/format";
// import "ol/ol.css";
// import { Loader2, AlertTriangle, Maximize, Minimize, Droplets } from "lucide-react";
// import { useFlyoverData } from "../hooks/useFlyoverData";
// import {
//     getFlyoverColor,
//     getFlyoverDisplayName,
//     makeFlyoverIcon,
//     formatPointName,
// } from "./map/mapHelpers";

// const DEBUG = true;
// const log = (...args) => DEBUG && console.log("[FloodMap]", ...args);
// const logError = (...args) => console.error("[FloodMap]", ...args);

// // WMS Configuration
// const WMS_URL = "https://mlinfomap.biz/geoserver/NHAI/wms?";
// const WMS_LAYER = "2017";
// const DEFAULT_FLOOD_MAP_CENTER = [30.3, 76.7];

// const FLOOD_COLORS = {
//     value1: { color: [240, 240, 240], label: "Low" },
//     value2: { color: [180, 180, 180], label: "Moderate" },
//     value3: { color: [120, 120, 120], label: "High" },
//     value4: { color: [60, 60, 60], label: "Very High" },
//     value5: { color: [20, 20, 20], label: "Extreme" },
// };

// function FullscreenButton({ isFullscreen, onToggle }) {
//     return (
//         <button
//             onClick={onToggle}
//             className={`flex items-center justify-center w-[30px] h-[30px] bg-white rounded-md shadow-md border border-gray-200 transition-all duration-200 hover:bg-gray-50 hover:shadow-lg ${isFullscreen ? 'bg-blue-50 border-blue-300 text-blue-600' : 'text-gray-700'}`}
//             aria-label="Toggle fullscreen"
//         >
//             {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
//         </button>
//     );
// }

// function FloodLegend() {
//     return (
//         <div className="absolute bottom-3 right-3 z-[500] bg-white/95 backdrop-blur-sm rounded-md shadow-md border border-gray-200 px-3 py-2 max-w-[180px]">
//             <div className="text-[11px] font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
//                 <Droplets size={14} className="text-blue-500" />
//                 Flood Risk
//             </div>
//             <div className="flex flex-col gap-1">
//                 <div className="flex items-center gap-2">
//                     <span className="w-3 h-3 rounded-sm flex-shrink-0 border border-gray-200" style={{ backgroundColor: `rgb(${FLOOD_COLORS.value1.color.join(',')})` }} />
//                     <span className="text-[10px] text-gray-600 leading-tight">Low</span>
//                 </div>
//                 <div className="flex items-center gap-2">
//                     <span className="w-3 h-3 rounded-sm flex-shrink-0 border border-gray-200" style={{ backgroundColor: `rgb(${FLOOD_COLORS.value2.color.join(',')})` }} />
//                     <span className="text-[10px] text-gray-600 leading-tight">Moderate</span>
//                 </div>
//                 <div className="flex items-center gap-2">
//                     <span className="w-3 h-3 rounded-sm flex-shrink-0 border border-gray-200" style={{ backgroundColor: `rgb(${FLOOD_COLORS.value3.color.join(',')})` }} />
//                     <span className="text-[10px] text-gray-600 leading-tight">High</span>
//                 </div>
//                 <div className="flex items-center gap-2">
//                     <span className="w-3 h-3 rounded-sm flex-shrink-0 border border-gray-200" style={{ backgroundColor: `rgb(${FLOOD_COLORS.value4.color.join(',')})` }} />
//                     <span className="text-[10px] text-gray-600 leading-tight">Very High</span>
//                 </div>
//                 <div className="flex items-center gap-2">
//                     <span className="w-3 h-3 rounded-sm flex-shrink-0 border border-gray-200" style={{ backgroundColor: `rgb(${FLOOD_COLORS.value5.color.join(',')})` }} />
//                     <span className="text-[10px] text-gray-600 leading-tight">Extreme</span>
//                 </div>
//             </div>
//         </div>
//     );
// }

// export default function FloodMap({ mapCenter = DEFAULT_FLOOD_MAP_CENTER, isActive = true }) {
//     const FLOOD_MAP_ZOOM = 10;

//     const mapContainerRef = useRef(null);
//     const mapRef = useRef(null);
//     const floodLayerRef = useRef(null);
//     const flyoverLayersRef = useRef([]);
//     const flyoverMarkersRef = useRef([]);
//     const flyoversAddedRef = useRef(false);
//     const isMapReadyRef = useRef(false);

//     const [loading, setLoading] = useState(true);
//     const [error, setError] = useState(null);
//     const [isFullscreen, setIsFullscreen] = useState(false);
//     const [isLayerAdded, setIsLayerAdded] = useState(false);
//     const [wmsDebugInfo, setWmsDebugInfo] = useState(null);

//     const { flyovers, loading: flyoversLoading } = useFlyoverData();

//     const fullscreenContainerRef = useRef(null);

//     // Helper to convert [lat, lng] to OpenLayers projection
//     const fromLatLng = (latLng) => {
//         return fromLonLat([latLng[1], latLng[0]]);
//     };

//     // Function to test WMS server
//     const testWMSServer = useCallback(async () => {
//         try {
//             // Test 1: GetCapabilities
//             const capabilitiesUrl = `${WMS_URL}?SERVICE=WMS&VERSION=1.1.0&REQUEST=GetCapabilities`;
//             log('Testing WMS GetCapabilities:', capabilitiesUrl);

//             const response = await fetch(capabilitiesUrl);
//             log('GetCapabilities Response Status:', response.status);

//             if (response.ok) {
//                 const text = await response.text();
//                 log('GetCapabilities Response (first 200 chars):', text.substring(0, 200));

//                 // Check if layer exists in response
//                 if (text.includes(WMS_LAYER)) {
//                     log(`✅ Layer "${WMS_LAYER}" found in capabilities`);
//                 } else {
//                     log(`❌ Layer "${WMS_LAYER}" NOT found in capabilities`);
//                     setError(`Layer "${WMS_LAYER}" not found on WMS server. Check layer name.`);
//                 }
//             } else {
//                 log('❌ GetCapabilities failed with status:', response.status);
//             }
//         } catch (err) {
//             logError('Error testing WMS server:', err);
//             setError(`WMS server error: ${err.message}`);
//         }
//     }, []);

//     // ---- Initialize map exactly once ----
//     useEffect(() => {
//         if (!mapContainerRef.current) return;

//         if (mapRef.current) {
//             mapRef.current.setTarget(null);
//             mapRef.current = null;
//             setIsLayerAdded(false);
//             isMapReadyRef.current = false;
//         }

//         log("🗺️ Initializing Flood map");

//         // Test WMS server
//         testWMSServer();

//         // Base layer - OSM
//         const baseLayer = new TileLayer({
//             source: new OSM({
//                 crossOrigin: 'anonymous',
//             }),
//         });

//         // WMS Raster Layer - Try different configurations
//         const wmsLayer1 = new TileLayer({
//             source: new TileWMS({
//                 url: WMS_URL,
//                 params: {
//                     LAYERS: WMS_LAYER,
//                     FORMAT: 'image/png',
//                     TRANSPARENT: true,
//                     VERSION: '1.1.0',
//                     // Try different SRS options
//                     SRS: 'EPSG:3857',
//                 },
//                 serverType: 'geoserver',
//                 crossOrigin: 'anonymous',
//             }),
//             opacity: 0.7,
//             properties: { name: 'WMS Layer 1 (3857)' }
//         });

//         // Alternative WMS Layer with EPSG:4326
//         const wmsLayer2 = new TileLayer({
//             source: new TileWMS({
//                 url: WMS_URL,
//                 params: {
//                     LAYERS: WMS_LAYER,
//                     FORMAT: 'image/png',
//                     TRANSPARENT: true,
//                     VERSION: '1.1.0',
//                     SRS: 'EPSG:4326',  // Try different projection
//                 },
//                 serverType: 'geoserver',
//                 crossOrigin: 'anonymous',
//             }),
//             opacity: 0.7,
//             visible: false,  // Hidden by default
//             properties: { name: 'WMS Layer 2 (4326)' }
//         });

//         // Alternative: Try without SRS parameter
//         const wmsLayer3 = new TileLayer({
//             source: new TileWMS({
//                 url: WMS_URL,
//                 params: {
//                     LAYERS: WMS_LAYER,
//                     FORMAT: 'image/png',
//                     TRANSPARENT: true,
//                     VERSION: '1.1.0',
//                     // No SRS parameter - let server decide
//                 },
//                 serverType: 'geoserver',
//                 crossOrigin: 'anonymous',
//             }),
//             opacity: 0.7,
//             visible: false,  // Hidden by default
//             properties: { name: 'WMS Layer 3 (Default SRS)' }
//         });

//         // Add error listeners to debug WMS layers
//         [wmsLayer1, wmsLayer2, wmsLayer3].forEach(layer => {
//             layer.getSource().on('imageloadstart', function () {
//                 log(`📥 ${layer.getProperties().name} - Loading started`);
//             });

//             layer.getSource().on('imageloadend', function () {
//                 log(`✅ ${layer.getProperties().name} - Loaded successfully`);
//             });

//             layer.getSource().on('imageloaderror', function (event) {
//                 logError(`❌ ${layer.getProperties().name} - Failed to load:`, event);
//                 logError(`   URL:`, event.image?.src);
//             });
//         });

//         // Store reference
//         floodLayerRef.current = wmsLayer1;

//         // Create map
//         const map = new Map({
//             target: mapContainerRef.current,
//             layers: [
//                 baseLayer,    // Base layer
//                 wmsLayer1,    // WMS layer
//                 wmsLayer2,    // Alternative WMS
//                 wmsLayer3,    // Alternative WMS
//             ],
//             view: new View({
//                 center: fromLatLng(mapCenter),
//                 zoom: FLOOD_MAP_ZOOM,
//                 projection: 'EPSG:3857',
//             }),
//             controls: defaultControls({
//                 zoom: true,
//                 attribution: false,
//             }),
//         });

//         // Make map available for debugging
//         window.__map = map;
//         window.__wmsLayers = { wmsLayer1, wmsLayer2, wmsLayer3 };

//         mapRef.current = map;
//         isMapReadyRef.current = true;
//         setIsLayerAdded(true);
//         setLoading(false);
//         flyoversAddedRef.current = false;

//         // Force map to render correctly
//         setTimeout(() => {
//             map.updateSize();
//         }, 100);

//         const resizeObserver = new ResizeObserver(() => {
//             map.updateSize();
//         });
//         if (mapContainerRef.current) {
//             resizeObserver.observe(mapContainerRef.current);
//         }

//         // Add flyovers after map is ready
//         if (flyovers && flyovers.length > 0) {
//             log("🛣️ Adding flyovers on map init");
//             setTimeout(() => {
//                 addFlyoverLayers(map);
//             }, 300);
//         }

//         return () => {
//             resizeObserver.disconnect();
//             if (mapRef.current) {
//                 mapRef.current.setTarget(null);
//                 mapRef.current = null;
//             }
//             setIsLayerAdded(false);
//             flyoversAddedRef.current = false;
//             isMapReadyRef.current = false;
//         };
//     }, [mapCenter, testWMSServer]);

//     // ---- Add flyover layers ----
//     const addFlyoverLayers = useCallback((map) => {
//         if (!flyovers || flyovers.length === 0) {
//             log("ℹ️ No flyovers to add");
//             return;
//         }

//         if (flyoversAddedRef.current) {
//             log("ℹ️ Flyovers already added");
//             return;
//         }

//         log(`🛣️ Adding ${flyovers.length} flyover layers...`);

//         // Clear existing layers
//         flyoverLayersRef.current.forEach(layer => {
//             if (map) {
//                 map.removeLayer(layer);
//             }
//         });
//         flyoverLayersRef.current = [];

//         flyoverMarkersRef.current.forEach(layer => {
//             if (map) {
//                 map.removeLayer(layer);
//             }
//         });
//         flyoverMarkersRef.current = [];

//         const geoJsonFormat = new GeoJSON();

//         flyovers.forEach((flyover, index) => {
//             const color = getFlyoverColor(index);
//             const displayName = getFlyoverDisplayName(flyover.type, index);

//             log(`  📍 Adding flyover ${index + 1}: ${displayName}`);

//             if (flyover.geojson) {
//                 try {
//                     const features = geoJsonFormat.readFeatures(flyover.geojson, {
//                         featureProjection: 'EPSG:3857',
//                     });

//                     const source = new VectorSource({
//                         features: features,
//                     });

//                     const layer = new VectorLayer({
//                         source: source,
//                         style: new Style({
//                             stroke: new Stroke({
//                                 color: color,
//                                 width: 3,
//                             }),
//                             fill: new Fill({
//                                 color: color + '33',
//                             }),
//                         }),
//                         zIndex: 20,
//                     });

//                     map.addLayer(layer);
//                     flyoverLayersRef.current.push(layer);
//                     log(`    ✅ GeoJSON layer added`);
//                 } catch (err) {
//                     logError(`Error adding flyover layer for ${displayName}:`, err);
//                 }
//             }

//             if (flyover.namedPoints && flyover.namedPoints.length > 0) {
//                 log(`    📍 Adding ${flyover.namedPoints.length} markers`);

//                 const markerFeatures = flyover.namedPoints.map((point) => {
//                     try {
//                         const pointName = formatPointName(point.name);
//                         const coord = fromLatLng(point.latlng);

//                         const feature = new Feature({
//                             geometry: new Point(coord),
//                             name: pointName,
//                             chainage: point.chainage,
//                             description: point.description,
//                             length: point.length,
//                             detail: point.detail,
//                             color: color,
//                             originalPoint: point,
//                         });

//                         feature.setStyle(new Style({
//                             image: new Circle({
//                                 radius: 8,
//                                 fill: new Fill({ color: color }),
//                                 stroke: new Stroke({ color: '#fff', width: 2 }),
//                             }),
//                             text: new Text({
//                                 text: pointName,
//                                 font: '12px Arial',
//                                 fill: new Fill({ color: '#333' }),
//                                 stroke: new Stroke({ color: '#fff', width: 3 }),
//                                 offsetY: -15,
//                                 textAlign: 'center',
//                             }),
//                         }));

//                         return feature;
//                     } catch (err) {
//                         logError(`Error creating marker for ${point.name}:`, err);
//                         return null;
//                     }
//                 }).filter(f => f !== null);

//                 if (markerFeatures.length > 0) {
//                     const markerSource = new VectorSource({
//                         features: markerFeatures,
//                     });

//                     const markerLayer = new VectorLayer({
//                         source: markerSource,
//                         zIndex: 100,
//                     });

//                     // Add click handler for popups
//                     map.on('click', function (event) {
//                         const features = map.getFeaturesAtPixel(event.pixel, {
//                             hitTolerance: 10,
//                             layers: [markerLayer],
//                         });

//                         if (features && features.length > 0) {
//                             const feature = features[0];
//                             const props = feature.getProperties();

//                             const popupContent = `
//                                 <div style="padding: 8px; font-family: Arial, sans-serif;">
//                                     <h4 style="margin: 0 0 4px 0; color: ${props.color || color};">${props.name || pointName}</h4>
//                                     ${props.chainage ? `<p style="margin: 2px 0; font-size: 11px;"><strong>Chainage:</strong> ${props.chainage}</p>` : ''}
//                                     ${props.description ? `<p style="margin: 2px 0; font-size: 11px;"><strong>Type:</strong> ${props.description}</p>` : ''}
//                                     ${props.length ? `<p style="margin: 2px 0; font-size: 11px;"><strong>Length:</strong> ${props.length}</p>` : ''}
//                                     ${props.detail ? `<p style="margin: 2px 0; font-size: 11px;"><strong>Structure:</strong> ${props.detail}</p>` : ''}
//                                 </div>
//                             `;

//                             const popupElement = document.createElement('div');
//                             popupElement.innerHTML = popupContent;
//                             popupElement.style.cssText = `
//                                 background: white;
//                                 padding: 10px;
//                                 border-radius: 8px;
//                                 box-shadow: 0 2px 8px rgba(0,0,0,0.15);
//                                 border: 1px solid #ddd;
//                                 max-width: 300px;
//                                 position: absolute;
//                                 transform: translate(-50%, -100%);
//                                 margin-top: -10px;
//                                 z-index: 1000;
//                             `;

//                             document.querySelectorAll('.ol-custom-popup').forEach(el => el.remove());
//                             popupElement.className = 'ol-custom-popup';
//                             document.body.appendChild(popupElement);

//                             const pixel = event.pixel;
//                             popupElement.style.left = pixel[0] + 'px';
//                             popupElement.style.top = pixel[1] + 'px';

//                             setTimeout(() => {
//                                 map.once('click', function () {
//                                     popupElement.remove();
//                                 });
//                             }, 100);
//                         }
//                     });

//                     map.addLayer(markerLayer);
//                     flyoverMarkersRef.current.push(markerLayer);
//                 }
//             }
//         });

//         flyoversAddedRef.current = true;
//         log(`✅ Added ${flyovers.length} flyover layers with ${flyoverMarkersRef.current.length} marker layers`);
//     }, [flyovers]);

//     // ---- Handle active state ----
//     useEffect(() => {
//         if (!mapRef.current || !isMapReadyRef.current) return;

//         if (!isActive) {
//             log("🔴 Flood inactive - removing flyovers only");

//             flyoverLayersRef.current.forEach(layer => {
//                 if (mapRef.current) {
//                     mapRef.current.removeLayer(layer);
//                 }
//             });
//             flyoverLayersRef.current = [];

//             flyoverMarkersRef.current.forEach(layer => {
//                 if (mapRef.current) {
//                     mapRef.current.removeLayer(layer);
//                 }
//             });
//             flyoverMarkersRef.current = [];

//             flyoversAddedRef.current = false;
//             return;
//         }

//         if (isActive && !flyoversAddedRef.current && flyovers && flyovers.length > 0) {
//             log("🟢 Flood active - adding flyovers");
//             addFlyoverLayers(mapRef.current);
//         }
//     }, [isActive, flyovers, addFlyoverLayers]);

//     // ---- Add flyovers when flyover data changes ----
//     useEffect(() => {
//         if (!mapRef.current || !isActive) return;
//         if (!flyovers || flyovers.length === 0) return;

//         flyoversAddedRef.current = false;
//         addFlyoverLayers(mapRef.current);
//     }, [flyovers, isActive, addFlyoverLayers]);

//     // ---- Force resize when active ----
//     useEffect(() => {
//         if (!isActive || !mapRef.current) return;
//         const map = mapRef.current;

//         const raf = requestAnimationFrame(() => {
//             map.updateSize();
//         });

//         return () => cancelAnimationFrame(raf);
//     }, [isActive]);

//     // ---- Fullscreen handler ----
//     useEffect(() => {
//         const handleFullscreenChange = () => {
//             setIsFullscreen(!!document.fullscreenElement);
//             setTimeout(() => {
//                 if (mapRef.current) {
//                     mapRef.current.updateSize();
//                 }
//             }, 200);
//         };
//         document.addEventListener("fullscreenchange", handleFullscreenChange);
//         return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
//     }, []);

//     const toggleFullscreen = useCallback(() => {
//         if (!document.fullscreenElement) {
//             fullscreenContainerRef.current?.requestFullscreen?.();
//         } else {
//             document.exitFullscreen?.();
//         }
//     }, []);

//     return (
//         <div className="flex flex-col h-full" ref={fullscreenContainerRef}>
//             <div className="flex-1 min-h-0 relative rounded-lg overflow-hidden border border-gray-200">
//                 <div ref={mapContainerRef} className="absolute inset-0" />

//                 {isLayerAdded && <FloodLegend />}

//                 <div className="absolute top-3 right-3 z-[500]">
//                     <FullscreenButton isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
//                 </div>

//                 {/* Debug Controls */}
//                 <div className="absolute top-3 left-3 z-[500] bg-white/95 p-2 rounded-md shadow-md text-xs">
//                     <div className="font-semibold mb-1">WMS Debug</div>
//                     <button
//                         onClick={() => {
//                             const layers = window.__map?.getLayers();
//                             if (layers) {
//                                 for (let i = 0; i < layers.getLength(); i++) {
//                                     const layer = layers.item(i);
//                                     if (layer.getProperties().name?.includes('WMS')) {
//                                         const visible = layer.getVisible();
//                                         layer.setVisible(!visible);
//                                         console.log(`${layer.getProperties().name} toggled to ${!visible}`);
//                                     }
//                                 }
//                             }
//                         }}
//                         className="bg-blue-500 text-white px-2 py-1 rounded text-xs mb-1 hover:bg-blue-600"
//                     >
//                         Toggle WMS Layers
//                     </button>
//                     <div className="text-gray-600 text-[10px]">
//                         Check console for debug info
//                     </div>
//                 </div>

//                 {(loading || flyoversLoading) && (
//                     <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-[500]">
//                         <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-xl shadow-lg border border-gray-200">
//                             <Loader2 size={32} className="text-blue-600 animate-spin" />
//                             <p className="text-sm text-gray-700 font-medium">
//                                 {loading ? "Loading flood data..." : "Loading flyover data..."}
//                             </p>
//                         </div>
//                     </div>
//                 )}

//                 {error && (
//                     <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-center gap-2 shadow-lg max-w-md">
//                         <AlertTriangle size={16} className="flex-shrink-0" />
//                         <span>{error}</span>
//                     </div>
//                 )}
//             </div>
//         </div>
//     );
// }









// // src/components/FloodMap.jsx
// import { useEffect, useRef, useState, useCallback } from "react";
// import L from "leaflet";
// import "leaflet/dist/leaflet.css";
// import { Loader2, AlertTriangle, Maximize, Minimize, Droplets } from "lucide-react";
// import { useFlyoverData } from "../hooks/useFlyoverData";
// import {
//     getFlyoverColor,
//     getFlyoverDisplayName,
//     makeFlyoverIcon,
//     formatPointName,
// } from "./map/mapHelpers";

// const DEBUG = true;
// const log = (...args) => DEBUG && console.log("[FloodMap]", ...args);
// const logError = (...args) => console.error("[FloodMap]", ...args);

// // WMS Configuration
// const WMS_URL = "https://mlinfomap.biz/geoserver/NHAI/wms";
// const WMS_LAYER = "NHAI:2017";
// const DEFAULT_FLOOD_MAP_CENTER = [30.3, 76.7];

// const FLOOD_COLORS = {
//     value1: { color: [240, 240, 240], label: "Low" },
//     value2: { color: [180, 180, 180], label: "Moderate" },
//     value3: { color: [120, 120, 120], label: "High" },
//     value4: { color: [60, 60, 60], label: "Very High" },
//     value5: { color: [20, 20, 20], label: "Extreme" },
// };

// function FullscreenButton({ isFullscreen, onToggle }) {
//     return (
//         <button
//             onClick={onToggle}
//             className={`flex items-center justify-center w-[30px] h-[30px] bg-white rounded-md shadow-md border border-gray-200 transition-all duration-200 hover:bg-gray-50 hover:shadow-lg ${isFullscreen ? 'bg-blue-50 border-blue-300 text-blue-600' : 'text-gray-700'}`}
//             aria-label="Toggle fullscreen"
//         >
//             {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
//         </button>
//     );
// }

// function FloodLegend() {
//     return (
//         <div className="absolute bottom-3 right-3 z-[500] bg-white/95 backdrop-blur-sm rounded-md shadow-md border border-gray-200 px-3 py-2 max-w-[180px]">
//             <div className="text-[11px] font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
//                 <Droplets size={14} className="text-blue-500" />
//                 Flood Risk
//             </div>
//             <div className="flex flex-col gap-1">
//                 <div className="flex items-center gap-2">
//                     <span className="w-3 h-3 rounded-sm flex-shrink-0 border border-gray-200" style={{ backgroundColor: `rgb(${FLOOD_COLORS.value1.color.join(',')})` }} />
//                     <span className="text-[10px] text-gray-600 leading-tight">Low</span>
//                 </div>
//                 <div className="flex items-center gap-2">
//                     <span className="w-3 h-3 rounded-sm flex-shrink-0 border border-gray-200" style={{ backgroundColor: `rgb(${FLOOD_COLORS.value2.color.join(',')})` }} />
//                     <span className="text-[10px] text-gray-600 leading-tight">Moderate</span>
//                 </div>
//                 <div className="flex items-center gap-2">
//                     <span className="w-3 h-3 rounded-sm flex-shrink-0 border border-gray-200" style={{ backgroundColor: `rgb(${FLOOD_COLORS.value3.color.join(',')})` }} />
//                     <span className="text-[10px] text-gray-600 leading-tight">High</span>
//                 </div>
//                 <div className="flex items-center gap-2">
//                     <span className="w-3 h-3 rounded-sm flex-shrink-0 border border-gray-200" style={{ backgroundColor: `rgb(${FLOOD_COLORS.value4.color.join(',')})` }} />
//                     <span className="text-[10px] text-gray-600 leading-tight">Very High</span>
//                 </div>
//                 <div className="flex items-center gap-2">
//                     <span className="w-3 h-3 rounded-sm flex-shrink-0 border border-gray-200" style={{ backgroundColor: `rgb(${FLOOD_COLORS.value5.color.join(',')})` }} />
//                     <span className="text-[10px] text-gray-600 leading-tight">Extreme</span>
//                 </div>
//             </div>
//         </div>
//     );
// }

// export default function FloodMap({ mapCenter = DEFAULT_FLOOD_MAP_CENTER, isActive = true }) {
//     const FLOOD_MAP_ZOOM = 10;

//     const mapContainerRef = useRef(null);
//     const mapRef = useRef(null);
//     const floodLayerRef = useRef(null);
//     const flyoverLayersRef = useRef([]);
//     const flyoverMarkersRef = useRef([]);
//     const flyoversAddedRef = useRef(false);
//     const isMapReadyRef = useRef(false);

//     const [loading, setLoading] = useState(true);
//     const [error, setError] = useState(null);
//     const [isFullscreen, setIsFullscreen] = useState(false);
//     const [isLayerAdded, setIsLayerAdded] = useState(false);

//     const { flyovers, loading: flyoversLoading } = useFlyoverData();

//     const fullscreenContainerRef = useRef(null);

//     // ---- Initialize map exactly once ----
//     useEffect(() => {
//         if (!mapContainerRef.current) return;

//         if (mapRef.current) {
//             mapRef.current.remove();
//             mapRef.current = null;
//             setIsLayerAdded(false);
//             isMapReadyRef.current = false;
//         }

//         log("🗺️ Initializing Flood map");

//         const map = L.map(mapContainerRef.current, {
//             //  crs: L.CRS.EPSG4326,
//             center: mapCenter,
//             zoom: FLOOD_MAP_ZOOM,
//             zoomControl: true,
//             attributionControl: false,
//         });

//         // Base layers
//         const streetLayer = L.tileLayer("https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
//             subdomains: ["mt0", "mt1", "mt2", "mt3"],
//             maxZoom: 20,
//             attribution: "",
//         });

//         const satelliteLayer = L.tileLayer("https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
//             subdomains: ["mt0", "mt1", "mt2", "mt3"],
//             maxZoom: 20,
//             attribution: "",
//         });
//         L.tileLayer(
//             "http://192.168.1.28:8877/tiles/{z}/{x}/{y}.png",
//             {

//             }
//         ).addTo(map);

//         // ✅ FIX: Add street layer FIRST
//         // streetLayer.addTo(map);

//         // ✅ Then add WMS Raster Layer on top
//         const rasterLayer = L.tileLayer.wms(
//             WMS_URL,
//             {
//                 layers: WMS_LAYER,
//                 format: "image/png",
//                 transparent: true,
//                 opacity: 1,
//                 // Add zIndex to ensure it's on top
//                 zIndex: 10,
//                 // Add version and SRS for better compatibility
//                 version: "1.1.0",
//                 // srs: "EPSG:4326",

//             }
//         );

//         rasterLayer.addTo(map);

//         // Store reference for debugging
//         floodLayerRef.current = rasterLayer;

//         L.control.attribution({ position: "bottomright", prefix: false }).addTo(map);
//         L.control.layers(
//             { "Streets": streetLayer, "Satellite": satelliteLayer },
//             null,
//             { position: 'topleft', collapsed: true }
//         ).addTo(map);

//         mapRef.current = map;
//         isMapReadyRef.current = true;
//         setIsLayerAdded(true);
//         setLoading(false);
//         flyoversAddedRef.current = false;

//         // Force map to render correctly
//         setTimeout(() => {
//             map.invalidateSize();
//         }, 100);

//         const resizeObserver = new ResizeObserver(() => {
//             map.invalidateSize();
//         });
//         if (mapContainerRef.current) {
//             resizeObserver.observe(mapContainerRef.current);
//         }

//         // Add flyovers after map is ready
//         if (flyovers && flyovers.length > 0) {
//             log("🛣️ Adding flyovers on map init");
//             setTimeout(() => {
//                 addFlyoverLayers(map);
//             }, 300);
//         }

//         return () => {
//             resizeObserver.disconnect();
//             if (mapRef.current) {
//                 mapRef.current.remove();
//                 mapRef.current = null;
//             }
//             setIsLayerAdded(false);
//             flyoversAddedRef.current = false;
//             isMapReadyRef.current = false;
//         };
//     }, [mapCenter]);

//     // ---- Add flyover layers ----
//     const addFlyoverLayers = useCallback((map) => {
//         if (!flyovers || flyovers.length === 0) {
//             log("ℹ️ No flyovers to add");
//             return;
//         }

//         if (flyoversAddedRef.current) {
//             log("ℹ️ Flyovers already added");
//             return;
//         }

//         log(`🛣️ Adding ${flyovers.length} flyover layers...`);

//         // Clear existing layers
//         flyoverLayersRef.current.forEach(layer => {
//             if (map.hasLayer(layer)) {
//                 map.removeLayer(layer);
//             }
//         });
//         flyoverLayersRef.current = [];

//         flyoverMarkersRef.current.forEach(marker => {
//             if (map.hasLayer(marker)) {
//                 map.removeLayer(marker);
//             }
//         });
//         flyoverMarkersRef.current = [];

//         flyovers.forEach((flyover, index) => {
//             const color = getFlyoverColor(index);
//             const displayName = getFlyoverDisplayName(flyover.type, index);

//             log(`  📍 Adding flyover ${index + 1}: ${displayName}`);

//             if (flyover.geojson) {
//                 try {
//                     const layer = L.geoJSON(flyover.geojson, {
//                         style: {
//                             color: color,
//                             weight: 3,
//                             opacity: 0.8,
//                             fillColor: color,
//                             fillOpacity: 0.2,
//                         },
//                         // Ensure flyovers are on top of raster
//                         zIndex: 20,
//                     });

//                     layer.addTo(map);
//                     flyoverLayersRef.current.push(layer);
//                     log(`    ✅ GeoJSON layer added`);
//                 } catch (err) {
//                     logError(`Error adding flyover layer for ${displayName}:`, err);
//                 }
//             }

//             if (flyover.namedPoints && flyover.namedPoints.length > 0) {
//                 log(`    📍 Adding ${flyover.namedPoints.length} markers`);
//                 flyover.namedPoints.forEach((point) => {
//                     try {
//                         const pointName = formatPointName(point.name);
//                         const icon = makeFlyoverIcon({
//                             color: color,
//                             labelText: pointName,
//                             detailed: false,
//                             name: pointName,
//                             detailFields: [],
//                         });

//                         const marker = L.marker(point.latlng, {
//                             icon: icon,
//                             riseOnHover: true,
//                             zIndexOffset: 100, // Ensure markers are on top
//                         });

//                         marker.bindPopup(`
//                             <div style="padding: 8px; font-family: Arial, sans-serif;">
//                                 <h4 style="margin: 0 0 4px 0; color: ${color};">${pointName}</h4>
//                                 ${point.chainage ? `<p style="margin: 2px 0; font-size: 11px;"><strong>Chainage:</strong> ${point.chainage}</p>` : ''}
//                                 ${point.description ? `<p style="margin: 2px 0; font-size: 11px;"><strong>Type:</strong> ${point.description}</p>` : ''}
//                                 ${point.length ? `<p style="margin: 2px 0; font-size: 11px;"><strong>Length:</strong> ${point.length}</p>` : ''}
//                                 ${point.detail ? `<p style="margin: 2px 0; font-size: 11px;"><strong>Structure:</strong> ${point.detail}</p>` : ''}
//                             </div>
//                         `);

//                         marker.addTo(map);
//                         flyoverMarkersRef.current.push(marker);
//                     } catch (err) {
//                         logError(`Error adding marker for ${point.name}:`, err);
//                     }
//                 });
//             }
//         });

//         flyoversAddedRef.current = true;
//         log(`✅ Added ${flyovers.length} flyover layers with ${flyoverMarkersRef.current.length} markers`);
//     }, [flyovers]);

//     // ---- Handle active state ----
//     useEffect(() => {
//         if (!mapRef.current || !isMapReadyRef.current) return;

//         // When inactive, remove everything EXCEPT the base raster layer
//         if (!isActive) {
//             log("🔴 Flood inactive - removing flyovers only");

//             // Remove only flyovers, keep the WMS raster layer
//             flyoverLayersRef.current.forEach(layer => {
//                 if (mapRef.current.hasLayer(layer)) {
//                     mapRef.current.removeLayer(layer);
//                 }
//             });
//             flyoverLayersRef.current = [];

//             flyoverMarkersRef.current.forEach(marker => {
//                 if (mapRef.current.hasLayer(marker)) {
//                     mapRef.current.removeLayer(marker);
//                 }
//             });
//             flyoverMarkersRef.current = [];

//             flyoversAddedRef.current = false;
//             return;
//         }

//         // When active, add flyovers if not present
//         if (isActive && !flyoversAddedRef.current && flyovers && flyovers.length > 0) {
//             log("🟢 Flood active - adding flyovers");
//             addFlyoverLayers(mapRef.current);
//         }
//     }, [isActive, flyovers, addFlyoverLayers]);

//     // ---- Add flyovers when flyover data changes ----
//     useEffect(() => {
//         if (!mapRef.current || !isActive) return;
//         if (!flyovers || flyovers.length === 0) return;

//         flyoversAddedRef.current = false;
//         addFlyoverLayers(mapRef.current);
//     }, [flyovers, isActive, addFlyoverLayers]);

//     // ---- Force resize when active ----
//     useEffect(() => {
//         if (!isActive || !mapRef.current) return;
//         const map = mapRef.current;

//         const raf = requestAnimationFrame(() => {
//             map.invalidateSize();
//         });

//         return () => cancelAnimationFrame(raf);
//     }, [isActive]);

//     // ---- Fullscreen handler ----
//     useEffect(() => {
//         const handleFullscreenChange = () => {
//             setIsFullscreen(!!document.fullscreenElement);
//             setTimeout(() => {
//                 if (mapRef.current) {
//                     mapRef.current.invalidateSize();
//                 }
//             }, 200);
//         };
//         document.addEventListener("fullscreenchange", handleFullscreenChange);
//         return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
//     }, []);

//     const toggleFullscreen = useCallback(() => {
//         if (!document.fullscreenElement) {
//             fullscreenContainerRef.current?.requestFullscreen?.();
//         } else {
//             document.exitFullscreen?.();
//         }
//     }, []);

//     return (
//         <div className="flex flex-col h-full" ref={fullscreenContainerRef}>
//             <div className="flex-1 min-h-0 relative rounded-lg overflow-hidden border border-gray-200">
//                 <div ref={mapContainerRef} className="absolute inset-0" />

//                 {isLayerAdded && <FloodLegend />}

//                 <div className="absolute top-3 right-3 z-[500]">
//                     <FullscreenButton isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
//                 </div>

//                 {(loading || flyoversLoading) && (
//                     <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-[500]">
//                         <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-xl shadow-lg border border-gray-200">
//                             <Loader2 size={32} className="text-blue-600 animate-spin" />
//                             <p className="text-sm text-gray-700 font-medium">
//                                 {loading ? "Loading flood data..." : "Loading flyover data..."}
//                             </p>
//                         </div>
//                     </div>
//                 )}

//                 {error && (
//                     <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-center gap-2 shadow-lg max-w-md">
//                         <AlertTriangle size={16} className="flex-shrink-0" />
//                         <span>{error}</span>
//                     </div>
//                 )}
//             </div>
//         </div>
//     );
// }













// // src/components/LandUseLandCover.jsx
// import { useEffect, useRef, useState, useCallback } from "react";
// import L from "leaflet";
// import "leaflet/dist/leaflet.css";
// import parseGeoraster from "georaster";
// import GeoRasterLayer from "georaster-layer-for-leaflet";
// import { Mountain, AlertTriangle, Layers } from "lucide-react";

// const YEARS = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
// const TIF_URL_FOR_YEAR = (year) => `/terrain/${year}.tif`;
// const RASTER_RESOLUTION = 128;

// const LAND_COVER_CLASSES = {
//     1: { name: "Water", color: [26, 91, 171] },
//     2: { name: "Trees", color: [53, 130, 33] },
//     4: { name: "Flooded Vegetation", color: [135, 209, 158] },
//     5: { name: "Crops", color: [255, 219, 92] },
//     7: { name: "Built Area", color: [237, 2, 42] },
//     8: { name: "Bare Ground", color: [237, 233, 228] },
//     9: { name: "Snow/Ice", color: [242, 250, 255] },
//     10: { name: "Clouds", color: [200, 200, 200] },
//     11: { name: "Rangeland", color: [198, 173, 141] },
// };

// const COLOR_LOOKUP = new Map(
//     Object.entries(LAND_COVER_CLASSES).map(([code, cls]) => [
//         Number(code),
//         `rgb(${cls.color[0]},${cls.color[1]},${cls.color[2]})`,
//     ])
// );

// function colorForValue(value) {
//     return COLOR_LOOKUP.get(value) || null;
// }

// function YearSelect({ label, value, onChange }) {
//     return (
//         <div className="flex items-center gap-2">
//             <label className="text-sm text-gray-500 font-medium">{label}</label>
//             <select
//                 value={value}
//                 onChange={(e) => onChange(Number(e.target.value))}
//                 className="border border-gray-200 rounded-md px-2 py-1 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
//             >
//                 {YEARS.map((y) => (
//                     <option key={y} value={y}>{y}</option>
//                 ))}
//             </select>
//         </div>
//     );
// }

// function Legend() {
//     return (
//         <div className="absolute bottom-3 right-3 z-[500] bg-white/90 backdrop-blur-sm rounded-lg shadow-lg px-3 py-2 text-xs space-y-1 max-h-[220px] overflow-y-auto border border-gray-200">
//             <div className="font-semibold text-gray-700 text-[10px] uppercase tracking-wider mb-1">
//                 Land Cover Classes
//             </div>
//             {Object.entries(LAND_COVER_CLASSES).map(([code, cls]) => (
//                 <div key={code} className="flex items-center gap-2">
//                     <span
//                         className="w-3 h-3 rounded-sm inline-block flex-shrink-0 border border-gray-200"
//                         style={{ backgroundColor: `rgb(${cls.color.join(",")})` }}
//                     />
//                     <span className="text-gray-700">{cls.name}</span>
//                 </div>
//             ))}
//         </div>
//     );
// }

// export default function LandUseLandCover({
//     mapCenter = DEFAULT_CENTER,
//     mapZoom = DEFAULT_ZOOM,
//     defaultLeftYear = YEARS[0],
//     defaultRightYear = YEARS[YEARS.length - 1],
//     className = "",
// }) {
//     const mapContainerRef = useRef(null);
//     const mapRef = useRef(null);
//     const leftLayerRef = useRef(null);
//     const rightLayerRef = useRef(null);
//     const hasFitBoundsRef = useRef(false);
//     const layerCacheRef = useRef(new Map());
//     const debounceRef = useRef(null);
//     const hideLoadingTimeoutRef = useRef(null);
//     const requestIdRef = useRef(0);
//     const isMountedRef = useRef(true);
//     const resizeObserverRef = useRef(null);

//     const initialCenterRef = useRef(mapCenter);
//     const initialZoomRef = useRef(mapZoom);

//     const [yearLeft, setYearLeft] = useState(defaultLeftYear);
//     const [yearRight, setYearRight] = useState(defaultRightYear);
//     const [loading, setLoading] = useState(true);
//     const [error, setError] = useState(null);
//     const [preloadedCount, setPreloadedCount] = useState(0);
//     const [showLeftLayer, setShowLeftLayer] = useState(true);
//     const [showRightLayer, setShowRightLayer] = useState(true);

//     // ---- Initialize map exactly once ----
//     useEffect(() => {
//         isMountedRef.current = true;
//         if (mapRef.current || !mapContainerRef.current) return;

//         const map = L.map(mapContainerRef.current, {
//             center: initialCenterRef.current,
//             zoom: initialZoomRef.current,
//             zoomControl: true,
//             attributionControl: false,
//         });

//         L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
//             attribution: "© OpenStreetMap contributors, © CARTO",
//             maxZoom: 19,
//         }).addTo(map);

//         L.control.attribution({ position: "bottomright", prefix: false }).addTo(map);

//         mapRef.current = map;

//         if (typeof ResizeObserver !== "undefined") {
//             resizeObserverRef.current = new ResizeObserver(() => {
//                 map.invalidateSize();
//             });
//             resizeObserverRef.current.observe(mapContainerRef.current);
//         }

//         return () => {
//             isMountedRef.current = false;
//             if (debounceRef.current) clearTimeout(debounceRef.current);
//             if (hideLoadingTimeoutRef.current) clearTimeout(hideLoadingTimeoutRef.current);
//             resizeObserverRef.current?.disconnect();
//             leftLayerRef.current = null;
//             rightLayerRef.current = null;
//             layerCacheRef.current.clear();
//             map.remove();
//             mapRef.current = null;
//         };
//     }, []);

//     // ---- Layer loading with caching ----
//     const getLayer = useCallback((year, signal) => {
//         const cache = layerCacheRef.current;
//         if (cache.has(year)) return cache.get(year);

//         const promise = (async () => {
//             const res = await fetch(TIF_URL_FOR_YEAR(year), { signal });
//             if (!res.ok) {
//                 throw new Error(`Could not load land cover data for ${year} (${res.status})`);
//             }
//             const arrayBuffer = await res.arrayBuffer();
//             const georaster = await parseGeoraster(arrayBuffer);

//             return new GeoRasterLayer({
//                 georaster,
//                 resolution: RASTER_RESOLUTION,
//                 pixelValuesToColorFn: (values) => colorForValue(values[0]),
//                 opacity: 1,
//                 zIndex: 1,
//                 updateWhenIdle: true,
//                 updateWhenZooming: false,
//                 keepBuffer: 2,
//             });
//         })();

//         cache.set(year, promise);
//         promise.catch(() => cache.delete(year));
//         return promise;
//     }, []);

//     // ---- Preload all years ----
//     useEffect(() => {
//         if (!mapRef.current) return;
//         const controller = new AbortController();

//         (async () => {
//             for (const year of YEARS) {
//                 if (controller.signal.aborted) return;
//                 try {
//                     await getLayer(year, controller.signal);
//                 } catch {
//                     // Non-fatal
//                 }
//                 if (!controller.signal.aborted && isMountedRef.current) {
//                     setPreloadedCount((c) => c + 1);
//                 }
//             }
//         })();

//         return () => controller.abort();
//     }, [getLayer]);

//     // ---- Force layer redraw ----
//     const redrawLayers = useCallback((...layers) => {
//         for (const layer of layers) {
//             if (layer && typeof layer.redraw === "function") {
//                 layer.redraw();
//             }
//         }
//     }, []);

//     // ---- Update layers when years change ----
//     useEffect(() => {
//         if (!mapRef.current) return;
//         if (debounceRef.current) clearTimeout(debounceRef.current);

//         const controller = new AbortController();
//         const requestId = ++requestIdRef.current;

//         debounceRef.current = setTimeout(async () => {
//             setLoading(true);
//             setError(null);

//             try {
//                 const [leftLayer, rightLayer] = await Promise.all([
//                     getLayer(yearLeft, controller.signal),
//                     getLayer(yearRight, controller.signal),
//                 ]);

//                 if (requestId !== requestIdRef.current || !isMountedRef.current) return;

//                 const map = mapRef.current;

//                 // Remove old layers
//                 if (leftLayerRef.current && map.hasLayer(leftLayerRef.current)) {
//                     map.removeLayer(leftLayerRef.current);
//                 }
//                 if (rightLayerRef.current && map.hasLayer(rightLayerRef.current)) {
//                     map.removeLayer(rightLayerRef.current);
//                 }

//                 // Add new layers
//                 leftLayer.addTo(map);
//                 rightLayer.addTo(map);

//                 // Force both layers to fully render right away
//                 redrawLayers(leftLayer, rightLayer);

//                 // Second redraw pass after layout settles
//                 requestAnimationFrame(() => {
//                     if (requestId !== requestIdRef.current) return;
//                     redrawLayers(leftLayer, rightLayer);
//                 });

//                 leftLayerRef.current = leftLayer;
//                 rightLayerRef.current = rightLayer;

//                 // Set layer visibility
//                 if (!showLeftLayer && map.hasLayer(leftLayer)) {
//                     map.removeLayer(leftLayer);
//                 }
//                 if (!showRightLayer && map.hasLayer(rightLayer)) {
//                     map.removeLayer(rightLayer);
//                 }

//                 // Fit bounds
//                 if (!hasFitBoundsRef.current) {
//                     const lb = leftLayer.getBounds?.();
//                     const rb = rightLayer.getBounds?.();
//                     if (lb && rb) {
//                         map.fitBounds(lb.extend(rb));
//                         hasFitBoundsRef.current = true;
//                     }
//                 }

//                 // Handle loading state
//                 let loadedCount = 0;
//                 const onTileLoad = () => {
//                     loadedCount += 1;
//                     if (loadedCount >= 2 && isMountedRef.current && requestId === requestIdRef.current) {
//                         setLoading(false);
//                     }
//                 };
//                 leftLayer.once("load", onTileLoad);
//                 rightLayer.once("load", onTileLoad);

//                 if (hideLoadingTimeoutRef.current) clearTimeout(hideLoadingTimeoutRef.current);
//                 hideLoadingTimeoutRef.current = setTimeout(() => {
//                     if (isMountedRef.current && requestId === requestIdRef.current) setLoading(false);
//                 }, 800);

//                 map.invalidateSize();
//             } catch (err) {
//                 if (err?.name === "AbortError") return;
//                 if (isMountedRef.current && requestId === requestIdRef.current) {
//                     setError(err?.message || "Failed to load terrain data.");
//                     setLoading(false);
//                 }
//             }
//         }, 100);

//         return () => {
//             clearTimeout(debounceRef.current);
//             controller.abort();
//         };
//     }, [yearLeft, yearRight, getLayer, redrawLayers, showLeftLayer, showRightLayer]);

//     // ---- Toggle layer visibility ----
//     const toggleLeftLayer = useCallback(() => {
//         const map = mapRef.current;
//         if (!map) return;
//         const layer = leftLayerRef.current;
//         if (!layer) return;

//         if (showLeftLayer && map.hasLayer(layer)) {
//             map.removeLayer(layer);
//             setShowLeftLayer(false);
//         } else if (!showLeftLayer && !map.hasLayer(layer)) {
//             layer.addTo(map);
//             redrawLayers(layer);
//             setShowLeftLayer(true);
//         }
//     }, [showLeftLayer, redrawLayers]);

//     const toggleRightLayer = useCallback(() => {
//         const map = mapRef.current;
//         if (!map) return;
//         const layer = rightLayerRef.current;
//         if (!layer) return;

//         if (showRightLayer && map.hasLayer(layer)) {
//             map.removeLayer(layer);
//             setShowRightLayer(false);
//         } else if (!showRightLayer && !map.hasLayer(layer)) {
//             layer.addTo(map);
//             redrawLayers(layer);
//             setShowRightLayer(true);
//         }
//     }, [showRightLayer, redrawLayers]);

//     return (
//         <div className={`flex flex-col h-full ${className}`}>
//             <div className="flex flex-wrap items-center justify-between gap-3 mb-2 px-1">
//                 <div className="flex items-center gap-2">
//                     <Mountain size={18} className="text-blue-600" />
//                     <span className="font-semibold text-gray-700">Land Cover Comparison</span>
//                     {preloadedCount < YEARS.length && (
//                         <span className="text-[10px] text-gray-400">
//                             (preloading {preloadedCount}/{YEARS.length})
//                         </span>
//                     )}
//                 </div>
//                 <div className="flex items-center gap-4">
//                     <YearSelect label="Left" value={yearLeft} onChange={setYearLeft} />
//                     <YearSelect label="Right" value={yearRight} onChange={setYearRight} />
//                 </div>
//             </div>

//             {/* Layer Toggle Controls - Debug purpose */}
//             <div className="flex items-center gap-2 mb-2 px-1">
//                 <div className="flex items-center gap-2 bg-white rounded-lg shadow-sm border border-gray-200 px-3 py-1.5">
//                     <span className="text-xs text-gray-500 font-medium">Show:</span>
//                     <button
//                         onClick={toggleLeftLayer}
//                         className={`text-xs px-2 py-0.5 rounded transition-colors ${showLeftLayer
//                             ? 'bg-blue-100 text-blue-700'
//                             : 'bg-gray-100 text-gray-400'
//                             }`}
//                     >
//                         Left ({yearLeft})
//                     </button>
//                     <button
//                         onClick={toggleRightLayer}
//                         className={`text-xs px-2 py-0.5 rounded transition-colors ${showRightLayer
//                             ? 'bg-blue-100 text-blue-700'
//                             : 'bg-gray-100 text-gray-400'
//                             }`}
//                     >
//                         Right ({yearRight})
//                     </button>
//                 </div>
//             </div>

//             <div className="flex-1 min-h-0 relative rounded-lg overflow-hidden border border-gray-200">
//                 <div ref={mapContainerRef} className="absolute inset-0" />

//                 {loading && (
//                     <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm z-[500]">
//                         <div className="flex flex-col items-center gap-2 bg-white px-5 py-4 rounded-xl shadow-lg border border-gray-200">
//                             <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
//                             <p className="text-xs text-gray-500">Loading {yearLeft} vs {yearRight}</p>
//                         </div>
//                     </div>
//                 )}

//                 {error && (
//                     <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-center gap-2 shadow-lg max-w-md">
//                         <AlertTriangle size={16} className="flex-shrink-0" />
//                         <span>{error}</span>
//                     </div>
//                 )}

//                 <Legend />
//             </div>
//         </div>
//     );
// }

// const DEFAULT_CENTER = [30.3, 76.7];
// const DEFAULT_ZOOM = 12;