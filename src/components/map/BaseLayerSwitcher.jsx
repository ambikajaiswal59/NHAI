import { useState, useRef, useEffect } from "react";
import { Layers, Check } from "lucide-react";

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
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="
          flex
          h-[30px] w-[30px]
          sm:h-[34px] sm:w-[34px]
          items-center
          justify-center
          rounded-lg
          border border-gray-200
          bg-white
          shadow-md
          transition
          hover:bg-gray-50
        "
        aria-label="Toggle base layer"
      >
        <Layers className="h-4 w-4 sm:h-5 sm:w-5 text-gray-700" />
      </button>

      {open && (
        <div
          className="
            absolute
            left-0
            top-full
            mt-2
            w-36 sm:w-40
            rounded-lg
            border border-gray-200
            bg-white
            py-1
            shadow-lg
          "
        >
          {BASE_LAYERS.map((layer) => (
            <button
              key={layer.id}
              type="button"
              onClick={() => {
                onSelect(layer.id);
                setOpen(false);
              }}
              className="
                flex
                w-full
                items-center
                justify-between
                px-3
                py-2
                text-left
                text-xs sm:text-sm
                text-gray-700
                hover:bg-gray-50
              "
            >
              <span>{layer.name}</span>

              {activeLayer === layer.id && (
                <Check className="h-3.5 w-3.5 text-blue-500" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { BASE_LAYERS };