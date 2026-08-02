import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTenantId } from '../hooks/useTenantId';
import { useAuth } from '../hooks/useAuth';
import {
  getActiveSeason,
  listSeasons,
  type Season,
  type SeasonStatus,
} from '../api/seasons';
import {
  getStoredSelectedSeasonId,
  setStoredSelectedSeasonId,
} from './seasonStore';

interface SeasonContextValue {
  seasons: Season[];
  activeSeason: Season | null;
  selectedSeason: Season | null;
  selectedSeasonId: string | null;
  isLoading: boolean;
  isReadOnly: boolean;
  selectSeason: (seasonId: string) => void;
  resetToActive: () => void;
  refresh: () => Promise<void>;
}

const SeasonContext = createContext<SeasonContextValue | null>(null);

export const SeasonProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const tenantId = useTenantId();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(
    () => getStoredSelectedSeasonId()
  );

  const enabled = Boolean(tenantId && user && user.role !== 'client');

  const seasonsQuery = useQuery({
    queryKey: ['seasons', tenantId],
    queryFn: () => listSeasons(tenantId),
    enabled,
    staleTime: 30_000,
  });

  const activeQuery = useQuery({
    queryKey: ['seasons', tenantId, 'active'],
    queryFn: () => getActiveSeason(tenantId),
    enabled,
    staleTime: 30_000,
  });

  const seasons = seasonsQuery.data ?? [];
  const activeSeason = activeQuery.data ?? null;

  useEffect(() => {
    if (!enabled) return;
    if (selectedSeasonId) {
      const exists = seasons.some((s) => s.id === selectedSeasonId);
      if (seasons.length && !exists && activeSeason) {
        setSelectedSeasonId(activeSeason.id);
        setStoredSelectedSeasonId(activeSeason.id);
      }
      return;
    }
    if (activeSeason) {
      setSelectedSeasonId(activeSeason.id);
      setStoredSelectedSeasonId(activeSeason.id);
    }
  }, [enabled, selectedSeasonId, seasons, activeSeason]);

  const selectedSeason = useMemo(() => {
    if (!selectedSeasonId) return activeSeason;
    return seasons.find((s) => s.id === selectedSeasonId) ?? activeSeason;
  }, [selectedSeasonId, seasons, activeSeason]);

  const isReadOnly = Boolean(
    selectedSeason &&
      (selectedSeason.status === 'closed' || selectedSeason.status === 'archived')
  );

  const selectSeason = useCallback((seasonId: string) => {
    setSelectedSeasonId(seasonId);
    setStoredSelectedSeasonId(seasonId);
    queryClient.invalidateQueries();
  }, [queryClient]);

  const resetToActive = useCallback(() => {
    if (activeSeason) {
      setSelectedSeasonId(activeSeason.id);
      setStoredSelectedSeasonId(activeSeason.id);
      queryClient.invalidateQueries();
    }
  }, [activeSeason, queryClient]);

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['seasons', tenantId] }),
      queryClient.invalidateQueries({ queryKey: ['seasons', tenantId, 'active'] }),
    ]);
  }, [queryClient, tenantId]);

  const value: SeasonContextValue = {
    seasons,
    activeSeason,
    selectedSeason,
    selectedSeasonId: selectedSeason?.id ?? null,
    isLoading: seasonsQuery.isLoading || activeQuery.isLoading,
    isReadOnly,
    selectSeason,
    resetToActive,
    refresh,
  };

  return <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>;
};

export function useSeasonContext(): SeasonContextValue {
  const ctx = useContext(SeasonContext);
  if (!ctx) {
    return {
      seasons: [],
      activeSeason: null,
      selectedSeason: null,
      selectedSeasonId: null,
      isLoading: false,
      isReadOnly: false,
      selectSeason: () => undefined,
      resetToActive: () => undefined,
      refresh: async () => undefined,
    };
  }
  return ctx;
}

export function isSeasonWritableStatus(status?: SeasonStatus | null): boolean {
  return status === 'active' || status === 'draft';
}
