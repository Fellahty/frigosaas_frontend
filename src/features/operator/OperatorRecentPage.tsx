import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchRecentOperations } from '@/lib/api/operator';
import { useOperatorUi } from './OperatorProvider';

const LABELS: Record<string, string> = {
  entry: 'Entrée',
  complete_exit: 'Sortie complète',
  partial_exit: 'Sortie partielle',
  move: 'Déplacement',
  reprint_label: 'Réimpression étiquette',
  reprint_ticket: 'Réimpression ticket',
  print_failed: 'Échec impression',
  login: 'Connexion',
  lock: 'Verrouillage',
  unlock: 'Déverrouillage',
};

export function OperatorRecentPage() {
  const navigate = useNavigate();
  const { tenantId } = useOperatorUi();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['operator-recent', tenantId],
    enabled: !!tenantId,
    queryFn: () => fetchRecentOperations(tenantId, true),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <button type="button" onClick={() => navigate('/operator')} className="mb-3 min-h-[48px] font-semibold text-cyan-800">
        ← Accueil
      </button>
      <h1 className="mb-4 text-3xl font-extrabold">Opérations récentes</h1>
      {isLoading ? <p>Chargement…</p> : null}
      <div className="grid gap-3">
        {rows.map((r) => (
          <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-lg font-bold">{LABELS[r.operationType] || r.operationType}</div>
            <div className="text-sm text-slate-600">
              {[r.palletCode, r.clientName, r.roomName].filter(Boolean).join(' · ')}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {r.createdAt ? new Date(r.createdAt).toLocaleString('fr-FR') : ''}
            </div>
          </div>
        ))}
        {!isLoading && rows.length === 0 ? (
          <p className="text-slate-500">Aucune opération pour le moment.</p>
        ) : null}
      </div>
    </div>
  );
}
