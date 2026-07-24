/**
 * Résolution du tenant — source unique côté frontend.
 * Ordre : sous-domaine → chemin /login/:slug → session → défaut dev (env).
 */

const SLUG_KEY = 'tenantSlug';
const LEGACY_KEY = 'tenantId';

const RESERVED_SUBDOMAINS = new Set(['www', 'admin', 'api', 'app', 'staging']);

export function resolveSlugFromHostname(hostname = window.location.hostname): string | null {
  if (hostname.endsWith('.localhost')) {
    const slug = hostname.replace('.localhost', '');
    return slug && !RESERVED_SUBDOMAINS.has(slug) ? slug : null;
  }

  const parts = hostname.split('.');
  if (parts.length >= 3) {
    const slug = parts[0].toLowerCase();
    if (!RESERVED_SUBDOMAINS.has(slug)) return slug;
  }

  return null;
}

export function getStoredTenantSlug(): string | null {
  return localStorage.getItem(SLUG_KEY);
}

export function getStoredLegacyTenantId(): string | null {
  return localStorage.getItem(LEGACY_KEY);
}

export function persistTenantSession(slug: string, legacyId: string, name?: string) {
  localStorage.setItem(SLUG_KEY, slug.toLowerCase());
  localStorage.setItem(LEGACY_KEY, legacyId.toUpperCase());
  if (name) localStorage.setItem('tenantName', name);
}

export function clearTenantSession() {
  localStorage.removeItem(SLUG_KEY);
  localStorage.removeItem(LEGACY_KEY);
  localStorage.removeItem('tenantName');
}

export function getDevDefaultSlug(): string {
  return import.meta.env.VITE_DEFAULT_TENANT_SLUG || 'yazami';
}

/** Slug pour la page login (avant auth). */
export function resolveLoginSlug(pathSlug?: string): string {
  return (
    pathSlug?.toLowerCase() ||
    resolveSlugFromHostname() ||
    getStoredTenantSlug() ||
    getDevDefaultSlug()
  );
}

/** Legacy ID pour les appels API (après branding fetch ou session). */
export function resolveTenantLegacyId(userTenantId?: string | null): string | null {
  return userTenantId || getStoredLegacyTenantId() || null;
}

export function buildTenantLoginUrl(slug: string): string {
  const fromSubdomain = resolveSlugFromHostname();
  if (fromSubdomain === slug) return '/login';
  return `/login/${slug}`;
}
