// Home.jsx
// Recreated home page: 3 stacked sections
//   1. StatsOverview   — top stat-card row (image 1)
//   2. HomeMap         — map only, no toolbar (image 1)
//   3. FlyoverHealthOverview — flyover health cards (image 2)
//import StatsOverview from "../components/Statsoverview";
import StatsOverview from "../components/StatsOverview";
// import HomeMap from "../componentsHomemap";
import HomeMap from "../components/HomeMap";
import FlyoverHealthOverview from "../components/FlyoverHealthOverview";

export default function Home() {
  return (
    <div className="w-full h-full flex flex-col gap-4 px-4 py-2 overflow-y-auto">
      {/* Section 1: stat cards */}
      <StatsOverview />

      {/* Section 2: map only */}
      <div className="w-full h-[480px]">
        <HomeMap />
      </div>

      {/* Section 3: flyover health overview */}
      <FlyoverHealthOverview />
    </div>
  );
}