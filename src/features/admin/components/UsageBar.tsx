import React from 'react';

interface UsageBarProps {
  label: string;
  value: number;
  max?: number;
}

export const UsageBar: React.FC<UsageBarProps> = ({ label, value, max }) => {
  const pct = max && max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const warn = pct >= 90;
  const mid = pct >= 70 && pct < 90;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium text-slate-900">
          {value}
          {max != null && <span className="font-normal text-slate-400"> / {max}</span>}
        </span>
      </div>
      {max != null && (
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${
              warn ? 'bg-red-500' : mid ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
};
