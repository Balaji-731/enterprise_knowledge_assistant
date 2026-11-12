import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Lock,
  RefreshCw,
  Search,
  Shield,
  ArrowRight,
  MessageSquare,
  Eye,
  X,
  File,
  Check,
  Loader2,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { StatusBadge } from './ui/StatusBadge';
import { TableSkeleton } from './ui/Skeleton';
import EmptyState from './ui/EmptyState';
import ConfirmDialog from './ui/ConfirmDialog';

// Exact category hierarchy matching src/ingestion/policy.py
const CATEGORIES = [
  {
    value: 'HR',
    label: 'HR',
    fullLabel: 'HR — Human Resources Policies',
    defaultRoles: ['employee', 'hr', 'manager', 'administrator'],
    defaultDepts: ['all'],
  },
  {
    value: 'ENGINEERING',
    label: 'Engineering',
    fullLabel: 'Engineering — Standards & Architecture',
    defaultRoles: ['employee', 'hr', 'manager', 'administrator'],
    defaultDepts: ['engineering'],
  },
  {
    value: 'FINANCE',
    label: 'Finance',
    fullLabel: 'Finance — Expense, Budgets & Reporting',
    defaultRoles: ['manager', 'administrator'],
    defaultDepts: ['finance', 'executive'],
  },
  {
    value: 'OPERATIONS',
    label: 'Operations',
    fullLabel: 'Operations — Business Continuity & SOPs',
    defaultRoles: ['employee', 'hr', 'manager', 'administrator'],
    defaultDepts: ['operations'],
  },
  {
    value: 'ADMINISTRATION',
    label: 'Administration',
    fullLabel: 'Administration — Executive & Governance',
    defaultRoles: ['administrator'],
    defaultDepts: ['all'],
  },
];

const AVAILABLE_ROLES = ['employee', 'hr', 'manager', 'administrator'];
const AVAILABLE_DEPTS = ['all', 'engineering', 'hr', 'finance', 'operations', 'executive'];
const INGESTION_STAGES = ['Upload', 'Validate', 'Extract', 'Chunk', 'Embed', 'Index'];

