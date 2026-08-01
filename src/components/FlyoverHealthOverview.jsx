// FlyoverHealthOverview.jsx
// Section 3 — flyover health card row (matches reference image 2's "Flyover Health Overview")
import { ChevronRight } from "lucide-react";

const STATUS_STYLES = {
  Critical: { badge: "bg-red-600", text: "text-red-600", line: "#DC2626", track: "bg-red-50" },
  High: { badge: "bg-orange-500", text: "text-orange-500", line: "#F97316", track: "bg-orange-50" },
  Moderate: { badge: "bg-amber-400 text-gray-900", text: "text-amber-500", line: "#F59E0B", track: "bg-amber-50" },
  Low: { badge: "bg-emerald-500", text: "text-emerald-600", line: "#10B981", track: "bg-emerald-50" },
};

const FLYOVERS = [
  {
    id: "flyover-1",
    name: "Flyover 1",
    location: "NH 44, Delhi",
    status: "Critical",
    movement: "+18.7",
    healthScore: 42,
    image: "/images/flyovers/flyover-1.jpg",
    trend: [4, 8, 6, 12, 10, 16, 13, 18, 15, 20, 17, 19],
  },
  {
    id: "flyover-2",
    name: "Flyover 2",
    location: "NH 48, Agra",
    status: "High",
    movement: "+11.3",
    healthScore: 63,
    image: "/images/flyovers/flyover-2.jpg",
    trend: [3, 5, 4, 7, 6, 9, 8, 11, 9, 12, 10, 11],
  },
  {
    id: "flyover-3",
    name: "Flyover 3",
    location: "NH 19, Kanpur",
    status: "Moderate",
    movement: "+4.6",
    healthScore: 76,
    image: "/images/flyovers/flyover-3.jpg",
    trend: [2, 3, 2.5, 4, 3.5, 4.5, 4, 5, 4.2, 4.8, 4.4, 4.6],
  },
  {
    id: "flyover-4",
    name: "Flyover 4",
    location: "NH 27, Bhopal",
    status: "Low",
    movement: "+1.2",
    healthScore: 92,
    image: "/images/flyovers/flyover-4.jpg",
    trend: [0.8, 1, 0.9, 1.3, 1.1, 1.4, 1.0, 1.2, 0.9, 1.3, 1.1, 1.2],
  },
];

function Sparkline({ points, color }) {
  const w = 100;
  const h = 32;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;

  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / range) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-8" preserveAspectRatio="none">
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FlyoverCard({ flyover }) {
  const style = STATUS_STYLES[flyover.status];

  return (
    <div className="flex-1 min-w-[220px] bg-white rounded-xl2 shadow-card ring-1 ring-gray-100 overflow-hidden">
      {/* Image + status badge */}
      <div className="relative h-28 w-full">
        <img
          src={flyover.image}
          alt={flyover.name}
          className="w-full h-full object-cover"
        />
        <span
          className={`absolute top-2 right-2 text-[11px] font-bold text-white px-2.5 py-1 rounded-full ${style.badge}`}
        >
          {flyover.status}
        </span>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-3 py-2">
          <p className="text-white text-sm font-bold leading-none">{flyover.name}</p>
          <p className="text-white/80 text-[11px] mt-0.5">{flyover.location}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 py-3">
        <p className="text-[11px] text-gray-500">Movement (mm)</p>
        <div className="flex items-center justify-between">
          <p className={`text-xl font-bold ${style.text}`}>{flyover.movement}</p>
        </div>
        <p className="text-[10px] text-gray-400 -mt-0.5">(Last 12 days)</p>

        <div className={`rounded-lg px-2 py-1 mt-1 ${style.track}`}>
          <Sparkline points={flyover.trend} color={style.line} />
        </div>

        <div className="flex items-center justify-between mt-3">
          <div>
            <p className="text-[11px] text-gray-500">Health Score</p>
            <p className={`text-lg font-bold ${style.text}`}>{flyover.healthScore}%</p>
          </div>
          <button className="flex items-center gap-1 text-[12px] font-semibold text-blue-600 hover:text-blue-700">
            View Details
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FlyoverHealthOverview() {
  return (
    <div className="w-full bg-white rounded-xl2 shadow-card ring-1 ring-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-bold text-gray-900">Flyover Health Overview</h2>
        <button className="text-[12px] font-semibold text-blue-600 hover:text-blue-700">
          View All
        </button>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        {FLYOVERS.map((flyover) => (
          <FlyoverCard key={flyover.id} flyover={flyover} />
        ))}
      </div>
    </div>
  );
}