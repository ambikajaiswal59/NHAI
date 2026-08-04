// src/pages/Home.jsx
import StatsOverview from "../components/StatsOverview";
import HomeMap from "../components/HomeMap";
import FlyoverHealthOverview from "../components/FlyoverHealthOverview";
import AlertMarquee from "../components/AlertMarquess";

export default function Home() {
  const alerts = [
    {
      id: 1,
      severity: "critical",
      message: "High risk detected on Sector 4 flyover",
      meta: "2 min ago",
    },
    {
      id: 2,
      severity: "warning",
      message: "Visibility dropping below 5km near Ambala",
      meta: "12 min ago",
    },
    {
      id: 3,
      severity: "info",
      message: "Satellite pass completed for all active flyovers",
      meta: "34 min ago",
    },
  ];
  return (
    <div className="w-full h-full flex flex-col gap-4 px-4  overflow-y-auto">
      <AlertMarquee alerts={alerts} />

      {/* Section 1: stat cards */}
      <StatsOverview />

      {/* Section 2: map — HomeMap now controls its own height (h-[640px]) internally,
          so no wrapping div with a conflicting height here. That mismatch was
          what caused it to overlap Section 3. */}
      <div className="w-full h-135">
        <HomeMap />
      </div>

      {/* Section 3: Flyover Health Overview */}
      <FlyoverHealthOverview />
    </div>
  );
}
