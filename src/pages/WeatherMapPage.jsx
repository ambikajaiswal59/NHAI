// pages/WeatherMapPage.jsx
import { CloudSun } from "lucide-react";

const BASE_URL = import.meta.env.VITE_API_BASE;

export default function WeatherMapPage() {
    return (
        <div className="w-full h-full flex flex-col gap-2">
            <div className="flex items-center justify-between flex-shrink-0 px-1">
                <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                    <CloudSun size={20} className="text-blue-500" />
                    NHI Portal
                </h2>

            </div>

            <div className="flex-1 min-h-0 rounded-xl overflow-hidden shadow-card ring-1 ring-gray-200 bg-white relative">
                <iframe
                    src={`${BASE_URL}/weather-proxy`}
                    className="w-full h-full border-0"
                    title="Weather Portal"

                    allow="fullscreen; geolocation"
                />
            </div>
        </div>
    );
}








// // pages/WeatherMapPage.jsx
// import { CloudSun } from "lucide-react";

// export default function WeatherMapPage() {
//     return (
//         <div className="flex h-full items-center justify-center">
//             <div className="text-center">
//                 <CloudSun className="mx-auto mb-3 text-secondary" size={40} />
//                 <p className="text-gray-700 font-semibold">Weather Map</p>
//                 <p className="text-gray-400 text-sm mt-1">Coming soon</p>
//             </div>
//         </div>
//     );
// }