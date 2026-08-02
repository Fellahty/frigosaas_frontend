import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOperatorUi } from '../OperatorProvider';
import { useAuth } from '@/lib/hooks/useAuth';
import { logout } from '@/lib/auth';

function statusLabel(online: boolean, printerStatus: string) {
  if (!online) return { text: 'Hors ligne', className: 'bg-red-100 text-red-800' };
  if (printerStatus === 'disconnected' || printerStatus === 'failed') {
    return { text: 'Imprimante déconnectée', className: 'bg-amber-100 text-amber-900' };
  }
  if (printerStatus === 'paper_out') {
    return { text: 'Papier indisponible', className: 'bg-amber-100 text-amber-900' };
  }
  if (printerStatus === 'printing') {
    return { text: 'Impression…', className: 'bg-cyan-100 text-cyan-900' };
  }
  return { text: 'Imprimante prête', className: 'bg-emerald-100 text-emerald-800' };
}

export function OperatorHeader() {
  const { context, online, printerStatus, lock } = useOperatorUi();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const printer = statusLabel(online, printerStatus);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-lg font-extrabold tracking-tight text-cyan-800">FrigoSmart</div>
          <div className="truncate text-sm text-slate-500">
            {user?.name || context?.operator.name} · {context?.season?.name || 'Aucune saison'}
          </div>
        </div>
        <div className="text-right text-sm font-semibold text-slate-700">
          {now.toLocaleDateString('fr-FR')}
          <div className="font-mono text-base">{now.toLocaleTimeString('fr-FR')}</div>
        </div>
        <span className={`rounded-full px-3 py-2 text-sm font-semibold ${printer.className}`}>
          {online ? printer.text : 'Réseau indisponible'}
        </span>
        <button
          type="button"
          onClick={lock}
          className="min-h-[48px] rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700"
        >
          Verrouiller
        </button>
        <button
          type="button"
          onClick={() => {
            logout();
            navigate('/operator/login');
          }}
          className="min-h-[48px] rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white"
        >
          Déconnexion
        </button>
      </div>
    </header>
  );
}
