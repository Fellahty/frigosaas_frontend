import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { fetchTenantPublicInfo } from '../lib/tenantBranding';
import {
  getStoredTenantSlug,
  persistTenantSession,
  resolveSlugFromHostname,
} from '../lib/tenantResolver';
import type { FacilityGroupConfig } from '../lib/facilityGroups';

export interface TenantContextValue {
  slug: string | null;
  legacyId: string | null;
  name: string | null;
  status: string | null;
  facilityGroups: FacilityGroupConfig[] | null;
  loading: boolean;
  error: string | null;
  /** URL de login pour ce tenant */
  loginPath: string;
  setFromLogin: (slug: string, legacyId: string, name: string) => void;
  refresh: () => Promise<void>;
}

const TenantContext = createContext<TenantContextValue | null>(null);

interface TenantProviderProps {
  children: React.ReactNode;
  /** Slug depuis /login/:tenant */
  pathSlug?: string;
}

export const TenantProvider: React.FC<TenantProviderProps> = ({ children, pathSlug }) => {
  const [slug, setSlug] = useState<string | null>(null);
  const [legacyId, setLegacyId] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [facilityGroups, setFacilityGroups] = useState<FacilityGroupConfig[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBranding = async (targetSlug: string) => {
    setLoading(true);
    setError(null);
    const info = await fetchTenantPublicInfo(targetSlug);
    if (!info) {
      setError('Client frigo introuvable sur FrigoSmart');
      setSlug(targetSlug);
      setLegacyId(null);
      setName(null);
      setStatus(null);
      setFacilityGroups(null);
    } else {
      setSlug(info.slug);
      setLegacyId(info.legacyId);
      setName(info.name);
      setStatus(info.status);
      setFacilityGroups(info.facilityGroups ?? null);
      persistTenantSession(info.slug, info.legacyId, info.name);
    }
    setLoading(false);
  };

  useEffect(() => {
    const hostSlug = resolveSlugFromHostname();

    if (pathSlug) {
      loadBranding(pathSlug.toLowerCase());
      return;
    }

    if (hostSlug) {
      loadBranding(hostSlug);
      return;
    }

    // /login sans slug ni sous-domaine : plateforme FrigoSmart, pas un client
    setSlug(null);
    setLegacyId(null);
    setName(null);
    setStatus(null);
    setFacilityGroups(null);
    setError(null);
    setLoading(false);
  }, [pathSlug]);

  const value = useMemo<TenantContextValue>(
    () => ({
      slug,
      legacyId,
      name,
      status,
      facilityGroups,
      loading,
      error,
      loginPath: slug ? `/login/${slug}` : '/login',
      setFromLogin: (s, id, n) => {
        persistTenantSession(s, id, n);
        setSlug(s);
        setLegacyId(id);
        setName(n);
      },
      refresh: async () => {
        const target = slug || pathSlug || getStoredTenantSlug();
        if (target) await loadBranding(target);
      },
    }),
    [slug, legacyId, name, status, facilityGroups, loading, error, pathSlug]
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error('useTenant must be used within TenantProvider');
  }
  return ctx;
}

/** Safe hook — returns null outside provider (e.g. admin routes). */
export function useTenantOptional(): TenantContextValue | null {
  return useContext(TenantContext);
}
