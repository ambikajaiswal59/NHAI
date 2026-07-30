import { useRef } from "react";
import {
  CloudRain,
  Cloud,
  Sun,
  Wind,
  Droplets,
  Eye,
  MapPin,
  Navigation,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

// ---------------------------------------------------------------------------
// Demo data so this file also previews stand-alone. In the real app this is
// never used — App.js passes `weather` (from sendLocationToAPI) and
// `loading` (weatherLoading) as props, and those take over automatically.
// ---------------------------------------------------------------------------
const DEMO_WEATHER = {
  location: "NH-44, Chainage 128+400",
  structureId: "VB-STR-0128",
  temp: 30,
  condition: "Light Rain",
  conditionCode: "rain",
  wind: 14,
  humidity: 78,
  rainfall: 3.4,
  visibility: 6.2,
  riskLevel: "Moderate",
  forecast: Array.from({ length: 24 }).map((_, i) => ({
    time: `${(4 + i) % 24}:00`.padStart(5, "0"),
    temp: Math.round(25 + 4 * Math.sin(i / 4)),
    condition: ["clear", "cloudy", "rain"][Math.floor(Math.random() * 3)],
    precipProbability: Math.round(Math.random() * 60),
    windSpeed: Math.round(8 + Math.random() * 18),
    windDirection: Math.round(Math.random() * 360),
  })),
  rainfallIntensity: Array.from({ length: 24 }).map((_, i) => ({
    time: `${(4 + i) % 24}:00`.padStart(5, "0"),
    mm: +(Math.random() * 10).toFixed(1),
  })),
};

const conditionIconFor = (code) => {
  if (code === "rain" || code === "storm") return CloudRain;
  if (code === "cloudy" || code === "clouds") return Cloud;
  return Sun;
};

const RISK_STYLES = {
  Low: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-600", dot: "bg-emerald-500" },
  Moderate: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-600", dot: "bg-amber-500" },
  High: { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-600", dot: "bg-rose-500" },
};

export default function WeatherPanel({ weather: weatherProp, loading, hourStep = 1 }) {
  const weather = weatherProp || DEMO_WEATHER;
  const scrollRef = useRef(null);
  const risk = RISK_STYLES[weather.riskLevel] || RISK_STYLES.Low;
  const HeroIcon = conditionIconFor(weather.conditionCode);

  // Show every Nth hour (e.g. 10am, 4pm, 10pm for hourStep=6) instead of
  // all 24 entries. Assumes weather.forecast is hourly, ordered from now.
  const hourlyForecast = weather.forecast
    ? weather.forecast.filter((_, i) => i % hourStep === 0)
    : [];

  const scrollBy = (dir) => {
    scrollRef.current?.scrollBy({ left: dir * 140, behavior: "smooth" });
  };

  // Cap chart x-axis labels to ~5 regardless of how narrow the column is.
  const tickInterval = weather.rainfallIntensity
    ? Math.max(0, Math.ceil(weather.rainfallIntensity.length / 5) - 1)
    : 0;

  if (loading && !weatherProp) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex flex-col h-full gap-3">
        <div className="h-4 w-2/3 bg-gray-100 rounded animate-pulse" />
        <div className="h-28 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex flex-col h-full min-w-0 transition-opacity duration-300 ${
        loading ? "opacity-60" : "opacity-100"
      }`}
    >
      <style>{`
        .wp-scroll::-webkit-scrollbar { height: 5px; }
        .wp-scroll::-webkit-scrollbar-track { background: transparent; }
        .wp-scroll::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 999px; }
        .recharts-wrapper:focus, .recharts-wrapper *:focus, .recharts-surface:focus { outline: none !important; }
      `}</style>

      {/* Location header */}
      <div className="flex items-center justify-between gap-2 mb-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="bg-blue-50 p-1.5 rounded-lg shrink-0">
            <MapPin size={13} className="text-blue-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-gray-800 truncate">{weather.location}</p>
            {weather.structureId && (
              <p className="text-[10px] text-gray-400 truncate">{weather.structureId}</p>
            )}
          </div>
        </div>
        <span className="flex items-center gap-1 shrink-0 bg-emerald-50 border border-emerald-200 text-emerald-600 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          Live
        </span>
      </div>

      {/* Hero — current conditions */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-3 mb-3 shrink-0">
        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 blur-md pointer-events-none" />

        <div className="flex items-start justify-between relative mb-2">
          <div>
            <p className="text-[10px] text-white/70 mb-0.5">Current conditions</p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-white leading-none">{weather.temp}°</span>
              <span className="text-sm text-white/70">C</span>
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs text-white/90 bg-white/15 backdrop-blur-sm px-2 py-0.5 rounded-full w-fit">
              <HeroIcon size={12} className="text-white" />
              <span className="font-medium">{weather.condition}</span>
            </div>
          </div>

          {weather.riskLevel && (
            <div className="flex flex-col items-end gap-0.5 bg-white/15 rounded-lg px-2 py-1 shrink-0">
              <span className="text-[8px] uppercase tracking-wide text-white/70">Risk</span>
              <div className="flex items-center gap-1">
                <ShieldAlert size={11} className="text-white" />
                <span className="text-[11px] font-bold text-white">{weather.riskLevel}</span>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1.5 relative">
          {[
            { icon: Wind, label: "Wind", value: weather.wind, unit: "km/h" },
            { icon: Droplets, label: "Humidity", value: weather.humidity, unit: "%" },
            { icon: CloudRain, label: "Rainfall", value: weather.rainfall, unit: "mm" },
            { icon: Eye, label: "Visibility", value: weather.visibility, unit: "km" },
          ].map(({ icon: Icon, label, value, unit }) => (
            <div key={label} className="flex flex-col gap-0.5 bg-white/10 rounded-lg px-2 py-1.5 min-w-0">
              <span className="text-[8px] text-white/70 uppercase tracking-wide truncate">{label}</span>
              <div className="flex items-center gap-1 min-w-0">
                <Icon size={12} className="text-white shrink-0" />
                <span className="text-[11px] font-bold text-white truncate">
                  {value}
                  <span className="text-white/70 font-medium">{unit}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hourly forecast — horizontal scroll, every hourStep hours */}
      {hourlyForecast.length > 0 && (
        <div className="mb-3 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-bold text-gray-700">Next 24 hours</p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => scrollBy(-1)}
                className="p-0.5 rounded-md bg-gray-50 border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-300 transition-colors"
                aria-label="Scroll to earlier hours"
              >
                <ChevronLeft size={12} />
              </button>
              <button
                onClick={() => scrollBy(1)}
                className="p-0.5 rounded-md bg-gray-50 border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-300 transition-colors"
                aria-label="Scroll to later hours"
              >
                <ChevronRight size={12} />
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="wp-scroll flex gap-2 overflow-x-auto pb-1.5 snap-x snap-mandatory">
            {hourlyForecast.map((f, i) => {
              const Icon = conditionIconFor(f.condition);
              return (
                <div
                  key={f.time + i}
                  className="snap-start shrink-0 w-[68px] flex flex-col items-center gap-0.5 bg-gray-50 rounded-lg py-2.5 px-1 border border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer"
                >
                  <span className="text-[9px] font-semibold text-gray-500 whitespace-nowrap">{f.time}</span>
                  <Icon size={16} className="text-blue-500" />
                  <span className="text-xs font-bold text-gray-800">{f.temp}°</span>

                  {typeof f.precipProbability === "number" && (
                    <>
                      <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden mt-0.5">
                        <div
                          className="h-full bg-blue-400 rounded-full"
                          style={{ width: `${f.precipProbability}%` }}
                        />
                      </div>
                      <span className="text-[8px] text-gray-400">{f.precipProbability}%</span>
                    </>
                  )}

                  {typeof f.windDirection === "number" && (
                    <div className="flex items-center gap-0.5 mt-0.5">
                      <Navigation
                        size={9}
                        className="text-amber-500"
                        style={{ transform: `rotate(${f.windDirection}deg)` }}
                      />
                      <span className="text-[8px] text-gray-400">{f.windSpeed}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Rainfall intensity chart — bottom, full width */}
      {weather.rainfallIntensity && weather.rainfallIntensity.length > 0 && (
        <div className="min-w-0">
          <p className="text-xs font-bold text-gray-700 mb-1.5">Rainfall intensity (mm/hr)</p>
          <div className="bg-gray-50 rounded-lg p-1.5 h-32 sm:h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weather.rainfallIntensity} margin={{ top: 6, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="rainFillLight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#eef2f7" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 8, fontWeight: 600, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  interval={tickInterval}
                />
                <YAxis tick={{ fontSize: 8, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={20} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white border border-gray-200 rounded-lg shadow-md px-2 py-1 text-[10px]">
                          <p className="font-medium text-gray-500 mb-0.5">{payload[0].payload.time}</p>
                          <p className="text-blue-600 font-semibold">{payload[0].value} mm</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="mm"
                  stroke="#3B82F6"
                  fill="url(#rainFillLight)"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}