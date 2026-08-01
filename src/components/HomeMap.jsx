import { useEffect, useState, useCallback, useRef } from "react";
import {
    MapContainer,
    TileLayer,
    GeoJSON,
    useMap,
    LayersControl,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { loadFlyoverData } from "../utils/geoJsonParser";
import indiaBoundaryData from "../data/indiaBoundary.json";

const INDIA_CENTER = [22.9734, 78.6569];
const INDIA_ZOOM = 6;

function ZoomToLayer({ data, onZoomComplete, extraZoom = 1 }) {
    const map = useMap();

    useEffect(() => {
        if (!data || data.features.length === 0) return;

        const layer = L.geoJSON(data);
        const bounds = layer.getBounds();

        if (bounds.isValid()) {
            map.once("moveend", () => {
                map.setZoom(map.getZoom() + extraZoom, { animate: true });
                onZoomComplete && onZoomComplete();
            });

            map.flyToBounds(bounds, {
                padding: [2, 2],
                maxZoom: 15,
                duration: 1.2,
            });
        }
    }, [data, map, onZoomComplete, extraZoom]);

    return null;
}

function FadeInGeoJSON({ data, style, targetOpacity = 1, targetFillOpacity, ...rest }) {
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
            fillOpacity: visible
                ? (base.fillOpacity ?? targetFillOpacity ?? 0)
                : 0,
        };
    };

    return <GeoJSON data={data} style={computedStyle} {...rest} />;
}

export default function HomeMap() {
    const [indiaData, setIndiaData] = useState(null);
    const [stateBoundaryData, setStateBoundaryData] = useState(null);
    const [flyoverGeoJSON, setFlyoverGeoJSON] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadingStatus, setLoadingStatus] = useState("Initializing map...");
    const [overlayVisible, setOverlayVisible] = useState(true);
    const [districtBoundaryData, setDistrictBoundaryData] = useState(null);
    const [builtupLayerData, setBuiltupLayerData] = useState(null); // builtup boundary

    //build up layer
    const builtupUrl = '/data/Haryana_builtup.geojson';

    const stateBoundaryUrl =
        "https://mlinfomap.biz/geoserver/Aaj_Ka_Bharat_CONCOR/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=Aaj_Ka_Bharat_CONCOR%3AState%20Boundary&outputFormat=application/json&featureID=State%20Boundary.11";

    const districtBoundaryUrl =
        "https://mlinfomap.biz/geoserver/Aaj_Ka_Bharat_CONCOR/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=Aaj_Ka_Bharat_CONCOR:Aaj_Ka_Bharat2&outputFormat=application/json&CQL_FILTER=state_ut='Haryana'";

    useEffect(() => {
        setIndiaData(indiaBoundaryData);

        const fetchLayer = async (url) => {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        };

        const loadBaseLayers = async () => {
            try {
                setLoadingStatus("Loading map layers...");

                const stateBoundary = await fetchLayer(stateBoundaryUrl);
                setStateBoundaryData(stateBoundary);

                const districtBoundary = await fetchLayer(districtBoundaryUrl);
                setDistrictBoundaryData(districtBoundary);

                //Builtup layer
                const builtupBoundary = await fetchLayer(builtupUrl);
                setBuiltupLayerData(builtupBoundary);

            } catch (err) {
                console.error(err);
                setLoadingStatus("Failed to load map data");
                setLoading(false);
            }
        };

        loadBaseLayers();
    }, []);

    const handleZoomComplete = useCallback(async () => {
        try {
            const flyovers = await loadFlyoverData();

            if (flyovers && flyovers.length > 0) {
                const allFeatures = flyovers.flatMap(
                    (flyover) => flyover.geojson?.features || []
                );

                setFlyoverGeoJSON({
                    type: "FeatureCollection",
                    features: allFeatures,
                });
            }

            setLoadingStatus("Ready");
        } catch (err) {
            console.error(err);
            setLoadingStatus("Failed to load flyover data");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!loading) {
            const timeout = setTimeout(() => setOverlayVisible(false), 500);
            return () => clearTimeout(timeout);
        }
    }, [loading]);

    return (
        // Map only — no weather toolbar, no extra components.
        <div className="relative w-full h-full rounded-xl2 overflow-hidden shadow-card ring-2 ring-gray-200">
            {overlayVisible && (
                <div
                    className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/70 backdrop-blur-sm transition-opacity duration-500"
                    style={{ opacity: loading ? 1 : 0 }}
                >
                    <div className="flex flex-col items-center gap-3">
                        <div className="h-8 w-8 rounded-full border-4 border-gray-300 border-t-[#81198c] animate-spin" />
                        <p className="text-sm text-gray-700">{loadingStatus}</p>
                    </div>
                </div>
            )}

            <MapContainer
                center={INDIA_CENTER}
                zoom={INDIA_ZOOM}
                scrollWheelZoom
                zoomControl
                attributionControl={false}
                style={{ height: "100%", width: "100%" }}
            >
                <div className="compact-layer-control">
                    <LayersControl position="topleft">

                        <LayersControl.BaseLayer checked name="Streets">
                            <TileLayer
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            />
                        </LayersControl.BaseLayer>

                        <LayersControl.BaseLayer name="Satellite">
                            <TileLayer
                                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                attribution="&copy; Esri"
                            />
                        </LayersControl.BaseLayer>

                        <LayersControl.Overlay checked name="India Boundary">
                            {indiaData && (
                                <FadeInGeoJSON
                                    data={indiaData}
                                    style={{
                                        color: "#81198c",
                                        weight: 2,
                                        opacity: 0.8,
                                        fillOpacity: 0.05,
                                    }}
                                />
                            )}
                        </LayersControl.Overlay>

                        <LayersControl.Overlay checked name="State Boundary">
                            {stateBoundaryData && (
                                <FadeInGeoJSON
                                    data={stateBoundaryData}
                                    style={{
                                        color: "red",
                                        weight: 3,
                                        opacity: 1,
                                        fillOpacity: 0.2,
                                    }}
                                />
                            )}
                            <ZoomToLayer
                                data={stateBoundaryData}
                                onZoomComplete={handleZoomComplete}
                                extraZoom={1}
                            />
                        </LayersControl.Overlay>

                        <LayersControl.Overlay checked name="District Boundary">
                            {districtBoundaryData && (
                                <FadeInGeoJSON
                                    data={districtBoundaryData}
                                    style={{
                                        color: "#12648a",
                                        weight: 2,
                                        opacity: 0.8,
                                        fillOpacity: 0.1,
                                    }}
                                />
                            )}
                        </LayersControl.Overlay>

                        <LayersControl.Overlay checked name="Builtup Boundary">
                            {builtupLayerData && (
                                <FadeInGeoJSON
                                    data={builtupLayerData}
                                    style={{
                                        color: "#10786d",
                                        weight: 2,
                                        opacity: 0.9,
                                        fillOpacity: 0.2,
                                    }}
                                />
                            )}
                        </LayersControl.Overlay>

                        <LayersControl.Overlay checked name="Flyovers">
                            {flyoverGeoJSON && (
                                <FadeInGeoJSON
                                    data={flyoverGeoJSON}
                                    style={{
                                        color: "#8f1b8b",
                                        weight: 4,
                                        opacity: 1,
                                    }}
                                />
                            )}
                        </LayersControl.Overlay>

                    </LayersControl>
                </div>
            </MapContainer>
        </div>
    );
}