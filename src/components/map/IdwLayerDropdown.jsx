import { useState } from "react";
import { ChevronDown, Layers, Calendar } from "lucide-react";

const IDW_LAYER_OPTIONS = [
  { id: "temperature", label: "Temperature" },
  { id: "rainfall", label: "Rainfall" },
  { id: "wind", label: "Wind" },
];

export default function IdwLayerDropdown({
  selectedId,
  onSelect,
  selectedDate,      // ← Add this
  onDateChange,      // ← Add this
  isLoading,         // ← Add this
  dataCount,         // ← Add this
  error              // ← Add this
}) {
  const [open, setOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [tempDate, setTempDate] = useState(selectedDate || '');

  const selectedLabel =
    IDW_LAYER_OPTIONS.find((o) => o.id === selectedId)?.label || "Weather";

  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return "Select Date";
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleDateInputChange = (e) => {
    const value = e.target.value;
    setTempDate(value);
    if (value) {
      onDateChange(value);
      setDatePickerOpen(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const maxDateObj = new Date();
  maxDateObj.setDate(maxDateObj.getDate() + 7);
  const maxDate = maxDateObj.toISOString().split('T')[0];

  return (
    <div className="relative flex items-center gap-1.5">
      {/* ===== DATE PICKER - ADD THIS ===== */}
      <div className="relative">
        <button
          onClick={() => setDatePickerOpen(!datePickerOpen)}
          className="flex items-center gap-1.5 bg-white rounded-lg shadow-md ring-1 ring-gray-200 px-2.5 py-2 text-[12px] font-semibold text-gray-700 hover:bg-gray-50"
        >
          <Calendar className="w-3.5 h-3.5 text-gray-500" />
          <span className="min-w-[70px]">{formatDisplayDate(selectedDate)}</span>
          <ChevronDown className="w-3 h-3 text-gray-400" />
        </button>

        {datePickerOpen && (
          <>
            <div className="fixed inset-0 z-[499]" onClick={() => setDatePickerOpen(false)} />
            <div className="absolute right-0 mt-1 top-full bg-white rounded-lg shadow-lg ring-1 ring-gray-200 p-3 z-[500] w-[240px]">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-gray-600">Select Date</label>
                  <span className="text-[9px] text-gray-400">(Next 7 days)</span>
                </div>
                <input
                  type="date"
                  value={tempDate || selectedDate || ''}
                  onChange={handleDateInputChange}
                  min={today}
                  max={maxDate}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
                <div className="text-[9px] text-gray-400 mt-1 text-center">
                  Showing {formatDisplayDate(today)} to {formatDisplayDate(maxDate)}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ===== IDW LAYER DROPDOWN ===== */}
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 bg-white rounded-lg shadow-md ring-1 ring-gray-200 px-3 py-2 text-[12px] font-semibold text-gray-700 hover:bg-gray-50"
        >
          <Layers className="w-3.5 h-3.5 text-blue-500" />
          {selectedLabel}
          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-[499]" onClick={() => setOpen(false)} />
            <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg ring-1 ring-gray-200 py-1 z-[500] overflow-hidden">
              <button
                onClick={() => {
                  onSelect(null);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-[12px] font-medium hover:bg-gray-50 ${!selectedId ? "text-blue-600 bg-blue-50" : "text-gray-700"
                  }`}
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
                  className={`w-full flex items-center justify-between text-left px-3 py-2 text-[12px] font-medium hover:bg-gray-50 ${selectedId === opt.id
                    ? "text-blue-600 bg-blue-50"
                    : "text-gray-700"
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ===== STATUS INDICATORS ===== */}
      {isLoading && (
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-[10px] text-blue-600 font-medium">Loading...</span>
        </div>
      )}
      {error && !isLoading && (
        <span className="text-[10px] text-red-600 font-medium">{error}</span>
      )}
      {/* {!isLoading && !error && dataCount > 0 && selectedId && (
        <span className="text-[10px] text-green-600 font-medium">
          {dataCount} stations
        </span>
      )} */}
    </div>
  );
}