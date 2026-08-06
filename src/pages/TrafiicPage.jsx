import GoogleMapComponent from "../components/GoogleMapTraffic";

export default function TrafficPage() {
    return (
        <div className="w-full h-full">
            <GoogleMapComponent />
        </div>
    );
}








// import GoogleMapComponent from "../components/GoogleMapTraffic";
// import { useFlyoverData } from "../hooks/useFlyoverData";

// // Same function from mapHelpers.jsx
// function getFlyoverDisplayName(type, indexFallback = 0) {
//     const match = (type || "").toString().match(/\d+/);
//     const num = match ? match[0] : indexFallback + 1;
//     return `Flyover ${num}`;
// }

// export default function TrafficPage() {
//     const { flyovers, loading, error } = useFlyoverData();

//     // Log to see what we're getting
//     console.log("Flyovers data:", flyovers);

//     const combinedGeoJSON = flyovers.length > 0
//         ? {
//             type: "FeatureCollection",
//             features: flyovers.flatMap((flyover, index) => {
//                 const features = flyover.geojson?.features || [];

//                 // Log each flyover to see its type
//                 console.log(`Flyover ${index + 1}:`, {
//                     id: flyover.id,
//                     type: flyover.type,
//                     highway: flyover.highway
//                 });

//                 // If type is undefined, try to get it from the first feature's properties
//                 let type = flyover.type;
//                 if (!type && features.length > 0) {
//                     type = features[0]?.properties?.Type;
//                 }

//                 // EXACT same logic as Dashboard
//                 const displayName = getFlyoverDisplayName(type, index);

//                 return features.map(feature => ({
//                     ...feature,
//                     properties: {
//                         ...feature.properties,
//                         riskStatus: flyover.riskStatus || 'low',
//                         displayName: displayName,
//                         flyoverId: flyover.id,
//                         type: type,
//                     }
//                 }));
//             })
//         }
//         : null;

//     if (loading) {
//         return (
//             <div className="flex h-full items-center justify-center">
//                 <div className="text-center">
//                     <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
//                     <p className="mt-4 text-gray-600">Loading flyover data...</p>
//                 </div>
//             </div>
//         );
//     }

//     if (error) {
//         return (
//             <div className="flex h-full items-center justify-center">
//                 <div className="text-center">
//                     <p className="text-red-500 text-lg">Error loading flyover data</p>
//                     <p className="text-gray-500 mt-2">{error}</p>
//                 </div>
//             </div>
//         );
//     }

//     return (
//         <div className="w-full h-full">
//             <GoogleMapComponent geojsonData={combinedGeoJSON} />
//         </div>
//     );
// }