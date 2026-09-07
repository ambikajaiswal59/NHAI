// // src/components/LandUseLandCover.jsx
// import { useEffect, useRef, useState, useCallback } from "react";
// import L from "leaflet";
// import "leaflet/dist/leaflet.css";
// import "leaflet-side-by-side";
// import { Loader2, AlertTriangle, Layers, X, Maximize, Minimize, CircleDot, ChevronDown, Calendar } from "lucide-react";
// import { useFlyoverData } from "../hooks/useFlyoverData";
// import { useMovementPoints } from "../hooks/useMovementPoints";
// import {
//     getFlyoverColor,
//     getFlyoverDisplayName,
//     makeFlyoverIcon,
//     formatPointName,
// } from "./map/mapHelpers";

// import MovementPointsChart from "./MovementPointsChart";
// import MovementDiffChart from "./MovementDiffChart";

// const YEARS = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
// const TILE_LAYER_URL = "https://mlinfomap.org/nhaiapi/tiles/{year}/{z}/{x}/{y}.png";

// const DEFAULT_CENTER = [30.3, 76.7];
// const DEFAULT_ZOOM = 10;
// const MIN_ZOOM = 9;
// const MAX_ZOOM = 22;

// // LULC Classes for Legend
// const LULC_CLASSES = [
//     { color: "#055ac5", label: "Water" },
//     { color: "#0b832a", label: "Trees" },
//     { color: "#dae04e", label: "Crop" },
//     { color: "#f14c40", label: "Builtup" },
//     { color: "#ecfff8", label: "Bare Ground" },
//     { color: "#99998f", label: "Rangeland" },
// ];

// function LULCLegend() {
//     return (
//         <div className="absolute bottom-3 right-3 z-[1500] bg-white/95 backdrop-blur-sm rounded-md shadow-md border border-gray-200 px-3 py-2 max-w-[180px]">
//             <div className="text-[11px] font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
//                 Land Cover
//             </div>
//             <div className="flex flex-col gap-1">
//                 {LULC_CLASSES.map((item) => (
//                     <div key={item.label} className="flex items-center gap-2">
//                         <span
//                             className="w-3 h-3 rounded-sm flex-shrink-0 border border-gray-200"
//                             style={{ backgroundColor: item.color }}
//                         />
//                         <span className="text-[10px] text-gray-600 leading-tight">{item.label}</span>
//                     </div>
//                 ))}
//             </div>
//         </div>
//     );
// }

// function YearSelect({ label, value, onChange, disabledYears = [] }) {
//     return (
//         <div className="flex items-center gap-2">
//             <label className="text-sm text-black-700 font-medium">{label}</label>
//             <select
//                 value={value}
//                 onChange={(e) => onChange(Number(e.target.value))}
//                 className="border border-gray-200 rounded-md px-2 py-1 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
//             >
//                 {YEARS.map((y) => {
//                     const isDisabled = disabledYears.includes(y);
//                     return (
//                         <option
//                             key={y}
//                             value={y}
//                             disabled={isDisabled}
//                             className={isDisabled ? 'text-gray-400 bg-gray-100' : 'text-gray-900'}
//                         >
//                             {y} {isDisabled ? '' : ''}
//                         </option>
//                     );
//                 })}
//             </select>
//         </div>
//     );
// }

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

// // Layer Selector Dropdown - Updated with "None" option
// function LayerSelector({ selectedLayer, onLayerChange }) {
//     const [isOpen, setIsOpen] = useState(false);
//     const dropdownRef = useRef(null);

//     useEffect(() => {
//         const handleClickOutside = (event) => {
//             if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
//                 setIsOpen(false);
//             }
//         };
//         document.addEventListener('mousedown', handleClickOutside);
//         return () => document.removeEventListener('mousedown', handleClickOutside);
//     }, []);

//     const getLayerLabel = (layer) => {
//         switch (layer) {
//             case 'velocity': return 'Velocity';
//             case 'difference': return 'Difference';
//             case 'none': return 'None';
//             default: return 'Velocity';
//         }
//     };

//     const getLayerColor = (layer) => {
//         switch (layer) {
//             case 'velocity': return 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200';
//             case 'difference': return 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200';
//             case 'none': return 'bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200';
//             default: return 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200';
//         }
//     };

//     return (
//         <div className="relative flex items-center gap-1.5" ref={dropdownRef}>
//             <span className="text-xs font-medium text-gray-700">Layer:</span>
//             <button
//                 onClick={() => setIsOpen(!isOpen)}
//                 className={`flex items-center justify-between gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200 border min-w-[90px] h-[28px] ${getLayerColor(selectedLayer)}`}
//             >
//                 <span>{getLayerLabel(selectedLayer)}</span>
//                 <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
//             </button>

//             {isOpen && (
//                 <div className="absolute top-full left-[45px] mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1.5 z-[1600] min-w-[120px]">
//                     <button
//                         onClick={() => {
//                             onLayerChange('velocity');
//                             setIsOpen(false);
//                         }}
//                         className={`w-full text-left px-3 py-1.5 hover:bg-gray-50 transition-colors text-xs ${selectedLayer === 'velocity' ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-700'
//                             }`}
//                     >
//                         Velocity
//                     </button>
//                     <button
//                         onClick={() => {
//                             onLayerChange('difference');
//                             setIsOpen(false);
//                         }}
//                         className={`w-full text-left px-3 py-1.5 hover:bg-gray-50 transition-colors text-xs ${selectedLayer === 'difference' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
//                             }`}
//                     >
//                         Difference
//                     </button>
//                     <button
//                         onClick={() => {
//                             onLayerChange('none');
//                             setIsOpen(false);
//                         }}
//                         className={`w-full text-left px-3 py-1.5 hover:bg-gray-50 transition-colors text-xs ${selectedLayer === 'none' ? 'bg-gray-50 text-gray-700 font-medium' : 'text-gray-700'
//                             }`}
//                     >
//                         None
//                     </button>
//                 </div>
//             )}
//         </div>
//     );
// }


// // Updated DateRangeSelector component with higher z-index
// // Updated DateRangeSelector component with better sizing
// function DateRangeSelector({
//     availableDates = [],
//     startDate,
//     endDate,
//     onStartDateChange,
//     onEndDateChange,
//     compact = false
// }) {
//     const [isStartOpen, setIsStartOpen] = useState(false);
//     const [isEndOpen, setIsEndOpen] = useState(false);
//     const startRef = useRef(null);
//     const endRef = useRef(null);

//     useEffect(() => {
//         const handleClickOutside = (event) => {
//             if (startRef.current && !startRef.current.contains(event.target)) {
//                 setIsStartOpen(false);
//             }
//             if (endRef.current && !endRef.current.contains(event.target)) {
//                 setIsEndOpen(false);
//             }
//         };
//         document.addEventListener('mousedown', handleClickOutside);
//         return () => document.removeEventListener('mousedown', handleClickOutside);
//     }, []);

//     const formatDisplayDate = (dateStr) => {
//         if (!dateStr) return 'Select Date';
//         const parts = dateStr.split('-');
//         return `${parts[1]}/${parts[2]}/${parts[0]}`;
//     };

//     // Compact version for inline display - outer container matches LayerSelector height
//     return (
//         <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm px-3 rounded-md border border-blue-200 shadow-sm relative h-[34px]">
//             {/* Start Date */}
//             <div className="relative" ref={startRef}>
//                 <button
//                     onClick={() => setIsStartOpen(!isStartOpen)}
//                     className="flex items-center justify-between gap-1 px-2 py-1 border border-gray-300 rounded bg-white hover:border-blue-400 transition-colors text-xs min-w-[70px]"
//                 >
//                     <span className={startDate ? 'text-gray-800' : 'text-gray-400'}>
//                         {startDate ? formatDisplayDate(startDate) : 'Start'}
//                     </span>
//                     <ChevronDown size={12} className={`text-gray-400 transition-transform ${isStartOpen ? 'rotate-180' : ''}`} />
//                 </button>
//                 {isStartOpen && availableDates.length > 0 && (
//                     <div
//                         className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto min-w-[110px]"
//                         style={{
//                             zIndex: 9999,
//                             position: 'absolute',
//                         }}
//                     >
//                         {availableDates.map((date) => (
//                             <button
//                                 key={date}
//                                 onClick={() => {
//                                     onStartDateChange(date);
//                                     setIsStartOpen(false);
//                                     if (!endDate || endDate < date) {
//                                         onEndDateChange(date);
//                                     }
//                                 }}
//                                 className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 transition-colors ${startDate === date ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'
//                                     }`}
//                             >
//                                 {formatDisplayDate(date)}
//                             </button>
//                         ))}
//                     </div>
//                 )}
//             </div>

//             <span className="text-gray-400 text-xs">→</span>

//             {/* End Date */}
//             <div className="relative" ref={endRef}>
//                 <button
//                     onClick={() => setIsEndOpen(!isEndOpen)}
//                     className="flex items-center justify-between gap-1 px-2 py-1 border border-gray-300 rounded bg-white hover:border-blue-400 transition-colors text-xs min-w-[70px]"
//                 >
//                     <span className={endDate ? 'text-gray-800' : 'text-gray-400'}>
//                         {endDate ? formatDisplayDate(endDate) : 'End'}
//                     </span>
//                     <ChevronDown size={12} className={`text-gray-400 transition-transform ${isEndOpen ? 'rotate-180' : ''}`} />
//                 </button>
//                 {isEndOpen && availableDates.length > 0 && (
//                     <div
//                         className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto min-w-[110px]"
//                         style={{
//                             zIndex: 9999,
//                             position: 'absolute',
//                         }}
//                     >
//                         {availableDates
//                             .filter(date => !startDate || date >= startDate)
//                             .map((date) => (
//                                 <button
//                                     key={date}
//                                     onClick={() => {
//                                         onEndDateChange(date);
//                                         setIsEndOpen(false);
//                                     }}
//                                     className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 transition-colors ${endDate === date ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'
//                                         }`}
//                                 >
//                                     {formatDisplayDate(date)}
//                                 </button>
//                             ))}
//                     </div>
//                 )}
//             </div>
//         </div>
//     );
// }


// export default function LandUseLandCover({
//     mapCenter = DEFAULT_CENTER,
//     mapZoom = DEFAULT_ZOOM,
//     defaultLeftYear = YEARS[0],
//     defaultRightYear = YEARS[YEARS.length - 1],
//     className = "",
//     isActive = true,
// }) {
//     const mapContainerRef = useRef(null);
//     const fullscreenContainerRef = useRef(null);
//     const mapRef = useRef(null);
//     const leftLayerRef = useRef(null);
//     const rightLayerRef = useRef(null);
//     const sideBySideRef = useRef(null);
//     const streetLayerRef = useRef(null);
//     const satelliteLayerRef = useRef(null);
//     const flyoverLayersRef = useRef([]);
//     const flyoverMarkersRef = useRef([]);
//     const movementMarkersRef = useRef([]);

//     // Chart states
//     const [showChart, setShowChart] = useState(false);
//     const [selectedPointForChart, setSelectedPointForChart] = useState(null);
//     const [selectedDetailForChart, setSelectedDetailForChart] = useState(null);

//     // Diff Chart states
//     const [showDiffChart, setShowDiffChart] = useState(false);
//     const [diffPointData, setDiffPointData] = useState(null);
//     const [diffDetailData, setDiffDetailData] = useState(null);
//     const [diffStartDate, setDiffStartDate] = useState('');
//     const [diffEndDate, setDiffEndDate] = useState('');

//     // Layer selection: 'velocity', 'difference', or 'none'
//     const [selectedLayer, setSelectedLayer] = useState('velocity');

