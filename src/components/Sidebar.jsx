// src/components/Sidebar.jsx
import {
  LayoutDashboard,
  Waypoints,
  Radar,
  Bell,
  BarChart3,
  ClipboardCheck,
  FileText,
  CloudSun,
  Puzzle,
  Settings,
  HelpCircle,
  Mountain,
  TrafficCone,
} from "lucide-react";
import { ROUTES } from "../router/routes";

// NOTE: make sure these keys exist in ../router/routes.js
// (FLYOVERS, MONITORING, ALERTS, ANALYTICS, INSPECTIONS, REPORTS, WEATHER, INTEGRATIONS, SETTINGS)
const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, id: ROUTES.HOME },
  { label: "Flyovers", icon: Waypoints, id: ROUTES.DASHBOARD },
  { label: "Topography", icon: Mountain, id: ROUTES.TERRAIN },
  { label: "Traffic", icon: TrafficCone, id: ROUTES.TRAFFIC },
  { label: "Reports", icon: FileText, id: ROUTES.REPORTS },
  { label: "Weather", icon: CloudSun, id: ROUTES.WEATHER },
  //{ label: "Monitoring", icon: Radar, id: ROUTES.MONITORING },
  { label: "Alerts", icon: Bell, badge: 3, id: ROUTES.ALERTS }, // { label: "Integrations", icon: Puzzle, id: ROUTES.INTEGRATIONS },
];

export default function Sidebar({ activeItem, onNavClick, onClose }) {
  const handleNavClick = (id) => {
    if (onNavClick) onNavClick(id);
    if (window.innerWidth < 1024 && onClose) {
      onClose();
    }
  };

  return (
    <aside className="w-37 h-screen  bg-[#0a1130] flex flex-col">
      <div>
        {/* Navigation */}
        <nav className="mt-4 px-6 space-y-3">
          {navItems.map(({ label, icon: Icon, id, badge }) => {
            const isActive = activeItem === id;
            return (
              <button
                key={label}
                disabled={!id}
                onClick={() => id && handleNavClick(id)}
                className={`group relative w-full flex flex-col items-center justify-center  py-2 rounded-xl text-[14px] font-medium transition-all duration-200 ${!id
                  ? "cursor-not-allowed opacity-50"
                  : isActive
                    ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-900/40"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
              >
                <Icon
                  size={24}
                  strokeWidth={isActive ? 2.25 : 2}
                  className={
                    isActive
                      ? "text-white flex-shrink-0"
                      : "text-slate-400 group-hover:text-blue-400 flex-shrink-0"
                  }
                />
                <span className="leading-tight text-center text-white">
                  {label}
                </span>

                {badge ? (
                  <span className="absolute top-1.5 right-8 flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold">
                    {badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Settings + Help */}
      <div className="mt-auto px-2 pb-4">
        <div className="h-px bg-white/5 mb-3" />

        <button
          onClick={() => console.log("Help clicked")}
          className="group w-full flex flex-col items-center justify-center gap-1 py-2.5 mt-1 rounded-xl text-[10px] font-medium text-slate-400 hover:bg-white/5 hover:text-white transition-all duration-200"
        >
          <HelpCircle
            size={18}
            className="text-slate-400 group-hover:text-blue-400"
          />

          <span>Help</span>
        </button>
      </div>
    </aside>
  );
}
