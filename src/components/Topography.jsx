// src/components/Topography.jsx
import { useState, useEffect } from "react";
import {
    Map,
    Droplets,
    Waves,
    Mountain,
    Zap,
    ChevronDown
} from "lucide-react";
import LandUseLandCover from "./LandUseLandCover";
import SoilMap from "./SoilMap";
import FloodMap from "./FloodMap";

const NAV_ITEMS = [
    {
        id: 'lulc',
        label: 'Land Use',
        icon: Map,
        color: '#3b82f6',
        bg: 'bg-blue-50',
        activeBg: 'bg-blue-100',
        text: 'text-blue-600',
        ring: 'ring-blue-300',
        dot: 'bg-blue-500'
    },
    {
        id: 'soil',
        label: 'Soil',
        icon: Droplets,
        color: '#10b981',
        bg: 'bg-emerald-50',
        activeBg: 'bg-emerald-100',
        text: 'text-emerald-600',
        ring: 'ring-emerald-300',
        dot: 'bg-emerald-500'
    },
    {
        id: 'Flood',
        label: 'Flood',
        icon: Waves,
        color: '#8b5cf6',
        bg: 'bg-purple-50',
        activeBg: 'bg-purple-100',
        text: 'text-purple-600',
        ring: 'ring-purple-300',
        dot: 'bg-purple-500'
    },
    {
        id: 'elevation',
        label: 'Elevation',
        icon: Mountain,
        color: '#f59e0b',
        bg: 'bg-amber-50',
        activeBg: 'bg-amber-100',
        text: 'text-amber-600',
        ring: 'ring-amber-300',
        dot: 'bg-amber-500'
    },
    {
        id: 'Lightening',
        label: 'Lightening',
        icon: Zap,           // ✅ Changed from AlertTriangle
        color: '#ef4444',
        bg: 'bg-red-50',
        activeBg: 'bg-red-100',
        text: 'text-red-600',
        ring: 'ring-red-300',
        dot: 'bg-red-500'
    },
];

function ComingSoon({ icon: PanelIcon, label, colorClass }) {
    return (
        <div className="flex h-full items-center justify-center bg-white rounded-lg">
            <div className="text-center">
                <PanelIcon size={48} className={`mx-auto mb-3 ${colorClass}`} />
                <p className="text-gray-700 font-semibold text-lg">{label}</p>
                <p className="text-gray-400 text-sm mt-1">Coming soon</p>
            </div>
        </div>
    );
}

// ✅ ONLY render the active tab - UNMOUNTS inactive components
function renderPanel(tabId) {
    switch (tabId) {
        case 'lulc':
            return <LandUseLandCover key={`lulc-${Date.now()}`} isActive={true} />;
        case 'soil':
            return <SoilMap key="soil-panel" isActive={true} />;
        case 'Flood':
            return <FloodMap key={`flood-${Date.now()}`} isActive={true} />;
        case 'elevation':
            return <ComingSoon key="elevation-panel" icon={Mountain} label="Elevation Map" colorClass="text-amber-600" />;
        case 'Lightening':
            return <ComingSoon key="lightening-panel" icon={Zap} label="Lightening Map" colorClass="text-red-600" />;
        default:
            return null;
    }
}

