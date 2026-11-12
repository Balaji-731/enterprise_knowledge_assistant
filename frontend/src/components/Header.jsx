import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  ShieldCheck,
  ChevronRight,
  Bell,
  ChevronDown,
  LogOut,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getUserInitials } from '../utils/user';
import { api } from '../services/api';

const PAGE_META = {
  dashboard: { title: 'Dashboard', section: 'Overview' },
  chat: { title: 'Knowledge Assistant', section: 'Intelligence' },
  search: { title: 'Hybrid Retrieval Engine', section: 'Inspection' },
  documents: { title: 'Document Registry & Ingestion', section: 'Repository' },
  users: { title: 'Employee Directory & Provisioning', section: 'Administration' },
  audit: { title: 'Security & Audit Logs', section: 'Governance' },
  policy: { title: 'Access Control Matrix', section: 'Governance' },
};

export default function Header({
  activeTab,
  setActiveTab,
  onToggleMobileSidebar,
  onRequestSignOut,
}) {
  const { user } = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [healthStatus, setHealthStatus] = useState(null);

  const profileRef = useRef(null);
  const notifRef = useRef(null);

  const currentPersona = {
    name: user?.full_name || user?.username,
    initials: getUserInitials(user?.full_name, user?.username),
    email: user?.email || `${user?.username}@technova.com`,
  };

  useEffect(() => {
    function handleOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    api
      .getHealth()
      .then((res) => setHealthStatus(res))
      .catch(() => setHealthStatus({ status: 'unreachable' }));
  }, []);

  const meta = PAGE_META[activeTab] || { title: 'Workspace', section: 'TechNova' };

  return (
    <header className="h-16 bg-white/95 backdrop-blur-sm border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Mobile Menu + Breadcrumbs + Page Title */}
      <div className="flex items-center space-x-3 min-w-0">
        <button
          onClick={onToggleMobileSidebar}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 font-medium">
            <span>TechNova</span>
            <ChevronRight className="w-3 h-3 text-slate-300" />
            <span>{meta.section}</span>
          </div>
          <h1 className="text-sm sm:text-base font-semibold text-slate-900 tracking-tight truncate">
            {meta.title}
          </h1>
        </div>
      </div>

      {/* Right: Access Scope Pill, Notifications, Profile Dropdown */}
      <div className="flex items-center space-x-2.5 sm:space-x-3">
        {/* Role & Department Clearance Pill */}
        <button
          onClick={() => setActiveTab('policy')}
          className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs text-slate-700 transition-colors"
          title="View effective access permissions"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="text-slate-500">Scope:</span>
          <span className="font-semibold text-slate-900 capitalize">{user?.role}</span>
          <span className="text-slate-300">•</span>
          <span className="text-slate-700 capitalize">{user?.department}</span>
        </button>

        {/* System Status / Notifications Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen((prev) => !prev)}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-colors relative"
            aria-label="System notifications"
            title="System status and session info"
          >
            <Bell className="w-4 h-4" />
            <span
              className={`w-2 h-2 rounded-full absolute top-1.5 right-1.5 ring-2 ring-white ${
                healthStatus?.status === 'healthy' ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-lg p-3 z-50 text-xs page-enter">
              <div className="font-semibold text-slate-900 pb-2 border-b border-slate-100 flex items-center justify-between">
                <span>Session & System Status</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    healthStatus?.status === 'healthy'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {healthStatus?.status === 'healthy' ? 'Operational' : 'Checking'}
                </span>
              </div>

              <div className="pt-2.5 space-y-2 text-slate-600">
                <div className="flex items-start space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-slate-800">RBAC/ABAC Guard Active</p>
                    <p className="text-[11px] text-slate-500">
                      Queries filtered for {user?.role} in {user?.department}.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-slate-800">API Gateway Connected</p>
                    <p className="text-[11px] text-slate-500">
                      {healthStatus?.service || 'TechNova FastAPI Backend'} (v{healthStatus?.version || '1.0.0'})
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileMenuOpen((prev) => !prev)}
            className="flex items-center space-x-2 pl-1.5 pr-2.5 py-1 rounded-lg hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-colors"
            aria-label="User profile menu"
          >
            <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-semibold text-xs">
              {currentPersona.initials}
            </div>
            <span className="hidden sm:inline text-xs font-medium text-slate-700">
              {currentPersona.name}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {profileMenuOpen && (
            <div className="absolute right-0 mt-2 w-60 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50 text-xs page-enter">
              <div className="px-3.5 py-2.5 border-b border-slate-100">
                <p className="font-semibold text-slate-900 truncate">{currentPersona.name}</p>
                <p className="text-[11px] text-slate-500 truncate">{currentPersona.email}</p>
                <div className="flex items-center space-x-1.5 mt-2">
                  <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium text-[10px] capitalize border border-blue-100">
                    {user?.role}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[10px] capitalize border border-slate-200">
                    {user?.department}
                  </span>
                </div>
              </div>

              <div className="pt-1">
                <button
                  onClick={() => {
                    setProfileMenuOpen(false);
                    onRequestSignOut();
                  }}
                  className="w-full px-3.5 py-2 text-left text-red-600 hover:bg-red-50 flex items-center space-x-2 transition-colors font-medium"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
