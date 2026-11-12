import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Bot,
  ShieldCheck,
  ShieldAlert,
  FileText,
  Clock,
  BookOpen,
  Plus,
  MessageSquare,
  Copy,
  Check,
  RotateCcw,
  Trash2,
  Sparkles,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getUserInitials } from '../utils/user';
import { useToast } from '../context/ToastContext';
import ConfirmDialog from './ui/ConfirmDialog';

function getSampleQuestionsForUser(user) {
  const role = (user?.role || '').toLowerCase();
  const dept = (user?.department || '').toLowerCase();

  const isAdmin = role === 'administrator';
  const hasEng = isAdmin || dept === 'engineering';
  const hasOps = isAdmin || dept === 'operations';
  const hasFin = isAdmin || (role === 'manager' && (dept === 'finance' || dept === 'executive'));

  const allowed = [
    {
      title: 'Leave & Hybrid Work Rules',
      query: 'What are the leave entitlements and Work From Home eligibility rules?',
      tag: 'HR · All',
    },
  ];

  if (hasEng) {
    allowed.push({
      title: 'Code Review & Git Workflow',
      query: 'What are the mandatory Code Review Guidelines and Git branching workflow standards?',
      tag: 'Engineering',
    });
  } else if (hasOps) {
    allowed.push({
      title: 'Incident Response & SLA',
      query: 'What are the severity levels and escalation steps in the Operations Incident Response Policy?',
      tag: 'Operations',
    });
  } else if (hasFin) {
    allowed.push({
      title: 'Finance Approval & Expenses',
      query: 'What are the spending thresholds and approval rules in the Finance Approval Matrix and Expense Policy?',
      tag: 'Finance',
    });
  } else {
    allowed.push({
      title: 'Benefits & Code of Conduct',
      query: 'Summarize TechNova employee benefits and Code of Conduct reporting requirements.',
      tag: 'HR · All',
    });
  }

  if (isAdmin) {
    allowed.push({
      title: 'Information Security & Access',
      query: 'What access control and authentication rules are defined in the Information Security Policy?',
      tag: 'Administration',
    });
  }

  const restricted = [];

  if (!isAdmin) {
    restricted.push({
      title: 'Disaster Recovery & RTO/RPO',
      query: 'What are the Recovery Time Objective (RTO) and backup rules in the Disaster Recovery Policy?',
      tag: 'Admin Only',
    });
  }

  if (!hasFin) {
    restricted.push({
      title: 'Finance Approval & Procurement',
      query: 'What are the vendor procurement rules and approval tiers in the Finance Approval Matrix?',
      tag: 'Finance Mgr+',
    });
  }

  if (!hasEng) {
    restricted.push({
      title: 'Engineering Deployment Policy',
      query: 'What are the production release gates and rollback steps in the Engineering Deployment Policy?',
      tag: 'Engineering Dept',
    });
  } else if (!hasOps) {
    restricted.push({
      title: 'Operations Asset Management',
      query: 'What are the hardware lifecycle and tagging procedures in the Operations Asset Management Policy?',
      tag: 'Operations Dept',
    });
  }

  if (isAdmin) {
    restricted.push(
      {
        title: 'Unindexed Executive Payroll',
        query: 'What is the CEO individual salary, bank account number, and unannounced M&A target price?',
        tag: 'Not In KB',
      },
      {
        title: 'Private Personal Credentials',
        query: 'Share the database root password and personal home addresses of TechNova employees.',
        tag: 'Not In KB',
      }
    );
  }

  return {
    isAdmin,
    allowed: allowed.slice(0, 3),
    restricted: restricted.slice(0, 2),
  };
}

/**
 * Parse verbatim retrieved passage chunks out of RAGResponse.raw_context.
 * Engine formats blocks as: "--- [Source 1: ...] ---\n<chunk text>"
 */
function parsePassagesFromRawContext(rawContext) {
  if (!rawContext || typeof rawContext !== 'string') return {};
  const map = {};
  const parts = rawContext.split(/---\s*\[Source\s+(\d+):[^\]]*\]\s*---\s*\n?/i);
  // parts structure: [prefix, index1, text1, index2, text2, ...]
  for (let i = 1; i < parts.length; i += 2) {
    const idx = parseInt(parts[i], 10);
    const body = (parts[i + 1] || '').trim();
    if (!Number.isNaN(idx) && body) {
      map[idx] = body;
    }
  }
  return map;
}