//     const tagRef = useRef(null);
//     const dividerLineRef = useRef(null);
//     const rafIdRef = useRef(null);
//     const debounceRef = useRef(null);
//     const dividerReadyTimeoutRef = useRef(null);
//     const resizeObserverRef = useRef(null);
//     const isMountedRef = useRef(true);
//     const isMapReadyRef = useRef(false);
//     const hasFitBoundsRef = useRef(false);
//     const requestIdRef = useRef(0);

//     const [yearLeft, setYearLeft] = useState(defaultLeftYear);
//     const [yearRight, setYearRight] = useState(defaultRightYear);
//     const [loading, setLoading] = useState(true);
//     const [error, setError] = useState(null);
//     const [isDividerReady, setIsDividerReady] = useState(false);
//     const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
//     const [isFullscreen, setIsFullscreen] = useState(false);
//     const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);
//     const [activeLayers, setActiveLayers] = useState(['flyover', 'movement']); // Changed: Add movement by default
//     const [baseLayer, setBaseLayer] = useState('streets');

//     const { flyovers, loading: flyoversLoading } = useFlyoverData();

//     const {
//         points: movementPoints,
//         loading: movementLoading,
//         total: movementTotal,
//         error: movementError,
//         availableDates,
//         selectPoint,
//         selectedPointData,
//         loadingDetail,
//     } = useMovementPoints();

//     // Set default dates when available
//     useEffect(() => {
//         if (availableDates && availableDates.length > 0 && !diffStartDate && !diffEndDate) {
//             setDiffStartDate(availableDates[0]);
//             setDiffEndDate(availableDates[availableDates.length - 1]);
//         }
//     }, [availableDates]);

//     // Log the data to verify it's working
//     useEffect(() => {
//         if (movementPoints && movementPoints.length > 0) {
//             console.log(`✅ Movement Points loaded: ${movementPoints.length} points`);
//             console.log('📊 Sample point:', movementPoints[0]);
//         }
//         if (movementError) {
//             console.error('❌ Movement Points Error:', movementError);
//         }
//         if (availableDates && availableDates.length > 0) {
//             console.log('📅 Available dates:', availableDates);
//         }
//     }, [movementPoints, movementError, availableDates]);

//     // Handle layer change (Velocity, Difference, or None)
//     const handleLayerChange = useCallback((layer) => {
//         console.log('🔄 Layer changed to:', layer);
//         setSelectedLayer(layer);

//         if (layer === 'velocity') {
//             setActiveLayers(prev => {
//                 const newLayers = prev.filter(id => id !== 'difference');
//                 if (!newLayers.includes('movement')) {
//                     newLayers.push('movement');
//                 }
//                 return newLayers;
//             });
//             // Clear diff chart
//             setShowDiffChart(false);
//             setDiffPointData(null);
//             setDiffDetailData(null);
//         } else if (layer === 'difference') {
//             setActiveLayers(prev => {
//                 const newLayers = prev.filter(id => id !== 'movement');
//                 if (!newLayers.includes('difference')) {
//                     newLayers.push('difference');
//                 }
//                 return newLayers;
//             });
//         } else if (layer === 'none') {
//             // Remove movement points from map when None is selected
//             setActiveLayers(prev => {
//                 const newLayers = prev.filter(id => id !== 'movement' && id !== 'difference');
//                 return newLayers;
//             });
//             // Clear any open charts
//             setShowChart(false);
//             setSelectedPointForChart(null);
//             setSelectedDetailForChart(null);
//             setShowDiffChart(false);
//             setDiffPointData(null);
//             setDiffDetailData(null);
//         }
//     }, []);

//     // Add movement point circles to map with hover and click
//     const addMovementPointsToMap = useCallback((map, points) => {
//         if (!points || points.length === 0) return;

//         // Clear existing markers
//         movementMarkersRef.current.forEach(marker => {
//             if (map.hasLayer(marker)) {
//                 map.removeLayer(marker);
//             }
//         });
//         movementMarkersRef.current = [];

//         points.forEach((feature) => {
//             const { id, longitude, latitude, velocity, coherence } = feature.data;

//             const circle = L.circle([latitude, longitude], {
//                 pane: 'movementPane',
//                 radius: 4,
//                 fillColor: '#8a0b68',
//                 color: '#0d0101',
//                 weight: 2,
//                 opacity: 1,
//                 fillOpacity: 0.8,
//             });

//             circle.on('mouseover', function (e) {
//                 this.setStyle({
//                     fillColor: '#ff6b6b',
//                     color: '#ff0000',
//                     weight: 4,
//                     fillOpacity: 0.9,
//                 });

//                 // Show tooltip ONLY when velocity layer is selected
//                 if (selectedLayer === 'velocity') {
//                     const tooltipContent = `
//                     <div style="padding: 2px 6px; font-size: 12px; font-weight: 600; line-height: 1.3;">
//                         Point ID: ${id}<br/>
//                         Velocity: ${velocity} mm/yr
//                     </div>
//                 `;

//                     this.bindTooltip(tooltipContent, {
//                         permanent: false,
//                         direction: 'top',
//                         offset: [0, -10],
//                         className: 'velocity-tooltip',
//                     }).openTooltip();
//                 } else {
//                     // Close any existing tooltip when in difference or none mode
//                     this.closeTooltip();
//                 }
//             });

//             circle.on('mouseout', function (e) {
//                 this.setStyle({
//                     fillColor: '#8a0b68',
//                     color: '#0d0101',
//                     weight: 2,
//                     fillOpacity: 0.8,
//                 });
//                 this.closeTooltip();
//             });

//             circle.on('click', async function (e) {
//                 // Only handle clicks if not in 'none' mode
//                 if (selectedLayer === 'none') return;

//                 try {
//                     this.setStyle({
//                         fillColor: '#ffd93d',
//                         color: '#f59f00',
//                         weight: 4,
//                     });

//                     const detailData = await selectPoint(id);

//                     if (detailData) {
//                         if (selectedLayer === 'difference' && diffStartDate && diffEndDate) {
//                             // Show difference chart
//                             setDiffPointData(feature);
//                             setDiffDetailData(detailData);
//                             setShowDiffChart(true);
//                         } else {
//                             // Show regular movement chart
//                             setSelectedPointForChart(feature);
//                             setSelectedDetailForChart(detailData);
//                             setShowChart(true);
//                         }

//                         this.setStyle({
//                             fillColor: '#8a0b68',
//                             color: '#0d0101',
//                             weight: 2,
//                         });
//                     }
//                 } catch (err) {
//                     console.error('Error fetching point details:', err);
//                     this.setStyle({
//                         fillColor: '#8a0b68',
//                         color: '#0d0101',
//                         weight: 2,
//                     });
//                 }
//             });

//             movementMarkersRef.current.push(circle);
//         });

//         // Only add markers if not in 'none' mode
//         if (selectedLayer !== 'none') {
//             movementMarkersRef.current.forEach(marker => {
//                 marker.addTo(map);
//             });
//         }

//         console.log(`✅ Added ${movementMarkersRef.current.length} movement point circles to map`);
//     }, [selectedLayer, selectPoint, diffStartDate, diffEndDate]);

//     // Update movement points visibility based on selected layer
//     const updateMovementVisibility = useCallback(() => {
//         if (!mapRef.current) return;

//         if (selectedLayer === 'none') {
//             // Remove all movement markers
//             movementMarkersRef.current.forEach(marker => {
//                 if (mapRef.current.hasLayer(marker)) {
//                     mapRef.current.removeLayer(marker);
//                 }
//             });
//         } else {
//             // Add all movement markers
//             movementMarkersRef.current.forEach(marker => {
//                 if (!mapRef.current.hasLayer(marker)) {
//                     marker.addTo(mapRef.current);
//                 }
//             });
//         }
//     }, [selectedLayer]);

//     // Load movement points when data arrives
//     useEffect(() => {
//         if (!mapRef.current || !isActive) return;
//         if (!movementPoints || movementPoints.length === 0) return;

//         setTimeout(() => {
//             try {
//                 addMovementPointsToMap(mapRef.current, movementPoints);
//             } catch (err) {
//                 console.error("[LULC] Error adding movement points:", err);
//             }
//         }, 500);
//     }, [movementPoints, isActive, addMovementPointsToMap]);

//     // Update points when layer changes (to update tooltips and visibility)
//     useEffect(() => {
//         if (mapRef.current && movementPoints && movementPoints.length > 0) {
//             // When switching to 'none', just hide the markers without re-adding
//             if (selectedLayer === 'none') {
//                 updateMovementVisibility();
//             } else {
//                 // Re-add with updated tooltip behavior
//                 addMovementPointsToMap(mapRef.current, movementPoints);
//             }
//         }
//     }, [selectedLayer, diffStartDate, diffEndDate, addMovementPointsToMap, updateMovementVisibility]);

//     const availableLayers = [
//         { id: 'flyover', name: 'Assets', color: '#3B82F6', type: 'overlay' },
//     ];

//     // Track mobile breakpoint
//     useEffect(() => {
//         const handleResize = () => setIsMobile(window.innerWidth <= 1024);
//         window.addEventListener("resize", handleResize);
//         return () => window.removeEventListener("resize", handleResize);
//     }, []);



//     // ---- Remove default browser focus outline on Leaflet interactive shapes ----
//     useEffect(() => {
//         const style = document.createElement('style');
//         style.textContent = `
//         .leaflet-interactive:focus,
//         .leaflet-interactive:focus-visible {
//             outline: none !important;
//         }
//         path.leaflet-interactive:focus {
//             outline: none !important;
//         }
//     `;
//         document.head.appendChild(style);
//         return () => document.head.removeChild(style);
//     }, []);

//     // Fullscreen handler
//     useEffect(() => {
//         const handleFullscreenChange = () => {
//             setIsFullscreen(!!document.fullscreenElement);
//             setTimeout(() => {
//                 try {
//                     if (mapRef.current && mapContainerRef.current) {
//                         if (document.contains(mapContainerRef.current)) {
//                             mapRef.current.invalidateSize();
//                         }
//                     }
//                 } catch (err) {
//                     console.error("[LULC] Error during fullscreen change:", err);
//                 }
//             }, 200);
//         };
//         document.addEventListener("fullscreenchange", handleFullscreenChange);
//         return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
//     }, []);

//     // Update visibility when activeLayers change (flyover only)
//     useEffect(() => {
//         if (mapRef.current) {
//             updateLayerVisibility();
//         }
//     }, [activeLayers]);

//     // ---- Divider handlers ----
//     const handleDividerMove = useCallback(() => {
//         if (rafIdRef.current) return;
//         rafIdRef.current = requestAnimationFrame(() => {
//             rafIdRef.current = null;
//             if (!sideBySideRef.current) return;
//             const pos = sideBySideRef.current.getPosition();
//             const px = `${pos}px`;
//             if (tagRef.current) tagRef.current.style.left = px;
//             if (dividerLineRef.current) dividerLineRef.current.style.left = px;
//         });
//     }, []);

//     // ---- Update layer visibility (flyovers only) ----
//     const updateLayerVisibility = useCallback(() => {
//         if (!mapRef.current) return;

//         if (activeLayers.includes('flyover')) {
//             flyoverLayersRef.current.forEach(layer => {
//                 if (!mapRef.current.hasLayer(layer)) {
//                     mapRef.current.addLayer(layer);
//                 }
//             });
//             flyoverMarkersRef.current.forEach(marker => {
//                 if (!mapRef.current.hasLayer(marker)) {
//                     mapRef.current.addLayer(marker);
//                 }
//             });
//         } else {
//             flyoverLayersRef.current.forEach(layer => {
//                 if (mapRef.current.hasLayer(layer)) {
//                     mapRef.current.removeLayer(layer);
//                 }
//             });
//             flyoverMarkersRef.current.forEach(marker => {
//                 if (mapRef.current.hasLayer(marker)) {
//                     mapRef.current.removeLayer(marker);
//                 }
//             });
//         }
//     }, [activeLayers]);

