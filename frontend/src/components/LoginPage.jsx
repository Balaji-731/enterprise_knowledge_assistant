import React, { useState } from 'react';
import {
  Shield,
  ShieldCheck,
  Search,
  BookOpen,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const CAPABILITIES = [
  {
    icon: ShieldCheck,
    title: 'Secure enterprise knowledge access',
    desc: 'Role-based and department-level access policies evaluated before any passage is retrieved.',
  },
  {
    icon: Search,
    title: 'AI-powered document retrieval',
    desc: 'Hybrid dense embeddings and BM25 lexical search fused via RRF and cross-encoder reranking.',
  },
  {
    icon: BookOpen,
    title: 'Verified answers with citations',
    desc: 'Grounded synthesis linked directly to authoritative policy titles, sections, and page numbers.',
  },
];

export default function LoginPage() {
  const { login, submitting, authError } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState(null);

  async function handleFormSubmit(e) {
    e.preventDefault();
    setLocalError(null);
    if (!username.trim() || !password) {
      setLocalError('Please enter both your corporate username and password.');
      return;
    }
    try {
      await login(username, password);
    } catch (err) {
      setLocalError(err.message || 'Authentication failed. Please verify your credentials.');
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 font-sans bg-[#F5F7FA]">
      {/* Left Brand & Value Proposition Section (Deep Navy) */}
      <section className="hidden lg:flex lg:col-span-5 xl:col-span-5 bg-gradient-to-br from-[#070B14] via-[#0F172A] to-[#172554] text-white p-10 xl:p-14 flex-col justify-between relative overflow-hidden">
        <div className="relative z-10 space-y-10">
          {/* Branding */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-md">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-white block leading-none">
                TechNova
              </span>
              <span className="text-xs text-blue-300/90 mt-1 block">
                Enterprise Platform
              </span>
            </div>
          </div>

          {/* Hero Title & Copy */}
          <div className="space-y-4">
            <h1 className="text-3xl xl:text-4xl font-bold tracking-tight text-white leading-tight">
              Enterprise AI Knowledge Assistant
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed max-w-md">
              Discover authoritative corporate policies, engineering standards, and operational guidelines through permission-aware retrieval and cited AI synthesis.
            </p>
          </div>

          {/* 3 Key Capabilities */}
          <div className="space-y-3.5 pt-2">
            {CAPABILITIES.map((cap, idx) => {
              const Icon = cap.icon;
              return (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-white/[0.04] border border-white/10 flex items-start space-x-3.5 hover:bg-white/[0.06] transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-blue-500/20 border border-blue-400/20 flex items-center justify-center shrink-0 text-blue-300">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-white">
                      {cap.title}
                    </h2>
                    <p className="text-xs text-slate-300/80 mt-0.5 leading-relaxed">
                      {cap.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Left Footer */}
        <div className="relative z-10 text-xs text-slate-400 pt-8 border-t border-white/10 flex items-center justify-between">
          <span>TechNova Solutions Knowledge Platform</span>
          <span className="text-slate-500">RBAC / ABAC Protected</span>
        </div>
      </section>

      {/* Right Authentication Card Section */}
      <section className="lg:col-span-7 xl:col-span-7 flex flex-col justify-center items-center p-6 sm:p-10">
        {/* Mobile Branding Header */}
        <div className="lg:hidden flex items-center space-x-2.5 mb-6">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-base text-slate-900 block leading-none">
              TechNova
            </span>
            <span className="text-xs text-slate-500">
              Enterprise AI Knowledge Assistant
            </span>
          </div>
        </div>

        {/* White Sign-In Card */}
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm p-7 sm:p-8 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Sign in to your account
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Authenticate with your corporate username and password.
            </p>
          </div>

          {(authError || localError) && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{authError || localError}</span>
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-username"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Corporate Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                <input
                  id="login-username"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your corporate username"
                  className="w-full pl-10 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/15 transition-all"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/15 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center space-x-2 transition-all shadow-xs"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-100 text-center text-[11px] text-slate-400">
            Account access is managed by your TechNova System Administrator.
          </div>
        </div>
      </section>
    </div>
  );
}
