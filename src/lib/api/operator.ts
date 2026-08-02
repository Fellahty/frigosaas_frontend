import { apiRequest } from './client';

export interface OperatorContext {
  operator: { id: string; name: string; role: string };
  tenantId: string;
  siteId: string;
  siteName: string;
  season: { id: string; name: string; code?: string; status: string } | null;
  roomsCount: number;
  clientsCount: number;
  printer: { mode: string; autoPrint: boolean; status: string };
  serverTime: string;
}

export interface OperatorClient {
  id: string;
  name: string;
  phone?: string;
  company?: string;
  email?: string;
}

export interface OperatorRoom {
  id: string;
  name: string;
  capacity: number;
  occupied: number;
  available: number;
  sensorId?: string;
  capteurInstalled?: boolean;
}

export interface OperatorPallet {
  id: string;
  code: string;
  receptionId: string | null;
  clientId?: string;
  clientName?: string;
  productName?: string;
  productVariety?: string;
  roomId?: string;
  roomName?: string;
  entryAt?: string;
  boxes: number;
  weight: number | null;
  initialBoxes: number;
  status: string;
  seasonId?: string;
  lotReference?: string;
}

export interface PrintJobSummary {
  id: string;
  documentType: string;
  status: string;
  payload: Record<string, unknown>;
  isDuplicate?: boolean;
}

function operatorBase(tenantId: string) {
  return `/tenants/${tenantId}/operator`;
}

export function listOperatorsForLogin(tenantId: string) {
  return apiRequest<Array<{ id: string; name: string }>>(
    `/auth/operators?tenantId=${encodeURIComponent(tenantId)}`,
    {},
    false
  );
}

export async function operatorPinLogin(tenantId: string, operatorId: string, pin: string) {
  const result = await apiRequest<{
    token: string;
    user: {
      id: string;
      name: string;
      phone?: string;
      username?: string;
      email?: string;
      role: string;
      tenantId: string;
      userType: 'manager' | 'client';
    };
  }>(
    '/auth/operator-login',
    {
      method: 'POST',
      body: JSON.stringify({ tenantId, operatorId, pin }),
    },
    false
  );
  return result;
}

export function fetchOperatorContext(tenantId: string) {
  return apiRequest<OperatorContext>(`${operatorBase(tenantId)}/context`);
}

export function fetchOperatorClients(tenantId: string, search?: string) {
  const q = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiRequest<OperatorClient[]>(`${operatorBase(tenantId)}/clients${q}`);
}

export function fetchOperatorRooms(tenantId: string) {
  return apiRequest<OperatorRoom[]>(`${operatorBase(tenantId)}/rooms`);
}

export function createOperatorEntry(
  tenantId: string,
  body: {
    clientId: string;
    roomId: string;
    productName: string;
    productVariety?: string;
    boxes: number;
    weight?: number;
    packagingType?: string;
    origin?: string;
    lotReference?: string;
    notes?: string;
    idempotencyKey: string;
  }
) {
  return apiRequest<{
    duplicated: boolean;
    receptionId?: string;
    palletId?: string;
    palletCode?: string;
    serial?: string;
    seasonId?: string;
    printJobs?: PrintJobSummary[];
    reception?: unknown;
    pallet?: unknown;
  }>(`${operatorBase(tenantId)}/entries`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function fetchPalletByCode(tenantId: string, code: string) {
  return apiRequest<OperatorPallet>(
    `${operatorBase(tenantId)}/pallets/${encodeURIComponent(code)}`
  );
}

export function exitOperatorPallet(
  tenantId: string,
  palletId: string,
  body: {
    mode: 'complete' | 'partial';
    boxes?: number;
    weight?: number;
    idempotencyKey: string;
  }
) {
  return apiRequest<{
    duplicated: boolean;
    remaining?: number;
    closed?: boolean;
    boxesExited?: number;
    printJob?: PrintJobSummary;
  }>(`${operatorBase(tenantId)}/pallets/${palletId}/exit`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function moveOperatorPallet(
  tenantId: string,
  palletId: string,
  body: { destinationRoomId: string; idempotencyKey: string }
) {
  return apiRequest<{
    duplicated: boolean;
    palletId?: string;
    palletCode?: string;
    sourceRoomId?: string;
    destinationRoomId?: string;
    destinationRoomName?: string;
  }>(`${operatorBase(tenantId)}/pallets/${palletId}/move`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function fetchRecentOperations(tenantId: string, mine = true) {
  return apiRequest<
    Array<{
      id: string;
      operationType: string;
      clientName?: string;
      palletCode?: string;
      roomName?: string;
      createdAt: string;
      newValues?: Record<string, unknown>;
    }>
  >(`${operatorBase(tenantId)}/recent-operations?mine=${mine ? '1' : '0'}`);
}

export function fetchClientStock(tenantId: string, clientId: string) {
  return apiRequest<
    Array<{
      id: string;
      code: string;
      productName?: string;
      productVariety?: string;
      roomName?: string;
      boxes: number;
      status: string;
      entryAt?: string;
    }>
  >(`${operatorBase(tenantId)}/client-stock/${clientId}`);
}

export function fetchPrintables(tenantId: string, search?: string) {
  const q = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiRequest<PrintJobSummary[]>(`${operatorBase(tenantId)}/printables${q}`);
}

export function createReprintJob(
  tenantId: string,
  body: {
    sourceJobId?: string;
    documentType: string;
    payload?: Record<string, unknown>;
  }
) {
  return apiRequest<PrintJobSummary>(`${operatorBase(tenantId)}/print-jobs`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updatePrintJobStatus(
  tenantId: string,
  jobId: string,
  status: string,
  lastError?: string
) {
  return apiRequest(`${operatorBase(tenantId)}/print-jobs/${jobId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, lastError }),
  });
}

export function retryPrintJob(tenantId: string, jobId: string) {
  return apiRequest<PrintJobSummary>(`${operatorBase(tenantId)}/print-jobs/${jobId}/retry`, {
    method: 'POST',
  });
}

export function newIdempotencyKey(prefix = 'op'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