//     // ---- Handle layer toggling ----
//     const handleLayerToggle = useCallback((layerId) => {
//         setActiveLayers(prev => {
//             if (prev.includes(layerId)) {
//                 return prev.filter(id => id !== layerId);
//             } else {
//                 return [...prev, layerId];
//             }
//         });
//     }, []);

//     // ---- Handle base layer change ----
//     const handleBaseLayerChange = useCallback((layerType) => {
//         setBaseLayer(layerType);
//         if (!mapRef.current) return;

//         try {
//             if (layerType === 'streets') {
//                 if (satelliteLayerRef.current && mapRef.current.hasLayer(satelliteLayerRef.current)) {
//                     mapRef.current.removeLayer(satelliteLayerRef.current);
//                 }
//                 if (streetLayerRef.current && !mapRef.current.hasLayer(streetLayerRef.current)) {
//                     mapRef.current.addLayer(streetLayerRef.current);
//                 }
//             } else if (layerType === 'satellite') {
//                 if (streetLayerRef.current && mapRef.current.hasLayer(streetLayerRef.current)) {
//                     mapRef.current.removeLayer(streetLayerRef.current);
//                 }
//                 if (satelliteLayerRef.current && !mapRef.current.hasLayer(satelliteLayerRef.current)) {
//                     mapRef.current.addLayer(satelliteLayerRef.current);
//                 }
//             }

//             const leftLayer = leftLayerRef.current;
//             const rightLayer = rightLayerRef.current;
//             if (leftLayer && mapRef.current.hasLayer(leftLayer)) {
//                 leftLayer.setZIndex(10);
//             }
//             if (rightLayer && mapRef.current.hasLayer(rightLayer)) {
//                 rightLayer.setZIndex(10);
//             }

//             if (sideBySideRef.current && typeof sideBySideRef.current._updateClip === 'function') {
//                 sideBySideRef.current._updateClip();
//             }
//         } catch (err) {
//             console.error("[LULC] Error switching base layer:", err);
//         }
//     }, []);

//     // ---- Toggle fullscreen ----
//     const toggleFullscreen = useCallback(() => {
//         try {
//             const container = fullscreenContainerRef.current;
//             if (!document.fullscreenElement) {
//                 if (container?.requestFullscreen) {
//                     container.requestFullscreen();
//                 }
//             } else {
//                 if (document.exitFullscreen) {
//                     document.exitFullscreen();
//                 }
//             }
//         } catch (err) {
//             console.error("[LULC] Error toggling fullscreen:", err);
//         }
//     }, []);

//     // ---- Create tile layers for side-by-side comparison ----
//     const createLayers = useCallback(() => {
//         if (!mapRef.current || !isActive) {
//             return;
//         }

//         if (debounceRef.current) clearTimeout(debounceRef.current);

//         const requestId = ++requestIdRef.current;

//         debounceRef.current = setTimeout(() => {
//             setLoading(true);
//             setError(null);

//             try {
//                 const map = mapRef.current;

//                 if (sideBySideRef.current) {
//                     map.removeControl(sideBySideRef.current);
//                     sideBySideRef.current = null;
//                 }
//                 if (leftLayerRef.current && map.hasLayer(leftLayerRef.current)) {
//                     map.removeLayer(leftLayerRef.current);
//                 }
//                 if (rightLayerRef.current && map.hasLayer(rightLayerRef.current)) {
//                     map.removeLayer(rightLayerRef.current);
//                 }

//                 map.invalidateSize();

//                 const leftUrl = TILE_LAYER_URL.replace('{year}', yearLeft);
//                 const leftLayer = L.tileLayer(leftUrl, {
//                     tileSize: 256,
//                     minZoom: MIN_ZOOM,
//                     maxZoom: MAX_ZOOM,
//                     crossOrigin: true,
//                     opacity: 1,
//                     zIndex: 10,
//                 });

//                 const rightUrl = TILE_LAYER_URL.replace('{year}', yearRight);
//                 const rightLayer = L.tileLayer(rightUrl, {
//                     tileSize: 256,
//                     minZoom: MIN_ZOOM,
//                     maxZoom: MAX_ZOOM,
//                     crossOrigin: true,
//                     opacity: 1,
//                     zIndex: 10,
//                 });

//                 leftLayer.addTo(map);
//                 rightLayer.addTo(map);

//                 sideBySideRef.current = L.control
//                     .sideBySide([leftLayer], [rightLayer])
//                     .addTo(map);
//                 sideBySideRef.current.setPosition(0.5);
//                 sideBySideRef.current.on("dividermove", handleDividerMove);

//                 leftLayerRef.current = leftLayer;
//                 rightLayerRef.current = rightLayer;

//                 requestAnimationFrame(() => {
//                     requestAnimationFrame(() => {
//                         if (requestId !== requestIdRef.current) return;
//                         handleDividerMove();
//                     });
//                 });

//                 if (!hasFitBoundsRef.current) {
//                     const bounds = map.getBounds();
//                     if (bounds.isValid()) {
//                         map.fitBounds(bounds);
//                         hasFitBoundsRef.current = true;
//                     }
//                 }

//                 if (dividerReadyTimeoutRef.current) clearTimeout(dividerReadyTimeoutRef.current);
//                 dividerReadyTimeoutRef.current = setTimeout(() => {
//                     if (!isMountedRef.current || requestId !== requestIdRef.current) return;

//                     const pos = sideBySideRef.current?.getPosition() ?? (mapContainerRef.current?.clientWidth ?? 0) / 2;

//                     if (tagRef.current) tagRef.current.style.left = `${pos}px`;
//                     if (dividerLineRef.current) dividerLineRef.current.style.left = `${pos}px`;

//                     setIsDividerReady(true);
//                     setLoading(false);
//                 }, 100);

//                 map.invalidateSize();

//             } catch (err) {
//                 console.error("Error creating tile layers:", err);
//                 if (isMountedRef.current && requestId === requestIdRef.current) {
//                     setError(err?.message || "Failed to load tile layers.");
//                     setLoading(false);
//                 }
//             }
//         }, 100);

//         return () => {
//             clearTimeout(debounceRef.current);
//         };
//     }, [isActive, yearLeft, yearRight, handleDividerMove]);

//     // ---- Add flyover layers ----
//     const addFlyoverLayers = useCallback((map) => {
//         if (!flyovers || flyovers.length === 0) return;

//         try {
//             requestAnimationFrame(() => {
//                 flyoverLayersRef.current.forEach(layer => {
//                     try {
//                         if (map.hasLayer(layer)) {
//                             map.removeLayer(layer);
//                         }
//                     } catch (err) {
//                         console.error("[LULC] Error removing flyover layer:", err);
//                     }
//                 });
//                 flyoverLayersRef.current = [];

//                 flyoverMarkersRef.current.forEach(marker => {
//                     try {
//                         if (map.hasLayer(marker)) {
//                             map.removeLayer(marker);
//                         }
//                     } catch (err) {
//                         console.error("[LULC] Error removing flyover marker:", err);
//                     }
//                 });
//                 flyoverMarkersRef.current = [];

//                 flyovers.forEach((flyover, index) => {
//                     try {
//                         const color = getFlyoverColor(index);
//                         const displayName = getFlyoverDisplayName(flyover.type, index);

//                         if (flyover.geojson) {
//                             try {
//                                 const layer = L.geoJSON(flyover.geojson, {
//                                     style: {
//                                         color: color,
//                                         weight: 3,
//                                         opacity: 0.8,
//                                         fillColor: color,
//                                         fillOpacity: 0.2,
//                                     },
//                                 });
//                                 flyoverLayersRef.current.push(layer);
//                             } catch (err) {
//                                 console.error(`[LULC] Error adding flyover layer for ${displayName}:`, err);
//                             }
//                         }

//                         if (flyover.namedPoints && flyover.namedPoints.length > 0) {
//                             flyover.namedPoints.forEach((point) => {
//                                 try {
//                                     const pointName = formatPointName(point.name);
//                                     const icon = makeFlyoverIcon({
//                                         color: color,
//                                         labelText: pointName,
//                                         detailed: false,
//                                         name: pointName,
//                                         detailFields: [],
//                                     });

//                                     const marker = L.marker(point.latlng, {
//                                         icon: icon,
//                                         riseOnHover: true,
//                                         zIndexOffset: 100,
//                                     });

//                                     const popupContent = `
//                                         <div style="padding: 8px; font-family: Arial, sans-serif;">
//                                             <h4 style="margin: 0 0 4px 0; color: ${color};">${pointName}</h4>
//                                             ${point.chainage ? `<p style="margin: 2px 0; font-size: 11px;"><strong>Chainage:</strong> ${point.chainage}</p>` : ''}
//                                             ${point.description ? `<p style="margin: 2px 0; font-size: 11px;"><strong>Type:</strong> ${point.description}</p>` : ''}
//                                             ${point.length ? `<p style="margin: 2px 0; font-size: 11px;"><strong>Length:</strong> ${point.length}</p>` : ''}
//                                             ${point.detail ? `<p style="margin: 2px 0; font-size: 11px;"><strong>Structure:</strong> ${point.detail}</p>` : ''}
//                                         </div>
//                                     `;

//                                     marker.bindPopup(popupContent, {
//                                         maxWidth: 300,
//                                         autoPan: true,
//                                     });

//                                     flyoverMarkersRef.current.push(marker);
//                                 } catch (err) {
//                                     console.error(`[LULC] Error adding marker for ${point.name}:`, err);
//                                 }
//                             });
//                         }
//                     } catch (err) {
//                         console.error(`[LULC] Error processing flyover ${index}:`, err);
//                     }
//                 });

//                 updateLayerVisibility();
//             });
//         } catch (err) {
//             console.error("[LULC] Error in addFlyoverLayers:", err);
//         }
//     }, [flyovers, updateLayerVisibility]);

//     // ---- Initialize map ----
//     useEffect(() => {
//         isMountedRef.current = true;
//         if (mapRef.current || !mapContainerRef.current) return;

//         try {
//             const map = L.map(mapContainerRef.current, {
//                 center: mapCenter,
//                 zoom: DEFAULT_ZOOM,
//                 minZoom: MIN_ZOOM,
//                 maxZoom: MAX_ZOOM,
//                 zoomControl: true,
//                 attributionControl: false,
//             });

//             const streetLayer = L.tileLayer("https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
//                 subdomains: ["mt0", "mt1", "mt2", "mt3"],
//                 maxZoom: 25,
//                 attribution: "",
//                 zIndex: 1,
//             });

//             const satelliteLayer = L.tileLayer("https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
//                 subdomains: ["mt0", "mt1", "mt2", "mt3"],
//                 maxZoom: 25,
//                 attribution: "",
//                 zIndex: 1,
//             });

//             streetLayerRef.current = streetLayer;
//             satelliteLayerRef.current = satelliteLayer;

//             streetLayer.addTo(map);

//             L.control.attribution({ position: "bottomright", prefix: false }).addTo(map);

//             mapRef.current = map;
//             isMapReadyRef.current = true;

//             map.createPane('movementPane');
//             map.getPane('movementPane').style.zIndex = 550;
//             map.getPane('movementPane').style.pointerEvents = 'auto';

//             const popupPane = map.getPane('popupPane');
//             const mapPaneEl = map.getPane('mapPane');

//             if (popupPane && mapPaneEl && popupPane.parentNode === mapPaneEl) {
//                 map.getContainer().appendChild(popupPane);
//                 popupPane.style.zIndex = '1400';
//                 popupPane.style.pointerEvents = 'none';

//                 const syncPopupPanePosition = () => {
//                     if (popupPane && mapPaneEl) {
//                         popupPane.style.transform = mapPaneEl.style.transform;
//                     }
//                 };
//                 map.on('move zoom viewreset', syncPopupPanePosition);
//                 syncPopupPanePosition();
//             }

