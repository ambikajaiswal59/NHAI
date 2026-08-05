// StatsOverview.jsx
// Section 1 — top row of summary stat cards (matches reference image 1)
import {
  Waves,
  TriangleAlert,
  Bell,
  ShieldCheck,
  Satellite,
  BrainCircuit,
} from "lucide-react";

const STATS = [
  {
    id: "total-flyovers",
    label: "Flyovers",
    value: "28",
    sub: "28 monitored structures",
    icon: Waves,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    border: "from-blue-500 to-cyan-500",
  },
  {
    id: "critical-structures",
    label: "Critical Structures",
    value: "4",
    sub: "Immediate inspection required",
    icon: TriangleAlert,
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
    border: "from-red-500 to-orange-500",
  },
  {
    id: "active-alerts",
    label: "Active Alerts",
    value: "11",
    sub: "Weather and sensor alerts",
    icon: Bell,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    border: "from-amber-500 to-yellow-500",
  },
  {
    id: "health-index",
    label: "Health Index",
    value: "92%",
    sub: "Overall structural health",
    icon: ShieldCheck,
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    border: "from-emerald-500 to-green-500",
  },
];

function StatCard({ stat }) {
  const Icon = stat.icon;

  return (
    <div className="group relative flex w-full min-h-[120px] flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      {/* Top gradient */}
      <div
        className={`absolute left-0 top-0 h-1 w-full bg-gradient-to-r ${stat.border}`}
      />

      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            {stat.label}
          </p>

          <h2 className="mt-2 text-3xl font-bold text-slate-800">
            {stat.value}
          </h2>
        </div>

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${stat.iconBg}`}
        >
          <Icon className={`h-4 w-4 ${stat.iconColor}`} />
        </div>
      </div>

      <p className="text-[8px] text-slate-500">{stat.sub}</p>
    </div>
  );
}

export default function StatsOverview() {
  return (
    <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-5 auto-rows-fr">
      {STATS.map((stat) => (
        <StatCard key={stat.id} stat={stat} />
      ))}
    </div>
  );
}
