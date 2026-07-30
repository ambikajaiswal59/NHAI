// src/components/Sidebar.jsx
import { Home, LayoutDashboard, CloudSun, FileText, Settings, X } from "lucide-react";
import { ROUTES } from "../router/routes";

const navItems = [
  { label: "Home", icon: Home, id: ROUTES.HOME },
  { label: "Dashboard", icon: LayoutDashboard, id: ROUTES.DASHBOARD },
  { label: "Weather Map", icon: CloudSun, id: ROUTES.WEATHER },
  { label: "Reports", icon: FileText, id: ROUTES.REPORTS },
];

export default function Sidebar({ activeItem, onNavClick, onClose }) {
  const handleNavClick = (id) => {
    if (onNavClick) onNavClick(id);
    if (window.innerWidth < 1024 && onClose) {
      onClose();
    }
  };

  return (
    <aside className="w-56 h-screen bg-white border-r border-gray-100 flex flex-col justify-between">
      <div>
        {/* Logo */}
        <div className="relative flex items-center gap-2.5 h-[72px] px-4 border-b border-gray-100">
          <button
            onClick={onClose}
            className="lg:hidden absolute top-2 right-2 p-1 hover:bg-gray-100 rounded"
          >
            <X size={16} className="text-gray-400" />
          </button>

          <div className="w-10 h-10 rounded-xl2 overflow-hidden shadow-card ring-2 ring-white flex-shrink-0 bg-gradient-to-br from-primary to-secondary p-[2px]">
            <img
              src="/images/NHAI-logo.png"
              alt="NHAI Logo"
              className="w-full h-full object-cover rounded-[13px] bg-white"
            />
          </div>

          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 leading-tight truncate">NHAI</p>
            <p className="text-[9px] font-medium text-gray-400 leading-tight tracking-wide uppercase">
              Infrastructure Monitoring
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="mt-4 px-3 space-y-1">
          {navItems.map(({ label, icon: Icon, id }) => {
            const isActive = activeItem === id;
            return (
              <button
                key={id}
                onClick={() => handleNavClick(id)}
                className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${isActive
                  ? "bg-gradient-to-r from-primary to-secondary text-white shadow-card"
                  : "text-gray-500 hover:bg-dashboard hover:text-gray-700"
                  }`}
              >
                <Icon
                  size={17}
                  strokeWidth={isActive ? 2.25 : 2}
                  className={
                    isActive
                      ? "text-white flex-shrink-0"
                      : "text-gray-400 group-hover:text-primary flex-shrink-0"
                  }
                />
                <span className="leading-tight">{label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Settings */}
      <div className="px-3 pb-4">
        <div className="h-px bg-gray-100 mb-3" />
        <button
          onClick={() => console.log("Settings clicked - coming soon")}
          className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-gray-500 hover:bg-dashboard hover:text-gray-700 transition-all duration-200"
        >
          <Settings size={17} className="text-gray-400 group-hover:text-primary flex-shrink-0" />
          Settings
        </button>
      </div>
    </aside>
  );
}