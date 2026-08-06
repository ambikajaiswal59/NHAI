// pages/DashboardPage.jsx
import { useState, useEffect } from "react";
import { useFlyoverData } from "../hooks/useFlyoverData";
import { getStatsFromFlyovers } from "../utils/geoJsonParser";
import { sendLocationToAPI } from "../services/api";
import StatsCards from "../components/StatsCards";
import FlyoverCard from "../components/FlyoverCards";
import WeatherPanel from "../components/WeatherPanel";
import AlertMarquee from "../components/AlertMarquess";

export default function DashboardPage() {
  // Load real flyover data from GeoJSON — this page is the only one that
  // needs it, so it's fetched here instead of in App.jsx.
  const { flyovers, loading, error } = useFlyoverData();
  // const alerts = [
  //   {
  //     id: 1,
  //     severity: "critical",
  //     message: "High risk detected on Sector 4 flyover",
  //     meta: "2 min ago",
  //   },
  //   {
  //     id: 2,
  //     severity: "warning",
  //     message: "Visibility dropping below 5km near Ambala",
  //     meta: "12 min ago",
  //   },
  //   {
  //     id: 3,
  //     severity: "info",
  //     message: "Satellite pass completed for all active flyovers",
  //     meta: "34 min ago",
  //   },
  // ];
  // Calculate stats from loaded data
  const stats =
    flyovers.length > 0
      ? getStatsFromFlyovers(flyovers)
      : { total: 0, low: 0, moderate: 0, high: 0 };

  const [activeId, setActiveId] = useState(null);
  // Single source of truth for the last click: which card, and where.
  // Only the card whose id matches gets to show the droplet marker.
  const [clickedLocation, setClickedLocation] = useState(null); // { id, lat, lng }

  // Set first flyover as active when data loads
  useEffect(() => {
    if (flyovers.length > 0 && activeId === null) {
      setActiveId(flyovers[0].id);
    }
  }, [flyovers, activeId]);

  const activeFlyover = flyovers.find((f) => f.id === activeId);
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  // Fetch weather exactly once, for the first active card's center, as soon
  // as the data is ready. After this, weather only ever updates in response
  // to an explicit map click (see handleMapClick) — never as a side effect
  // of switching which card is "active".
  const [hasInitialWeatherFetch, setHasInitialWeatherFetch] = useState(false);

  useEffect(() => {
    const loadInitialWeather = async () => {
      if (!activeFlyover || hasInitialWeatherFetch) return;

      setWeatherLoading(true);

      try {
        const response = await sendLocationToAPI({
          flyoverId: activeFlyover.id,
          lat: activeFlyover.center[0],
          lng: activeFlyover.center[1],
        });

        setWeather(response);
        setHasInitialWeatherFetch(true);
      } catch (error) {
        console.error("Failed to load initial weather:", error);
      } finally {
        setWeatherLoading(false);
      }
    };

    loadInitialWeather();
  }, [activeFlyover, hasInitialWeatherFetch]);

  // Handle map click to update weather. Explicitly setting activeId here
  // (rather than relying on the card's own onClick bubbling) means one
  // click does exactly one thing: activate that card, place its marker,
  // clear every other card's marker, and refresh the weather panel.
  const handleMapClick = async (lat, lng, id) => {
    setClickedLocation({ id, lat, lng });

    if (id != null) {
      setActiveId(id);
    }

    setWeatherLoading(true);

    try {
      const response = await sendLocationToAPI({
        flyoverId: id,
        lat,
        lng,
      });

      setWeather(response);
    } catch (err) {
      console.error(err);
    } finally {
      setWeatherLoading(false);
    }
  };

  // Loading / error / empty states only ever apply to this page now,
  // since only this page depends on flyover data.
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading flyover data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 text-lg">Error loading data</p>
          <p className="text-gray-500 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (flyovers.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 text-lg">No flyover data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Marquee sits above everything, full dashboard width */}
      {/* <AlertMarquee alerts={alerts} /> */}

      <div className="flex flex-col lg:grid lg:grid-cols-10 gap-4 lg:gap-5 flex-1 min-h-0">
        {/* Left section — Maps (70%) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <StatsCards stats={stats} />

          {/* Flyover Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:flex-1 lg:min-h-0">
            {flyovers.map((f) => (
              <div key={f.id} className="h-80 sm:h-96 md:h-104 lg:h-full">
                <FlyoverCard
                  {...f}
                  isActive={activeId === f.id}
                  onActivate={() => setActiveId(f.id)}
                  onMapClick={handleMapClick}
                  markerPosition={
                    clickedLocation?.id === f.id ? clickedLocation : null
                  }
                  weather={weather}
                  weatherLoading={weatherLoading}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-2 bg-white border border-gray-100 rounded-xl2 shadow-card px-4 py-2.5 mt-1 shrink-0">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-warning/10 shrink-0">
              <span className="text-warning text-[11px]">⚠️</span>
            </span>
            <p className="text-[10px] sm:text-xs text-gray-500 font-medium">
              Risk status is based on latest satellite analysis and AI assessment
            </p>
          </div>
        </div>

        {/* Weather Panel — 30% */}
        <div className="lg:col-span-2 mt-4 lg:mt-0 h-155 lg:h-full">
          <WeatherPanel weather={weather} loading={weatherLoading} />
        </div>
      </div>
    </div>
  );
}
