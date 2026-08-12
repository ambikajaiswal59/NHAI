// src/components/LandUseLandCover.jsx
import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import parseGeoraster from "georaster";
import "leaflet-side-by-side";
import { Mountain, AlertTriangle } from "lucide-react";
// import { createIsolatedGeoRasterLayer } from "../utils/geoRasterHelpers";

const YEARS = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
const TIF_URL_FOR_YEAR = (year) => `/terrain/${year}.tif`;

const RASTER_RESOLUTION = 128;

const LAND_COVER_CLASSES = {
    1: { name: "Water", color: [26, 91, 171] },
    2: { name: "Trees", color: [53, 130, 33] },
    4: { name: "Flooded Vegetation", color: [135, 209, 158] },
    5: { name: "Crops", color: [255, 219, 92] },
    7: { name: "Built Area", color: [237, 2, 42] },
    8: { name: "Bare Ground", color: [237, 233, 228] },
    9: { name: "Snow/Ice", color: [242, 250, 255] },
    10: { name: "Clouds", color: [200, 200, 200] },
    11: { name: "Rangeland", color: [198, 173, 141] },
};

const COLOR_LOOKUP = new Map(
    Object.entries(LAND_COVER_CLASSES).map(([code, cls]) => [
        Number(code),
        `rgb(${cls.color[0]},${cls.color[1]},${cls.color[2]})`,
    ])
);

function colorForValue(value) {
    return COLOR_LOOKUP.get(value) || null;
}

function YearSelect({ label, value, onChange }) {
    return (
        <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500 font-medium">{label}</label>
            <select
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="border border-gray-200 rounded-md px-2 py-1 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
                {YEARS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                ))}
            </select>
        </div>
    );
}

function Legend() {
    return (
        <div className="absolute bottom-3 right-3 z-[500] bg-white/90 backdrop-blur-sm rounded-lg shadow-lg px-3 py-2 text-xs space-y-1 max-h-[220px] overflow-y-auto border border-gray-200">
            <div className="font-semibold text-gray-700 text-[10px] uppercase tracking-wider mb-1">
                Land Cover Classes
            </div>
            {Object.entries(LAND_COVER_CLASSES).map(([code, cls]) => (
                <div key={code} className="flex items-center gap-2">
                    <span
                        className="w-3 h-3 rounded-sm inline-block flex-shrink-0 border border-gray-200"
                        style={{ backgroundColor: `rgb(${cls.color.join(",")})` }}
                    />
                    <span className="text-gray-700">{cls.name}</span>
                </div>
            ))}
        </div>
    );
}

const DEFAULT_CENTER = [30.3, 76.7];
const DEFAULT_ZOOM = 12;

