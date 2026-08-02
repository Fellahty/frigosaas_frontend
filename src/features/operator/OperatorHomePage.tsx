import React from 'react';
import { LargeActionCard } from './components/LargeActionCard';
import { useOperatorUi } from './OperatorProvider';

export function OperatorHomePage() {
  const { context } = useOperatorUi();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-slate-900">Accueil opérateur</h1>
        <p className="mt-1 text-base text-slate-600">
          {context?.siteName} · Choisissez une action
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <LargeActionCard
          to="/operator/entry"
          tone="primary"
          icon={<span aria-hidden>＋</span>}
          title="Nouvelle entrée"
          description="Créer une palette et imprimer"
        />
        <LargeActionCard
          to="/operator/scan"
          tone="primary"
          icon={<span aria-hidden>▦</span>}
          title="Sortie / Scanner"
          description="Scanner une palette pour sortir"
        />
        <LargeActionCard
          to="/operator/move"
          tone="primary"
          icon={<span aria-hidden>⇄</span>}
          title="Déplacement"
          description="Changer de chambre"
        />
        <LargeActionCard
          to="/operator/reprint"
          tone="primary"
          icon={<span aria-hidden>⎙</span>}
          title="Réimpression"
          description="Étiquette ou ticket (DUPLICATA)"
        />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <LargeActionCard
          to="/operator/stock"
          tone="secondary"
          icon={<span aria-hidden>▣</span>}
          title="Stock client"
          description="Voir les palettes en stock"
        />
        <LargeActionCard
          to="/operator/recent"
          tone="secondary"
          icon={<span aria-hidden>◷</span>}
          title="Opérations récentes"
          description="Historique de vos actions"
        />
      </div>
    </div>
  );
}