export default function Topography({ className = "" }) {
    const [activeTab, setActiveTab] = useState('lulc');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [remountKey, setRemountKey] = useState(Date.now());

    const [isMobile, setIsMobile] = useState(
        () => !window.matchMedia("(min-width: 768px)").matches
    );


    // Track mobile breakpoint
    useEffect(() => {
        const mql = window.matchMedia("(min-width: 768px)");
        const handleChange = (e) => setIsMobile(!e.matches);
        handleChange(mql);
        if (mql.addEventListener) {
            mql.addEventListener("change", handleChange);
            return () => mql.removeEventListener("change", handleChange);
        } else {
            mql.addListener(handleChange);
            return () => mql.removeListener(handleChange);
        }
    }, []);

    const activeItem = NAV_ITEMS.find(item => item.id === activeTab);
    const Icon = activeItem?.icon;
    const color = activeItem?.color;

    const handleTabChange = (tabId) => {
        if (tabId === activeTab) return;
        // console.log(`Switching from ${activeTab} to ${tabId}`);
        setRemountKey(Date.now());
        setActiveTab(tabId);
        setIsDropdownOpen(false);
    };

    return (
        <div className={`flex flex-col h-full w-full ${className}`}>
            {/* Navigation - Fixed at top */}
            {/* <div className="w-full bg-white/90 backdrop-blur-sm rounded-lg shadow-sm border border-gray-200 p-1 mt-3 mb-2 flex-shrink-0"> */}
            <div className="relative z-[2000] w-full bg-white/90 backdrop-blur-sm rounded-lg shadow-sm border border-gray-200 p-1 mt-0 md:mt-3 lg:mt-0 mb-2 flex-shrink-0 overflow-visible">                {/* Desktop: Grid View */}
                <div className="hidden md:grid grid-cols-5 gap-0.5">
                    {NAV_ITEMS.map((item) => {
                        const ItemIcon = item.icon;
                        const isActive = activeTab === item.id;

                        return (
                            <button
                                key={item.id}
                                onClick={() => handleTabChange(item.id)}
                                className={`
                                    relative flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md 
                                    transition-all duration-200 text-xs font-medium
                                    ${isActive
                                        ? `${item.activeBg} ${item.text} ring-1 ${item.ring}`
                                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                                    }
                                `}
                            >
                                <ItemIcon size={14} className={`transition-all duration-200 ${isActive ? 'scale-105' : ''}`} />
                                <span className="whitespace-nowrap">{item.label}</span>
                                {isActive && (
                                    <span className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full ${item.dot}`} />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* ✅ FIXED: Mobile Dropdown - All options visible when open */}
                <div className="md:hidden relative">
                    {/* Dropdown Trigger Button */}
                    <button
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-xl border-2 border-gray-200 hover:border-blue-400 transition-all shadow-sm"
                    >
                        <div className="flex items-center gap-3">
                            {Icon && <Icon size={20} style={{ color }} />}
                            <span className="text-base font-semibold text-gray-800">{activeItem?.label}</span>
                        </div>
                        <ChevronDown size={20} className={`text-gray-400 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* ✅ Dropdown Menu - All options visible */}
                    {isDropdownOpen && (
                        <div
                            // className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 z-[9999]"
                            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 z-[10001]"
                            style={{
                                maxHeight: "350px",
                                overflowY: "auto",
                            }}
                        >
                            {NAV_ITEMS.map((item) => {
                                const ItemIcon = item.icon;
                                const isActive = activeTab === item.id;

                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => {
                                            handleTabChange(item.id);
                                            setIsDropdownOpen(false);
                                        }}
                                        className={`
                                            w-full flex items-center gap-3 px-4 py-3.5 text-base transition-all
                                            ${isActive
                                                ? `${item.bg} ${item.text}`
                                                : 'text-gray-600 hover:bg-gray-50'
                                            }
                                        `}
                                        style={{
                                            borderLeft: isActive ? `4px solid ${item.color}` : '4px solid transparent',
                                        }}
                                    >
                                        <ItemIcon size={20} style={{ color: isActive ? item.color : '#6b7280' }} />
                                        <span className="font-medium">{item.label}</span>
                                        {isActive && (
                                            <span
                                                className="ml-auto w-2.5 h-2.5 rounded-full"
                                                style={{ backgroundColor: item.color }}
                                            />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Map Container - Takes remaining space */}
            <div
                className="flex-1 min-h-0 relative"
                style={{
                    height: isMobile ? "calc(100vh - 200px)" : "100%",
                    minHeight: isMobile ? "400px" : "auto",
                }}
            >
                {renderPanel(activeTab)}
            </div>
        </div>
    );
}