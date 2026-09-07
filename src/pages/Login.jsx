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
          {/* NHAI LOGO */}
          <div className="flex justify-center mb-6">
            <div className="h-16 w-16 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden">
              <img
                src={NHAILOGO}
                alt="NHAI Logo"
                className="h-12 w-12 object-contain"
              />
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
