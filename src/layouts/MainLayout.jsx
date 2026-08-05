// src/layouts/MainLayout.jsx
import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import { Menu, X } from "lucide-react";

export default function MainLayout({ children, activeNav, onNavChange }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div
      className={`flex flex-col h-screen bg-dashboard overflow-hidden ${sidebarOpen ? "sidebar-open" : ""}`}
    >
      <div className="flex-shrink-0 z-[9998]">
        <div className="hidden min-[901px]:block">
          <Header />
        </div>
        <div className="max-[900px]:block hidden">
          <Header only="logo" />
        </div>
      </div>

      <button
        onClick={toggleSidebar}
        className="lg:hidden fixed top-4 left-1 z-[9999] p-1.5 bg-white rounded-lg shadow-md hover:bg-gray-50 transition-colors border border-gray-200"
        style={{ marginTop: "-2px" }}
      >
        {sidebarOpen ? (
          <X size={20} className="text-gray-700" />
        ) : (
          <Menu size={20} className="text-gray-700" />
        )}
      </button>

      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 top-0 bg-black/50 z-[9997]"
          onClick={closeSidebar}
        />
      )}

      <div className="flex flex-1 overflow-hidden">
        <div
          className={`
            fixed lg:relative top-0 lg:top-auto left-0 z-[9998]
            h-full lg:h-auto
            transform transition-transform duration-300 ease-in-out
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
            w-40 flex-shrink-0
          `}
        >
          <Sidebar
            activeItem={activeNav}
            onNavClick={onNavChange}
            onClose={closeSidebar}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Turned this into a real flex column (added `flex flex-col
              min-h-0`) instead of a plain scrollable block. This is
              what gives {children} (Home.jsx) an actual computed
              height to work with, instead of relying on `h-full`
              (percentage) resolving through a non-flex ancestor —
              which was collapsing to 0 and causing the blank map /
              overlapping cards. */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-5 flex flex-col min-h-0">
            <div className="max-[900px]:block hidden -m-3 sm:-m-4 lg:-m-5 mb-3">
              <Header only="content" />
            </div>

            {/* {children} (Home.jsx) is now a flex item with flex-1 +
                min-h-0, so its own `h-full` root div resolves against
                a real, flex-computed height all the way down to
                HomeMap. */}
            <div className="flex-1 min-h-0 flex flex-col">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}