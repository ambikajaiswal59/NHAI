import { Maximize, Minimize } from "lucide-react";

export default function FullscreenButton({ isFullscreen, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className={`
        flex mt-2 items-center justify-center w-[34px] h-[34px]
        bg-white rounded-[4px] border-2
        transition-all duration-200 hover:bg-gray-50
        ${isFullscreen
          ? 'border-blue-500 bg-blue-50 text-blue-600'
          : 'border-gray-400 text-gray-700 hover:border-gray-500'
        }
        focus:outline-none focus:ring-0
        leaflet-bar
      `}
      style={{
        boxShadow: '0 1px 5px rgba(0,0,0,0.1)',
      }}
      aria-label="Toggle fullscreen"
      title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
    >
      {isFullscreen ? (
        <Minimize className="w-4 h-4" strokeWidth={2.5} />
      ) : (
        <Maximize className="w-4 h-4" strokeWidth={2.5} />
      )}
    </button>
  );
}