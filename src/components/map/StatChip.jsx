// Small stat chip used inside FlyoverDetailsPanel's summary grid.
export default function StatChip({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5 bg-gray-50 rounded-lg px-2 py-1.5 min-w-0 border border-gray-100">
      <span className="text-[9px] text-gray-400 uppercase tracking-wide truncate">
        {label}
      </span>
      <span className="text-[13px] font-bold text-gray-800 truncate">
        {value}
      </span>
    </div>
  );
}