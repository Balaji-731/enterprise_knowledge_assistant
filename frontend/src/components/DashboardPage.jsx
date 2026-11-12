import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  FileText,
  Users,
  Building2,
  Shield,
  ArrowRight,
  Search,
  UploadCloud,
  CheckCircle2,
  Lock,
  Activity,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { OutcomeBadge, StatusBadge } from './ui/StatusBadge';
import { CardSkeleton } from './ui/Skeleton';
import EmptyState from './ui/EmptyState';

// Authoritative category rules matching src/ingestion/policy.py
const POLICY_RULES = [
  { code: 'HR', roles: ['employee', 'hr', 'manager', 'administrator'], depts: ['all'] },
  { code: 'ENGINEERING', roles: ['employee', 'hr', 'manager', 'administrator'], depts: ['engineering'] },
  { code: 'FINANCE', roles: ['manager', 'administrator'], depts: ['finance', 'executive'] },
  { code: 'OPERATIONS', roles: ['employee', 'hr', 'manager', 'administrator'], depts: ['operations'] },
  { code: 'ADMINISTRATION', roles: ['administrator'], depts: ['all'] },
];

export default function DashboardPage({
  onNavigate,
  onAskAboutDocument,
}) {
  const { user, isAdmin, canUpload } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [userCount, setUserCount] = useState(null);
  const [health, setHealth] = useState(null);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const loadDashboardData = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const [docsRes, healthRes] = await Promise.allSettled([
        api.listDocuments(),
        api.getHealth(),
      ]);

      if (docsRes.status === 'fulfilled') {
        setDocuments(docsRes.value || []);
      }
      if (healthRes.status === 'fulfilled') {
        setHealth(healthRes.value);
      } else {
        setHealth({ status: 'offline' });
      }
    } finally {
      setLoadingDocs(false);
    }

    if (isAdmin) {
      setLoadingAudit(true);
      try {
        const [logsRes, usersRes] = await Promise.allSettled([
          api.getAuditLogs(null, null, 6, 0),
          api.listUsers(),
        ]);
        setAuditLogs(logsRes.status === 'fulfilled' ? logsRes.value || [] : []);
        setUserCount(usersRes.status === 'fulfilled' ? (usersRes.value || []).length : null);
      } catch {
        setAuditLogs([]);
        setUserCount(null);
      } finally {
        setLoadingAudit(false);
      }
    } else {
      setAuditLogs([]);
      setUserCount(null);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Calculate how many corporate policies current user can access
  const permittedPolicyCount = POLICY_RULES.filter((rule) => {
    if (user?.role === 'administrator') return true;
    const roleOk = rule.roles.includes(user?.role);
    const deptOk = rule.depts.includes('all') || rule.depts.includes(user?.department);
    return roleOk && deptOk;
  }).length;

  const totalRevisions = documents.reduce((acc, d) => acc + (d.total_versions || 1), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 page-enter">
      {/* Welcome Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative overflow-hidden">
        <div className="space-y-1.5 relative z-10">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-[11px] font-semibold">
            <Sparkles className="w-3 h-3" />
            <span>Enterprise Knowledge Workspace</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Welcome back, {user?.full_name || user?.username}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl">
            Authenticated as <span className="font-semibold text-slate-800 capitalize">{user?.role}</span> in the{' '}
            <span className="font-semibold text-slate-800 capitalize">{user?.department}</span> department. All retrieval and AI responses enforce zero-leakage permission policies.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0 relative z-10">
          <button
            onClick={() => onNavigate('chat')}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold flex items-center space-x-2 transition-colors shadow-xs"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Open Knowledge Assistant</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={loadDashboardData}
            className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 transition-colors"
            title="Refresh dashboard telemetry"
            aria-label="Refresh dashboard"
          >
            <RefreshCw className={`w-4 h-4 ${loadingDocs ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Registered Documents */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-start justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 block">
              Authorized Documents
            </span>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {loadingDocs ? '—' : documents.length}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              {totalRevisions} indexed version{totalRevisions === 1 ? '' : 's'} in scope
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 2: Provisioned Accounts */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-start justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 block">
              {isAdmin ? 'Provisioned Employees' : 'Active Session'}
            </span>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {isAdmin ? (userCount ?? '—') : `@${user?.username}`}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block capitalize">
              {isAdmin ? `Signed in as @${user?.username}` : `${user?.role} · ${user?.department}`}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3: Departments */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-start justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 block">
              Corporate Departments
            </span>
            <div className="text-2xl font-bold text-slate-900 mt-1">5</div>
            <span className="text-[11px] text-slate-400 mt-1 block capitalize">
              Your dept: {user?.department}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 4: Access Policies */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-start justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 block">
              Access Policies
            </span>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {permittedPolicyCount} <span className="text-sm font-medium text-slate-400">/ 5</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Categories permitted for {user?.role}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <Shield className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Content Two-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Recent Documents + Recent Audit Activity */}
        <div className="lg:col-span-8 space-y-6">
          {/* Recent Document Activity */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Authorized Documents
                </h3>
                <p className="text-xs text-slate-500">
                  Active corporate documents permitted under your current RBAC/ABAC profile.
                </p>
              </div>
              <button
                onClick={() => onNavigate('documents')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center space-x-1 transition-colors"
              >
                <span>View Registry</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {loadingDocs ? (
              <div className="p-4">
                <CardSkeleton rows={3} />
              </div>
            ) : documents.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No authorized documents available"
                description="No active documents match your current department and role clearance, or none have been uploaded yet."
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {documents.slice(0, 5).map((doc) => (
                  <div
                    key={doc.id}
                    className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                        <FileText className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                          {doc.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                          <span className="font-medium text-slate-700">{doc.category}</span>
                          <span>•</span>
                          <span className="font-mono text-emerald-700 font-medium">
                            v{doc.active_version || '1.0'}
                          </span>
                          {doc.created_at && (
                            <>
                              <span>•</span>
                              <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onAskAboutDocument(doc.title)}
                      className="shrink-0 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-200 text-xs font-medium transition-colors"
                    >
                      Ask AI
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Audit Activity */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Recent Audit Activity
                </h3>
                <p className="text-xs text-slate-500">
                  Real-time security ledger of authentications, queries, and uploads.
                </p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => onNavigate('audit')}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center space-x-1 transition-colors"
                >
                  <span>Full Ledger</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {!isAdmin ? (
              <div className="p-6 flex items-start space-x-3 bg-slate-50/40">
                <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900">
                    Administrator privilege required
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 max-w-md">
                    Organization-wide audit logs are protected by RBAC and visible only to System Administrators. Sign out and log in with an Administrator account to inspect them.
                  </p>
                </div>
              </div>
            ) : loadingAudit ? (
              <div className="p-4">
                <CardSkeleton rows={4} />
              </div>
            ) : auditLogs.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No audit events recorded"
                description="Audit events will appear here as users authenticate, upload documents, or run queries."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-2.5">User</th>
                      <th className="px-4 py-2.5">Action</th>
                      <th className="px-4 py-2.5">Outcome</th>
                      <th className="px-5 py-2.5">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/60">
                        <td className="px-5 py-2.5 font-medium text-slate-900">
                          @{log.username}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600">
                          {log.action}
                        </td>
                        <td className="px-4 py-2.5">
                          <OutcomeBadge outcome={log.outcome} />
                        </td>
                        <td className="px-5 py-2.5 text-slate-400 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right: Quick Actions + System Status Overview */}
        <div className="lg:col-span-4 space-y-6">
          {/* Quick Actions */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3.5">
            <h3 className="text-sm font-semibold text-slate-900">Quick Actions</h3>

            <div className="space-y-2">
              <button
                onClick={() => onNavigate('chat')}
                className="w-full p-3 rounded-xl bg-slate-50 hover:bg-blue-50/70 border border-slate-200 hover:border-blue-200 flex items-center justify-between text-left transition-colors group"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-900 block">
                      Ask Knowledge Assistant
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Grounded answers with citations
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
              </button>

              <button
                onClick={() => onNavigate('search')}
                className="w-full p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 flex items-center justify-between text-left transition-colors group"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center">
                    <Search className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-900 block">
                      Inspect Hybrid Retrieval
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Dense vector + BM25 + RRF scores
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-colors" />
              </button>

              <button
                onClick={() => onNavigate('documents')}
                className="w-full p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 flex items-center justify-between text-left transition-colors group"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center">
                    <UploadCloud className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-900 block">
                      {canUpload ? 'Upload & Ingest Policy' : 'Browse Document Registry'}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {canUpload ? 'HR & Admin ingestion pipeline' : 'Authorized corporate documents'}
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-colors" />
              </button>

              <button
                onClick={() => onNavigate('policy')}
                className="w-full p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 flex items-center justify-between text-left transition-colors group"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-900 block">
                      Access Control Matrix
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Review category clearance rules
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-colors" />
              </button>

              {isAdmin && (
                <button
                  onClick={() => onNavigate('users')}
                  className="w-full p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 flex items-center justify-between text-left transition-colors group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-900 block">
                        Manage Employees
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Add users & assign role permissions
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-colors" />
                </button>
              )}
            </div>
          </div>

          {/* System Status Overview */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                System Status Overview
              </h3>
              <StatusBadge
                label={health?.status === 'healthy' ? 'Healthy' : 'Checking'}
                variant={health?.status === 'healthy' ? 'success' : 'warning'}
              />
            </div>

            <div className="space-y-2.5 text-xs pt-1">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">API Service</span>
                <span className="font-medium text-slate-900 flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>FastAPI v{health?.version || '1.0.0'}</span>
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Vector & Lexical Store</span>
                <span className="font-medium text-slate-900">ChromaDB + BM25</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Cross-Encoder Reranker</span>
                <span className="font-mono text-[11px] text-slate-700">ms-marco-MiniLM-L-6-v2</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-500">Local LLM Runtime</span>
                <span className="font-mono text-[11px] text-slate-700">Ollama (llama3.2:latest)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
