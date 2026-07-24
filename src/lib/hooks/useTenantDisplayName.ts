import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTenantOptional } from '../../app/TenantProvider';
import { getStoredTenantName } from '../tenantBranding';
import { useTenantId } from './useTenantId';

export function useTenantDisplayName(): string {
  const { t } = useTranslation();
  const tenant = useTenantOptional();
  const tenantId = useTenantId();
  const fallback = t('common.companyName', 'Frigo SaaS');
  const [name, setName] = useState(() => tenant?.name || getStoredTenantName() || fallback);

  useEffect(() => {
    if (tenant?.name) {
      setName(tenant.name);
      return;
    }
    const stored = getStoredTenantName();
    if (stored) {
      setName(stored);
    }
  }, [tenant?.name, tenantId]);

  return name;
}