export default function DocumentManager({ onAskAboutDocument }) {
  const { user, canUpload } = useAuth();
  const { showToast } = useToast();

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  // Upload Form State
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [category, setCategory] = useState('HR');
  const [manualVersion, setManualVersion] = useState('');
  const [changeSummary, setChangeSummary] = useState('');
  const [policyMode, setPolicyMode] = useState('default'); // 'default' | 'manual'
  const [selectedRoles, setSelectedRoles] = useState(['employee', 'hr', 'manager', 'administrator']);
  const [selectedDepts, setSelectedDepts] = useState(['all']);
  const [allowedUsers, setAllowedUsers] = useState('');

  // Upload Progress & Result
  const [uploading, setUploading] = useState(false);
  const [activeStageIdx, setActiveStageIdx] = useState(-1);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [confirmManualOpen, setConfirmManualOpen] = useState(false);

  // Preview Modal
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewChunks, setPreviewChunks] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const fileInputRef = useRef(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listDocuments(categoryFilter || null);
      setDocuments(data || []);
    } catch (err) {
      showToast(err.message || 'Failed to fetch documents', 'error');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, showToast]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Sync default roles & departments when category changes in Default mode
  useEffect(() => {
    const cat = CATEGORIES.find((c) => c.value === category);
    if (cat && policyMode === 'default') {
      setSelectedRoles(cat.defaultRoles);
      setSelectedDepts(cat.defaultDepts);
    }
  }, [category, policyMode]);

  function handleFileSelected(chosen) {
    if (!chosen) return;
    const ext = chosen.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'txt', 'md'].includes(ext)) {
      setUploadError('Unsupported file format. Allowed formats: .pdf, .docx, .txt, .md');
      return;
    }
    setUploadError(null);
    setFile(chosen);
  }

  function handleDrag(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    if (!file || uploading) return;
    if (policyMode === 'manual') {
      setConfirmManualOpen(true);
    } else {
      executeUpload();
    }
  }

  async function executeUpload() {
    setConfirmManualOpen(false);
    if (!file || uploading) return;

    setUploading(true);
    setUploadError(null);
    setUploadResult(null);
    setActiveStageIdx(0);

    // Visual progression timer across ingestion stages while backend runs
    const stageTimer = setInterval(() => {
      setActiveStageIdx((prev) => (prev < 4 ? prev + 1 : prev));
    }, 550);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    if (manualVersion.trim()) {
      formData.append('manual_version', manualVersion.trim());
    }
    if (changeSummary.trim()) {
      formData.append('change_summary', changeSummary.trim());
    }
    if (policyMode === 'manual') {
      formData.append('allowed_roles', selectedRoles.join(','));
      formData.append('allowed_departments', selectedDepts.join(','));
      if (allowedUsers.trim()) {
        formData.append('allowed_users', allowedUsers.trim());
      }
    }

    try {
      const result = await api.uploadDocument(formData);
      clearInterval(stageTimer);
      setActiveStageIdx(5);
      setUploadResult(result);
      setFile(null);
      setManualVersion('');
      setChangeSummary('');
      setAllowedUsers('');
      showToast(`Ingested "${result.document_title}" (v${result.version_number})`, 'success');
      await fetchDocuments();
    } catch (err) {
      clearInterval(stageTimer);
      setActiveStageIdx(-1);
      setUploadError(err.message || 'Document ingestion failed');
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  }

  async function openDocumentPreview(doc) {
    setPreviewDoc(doc);
    setPreviewChunks([]);
    setLoadingPreview(true);
    try {
      const res = await api.searchKnowledge(doc.title, 3, false, doc.id);
      setPreviewChunks(res?.chunks || []);
    } catch {
      setPreviewChunks([]);
    } finally {
      setLoadingPreview(false);
    }
  }

  const filteredDocuments = documents.filter((doc) => {
    const matchSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = categoryFilter ? doc.category === categoryFilter : true;
    const deptText = (doc.allowed_departments || '').toLowerCase();
    const matchDept = deptFilter
      ? deptText.includes(deptFilter.toLowerCase()) || deptText.includes('all')
      : true;
    return matchSearch && matchCat && matchDept;
  });

  const selectedCategoryMeta = CATEGORIES.find((c) => c.value === category) || CATEGORIES[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 page-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Document Registry & Ingestion
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage authorized enterprise knowledge repositories, document versions, and ingestion pipelines.
          </p>
        </div>

        <button
          onClick={fetchDocuments}
          disabled={loading}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium border border-slate-200 self-start sm:self-auto transition-colors shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : 'text-slate-400'}`} />
          <span>Refresh Registry</span>
        </button>
      </div>

      {/* Upload & Ingestion Section (HR & Admin Only) */}
      {canUpload ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Upload & Ingest Enterprise Document
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Supports PDF, DOCX, TXT, and Markdown files with SHA-256 deduplication and automatic versioning.
              </p>
            </div>
            <StatusBadge label={`Ingestion Authorized (${user?.role})`} variant="info" />
          </div>

          {/* Pipeline Stages Indicator */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 overflow-x-auto">
            <div className="flex items-center justify-between min-w-[560px] gap-1 text-xs">
              {INGESTION_STAGES.map((stage, idx) => {
                const isDone = activeStageIdx > idx || (activeStageIdx === 5 && idx === 5);
                const isRunning = uploading && activeStageIdx === idx;
                return (
                  <React.Fragment key={stage}>
                    <div
                      className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all ${
                        isDone
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : isRunning
                          ? 'bg-blue-50 border-blue-200 text-blue-700'
                          : 'bg-white border-slate-200 text-slate-500'
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : isRunning ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full bg-slate-100 text-slate-500 text-[10px] flex items-center justify-center font-semibold">
                          {idx + 1}
                        </span>
                      )}
                      <span>{stage}</span>
                    </div>
                    {idx < INGESTION_STAGES.length - 1 && (
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-5">
            {/* Drag & Drop Zone */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                dragActive
                  ? 'border-blue-500 bg-blue-50/50'
                  : file
                  ? 'border-emerald-300 bg-emerald-50/30'
                  : 'border-slate-300 hover:border-blue-400 bg-slate-50/60 hover:bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                onChange={(e) => handleFileSelected(e.target.files?.[0])}
                className="hidden"
              />

              {file ? (
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <File className="w-5 h-5" />
                  </div>
                  <div className="text-xs">
                    <p className="font-semibold text-slate-900">{file.name}</p>
                    <p className="text-slate-500 mt-0.5">
                      {(file.size / 1024).toFixed(1)} KB · Click to choose another file
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="text-[11px] font-medium text-red-600 hover:text-red-700"
                  >
                    Remove file
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <div className="text-xs">
                    <span className="font-semibold text-blue-600">Click to browse</span>
                    <span className="text-slate-600"> or drag and drop a document here</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Supported formats: PDF, DOCX, TXT, Markdown (.md)
                  </p>
                </div>
              )}
            </div>

            {/* Metadata Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Document Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.fullLabel}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Version Number <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Auto-detected if blank (e.g. 2.0)"
                  value={manualVersion}
                  onChange={(e) => setManualVersion(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Revision Summary <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Updated Q4 reimbursement caps"
                  value={changeSummary}
                  onChange={(e) => setChangeSummary(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>
            </div>

            {/* Access Policy Configuration */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-semibold text-slate-900">
                    Access Control Policy Configuration
                  </span>
                </div>

                <div className="flex items-center space-x-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setPolicyMode('default')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      policyMode === 'default'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Default Policy ({selectedCategoryMeta.label})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPolicyMode('manual')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      policyMode === 'manual'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Manual Access Override
                  </button>
                </div>
              </div>

              {policyMode === 'default' ? (
                <div className="text-xs text-slate-600 space-y-2 pt-1">
                  <p>
                    Applies the deterministic corporate policy configured for{' '}
                    <strong className="text-slate-800">{selectedCategoryMeta.label}</strong>:
                  </p>
                  <div className="flex flex-wrap gap-5 pt-1 text-[11px]">
                    <div>
                      <span className="text-slate-400 block mb-1">Resolved Roles:</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedCategoryMeta.defaultRoles.map((r) => (
                          <span
                            key={r}
                            className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 capitalize font-medium"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-1">Resolved Departments:</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedCategoryMeta.defaultDepts.map((d) => (
                          <span
                            key={d}
                            className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 capitalize font-medium"
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-1 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-slate-600 text-[11px] font-semibold block mb-1.5">
                        Authorized Roles:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {AVAILABLE_ROLES.map((r) => {
                          const active = selectedRoles.includes(r);
                          return (
                            <button
                              key={r}
                              type="button"
                              onClick={() =>
                                setSelectedRoles((prev) =>
                                  prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
                                )
                              }
                              className={`px-2.5 py-1 rounded-lg text-xs capitalize inline-flex items-center space-x-1 transition-colors ${
                                active
                                  ? 'bg-blue-600 text-white font-medium'
                                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {active && <Check className="w-3 h-3" />}
                              <span>{r}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-600 text-[11px] font-semibold block mb-1.5">
                        Authorized Departments:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {AVAILABLE_DEPTS.map((d) => {
                          const active = selectedDepts.includes(d);
                          return (
                            <button
                              key={d}
                              type="button"
                              onClick={() =>
                                setSelectedDepts((prev) =>
                                  prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
                                )
                              }
                              className={`px-2.5 py-1 rounded-lg text-xs capitalize inline-flex items-center space-x-1 transition-colors ${
                                active
                                  ? 'bg-blue-600 text-white font-medium'
                                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {active && <Check className="w-3 h-3" />}
                              <span>{d}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Specific Authorized Usernames <span className="font-normal text-slate-400">(Optional comma-separated)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. alice, bob"
                      value={allowedUsers}
                      onChange={(e) => setAllowedUsers(e.target.value)}
                      className="w-full sm:w-80 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-400">
                Prior versions of the same document title are automatically archived.
              </span>

              <button
                type="submit"
                disabled={uploading || !file}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center space-x-2 transition-colors shadow-xs"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Ingesting Document...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    <span>Upload & Index Document</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Error Feedback */}
          {uploadError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Ingestion Success Card */}
          {uploadResult && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-emerald-800 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Document Ingested & Indexed</span>
                </div>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                  {uploadResult.status}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                  <span className="text-[10px] text-slate-400 block">Document Title</span>
                  <span className="font-semibold text-slate-900 truncate block">
                    {uploadResult.document_title}
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                  <span className="text-[10px] text-slate-400 block">Version</span>
                  <span className="font-mono font-semibold text-emerald-700">
                    v{uploadResult.version_number}
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                  <span className="text-[10px] text-slate-400 block">Indexed Chunks</span>
                  <span className="font-semibold text-blue-700">
                    {uploadResult.total_chunks} chunks
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                  <span className="text-[10px] text-slate-400 block">Pages Parsed</span>
                  <span className="font-semibold text-slate-900">
                    {uploadResult.total_pages} pages
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs text-slate-600 shadow-xs">
          <div className="flex items-center space-x-2.5">
            <Lock className="w-4 h-4 text-slate-400" />
            <span>
              Document upload & ingestion is restricted to <strong>HR</strong> and <strong>Administrator</strong> roles.
            </span>
          </div>
          <span className="text-slate-400">Read-only registry view</span>
        </div>
      )}

      {/* Registered Documents Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-bold text-slate-900">
              Registered Documents
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
              {filteredDocuments.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search document title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-blue-600"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>

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
            </select>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <TableSkeleton rows={4} cols={7} />
        ) : filteredDocuments.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No documents found"
            description={`No documents match your active filter criteria or your current role (${user?.role}) in the ${user?.department} department.`}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Document Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Department Scope</th>
                  <th className="px-4 py-3">Version</th>
                  <th className="px-4 py-3">Access Policy</th>
                  <th className="px-4 py-3">Last Updated</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredDocuments.map((doc) => {
                  const depts = (doc.allowed_departments || 'all').split(',').filter(Boolean);
                  const roles = (doc.allowed_roles || '').split(',').filter(Boolean);
                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center space-x-2.5">
                          <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate max-w-xs">
                              {doc.title}
                            </p>
                            {doc.change_summary && (
                              <p className="text-[11px] text-slate-400 truncate max-w-xs">
                                {doc.change_summary}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <StatusBadge label={doc.category} variant="neutral" />
                      </td>

                      <td className="px-4 py-3.5 capitalize text-slate-600">
                        {depts.join(', ')}
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="font-mono text-[11px] font-semibold text-slate-800">
                          v{doc.active_version || '1.0'}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1">
                          ({doc.total_versions} rev)
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1 max-w-[160px]">
                          {roles.length === 4 ? (
                            <span className="text-[11px] text-slate-600">All Roles</span>
                          ) : (
                            roles.map((r) => (
                              <span
                                key={r}
                                className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px] capitalize"
                              >
                                {r}
                              </span>
                            ))
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                        {doc.updated_at || doc.created_at
                          ? new Date(doc.updated_at || doc.created_at).toLocaleDateString()
                          : 'N/A'}
                      </td>

                      <td className="px-4 py-3.5">
                        <StatusBadge
                          label={doc.status === 'active' ? 'Indexed' : doc.status || 'Indexed'}
                          variant="success"
                          icon={<CheckCircle2 className="w-3 h-3" />}
                        />
                      </td>

                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => openDocumentPreview(doc)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Inspect document details & chunks"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {onAskAboutDocument && (
                            <button
                              type="button"
                              onClick={() => onAskAboutDocument(doc.title)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Ask Knowledge Assistant about this document"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Dialog for Manual ACL Override */}
      <ConfirmDialog
        isOpen={confirmManualOpen}
        title="Confirm Manual Access Policy"
        message={`You are about to ingest "${file?.name}" with custom access restrictions (Roles: ${selectedRoles.join(', ') || 'None'}; Departments: ${selectedDepts.join(', ') || 'None'}). Proceed?`}
        confirmLabel="Confirm & Ingest"
        variant="primary"
        onConfirm={executeUpload}
        onCancel={() => setConfirmManualOpen(false)}
      />

      {/* Document Preview & Policy Modal */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden page-enter">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center space-x-2.5 min-w-0">
                <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                <h3 className="text-sm font-bold text-slate-900 truncate">
                  {previewDoc.title}
                </h3>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Document ID</span>
                  <span className="font-mono text-[11px] text-slate-700 break-all">{previewDoc.id}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Category</span>
                  <span className="font-semibold text-slate-800">{previewDoc.category}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Version</span>
                  <span className="font-mono font-semibold text-emerald-700">v{previewDoc.active_version || '1.0'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Allowed Roles</span>
                  <span className="text-slate-700 capitalize">{previewDoc.allowed_roles || 'Default'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Allowed Departments</span>
                  <span className="text-slate-700 capitalize">{previewDoc.allowed_departments || 'Default'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Uploaded By</span>
                  <span className="text-slate-700">{previewDoc.uploaded_by || 'System'}</span>
                </div>
              </div>

              {/* Indexed Passage Preview */}
              <div className="space-y-2.5">
                <span className="text-xs font-semibold text-slate-800 block">
                  Authorized Indexed Excerpts
                </span>
                {loadingPreview ? (
                  <div className="py-6 text-center text-slate-400 flex items-center justify-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span>Retrieving authorized excerpts...</span>
                  </div>
                ) : previewChunks.length === 0 ? (
                  <p className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-500">
                    No authorized passage chunks returned for preview.
                  </p>
                ) : (
                  previewChunks.map((c, idx) => (
                    <div
                      key={c.chunk_id || idx}
                      className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-700">
                          {c.section_header || 'Document Excerpt'}
                        </span>
                        <span>Page {c.page_number}</span>
                      </div>
                      <p className="text-slate-700 leading-relaxed">{c.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-2">
              {onAskAboutDocument && (
                <button
                  onClick={() => {
                    const t = previewDoc.title;
                    setPreviewDoc(null);
                    onAskAboutDocument(t);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center space-x-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Ask Assistant</span>
                </button>
              )}
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
