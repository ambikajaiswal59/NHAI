// src/pages/Login.jsx

import { useState } from "react";
import { Lock, User, Eye, EyeOff } from "lucide-react";

import NHAILOGO from "../assets/NHAILOGO.png";
import { loginUser } from "../services/api";
import TechBackground from "../components/TechBackground";

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Enter both a username and password.");
      return;
    }

    setLoading(true);

    try {
      const data = await loginUser({
        username,
        password,
      });

      const loggedInUser = {
        name: data.name,
        username: data.username,
        email: data.email,
        role: data.role,
        userId: data.user_id,
      };

      sessionStorage.setItem("authToken", data.access_token);

      sessionStorage.setItem("authUser", JSON.stringify(loggedInUser));

      onLoginSuccess?.(loggedInUser);
    } catch (err) {
      setError(
        err.message ||
          "Couldn't sign in. Check your credentials and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0b1329] flex items-center justify-center px-6 py-12">
      {/* =====================================================
          ANIMATED NHAI TECH BACKGROUND
      ====================================================== */}
      <TechBackground />

      {/* =====================================================
          LOGIN CONTENT
      ====================================================== */}
      <div className="relative z-10 w-full max-w-sm">
        {/* Login Card */}
        <div className="bg-white/95 backdrop-blur-md rounded-xl border border-white/30 shadow-2xl px-8 py-9">
          {/* NHAI 3D LOGO */}
          {/* NHAI 3D LOGO */}
          <div className="flex justify-center mb-6">
            <div className="relative group">
              {/* Outer glow */}
              <div className="absolute -inset-4 rounded-full bg-cyan-400/20 blur-2xl opacity-70" />

              {/* ROTATING OUTER RING */}
              <div className="absolute -inset-[4px] rounded-full animate-[spin_8s_linear_infinite]">
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-300 border-r-blue-500 border-b-cyan-500" />

                {/* Rotating highlight */}
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_14px_#00f0ff]" />
              </div>

              {/* SECOND ROTATING RING - opposite direction */}
              <div className="absolute -inset-[8px] rounded-full animate-[spin_14s_linear_infinite_reverse]">
                <div className="absolute inset-0 rounded-full border border-cyan-400/30 border-l-transparent border-b-transparent" />
              </div>

              {/* Main 3D circular body */}
              <div
                className="relative h-24 w-24 rounded-full p-[3px]
      bg-gradient-to-br from-cyan-300 via-blue-600 to-cyan-800
      shadow-[0_0_30px_rgba(0,240,255,0.4)]"
              >
                {/* Dark inner surface */}
                <div
                  className="relative h-full w-full rounded-full
        bg-gradient-to-br from-[#102a4c] via-[#0b1935] to-[#06101f]
        flex items-center justify-center overflow-hidden"
                >
                  {/* Static inner technical rings */}
                  <div className="absolute inset-[5px] rounded-full border border-cyan-300/30" />
                  <div className="absolute inset-[9px] rounded-full border border-cyan-400/10" />

                  {/* Glass reflection */}
                  <div
                    className="absolute -top-8 left-3 w-16 h-12
          bg-white/20 rounded-full blur-xl rotate-[-25deg]"
                  />

                  {/* NHAI logo - stays completely still */}
                  <div
                    className="relative h-16 w-16 rounded-full
          bg-white flex items-center justify-center
          shadow-[0_0_20px_rgba(0,240,255,0.35)]
          border border-cyan-100/60"
                  >
                    <img
                      src={NHAILOGO}
                      alt="NHAI Logo"
                      className="h-12 w-12 object-contain
              drop-shadow-[0_3px_4px_rgba(0,0,0,0.25)]"
                    />
                  </div>

                  {/* Bottom cyan reflection */}
                  <div
                    className="absolute bottom-0 left-1/2
          -translate-x-1/2 w-14 h-3
          bg-cyan-400/30 blur-lg"
                  />
                </div>
              </div>

              {/* Orbiting dots */}
              <span
                className="absolute top-0 right-0 h-2 w-2 rounded-full
        bg-cyan-300 shadow-[0_0_12px_#00f0ff]
        animate-pulse"
              />

              <span
                className="absolute bottom-1 left-0 h-1.5 w-1.5 rounded-full
        bg-blue-400 shadow-[0_0_8px_#008cff]
        animate-pulse"
                style={{ animationDelay: "700ms" }}
              />
            </div>
          </div>
          {/* Project Title */}
          <div className="text-center mb-6 px-1">
            <h1 className="text-[15px] leading-[1.15] font-bold tracking-[-0.02em] text-slate-900  whitespace-nowrap">
              AI Risk Intelligence & Remote Monitoring System
            </h1>

            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[8px] font-medium leading-tight">
              <span className="text-slate-400">•</span>
              <span className="text-blue-600">Smart Monitoring</span>

              <span className="text-slate-400">•</span>
              <span className="text-green-600">Predictive Insights</span>

              <span className="text-slate-400">•</span>
              <span className="text-orange-600">Safer Highways</span>
            </div>
          </div>
          {/* =================================================
              LOGIN FORM
          ================================================== */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* USERNAME */}
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Username
              </label>

              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />

                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 bg-white/90 focus:outline-none focus:ring-2 focus:ring-[#1D5FD1]/30 focus:border-[#1D5FD1]"
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Password
              </label>

              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />

                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 bg-white/90 focus:outline-none focus:ring-2 focus:ring-[#1D5FD1]/30 focus:border-[#1D5FD1]"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* ERROR */}
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* SIGN IN */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-[#1D5FD1] text-white text-sm font-medium hover:bg-[#164AAD] transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        {/* AUTHORIZATION NOTICE */}
        <p className="mt-6 text-center text-xs text-white/60">
          Authorized personnel only. Access is logged and monitored.
        </p>
      </div>
    </div>
  );
}
