import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Lock, ShieldCheck } from 'lucide-react';

const VARIANT_CLASSES = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
};

export function StatusBadge({ label, variant = 'neutral', icon = null, className = '' }) {
  return (
    <span
      className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
        VARIANT_CLASSES[variant] || VARIANT_CLASSES.neutral
      } ${className}`}
    >
      {icon}
      <span>{label}</span>
    </span>
  );
}

export function OutcomeBadge({ outcome }) {
  const norm = String(outcome || '').toUpperCase();
  if (norm === 'SUCCESS') {
    return (
      <StatusBadge
        label="Success"
        variant="success"
        icon={<CheckCircle2 className="w-3 h-3" />}
      />
    );
  }
  if (norm === 'DENIED') {
    return (
      <StatusBadge
        label="Denied"
        variant="danger"
        icon={<XCircle className="w-3 h-3" />}
      />
    );
  }
  if (norm === 'REFUSED') {
    return (
      <StatusBadge
        label="Refused"
        variant="warning"
        icon={<AlertTriangle className="w-3 h-3" />}
      />
    );
  }
  return <StatusBadge label={outcome || 'Unknown'} variant="neutral" />;
}

export function ClearanceBadge({ permitted }) {
  if (permitted) {
    return (
      <StatusBadge
        label="Permitted"
        variant="success"
        icon={<ShieldCheck className="w-3 h-3" />}
      />
    );
  }
  return (
    <StatusBadge
      label="Restricted"
      variant="neutral"
      icon={<Lock className="w-3 h-3" />}
    />
  );
}
