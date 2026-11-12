import React from 'react';

export function CardSkeleton({ rows = 3 }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 animate-pulse">
      <div className="h-4 bg-slate-200 rounded w-1/3"></div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-3 bg-slate-100 rounded w-full"></div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 4, cols = 5 }) {
  return (
    <div className="p-4 space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }).map((__, c) => (
            <div key={c} className="h-4 bg-slate-100 rounded"></div>
          ))}
        </div>
      ))}
    </div>
  );
}
