import StatsOverview from "../components/StatsOverview";
import HomeMap from "../components/HomeMap";
import FlyoverHealthOverview from "../components/FlyoverHealthOverview";

export default function Home() {
  return (
    <div className="w-full h-full flex flex-col gap-4 px-4 py-2 overflow-y-auto">
      {/* Section 1: stat cards */}
      <StatsOverview />

      {/* Section 2: map — HomeMap now controls its own height (h-[640px]) internally,
          so no wrapping div with a conflicting height here. That mismatch was
          what caused it to overlap Section 3. */}
      <div className="w-full h-[540px]">
        <HomeMap />
      </div>

      {/* Section 3: flyover health overview */}
      <FlyoverHealthOverview />
    </div>
  );
}