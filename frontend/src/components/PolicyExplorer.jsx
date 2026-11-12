import React, { useState } from 'react';
import {
  Shield,
  Search,
  ShieldCheck,
  History,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getUserInitials } from '../utils/user';
import { ClearanceBadge, StatusBadge } from './ui/StatusBadge';
import EmptyState from './ui/EmptyState';

// Authoritative category rules matching src/ingestion/policy.py & src/retrieval/permissions.py
const MATRIX = [
  {
    category: 'HR (Human Resources)',
    code: 'HR',
    classification: 'Internal — General HR',
    desc: 'Employee handbook, leave policies, health benefits, and workplace conduct standards.',
    allowedRoles: ['employee', 'hr', 'manager', 'administrator'],
    allowedDepts: ['all'],
    historicalAccess: 'HR, Manager & Administrator (Employees restricted to active)',
  },
  {
    category: 'Engineering',
    code: 'ENGINEERING',
    classification: 'Internal — Engineering',
    desc: 'Engineering security standards, cloud infrastructure architecture, deployment & API specs.',
    allowedRoles: ['employee', 'hr', 'manager', 'administrator'],
    allowedDepts: ['engineering'],
    historicalAccess: 'HR, Manager & Administrator in scope (Employees restricted to active)',
  },
  {
    category: 'Finance',
    code: 'FINANCE',
    classification: 'Confidential — Financial',
    desc: 'Travel & expense limits, quarterly budgets, audit spreadsheets, and compensation policies.',
    allowedRoles: ['manager', 'administrator'],
    allowedDepts: ['finance', 'executive'],
    historicalAccess: 'Finance/Executive Managers & Administrator',
  },
  {
    category: 'Operations',
    code: 'OPERATIONS',
    classification: 'Internal — Operations',
    desc: 'Business continuity policy, disaster recovery RTO/RPO, facilities, and vendor SLA runbooks.',
    allowedRoles: ['employee', 'hr', 'manager', 'administrator'],
    allowedDepts: ['operations'],
    historicalAccess: 'HR, Manager & Administrator in scope (Employees restricted to active)',
  },
  {
    category: 'Administration',
    code: 'ADMINISTRATION',
    classification: 'Restricted — Executive Governance',
    desc: 'Board governance, legal retainers, and organization-wide executive records.',
    allowedRoles: ['administrator'],
    allowedDepts: ['all'],
    historicalAccess: 'Administrator only',
  },
];

