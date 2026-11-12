import React from 'react';

export default function EmptyState({ icon: Icon, title, description, action = null }) {
  return (
    <div className="py-12 px-6 text-center flex flex-col items-center justify-center">
      {Icon && (
        <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 mb-3">
          <Icon className="w-5 h-5" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description && (
        <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
