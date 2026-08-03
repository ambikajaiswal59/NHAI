// StatsOverview.jsx
// Section 1 — top row of summary stat cards (matches reference image 1)
import { Waves, TriangleAlert, Bell, ShieldCheck, Satellite, BrainCircuit } from "lucide-react";

const STATS = [
  {
    id: "total-flyovers",
    label: "Flyovers",
    value: "28",
    sub: "Monitored",
    subColor: "text-blue-600",
    icon: Waves,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-500",
  },
  {
    id: "critical-structures",
    label: "Critical Structures",
    value: "4",
    sub: "14% of Total",
    subColor: "text-gray-500",
    icon: TriangleAlert,
    iconBg: "bg-red-50",
    iconColor: "text-red-500",
  },
  {
    id: "active-alerts",
    label: "Active Alerts",
    value: "11",
    sub: "View All Alerts",
    subColor: "text-amber-600",
    icon: Bell,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-500",
  },
  {
    id: "health-index",
    label: "Health Index",
    value: "92%",
    sub: "Good",
    subColor: "text-emerald-600",
    icon: ShieldCheck,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-500",
  },
  // {
  //   key: "total",
  //   label: "Flyovers",
  //   icon: Waypoints,
  //   accent: "border-primary",
  //   iconBg: "bg-primary/10",
  //   iconColor: "text-primary",
  // },
  // {
  //   key: "low",
  //   label: "Low Risk",
  //   icon: CheckCircle2,
  //   accent: "border-success",
  //   iconBg: "bg-success/10",
  //   iconColor: "text-success",
  // },
  // {
  //   key: "moderate",
  //   label: "Moderate Risk",
  //   icon: AlertTriangle,
  //   accent: "border-warning",
  //   iconBg: "bg-warning/10",
  //   iconColor: "text-warning",
  // },
  // {
  //   key: "high",
  //   label: "High Risk",
  //   icon: ShieldAlert,
  //    accent: "border-red-500",
  //   iconBg: "bg-danger/10",
  //   iconColor: "text-danger",
  // },
];

function StatCard({ stat }) {
  const Icon = stat.icon;
  return (
    <div className="flex items-center justify-between gap-3 bg-white rounded-xl2 shadow-card ring-1 ring-gray-100 px-4 py-3.5 flex-1 min-w-[150px]">
      <div className="min-w-0">
        <p className="text-[12px] text-gray-500 font-medium truncate">{stat.label}</p>
        <p className="text-2xl font-bold text-gray-900 leading-tight mt-0.5">{stat.value}</p>
        <p className={`text-[11px] font-semibold mt-0.5 ${stat.subColor}`}>{stat.sub}</p>
      </div>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${stat.iconBg}`}>
        <Icon className={`w-5 h-5 ${stat.iconColor}`} strokeWidth={2.2} />
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