export default function PolicyExplorer() {
  const { user, isEmployee } = useAuth();
  const [roleFilter, setRoleFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [classificationFilter, setClassificationFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const currentPersona = {
    initials: getUserInitials(user?.full_name, user?.username),
  };

  function checkClearance(row) {
    if (user?.role === 'administrator') return true;
    const roleMatch = row.allowedRoles.includes(user?.role);
    const deptMatch =
      row.allowedDepts.includes('all') ||
      row.allowedDepts.includes(user?.department);
    return roleMatch && deptMatch;
  }

  const filteredMatrix = MATRIX.filter((row) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      row.category.toLowerCase().includes(q) ||
      row.desc.toLowerCase().includes(q) ||
      row.classification.toLowerCase().includes(q);
    const matchRole = roleFilter ? row.allowedRoles.includes(roleFilter) : true;
    const matchDept = deptFilter
      ? row.allowedDepts.includes('all') || row.allowedDepts.includes(deptFilter)
      : true;
    const matchClass = classificationFilter ? row.code === classificationFilter : true;
    return matchSearch && matchRole && matchDept && matchClass;
  });

  const accessibleCount = MATRIX.filter((row) => checkClearance(row)).length;

  function clearFilters() {
    setRoleFilter('');
    setDeptFilter('');
    setClassificationFilter('');
    setSearchQuery('');
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 page-enter">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          Access Control Matrix
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Deterministic RBAC and department-level (ABAC) rules enforced across ingestion, vector retrieval, and LLM grounding.
        </p>
      </div>

      {/* Active User Profile & Clearance Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
            {currentPersona.initials}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-slate-900">
                {user?.full_name || user?.username}
              </span>
              <span className="text-xs text-slate-400">@{user?.username}</span>
              <StatusBadge label={user?.role} variant="info" className="capitalize" />
              <StatusBadge label={`${user?.department} dept`} variant="neutral" className="capitalize" />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Effective clearance grants access to{' '}
              <strong className="text-blue-600 font-semibold">{accessibleCount} of {MATRIX.length}</strong>{' '}
              corporate document categories.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs shrink-0">
          <History className="w-4 h-4 text-slate-500 shrink-0" />
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">
              Historical Version Access
            </span>
            <span className="font-semibold text-slate-800">
              {isEmployee ? 'Restricted (Active Policies Only)' : 'Authorized (Active & Archived)'}
            </span>
          </div>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search category or scope..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white"
            />
          </div>

          {/* Classification Filter */}
          <select
            value={classificationFilter}
            onChange={(e) => setClassificationFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-blue-600"
          >
            <option value="">All Classifications</option>
            {MATRIX.map((m) => (
              <option key={m.code} value={m.code}>
                {m.code} — {m.classification}
              </option>
            ))}
          </select>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-blue-600"
          >
            <option value="">All Roles</option>
            <option value="employee">Employee</option>
            <option value="hr">HR</option>
            <option value="manager">Manager</option>
            <option value="administrator">Administrator</option>
          </select>

          {/* Department Filter */}
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-blue-600"
          >
            <option value="">All Departments</option>
            <option value="engineering">Engineering</option>
            <option value="hr">HR</option>
            <option value="finance">Finance</option>
            <option value="operations">Operations</option>
            <option value="executive">Executive</option>
          </select>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>
            Showing <strong className="text-slate-900">{filteredMatrix.length}</strong> of {MATRIX.length} rules
          </span>
          {(roleFilter || deptFilter || classificationFilter || searchQuery) && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Permission Matrix Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {filteredMatrix.length === 0 ? (
          <EmptyState
            icon={Shield}
            title="No matching access rules"
            description="Adjust your role, department, or classification filters to inspect corporate permissions."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Document Category</th>
                  <th className="px-4 py-3">Scope Description</th>
                  <th className="px-4 py-3">Authorized Roles</th>
                  <th className="px-4 py-3">Authorized Departments</th>
                  <th className="px-4 py-3">Historical Access Policy</th>
                  <th className="px-5 py-3">Your Access Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredMatrix.map((row) => {
                  const hasAccess = checkClearance(row);
                  return (
                    <tr key={row.code} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900">{row.category}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{row.classification}</div>
                      </td>
                      <td className="px-4 py-4 text-slate-600 text-xs max-w-xs leading-relaxed">
                        {row.desc}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1">
                          {row.allowedRoles.map((r) => (
                            <span
                              key={r}
                              className={`px-2 py-0.5 rounded text-[10px] capitalize font-medium border ${
                                user?.role === r
                                  ? 'bg-blue-50 text-blue-700 border-blue-200 font-semibold'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1">
                          {row.allowedDepts.map((d) => (
                            <span
                              key={d}
                              className={`px-2 py-0.5 rounded text-[10px] capitalize font-medium border ${
                                d === 'all' || user?.department === d
                                  ? 'bg-blue-50 text-blue-700 border-blue-200 font-semibold'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {d}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-500 text-[11px] max-w-[200px] leading-snug">
                        {row.historicalAccess}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <ClearanceBadge permitted={hasAccess} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4-Layer Enforcement Architecture Overview */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900">
            4-Layer Retrieval Defense Architecture
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="font-semibold text-slate-900 block">
              1. Pre-Retrieval Gating
            </span>
            <p className="text-slate-500 leading-relaxed text-[11px]">
              Candidates are evaluated against active role, department, and status rules prior to vector similarity scoring.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="font-semibold text-slate-900 block">
              2. Hybrid RRF & Rerank
            </span>
            <p className="text-slate-500 leading-relaxed text-[11px]">
              Vector search and BM25 lexical scores are fused via RRF (k=60) and reranked using only permitted chunks.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="font-semibold text-slate-900 block">
              3. Defense-in-Depth Guard
            </span>
            <p className="text-slate-500 leading-relaxed text-[11px]">
              Post-retrieval validation re-checks every selected chunk against caller clearance prior to prompt assembly.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="font-semibold text-slate-900 block">
              4. Grounded LLM Synthesis
            </span>
            <p className="text-slate-500 leading-relaxed text-[11px]">
              Strict system prompting ensures the LLM answers strictly from retrieved passages with explicit inline citations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
