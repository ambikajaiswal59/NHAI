// src/pages/Home.jsx
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
    <div className="w-full flex flex-col gap-4 px-4">
      <AlertMarquee alerts={alerts} />

      {/* min-h-[560px] is a hard floor — guarantees this row is never
          0px even if the flex-height chain from MainLayout doesn't
          fully resolve. flex-1 still lets it grow taller when more
          space actually is available. */}
      <div className="w-full min-h-[560px]flex-1">
        <HomeMap />
      </div>

      <FlyoverHealthOverview />
    </div>
  );
}