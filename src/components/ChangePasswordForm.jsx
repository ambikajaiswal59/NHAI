import React, { useState } from "react";
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { changePassword } from "../../src/services/api.js";

const ChangePasswordForm = ({ onSuccess, defaultUsername = "" }) => {
  const [username, setUsername] = useState(defaultUsername);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!username.trim() || !newPassword) {
      setErrorMsg("Username and new password are required.");
      setStatus("error");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    try {
      await changePassword({ username: username.trim(), newPassword });
      setStatus("success");
      setNewPassword("");
      setConfirmPassword("");
      onSuccess?.();
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        err.message?.includes("404")
          ? "User not found."
          : "Failed to change password. Please try again."
      );
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm bg-white rounded-xl shadow-md border border-gray-100 p-6 flex flex-col gap-4"
    >
      <h2 className="text-lg font-bold text-[#0F172A]">Change Password</h2>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-gray-600">Username</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={!!defaultUsername || status === "loading"}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1366D9] disabled:bg-gray-50 disabled:text-gray-500"
          placeholder="Enter username"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-gray-600">New Password</label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={status === "loading"}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm pr-9 focus:outline-none focus:ring-2 focus:ring-[#1366D9]"
            placeholder="Enter new password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((p) => !p)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-gray-600">Confirm Password</label>
        <input
          type={showPassword ? "text" : "password"}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={status === "loading"}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1366D9]"
          placeholder="Re-enter new password"
        />
      </div>

      {status === "error" && (
        <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
          <XCircle className="w-4 h-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      {status === "success" && (
        <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Password changed successfully.
        </div>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full bg-[#1366D9] text-white text-sm font-bold py-2.5 rounded-lg hover:bg-[#0F52B5] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {status === "loading" && <Loader2 className="w-4 h-4 animate-spin" />}
        {status === "loading" ? "Updating..." : "Change Password"}
      </button>
    </form>
  );
};

export default ChangePasswordForm;