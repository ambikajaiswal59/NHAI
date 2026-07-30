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
        <div className={`flex h-screen bg-dashboard overflow-hidden ${sidebarOpen ? "sidebar-open" : ""}`}>
            {/* Mobile Sidebar Toggle */}
            <button
                onClick={toggleSidebar}
                className="lg:hidden fixed top-3 left-1 z-[9999] p-1.5 bg-white rounded-lg shadow-md hover:bg-gray-50 transition-colors border border-gray-200"
                style={{ marginTop: "-2px" }}
            >
                {sidebarOpen ? (
                    <X size={20} className="text-gray-700" />
                ) : (
                    <Menu size={20} className="text-gray-700" />
                )}
            </button>

            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/50 z-[9999]"
                    onClick={closeSidebar}
                />
            )}

            {/* Sidebar */}
            <div
                className={`
          fixed lg:relative z-[9999]
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          w-56 flex-shrink-0
        `}
            >
                <Sidebar
                    activeItem={activeNav}
                    onNavClick={onNavChange}
                    onClose={closeSidebar}
                />
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                <Header />
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-5">
                    {children}
                </div>
            </div>
        </div>
    );
}