//             if (typeof ResizeObserver !== "undefined") {
//                 resizeObserverRef.current = new ResizeObserver(() => {
//                     try {
//                         if (mapRef.current && mapContainerRef.current) {
//                             if (document.contains(mapContainerRef.current)) {
//                                 mapRef.current.invalidateSize();
//                             }
//                         }
//                     } catch (err) {
//                         console.error("[LULC] Error in resize observer:", err);
//                     }
//                 });
//                 resizeObserverRef.current.observe(mapContainerRef.current);
//             }

//             if (flyovers && flyovers.length > 0) {
//                 setTimeout(() => {
//                     try {
//                         addFlyoverLayers(map);
//                     } catch (err) {
//                         console.error("[LULC] Error adding flyover layers:", err);
//                     }
//                 }, 300);
//             }

//             setTimeout(() => {
//                 createLayers();
//             }, 200);

//             return () => {
//                 isMountedRef.current = false;
//                 if (debounceRef.current) clearTimeout(debounceRef.current);
//                 if (dividerReadyTimeoutRef.current) clearTimeout(dividerReadyTimeoutRef.current);
//                 if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
//                 resizeObserverRef.current?.disconnect();
//                 sideBySideRef.current = null;
//                 leftLayerRef.current = null;
//                 rightLayerRef.current = null;
//                 if (mapRef.current) {
//                     try {
//                         mapRef.current.remove();
//                         mapRef.current = null;
//                     } catch (err) {
//                         console.error("[LULC] Error removing map:", err);
//                     }
//                 }
//                 isMapReadyRef.current = false;
//             };

//         } catch (err) {
//             console.error("[LULC] Error initializing map:", err);
//             setError("Failed to initialize map. Please try again.");
//             setLoading(false);
//         }
//     }, []);

//     // ---- Add flyovers when data changes ----
//     useEffect(() => {
//         if (!mapRef.current || !isActive) return;
//         if (!flyovers || flyovers.length === 0) return;

//         setTimeout(() => {
//             try {
//                 addFlyoverLayers(mapRef.current);
//             } catch (err) {
//                 console.error("[LULC] Error adding flyover layers:", err);
//             }
//         }, 500);
//     }, [flyovers, isActive, addFlyoverLayers]);

//     // ---- Recreate layers when year changes ----
//     useEffect(() => {
//         if (!mapRef.current || !isActive) return;
//         createLayers();
//     }, [yearLeft, yearRight, isActive, createLayers]);

//     // ---- Remove layers when inactive ----
//     useEffect(() => {
//         if (!mapRef.current) return;

//         if (!isActive) {
//             if (sideBySideRef.current) {
//                 mapRef.current.removeControl(sideBySideRef.current);
//                 sideBySideRef.current = null;
//             }
//             if (leftLayerRef.current && mapRef.current.hasLayer(leftLayerRef.current)) {
//                 mapRef.current.removeLayer(leftLayerRef.current);
//                 leftLayerRef.current = null;
//             }
//             if (rightLayerRef.current && mapRef.current.hasLayer(rightLayerRef.current)) {
//                 mapRef.current.removeLayer(rightLayerRef.current);
//                 rightLayerRef.current = null;
//             }
//             setIsDividerReady(false);
//         }
//     }, [isActive]);

//     // ---- Force resize when active ----
//     useEffect(() => {
//         if (!isActive || !mapRef.current || !mapContainerRef.current) return;

//         const raf = requestAnimationFrame(() => {
//             try {
//                 if (mapRef.current && mapContainerRef.current) {
//                     if (document.contains(mapContainerRef.current)) {
//                         mapRef.current.invalidateSize();
//                     }
//                 }
//             } catch (err) {
//                 console.error("[LULC] Error invalidating size on active:", err);
//             }
//         });

//         return () => cancelAnimationFrame(raf);
//     }, [isActive]);

//     // Check if difference should be shown
//     const showDifferenceUI = selectedLayer === 'difference';

//     return (
//         <div className={`flex flex-col h-full w-full ${className}`} ref={fullscreenContainerRef} style={{ background: '#ffffff', paddingTop: isFullscreen ? '10px' : '0px', }}>
//             <div
//                 className="flex flex-wrap items-center justify-between gap-3 mb-2 px-3 py-2 rounded-lg relative z-[2000]"
//                 style={{
//                     background: 'linear-gradient(135deg, #e0e7ff 0%, #dbeafe 50%, #ede9fe 100%)',
//                     borderRadius: '10px',
//                     boxShadow: '0 2px 10px rgba(99, 102, 241, 0.1)',
//                     border: '1px solid rgba(99, 102, 241, 0.1)',
//                 }}
//             >
//                 <div className="flex items-center gap-3 flex-wrap">
//                     <span className="font-bold text-black text-md tracking-wide">
//                         Land Cover Comparison
//                     </span>

//                     {/* Layer Selector */}
//                     <LayerSelector
//                         selectedLayer={selectedLayer}
//                         onLayerChange={handleLayerChange}
//                     />

//                     {/* Date Range Selector - Inline when Difference is selected */}
//                     {showDifferenceUI && availableDates.length > 0 && (
//                         <DateRangeSelector
//                             availableDates={availableDates}
//                             startDate={diffStartDate}
//                             endDate={diffEndDate}
//                             onStartDateChange={setDiffStartDate}
//                             onEndDateChange={setDiffEndDate}
//                             compact={true}
//                         />
//                     )}
//                 </div>

//                 <div className="flex items-center gap-4">
//                     <YearSelect label="Left" value={yearLeft} onChange={setYearLeft} disabledYears={[yearRight]} />
//                     <YearSelect label="Right" value={yearRight} onChange={setYearRight} disabledYears={[yearLeft]} />
//                 </div>
//             </div>




//             <div
//                 className="flex-1 min-h-0 relative rounded-lg overflow-hidden border border-gray-200"
//                 style={{
//                     height: isMobile ? "450px" : "100%",
//                     minHeight: isMobile ? "400px" : "auto",
//                 }}
//             >
//                 <div ref={mapContainerRef} className="absolute inset-0" />

//                 {/* Legend */}
//                 {!loading && !error && <LULCLegend />}

//                 {/* Fullscreen Button */}
//                 <div className="absolute top-3 right-3 z-[1500]">
//                     <FullscreenButton isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
//                 </div>

//                 {/* Layer Control */}
//                 {!loading && !error && (
//                     <div
//                         className="absolute left-2.5 z-[1500]"
//                         style={{ top: isMobile ? '140px' : '80px' }}
//                     >
//                         <button
//                             onClick={() => setIsLayerPanelOpen(!isLayerPanelOpen)}
//                             className={`
//                                 flex items-center justify-center w-[34px] h-[34px]
//                                 bg-white rounded-[4px] border-2
//                                 transition-all duration-200 hover:bg-gray-50
//                                 ${isLayerPanelOpen
//                                     ? 'border-blue-500 bg-blue-50 text-blue-600'
//                                     : 'border-gray-400 text-gray-700 hover:border-gray-500'
//                                 }
//                                 focus:outline-none focus:ring-0
//                                 leaflet-bar
//                             `}
//                             style={{ boxShadow: '0 1px 5px rgba(0,0,0,0.1)' }}
//                             aria-label="Toggle layer control"
//                         >
//                             <Layers size={22} />
//                         </button>

//                         {isLayerPanelOpen && (
//                             <div
//                                 className={`
//                                     absolute top-0 left-full ml-2 bg-white rounded-[4px] border-2 border-gray-300
//                                     p-3 min-w-[120px] max-w-[150px]
//                                     ${isMobile ? 'min-w-[120px]' : ''}
//                                     shadow-lg
//                                 `}
//                                 style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.15)' }}
//                             >
//                                 <div className="flex items-center justify-between mb-1 pb-1 border-b border-gray-200">
//                                     <h3 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
//                                         Layers
//                                     </h3>
//                                     <button
//                                         onClick={() => setIsLayerPanelOpen(false)}
//                                         className="text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full p-0.5 transition-all duration-200"
//                                     >
//                                         <X size={16} strokeWidth={3} />
//                                     </button>
//                                 </div>

//                                 {/* Overlay Section - Only Assets */}
//                                 <div>
//                                     <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Overlays</p>
//                                     <div className="flex flex-col gap-1.5">
//                                         {availableLayers.map((layer) => (
//                                             <label
//                                                 key={layer.id}
//                                                 className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:text-blue-600 transition-colors group"
//                                             >
//                                                 <input
//                                                     type="checkbox"
//                                                     checked={activeLayers.includes(layer.id)}
//                                                     onChange={() => handleLayerToggle(layer.id)}
//                                                     className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer transition-all duration-200"
//                                                 />
//                                                 <span className="flex items-center gap-1.5">
//                                                     {layer.name}
//                                                 </span>
//                                             </label>
//                                         ))}
//                                     </div>
//                                 </div>

//                                 {/* Base Map Section */}
//                                 <div className="mt-2 pt-1 border-t border-gray-100">
//                                     <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Base Map</p>
//                                     <div className="flex flex-col gap-1.5">
//                                         <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:text-blue-600 transition-colors">
//                                             <input
//                                                 type="radio"
//                                                 name="baseLayer"
//                                                 checked={baseLayer === 'streets'}
//                                                 onChange={() => handleBaseLayerChange('streets')}
//                                                 className="w-3.5 h-3.5 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
//                                             />
//                                             <span className="flex items-center gap-1.5">Streets</span>
//                                         </label>
//                                         <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:text-blue-600 transition-colors">
//                                             <input
//                                                 type="radio"
//                                                 name="baseLayer"
//                                                 checked={baseLayer === 'satellite'}
//                                                 onChange={() => handleBaseLayerChange('satellite')}
//                                                 className="w-3.5 h-3.5 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
//                                             />
//                                             <span className="flex items-center gap-1.5">Satellite</span>
//                                         </label>
//                                     </div>
//                                 </div>
//                             </div>
//                         )}
//                     </div>
//                 )}

//                 {/* Divider Tag */}
//                 <div
//                     ref={tagRef}
//                     className="absolute bottom-4 pointer-events-none"
//                     style={{
//                         left: "0px",
//                         transform: "translateX(-50%)",
//                         visibility: isDividerReady ? "visible" : "hidden",
//                         zIndex: 400,
//                     }}
//                 >
//                     <div className="flex items-center gap-2 bg-gray-900/80 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg">
//                         <span>{yearLeft}</span>
//                         <span className="text-gray-400">|</span>
//                         <span>{yearRight}</span>
//                     </div>
//                 </div>

//                 {/* Divider Line */}
//                 <div
//                     ref={dividerLineRef}
//                     className="absolute top-0 bottom-0 pointer-events-none"
//                     style={{
//                         left: "0px",
//                         width: "2px",
//                         background: "rgba(59, 130, 246, 0.5)",
//                         transform: "translateX(-50%)",
//                         boxShadow: "0 0 10px rgba(59, 130, 246, 0.3)",
//                         visibility: isDividerReady ? "visible" : "hidden",
//                         zIndex: 399,
//                     }}
//                 />

//                 {/* Loading State */}
//                 {(loading || flyoversLoading || movementLoading) && (
//                     <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm z-[500]">
//                         <div className="flex flex-col items-center gap-2 bg-white px-5 py-4 rounded-xl shadow-lg border border-gray-200">
//                             <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
//                             <p className="text-xs text-gray-500">
//                                 {loading ? "Loading LULC data..." :
//                                     movementLoading ? "Loading movement points..." :
//                                         "Loading flyover data..."}
//                             </p>
//                         </div>
//                     </div>
//                 )}

//                 {/* Error State */}
//                 {(error || movementError) && (
//                     <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-center gap-2 shadow-lg max-w-md">
//                         <AlertTriangle size={16} className="flex-shrink-0" />
//                         <span>{error || movementError}</span>
//                     </div>
//                 )}