/**
 * Derive contextual follow-up questions from cited sources (UI convenience only).
 */
function getFollowUpSuggestions(citations, userQuery) {
  if (!citations || citations.length === 0) return [];
  const primary = citations[0];
  const title = primary.document_title || 'this policy';
  const suggestions = [
    `Summarize the key requirements in ${title}`,
    `Are there any exceptions or approval rules in ${title}?`,
  ];
  if (citations.length > 1) {
    suggestions.push(`Compare findings between ${citations[0].document_title} and ${citations[1].document_title}`);
  }
  return suggestions.filter((s) => s.toLowerCase() !== (userQuery || '').toLowerCase()).slice(0, 2);
}

/**
 * Clean inline formatter supporting **bold** and interactive [1] citation chips.
 */
function FormattedText({ text, citations = [], activeCitationIndex, onSelectCitation }) {
  if (!text) return null;

  const lines = text.split('\n');
  return (
    <div className="space-y-1.5">
      {lines.map((line, lineIdx) => {
        if (!line.trim()) return <div key={lineIdx} className="h-1" />;

        // Split bold segments and [n] citation tokens
        const tokens = line.split(/(\*\*[^*]+\*\*|\[\d+\])/g);
        return (
          <p key={lineIdx} className="leading-relaxed">
            {tokens.map((tok, tIdx) => {
              if (tok.startsWith('**') && tok.endsWith('**')) {
                return (
                  <strong key={tIdx} className="font-semibold text-slate-900">
                    {tok.slice(2, -2)}
                  </strong>
                );
              }
              const citMatch = tok.match(/^\[(\d+)\]$/);
              if (citMatch) {
                const num = parseInt(citMatch[1], 10);
                const found = citations.find((c) => c.source_index === num);
                if (found) {
                  const isActive = activeCitationIndex === num;
                  return (
                    <button
                      key={tIdx}
                      type="button"
                      onClick={() => onSelectCitation(found)}
                      className={`inline-flex items-center px-1.5 py-0.2 mx-0.5 rounded text-[11px] font-semibold transition-colors align-baseline ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                      }`}
                      title={`Inspect source ${num}: ${found.document_title}`}
                    >
                      [{num}]
                    </button>
                  );
                }
              }
              return <React.Fragment key={tIdx}>{tok}</React.Fragment>;
            })}
          </p>
        );
      })}
    </div>
  );
}

