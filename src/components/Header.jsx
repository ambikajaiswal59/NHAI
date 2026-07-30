// Header.jsx
import { Bell, Radio } from "lucide-react";

export default function Header() {
  return (
    <header className="flex items-center justify-between h-[72px] bg-white shadow-sm border-b border-gray-100 px-4 sm:px-6 pl-12 sm:pl-6">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
            Satellite-Based Structural Risk Monitoring
          </h1>
          <span className="hidden sm:flex items-center gap-1 bg-success/10 text-success text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0">
            <Radio className="w-2.5 h-2.5 animate-pulse" />
            LIVE
          </span>
        </div>
        <p className="text-xs text-gray-500 truncate">
          India&apos;s Road Flyover Monitoring System
        </p>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 ml-2 flex-shrink-0">
        {/* <button className="relative w-10 h-10 rounded-full bg-dashboard flex items-center justify-center hover:bg-blue-100 transition-colors">
          <Bell className="w-4 h-4 text-gray-600" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-danger rounded-full border-2 border-white" />
        </button> */}
      </div>
    </header>
  );
}