//                 {/* Regular Chart */}
//                 {showChart && selectedPointForChart && selectedDetailForChart && (
//                     <MovementPointsChart
//                         pointData={selectedPointForChart}
//                         detailData={selectedDetailForChart}
//                         onClose={() => {
//                             setShowChart(false);
//                             setSelectedPointForChart(null);
//                             setSelectedDetailForChart(null);
//                         }}
//                     />
//                 )}

//                 {/* Difference Chart */}
//                 {showDiffChart && diffPointData && diffDetailData && (
//                     <MovementDiffChart
//                         pointData={diffPointData}
//                         detailData={diffDetailData}
//                         startDate={diffStartDate}
//                         endDate={diffEndDate}
//                         onClose={() => {
//                             setShowDiffChart(false);
//                             setDiffPointData(null);
//                             setDiffDetailData(null);
//                         }}
//                     />
//                 )}
//             </div>
//         </div>
//     );
// }








// // src/components/LandUseLandCover.jsx
// import { useEffect, useRef, useState, useCallback } from "react";
// import L from "leaflet";
// import "leaflet/dist/leaflet.css";
// import "leaflet-side-by-side";
// import { Loader2, AlertTriangle, Layers, X, Maximize, Minimize, CircleDot, ChevronDown, Calendar } from "lucide-react";
// import { useFlyoverData } from "../hooks/useFlyoverData";
// import { useMovementPoints } from "../hooks/useMovementPoints";
// import {
//     getFlyoverColor,
//     getFlyoverDisplayName,
//     makeFlyoverIcon,
//     formatPointName,
// } from "./map/mapHelpers";

// import MovementPointsChart from "./MovementPointsChart";
// import MovementDiffChart from "./MovementDiffChart";

// const YEARS = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
// const TILE_LAYER_URL = "https://mlinfomap.org/nhaiapi/tiles/{year}/{z}/{x}/{y}.png";

// const DEFAULT_CENTER = [30.3, 76.7];
// const DEFAULT_ZOOM = 10;
// const MIN_ZOOM = 9;
// const MAX_ZOOM = 22;

// // LULC Classes for Legend
// const LULC_CLASSES = [
//     { color: "#055ac5", label: "Water" },
//     { color: "#0b832a", label: "Trees" },
//     { color: "#dae04e", label: "Crop" },
//     { color: "#f14c40", label: "Builtup" },
//     { color: "#ecfff8", label: "Bare Ground" },
//     { color: "#99998f", label: "Rangeland" },
// ];

// function LULCLegend() {
//     return (
//         <div className="absolute bottom-3 right-3 z-[1500] bg-white/95 backdrop-blur-sm rounded-md shadow-md border border-gray-200 px-3 py-2 max-w-[180px]">
//             <div className="text-[11px] font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
//                 Land Cover
//             </div>
//             <div className="flex flex-col gap-1">
//                 {LULC_CLASSES.map((item) => (
//                     <div key={item.label} className="flex items-center gap-2">
//                         <span
//                             className="w-3 h-3 rounded-sm flex-shrink-0 border border-gray-200"
//                             style={{ backgroundColor: item.color }}
//                         />
//                         <span className="text-[10px] text-gray-600 leading-tight">{item.label}</span>
//                     </div>
//                 ))}
//             </div>
//         </div>
//     );
// }

// function YearSelect({ label, value, onChange, disabledYears = [] }) {
//     return (
//         <div className="flex items-center gap-2">
//             <label className="text-sm text-black-700 font-medium">{label}</label>
//             <select
//                 value={value}
//                 onChange={(e) => onChange(Number(e.target.value))}
//                 className="border border-gray-200 rounded-md px-2 py-1 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
//             >
//                 {YEARS.map((y) => {
//                     const isDisabled = disabledYears.includes(y);
//                     return (
//                         <option
//                             key={y}
//                             value={y}
//                             disabled={isDisabled}
//                             className={isDisabled ? 'text-gray-400 bg-gray-100' : 'text-gray-900'}
//                         >
//                             {y} {isDisabled ? '' : ''}
//                         </option>
//                     );
//                 })}
//             </select>
//         </div>
//     );
// }

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

// // Layer Selector Dropdown - Reduced size
// function LayerSelector({ selectedLayer, onLayerChange }) {
//     const [isOpen, setIsOpen] = useState(false);
//     const dropdownRef = useRef(null);

//     useEffect(() => {
//         const handleClickOutside = (event) => {
//             if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
//                 setIsOpen(false);
//             }
//         };
//         document.addEventListener('mousedown', handleClickOutside);
//         return () => document.removeEventListener('mousedown', handleClickOutside);
//     }, []);

//     const getLayerLabel = (layer) => {
//         switch (layer) {
//             case 'velocity': return 'Velocity';
//             case 'difference': return 'Difference';
//             default: return 'Velocity';
//         }
//     };

//     return (
//         <div className="relative flex items-center gap-1.5" ref={dropdownRef}>
//             <span className="text-xs font-medium text-gray-700">Layer:</span>
//             <button
//                 onClick={() => setIsOpen(!isOpen)}
//                 className={`flex items-center justify-between gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200 border min-w-[90px] h-[28px] ${selectedLayer === 'difference'
//                     ? 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200'
//                     : 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'
//                     }`}
//             >
//                 <span>{getLayerLabel(selectedLayer)}</span>
//                 <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
//             </button>

//             {isOpen && (
//                 <div className="absolute top-full left-[45px] mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1.5 z-[1600] min-w-[120px]">
//                     <button
//                         onClick={() => {
//                             onLayerChange('velocity');
//                             setIsOpen(false);
//                         }}
//                         className={`w-full text-left px-3 py-1.5 hover:bg-gray-50 transition-colors text-xs ${selectedLayer === 'velocity' ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-700'
//                             }`}
//                     >
//                         Velocity
//                     </button>
//                     <button
//                         onClick={() => {
//                             onLayerChange('difference');
//                             setIsOpen(false);
//                         }}
//                         className={`w-full text-left px-3 py-1.5 hover:bg-gray-50 transition-colors text-xs ${selectedLayer === 'difference' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
//                             }`}
//                     >
//                         Difference
//                     </button>
//                 </div>
//             )}
//         </div>
//     );
// }


// // Updated DateRangeSelector component with higher z-index
// // Updated DateRangeSelector component with better sizing
// function DateRangeSelector({
//     availableDates = [],
//     startDate,
//     endDate,
//     onStartDateChange,
//     onEndDateChange,
//     compact = false
// }) {
//     const [isStartOpen, setIsStartOpen] = useState(false);
//     const [isEndOpen, setIsEndOpen] = useState(false);
//     const startRef = useRef(null);
//     const endRef = useRef(null);

//     useEffect(() => {
//         const handleClickOutside = (event) => {
//             if (startRef.current && !startRef.current.contains(event.target)) {
//                 setIsStartOpen(false);
//             }
//             if (endRef.current && !endRef.current.contains(event.target)) {
//                 setIsEndOpen(false);
//             }
//         };
//         document.addEventListener('mousedown', handleClickOutside);
//         return () => document.removeEventListener('mousedown', handleClickOutside);
//     }, []);

//     const formatDisplayDate = (dateStr) => {
//         if (!dateStr) return 'Select Date';
//         const parts = dateStr.split('-');
//         return `${parts[1]}/${parts[2]}/${parts[0]}`;
//     };

//     // Compact version for inline display - outer container matches LayerSelector height
//     return (
//         <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm px-3 rounded-md border border-blue-200 shadow-sm relative h-[34px]">
//             {/* Start Date */}
//             <div className="relative" ref={startRef}>
//                 <button
//                     onClick={() => setIsStartOpen(!isStartOpen)}
//                     className="flex items-center justify-between gap-1 px-2 py-1 border border-gray-300 rounded bg-white hover:border-blue-400 transition-colors text-xs min-w-[70px]"
//                 >
//                     <span className={startDate ? 'text-gray-800' : 'text-gray-400'}>
//                         {startDate ? formatDisplayDate(startDate) : 'Start'}
//                     </span>
//                     <ChevronDown size={12} className={`text-gray-400 transition-transform ${isStartOpen ? 'rotate-180' : ''}`} />
//                 </button>
//                 {isStartOpen && availableDates.length > 0 && (
//                     <div
//                         className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto min-w-[110px]"
//                         style={{
//                             zIndex: 9999,
//                             position: 'absolute',
//                         }}
//                     >
//                         {availableDates.map((date) => (
//                             <button
//                                 key={date}
//                                 onClick={() => {
//                                     onStartDateChange(date);
//                                     setIsStartOpen(false);
//                                     if (!endDate || endDate < date) {
//                                         onEndDateChange(date);
//                                     }
//                                 }}
//                                 className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 transition-colors ${startDate === date ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'
//                                     }`}
//                             >
//                                 {formatDisplayDate(date)}
//                             </button>
//                         ))}
//                     </div>
//                 )}
//             </div>

//             <span className="text-gray-400 text-xs">→</span>

//             {/* End Date */}
//             <div className="relative" ref={endRef}>
//                 <button
//                     onClick={() => setIsEndOpen(!isEndOpen)}
//                     className="flex items-center justify-between gap-1 px-2 py-1 border border-gray-300 rounded bg-white hover:border-blue-400 transition-colors text-xs min-w-[70px]"
//                 >
//                     <span className={endDate ? 'text-gray-800' : 'text-gray-400'}>
//                         {endDate ? formatDisplayDate(endDate) : 'End'}
//                     </span>
//                     <ChevronDown size={12} className={`text-gray-400 transition-transform ${isEndOpen ? 'rotate-180' : ''}`} />
//                 </button>
//                 {isEndOpen && availableDates.length > 0 && (
//                     <div
//                         className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto min-w-[110px]"
//                         style={{
//                             zIndex: 9999,
//                             position: 'absolute',
//                         }}
//                     >
//                         {availableDates
//                             .filter(date => !startDate || date >= startDate)
//                             .map((date) => (
//                                 <button
//                                     key={date}
//                                     onClick={() => {
//                                         onEndDateChange(date);
//                                         setIsEndOpen(false);
//                                     }}
//                                     className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 transition-colors ${endDate === date ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'
//                                         }`}
//                                 >
//                                     {formatDisplayDate(date)}
//                                 </button>
//                             ))}
//                     </div>
//                 )}
//             </div>
//         </div>
//     );
// }


// export default function LandUseLandCover({
//     mapCenter = DEFAULT_CENTER,
//     mapZoom = DEFAULT_ZOOM,
//     defaultLeftYear = YEARS[0],
//     defaultRightYear = YEARS[YEARS.length - 1],
//     className = "",
//     isActive = true,
// }) {
//     const mapContainerRef = useRef(null);
//     const fullscreenContainerRef = useRef(null);
//     const mapRef = useRef(null);
//     const leftLayerRef = useRef(null);
//     const rightLayerRef = useRef(null);
//     const sideBySideRef = useRef(null);
//     const streetLayerRef = useRef(null);
//     const satelliteLayerRef = useRef(null);
//     const flyoverLayersRef = useRef([]);
//     const flyoverMarkersRef = useRef([]);
//     const movementMarkersRef = useRef([]);

//     // Chart states
//     const [showChart, setShowChart] = useState(false);
//     const [selectedPointForChart, setSelectedPointForChart] = useState(null);
//     const [selectedDetailForChart, setSelectedDetailForChart] = useState(null);

//     // Diff Chart states
//     const [showDiffChart, setShowDiffChart] = useState(false);
//     const [diffPointData, setDiffPointData] = useState(null);
//     const [diffDetailData, setDiffDetailData] = useState(null);
//     const [diffStartDate, setDiffStartDate] = useState('');
//     const [diffEndDate, setDiffEndDate] = useState('');

