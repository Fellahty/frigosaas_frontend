import React from 'react';
import { Link } from 'react-router-dom';

/* ── Buttons ── */
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

const btnStyles: Record<BtnVariant, string> = {
  primary:
    'bg-cyan-700 text-white shadow-sm shadow-cyan-700/25 hover:bg-cyan-600 active:bg-cyan-800',
  secondary:
    'border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300',
  ghost: 'text-slate-600 hover:bg-slate-100',
  danger: 'bg-red-600 text-white hover:bg-red-500 shadow-sm',
  success: 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm',
};

interface AdminButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: 'sm' | 'md';
  asChild?: boolean;
}

export const AdminButton: React.FC<AdminButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}) => (
  <button
    type="button"
    className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${
      size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm'
    } ${btnStyles[variant]} ${className}`}
    {...props}
  >
    {children}
  </button>
);

export const AdminLinkButton: React.FC<{
  to: string;
  variant?: BtnVariant;
  size?: 'sm' | 'md';
  className?: string;
  children: React.ReactNode;
}> = ({ variant = 'primary', size = 'md', className = '', children, to }) => (
  <Link
    to={to}
    className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition ${
      size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm'
    } ${btnStyles[variant]} ${className}`}
  >
    {children}
  </Link>
);

/* ── Card ── */
interface AdminCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}

export const AdminCard: React.FC<AdminCardProps> = ({ children, className = '', padding = true }) => (
  <div
    className={`admin-card-elevated overflow-hidden ${padding ? 'p-6' : ''} ${className}`}
  >
    {children}
  </div>
);

export const AdminCardHeader: React.FC<{
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ title, description, action }) => (
  <div className={`flex items-start justify-between gap-4 ${description ? 'mb-5' : 'mb-4'}`}>
    <div>
      <h3 className="font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
    </div>
    {action}
  </div>
);

/* ── Form fields ── */
export const AdminLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="mb-1.5 block text-xs font-medium text-slate-600">{children}</label>
);

export const AdminInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({
  className = '',
  ...props
}) => (
  <input
    className={`w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500/60 focus:bg-white focus:ring-2 focus:ring-cyan-600/15 ${className}`}
    {...props}
  />
);

export const AdminSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <select
    className={`w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-500/60 focus:bg-white focus:ring-2 focus:ring-cyan-600/15 ${className}`}
    {...props}
  >
    {children}
  </select>
);

export const AdminTextarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({
  className = '',
  ...props
}) => (
  <textarea
    className={`w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500/60 focus:bg-white focus:ring-2 focus:ring-cyan-600/15 ${className}`}
    {...props}
  />
);

/* ── Search ── */
export const AdminSearch: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder = 'Rechercher...' }) => (
  <div className="relative">
    <svg
      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
    <AdminInput
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="pl-10"
    />
  </div>
);

/* ── Filter pills ── */
export const AdminFilterPills: React.FC<{
  options: { key: string; label: string; count?: number }[];
  value: string;
  onChange: (key: string) => void;
}> = ({ options, value, onChange }) => (
  <div className="flex flex-wrap gap-2">
    {options.map((opt) => (
      <button
        key={opt.key}
        type="button"
        onClick={() => onChange(opt.key)}
        className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
          value === opt.key
            ? 'bg-cyan-700 text-white shadow-sm shadow-cyan-700/25'
            : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
        }`}
      >
        {opt.label}
        {opt.count != null && (
          <span className={`ml-1.5 ${value === opt.key ? 'text-cyan-100' : 'text-slate-400'}`}>
            {opt.count}
          </span>
        )}
      </button>
    ))}
  </div>
);

/* ── Table shell ── */
export const AdminTableShell: React.FC<{
  children: React.ReactNode;
  minWidth?: string;
}> = ({ children, minWidth = '700px' }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm" style={{ minWidth }}>
      {children}
    </table>
  </div>
);

export const AdminTableHead: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <thead>
    <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
      {children}
    </tr>
  </thead>
);

export const AdminTh: React.FC<{ children: React.ReactNode; align?: 'left' | 'right' }> = ({
  children,
  align = 'left',
}) => (
  <th className={`px-5 py-3.5 ${align === 'right' ? 'text-right' : 'text-left'}`}>{children}</th>
);

export const AdminTableBody: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <tbody className="divide-y divide-slate-100">{children}</tbody>
);

/* ── Empty state ── */
export const AdminEmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
    {icon && (
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        {icon}
      </div>
    )}
    <p className="font-medium text-slate-900">{title}</p>
    {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

/* ── Modal ── */
export const AdminModal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ open, onClose, title, description, children, footer }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Fermer"
      />
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/30">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-6 py-4 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Org avatar ── */
export const OrgAvatar: React.FC<{ name: string; size?: 'sm' | 'md' }> = ({ name, size = 'md' }) => {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  const colors = [
    'bg-cyan-100 text-cyan-800',
    'bg-sky-100 text-sky-800',
    'bg-teal-100 text-teal-800',
    'bg-emerald-100 text-emerald-800',
    'bg-slate-100 text-slate-700',
  ];
  const idx = name.charCodeAt(0) % colors.length;
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl font-semibold ${colors[idx]} ${
        size === 'sm' ? 'h-9 w-9 text-xs' : 'h-11 w-11 text-sm'
      }`}
    >
      {initials}
    </div>
  );
};

/* ── Page shell ── */
export const AdminPageShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="admin-page-shell min-h-full p-6 lg:p-8 xl:p-10">{children}</div>
);
