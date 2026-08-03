// src/pages/Home.jsx
import StatsOverview from "../components/StatsOverview";
import HomeMap from "../components/HomeMap";
import FlyoverHealthOverview from "../components/FlyoverHealthOverview";

export default function Home() {
  return (
    <div className="w-full h-full flex flex-col gap-4 px-4 py-2 overflow-y-auto">
      {/* Section 1: Stats Cards */}
      <StatsOverview />

      {/* Section 2: Map with IDW Weather Layer - All weather logic is inside HomeMap */}
      <div className="w-full h-[540px]">
        <HomeMap />
      </div>

      {/* Section 3: Flyover Health Overview */}
      <FlyoverHealthOverview />
    </div>
  );
}










// // src/pages/Home.jsx
// import { useEffect, useState } from 'react';
// import { useIDWWeather } from '../hooks/useIDWWeather';
// import HomeMap from '../components/HomeMap';
// import StatsOverview from '../components/StatsOverview';
// import FlyoverHealthOverview from '../components/FlyoverHealthOverview';

// export default function Home() {
//   // Use the IDW weather hook
//   const {
//     weatherData,
//     loading: weatherLoading,
//     error,
//     selectedLayer,
//     fetchWeather,
//     changeLayer,
//   } = useIDWWeather();

//   // Get dates for Today, Tomorrow, Day After Tomorrow
//   const getDates = () => {
//     const today = new Date();
//     const tomorrow = new Date(today);
//     tomorrow.setDate(tomorrow.getDate() + 1);
//     const dayAfterTomorrow = new Date(today);
//     dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

//     const formatDate = (date) => date.toISOString().split('T')[0];

//     return {
//       today: formatDate(today),
//       tomorrow: formatDate(tomorrow),
//       dayAfterTomorrow: formatDate(dayAfterTomorrow)
//     };
//   };

//   const dates = getDates();
//   const [selectedDateInput, setSelectedDateInput] = useState(dates.today);

//   // Fetch weather on component mount
//   useEffect(() => {
//     fetchWeather(selectedDateInput);
//   }, []);

//   // Handle date selection
//   const handleDateSelect = (dateValue) => {
//     setSelectedDateInput(dateValue);
//     fetchWeather(dateValue);
//   };

//   return (
//     <div className="w-full h-full flex flex-col gap-4 px-4 py-2 overflow-y-auto">
//       {/* IDW Weather Controls */}
//       <div className="bg-white rounded-xl shadow-card p-4">
//         <div className="flex flex-wrap items-center gap-4">
//           {/* Date Selection Buttons */}
//           <div className="flex items-center gap-2">
//             <label className="text-sm font-medium text-gray-700">Date:</label>
//             <div className="flex gap-1.5">
//               <button
//                 onClick={() => handleDateSelect(dates.today)}
//                 className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedDateInput === dates.today
//                   ? 'bg-blue-600 text-white'
//                   : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
//                   }`}
//               >
//                 Today
//               </button>
//               <button
//                 onClick={() => handleDateSelect(dates.tomorrow)}
//                 className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedDateInput === dates.tomorrow
//                   ? 'bg-blue-600 text-white'
//                   : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
//                   }`}
//               >
//                 Tomorrow
//               </button>
//               <button
//                 onClick={() => handleDateSelect(dates.dayAfterTomorrow)}
//                 className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedDateInput === dates.dayAfterTomorrow
//                   ? 'bg-blue-600 text-white'
//                   : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
//                   }`}
//               >
//                 Day After
//               </button>
//             </div>
//           </div>

//           {/* Layer Selection Buttons */}
//           <div className="flex gap-2">
//             <button
//               onClick={() => changeLayer('rainfall')}
//               className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedLayer === 'rainfall'
//                 ? 'bg-blue-600 text-white'
//                 : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
//                 }`}
//             >
//               🌧️ Rainfall
//             </button>
//             <button
//               onClick={() => changeLayer('wind')}
//               className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedLayer === 'wind'
//                 ? 'bg-blue-600 text-white'
//                 : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
//                 }`}
//             >
//               💨 Wind
//             </button>
//             <button
//               onClick={() => changeLayer('temperature')}
//               className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedLayer === 'temperature'
//                 ? 'bg-blue-600 text-white'
//                 : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
//                 }`}
//             >
//               🌡️ Temperature
//             </button>
//           </div>

//           {/* Status Indicators */}
//           {weatherLoading && (
//             <span className="text-sm text-blue-600 animate-pulse">
//               Loading weather data...
//             </span>
//           )}
//           {error && (
//             <span className="text-sm text-red-600">
//               Error: {error}
//             </span>
//           )}
//           {!weatherLoading && weatherData && (
//             <span className="text-sm text-green-600">
//               ✅ {weatherData.length} weather stations loaded
//             </span>
//           )}
//         </div>
//       </div>

//       {/* Section 1: Stats Cards */}
//       <StatsOverview />

//       {/* Section 2: Map with IDW Layer */}
//       <div className="w-full h-[540px]">
//         <HomeMap
//           weatherData={weatherData}
//           loading={weatherLoading}
//           selectedLayer={selectedLayer}
//         />
//       </div>

//       {/* Section 3: Flyover Health Overview */}
//       <FlyoverHealthOverview />
//     </div>
//   );
// }










// import StatsOverview from "../components/StatsOverview";
// import HomeMap from "../components/HomeMap";
// import FlyoverHealthOverview from "../components/FlyoverHealthOverview";

// export default function Home() {
//   return (
//     <div className="w-full h-full flex flex-col gap-4 px-4 py-2 overflow-y-auto">
//       {/* Section 1: stat cards */}
//       <StatsOverview />

//       {/* Section 2: map — HomeMap now controls its own height (h-[640px]) internally,
//           so no wrapping div with a conflicting height here. That mismatch was
//           what caused it to overlap Section 3. */}
//       <div className="w-full h-[540px]">
//         <HomeMap />
//       </div>

//       {/* Section 3: flyover health overview */}
//       <FlyoverHealthOverview />
//     </div>
//   );
// }