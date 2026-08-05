import { ShieldCheck } from "lucide-react";
export default function AlertMarquee({
  message = "No untoward incident reported",
  speed = 18, // seconds for one full pass — lower = faster
}) {
  // Repeat the message a few times so the strip never shows a gap while
  // scrolling, regardless of how short the text is.
  const items = Array.from({ length: 10 });

  return (
    <div className="relative flex h-[25px] items-center gap-3 bg-gradient-to-r from-emerald-500 to-emerald-600  rounded-xl2 shadow-card pl-4 pr-4 py-2 flex-shrink-0 overflow-hidden">
      {/* live pulse */}
      <div className="flex items-center gap-1.5 shrink-0 bg-white/95 rounded-full px-4.5 py-1 shadow-sm ">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
        </span>
        <span className="text-[11px] font-bold uppercase tracking-wide text-red-500">
          Live
        </span>
      </div>

      {/* <ShieldCheck size={16} className="text-white shrink-0" strokeWidth={2.2} /> */}

      {/* scrolling track */}
      <div className="relative flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-emerald-500 to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-emerald-600 to-transparent z-10" />

        <div
          className="flex w-max"
          style={{ animation: `marquee-scroll ${speed}s linear infinite` }}
        >
          {items.map((_, i) => (
            <span
              key={i}
              className="px-8 text-xs sm:text-sm font-semibold text-white whitespace-nowrap tracking-wide"
            >
              {message}
            </span>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes marquee-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="marquee-scroll"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
