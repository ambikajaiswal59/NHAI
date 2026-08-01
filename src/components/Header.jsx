// Header.jsx
import { Calendar, ChevronDown, CircleDot } from "lucide-react";

export default function Header({
  systemStatus = "Operational",
  dateLabel = "May 12, 2025",
  timeLabel = "10:30 AM",
  userName = "Admin User",
  userSubtitle = "NHAI HQ",
  userInitials = "AD",
}) {
  return (
    <header className="relative w-full h-[92px] bg-white flex items-center justify-between px-6 overflow-hidden">
      {/* decorative blue swoosh background, right side */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-2/3">
        <svg
          viewBox="0 0 900 100"
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          <path d="M0,100 L120,0 L900,0 L900,100 Z" fill="#EAF2FE" />
        </svg>
      </div>
      {/* right edge accent strip */}
      <div className="absolute top-0 right-0 h-full w-1.5 bg-blue-600" />

      {/* Left: logo + org name */}
      <div className="relative z-10 flex items-center gap-2.5 flex-shrink-0">
        <div className="w-10 h-10 rounded-xl2 overflow-hidden shadow-card ring-2 ring-white flex-shrink-0 bg-gradient-to-br from-primary to-secondary p-[2px]">
          <img
            src="/images/NHAI-logo.png"
            alt="NHAI Logo"
            className="w-full h-full object-cover rounded-[13px] bg-white"
          />
        </div>

        <div className="min-w-0 leading-tight">
          <p className="text-base font-extrabold text-red-600 leading-none">
            NHAI
          </p>
          <p className="text-[11px] text-gray-500 leading-[1.2] mt-1">
            National Highways
            <br />
            Authority of India
          </p>
        </div>
      </div>

      {/* Center: title + tagline */}
      <div className="relative z-10 flex flex-col items-start flex-1 px-8">
        <h1 className="text-[20px] font-bold text-gray-900 leading-none">
          AI Risk Intelligence &amp; Remote Monitoring System
        </h1>
        <div className="flex items-center gap-1.5 text-[12px] font-semibold mt-2">
          <span className="text-blue-600">• Smart Monitoring</span>
          <span className="text-emerald-600 ml-3">• Predictive Insights</span>
          <span className="text-orange-500 ml-3">• Safer Highways</span>
        </div>
      </div>

      {/* Right: status, date, user */}
      <div className="relative z-10 flex items-center gap-6 flex-shrink-0 pr-4">
        {/* System status */}
        <div className="flex items-center gap-2">
          <CircleDot className="w-3.5 h-3.5 text-emerald-500" strokeWidth={3} />
          <div className="leading-tight">
            <p className="text-[11px] text-gray-600">System Status</p>
            <p className="text-[13px] font-bold text-emerald-600 leading-none mt-1">
              {systemStatus}
            </p>
          </div>
        </div>

        {/* Date / time */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-700" />
          <div className="leading-tight">
            <p className="text-[13px] font-semibold text-gray-800 leading-none">
              {dateLabel}
            </p>
            <p className="text-[11px] text-gray-500 mt-1">{timeLabel}</p>
          </div>
        </div>

        {/* User */}
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-slate-800 text-white text-[12px] font-bold flex items-center justify-center flex-shrink-0">
            {userInitials}
          </div>
          <div className="leading-tight">
            <p className="text-[13px] font-semibold text-gray-800 leading-none">
              {userName}
            </p>
            <p className="text-[11px] text-gray-500 mt-1">{userSubtitle}</p>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400 ml-1" />
        </div>
      </div>
    </header>
  );
}