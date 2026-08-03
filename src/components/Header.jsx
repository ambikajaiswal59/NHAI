// Header.jsx
import { Calendar, ChevronDown } from "lucide-react";

export default function Header({
  systemStatus = "Operational",
  dateLabel = "May 12, 2025",
  timeLabel = "10:30 AM",
  userName = "Admin User",
  userSubtitle = "NHAI HQ",
  userInitials = "AD",
}) {
  return (
    <header className="relative w-full h-[113px] bg-white flex items-center overflow-hidden">
      {/* light-blue curved swoosh behind the right side */}
      <svg
        className="pointer-events-none absolute inset-y-0 right-0 w-[66%] h-full"
        viewBox="0 0 940 113"
        preserveAspectRatio="none"
      >
        <path
          d="M 260 0 C 130 0, 190 113, 60 113 L 940 113 L 940 0 Z"
          fill="#E8F1FE"
        />
      </svg>

      {/* thin blue accent bar, right edge */}
      <div className="absolute top-[6px] right-0 h-[calc(100%-12px)] w-[7px] bg-blue-800 rounded-l-md" />

      {/* content row */}
      <div className="relative z-10 flex items-center w-full px-[26px]">
        {/* ---------- Logo + org name ---------- */}
        <div className="flex items-center flex-shrink-0">
          <div className="w-[46px] h-[46px] rounded-xl bg-gradient-to-br from-[#0e2a5e] to-[#163d82] shadow-md flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-[30px] h-[30px]" fill="none">
              <path d="M3 16 Q9 6 21 8" stroke="#f2b705" strokeWidth="2.4" fill="none" strokeLinecap="round" />
              <path d="M3 19 Q9 9 21 11" stroke="#f2b705" strokeWidth="2.4" fill="none" strokeLinecap="round" />
            </svg>
          </div>

          <div className="ml-3 leading-tight">
            <p className="text-[19px] font-extrabold text-red-600 tracking-tight leading-none">
              NHAI
            </p>
            <p className="text-[11px] text-gray-500 leading-[1.3] mt-[3px]">
              National Highways
              <br />
              Authority of India
            </p>
          </div>
        </div>

        {/* ---------- Title + tagline ---------- */}
        <div className="flex-1 min-w-0 ml-[34px]">
          <h1 className="text-[21px] font-bold text-gray-800 whitespace-nowrap">
            AI Risk Intelligence &amp; Remote Monitoring System
          </h1>
          <div className="mt-[6px] text-[12.5px] font-bold whitespace-nowrap">
            <span className="text-blue-600 mr-3.5">&bull; Smart Monitoring</span>
            <span className="text-emerald-600 mr-3.5">&bull; Predictive Insights</span>
            <span className="text-orange-600">&bull; Safer Highways</span>
          </div>
        </div>

        {/* ---------- Status / Date / User ---------- */}
        <div className="flex items-center flex-shrink-0 gap-[30px] pr-2">
          {/* System status */}
          <div className="flex items-center gap-2">
            <span className="w-[9px] h-[9px] rounded-full bg-emerald-500 flex-shrink-0" />
            <div className="leading-tight">
              <p className="text-[11.5px] text-gray-500">System Status</p>
              <p className="text-[13.5px] font-bold text-emerald-600 leading-none mt-[3px]">
                {systemStatus}
              </p>
            </div>
          </div>

          {/* Date / time */}
          <div className="flex items-center gap-2">
            <Calendar className="w-[18px] h-[18px] text-gray-700 flex-shrink-0" strokeWidth={2} />
            <div className="leading-tight">
              <p className="text-[13.5px] font-semibold text-gray-800 leading-none">
                {dateLabel}
              </p>
              <p className="text-[11.5px] text-gray-500 mt-[3px]">{timeLabel}</p>
            </div>
          </div>

          {/* User */}
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-slate-800 text-white text-[12px] font-bold flex items-center justify-center flex-shrink-0">
              {userInitials}
            </div>
            <div className="leading-tight">
              <p className="text-[13.5px] font-semibold text-gray-800 leading-none">
                {userName}
              </p>
              <p className="text-[11.5px] text-gray-500 mt-[3px]">{userSubtitle}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400 ml-0.5" />
          </div>
        </div>
      </div>
    </header>
  );
}