import { Waypoints, CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";

const cardConfig = [
  {
    key: "total",
    label: "Flyovers",
    icon: Waypoints,
    accent: "border-primary",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
  },
  {
    key: "low",
    label: "Low Risk",
    icon: CheckCircle2,
    accent: "border-success",
    iconBg: "bg-success/10",
    iconColor: "text-success",
  },
  {
    key: "moderate",
    label: "Moderate Risk",
    icon: AlertTriangle,
    accent: "border-warning",
    iconBg: "bg-warning/10",
    iconColor: "text-warning",
  },
  {
    key: "high",
    label: "High Risk",
    icon: ShieldAlert,
    accent: "border-danger",
    iconBg: "bg-danger/10",
    iconColor: "text-danger",
  },
];

export default function StatsCards({ stats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cardConfig.map(({ key, label, icon: Icon, accent, iconBg, iconColor }) => (
        <div
          key={key}
          className={`relative bg-white border border-gray-100 border-l-4 ${accent} rounded-xl2 p-3 sm:p-4 flex items-center gap-3 shadow-card hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200`}
        >
          <div className={`${iconBg} p-2 sm:p-2.5 rounded-lg flex-shrink-0`}>
            <Icon size={18} className={iconColor} strokeWidth={2.25} />
          </div>
          <div className="flex flex-col min-w-0">
            <p className="text-xl sm:text-2xl font-bold text-gray-800 leading-tight">
              {stats[key]}
            </p>
            <p className="text-[10px] sm:text-xs text-gray-500 font-semibold leading-tight truncate">
              {label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}