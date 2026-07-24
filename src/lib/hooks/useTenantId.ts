import { useMemo } from 'react';
import { useTenantOptional } from '../../app/TenantProvider';
import { useAuth } from './useAuth';
import { getStoredLegacyTenantId } from '../tenantResolver';

/**
 * ID tenant (legacyId, ex: YAZAMI) pour les appels API et requêtes données.
 * Priorité : TenantProvider → utilisateur connecté → session stockée.
 */
export const useTenantId = (): string => {
  const tenant = useTenantOptional();
  const { user } = useAuth();

  return useMemo(() => {
    const resolved =
      tenant?.legacyId ||
      user?.tenantId ||
      getStoredLegacyTenantId() ||
      import.meta.env.VITE_DEFAULT_TENANT_ID ||
      '';

    if (!resolved && import.meta.env.DEV) {
      console.warn('[useTenantId] Aucun tenant résolu — utilisez /login/:slug');
    }
    return resolved;
  }, [tenant?.legacyId, user?.tenantId]);
};