export default function LandUseLandCover({
    mapCenter = DEFAULT_CENTER,
    mapZoom = DEFAULT_ZOOM,
    defaultLeftYear = YEARS[0],
    defaultRightYear = YEARS[YEARS.length - 1],
    className = "",
    isActive = true,
}) {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const leftLayerRef = useRef(null);
    const rightLayerRef = useRef(null);
    const sideBySideRef = useRef(null);
    const hasFitBoundsRef = useRef(false);
    const debounceRef = useRef(null);
    const hideLoadingTimeoutRef = useRef(null);
    const dividerReadyTimeoutRef = useRef(null);
    const requestIdRef = useRef(0);
    const isMountedRef = useRef(true);
    const resizeObserverRef = useRef(null);
    const clipRetryIntervalRef = useRef(null);
    const isMapReadyRef = useRef(false);

    const tagRef = useRef(null);
    const dividerLineRef = useRef(null);
    const rafIdRef = useRef(null);

    const initialCenterRef = useRef(mapCenter);
    const initialZoomRef = useRef(mapZoom);

    const [yearLeft, setYearLeft] = useState(defaultLeftYear);
    const [yearRight, setYearRight] = useState(defaultRightYear);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isDividerReady, setIsDividerReady] = useState(false);
    const [layersLoaded, setLayersLoaded] = useState(false);

    // Store georasters in refs
    const leftGeorasterRef = useRef(null);
    const rightGeorasterRef = useRef(null);
    const [leftLoading, setLeftLoading] = useState(true);
    const [rightLoading, setRightLoading] = useState(true);
    const [leftError, setLeftError] = useState(null);
    const [rightError, setRightError] = useState(null);

    // ---- Load left year georaster ----
    useEffect(() => {
        let isMounted = true;
        const url = TIF_URL_FOR_YEAR(yearLeft);

        const loadGeoraster = async () => {
            try {
                setLeftLoading(true);
                setLeftError(null);

                console.log(`📥 Loading left georaster: ${yearLeft}`);
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`Could not load land cover data for ${yearLeft} (${response.status})`);
                }

                const arrayBuffer = await response.arrayBuffer();
                const georaster = await parseGeoraster(arrayBuffer);

                if (isMounted) {
                    leftGeorasterRef.current = georaster;
                    setLeftLoading(false);
                    console.log(`✅ Left georaster loaded: ${yearLeft}`);

                    // If map is ready and active, create layers
                    if (isMapReadyRef.current && isActive) {
                        console.log("🟢 Map ready, creating LULC layers immediately");
                        createLayers();
                    }
                }
            } catch (err) {
                if (isMounted) {
                    console.error(`❌ Error loading left georaster:`, err);
                    setLeftError(err.message || `Failed to load data for ${yearLeft}`);
                    setLeftLoading(false);
                }
            }
        };

        loadGeoraster();

        return () => {
            isMounted = false;
        };
    }, [yearLeft]);

    // ---- Load right year georaster ----
    useEffect(() => {
        let isMounted = true;
        const url = TIF_URL_FOR_YEAR(yearRight);

        const loadGeoraster = async () => {
            try {
                setRightLoading(true);
                setRightError(null);

                console.log(`📥 Loading right georaster: ${yearRight}`);
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`Could not load land cover data for ${yearRight} (${response.status})`);
                }

                const arrayBuffer = await response.arrayBuffer();
                const georaster = await parseGeoraster(arrayBuffer);

                if (isMounted) {
                    rightGeorasterRef.current = georaster;
                    setRightLoading(false);
                    console.log(`✅ Right georaster loaded: ${yearRight}`);

                    // If map is ready and active, create layers
                    if (isMapReadyRef.current && isActive) {
                        console.log("🟢 Map ready, creating LULC layers immediately");
                        createLayers();
                    }
                }
            } catch (err) {
                if (isMounted) {
                    console.error(`❌ Error loading right georaster:`, err);
                    setRightError(err.message || `Failed to load data for ${yearRight}`);
                    setRightLoading(false);
                }
            }
        };

        loadGeoraster();

        return () => {
            isMounted = false;
        };
    }, [yearRight]);

    // ---- Create layers function ----
    const createLayers = useCallback(() => {
        if (!mapRef.current || !isActive) {
            console.log("⏸️ LULC not active or map not ready");
            return;
        }

        if (!leftGeorasterRef.current || !rightGeorasterRef.current) {
            console.log("⏳ Waiting for georasters to load...");
            return;
        }

        if (debounceRef.current) clearTimeout(debounceRef.current);

        const requestId = ++requestIdRef.current;

        debounceRef.current = setTimeout(() => {
            setLoading(true);
            setError(null);

            try {
                const map = mapRef.current;

                // Clean up existing layers
                if (sideBySideRef.current) {
                    map.removeControl(sideBySideRef.current);
                    sideBySideRef.current = null;
                }
                if (leftLayerRef.current && map.hasLayer(leftLayerRef.current)) {
                    map.removeLayer(leftLayerRef.current);
                }
                if (rightLayerRef.current && map.hasLayer(rightLayerRef.current)) {
                    map.removeLayer(rightLayerRef.current);
                }

                map.invalidateSize();

                // Create isolated left layer
                const sessionId = Date.now() + '_' + Math.random().toString(36).substring(2, 8);

                console.log("🔄 Creating LULC layers with session:", sessionId);

                const leftLayer = createIsolatedGeoRasterLayer({
                    georaster: leftGeorasterRef.current,
                    resolution: RASTER_RESOLUTION,
                    pixelValuesToColorFn: (values) => colorForValue(values[0]),
                    opacity: 1,
                    zIndex: 1,
                    updateWhenIdle: true,
                    updateWhenZooming: false,
                    keepBuffer: 2,
                    _instanceId: `lulc_left_${sessionId}`,
                });

                // Create isolated right layer
                const rightLayer = createIsolatedGeoRasterLayer({
                    georaster: rightGeorasterRef.current,
                    resolution: RASTER_RESOLUTION,
                    pixelValuesToColorFn: (values) => colorForValue(values[0]),
                    opacity: 1,
                    zIndex: 1,
                    updateWhenIdle: true,
                    updateWhenZooming: false,
                    keepBuffer: 2,
                    _instanceId: `lulc_right_${sessionId}`,
                });

                // Add layers to map
                leftLayer.addTo(map);
                rightLayer.addTo(map);

                console.log("✅ LULC layers added to map");

                sideBySideRef.current = L.control
                    .sideBySide([leftLayer], [rightLayer])
                    .addTo(map);
                sideBySideRef.current.setPosition(0.5);
                sideBySideRef.current.on("dividermove", handleDividerMove);

                leftLayerRef.current = leftLayer;
                rightLayerRef.current = rightLayer;
                setLayersLoaded(true);

                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        if (requestId !== requestIdRef.current) return;
                        forceClipRecalculation();
                        handleDividerMove();
                    });
                });

                if (!hasFitBoundsRef.current) {
                    const lb = leftLayer.getBounds?.();
                    const rb = rightLayer.getBounds?.();
                    if (lb && rb) {
                        map.fitBounds(lb.extend(rb));
                        hasFitBoundsRef.current = true;
                    }
                }

                if (dividerReadyTimeoutRef.current) clearTimeout(dividerReadyTimeoutRef.current);
                dividerReadyTimeoutRef.current = setTimeout(() => {
                    if (!isMountedRef.current || requestId !== requestIdRef.current) return;

                    forceClipRecalculation();

                    const pos =
                        sideBySideRef.current?.getPosition() ??
                        (mapContainerRef.current?.clientWidth ?? 0) / 2;

                    if (tagRef.current) tagRef.current.style.left = `${pos}px`;
                    if (dividerLineRef.current) dividerLineRef.current.style.left = `${pos}px`;

                    setIsDividerReady(true);
                }, 100);

                if (clipRetryIntervalRef.current) clearInterval(clipRetryIntervalRef.current);
                let retryCount = 0;
                clipRetryIntervalRef.current = setInterval(() => {
                    retryCount += 1;
                    if (
                        !isMountedRef.current ||
                        requestId !== requestIdRef.current ||
                        retryCount > 15
                    ) {
                        clearInterval(clipRetryIntervalRef.current);
                        clipRetryIntervalRef.current = null;
                        return;
                    }
                    forceClipRecalculation();
                }, 200);

                let loadedCount = 0;
                const onTileLoad = () => {
                    loadedCount += 1;
                    forceClipRecalculation();
                    if (loadedCount >= 2 && isMountedRef.current && requestId === requestIdRef.current) {
                        setLoading(false);
                        console.log("✅ LULC layers fully loaded");
                    }
                };
                leftLayer.on("tileload", forceClipRecalculation);
                rightLayer.on("tileload", forceClipRecalculation);
                leftLayer.once("load", onTileLoad);
                rightLayer.once("load", onTileLoad);

                if (hideLoadingTimeoutRef.current) clearTimeout(hideLoadingTimeoutRef.current);
                hideLoadingTimeoutRef.current = setTimeout(() => {
                    if (isMountedRef.current && requestId === requestIdRef.current) {
                        setLoading(false);
                    }
                }, 800);

                map.invalidateSize();

            } catch (err) {
                console.error("❌ Error creating LULC layers:", err);
                if (isMountedRef.current && requestId === requestIdRef.current) {
                    setError(err?.message || "Failed to load terrain data.");
                    setLoading(false);
                }
            }
        }, 100);

        return () => {
            clearTimeout(debounceRef.current);
        };
    }, [isActive]);

    // ---- Initialize map exactly once ----
    useEffect(() => {
        isMountedRef.current = true;
        if (mapRef.current || !mapContainerRef.current) return;

        console.log("🗺️ Initializing LULC map");

        const map = L.map(mapContainerRef.current, {
            center: initialCenterRef.current,
            zoom: initialZoomRef.current,
            zoomControl: true,
            attributionControl: false,
        });

        L.tileLayer("https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
            subdomains: ["mt0", "mt1", "mt2", "mt3"],
            maxZoom: 20,
            attribution: "",
        }).addTo(map);

        L.control.attribution({ position: "bottomright", prefix: false }).addTo(map);

        mapRef.current = map;
        isMapReadyRef.current = true;

        if (typeof ResizeObserver !== "undefined") {
            resizeObserverRef.current = new ResizeObserver(() => {
                map.invalidateSize();
            });
            resizeObserverRef.current.observe(mapContainerRef.current);
        }

        // If both georasters are already loaded, create layers immediately
        if (leftGeorasterRef.current && rightGeorasterRef.current && isActive) {
            console.log("🟢 Georasters already loaded, creating layers");
            setTimeout(() => {
                createLayers();
            }, 200);
        }

        return () => {
            isMountedRef.current = false;
            if (debounceRef.current) clearTimeout(debounceRef.current);
            if (hideLoadingTimeoutRef.current) clearTimeout(hideLoadingTimeoutRef.current);
            if (dividerReadyTimeoutRef.current) clearTimeout(dividerReadyTimeoutRef.current);
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
            if (clipRetryIntervalRef.current) clearInterval(clipRetryIntervalRef.current);
            resizeObserverRef.current?.disconnect();
            sideBySideRef.current = null;
            leftLayerRef.current = null;
            rightLayerRef.current = null;
            map.remove();
            mapRef.current = null;
            isMapReadyRef.current = false;
        };
    }, []);

    // ---- Divider handlers ----
    const handleDividerMove = useCallback(() => {
        if (rafIdRef.current) return;
        rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = null;
            if (!sideBySideRef.current) return;
            const pos = sideBySideRef.current.getPosition();
            const px = `${pos}px`;
            if (tagRef.current) tagRef.current.style.left = px;
            if (dividerLineRef.current) dividerLineRef.current.style.left = px;
        });
    }, []);

    const forceClipRecalculation = useCallback(() => {
        const map = mapRef.current;
        if (!map || !sideBySideRef.current) return;

        if (typeof sideBySideRef.current._updateClip === "function") {
            try {
                sideBySideRef.current._updateClip();
            } catch {
                // Ignore
            }
        }

        map.panBy([1, 0], { animate: false, duration: 0 });
        requestAnimationFrame(() => {
            if (!mapRef.current) return;
            mapRef.current.panBy([-1, 0], { animate: false, duration: 0 });
        });
    }, []);

    useEffect(() => {
        if (!isActive || !mapRef.current) return;
        const raf = requestAnimationFrame(() => {
            mapRef.current?.invalidateSize();
            forceClipRecalculation();
            handleDividerMove();
        });
        return () => cancelAnimationFrame(raf);
    }, [isActive, forceClipRecalculation, handleDividerMove]);

    // ---- Create layers when both georasters are loaded ----
    useEffect(() => {
        if (!mapRef.current || !isActive) {
            setLayersLoaded(false);
            return;
        }

        if (!leftGeorasterRef.current || !rightGeorasterRef.current) {
            console.log("⏳ Waiting for georasters to load...");
            return;
        }

        createLayers();
    }, [yearLeft, yearRight, isActive, createLayers]);

    // ---- Remove layers when inactive ----
    useEffect(() => {
        if (!mapRef.current) return;

        if (!isActive) {
            console.log("🔴 LULC inactive - removing layers");
            if (sideBySideRef.current) {
                mapRef.current.removeControl(sideBySideRef.current);
                sideBySideRef.current = null;
            }
            if (leftLayerRef.current && mapRef.current.hasLayer(leftLayerRef.current)) {
                mapRef.current.removeLayer(leftLayerRef.current);
                leftLayerRef.current = null;
            }
            if (rightLayerRef.current && mapRef.current.hasLayer(rightLayerRef.current)) {
                mapRef.current.removeLayer(rightLayerRef.current);
                rightLayerRef.current = null;
            }
            setLayersLoaded(false);
            setIsDividerReady(false);
        }
    }, [isActive]);

    const combinedError = leftError || rightError;

    // Check if both georasters are loaded
    const isDataReady = leftGeorasterRef.current !== null && rightGeorasterRef.current !== null;

    return (
        <div className={`flex flex-col h-full ${className}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2 px-1">
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-700">Land Cover Comparison</span>
                    {!isDataReady && (
                        <span className="text-[10px] text-gray-400">
                            (loading data...)
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-4">
                    <YearSelect label="Left" value={yearLeft} onChange={setYearLeft} />
                    <YearSelect label="Right" value={yearRight} onChange={setYearRight} />
                </div>
            </div>

            <div className="flex-1 min-h-0 relative rounded-lg overflow-hidden border border-gray-200">
                <div ref={mapContainerRef} className="absolute inset-0" />

                <div
                    ref={tagRef}
                    className="absolute bottom-4 z-[500] pointer-events-none"
                    style={{
                        left: "0px",
                        transform: "translateX(-50%)",
                        visibility: isDividerReady ? "visible" : "hidden",
                    }}
                >
                    <div className="flex items-center gap-2 bg-gray-900/80 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg">
                        <span>{yearLeft}</span>
                        <span className="text-gray-400">|</span>
                        <span>{yearRight}</span>
                    </div>
                </div>

                <div
                    ref={dividerLineRef}
                    className="absolute top-0 bottom-0 z-[499] pointer-events-none"
                    style={{
                        left: "0px",
                        width: "2px",
                        background: "rgba(59, 130, 246, 0.5)",
                        transform: "translateX(-50%)",
                        boxShadow: "0 0 10px rgba(59, 130, 246, 0.3)",
                        visibility: isDividerReady ? "visible" : "hidden",
                    }}
                />

                {(loading || leftLoading || rightLoading) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm z-[500]">
                        <div className="flex flex-col items-center gap-2 bg-white px-5 py-4 rounded-xl shadow-lg border border-gray-200">
                            <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                            <p className="text-xs text-gray-500">
                                {leftLoading || rightLoading ? "Loading data..." : `Loading ${yearLeft} vs ${yearRight}`}
                            </p>
                        </div>
                    </div>
                )}

                {combinedError && (
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-center gap-2 shadow-lg max-w-md">
                        <AlertTriangle size={16} className="flex-shrink-0" />
                        <span>{combinedError}</span>
                    </div>
                )}

                <Legend />
            </div>
        </div>
    );
}