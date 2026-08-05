import React, { useRef, useState } from "react";
import {
    GoogleMap,
    useJsApiLoader,
    TrafficLayer,
} from "@react-google-maps/api";

const containerStyle = {
    width: "100%",
    height: "100vh",
    position: "relative",
};

const center = {
    lat: 30.353237,
    lng: 76.731678,
};



const GOOGLE_MAPS_API_KEY = "AIzaSyCa3Mm5ZcgYiwrlo5fcicXQL0gwEzymlq8";

export default function GoogleMapComponent() {
    const mapRef = useRef(null);
    const [mapType, setMapType] = useState("roadmap");
    const [showTraffic, setShowTraffic] = useState(true);

    const { isLoaded, loadError } = useJsApiLoader({
        id: "google-maps-script",
        googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    });

    // ===== CONTROLS - With better styling =====
    const controls = (
        <div
            style={{
                position: "absolute",
                zIndex: 1000,
                top: 20,
                left: 20,
                background: "#fff",
                padding: "12px 16px",
                borderRadius: "8px",
                boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
                minWidth: "160px",
                fontFamily: "Arial, sans-serif",
                fontSize: "14px",
                pointerEvents: "auto", // Allow clicks on controls
            }}
        >
            <label style={{ fontWeight: "600", fontSize: "13px", color: "#333", display: "block", marginBottom: "6px" }}>
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
                    padding: "6px 10px",
                    borderRadius: "4px",
                    border: "1px solid #ddd",
                    width: "100%",
                    cursor: "pointer",
                    fontSize: "13px",
                    background: "#fff",
                }}
            >
                <option value="roadmap">Road Map</option>
                <option value="satellite">Satellite</option>
                <option value="hybrid">Hybrid</option>
                <option value="terrain">Terrain</option>
            </select>

            <div style={{ marginTop: "10px", borderTop: "1px solid #eee", paddingTop: "10px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px" }}>
                    <input
                        type="checkbox"
                        checked={showTraffic}
                        onChange={() => setShowTraffic(!showTraffic)}
                        style={{ width: "16px", height: "16px", cursor: "pointer" }}
                    />
                    Show Traffic
                </label>
            </div>
        </div>
    );

    // ===== LOADING / ERROR STATES =====
    if (loadError) {
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
                    Error loading Google Maps: {loadError.message}
                </div>
            </div>
        );
    }

    if (!isLoaded) {
        return (
            <div style={{ position: "relative", width: "100%", height: "100vh" }}>
                {controls}
                <div style={{
                    padding: "20px",
                    textAlign: "center",
                    marginTop: "80px",
                    color: "#666"
                }}>
                    <div style={{
                        display: "inline-block",
                        width: "30px",
                        height: "30px",
                        border: "3px solid #f3f3f3",
                        borderTop: "3px solid #3498db",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite"
                    }} />
                    <style>{`
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    `}</style>
                    <p style={{ marginTop: "10px" }}>Loading Google Maps...</p>
                </div>
            </div>
        );
    }

    // ===== MAP + CONTROLS =====
    return (
        <div style={{ position: "relative", width: "100%", height: "100vh" }}>
            {controls}
            <div style={{ width: "100%", height: "100%" }}>
                <GoogleMap
                    mapContainerStyle={{ width: "100%", height: "100%" }}
                    center={center}
                    zoom={12}
                    mapTypeId={mapType}
                    onLoad={(map) => {
                        mapRef.current = map;
                        console.log("Map loaded");
                    }}
                    options={{
                        streetViewControl: false,
                        mapTypeControl: false,
                        fullscreenControl: true,
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











// import React, { useRef, useState } from "react";
// import {
//     GoogleMap,
//     LoadScript,
//     TrafficLayer,
// } from "@react-google-maps/api";

// const containerStyle = {
//     width: "100%",
//     height: "100vh",
// };

// const center = {
//     lat: 28.6139,
//     lng: 77.2090,
// };

// export default function GoogleMapComponent() {
//     const mapRef = useRef(null);
//     const [mapType, setMapType] = useState("roadmap");
//     const [showTraffic, setShowTraffic] = useState(true);

//     return (
//         <>
//             <div
//                 style={{
//                     position: "absolute",
//                     zIndex: 1000,
//                     top: 10,
//                     left: 10,
//                     background: "#fff",
//                     padding: "10px",
//                     borderRadius: "5px",
//                 }}
//             >
//                 <select
//                     value={mapType}
//                     onChange={(e) => {
//                         setMapType(e.target.value);

//                         if (mapRef.current) {
//                             mapRef.current.setMapTypeId(e.target.value);
//                         }
//                     }}
//                 >
//                     <option value="roadmap">Road Map</option>
//                     <option value="satellite">Satellite</option>
//                     <option value="hybrid">Hybrid</option>
//                     <option value="terrain">Terrain</option>
//                 </select>

//                 <br />
//                 <br />

//                 <label>
//                     <input
//                         type="checkbox"
//                         checked={showTraffic}
//                         onChange={() => setShowTraffic(!showTraffic)}
//                     />
//                     Show Traffic
//                 </label>
//             </div>

//             <LoadScript googleMapsApiKey="AIzaSyCa3Mm5ZcgYiwrlo5fcicXQL0gwEzymlq8">
//                 <GoogleMap
//                     mapContainerStyle={containerStyle}
//                     center={center}
//                     zoom={10}
//                     mapTypeId={mapType}
//                     onLoad={(map) => (mapRef.current = map)}
//                 >
//                     {showTraffic && <TrafficLayer />}
//                 </GoogleMap>
//             </LoadScript>
//         </>
//     );
// }