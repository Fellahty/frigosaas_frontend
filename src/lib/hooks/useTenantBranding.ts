import { useEffect, useState } from 'react';
import {
  fetchTenantPublicInfo,
  getDefaultTenantSlug,
  getStoredTenantName,
  type TenantPublicInfo,
} from '../tenantBranding';

export function useTenantBranding(tenantSlug?: string) {
  const slug = (tenantSlug || getDefaultTenantSlug()).toLowerCase();
  const [info, setInfo] = useState<TenantPublicInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      const data = await fetchTenantPublicInfo(slug);
      if (cancelled) return;

      if (!data) {
        setInfo(null);
        setError('Client introuvable');
      } else {
        setInfo(data);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const displayName = info?.name || getStoredTenantName() || slug.toUpperCase();

  return { slug, info, displayName, loading, error };
}
