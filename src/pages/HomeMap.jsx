// pages/HomeMap.jsx
import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Roughly centers India in view; zoom 5 shows the whole country
// with neighboring countries visible for context.
const INDIA_CENTER = [22.9734, 78.6569];
const INDIA_ZOOM = 5;

export default function HomeMap() {
    return (
        <div className="w-full h-full rounded-xl2 overflow-hidden shadow-card ring-2 ring-gray-200">
            <MapContainer
                center={INDIA_CENTER}
                zoom={INDIA_ZOOM}
                scrollWheelZoom={true}
                zoomControl={true}
                attributionControl={false}
                style={{ height: "100%", width: "100%" }}
            >
                <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    attribution='&copy; <a href="https://www.esri.com">Esri</a>'
                />
            </MapContainer>
        </div>
    );
}