//     // Layer selection: 'velocity' or 'difference'
//     const [selectedLayer, setSelectedLayer] = useState('velocity');

//     const tagRef = useRef(null);
//     const dividerLineRef = useRef(null);
//     const rafIdRef = useRef(null);
//     const debounceRef = useRef(null);
//     const dividerReadyTimeoutRef = useRef(null);
//     const resizeObserverRef = useRef(null);
//     const isMountedRef = useRef(true);
//     const isMapReadyRef = useRef(false);
//     const hasFitBoundsRef = useRef(false);
//     const requestIdRef = useRef(0);

//     const [yearLeft, setYearLeft] = useState(defaultLeftYear);
//     const [yearRight, setYearRight] = useState(defaultRightYear);
//     const [loading, setLoading] = useState(true);
//     const [error, setError] = useState(null);
//     const [isDividerReady, setIsDividerReady] = useState(false);
//     const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
//     const [isFullscreen, setIsFullscreen] = useState(false);
//     const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);
//     const [activeLayers, setActiveLayers] = useState(['flyover', 'movement']); // Changed: Add movement by default
//     const [baseLayer, setBaseLayer] = useState('streets');

//     const { flyovers, loading: flyoversLoading } = useFlyoverData();

//     const {
//         points: movementPoints,
//         loading: movementLoading,
//         total: movementTotal,
//         error: movementError,
//         availableDates,
//         selectPoint,
//         selectedPointData,
//         loadingDetail,
//     } = useMovementPoints();

//     // Set default dates when available
//     useEffect(() => {
//         if (availableDates && availableDates.length > 0 && !diffStartDate && !diffEndDate) {
//             setDiffStartDate(availableDates[0]);
//             setDiffEndDate(availableDates[availableDates.length - 1]);
//         }
//     }, [availableDates]);

//     // Log the data to verify it's working
//     useEffect(() => {
//         if (movementPoints && movementPoints.length > 0) {
//             console.log(`✅ Movement Points loaded: ${movementPoints.length} points`);
//             console.log('📊 Sample point:', movementPoints[0]);
//         }
//         if (movementError) {
//             console.error('❌ Movement Points Error:', movementError);
//         }
//         if (availableDates && availableDates.length > 0) {
//             console.log('📅 Available dates:', availableDates);
//         }
//     }, [movementPoints, movementError, availableDates]);

//     // Handle layer change (Velocity or Difference)
//     const handleLayerChange = useCallback((layer) => {
//         console.log('🔄 Layer changed to:', layer);
//         setSelectedLayer(layer);

//         // Update active layers based on selection
//         if (layer === 'velocity') {
//             setActiveLayers(prev => {
//                 const newLayers = prev.filter(id => id !== 'difference');
//                 if (!newLayers.includes('movement')) {
//                     newLayers.push('movement');
//                 }
//                 return newLayers;
//             });
//             // Clear diff chart
//             setShowDiffChart(false);
//             setDiffPointData(null);
//             setDiffDetailData(null);
//         } else if (layer === 'difference') {
//             setActiveLayers(prev => {
//                 const newLayers = prev.filter(id => id !== 'movement');
//                 if (!newLayers.includes('difference')) {
//                     newLayers.push('difference');
//                 }
//                 return newLayers;
//             });
//         }
//     }, []);

//     // Add movement point circles to map with hover and click
//     const addMovementPointsToMap = useCallback((map, points) => {
//         if (!points || points.length === 0) return;

//         // Clear existing markers
//         movementMarkersRef.current.forEach(marker => {
//             if (map.hasLayer(marker)) {
//                 map.removeLayer(marker);
//             }
//         });
//         movementMarkersRef.current = [];

//         points.forEach((feature) => {
//             const { id, longitude, latitude, velocity, coherence } = feature.data;

//             const circle = L.circle([latitude, longitude], {
//                 pane: 'movementPane',
//                 radius: 4,
//                 fillColor: '#8a0b68',
//                 color: '#0d0101',
//                 weight: 2,
//                 opacity: 1,
//                 fillOpacity: 0.8,
//             });

//             circle.on('mouseover', function (e) {
//                 this.setStyle({
//                     fillColor: '#ff6b6b',
//                     color: '#ff0000',
//                     weight: 4,
//                     fillOpacity: 0.9,
//                 });

//                 // Show tooltip ONLY when velocity layer is selected
//                 if (selectedLayer === 'velocity') {
//                     const tooltipContent = `
//                     <div style="padding: 2px 6px; font-size: 12px; font-weight: 600; line-height: 1.3;">
//                         Point ID: ${id}<br/>
//                         Velocity: ${velocity} mm/yr
//                     </div>
//                 `;

//                     this.bindTooltip(tooltipContent, {
//                         permanent: false,
//                         direction: 'top',
//                         offset: [0, -10],
//                         className: 'velocity-tooltip',
//                     }).openTooltip();
//                 } else {
//                     // Close any existing tooltip when in difference mode
//                     this.closeTooltip();
//                 }
//             });

//             circle.on('mouseout', function (e) {
//                 this.setStyle({
//                     fillColor: '#8a0b68',
//                     color: '#0d0101',
//                     weight: 2,
//                     fillOpacity: 0.8,
//                 });
//                 this.closeTooltip();
//             });

//             circle.on('click', async function (e) {
//                 try {
//                     this.setStyle({
//                         fillColor: '#ffd93d',
//                         color: '#f59f00',
//                         weight: 4,
//                     });

//                     const detailData = await selectPoint(id);

//                     if (detailData) {
//                         if (selectedLayer === 'difference' && diffStartDate && diffEndDate) {
//                             // Show difference chart
//                             setDiffPointData(feature);
//                             setDiffDetailData(detailData);
//                             setShowDiffChart(true);
//                         } else {
//                             // Show regular movement chart
//                             setSelectedPointForChart(feature);
//                             setSelectedDetailForChart(detailData);
//                             setShowChart(true);
//                         }

//                         this.setStyle({
//                             fillColor: '#8a0b68',
//                             color: '#0d0101',
//                             weight: 2,
//                         });
//                     }
//                 } catch (err) {
//                     console.error('Error fetching point details:', err);
//                     this.setStyle({
//                         fillColor: '#8a0b68',
//                         color: '#0d0101',
//                         weight: 2,
//                     });
//                 }
//             });

//             movementMarkersRef.current.push(circle);
//         });

//         // Always show markers
//         movementMarkersRef.current.forEach(marker => {
//             marker.addTo(map);
//         });

//         console.log(`✅ Added ${movementMarkersRef.current.length} movement point circles to map`);
//     }, [selectedLayer, selectPoint, diffStartDate, diffEndDate]);

//     // Update movement points visibility
//     const updateMovementVisibility = useCallback(() => {
//         if (!mapRef.current) return;

//         // Always show movement markers
//         movementMarkersRef.current.forEach(marker => {
//             if (!mapRef.current.hasLayer(marker)) {
//                 marker.addTo(mapRef.current);
//             }
//         });
//     }, []);

//     // Load movement points when data arrives
//     useEffect(() => {
//         if (!mapRef.current || !isActive) return;
//         if (!movementPoints || movementPoints.length === 0) return;

//         setTimeout(() => {
//             try {
//                 addMovementPointsToMap(mapRef.current, movementPoints);
//             } catch (err) {
//                 console.error("[LULC] Error adding movement points:", err);
//             }
//         }, 500);
//     }, [movementPoints, isActive, addMovementPointsToMap]);

//     // Update points when layer changes (to update tooltips)
//     useEffect(() => {
//         if (mapRef.current && movementPoints && movementPoints.length > 0) {
//             addMovementPointsToMap(mapRef.current, movementPoints);
//         }
//     }, [selectedLayer, diffStartDate, diffEndDate, addMovementPointsToMap]);

//     const availableLayers = [
//         { id: 'flyover', name: 'Assets', color: '#3B82F6', type: 'overlay' },
//     ];

//     // Track mobile breakpoint
//     useEffect(() => {
//         const handleResize = () => setIsMobile(window.innerWidth <= 1024);
//         window.addEventListener("resize", handleResize);
//         return () => window.removeEventListener("resize", handleResize);
//     }, []);



//     // ---- Remove default browser focus outline on Leaflet interactive shapes ----
//     useEffect(() => {
//         const style = document.createElement('style');
//         style.textContent = `
//         .leaflet-interactive:focus,
//         .leaflet-interactive:focus-visible {
//             outline: none !important;
//         }
//         path.leaflet-interactive:focus {
//             outline: none !important;
//         }
//     `;
//         document.head.appendChild(style);
//         return () => document.head.removeChild(style);
//     }, []);

//     // Fullscreen handler
//     useEffect(() => {
//         const handleFullscreenChange = () => {
//             setIsFullscreen(!!document.fullscreenElement);
//             setTimeout(() => {
//                 try {
//                     if (mapRef.current && mapContainerRef.current) {
//                         if (document.contains(mapContainerRef.current)) {
//                             mapRef.current.invalidateSize();
//                         }
//                     }
//                 } catch (err) {
//                     console.error("[LULC] Error during fullscreen change:", err);
//                 }
//             }, 200);
//         };
//         document.addEventListener("fullscreenchange", handleFullscreenChange);
//         return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
//     }, []);

//     // Update visibility when activeLayers change (flyover only)
//     useEffect(() => {
//         if (mapRef.current) {
//             updateLayerVisibility();
//         }
//     }, [activeLayers]);

//     // ---- Divider handlers ----
//     const handleDividerMove = useCallback(() => {
//         if (rafIdRef.current) return;
//         rafIdRef.current = requestAnimationFrame(() => {
//             rafIdRef.current = null;
//             if (!sideBySideRef.current) return;
//             const pos = sideBySideRef.current.getPosition();
//             const px = `${pos}px`;
//             if (tagRef.current) tagRef.current.style.left = px;
//             if (dividerLineRef.current) dividerLineRef.current.style.left = px;
//         });
//     }, []);

//     // ---- Update layer visibility (flyovers only) ----
//     const updateLayerVisibility = useCallback(() => {
//         if (!mapRef.current) return;

//         if (activeLayers.includes('flyover')) {
//             flyoverLayersRef.current.forEach(layer => {
//                 if (!mapRef.current.hasLayer(layer)) {
//                     mapRef.current.addLayer(layer);
//                 }
//             });
//             flyoverMarkersRef.current.forEach(marker => {
//                 if (!mapRef.current.hasLayer(marker)) {
//                     mapRef.current.addLayer(marker);
//                 }
//             });
//         } else {
//             flyoverLayersRef.current.forEach(layer => {
//                 if (mapRef.current.hasLayer(layer)) {
//                     mapRef.current.removeLayer(layer);
//                 }
//             });
//             flyoverMarkersRef.current.forEach(marker => {
//                 if (mapRef.current.hasLayer(marker)) {
//                     mapRef.current.removeLayer(marker);
//                 }
//             });
//         }
//     }, [activeLayers]);

//     // ---- Handle layer toggling ----
//     const handleLayerToggle = useCallback((layerId) => {
//         setActiveLayers(prev => {
//             if (prev.includes(layerId)) {
//                 return prev.filter(id => id !== layerId);
//             } else {
//                 return [...prev, layerId];
//             }
//         });
//     }, []);

//     // ---- Handle base layer change ----
//     const handleBaseLayerChange = useCallback((layerType) => {
//         setBaseLayer(layerType);
//         if (!mapRef.current) return;

//         try {
//             if (layerType === 'streets') {
//                 if (satelliteLayerRef.current && mapRef.current.hasLayer(satelliteLayerRef.current)) {
//                     mapRef.current.removeLayer(satelliteLayerRef.current);
//                 }
//                 if (streetLayerRef.current && !mapRef.current.hasLayer(streetLayerRef.current)) {
//                     mapRef.current.addLayer(streetLayerRef.current);
//                 }
//             } else if (layerType === 'satellite') {
//                 if (streetLayerRef.current && mapRef.current.hasLayer(streetLayerRef.current)) {
//                     mapRef.current.removeLayer(streetLayerRef.current);
//                 }
//                 if (satelliteLayerRef.current && !mapRef.current.hasLayer(satelliteLayerRef.current)) {
//                     mapRef.current.addLayer(satelliteLayerRef.current);
//                 }
//             }

