import { useState, useRef, useEffect } from "react";
import { Layers, Check, X } from "lucide-react";

const BASE_LAYERS = [
  {
    id: "streets",
    name: "Streets",
    url: "https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
  },
  {
    id: "satellite",
    name: "Satellite",
    url: "https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
  },
];

export default function BaseLayerSwitcher({ activeLayer, onSelect }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      {/* Layer Control Button - Leaflet style like in FloodMap */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`
          flex items-center justify-center w-[34px] h-[34px]
          bg-white rounded-[4px] border-2
          transition-all duration-200 hover:bg-gray-50
          ${open
            ? 'border-blue-500 bg-blue-50 text-blue-600'
            : 'border-gray-400 text-gray-700 hover:border-gray-500'
          }
          focus:outline-none focus:ring-0
          leaflet-bar
        `}
        style={{
          boxShadow: '0 1px 5px rgba(0,0,0,0.1)',
        }}
        aria-label="Toggle base layer"
        title="Layer Control"
      >
        <Layers size={22} />
      </button>

      {/* Layer Control Panel - Same style as FloodMap */}
      {open && (
        <div
          className={`
            absolute top-0 left-full ml-2
            bg-white rounded-[4px] border-2 border-gray-300
            p-3 min-w-[110px] max-w-[130px]
            shadow-lg
          `}
          style={{
            boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
          }}
        >
          {/* Panel header */}
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200">
            <h3 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              Layers
            </h3>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full p-0.5 transition-all duration-200"
            >
              <X size={16} strokeWidth={3} />
            </button>
          </div>

          {/* Base Layer Section - Radio buttons style */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              BASE MAP
            </p>
            <div className="flex flex-col gap-1.5">
              {BASE_LAYERS.map((layer) => (
                <label
                  key={layer.id}
                  className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:text-blue-600 transition-colors"
                >
                  <input
                    type="radio"
                    name="baseLayer"
                    checked={activeLayer === layer.id}
                    onChange={() => {
                      onSelect(layer.id);

                    }}
                    className="w-3.5 h-3.5 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  <span className="flex items-center gap-1.5">
                    {layer.name}

                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { BASE_LAYERS };
