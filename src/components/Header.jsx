import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Calendar,
  ChevronDown,
  User,
  LogOut,
  Settings,
  Shield,
} from "lucide-react";
import NHAILOGO from "../assets/NHAILOGO.png";

const getTodayString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getCurrentTimeString = () => {
  return new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const Header = ({ only } = {}) => {
  const showLogo = only !== "content";
  const showRest = only !== "logo";

  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [currentTime, setCurrentTime] = useState(getCurrentTimeString());
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [menuCoords, setMenuCoords] = useState({ top: 0, left: 0 });

  const dateInputRef = useRef(null);
  const userButtonRef = useRef(null);

  const formatDateDisplay = (dateString) => {
    if (!dateString) return "Select Date";
    const dateObj = new Date(dateString);
    return dateObj.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleCalendarClick = () => {
    if (dateInputRef.current) {
      if ("showPicker" in HTMLInputElement.prototype) {
        dateInputRef.current.showPicker();
      } else {
        dateInputRef.current.click();
      }
    }
  };

  const toggleUserMenu = () => {
    if (userButtonRef.current) {
      const rect = userButtonRef.current.getBoundingClientRect();
      setMenuCoords({
        top: rect.bottom + 8,
        left: rect.right - 208,
      });
    }
    setIsUserMenuOpen((prev) => !prev);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        userButtonRef.current &&
        !userButtonRef.current.contains(event.target)
      ) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(getCurrentTimeString());
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full bg-[#1366D9] select-none font-sans">
      <div className="relative w-full min-w-[1020px] h-[100px] pb-1.5 bg-[#1366D9] flex items-center shadow-lg max-[900px]:min-w-0 max-[900px]:flex-col max-[900px]:h-auto">
        {/* ================= 1. LEFT SECTION (NHAI LOGO) ================= */}
        {showLogo && (
          <div className="relative z-10 h-full -mr-8 pr-12 flex items-center mt-3 ml-1 gap-3 shrink-0 bg-[#EEF4FA] max-[900px]:w-full max-[900px]:mr-0 max-[900px]:justify-center max-[900px]:h-auto max-[900px]:py-3">
            <div className="flex items-center gap-2 max-[900px]:gap-2">
              <img
                src={NHAILOGO}
                alt="NHAI Logo"
                className="h-15 w-16 object-contain shrink-0 max-[900px]:h-10 max-[900px]:w-10 max-[480px]:h-9 max-[480px]:w-9"
              />
              <div className="leading-tight">
                <p className="text-[22px] font-extrabold text-blue-600 tracking-tight leading-none max-[900px]:text-base max-[480px]:text-sm">
                  NHAI
                </p>
                <p className="text-[10px] font-bold leading-[1.3] mt-[3px] whitespace-nowrap max-[900px]:text-[10px] max-[480px]:text-[9px]">
                  National Highways
                  <br />
                  Authority of India
                </p>
              </div>
            </div>

            <div className="h-10 bg-gradient-to-b from-transparent via-gray-300/80 to-transparent  mr-2 max-[900px]:hidden" />
          </div>
        )}

        {showRest && (
          <>
            {/* ================= 2. MIDDLE SECTION (WHITE OVERLAY) ================= */}
            <div className="relative z-20 flex-1 h-full mt-3 shadow-[-10px_0_20px_rgba(0,0,0,0.08)] bg-white flex flex-col justify-center pl-2 pr-5  rounded-bl-[125px] rounded-br-[150px] rounded-tr-[450px] shadow-[-8px_0_18px_-2px_rgba(0,0,0,0.07)] [clip-path:polygon(0_0,calc(100%_-_250px)_0,100%_160%,0_100%)] max-[900px]:w-full max-[900px]:ml-0 max-[900px]:h-auto max-[900px]:py-4 max-[900px]:px-5 max-[900px]:[clip-path:none] max-[900px]:rounded-none max-[900px]:items-center">
              <h2 className="text-[#0F172A] w-full font-extrabold text-xl  tracking-tight leading-none max-[900px]:text-center max-[900px]:leading-snug max-[480px]:text-base">
                AI Risk Intelligence & Remote Monitoring System
              </h2>
              <div className="flex items-start gap-2 text-xs font-bold mt-2  max-[900px]:justify-center max-[900px]:flex-wrap max-[480px]:gap-1.5 max-[480px]:text-[10px]">
                <span className="text-[#1D61E8] flex items-start gap-1.5">
                  <span className="text-gray-400 text-[10px]">•</span> Smart
                  Monitoring
                </span>
                <span className="text-[#16A34A] flex items-start gap-1.5">
                  <span className="text-gray-400 text-[10px]">•</span>{" "}
                  Predictive Insights
                </span>
                <span className="text-[#EA580C] flex items-start gap-1.5">
                  <span className="text-gray-400 text-[10px]">•</span> Safer
                  Highways
                </span>
              </div>
            </div>

            {/* ================= 3. RIGHT SECTION ================= */}
            <div className="relative z-30 h-[50%] rounded-[16px] shadow-[-10px_0_20px_rgba(0,0,0,0.08)] bg-white bg-[#EEF4FA]  mx-3 my-3 px-5 py-5 -ml-20  flex items-center gap-6 shrink-0 max-[1024px]:px-8 max-[1024px]:gap-4 max-[900px]:w-full max-[900px]:ml-0 max-[900px]:mt-0 max-[900px]:h-auto max-[900px]:rounded-none max-[900px]:justify-center max-[900px]:flex-wrap max-[900px]:px-4 max-[900px]:py-3 max-[480px]:gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-3.5 h-3.5 bg-[#22C55E] rounded-full inline-block animate-pulse"></span>
                <div className="text-left">
                  <div className="text-[10px] text-gray-700 font-bold tracking-tight leading-none">
                    System Status
                  </div>
                  <div className="text-xs font-bold text-[#16A34A] mt-0.5">
                    Operational
                  </div>
                </div>
              </div>

              {/* Date & Time — read-only display, no manual selection */}
              <div className="flex items-center gap-2.5 p-1.5 rounded-lg">
                <Calendar className="w-5 h-5 text-[#0F172A] stroke-[2.2]" />
                <div className="text-left">
                  <div className="text-xs font-bold text-[#0F172A] leading-tight">
                    {formatDateDisplay(selectedDate)}
                  </div>
                  <div className="text-[10px] text-gray-500 font-semibold leading-tight">
                    {currentTime}
                  </div>
                </div>
              </div>

              <div
                ref={userButtonRef}
                onClick={toggleUserMenu}
                className="flex items-center gap-2.5 cursor-pointer group hover:bg-black/5 p-1 rounded-lg transition-colors"
              >
                <div className="w-9 h-9 bg-[#0B172A] text-white rounded-full flex items-center justify-center font-bold text-xs shadow-md group-hover:scale-105 transition-transform">
                  AD
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-[#0F172A] leading-tight">
                    Admin User
                  </div>
                  <div className="text-[10px] text-gray-500 font-semibold leading-tight">
                    NHAI HQ
                  </div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-gray-700 ml-0.5 transition-transform duration-200 ${isUserMenuOpen ? "rotate-180" : ""}`}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {isUserMenuOpen &&
        createPortal(
          <div
            className="fixed w-52 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-[9999] animate-in fade-in slide-in-from-top-2 duration-150"
            style={{
              top: `${menuCoords.top}px`,
              left: `${menuCoords.left}px`,
            }}
          >
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-xs font-bold text-gray-900">Admin User</p>
              <p className="text-[10px] text-gray-500">admin@nhai.gov.in</p>
            </div>

            <div className="py-1">
              <button className="w-full px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 font-medium">
                <User className="w-4 h-4 text-gray-500" />
                Profile Details
              </button>
              <button className="w-full px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 font-medium">
                <Shield className="w-4 h-4 text-gray-500" />
                Role & Permissions
              </button>
              <button className="w-full px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 font-medium">
                <Settings className="w-4 h-4 text-gray-500" />
                System Settings
              </button>
            </div>

            <div className="border-t border-gray-100 pt-1">
              <button className="w-full px-4 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 font-bold">
                <LogOut className="w-4 h-4 text-red-600" />
                Log Out
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default Header;