//             const leftLayer = leftLayerRef.current;
//             const rightLayer = rightLayerRef.current;
//             if (leftLayer && mapRef.current.hasLayer(leftLayer)) {
//                 leftLayer.setZIndex(10);
//             }
//             if (rightLayer && mapRef.current.hasLayer(rightLayer)) {
//                 rightLayer.setZIndex(10);
//             }

//             if (sideBySideRef.current && typeof sideBySideRef.current._updateClip === 'function') {
//                 sideBySideRef.current._updateClip();
//             }
//         } catch (err) {
//             console.error("[LULC] Error switching base layer:", err);
//         }
//     }, []);

//     // ---- Toggle fullscreen ----
//     const toggleFullscreen = useCallback(() => {
//         try {
//             const container = fullscreenContainerRef.current;
//             if (!document.fullscreenElement) {
//                 if (container?.requestFullscreen) {
//                     container.requestFullscreen();
//                 }
//             } else {
//                 if (document.exitFullscreen) {
//                     document.exitFullscreen();
//                 }
//             }
//         } catch (err) {
//             console.error("[LULC] Error toggling fullscreen:", err);
//         }
//     }, []);

//     // ---- Create tile layers for side-by-side comparison ----
//     const createLayers = useCallback(() => {
//         if (!mapRef.current || !isActive) {
//             return;
//         }

//         if (debounceRef.current) clearTimeout(debounceRef.current);

//         const requestId = ++requestIdRef.current;

//         debounceRef.current = setTimeout(() => {
//             setLoading(true);
//             setError(null);

//             try {
//                 const map = mapRef.current;

//                 if (sideBySideRef.current) {
//                     map.removeControl(sideBySideRef.current);
//                     sideBySideRef.current = null;
//                 }
//                 if (leftLayerRef.current && map.hasLayer(leftLayerRef.current)) {
//                     map.removeLayer(leftLayerRef.current);
//                 }
//                 if (rightLayerRef.current && map.hasLayer(rightLayerRef.current)) {
//                     map.removeLayer(rightLayerRef.current);
//                 }

//                 map.invalidateSize();

//                 const leftUrl = TILE_LAYER_URL.replace('{year}', yearLeft);
//                 const leftLayer = L.tileLayer(leftUrl, {
//                     tileSize: 256,
//                     minZoom: MIN_ZOOM,
//                     maxZoom: MAX_ZOOM,
//                     crossOrigin: true,
//                     opacity: 1,
//                     zIndex: 10,
//                 });

//                 const rightUrl = TILE_LAYER_URL.replace('{year}', yearRight);
//                 const rightLayer = L.tileLayer(rightUrl, {
//                     tileSize: 256,
//                     minZoom: MIN_ZOOM,
//                     maxZoom: MAX_ZOOM,
//                     crossOrigin: true,
//                     opacity: 1,
//                     zIndex: 10,
//                 });

//                 leftLayer.addTo(map);
//                 rightLayer.addTo(map);

//                 sideBySideRef.current = L.control
//                     .sideBySide([leftLayer], [rightLayer])
//                     .addTo(map);
//                 sideBySideRef.current.setPosition(0.5);
//                 sideBySideRef.current.on("dividermove", handleDividerMove);

//                 leftLayerRef.current = leftLayer;
//                 rightLayerRef.current = rightLayer;

//                 requestAnimationFrame(() => {
//                     requestAnimationFrame(() => {
//                         if (requestId !== requestIdRef.current) return;
//                         handleDividerMove();
//                     });
//                 });

//                 if (!hasFitBoundsRef.current) {
//                     const bounds = map.getBounds();
//                     if (bounds.isValid()) {
//                         map.fitBounds(bounds);
//                         hasFitBoundsRef.current = true;
//                     }
//                 }

//                 if (dividerReadyTimeoutRef.current) clearTimeout(dividerReadyTimeoutRef.current);
//                 dividerReadyTimeoutRef.current = setTimeout(() => {
//                     if (!isMountedRef.current || requestId !== requestIdRef.current) return;

//                     const pos = sideBySideRef.current?.getPosition() ?? (mapContainerRef.current?.clientWidth ?? 0) / 2;

//                     if (tagRef.current) tagRef.current.style.left = `${pos}px`;
//                     if (dividerLineRef.current) dividerLineRef.current.style.left = `${pos}px`;

//                     setIsDividerReady(true);
//                     setLoading(false);
//                 }, 100);

//                 map.invalidateSize();

//             } catch (err) {
//                 console.error("Error creating tile layers:", err);
//                 if (isMountedRef.current && requestId === requestIdRef.current) {
//                     setError(err?.message || "Failed to load tile layers.");
//                     setLoading(false);
//                 }
//             }
//         }, 100);

//         return () => {
//             clearTimeout(debounceRef.current);
//         };
//     }, [isActive, yearLeft, yearRight, handleDividerMove]);

//     // ---- Add flyover layers ----
//     const addFlyoverLayers = useCallback((map) => {
//         if (!flyovers || flyovers.length === 0) return;

//         try {
//             requestAnimationFrame(() => {
//                 flyoverLayersRef.current.forEach(layer => {
//                     try {
//                         if (map.hasLayer(layer)) {
//                             map.removeLayer(layer);
//                         }
//                     } catch (err) {
//                         console.error("[LULC] Error removing flyover layer:", err);
//                     }
//                 });
//                 flyoverLayersRef.current = [];

//                 flyoverMarkersRef.current.forEach(marker => {
//                     try {
//                         if (map.hasLayer(marker)) {
//                             map.removeLayer(marker);
//                         }
//                     } catch (err) {
//                         console.error("[LULC] Error removing flyover marker:", err);
//                     }
//                 });
//                 flyoverMarkersRef.current = [];

//                 flyovers.forEach((flyover, index) => {
//                     try {
//                         const color = getFlyoverColor(index);
//                         const displayName = getFlyoverDisplayName(flyover.type, index);

//                         if (flyover.geojson) {
//                             try {
//                                 const layer = L.geoJSON(flyover.geojson, {
//                                     style: {
//                                         color: color,
//                                         weight: 3,
//                                         opacity: 0.8,
//                                         fillColor: color,
//                                         fillOpacity: 0.2,
//                                     },
//                                 });
//                                 flyoverLayersRef.current.push(layer);
//                             } catch (err) {
//                                 console.error(`[LULC] Error adding flyover layer for ${displayName}:`, err);
//                             }
//                         }

//                         if (flyover.namedPoints && flyover.namedPoints.length > 0) {
//                             flyover.namedPoints.forEach((point) => {
//                                 try {
//                                     const pointName = formatPointName(point.name);
//                                     const icon = makeFlyoverIcon({
//                                         color: color,
//                                         labelText: pointName,
//                                         detailed: false,
//                                         name: pointName,
//                                         detailFields: [],
//                                     });

//                                     const marker = L.marker(point.latlng, {
//                                         icon: icon,
//                                         riseOnHover: true,
//                                         zIndexOffset: 100,
//                                     });

//                                     const popupContent = `
//                                         <div style="padding: 8px; font-family: Arial, sans-serif;">
//                                             <h4 style="margin: 0 0 4px 0; color: ${color};">${pointName}</h4>
//                                             ${point.chainage ? `<p style="margin: 2px 0; font-size: 11px;"><strong>Chainage:</strong> ${point.chainage}</p>` : ''}
//                                             ${point.description ? `<p style="margin: 2px 0; font-size: 11px;"><strong>Type:</strong> ${point.description}</p>` : ''}
//                                             ${point.length ? `<p style="margin: 2px 0; font-size: 11px;"><strong>Length:</strong> ${point.length}</p>` : ''}
//                                             ${point.detail ? `<p style="margin: 2px 0; font-size: 11px;"><strong>Structure:</strong> ${point.detail}</p>` : ''}
//                                         </div>
//                                     `;

//                                     marker.bindPopup(popupContent, {
//                                         maxWidth: 300,
//                                         autoPan: true,
//                                     });

//                                     flyoverMarkersRef.current.push(marker);
//                                 } catch (err) {
//                                     console.error(`[LULC] Error adding marker for ${point.name}:`, err);
//                                 }
//                             });
//                         }
//                     } catch (err) {
//                         console.error(`[LULC] Error processing flyover ${index}:`, err);
//                     }
//                 });

//                 updateLayerVisibility();
//             });
//         } catch (err) {
//             console.error("[LULC] Error in addFlyoverLayers:", err);
//         }
//     }, [flyovers, updateLayerVisibility]);

//     // ---- Initialize map ----
//     useEffect(() => {
//         isMountedRef.current = true;
//         if (mapRef.current || !mapContainerRef.current) return;

//         try {
//             const map = L.map(mapContainerRef.current, {
//                 center: mapCenter,
//                 zoom: DEFAULT_ZOOM,
//                 minZoom: MIN_ZOOM,
//                 maxZoom: MAX_ZOOM,
//                 zoomControl: true,
//                 attributionControl: false,
//             });

//             const streetLayer = L.tileLayer("https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
//                 subdomains: ["mt0", "mt1", "mt2", "mt3"],
//                 maxZoom: 25,
//                 attribution: "",
//                 zIndex: 1,
//             });

//             const satelliteLayer = L.tileLayer("https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
//                 subdomains: ["mt0", "mt1", "mt2", "mt3"],
//                 maxZoom: 25,
//                 attribution: "",
//                 zIndex: 1,
//             });

//             streetLayerRef.current = streetLayer;
//             satelliteLayerRef.current = satelliteLayer;

//             streetLayer.addTo(map);

//             L.control.attribution({ position: "bottomright", prefix: false }).addTo(map);

//             mapRef.current = map;
//             isMapReadyRef.current = true;

//             map.createPane('movementPane');
//             map.getPane('movementPane').style.zIndex = 550;
//             map.getPane('movementPane').style.pointerEvents = 'auto';

//             const popupPane = map.getPane('popupPane');
//             const mapPaneEl = map.getPane('mapPane');

//             if (popupPane && mapPaneEl && popupPane.parentNode === mapPaneEl) {
//                 map.getContainer().appendChild(popupPane);
//                 popupPane.style.zIndex = '1400';
//                 popupPane.style.pointerEvents = 'none';

//                 const syncPopupPanePosition = () => {
//                     if (popupPane && mapPaneEl) {
//                         popupPane.style.transform = mapPaneEl.style.transform;
//                     }
//                 };
//                 map.on('move zoom viewreset', syncPopupPanePosition);
//                 syncPopupPanePosition();
//             }

//             if (typeof ResizeObserver !== "undefined") {
//                 resizeObserverRef.current = new ResizeObserver(() => {
//                     try {
//                         if (mapRef.current && mapContainerRef.current) {
//                             if (document.contains(mapContainerRef.current)) {
//                                 mapRef.current.invalidateSize();
//                             }
//                         }
//                     } catch (err) {
//                         console.error("[LULC] Error in resize observer:", err);
//                     }
//                 });
//                 resizeObserverRef.current.observe(mapContainerRef.current);
//             }

//             if (flyovers && flyovers.length > 0) {
//                 setTimeout(() => {
//                     try {
//                         addFlyoverLayers(map);
//                     } catch (err) {
//                         console.error("[LULC] Error adding flyover layers:", err);
//                     }
//                 }, 300);
//             }

//             setTimeout(() => {
//                 createLayers();
//             }, 200);

