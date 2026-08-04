import { Maximize, Minimize } from "lucide-react";

export default function FullscreenButton({ isFullscreen, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-center bg-white rounded-lg shadow-md ring-1 ring-gray-200 w-9 h-9 hover:bg-gray-50"
      aria-label="Toggle fullscreen"
    >
      {isFullscreen ? <Minimize className="w-4 h-4 text-gray-600" /> : <Maximize className="w-4 h-4 text-gray-600" />}
    </button>
  );
}