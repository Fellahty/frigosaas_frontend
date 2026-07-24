export interface ParsedPath {
  kind: 'collection' | 'document' | 'settings';
  collection: string;
  tenantId?: string;
  docId?: string;
  settingsKey?: string;
}

const DOC_BY_TENANT_COLLECTIONS = new Set([
  'counters',
  'metrics_today',
  'tenant_settings',
  'stock_settings',
]);

export function parsePath(segments: string[]): ParsedPath {
  if (segments.length === 0) {
    throw new Error('Empty path');
  }

  if (segments[0] === 'tenants') {
    const tenantId = segments[1];
    if (!tenantId) throw new Error('Missing tenantId');

    if (segments[2] === 'settings') {
      return {
        kind: 'settings',
        collection: 'tenant_settings_docs',
        tenantId,
        settingsKey: segments[3],
        docId: segments[3],
      };
    }

    if (segments.length === 2) {
      return { kind: 'document', collection: 'tenants', tenantId, docId: tenantId };
    }

    if (segments.length === 3) {
      return { kind: 'collection', collection: segments[2], tenantId };
    }

    if (segments.length === 4) {
      return {
        kind: 'document',
        collection: segments[2],
        tenantId,
        docId: segments[3],
      };
    }
  }

  if (segments.length === 2 && DOC_BY_TENANT_COLLECTIONS.has(segments[0])) {
    return {
      kind: 'document',
      collection: segments[0],
      tenantId: segments[1],
      docId: segments[1],
    };
  }

  if (segments.length === 1) {
    return { kind: 'collection', collection: segments[0] };
  }

  if (segments.length === 2) {
    return { kind: 'document', collection: segments[0], docId: segments[1] };
  }

  throw new Error(`Unsupported path: ${segments.join('/')}`);
}

export function mongoCollectionName(parsed: ParsedPath): string {
  if (parsed.kind === 'settings') {
    return 'tenant_settings_docs';
  }
  return parsed.collection;
}
