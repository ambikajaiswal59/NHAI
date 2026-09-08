import React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

const ForceLogoutModal = ({ username, isLoading, onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[10000] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-xs w-full p-5 flex flex-col gap-3.5">
        <div className="flex items-center gap-3">
          <div className="bg-amber-100 rounded-full p-2 shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <h2 className="text-sm font-bold text-[#0F172A]">
            Already Logged In
          </h2>
        </div>

        <p className="text-xs text-gray-600 leading-relaxed">
          <span className="font-semibold">{username}</span> is already logged
          in on another device. Force log out that session and continue here?
        </p>

        <div className="flex gap-2 justify-end mt-1">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 rounded-lg disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-1.5 disabled:opacity-60"
          >
            {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isLoading ? "Logging out..." : "Force Logout & Continue"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForceLogoutModal;