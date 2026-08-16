export class Timestamp {
  readonly seconds: number;
  readonly nanoseconds: number;

  constructor(seconds: number, nanoseconds = 0) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }

  toDate(): Date {
    return new Date(this.seconds * 1000);
  }

  toMillis(): number {
    return this.seconds * 1000 + Math.floor(this.nanoseconds / 1_000_000);
  }

  static fromDate(date: Date): Timestamp {
    return new Timestamp(Math.floor(date.getTime() / 1000), 0);
  }

  static now(): Timestamp {
    return Timestamp.fromDate(new Date());
  }

  static fromJSON(obj: { seconds?: number; _seconds?: number; nanoseconds?: number }): Timestamp {
    const seconds = obj.seconds ?? obj._seconds ?? 0;
    return new Timestamp(seconds, obj.nanoseconds ?? 0);
  }
}

export function serverTimestamp() {
  return { __serverTimestamp: true };
}

export type Unsubscribe = () => void;

export type QueryConstraint =
  | { type: 'where'; field: string; op: string; value: unknown }
  | { type: 'orderBy'; field: string; direction: 'asc' | 'desc' }
  | { type: 'limit'; count: number };

export interface CollectionRef {
  path: string[];
}

export interface DocumentRef {
  path: string[];
  id: string;
}

export interface QueryRef {
  ref: CollectionRef;
  constraints: QueryConstraint[];
}

export interface DocSnapshot {
  id: string;
  exists: () => boolean;
  data: () => Record<string, unknown> | undefined;
  ref: DocumentRef;
}

export interface QuerySnapshot {
  docs: DocSnapshot[];
  empty: boolean;
  size: number;
  forEach: (cb: (doc: DocSnapshot) => void) => void;
}

import { apiRequest } from './api/client';

export const db = {};

type WhereOp = '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'array-contains';

function normalizePath(segments: string[]): string[] {
  return segments.flatMap((seg) => seg.split('/').filter(Boolean));
}

function normalizeValue(value: unknown): unknown {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (value && typeof value === 'object' && value !== null) {
    if ('__serverTimestamp' in value) {
      return new Date().toISOString();
    }
    if (Array.isArray(value)) {
      return value.map(normalizeValue);
    }
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = normalizeValue(v);
    }
    return result;
  }
  return value;
}

function denormalizeValue(value: unknown): unknown {
  if (!value) return value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return Timestamp.fromDate(new Date(value));
  }
  if (Array.isArray(value)) return value.map(denormalizeValue);
  if (typeof value === 'object' && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = denormalizeValue(v);
    }
    return result;
  }
  return value;
}

function omitId(data: Record<string, unknown>): Record<string, unknown> {
  const { id: _id, ...rest } = data;
  return rest;
}

function createDocSnapshot(data: Record<string, unknown> | null, path: string[]): DocSnapshot {
  const id = data?.id != null && data.id !== '' ? String(data.id) : path[path.length - 1];
  // Omit id entirely — do not set `id: undefined`, or spreads like
  // `{ id: doc.id, ...doc.data() }` overwrite every document with the same id.
  const docData = data ? denormalizeValue(omitId(data)) as Record<string, unknown> : undefined;

  return {
    id,
    exists: () => data !== null,
    data: () => docData,
    ref: { path, id },
  };
}

function createQuerySnapshot(items: Record<string, unknown>[], path: string[]): QuerySnapshot {
  const docs = items.map((item) =>
    createDocSnapshot(item, [...path, String(item.id)])
  );

  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (cb) => docs.forEach(cb),
  };
}

export function collection(_db: unknown, ...pathSegments: string[]): CollectionRef {
  const path = normalizePath(pathSegments);
  return { path };
}

export function doc(_db: unknown, ...pathSegments: string[]): DocumentRef {
  const path = normalizePath(pathSegments);
  return { path, id: path[path.length - 1] };
}

export function query(ref: CollectionRef, ...constraints: QueryConstraint[]): QueryRef {
  return { ref, constraints };
}

export function where(field: string, op: string, value: unknown): QueryConstraint {
  return { type: 'where', field, op, value };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): QueryConstraint {
  return { type: 'orderBy', field, direction };
}

export function limit(count: number): QueryConstraint {
  return { type: 'limit', count };
}

export async function getDocs(q: QueryRef): Promise<QuerySnapshot> {
  const whereClauses = q.constraints
    .filter((c): c is Extract<QueryConstraint, { type: 'where' }> => c.type === 'where')
    .map((c) => ({ field: c.field, op: c.op as WhereOp, value: c.value }));

  const orderClauses = q.constraints
    .filter((c): c is Extract<QueryConstraint, { type: 'orderBy' }> => c.type === 'orderBy')
    .map((c) => ({ field: c.field, direction: c.direction }));

  const limitClause = q.constraints.find((c): c is Extract<QueryConstraint, { type: 'limit' }> => c.type === 'limit');

  let seasonId: string | undefined;
  try {
    seasonId = sessionStorage.getItem('frigosmart.selectedSeasonId') || undefined;
  } catch {
    seasonId = undefined;
  }

  const data = await apiRequest<Record<string, unknown>[]>('/data/query', {
    method: 'POST',
    body: JSON.stringify({
      path: q.ref.path,
      where: whereClauses,
      orderBy: orderClauses,
      limit: limitClause?.count,
      ...(seasonId ? { seasonId } : {}),
    }),
  });

  return createQuerySnapshot(data, q.ref.path);
}

export async function getDoc(ref: DocumentRef): Promise<DocSnapshot> {
  try {
    const data = await apiRequest<Record<string, unknown> | null>(`/data/${ref.path.join('/')}`);
    if (!data) return createDocSnapshot(null, ref.path);
    return createDocSnapshot(data, ref.path);
  } catch {
    return createDocSnapshot(null, ref.path);
  }
}

export async function addDoc(ref: CollectionRef, data: Record<string, unknown>) {
  const payload = normalizeValue(data) as Record<string, unknown>;
  const created = await apiRequest<Record<string, unknown>>(`/data/${ref.path.join('/')}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return doc(db, ...ref.path, String(created.id));
}

export async function updateDoc(ref: DocumentRef, data: Record<string, unknown>) {
  const payload = normalizeValue(data) as Record<string, unknown>;
  await apiRequest(`/data/${ref.path.join('/')}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function setDoc(ref: DocumentRef, data: Record<string, unknown>, options?: { merge?: boolean }) {
  const payload = normalizeValue(data) as Record<string, unknown>;
  const merge = options?.merge !== false;
  await apiRequest(`/data/${ref.path.join('/')}?merge=${merge}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteDoc(ref: DocumentRef) {
  await apiRequest(`/data/${ref.path.join('/')}`, { method: 'DELETE' });
}

export function onSnapshot(
  ref: QueryRef | DocumentRef,
  onNext: (snapshot: QuerySnapshot | DocSnapshot) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  let active = true;
  let interval: ReturnType<typeof setInterval> | undefined;

  const fetchData = async () => {
    try {
      if ('constraints' in ref) {
        const snap = await getDocs(ref);
        if (active) onNext(snap);
      } else {
        const snap = await getDoc(ref);
        if (active) onNext(snap);
      }
    } catch (err) {
      if (active && onError) onError(err as Error);
    }
  };

  fetchData();
  interval = setInterval(fetchData, 15000);

  return () => {
    active = false;
    if (interval) clearInterval(interval);
  };
}