//             return () => {
//                 isMountedRef.current = false;
//                 if (debounceRef.current) clearTimeout(debounceRef.current);
//                 if (dividerReadyTimeoutRef.current) clearTimeout(dividerReadyTimeoutRef.current);
//                 if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
//                 resizeObserverRef.current?.disconnect();
//                 sideBySideRef.current = null;
//                 leftLayerRef.current = null;
//                 rightLayerRef.current = null;
//                 if (mapRef.current) {
//                     try {
//                         mapRef.current.remove();
//                         mapRef.current = null;
//                     } catch (err) {
//                         console.error("[LULC] Error removing map:", err);
//                     }
//                 }
//                 isMapReadyRef.current = false;
//             };

//         } catch (err) {
//             console.error("[LULC] Error initializing map:", err);
//             setError("Failed to initialize map. Please try again.");
//             setLoading(false);
//         }
//     }, []);

//     // ---- Add flyovers when data changes ----
//     useEffect(() => {
//         if (!mapRef.current || !isActive) return;
//         if (!flyovers || flyovers.length === 0) return;

//         setTimeout(() => {
//             try {
//                 addFlyoverLayers(mapRef.current);
//             } catch (err) {
//                 console.error("[LULC] Error adding flyover layers:", err);
//             }
//         }, 500);
//     }, [flyovers, isActive, addFlyoverLayers]);

//     // ---- Recreate layers when year changes ----
//     useEffect(() => {
//         if (!mapRef.current || !isActive) return;
//         createLayers();
//     }, [yearLeft, yearRight, isActive, createLayers]);

//     // ---- Remove layers when inactive ----
//     useEffect(() => {
//         if (!mapRef.current) return;

//         if (!isActive) {
//             if (sideBySideRef.current) {
//                 mapRef.current.removeControl(sideBySideRef.current);
//                 sideBySideRef.current = null;
//             }
//             if (leftLayerRef.current && mapRef.current.hasLayer(leftLayerRef.current)) {
//                 mapRef.current.removeLayer(leftLayerRef.current);
//                 leftLayerRef.current = null;
//             }
//             if (rightLayerRef.current && mapRef.current.hasLayer(rightLayerRef.current)) {
//                 mapRef.current.removeLayer(rightLayerRef.current);
//                 rightLayerRef.current = null;
//             }
//             setIsDividerReady(false);
//         }
//     }, [isActive]);

//     // ---- Force resize when active ----
//     useEffect(() => {
//         if (!isActive || !mapRef.current || !mapContainerRef.current) return;

//         const raf = requestAnimationFrame(() => {
//             try {
//                 if (mapRef.current && mapContainerRef.current) {
//                     if (document.contains(mapContainerRef.current)) {
//                         mapRef.current.invalidateSize();
//                     }
//                 }
//             } catch (err) {
//                 console.error("[LULC] Error invalidating size on active:", err);
//             }
//         });

//         return () => cancelAnimationFrame(raf);
//     }, [isActive]);

//     // Check if difference should be shown
//     const showDifferenceUI = selectedLayer === 'difference';

//     return (
//         <div className={`flex flex-col h-full w-full ${className}`} ref={fullscreenContainerRef} style={{ background: '#ffffff', paddingTop: isFullscreen ? '10px' : '0px', }}>
//             <div
//                 className="flex flex-wrap items-center justify-between gap-3 mb-2 px-3 py-2 rounded-lg relative z-[2000]"
//                 style={{
//                     background: 'linear-gradient(135deg, #e0e7ff 0%, #dbeafe 50%, #ede9fe 100%)',
//                     borderRadius: '10px',
//                     boxShadow: '0 2px 10px rgba(99, 102, 241, 0.1)',
//                     border: '1px solid rgba(99, 102, 241, 0.1)',
//                 }}
//             >
//                 <div className="flex items-center gap-3 flex-wrap">
//                     <span className="font-bold text-black text-md tracking-wide">
//                         Land Cover Comparison
//                     </span>

//                     {/* Layer Selector */}
//                     <LayerSelector
//                         selectedLayer={selectedLayer}
//                         onLayerChange={handleLayerChange}
//                     />

//                     {/* Date Range Selector - Inline when Difference is selected */}
//                     {showDifferenceUI && availableDates.length > 0 && (
//                         <DateRangeSelector
//                             availableDates={availableDates}
//                             startDate={diffStartDate}
//                             endDate={diffEndDate}
//                             onStartDateChange={setDiffStartDate}
//                             onEndDateChange={setDiffEndDate}
//                             compact={true}
//                         />
//                     )}
//                 </div>

//                 <div className="flex items-center gap-4">
//                     <YearSelect label="Left" value={yearLeft} onChange={setYearLeft} disabledYears={[yearRight]} />
//                     <YearSelect label="Right" value={yearRight} onChange={setYearRight} disabledYears={[yearLeft]} />
//                 </div>
//             </div>




//             <div
//                 className="flex-1 min-h-0 relative rounded-lg overflow-hidden border border-gray-200"
//                 style={{
//                     height: isMobile ? "450px" : "100%",
//                     minHeight: isMobile ? "400px" : "auto",
//                 }}
//             >
//                 <div ref={mapContainerRef} className="absolute inset-0" />

//                 {/* Legend */}
//                 {!loading && !error && <LULCLegend />}

//                 {/* Fullscreen Button */}
//                 <div className="absolute top-3 right-3 z-[1500]">
//                     <FullscreenButton isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
//                 </div>

//                 {/* Layer Control */}
//                 {!loading && !error && (
//                     <div
//                         className="absolute left-2.5 z-[1500]"
//                         style={{ top: isMobile ? '140px' : '80px' }}
//                     >
//                         <button
//                             onClick={() => setIsLayerPanelOpen(!isLayerPanelOpen)}
//                             className={`
//                                 flex items-center justify-center w-[34px] h-[34px]
//                                 bg-white rounded-[4px] border-2
//                                 transition-all duration-200 hover:bg-gray-50
//                                 ${isLayerPanelOpen
//                                     ? 'border-blue-500 bg-blue-50 text-blue-600'
//                                     : 'border-gray-400 text-gray-700 hover:border-gray-500'
//                                 }
//                                 focus:outline-none focus:ring-0
//                                 leaflet-bar
//                             `}
//                             style={{ boxShadow: '0 1px 5px rgba(0,0,0,0.1)' }}
//                             aria-label="Toggle layer control"
//                         >
//                             <Layers size={22} />
//                         </button>

//                         {isLayerPanelOpen && (
//                             <div
//                                 className={`
//                                     absolute top-0 left-full ml-2 bg-white rounded-[4px] border-2 border-gray-300
//                                     p-3 min-w-[120px] max-w-[150px]
//                                     ${isMobile ? 'min-w-[120px]' : ''}
//                                     shadow-lg
//                                 `}
//                                 style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.15)' }}
//                             >
//                                 <div className="flex items-center justify-between mb-1 pb-1 border-b border-gray-200">
//                                     <h3 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
//                                         Layers
//                                     </h3>
//                                     <button
//                                         onClick={() => setIsLayerPanelOpen(false)}
//                                         className="text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full p-0.5 transition-all duration-200"
//                                     >
//                                         <X size={16} strokeWidth={3} />
//                                     </button>
//                                 </div>

//                                 {/* Overlay Section - Only Assets */}
//                                 <div>
//                                     <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Overlays</p>
//                                     <div className="flex flex-col gap-1.5">
//                                         {availableLayers.map((layer) => (
//                                             <label
//                                                 key={layer.id}
//                                                 className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:text-blue-600 transition-colors group"
//                                             >
//                                                 <input
//                                                     type="checkbox"
//                                                     checked={activeLayers.includes(layer.id)}
//                                                     onChange={() => handleLayerToggle(layer.id)}
//                                                     className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer transition-all duration-200"
//                                                 />
//                                                 <span className="flex items-center gap-1.5">
//                                                     {layer.name}
//                                                 </span>
//                                             </label>
//                                         ))}
//                                     </div>
//                                 </div>

//                                 {/* Base Map Section */}
//                                 <div className="mt-2 pt-1 border-t border-gray-100">
//                                     <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Base Map</p>
//                                     <div className="flex flex-col gap-1.5">
//                                         <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:text-blue-600 transition-colors">
//                                             <input
//                                                 type="radio"
//                                                 name="baseLayer"
//                                                 checked={baseLayer === 'streets'}
//                                                 onChange={() => handleBaseLayerChange('streets')}
//                                                 className="w-3.5 h-3.5 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
//                                             />
//                                             <span className="flex items-center gap-1.5">Streets</span>
//                                         </label>
//                                         <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:text-blue-600 transition-colors">
//                                             <input
//                                                 type="radio"
//                                                 name="baseLayer"
//                                                 checked={baseLayer === 'satellite'}
//                                                 onChange={() => handleBaseLayerChange('satellite')}
//                                                 className="w-3.5 h-3.5 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
//                                             />
//                                             <span className="flex items-center gap-1.5">Satellite</span>
//                                         </label>
//                                     </div>
//                                 </div>
//                             </div>
//                         )}
//                     </div>
//                 )}

//                 {/* Divider Tag */}
//                 <div
//                     ref={tagRef}
//                     className="absolute bottom-4 pointer-events-none"
//                     style={{
//                         left: "0px",
//                         transform: "translateX(-50%)",
//                         visibility: isDividerReady ? "visible" : "hidden",
//                         zIndex: 400,
//                     }}
//                 >
//                     <div className="flex items-center gap-2 bg-gray-900/80 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg">
//                         <span>{yearLeft}</span>
//                         <span className="text-gray-400">|</span>
//                         <span>{yearRight}</span>
//                     </div>
//                 </div>

//                 {/* Divider Line */}
//                 <div
//                     ref={dividerLineRef}
//                     className="absolute top-0 bottom-0 pointer-events-none"
//                     style={{
//                         left: "0px",
//                         width: "2px",
//                         background: "rgba(59, 130, 246, 0.5)",
//                         transform: "translateX(-50%)",
//                         boxShadow: "0 0 10px rgba(59, 130, 246, 0.3)",
//                         visibility: isDividerReady ? "visible" : "hidden",
//                         zIndex: 399,
//                     }}
//                 />

//                 {/* Loading State */}
//                 {(loading || flyoversLoading || movementLoading) && (
//                     <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm z-[500]">
//                         <div className="flex flex-col items-center gap-2 bg-white px-5 py-4 rounded-xl shadow-lg border border-gray-200">
//                             <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
//                             <p className="text-xs text-gray-500">
//                                 {loading ? "Loading LULC data..." :
//                                     movementLoading ? "Loading movement points..." :
//                                         "Loading flyover data..."}
//                             </p>
//                         </div>
//                     </div>
//                 )}

//                 {/* Error State */}
//                 {(error || movementError) && (
//                     <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-center gap-2 shadow-lg max-w-md">
//                         <AlertTriangle size={16} className="flex-shrink-0" />
//                         <span>{error || movementError}</span>
//                     </div>
//                 )}

//                 {/* Regular Chart */}
//                 {showChart && selectedPointForChart && selectedDetailForChart && (
//                     <MovementPointsChart
//                         pointData={selectedPointForChart}
//                         detailData={selectedDetailForChart}
//                         onClose={() => {
//                             setShowChart(false);
//                             setSelectedPointForChart(null);
//                             setSelectedDetailForChart(null);
//                         }}
//                     />
//                 )}

//                 {/* Difference Chart */}
//                 {showDiffChart && diffPointData && diffDetailData && (
//                     <MovementDiffChart
//                         pointData={diffPointData}
//                         detailData={diffDetailData}
//                         startDate={diffStartDate}
//                         endDate={diffEndDate}
//                         onClose={() => {
//                             setShowDiffChart(false);
//                             setDiffPointData(null);
//                             setDiffDetailData(null);
//                         }}
//                     />
//                 )}
//             </div>
//         </div>
//     );
// }