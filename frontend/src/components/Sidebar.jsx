import React from 'react';
import {
  Shield,
  LayoutDashboard,
  MessageSquare,
  Search,
  FileText,
  FileCheck2,
  Users,
  Lock,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({
  activeTab,
  setActiveTab,
  mobileOpen,
  setMobileOpen,
}) {
  const { isAdmin } = useAuth();

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'chat',
      label: 'Knowledge Assistant',
      icon: MessageSquare,
    },
    {
      id: 'search',
      label: 'Hybrid Retrieval',
      icon: Search,
    },
    {
      id: 'documents',
      label: 'Document Registry',
      icon: FileText,
    },
    {
      id: 'users',
      label: 'Employee Directory',
      icon: Users,
      restricted: !isAdmin,
    },
    {
      id: 'audit',
      label: 'Security & Audit Logs',
      icon: FileCheck2,
      restricted: !isAdmin,
    },
    {
      id: 'policy',
      label: 'Access Control Matrix',
      icon: Shield,
    },
  ];

  function handleNavClick(tabId) {
    setActiveTab(tabId);
    if (mobileOpen) setMobileOpen(false);
  }

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Dark Navy Sidebar */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 w-64 bg-[#0B1221] border-r border-slate-800/80 flex flex-col justify-between transition-transform duration-200 ease-in-out select-none shrink-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top Section: Branding & Navigation */}
        <div className="flex flex-col flex-1 overflow-y-auto">
          <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800/70 shrink-0">
            <div
              className="flex items-center space-x-3 cursor-pointer"
              onClick={() => handleNavClick('dashboard')}
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white shadow-sm">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="font-semibold text-sm text-white tracking-tight block leading-tight">
                  TechNova
                </span>
                <span className="text-[11px] text-slate-400 block leading-tight">
                  Enterprise AI
                </span>
              </div>
            </div>

            <button
              onClick={() => setMobileOpen(false)}
              className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Close navigation menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <nav className="px-3 py-5 space-y-1 flex-1">
            <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Platform
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white font-semibold shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70 font-medium'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-white' : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.restricted && (
                    <Lock
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive ? 'text-blue-200' : 'text-slate-500'
                      }`}
                      title="Administrator privilege required"
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Subtle Platform Footer (no duplicate account controls) */}
        <div className="px-5 py-4 border-t border-slate-800/70 text-[11px] text-slate-500">
          TechNova Workspace
        </div>
      </aside>
    </>
  );
}
