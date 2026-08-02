import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTenantId } from '../../../lib/hooks/useTenantId';
import { useAuth } from '../../../lib/hooks/useAuth';
import { useSeasonContext } from '../../../lib/seasons/SeasonProvider';
import {
  activateSeason,
  archiveSeason,
  closeSeason,
  closingCheck,
  createSeason,
  reopenSeason,
  transferStock,
  SEASON_STATUS_LABELS,
  type ClosingCheckResult,
  type Season,
} from '../../../lib/api/seasons';
import { ApiError } from '../../../lib/api/client';

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('fr-FR');
  } catch {
    return '—';
  }
}

const statusBadge: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  active: 'bg-emerald-100 text-emerald-800',
  closed: 'bg-amber-100 text-amber-900',
  archived: 'bg-slate-200 text-slate-600',
};

export const SeasonsTab: React.FC = () => {
  const tenantId = useTenantId();
  const { user } = useAuth();
  const { seasons, activeSeason, refresh, isLoading } = useSeasonContext();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [startDate, setStartDate] = useState('');
  const [activateOnCreate, setActivateOnCreate] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<{
    season: Season;
    result: ClosingCheckResult;
  } | null>(null);

  const isAdmin = user?.role === 'admin';

  const sorted = useMemo(
    () =>
      [...seasons].sort(
        (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      ),
    [seasons]
  );

  const handleCreate = async () => {
    if (!name.trim() || !startDate) {
      toast.error('Nom et date de début obligatoires');
      return;
    }
    setBusyId('create');
    try {
      await createSeason(tenantId, {
        name: name.trim(),
        code: code.trim() || undefined,
        startDate: new Date(startDate).toISOString(),
        activate: activateOnCreate,
      });
      toast.success('Saison créée');
      setShowCreate(false);
      setName('');
      setCode('');
      setStartDate('');
      setActivateOnCreate(false);
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur création');
    } finally {
      setBusyId(null);
    }
  };

  const runAction = async (seasonId: string, action: () => Promise<unknown>, ok: string) => {
    setBusyId(seasonId);
    try {
      await action();
      toast.success(ok);
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Action impossible');
      if (e instanceof ApiError && e.details) {
        setCheckResult({
          season: seasons.find((s) => s.id === seasonId)!,
          result: e.details as ClosingCheckResult,
        });
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleClosingCheck = async (season: Season) => {
    setBusyId(season.id);
    try {
      const result = await closingCheck(tenantId, season.id);
      setCheckResult({ season, result });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Contrôle impossible');
    } finally {
      setBusyId(null);
    }
  };

  const handleClose = async (season: Season, confirmWarnings = false) => {
    await runAction(
      season.id,
      () => closeSeason(tenantId, season.id, { confirmWarnings }),
      'Saison clôturée'
    );
  };

  const handleTransferToActive = async (source: Season) => {
    if (!activeSeason || activeSeason.id === source.id) {
      toast.error('Créez et activez d’abord la saison cible');
      return;
    }
    const key = `transfer:${source.id}:${activeSeason.id}`;
    await runAction(
      source.id,
      () =>
        transferStock(tenantId, source.id, {
          targetSeasonId: activeSeason.id,
          idempotencyKey: key,
        }),
      'Stock reporté vers la saison active'
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Gestion des saisons</h2>
          <p className="mt-1 text-sm text-slate-600">
            Chaque campagne de stockage est isolée. Les chambres, clients et capteurs restent
            partagés.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {showCreate ? 'Annuler' : 'Créer une saison'}
        </button>
      </div>

      {showCreate && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Nom</span>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Saison 2026-2027"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Code (optionnel)</span>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="2026-2027"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Date de début</span>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={activateOnCreate}
              onChange={(e) => setActivateOnCreate(e.target.checked)}
            />
            Activer immédiatement (uniquement s’il n’y a pas déjà de saison active)
          </label>
          <button
            type="button"
            disabled={busyId === 'create'}
            onClick={handleCreate}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Enregistrer
          </button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
          Aucune saison. Créez la première campagne pour commencer.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Saison</th>
                <th className="px-4 py-3 font-medium">Début</th>
                <th className="px-4 py-3 font-medium">Fin</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Entrées</th>
                <th className="px-4 py-3 font-medium">Stock (caisses)</th>
                <th className="px-4 py-3 font-medium">Clôture</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((season) => (
                <tr key={season.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {season.name}
                    {season.code ? (
                      <span className="ml-2 text-xs text-slate-400">{season.code}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{formatDate(season.startDate)}</td>
                  <td className="px-4 py-3">{formatDate(season.endDate)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge[season.status]}`}
                    >
                      {SEASON_STATUS_LABELS[season.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">{season.stats?.entries ?? 0}</td>
                  <td className="px-4 py-3">{season.stats?.storedQuantity ?? 0}</td>
                  <td className="px-4 py-3">{formatDate(season.closedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {season.status === 'draft' && (
                        <button
                          type="button"
                          disabled={busyId === season.id}
                          onClick={() =>
                            runAction(
                              season.id,
                              () => activateSeason(tenantId, season.id),
                              'Saison activée'
                            )
                          }
                          className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                        >
                          Activer
                        </button>
                      )}
                      {season.status === 'active' && (
                        <>
                          <button
                            type="button"
                            disabled={busyId === season.id}
                            onClick={() => handleClosingCheck(season)}
                            className="rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            Vérifier
                          </button>
                          <button
                            type="button"
                            disabled={busyId === season.id}
                            onClick={() => handleClose(season)}
                            className="rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                          >
                            Clôturer
                          </button>
                        </>
                      )}
                      {season.status === 'closed' && (
                        <>
                          <button
                            type="button"
                            disabled={busyId === season.id}
                            onClick={() => handleTransferToActive(season)}
                            className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                          >
                            Reporter stock
                          </button>
                          <button
                            type="button"
                            disabled={busyId === season.id}
                            onClick={() =>
                              runAction(
                                season.id,
                                () => archiveSeason(tenantId, season.id),
                                'Saison archivée'
                              )
                            }
                            className="rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                          >
                            Archiver
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              disabled={busyId === season.id}
                              onClick={() =>
                                runAction(
                                  season.id,
                                  () => reopenSeason(tenantId, season.id),
                                  'Saison réouverte'
                                )
                              }
                              className="rounded-md bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100"
                            >
                              Réouvrir
                            </button>
                          )}
                        </>
                      )}
                      {season.status === 'archived' && isAdmin && (
                        <button
                          type="button"
                          disabled={busyId === season.id}
                          onClick={() =>
                            runAction(
                              season.id,
                              () => reopenSeason(tenantId, season.id),
                              'Saison réouverte'
                            )
                          }
                          className="rounded-md bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100"
                        >
                          Réouvrir
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {checkResult && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">
              Contrôle de clôture — {checkResult.season.name}
            </h3>
            <button
              type="button"
              className="text-sm text-slate-500 hover:text-slate-800"
              onClick={() => setCheckResult(null)}
            >
              Fermer
            </button>
          </div>
          {checkResult.result.blockingIssues.length === 0 &&
          checkResult.result.warnings.length === 0 ? (
            <p className="text-sm text-emerald-700">Aucun blocage. La saison peut être clôturée.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-600">
                  Blocages
                </h4>
                <ul className="space-y-1 text-sm">
                  {checkResult.result.blockingIssues.map((i) => (
                    <li key={i.code} className="text-red-800">
                      {i.label} ({i.count})
                    </li>
                  ))}
                  {checkResult.result.blockingIssues.length === 0 && (
                    <li className="text-slate-500">Aucun</li>
                  )}
                </ul>
              </div>
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-600">
                  Avertissements
                </h4>
                <ul className="space-y-1 text-sm">
                  {checkResult.result.warnings.map((i) => (
                    <li key={i.code} className="text-amber-800">
                      {i.label} ({i.count})
                    </li>
                  ))}
                  {checkResult.result.warnings.length === 0 && (
                    <li className="text-slate-500">Aucun</li>
                  )}
                </ul>
              </div>
            </div>
          )}
          {checkResult.result.canClose && (
            <button
              type="button"
              className="mt-4 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
              onClick={() =>
                handleClose(checkResult.season, checkResult.result.warnings.length > 0)
              }
            >
              Confirmer la clôture
            </button>
          )}
        </div>
      )}
    </div>
  );
};
