const API_URL = import.meta.env.VITE_API_URL || '/api';
const TENANT_NAME_KEY = 'tenantName';
const DEFAULT_TENANT_SLUG = 'yazami';

export interface TenantPublicInfo {
  legacyId: string;
  slug: string;
  name: string;
  status: string;
  facilityGroups?: import('./facilityGroups').FacilityGroupConfig[];
}

export function getDefaultTenantSlug(): string {
  return DEFAULT_TENANT_SLUG;
}

export function getStoredTenantName(): string | null {
  return localStorage.getItem(TENANT_NAME_KEY);
}

export function setStoredTenantName(name: string) {
  localStorage.setItem(TENANT_NAME_KEY, name);
}

export function clearStoredTenantName() {
  localStorage.removeItem(TENANT_NAME_KEY);
}

export async function fetchTenantPublicInfo(slugOrId: string): Promise<TenantPublicInfo | null> {
  try {
    const res = await fetch(`${API_URL}/public/tenants/${encodeURIComponent(slugOrId)}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.success) return null;
    return body.data as TenantPublicInfo;
  } catch {
    return null;
  }
}
