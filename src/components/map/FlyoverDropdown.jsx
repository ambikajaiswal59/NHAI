import { useState } from "react";
import { ChevronDown, Waypoints, Check } from "lucide-react";

export default function FlyoverDropdown({
  flyovers,
  visibleIds,
  onToggle,
  onToggleAll,
}) {
  const [open, setOpen] = useState(false);

  const allSelected =
    flyovers.length > 0 && visibleIds.size === flyovers.length;
  const noneSelected = visibleIds.size === 0;

  const label = allSelected
    ? "Flyovers"
    : noneSelected
      ? "No Flyovers"
      : `${visibleIds.size} of ${flyovers.length} Flyovers`;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 bg-white rounded-lg shadow-md ring-1 ring-gray-200 px-3 py-1 text-[12px] font-semibold text-gray-700 hover:bg-gray-50"
      >
        <Waypoints className="w-3.5 h-3.5 text-blue-500" />
        {label}
        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-[499]"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-16 right-0 mt-2 w-26 bg-white rounded-lg shadow-lg ring-1 ring-gray-200 py-1 z-[500] overflow-hidden">
            <button
              onClick={onToggleAll}
              className="w-full text-left px-3 py-2 text-[14px] font-semibold text-blue-600 hover:bg-blue-200 border-b border-gray-100"
            >
              {allSelected ? "Clear all" : "Select all"}
            </button>
            {flyovers.map((f) => {
              const isChecked = visibleIds.has(f.id);
              return (
                <button
                  key={f.id}
                  onClick={() => onToggle(f.id)}
                  className={`
                    w-full flex items-center justify-between gap-2 text-left px-3 py-2 text-[12px] font-medium hover:bg-gray-50 transition-colors
                    ${isChecked ? 'text-gray-700 bg-blue-100' : 'text-gray-600 bg-white'}
                  `}
                >
                  <span className="truncate">{f.displayName}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}