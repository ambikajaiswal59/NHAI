// src/components/map/MonthTimelineBar.jsx
import { useEffect, useRef } from "react";
import { Play, Pause } from "lucide-react";

function formatMonthTick(monthKey, months, index) {
    const [year, month] = monthKey.split("-").map(Number);
    const date = new Date(year, month - 1, 1);
    const short = date.toLocaleDateString("en-US", { month: "short" });

    // Check if this is the first month OR the year changed from previous month
    let isYearBoundary = false;

    if (index === 0) {
        // First month in the list - always show year
        isYearBoundary = true;
    } else {
        // Check if previous month has a different year
        const prevMonthKey = months[index - 1];
        if (prevMonthKey) {
            const prevYear = parseInt(prevMonthKey.split("-")[0]);
            if (prevYear !== year) {
                isYearBoundary = true;
            }
        }
    }

    return isYearBoundary ? `${short} '${String(year).slice(2)}` : short;
}

export default function MonthTimelineBar({
    months = [],
    currentMonthIndex = 0,
    isPlaying = false,
    onPlay,
    onPause,
    onSelectMonth,
    className = "",
}) {
    const activeTickRef = useRef(null);

    useEffect(() => {
        activeTickRef.current?.scrollIntoView({
            behavior: "smooth",
            inline: "center",
            block: "nearest",
        });
    }, [currentMonthIndex]);

    if (!months || months.length === 0) return null;

    return (
        <div
            className={`flex items-center gap-2 bg-white rounded-full shadow-md ring-1 ring-gray-200 pl-2 pr-1 py-1 max-w-[min(90vw,560px)] ${className}`}
        >
            <button
                onClick={isPlaying ? onPause : onPlay}
                className={`flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full transition-colors ${isPlaying ? "bg-red-100 hover:bg-red-200" : "bg-blue-100 hover:bg-blue-200"
                    }`}
                title={isPlaying ? "Pause" : "Play"}
            >
                {isPlaying ? (
                    <Pause size={13} className="text-red-600" />
                ) : (
                    <Play size={13} className="text-blue-600 ml-0.5" />
                )}
            </button>

            <div className="idw-month-track flex items-center gap-0.5 overflow-x-auto scroll-smooth">
                {months.map((monthKey, index) => {
                    const isActive = index === currentMonthIndex;
                    return (
                        <button
                            key={monthKey}
                            ref={isActive ? activeTickRef : null}
                            onClick={() => onSelectMonth?.(monthKey)}
                            className="flex flex-col items-center px-1.5 py-0.5 flex-shrink-0 group"
                            title={monthKey}
                        >
                            <span
                                className={`w-1.5 h-1.5 rounded-full mb-0.5 transition-all ${isActive ? "bg-blue-600 scale-125" : "bg-gray-300 group-hover:bg-gray-400"
                                    }`}
                            />
                            <span
                                className={`text-[10px] leading-none whitespace-nowrap transition-colors ${isActive ? "text-blue-600 font-semibold" : "text-gray-500 group-hover:text-gray-700"
                                    }`}
                            >
                                {formatMonthTick(monthKey, months, index)}
                            </span>
                        </button>
                    );
                })}
            </div>

            <style>{`
                .idw-month-track {
                    scrollbar-width: none;
                }
                .idw-month-track::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
        </div>
    );
}