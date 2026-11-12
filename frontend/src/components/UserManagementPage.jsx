import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Search,
  RefreshCw,
  Lock,
  LogOut,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  AlertCircle,
  X,
  Loader2,
  ShieldCheck,
  UserCheck,
  UserX,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { StatusBadge } from './ui/StatusBadge';
import { TableSkeleton } from './ui/Skeleton';
import EmptyState from './ui/EmptyState';
import ConfirmDialog from './ui/ConfirmDialog';

const ROLES = [
  { value: 'employee', label: 'Employee', hint: 'Standard department & active policy access' },
  { value: 'hr', label: 'HR Specialist', hint: 'HR policies, historical archives & document upload' },
  { value: 'manager', label: 'Manager', hint: 'Departmental + management & historical access' },
  { value: 'administrator', label: 'Administrator', hint: 'Unrestricted access, user provisioning & audit logs' },
];

const DEPARTMENTS = [
  { value: 'engineering', label: 'Engineering' },
  { value: 'operations', label: 'Operations' },
  { value: 'hr', label: 'HR' },
  { value: 'finance', label: 'Finance' },
  { value: 'executive', label: 'Executive' },
  { value: 'all', label: 'All Departments' },
];

export default function UserManagementPage({ onRequestSignOut }) {
  const { user: currentUser, isAdmin } = useAuth();
  const { showToast } = useToast();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  // Create Employee Modal State
  const [createOpen, setCreateOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('employee');
  const [department, setDepartment] = useState('engineering');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Status Toggle Confirm Dialog
  const [statusTarget, setStatusTarget] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listUsers();
      setUsers(data || []);
    } catch (err) {
      if (err.status === 404) {
        setError('Endpoint not found (404). Please restart your backend server (uv run python main.py) to load the updated Employee Directory routes.');
      } else {
        setError(err.message || 'Failed to load employee directory');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    } else {
      setLoading(false);
    }
  }, [isAdmin, fetchUsers]);

  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-5 page-enter">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-600 shadow-xs">
          <Lock className="w-6 h-6" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-base font-bold text-slate-900">
            Employee Provisioning Restricted
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            Adding or managing employee accounts is restricted to users with the <strong>Administrator</strong> role. Please sign out and log in with an Administrator account.
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

  function resetCreateForm() {
    setFullName('');
    setUsername('');
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setRole('employee');
    setDepartment('engineering');
    setCreateError(null);
  }

  async function handleCreateSubmit(e) {
    e.preventDefault();
    setCreateError(null);

    if (username.trim().length < 3) {
      setCreateError('Username must be at least 3 characters.');
      return;
    }
    if (password.length < 6) {
      setCreateError('Password must be at least 6 characters.');
      return;
    }

    setCreating(true);
    try {
      const created = await api.createUser({
        full_name: fullName.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        password,
        role,
        department,
      });
      showToast(`Employee "${created.full_name}" (@${created.username}) provisioned`, 'success');
      setCreateOpen(false);
      resetCreateForm();
      await fetchUsers();
    } catch (err) {
      setCreateError(err.message || 'Failed to provision employee account');
    } finally {
      setCreating(false);
    }
  }

  async function handleConfirmStatusToggle() {
    if (!statusTarget) return;
    const nextState = !statusTarget.is_active;
    try {
      await api.updateUserStatus(statusTarget.id, nextState);
      showToast(
        `${statusTarget.full_name} account ${nextState ? 'activated' : 'deactivated'}`,
        nextState ? 'success' : 'warning'
      );
      setStatusTarget(null);
      await fetchUsers();
    } catch (err) {
      showToast(err.message || 'Failed to update employee status', 'error');
      setStatusTarget(null);
    }
  }

  function getInitials(name, uname) {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (uname || 'U').substring(0, 2).toUpperCase();
  }

  const filteredUsers = users.filter((u) => {
    if (roleFilter && u.role !== roleFilter) return false;
    if (deptFilter && u.department !== deptFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return (
        u.full_name?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activeCount = users.filter((u) => u.is_active).length;
  const inactiveCount = users.length - activeCount;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 page-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Employee Directory & Provisioning
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Add new TechNova employees, assign corporate RBAC roles and departments, and manage account status.
          </p>
        </div>

        <div className="flex items-center space-x-2.5 self-start sm:self-auto">
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium border border-slate-200 transition-colors shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : 'text-slate-400'}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => {
              resetCreateForm();
              setCreateOpen(true);
            }}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors shadow-xs"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium block">Total Employees</span>
            <span className="text-2xl font-bold text-slate-900 mt-0.5 block">
              {loading ? '—' : users.length}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium block">Active Accounts</span>
            <span className="text-2xl font-bold text-slate-900 mt-0.5 block">
              {loading ? '—' : activeCount}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium block">Deactivated Accounts</span>
            <span className="text-2xl font-bold text-slate-900 mt-0.5 block">
              {loading ? '—' : inactiveCount}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500">
            <UserX className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Employee Directory Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-bold text-slate-900">Provisioned Employees</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
              {filteredUsers.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search name, username, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-blue-600"
            >
              <option value="">All Roles</option>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>

            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-blue-600"
            >
              <option value="">All Departments</option>
              {DEPARTMENTS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <TableSkeleton rows={5} cols={6} />
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No employees match filters"
            description="Adjust your search or role/department filters, or click Add Employee to create a new account."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Employee</th>
                  <th className="px-4 py-3">Corporate Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Provisioned</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredUsers.map((emp) => {
                  const isSelf = emp.id === currentUser?.id;
                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-semibold text-xs text-slate-700 shrink-0">
                            {getInitials(emp.full_name, emp.username)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center space-x-1.5">
                              <span>{emp.full_name}</span>
                              {isSelf && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-100 font-medium">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-slate-500">
                              @{emp.username}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-slate-600">{emp.email}</td>

                      <td className="px-4 py-3.5">
                        <StatusBadge
                          label={emp.role}
                          variant={emp.role === 'administrator' ? 'info' : 'neutral'}
                          className="capitalize"
                        />
                      </td>

                      <td className="px-4 py-3.5 capitalize text-slate-700 font-medium">
                        {emp.department}
                      </td>

                      <td className="px-4 py-3.5">
                        {emp.is_active ? (
                          <StatusBadge
                            label="Active"
                            variant="success"
                            icon={<CheckCircle2 className="w-3 h-3" />}
                          />
                        ) : (
                          <StatusBadge
                            label="Deactivated"
                            variant="danger"
                            icon={<XCircle className="w-3 h-3" />}
                          />
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                        {emp.created_at ? new Date(emp.created_at).toLocaleDateString() : 'N/A'}
                      </td>

                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          disabled={isSelf}
                          onClick={() => setStatusTarget(emp)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                            isSelf
                              ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                              : emp.is_active
                              ? 'bg-white hover:bg-red-50 text-red-600 border-slate-200 hover:border-red-200'
                              : 'bg-white hover:bg-emerald-50 text-emerald-700 border-slate-200 hover:border-emerald-200'
                          }`}
                          title={isSelf ? 'Cannot deactivate your own account' : ''}
                        >
                          {emp.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Employee Modal */}
      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-lg w-full overflow-hidden page-enter">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Add New Employee
                  </h3>
                  <p className="text-xs text-slate-500">
                    Provision an account with assigned RBAC role and department access.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCreateOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 text-xs">
              {createError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{createError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Priya Sharma"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Corporate Username
                  </label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. priya"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Corporate Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. priya@technova.com"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    RBAC Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Department
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Initial Password <span className="font-normal text-slate-400">(Min 6 characters)</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Set initial password for employee login"
                      className="w-full px-3.5 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 text-[11px] text-slate-600 flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  {ROLES.find((r) => r.value === role)?.hint}. Password will be securely hashed using bcrypt.
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold flex items-center space-x-1.5 shadow-xs"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Provisioning...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Create Employee Account</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Activate / Deactivate Dialog */}
      <ConfirmDialog
        isOpen={!!statusTarget}
        title={statusTarget?.is_active ? 'Deactivate Employee Account' : 'Activate Employee Account'}
        message={
          statusTarget?.is_active
            ? `Deactivating ${statusTarget?.full_name} (@${statusTarget?.username}) will immediately block their API tokens and prevent login.`
            : `Re-activating ${statusTarget?.full_name} (@${statusTarget?.username}) will restore their access to authorized documents.`
        }
        confirmLabel={statusTarget?.is_active ? 'Deactivate' : 'Activate'}
        variant={statusTarget?.is_active ? 'danger' : 'primary'}
        onConfirm={handleConfirmStatusToggle}
        onCancel={() => setStatusTarget(null)}
      />
    </div>
  );
}
