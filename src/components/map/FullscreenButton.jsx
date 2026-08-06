import { Maximize, Minimize } from "lucide-react";

export default function FullscreenButton({ isFullscreen, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className={`
        relative group flex items-center justify-center 
        bg-white shadow-sm
        w-[34px] h-[34px]
        border border-[#888]  // ← Even darker
        transition-all duration-150 
        hover:bg-[#f4f4f4] hover:border-[#555]  // ← Darker on hover
        active:bg-[#e6e6e6] active:border-[#555]
        ${isFullscreen
          ? 'text-blue-600 border-[#888] bg-blue-50 hover:bg-blue-100'
          : 'text-[#333]'
        }
      `}
      style={{
        borderRadius: '5px',
        fontSize: '18px',
        fontWeight: 'bold',
        lineHeight: '30px',
        cursor: 'pointer',
        outline: 'none',
        fontFamily: '"Helvetica Neue", Arial, sans-serif',
        boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
        border: '3px solid #ccc',
        background: '#fff',
      }}
      aria-label="Toggle fullscreen"
    >
      {isFullscreen ? (
        <Minimize className="w-3.5 h-3.5" strokeWidth={2.5} />
      ) : (
        <Maximize className="w-3.5 h-3.5" strokeWidth={2.5} />
      )}
    </button>
  );
}