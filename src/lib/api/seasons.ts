import { apiRequest } from './client';

export type SeasonStatus = 'draft' | 'active' | 'closed' | 'archived';

export interface SeasonStats {
  entries: number;
  exits: number;
  loans: number;
  invoices: number;
  storedQuantity: number;
}

export interface Season {
  id: string;
  tenantId: string;
  siteId: string;
  name: string;
  code?: string;
  startDate: string;
  endDate?: string | null;
  status: SeasonStatus;
  openedAt?: string;
  openedBy?: string;
  closedAt?: string | null;
  closedBy?: string | null;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  stats?: SeasonStats;
}

export interface ClosingCheckResult {
  canClose: boolean;
  blockingIssues: Array<{ code: string; label: string; count: number }>;
  warnings: Array<{ code: string; label: string; count: number }>;
}

function base(tenantId: string) {
  return `/tenants/${encodeURIComponent(tenantId)}/seasons`;
}

export function listSeasons(tenantId: string) {
  return apiRequest<Season[]>(base(tenantId));
}

export function getActiveSeason(tenantId: string) {
  return apiRequest<Season | null>(`${base(tenantId)}/active`);
}

export function getSeason(tenantId: string, id: string) {
  return apiRequest<Season>(`${base(tenantId)}/${id}`);
}

export function createSeason(
  tenantId: string,
  body: {
    name: string;
    code?: string;
    startDate: string;
    endDate?: string | null;
    notes?: string;
    activate?: boolean;
  }
) {
  return apiRequest<Season>(base(tenantId), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateSeason(
  tenantId: string,
  id: string,
  body: Partial<{
    name: string;
    code: string;
    startDate: string;
    endDate: string | null;
    notes: string;
  }>
) {
  return apiRequest<Season>(`${base(tenantId)}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function activateSeason(tenantId: string, id: string) {
  return apiRequest<Season>(`${base(tenantId)}/${id}/activate`, { method: 'POST', body: '{}' });
}

export function closeSeason(
  tenantId: string,
  id: string,
  body?: { confirmWarnings?: boolean; endDate?: string }
) {
  return apiRequest<Season>(`${base(tenantId)}/${id}/close`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export function archiveSeason(tenantId: string, id: string) {
  return apiRequest<Season>(`${base(tenantId)}/${id}/archive`, { method: 'POST', body: '{}' });
}

export function reopenSeason(tenantId: string, id: string) {
  return apiRequest<Season>(`${base(tenantId)}/${id}/reopen`, { method: 'POST', body: '{}' });
}

export function closingCheck(tenantId: string, id: string) {
  return apiRequest<ClosingCheckResult>(`${base(tenantId)}/${id}/closing-check`);
}

export function transferStock(
  tenantId: string,
  sourceId: string,
  body: {
    targetSeasonId: string;
    idempotencyKey: string;
    items?: Array<{ quantity: number; clientId?: string; receptionId?: string }>;
  }
) {
  return apiRequest<{ transferred: number }>(`${base(tenantId)}/${sourceId}/transfer-stock`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function carryBalances(
  tenantId: string,
  sourceId: string,
  body: {
    targetSeasonId: string;
    idempotencyKey: string;
    balances: Array<{ clientId: string; clientName?: string; amount: number }>;
  }
) {
  return apiRequest<{ carried: number }>(`${base(tenantId)}/${sourceId}/carry-balances`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export const SEASON_STATUS_LABELS: Record<SeasonStatus, string> = {
  draft: 'Brouillon',
  active: 'Active',
  closed: 'Clôturée',
  archived: 'Archivée',
};
