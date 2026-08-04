import {
  CloudRain,
  Cloud,
  Sun,
  CloudSun,
  CloudDrizzle,
  CloudLightning,
  CloudSnow,
  Wind,
  Droplets,
  Eye,
  Loader2,
  MapPin,
} from "lucide-react";

// ---- condition -> visual language -----------------------------------
// The card itself is a single neutral dark-glass surface (see
// CARD_BACKGROUND below) so it holds up against any map terrain —
// green farmland, gray city blocks, blue coastline, dark satellite.
// Only the icon badge and its glow carry the condition's color, so the
// weather is still legible at a glance without recoloring the whole card.
const CONDITIONS = {
  clear: { icon: Sun, accent: "#fdba55", glow: "rgba(253,186,85,0.35)" },
  "partly cloudy": { icon: CloudSun, accent: "#63b3ed", glow: "rgba(99,179,237,0.3)" },
  cloudy: { icon: Cloud, accent: "#9aa5b1", glow: "rgba(154,165,177,0.25)" },
  rain: { icon: CloudRain, accent: "#4fa3d1", glow: "rgba(79,163,209,0.3)" },
  drizzle: { icon: CloudDrizzle, accent: "#7ec8e3", glow: "rgba(126,200,227,0.28)" },
  storm: { icon: CloudLightning, accent: "#b39ddb", glow: "rgba(179,157,219,0.35)" },
  snow: { icon: CloudSnow, accent: "#d9ecfb", glow: "rgba(217,236,251,0.35)" },
};

// One dark glass surface, used for every condition, so the card always
// reads as a distinct floating panel no matter what's underneath it.
const CARD_BACKGROUND =
  "linear-gradient(165deg, rgba(30,35,46,0.94) 0%, rgba(14,17,23,0.96) 100%)";

function resolveCondition(conditionCode) {
  const key = (conditionCode || "").toLowerCase();
  if (key.includes("clear") || key.includes("sun")) return CONDITIONS.clear;
  if (key.includes("partly")) return CONDITIONS["partly cloudy"];
  if (key.includes("storm") || key.includes("thunder")) return CONDITIONS.storm;
  if (key.includes("drizzle")) return CONDITIONS.drizzle;
  if (key.includes("rain")) return CONDITIONS.rain;
  if (key.includes("snow")) return CONDITIONS.snow;
  if (key.includes("cloud")) return CONDITIONS.cloudy;
  return CONDITIONS["partly cloudy"];
}

// Compact weather card rendered inside a Leaflet popup. Handles its own
// loading state so the popup can open the instant the marker is placed,
// before the weather API response has come back.
export default function WeatherPopupCard({ weather, loading }) {
  if (loading || !weather) {
    return (
      <div className="w-72 rounded-[28px] bg-white/90 backdrop-blur-xl p-6 shadow-2xl ring-1 ring-black/5">
        <div className="flex items-center justify-center gap-2 text-sm font-medium text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          Fetching weather…
        </div>
      </div>
    );
  }

  const theme = resolveCondition(weather.conditionCode || weather.condition);
  const Icon = theme.icon;

  const stats = [
    { icon: Wind, value: weather.wind, unit: "km/h", label: "Wind" },
    { icon: Droplets, value: weather.humidity, unit: "%", label: "Humidity" },
    { icon: CloudRain, value: weather.rainfall, unit: "mm", label: "Rainfall" },
    { icon: Eye, value: weather.visibility, unit: "km", label: "Visibility" },
  ];

  return (
    <div
      className="relative w-70 overflow-hidden rounded-[28px] p-5 text-white shadow-[0_24px_60px_-12px_rgba(0,0,0,0.65)] ring-2 ring-white/15 backdrop-blur-xl"
      style={{ background: CARD_BACKGROUND }}
    >
      {/* faint top sheen so the glass panel reads as a lit surface, not a flat fill */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.06] via-transparent to-transparent" />

      {/* header */}
      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-1.5">
          <MapPin size={13} className="text-white/60" strokeWidth={2.5} />
          <p className="text-[14px] font-semibold tracking-wide text-white/90">
            {weather.location}
          </p>
        </div>

      </div>

      {/* hero temperature */}
      <div className="relative mt-4 flex items-center justify-between">
        <div>
          <div className="flex items-start leading-none">
            <span className="text-[56px] font-bold tracking-tight">
              {weather.temp}
            </span>
            <span className="mt-1.5 text-2xl font-semibold text-white/50">°</span>
          </div>
          <p className="mt-1 text-sm font-medium text-white/70">
            {weather.condition}
          </p>
        </div>

        {/* the only place condition color shows up: icon + its glow */}
        <div className="relative flex h-16 w-16 items-center justify-center">
          <div
            className="pointer-events-none absolute inset-0 rounded-2xl blur-xl"
            style={{ background: theme.glow }}
          />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.06] ring-1 ring-white/10">
            <Icon size={32} strokeWidth={1.8} style={{ color: theme.accent }} />
          </div>
        </div>
      </div>

      {/* divider */}
      <div className="relative mt-5 h-px w-full bg-white/10" />

      {/* stats row — compact glass pills instead of four heavy tiles */}
      <div className="relative mt-4 grid grid-cols-4 gap-2">
        {stats.map(({ icon: StatIcon, value, unit, label }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-1.5 rounded-2xl bg-white/[0.06] py-3 ring-1 ring-white/10"
          >
            <StatIcon size={15} className="text-white/70" strokeWidth={2} />
            <p className="text-[13px] font-bold leading-none text-white">
              {value}
              <span className="ml-0.5 text-[9px] font-medium text-white/50">
                {unit}
              </span>
            </p>
            <p className="text-[9px] font-medium uppercase tracking-wide text-white/45">
              {label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}