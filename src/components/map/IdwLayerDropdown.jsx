// src/components/map/IdwLayerDropdown.jsx
import { useState } from "react";
import { ChevronDown, CloudSun } from "lucide-react";

const IDW_LAYER_OPTIONS = [
  { id: "temperature", label: "Temperature" },
  { id: "rainfall", label: "Rainfall" },
  { id: "wind", label: "Wind" },
];

export default function IdwLayerDropdown({
  selectedId,
  onSelect,
  isLoading,
  error,
}) {
  const [open, setOpen] = useState(false);

  const selectedLabel = IDW_LAYER_OPTIONS.find((o) => o.id === selectedId)?.label || "Weather";

  return (
    <div className="relative flex items-center gap-1.5">
      {/* Layer Dropdown */}
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 bg-white rounded-lg shadow-md ring-1 ring-gray-200 px-3 py-1 text-[12px] font-semibold text-gray-700 hover:bg-gray-50"
        >
          <CloudSun className="w-3.5 h-3.5 text-blue-500" />
          {selectedLabel}
          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-[499]" onClick={() => setOpen(false)} />
            <div className="absolute right-0 mt-1 w-32 bg-white rounded-lg shadow-lg ring-1 ring-gray-200 py-1 z-[500] overflow-hidden">
              <button
                onClick={() => {
                  onSelect(null);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-[12px] font-medium hover:bg-gray-50 ${!selectedId ? "text-blue-600 bg-blue-50" : "text-gray-700"}`}
              >
                None
              </button>
              {IDW_LAYER_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    onSelect(opt.id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between text-left px-3 py-2 text-[12px] font-medium hover:bg-gray-50 ${selectedId === opt.id ? "text-blue-600 bg-blue-100" : "text-gray-700"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>


      {error && (
        <div className="text-[10px] text-red-500 font-medium">
          ⚠️ Error
        </div>
      )}
    </div>
  );
}