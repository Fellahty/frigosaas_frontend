import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ReactNode;
  accent?: 'blue' | 'emerald' | 'amber' | 'red' | 'indigo' | 'slate' | 'cyan';
  trend?: string;
}

const ACCENTS = {
  blue: { iconBg: 'bg-sky-50 text-sky-700', bar: 'from-sky-400 to-sky-600' },
  emerald: { iconBg: 'bg-emerald-50 text-emerald-700', bar: 'from-emerald-400 to-emerald-600' },
  amber: { iconBg: 'bg-amber-50 text-amber-700', bar: 'from-amber-400 to-amber-600' },
  red: { iconBg: 'bg-red-50 text-red-700', bar: 'from-red-400 to-red-600' },
  indigo: { iconBg: 'bg-cyan-50 text-cyan-700', bar: 'from-cyan-400 to-cyan-700' },
  cyan: { iconBg: 'bg-cyan-50 text-cyan-700', bar: 'from-cyan-400 to-cyan-700' },
  slate: { iconBg: 'bg-slate-100 text-slate-600', bar: 'from-slate-300 to-slate-500' },
};

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  hint,
  icon,
  accent = 'cyan',
  trend,
}) => {
  const style = ACCENTS[accent] || ACCENTS.cyan;
  return (
    <div className="admin-card-elevated group relative overflow-hidden p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(15,23,42,0.08)]">
      <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${style.bar} opacity-80`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
          {trend && (
            <p className="mt-2 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-100">
              {trend}
            </p>
          )}
        </div>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-black/5 ${style.iconBg}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
};
