import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Lock,
  LogOut,
  Search,
  Activity,
  CheckCircle2,
  XCircle,
  KeyRound,
  MessageSquare,
  UploadCloud,
  Calendar,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { OutcomeBadge } from './ui/StatusBadge';
import { TableSkeleton } from './ui/Skeleton';
import EmptyState from './ui/EmptyState';

export default function AuditDashboard({ onRequestSignOut }) {
  const { isAdmin } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAuditLogs(null, null, 200, 0);
      setLogs(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchLogs();
    } else {
      setLoading(false);
    }
  }, [isAdmin, fetchLogs]);

  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-5 page-enter">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-600 shadow-xs">
          <Lock className="w-6 h-6" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-base font-bold text-slate-900">
            Security & Audit Logs Restricted
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            Access to organization-wide security events and compliance trails is enforced at the API level and restricted to users with the <strong>Administrator</strong> role. Please sign out and log in with an Administrator account.
          </p>
        </div>

        {onRequestSignOut && (
          <button
            onClick={onRequestSignOut}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold inline-flex items-center space-x-2 transition-colors shadow-xs"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out to Re-Authenticate</span>
          </button>
        )}
      </div>
    );
  }

  // Real metrics computed strictly from fetched audit logs
  const totalEvents = logs.length;
  const successCount = logs.filter((l) => l.outcome === 'SUCCESS').length;
  const deniedCount = logs.filter((l) => l.outcome === 'DENIED' || l.outcome === 'REFUSED').length;
  const authCount = logs.filter((l) => l.action === 'AUTH_LOGIN').length;
  const queryCount = logs.filter((l) => l.action?.startsWith('QUERY_')).length;
  const ingestionCount = logs.filter((l) => l.action === 'DOC_UPLOAD').length;

  const filteredLogs = logs.filter((log) => {
    if (actionFilter && log.action !== actionFilter) return false;
    if (outcomeFilter && log.outcome !== outcomeFilter) return false;
    if (userFilter.trim()) {
      const q = userFilter.trim().toLowerCase();
      const match =
        log.username?.toLowerCase().includes(q) ||
        log.resource?.toLowerCase().includes(q) ||
        log.details?.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (dateFrom) {
      const logDate = new Date(log.timestamp);
      const from = new Date(`${dateFrom}T00:00:00`);
      if (logDate < from) return false;
    }
    if (dateTo) {
      const logDate = new Date(log.timestamp);
      const to = new Date(`${dateTo}T23:59:59`);
      if (logDate > to) return false;
    }
    return true;
  });

  const kpis = [
    { label: 'Total Audit Events', value: totalEvents, icon: Activity, color: 'text-blue-600 bg-blue-50 border-blue-100' },
    { label: 'Successful Actions', value: successCount, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
    { label: 'Denied / Refused', value: deniedCount, icon: XCircle, color: 'text-red-600 bg-red-50 border-red-100' },
    { label: 'Auth Events', value: authCount, icon: KeyRound, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
    { label: 'Query Events', value: queryCount, icon: MessageSquare, color: 'text-slate-700 bg-slate-100 border-slate-200' },
    { label: 'Ingestion Events', value: ingestionCount, icon: UploadCloud, color: 'text-amber-600 bg-amber-50 border-amber-100' },
  ];

  function clearFilters() {
    setActionFilter('');
    setOutcomeFilter('');
    setUserFilter('');
    setDateFrom('');
    setDateTo('');
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 page-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Security & Audit Logs
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Compliance ledger of authentication, permission evaluations, queries, and document uploads.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium border border-slate-200 self-start sm:self-auto transition-colors shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : 'text-slate-400'}`} />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {/* 6 Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex flex-col justify-between space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-500 leading-tight">
                  {kpi.label}
                </span>
                <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${kpi.color}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-xl font-bold text-slate-900">
                {loading ? '—' : kpi.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* User / Keyword Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Filter user or resource..."
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white"
            />
          </div>

          {/* Action Dropdown */}
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-blue-600"
          >
            <option value="">All Actions</option>
            <option value="AUTH_LOGIN">AUTH_LOGIN</option>
            <option value="QUERY_RAG_ASK">QUERY_RAG_ASK</option>
            <option value="QUERY_RAG_STREAM">QUERY_RAG_STREAM</option>
            <option value="QUERY_SEARCH">QUERY_SEARCH</option>
            <option value="DOC_UPLOAD">DOC_UPLOAD</option>
            <option value="USER_CREATE">USER_CREATE</option>
            <option value="USER_STATUS_UPDATE">USER_STATUS_UPDATE</option>
          </select>

          {/* Outcome Dropdown */}
          <select
            value={outcomeFilter}
            onChange={(e) => setOutcomeFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-blue-600"
          >
            <option value="">All Outcomes</option>
            <option value="SUCCESS">Success</option>
            <option value="DENIED">Denied</option>
            <option value="REFUSED">Refused</option>
          </select>

          {/* Date Range From */}
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-transparent text-xs text-slate-700 focus:outline-none w-full"
              aria-label="Filter from date"
            />
          </div>

          {/* Date Range To */}
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-transparent text-xs text-slate-700 focus:outline-none w-full"
              aria-label="Filter to date"
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
          <span>
            Showing <strong className="text-slate-900">{filteredLogs.length}</strong> of {totalEvents} events
          </span>
          {(actionFilter || outcomeFilter || userFilter || dateFrom || dateTo) && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Audit Log Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No audit events match filters"
            description="Try adjusting your date range, action type, or user filter."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Outcome</th>
                  <th className="px-5 py-3">Target / Resource</th>
                  <th className="px-5 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      @{log.username}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-700">
                      {log.action}
                    </td>
                    <td className="px-4 py-3">
                      <OutcomeBadge outcome={log.outcome} />
                    </td>
                    <td className="px-5 py-3 text-slate-800 max-w-xs truncate" title={log.resource}>
                      {log.resource}
                    </td>
                    <td className="px-5 py-3 text-slate-500 text-[11px] max-w-sm truncate" title={log.details}>
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
