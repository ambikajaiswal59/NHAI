// StatsOverview.jsx
// Section 1 — top row of summary stat cards (matches reference image 1)
import { Waves, TriangleAlert, Bell, ShieldCheck, Satellite, BrainCircuit } from "lucide-react";

const STATS = [
  {
    id: "total-flyovers",
    label: "Flyovers",
    value: "4",
    sub: "4 monitored structures",
    icon: Waves,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    border: "from-blue-500 to-cyan-500",
  },
  {
    id: "critical-structures",
    label: "Critical Structures",
    value: "3",
    sub: "Immediate inspection required",
    icon: TriangleAlert,
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
    border: "from-red-500 to-orange-500",
  },
  {
    id: "active-alerts",
    label: "Active Alerts",
    value: "3",
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
    <div className="group relative flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">

      {/* Top gradient */}
      <div
        className={`absolute left-0 top-0 h-1 w-full bg-gradient-to-r ${stat.border}`}
      />

      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {stat.label}
          </p>

          <h2 className="mt-2 text-3xl font-bold text-slate-800">
            {stat.value}
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            {stat.sub}
          </p>

          {/* 
           */}
        </div>

        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.iconBg}`}
        >
          <Icon className={`h-6 w-6 ${stat.iconColor}`} />
        </div>
      </div>
    </div>
  );
}

export default function StatsOverview() {
  return (
    <div className="w-full flex flex-wrap gap-3">
      {STATS.map((stat) => (
        <StatCard key={stat.id} stat={stat} />
      ))}
    </div>
  );
}