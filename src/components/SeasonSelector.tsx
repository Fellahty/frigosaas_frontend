import React from 'react';
import { useSeasonContext } from '../lib/seasons/SeasonProvider';
import { SEASON_STATUS_LABELS } from '../lib/api/seasons';

export const SeasonSelector: React.FC<{ className?: string }> = ({ className = '' }) => {
  const {
    seasons,
    selectedSeason,
    selectedSeasonId,
    activeSeason,
    isLoading,
    isReadOnly,
    selectSeason,
    resetToActive,
  } = useSeasonContext();

  if (isLoading && seasons.length === 0) {
    return (
      <div className={`text-xs text-slate-500 ${className}`}>
        Chargement saison…
      </div>
    );
  }

  if (seasons.length === 0) {
    return (
      <div className={`rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 ${className}`}>
        Aucune saison configurée
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Saison
        </label>
        <select
          className="min-w-[220px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          value={selectedSeasonId ?? ''}
          onChange={(e) => selectSeason(e.target.value)}
        >
          {seasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {SEASON_STATUS_LABELS[s.status]}
            </option>
          ))}
        </select>
        {selectedSeason && activeSeason && selectedSeason.id !== activeSeason.id && (
          <button
            type="button"
            onClick={resetToActive}
            className="text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            Revenir à la saison active
          </button>
        )}
      </div>
      {isReadOnly && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Vous consultez une saison clôturée. Les modifications sont désactivées.
        </div>
      )}
    </div>
  );
};

export const SeasonReadOnlyBanner: React.FC = () => {
  const { isReadOnly } = useSeasonContext();
  if (!isReadOnly) return null;
  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      Vous consultez une saison clôturée. Les modifications sont désactivées.
    </div>
  );
};