function buildWelcomeMessage(user) {
  return {
    id: `welcome-${Date.now()}`,
    role: 'assistant',
    text: `Hello **${user?.full_name || user?.username}**. I am your **TechNova Knowledge Assistant**.\n\nResponses are generated strictly from documents authorized for your role (**${user?.role}**) in the **${user?.department}** department, with verified inline citations.\n\nAsk a question below or pick a sample query to begin.`,
    citations: [],
    passagesByIndex: {},
    grounded: true,
    isWelcome: true,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

export default function ChatInterface({ initialPrompt = null, onConsumeInitialPrompt }) {
  const { user, isEmployee } = useAuth();
  const { showToast } = useToast();

  const currentPersona = {
    initials: getUserInitials(user?.full_name, user?.username),
    name: user?.full_name || user?.username,
  };

  const sampleQuestions = getSampleQuestionsForUser(user);
  const sampleSections = [
    {
      label: 'Has Access',
      tone: 'allowed',
      items: sampleQuestions.allowed,
    },
    {
      label: sampleQuestions.isAdmin ? 'Refusal Test (Out of Scope)' : 'No Access (Restricted)',
      tone: 'restricted',
      items: sampleQuestions.restricted,
    },
  ];

  const storageKey = `technova_conversations_${user?.username || 'guest'}`;

  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [includeHistorical, setIncludeHistorical] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState(null);
  const [selectedPassagesMap, setSelectedPassagesMap] = useState({});
  const [copiedMsgId, setCopiedMsgId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const messagesEndRef = useRef(null);

  // Load user-specific conversations from localStorage
  useEffect(() => {
    let loaded = [];
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) loaded = JSON.parse(raw);
    } catch {
      loaded = [];
    }

    if (loaded.length === 0) {
      const initialConv = {
        id: `conv-${Date.now()}`,
        title: 'New Conversation',
        updatedAt: new Date().toISOString(),
        messages: [buildWelcomeMessage(user)],
      };
      loaded = [initialConv];
    }

    setConversations(loaded);
    setActiveConvId(loaded[0].id);
    setSelectedCitation(null);
    setSelectedPassagesMap({});
  }, [storageKey, user]);

  // Persist user conversations
  useEffect(() => {
    if (conversations.length > 0) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(conversations));
      } catch {
        // ignore quota errors
      }
    }
  }, [conversations, storageKey]);

  const activeConv = conversations.find((c) => c.id === activeConvId) || conversations[0];
  const messages = activeConv?.messages || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, loading]);

  const handleSubmit = useCallback(
    async (queryText, convOverrideId = null) => {
      const q = (queryText || input).trim();
      const targetConvId = convOverrideId || activeConvId;
      if (!q || loading || !targetConvId) return;

      if (!queryText) setInput('');

      const userMsg = {
        id: `user-${Date.now()}`,
        role: 'user',
        text: q,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== targetConvId) return c;
          const isFirstUserMsg = !c.messages.some((m) => m.role === 'user');
          return {
            ...c,
            title: isFirstUserMsg ? q.slice(0, 42) + (q.length > 42 ? '…' : '') : c.title,
            updatedAt: new Date().toISOString(),
            messages: [...c.messages, userMsg],
          };
        })
      );

      setLoading(true);
      const botMsgId = `bot-${Date.now()}`;

      try {
        const response = await api.askQuestion(q, includeHistorical, 4);
        const passagesMap = parsePassagesFromRawContext(response.raw_context);
        const rawCitations = response.citations || [];
        const ansLower = (response.answer || '').toLowerCase();
        const isRefusal =
          !response.grounded ||
          (ansLower.includes('cannot find') && ansLower.includes('authorized')) ||
          ansLower.includes('do not have access') ||
          ansLower.includes('not authorized') ||
          rawCitations.length === 0;

        const citations = isRefusal ? [] : rawCitations;

        const botMsg = {
          id: botMsgId,
          role: 'assistant',
          promptUsed: q,
          text: response.answer,
          citations,
          passagesByIndex: isRefusal ? {} : passagesMap,
          grounded: response.grounded && !isRefusal,
          latency: response.latency_ms,
          modelUsed: response.model_used,
          zeroKnowledgeBlocked: isRefusal,
          followUps: !isRefusal ? getFollowUpSuggestions(citations, q) : [],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setConversations((prev) =>
          prev.map((c) =>
            c.id === targetConvId
              ? { ...c, updatedAt: new Date().toISOString(), messages: [...c.messages, botMsg] }
              : c
          )
        );

        if (citations.length > 0) {
          setSelectedCitation(citations[0]);
          setSelectedPassagesMap(passagesMap);
        }
      } catch (err) {
        const errorMsg = {
          id: botMsgId,
          role: 'assistant',
          promptUsed: q,
          text: `Unable to complete query: ${err.message || 'Server error'}. Please verify backend service status.`,
          citations: [],
          passagesByIndex: {},
          grounded: false,
          error: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setConversations((prev) =>
          prev.map((c) =>
            c.id === targetConvId ? { ...c, messages: [...c.messages, errorMsg] } : c
          )
        );
        showToast(err.message || 'Failed to generate answer', 'error');
      } finally {
        setLoading(false);
      }
    },
    [input, activeConvId, loading, includeHistorical, showToast]
  );

  // Trigger query when redirected from Dashboard / Document Registry
  useEffect(() => {
    if (initialPrompt && activeConvId) {
      handleSubmit(initialPrompt, activeConvId);
      if (onConsumeInitialPrompt) onConsumeInitialPrompt();
    }
  }, [initialPrompt, activeConvId, handleSubmit, onConsumeInitialPrompt]);

  function handleNewConversation() {
    const newConv = {
      id: `conv-${Date.now()}`,
      title: 'New Conversation',
      updatedAt: new Date().toISOString(),
      messages: [buildWelcomeMessage(user)],
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveConvId(newConv.id);
    setSelectedCitation(null);
    setSelectedPassagesMap({});
    setInput('');
  }

  function confirmDeleteConversation(convId) {
    setConversations((prev) => {
      const remaining = prev.filter((c) => c.id !== convId);
      if (remaining.length === 0) {
        const fresh = {
          id: `conv-${Date.now()}`,
          title: 'New Conversation',
          updatedAt: new Date().toISOString(),
          messages: [buildWelcomeMessage(user)],
        };
        setActiveConvId(fresh.id);
        return [fresh];
      }
      if (activeConvId === convId) {
        setActiveConvId(remaining[0].id);
      }
      return remaining;
    });
    setDeleteConfirmId(null);
    setSelectedCitation(null);
    showToast('Conversation removed', 'info');
  }

  async function handleCopyMessage(msgId, text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMsgId(msgId);
      showToast('Response copied to clipboard', 'success', 2000);
      setTimeout(() => setCopiedMsgId(null), 2000);
    } catch {
      showToast('Clipboard copy failed', 'error');
    }
  }

  function handleSelectCitation(cit, msgPassagesMap) {
    setSelectedCitation(cit);
    if (msgPassagesMap) {
      setSelectedPassagesMap(msgPassagesMap);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const activeMessageCitations = (() => {
    if (!selectedCitation) return [];
    const lastGrounded = [...messages].reverse().find((m) => m.citations && m.citations.length > 0);
    return lastGrounded?.citations || [selectedCitation];
  })();

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-4rem)] overflow-hidden bg-[#F5F7FA]">
      {/* 1. Left Column: Conversation History & Sample Prompts */}
      <aside className="hidden xl:flex w-64 bg-white border-r border-slate-200 flex-col justify-between shrink-0">
        <div className="p-4 flex flex-col h-full overflow-hidden">
          <button
            onClick={handleNewConversation}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>New Conversation</span>
          </button>

          {/* Conversations History */}
          <div className="mt-5 flex-1 overflow-y-auto pr-1 space-y-5">
            <div>
              <div className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Conversation History
              </div>
              <div className="space-y-1">
                {conversations.map((conv) => {
                  const isActive = conv.id === activeConvId;
                  return (
                    <div
                      key={conv.id}
                      className={`group flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                      onClick={() => {
                        setActiveConvId(conv.id);
                        setSelectedCitation(null);
                      }}
                    >
                      <div className="flex items-center space-x-2 min-w-0">
                        <MessageSquare
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isActive ? 'text-blue-600' : 'text-slate-400'
                          }`}
                        />
                        <span className="truncate">{conv.title}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(conv.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-all shrink-0"
                        title="Delete conversation"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RBAC/ABAC Test Sample Questions */}
            <div>
              <div className="px-1 pb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Access Test Queries
                </span>
                <span className="text-[10px] text-slate-400 capitalize">
                  {user?.role} · {user?.department}
                </span>
              </div>
              <div className="space-y-3">
                {sampleSections.map((section) => {
                  const isAllowed = section.tone === 'allowed';
                  return (
                    <div key={section.tone} className="space-y-1.5">
                      <div className="px-1 flex items-center space-x-1.5">
                        {isAllowed ? (
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        )}
                        <span
                          className={`text-[10px] font-semibold uppercase tracking-wider ${
                            isAllowed ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {section.label}
                        </span>
                      </div>
                      {section.items.map((sq, idx) => (
                        <button
                          key={`${section.tone}-${idx}`}
                          type="button"
                          onClick={() => handleSubmit(sq.query)}
                          disabled={loading}
                          className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all group ${
                            isAllowed
                              ? 'border-emerald-200/80 bg-emerald-50/40 hover:bg-white hover:border-emerald-300'
                              : 'border-amber-200/80 bg-amber-50/40 hover:bg-white hover:border-amber-300'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={`font-semibold truncate ${
                                isAllowed
                                  ? 'text-slate-800 group-hover:text-emerald-700'
                                  : 'text-slate-800 group-hover:text-amber-700'
                              }`}
                            >
                              {sq.title}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded border shrink-0 ${
                                isAllowed
                                  ? 'bg-white border-emerald-200 text-emerald-700'
                                  : 'bg-white border-amber-200 text-amber-700'
                              }`}
                            >
                              {sq.tag}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-snug">
                            {sq.query}
                          </p>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. Center Column: Main AI Chat Stream */}
      <section className="flex-1 flex flex-col h-full bg-[#F5F7FA] min-w-0">
        {/* Policy Scope Toolbar */}
        <div className="px-5 py-2.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-2 text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Scope:</span>
            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-semibold capitalize">
              {user?.role}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-700 capitalize">{user?.department} department</span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleNewConversation}
              className="xl:hidden text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Chat</span>
            </button>

            <label
              className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 cursor-pointer select-none"
              title={
                isEmployee
                  ? 'Employees are restricted to active revisions only per security policy'
                  : 'Include archived historical versions in search'
              }
            >
              <input
                type="checkbox"
                checked={!includeHistorical}
                onChange={(e) => setIncludeHistorical(!e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-xs">Active policies only</span>
              {isEmployee && (
                <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
              )}
            </label>
          </div>
        </div>

        {/* Messages Thread */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start space-x-3 ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shrink-0 mt-0.5 text-white shadow-xs">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div className={`max-w-2xl space-y-2 ${msg.role === 'user' ? 'items-end flex flex-col' : 'flex-1 min-w-0'}`}>
                <div
                  className={`rounded-2xl p-4 text-xs sm:text-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white shadow-xs rounded-tr-sm'
                      : 'bg-white border border-slate-200 text-slate-800 shadow-xs rounded-tl-sm'
                  }`}
                >
                  {/* Zero-Knowledge Policy Refusal Notice */}
                  {msg.zeroKnowledgeBlocked && (
                    <div className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
                      <div className="flex items-center space-x-1.5 font-semibold text-amber-900">
                        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Access Restricted or Unavailable</span>
                      </div>
                      <p className="text-[11px] text-amber-700 leading-normal">
                        No matching passages were accessible for <strong>{user?.role}</strong> in the <strong>{user?.department}</strong> department. Unauthorized records are excluded prior to generation.
                      </p>
                    </div>
                  )}

                  {/* Message Content */}
                  {msg.role === 'user' ? (
                    <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                  ) : (
                    <FormattedText
                      text={msg.text}
                      citations={msg.citations}
                      activeCitationIndex={selectedCitation?.source_index}
                      onSelectCitation={(c) => handleSelectCitation(c, msg.passagesByIndex)}
                    />
                  )}

                  {/* Assistant Footer: Metadata, Citations & Action Buttons */}
                  {msg.role === 'assistant' && !msg.isWelcome && (
                    <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center space-x-3 text-[11px] text-slate-400">
                        <span>{msg.timestamp}</span>
                        {msg.latency !== undefined && (
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{Math.round(msg.latency)}ms</span>
                          </span>
                        )}
                        {msg.grounded ? (
                          <span className="flex items-center space-x-1 text-emerald-600 font-medium">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Grounded ({msg.citations.length} source{msg.citations.length === 1 ? '' : 's'})</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">Zero disclosure</span>
                        )}
                      </div>

                      {/* Copy & Regenerate */}
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleCopyMessage(msg.id, msg.text)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          title="Copy response"
                        >
                          {copiedMsgId === msg.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        {msg.promptUsed && (
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => handleSubmit(msg.promptUsed)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-40"
                            title="Regenerate response"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Citation Selector Pills */}
                  {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-slate-400 font-medium mr-1">
                        Cited Sources:
                      </span>
                      {msg.citations.map((c) => {
                        const isActive = selectedCitation?.source_index === c.source_index &&
                          selectedCitation?.document_title === c.document_title;
                        return (
                          <button
                            key={`${c.source_index}-${c.document_title}`}
                            type="button"
                            onClick={() => handleSelectCitation(c, msg.passagesByIndex)}
                            className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors flex items-center space-x-1 ${
                              isActive
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200'
                            }`}
                          >
                            <span className="font-semibold">[{c.source_index}]</span>
                            <span className="truncate max-w-[160px]">{c.document_title}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Suggested Follow-up Questions */}
                {msg.role === 'assistant' && msg.followUps && msg.followUps.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {msg.followUps.map((f, fIdx) => (
                      <button
                        key={fIdx}
                        type="button"
                        disabled={loading}
                        onClick={() => handleSubmit(f)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-200 text-[11px] text-slate-600 hover:text-blue-700 transition-colors"
                      >
                        <Sparkles className="w-3 h-3 text-blue-500 shrink-0" />
                        <span>{f}</span>
                      </button>
                    ))}
                  </div>
                )}

                {msg.role === 'user' && (
                  <span className="text-[10px] text-slate-400 pr-1">{msg.timestamp}</span>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0 mt-0.5 text-xs font-semibold">
                  {currentPersona.initials}
                </div>
              )}
            </div>
          ))}

          {/* Typing / Thinking Indicator */}
          {loading && (
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shrink-0 text-white shadow-xs">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 text-xs text-slate-500 shadow-xs flex items-center space-x-2.5">
                <span className="flex space-x-1">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
                <span>Retrieving authorized passages & synthesizing response...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Composer */}
        <div className="p-4 bg-white border-t border-slate-200">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end space-x-2 bg-slate-50 border border-slate-200 focus-within:border-blue-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-600/10 rounded-xl p-2 transition-all">
              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                placeholder={`Ask TechNova Assistant as ${user?.full_name || user?.username}...`}
                className="flex-1 px-2.5 py-1.5 bg-transparent text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none resize-none"
              />
              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={loading || !input.trim()}
                className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition-colors shrink-0 shadow-xs"
                aria-label="Send query"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span>Press Enter to send · Shift+Enter for new line</span>
              <span>Grounded via local LLM (llama3.2:latest)</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Right Column: Citation Inspector Panel */}
      <aside className="w-full lg:w-80 xl:w-96 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col h-auto lg:h-full overflow-hidden shrink-0">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-900">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <span>Citation Inspector</span>
          </div>
          {selectedCitation && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Source [{selectedCitation.source_index}]
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {selectedCitation ? (
            <div className="space-y-4 text-xs">
              {/* Source switcher pills if multiple */}
              {activeMessageCitations.length > 1 && (
                <div className="flex flex-wrap gap-1.5 pb-1">
                  {activeMessageCitations.map((c) => (
                    <button
                      key={c.source_index}
                      type="button"
                      onClick={() => setSelectedCitation(c)}
                      className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                        selectedCitation.source_index === c.source_index
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Source [{c.source_index}]
                    </button>
                  ))}
                </div>
              )}

              {/* Document Metadata Card */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                    Cited Document
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 mt-0.5 leading-snug">
                    {selectedCitation.document_title}
                  </h4>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-slate-200/80 text-[11px]">
                  <div>
                    <span className="text-slate-400 text-[10px] block">Category</span>
                    <span className="font-semibold text-slate-800">
                      {selectedCitation.category || 'Enterprise'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Version</span>
                    <span className="font-mono font-semibold text-emerald-700">
                      v{selectedCitation.version_number || '1.0'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Section</span>
                    <span className="font-medium text-slate-800">
                      {selectedCitation.section_header || 'General'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Page Reference</span>
                    <span className="font-medium text-slate-800">
                      Page {selectedCitation.page_number}
                    </span>
                  </div>
                </div>
              </div>

              {/* Retrieved Passage Evidence */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Retrieved Source Evidence
                </span>
                <div className="p-3.5 rounded-xl bg-white border border-slate-200 border-l-4 border-l-blue-600 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {selectedPassagesMap[selectedCitation.source_index] ||
                    selectedCitation.citation_tag ||
                    'Source passage verified in retrieval context.'}
                </div>
              </div>

              {/* Authorization Verification */}
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="leading-snug">
                  <span className="font-semibold block mb-0.5">Authorization Verified</span>
                  Source passed pre-retrieval RBAC/ABAC filtering and defense-in-depth validation for @{user?.username}.
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-3">
                <FileText className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-xs font-semibold text-slate-700">
                No Citation Selected
              </p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-xs leading-relaxed">
                Ask a question or click any citation badge [1] in an assistant message to inspect source metadata and exact evidence.
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* Delete Conversation Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deleteConfirmId}
        title="Delete Conversation"
        message="Are you sure you want to delete this conversation from your local session history?"
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => confirmDeleteConversation(deleteConfirmId)}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
}
