import React, { useState } from 'react';
import {
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  FileText,
  ShieldCheck,
  Loader2,
  ArrowRight,
  Cpu,
  Layers,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from './ui/StatusBadge';
import EmptyState from './ui/EmptyState';

export default function HybridSearchTab() {
  const { user, isEmployee } = useAuth();
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(5);
  const [includeHistorical, setIncludeHistorical] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [expandedChunks, setExpandedChunks] = useState({});

  async function handleSearch(e) {
    e?.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    setError(null);
    setExpandedChunks({});
    try {
      const data = await api.searchKnowledge(query, topK, includeHistorical);
      setResults(data);
    } catch (err) {
      setError(err.message || 'Retrieval failed');
    } finally {
      setLoading(false);
    }
  }

  function toggleExpand(chunkId) {
    setExpandedChunks((prev) => ({ ...prev, [chunkId]: !prev[chunkId] }));
  }

  function getRetrievalMethodLabel(chunk) {
    const hasDense = (chunk.dense_score || 0) > 0;
    const hasSparse = (chunk.sparse_score || 0) > 0;
    if (hasDense && hasSparse) return 'Hybrid (Vector + BM25)';
    if (hasDense) return 'Vector Search';
    if (hasSparse) return 'BM25 Lexical';
    return 'RRF Candidate';
  }

  const audit = results?.audit_metadata || {};

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 page-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Hybrid Retrieval Inspection
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Inspect permission-gated dense semantic embeddings, BM25 lexical scoring, RRF fusion, and cross-encoder reranking.
          </p>
        </div>

        <StatusBadge
          label={`Principal: @${user?.username} (${user?.role})`}
          variant="info"
          icon={<ShieldCheck className="w-3 h-3" />}
        />
      </div>

      {/* Visual Retrieval Pipeline Stepper */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs overflow-x-auto">
        <div className="flex items-center justify-between min-w-[640px] gap-2 text-xs">
          {/* Stage 1: Query */}
          <div className="flex-1 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-semibold uppercase text-slate-400 block">
              Step 1
            </span>
            <span className="font-semibold text-slate-900 block">Query & Pre-Filter</span>
            <span className="text-[11px] text-slate-500">
              {results
                ? `${audit.pre_filter_authorized_count ?? 0} authorized chunks`
                : 'RBAC/ABAC gating'}
            </span>
          </div>

          <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />

          {/* Stage 2: Vector + BM25 */}
          <div className="flex-1 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-semibold uppercase text-slate-400 block">
              Step 2
            </span>
            <span className="font-semibold text-slate-900 block">Vector + BM25</span>
            <span className="text-[11px] text-slate-500">
              {results
                ? `${audit.dense_hits ?? 0} dense · ${audit.sparse_hits ?? 0} BM25`
                : 'Dual retrieval'}
            </span>
          </div>

          <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />

          {/* Stage 3: RRF Fusion */}
          <div className="flex-1 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-semibold uppercase text-slate-400 block">
              Step 3
            </span>
            <span className="font-semibold text-slate-900 block">RRF Fusion</span>
            <span className="text-[11px] text-slate-500">Reciprocal rank (k=60)</span>
          </div>

          <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />

          {/* Stage 4: Reranking */}
          <div className="flex-1 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-semibold uppercase text-slate-400 block">
              Step 4
            </span>
            <span className="font-semibold text-slate-900 block">Cross-Encoder Rerank</span>
            <span className="text-[11px] text-slate-500">
              {results
                ? `Dropped post-filter: ${audit.post_filter_dropped ?? 0}`
                : 'MiniLM-L-6-v2'}
            </span>
          </div>

          <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />

          {/* Stage 5: Results */}
          <div
            className={`flex-1 p-2.5 rounded-lg border ${
              results
                ? 'bg-blue-50 border-blue-200'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <span className="text-[10px] font-semibold uppercase text-slate-400 block">
              Step 5
            </span>
            <span className="font-semibold text-slate-900 block">Top-K Results</span>
            <span className="text-[11px] text-blue-700 font-medium">
              {results
                ? `${results.chunks.length} chunks (${audit.duration_ms ?? 0}ms)`
                : `Top ${topK} chunks`}
            </span>
          </div>
        </div>
      </div>

      {/* Search Form & Collapsible Advanced Settings */}
      <form
        onSubmit={handleSearch}
        className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4"
      >
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter keywords, policy clauses, or a natural-language question..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/15 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center space-x-2 transition-colors shrink-0 shadow-xs"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            <span>Search Knowledge Base</span>
          </button>
        </div>

        {/* Collapsible Advanced Retrieval Settings */}
        <div className="border-t border-slate-100 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setAdvancedOpen(!advancedOpen)}
              className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 hover:text-blue-600 transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Advanced Retrieval Settings</span>
              {advancedOpen ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            <div className="flex items-center space-x-4 text-xs text-slate-500">
              <span>Top-K: <strong className="text-slate-800">{topK}</strong></span>
              <span>
                Filter:{' '}
                <strong className="text-slate-800">
                  {includeHistorical ? 'Active & Historical' : 'Active Only'}
                </strong>
              </span>
            </div>
          </div>

          {advancedOpen && (
            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {/* Top-K Selector */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <label className="font-semibold text-slate-800 block">
                  Top-K Results
                </label>
                <select
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                >
                  <option value={3}>Top 3 chunks</option>
                  <option value={5}>Top 5 chunks</option>
                  <option value={10}>Top 10 chunks</option>
                  <option value={15}>Top 15 chunks</option>
                </select>
                <label className="flex items-center space-x-2 text-[11px] text-slate-600 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeHistorical}
                    onChange={(e) => setIncludeHistorical(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>
                    Include archived versions{' '}
                    {isEmployee && <span className="text-slate-400">(Blocked for employees)</span>}
                  </span>
                </label>
              </div>

              {/* Vector Search Config */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center space-x-1.5 font-semibold text-slate-800">
                  <Cpu className="w-3.5 h-3.5 text-blue-600" />
                  <span>Vector Search Config</span>
                </div>
                <p className="text-[11px] text-slate-500">Model: <span className="font-mono text-slate-700">all-MiniLM-L6-v2</span></p>
                <p className="text-[11px] text-slate-500">Metric: Cosine similarity (ChromaDB)</p>
                <p className="text-[11px] text-slate-500">Candidate pool: Top 30 dense</p>
              </div>

              {/* BM25 & RRF Config */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center space-x-1.5 font-semibold text-slate-800">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  <span>BM25 & RRF Fusion</span>
                </div>
                <p className="text-[11px] text-slate-500">Lexical: <span className="font-mono text-slate-700">BM25Okapi</span></p>
                <p className="text-[11px] text-slate-500">Fusion: Reciprocal Rank Fusion</p>
                <p className="text-[11px] text-slate-500">Smoothing constant: <span className="font-mono text-slate-700">k = 60</span></p>
              </div>

              {/* Cross-Encoder Reranking */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center space-x-1.5 font-semibold text-slate-800">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Reranking Config</span>
                </div>
                <p className="text-[11px] text-slate-500">Model: <span className="font-mono text-slate-700">ms-marco-MiniLM-L-6-v2</span></p>
                <p className="text-[11px] text-slate-500">Scope: Authorized chunks only</p>
                <p className="text-[11px] text-slate-500">Validation: Post-rerank ACL guard</p>
              </div>
            </div>
          )}
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Results List */}
      {results && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 px-1">
            <span>
              Returned <strong className="text-slate-900">{results.chunks.length}</strong> authorized chunks out of{' '}
              <strong className="text-slate-900">{audit.pre_filter_authorized_count ?? 0}</strong> permitted candidates
            </span>
            <span className="font-mono text-[11px]">
              Latency: {audit.duration_ms ?? 0}ms
            </span>
          </div>

          {results.chunks.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs">
              <EmptyState
                icon={Search}
                title="No authorized chunks matched"
                description={`No passages matched "${results.query}" under your ${user?.role} role in the ${user?.department} department.`}
              />
            </div>
          ) : (
            <div className="space-y-3">
              {results.chunks.map((chunk, idx) => {
                const isExpanded = !!expandedChunks[chunk.chunk_id];
                const isLong = chunk.text && chunk.text.length > 340;
                const displayText =
                  isLong && !isExpanded ? `${chunk.text.slice(0, 340)}…` : chunk.text;

                return (
                  <div
                    key={chunk.chunk_id || idx}
                    className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3 hover:border-slate-300 transition-colors"
                  >
                    {/* Card Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-blue-50 text-blue-700 border border-blue-100 text-xs font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="text-sm font-bold text-slate-900">
                          {chunk.document_title}
                        </span>
                        <StatusBadge
                          label={`v${chunk.version_number} (${chunk.is_active ? 'Active' : 'Archived'})`}
                          variant={chunk.is_active ? 'success' : 'warning'}
                        />
                        <StatusBadge label={chunk.category} variant="neutral" />
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0">
                        <StatusBadge
                          label={getRetrievalMethodLabel(chunk)}
                          variant="info"
                        />
                      </div>
                    </div>

                    {/* Scoring Breakdown Strip */}
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-mono font-semibold border border-blue-100">
                        Rerank: {Number(chunk.rerank_score || 0).toFixed(4)}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono border border-slate-200">
                        RRF: {Number(chunk.rrf_score || 0).toFixed(4)}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono border border-slate-200">
                        Dense: {Number(chunk.dense_score || 0).toFixed(4)}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono border border-slate-200">
                        BM25: {Number(chunk.sparse_score || 0).toFixed(4)}
                      </span>
                    </div>

                    {/* Chunk Passage */}
                    <div className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100 whitespace-pre-wrap">
                      {displayText}
                      {isLong && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(chunk.chunk_id)}
                          className="ml-2 text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center"
                        >
                          {isExpanded ? 'Show less' : 'Expand full passage'}
                        </button>
                      )}
                    </div>

                    {/* Footer Metadata */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>
                          Section: <strong className="text-slate-700">{chunk.section_header || 'General'}</strong>
                        </span>
                        <span>•</span>
                        <span>Page {chunk.page_number}</span>
                        <span>•</span>
                        <span>
                          Departments: <strong className="text-slate-700 capitalize">{chunk.allowed_departments}</strong>
                        </span>
                      </div>

                      <span className="text-emerald-600 font-medium inline-flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>ACL Verified</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
