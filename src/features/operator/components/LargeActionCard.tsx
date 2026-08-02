import React from 'react';
import { Link } from 'react-router-dom';

type Props = {
  icon: React.ReactNode;
  title: string;
  description: string;
  to?: string;
  onClick?: () => void;
  tone?: 'primary' | 'secondary';
};

export function LargeActionCard({ icon, title, description, to, onClick, tone = 'primary' }: Props) {
  const className = [
    'flex min-h-[140px] w-full flex-col justify-between rounded-2xl border-2 p-5 text-left transition active:scale-[0.99]',
    'focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300',
    tone === 'primary'
      ? 'border-cyan-700/30 bg-cyan-700 text-white shadow-lg shadow-cyan-900/20'
      : 'border-slate-200 bg-white text-slate-900 shadow-sm',
  ].join(' ');

  const content = (
    <>
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-3xl">
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold leading-tight">{title}</div>
        <div className={`mt-1 text-sm ${tone === 'primary' ? 'text-cyan-50/90' : 'text-slate-500'}`}>
          {description}
        </div>
      </div>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}
