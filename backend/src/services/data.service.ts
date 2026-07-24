import mongoose, { Schema } from 'mongoose';
import { parsePath, mongoCollectionName, ParsedPath } from './pathParser.js';
import { getActiveConnection } from '../middleware/tenantContext.js';

export interface WhereClause {
  field: string;
  op: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'array-contains';
  value: unknown;
}

export interface OrderClause {
  field: string;
  direction: 'asc' | 'desc';
}

const schemaCache = new Map<string, Schema>();
const modelCache = new Map<string, mongoose.Model<Record<string, unknown>>>();

function getFlexibleModel(collectionName: string): mongoose.Model<Record<string, unknown>> {
  const conn = getActiveConnection();
  const cacheKey = `${conn.name}:${collectionName}`;

  if (modelCache.has(cacheKey)) {
    return modelCache.get(cacheKey)!;
  }

  if (!schemaCache.has(collectionName)) {
    schemaCache.set(
      collectionName,
      new Schema({}, { strict: false, timestamps: true, id: true })
    );
  }

  const modelName = `flex_${conn.name}_${collectionName}`;
  const model =
    conn.models[modelName] ||
    conn.model(modelName, schemaCache.get(collectionName)!, collectionName);

  modelCache.set(cacheKey, model);
  return model;
}

function buildFilter(parsed: ParsedPath, where: WhereClause[] = []): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (parsed.tenantId && parsed.kind !== 'document') {
    filter.tenantId = parsed.tenantId;
  }

  if (parsed.kind === 'settings' && parsed.settingsKey) {
    filter.tenantId = parsed.tenantId;
    filter.settingsKey = parsed.settingsKey;
  }

  for (const clause of where) {
    switch (clause.op) {
      case '==':
        filter[clause.field] = clause.value;
        break;
      case '!=':
        filter[clause.field] = { $ne: clause.value };
        break;
      case '<':
        filter[clause.field] = { $lt: clause.value };
        break;
      case '<=':
        filter[clause.field] = { $lte: clause.value };
        break;
      case '>':
        filter[clause.field] = { $gt: clause.value };
        break;
      case '>=':
        filter[clause.field] = { $gte: clause.value };
        break;
      case 'in':
        filter[clause.field] = { $in: clause.value };
        break;
      case 'array-contains':
        filter[clause.field] = clause.value;
        break;
    }
  }

  return filter;
}

function serializeDoc(doc: { _id: unknown; toObject: () => Record<string, unknown> }) {
  const obj = doc.toObject();
  const id = obj.firebaseId ? String(obj.firebaseId) : String(obj._id);
  return {
    ...obj,
    id,
    _id: undefined,
    __v: undefined,
  };
}

function toMongoDateFields(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...data };
  for (const [key, value] of Object.entries(result)) {
    if (value && typeof value === 'object' && value !== null) {
      if ('_seconds' in value || 'seconds' in value) {
        const seconds = (value as { _seconds?: number; seconds?: number })._seconds ??
          (value as { seconds?: number }).seconds ?? 0;
        result[key] = new Date(seconds * 1000);
      } else if ('type' in value && (value as { type: string }).type === 'timestamp') {
        const seconds = (value as { seconds?: number }).seconds ?? 0;
        result[key] = new Date(seconds * 1000);
      }
    }
  }
  return result;
}

async function findDocument(parsed: ParsedPath, docId: string) {
  const Model = getFlexibleModel(mongoCollectionName(parsed));

  if (parsed.kind === 'settings') {
    return Model.findOne({ tenantId: parsed.tenantId, settingsKey: parsed.settingsKey });
  }

  if (DOC_BY_TENANT_ID(parsed)) {
    return Model.findOne({ tenantId: parsed.tenantId });
  }

  if (mongoose.Types.ObjectId.isValid(docId)) {
    const byId = await Model.findById(docId);
    if (byId) return byId;
  }

  return Model.findOne({
    $or: [{ _id: docId }, { firebaseId: docId }],
    ...(parsed.tenantId ? { tenantId: parsed.tenantId } : {}),
  });
}

function DOC_BY_TENANT_ID(parsed: ParsedPath): boolean {
  return (
    parsed.kind === 'document' &&
    ['counters', 'metrics_today', 'tenant_settings', 'stock_settings'].includes(parsed.collection)
  );
}

export async function queryCollection(
  path: string[],
  where: WhereClause[] = [],
  orderBy: OrderClause[] = [],
  limit?: number
) {
  const parsed = parsePath(path);
  const Model = getFlexibleModel(mongoCollectionName(parsed));
  const filter = buildFilter(parsed, where);

  let query = Model.find(filter);

  for (const order of orderBy) {
    query = query.sort({ [order.field]: order.direction === 'desc' ? -1 : 1 });
  }

  if (limit) {
    query = query.limit(limit);
  }

  const docs = await query.exec();
  return docs.map(serializeDoc);
}

export async function getDocument(path: string[]) {
  const parsed = parsePath(path);
  const docId = parsed.docId || path[path.length - 1];
  const doc = await findDocument(parsed, docId);

  if (!doc) return null;
  return serializeDoc(doc);
}

export async function createDocument(path: string[], data: Record<string, unknown>) {
  const parsed = parsePath(path);
  const Model = getFlexibleModel(mongoCollectionName(parsed));
  const payload = toMongoDateFields({
    ...data,
    ...(parsed.tenantId ? { tenantId: parsed.tenantId } : {}),
    ...(parsed.kind === 'settings'
      ? { settingsKey: parsed.settingsKey, tenantId: parsed.tenantId }
      : {}),
  });

  const doc = await Model.create(payload);
  return serializeDoc(doc);
}

export async function updateDocument(path: string[], data: Record<string, unknown>) {
  const parsed = parsePath(path);
  const docId = parsed.docId || path[path.length - 1];
  const Model = getFlexibleModel(mongoCollectionName(parsed));
  const payload = toMongoDateFields(data);

  let doc;
  if (parsed.kind === 'settings') {
    doc = await Model.findOneAndUpdate(
      { tenantId: parsed.tenantId, settingsKey: parsed.settingsKey },
      { $set: { ...payload, tenantId: parsed.tenantId, settingsKey: parsed.settingsKey } },
      { new: true, upsert: true }
    );
  } else if (DOC_BY_TENANT_ID(parsed)) {
    doc = await Model.findOneAndUpdate(
      { tenantId: parsed.tenantId },
      { $set: { ...payload, tenantId: parsed.tenantId } },
      { new: true, upsert: true }
    );
  } else {
    const filter = mongoose.Types.ObjectId.isValid(docId)
      ? { _id: docId }
      : { $or: [{ _id: docId }, { firebaseId: docId }] };

    doc = await Model.findOneAndUpdate(
      parsed.tenantId ? { ...filter, tenantId: parsed.tenantId } : filter,
      { $set: payload },
      { new: true }
    );
  }

  if (!doc) return null;
  return serializeDoc(doc);
}

export async function setDocument(path: string[], data: Record<string, unknown>, merge = true) {
  const parsed = parsePath(path);
  const Model = getFlexibleModel(mongoCollectionName(parsed));
  const payload = toMongoDateFields({
    ...data,
    ...(parsed.tenantId ? { tenantId: parsed.tenantId } : {}),
    ...(parsed.kind === 'settings'
      ? { settingsKey: parsed.settingsKey, tenantId: parsed.tenantId }
      : {}),
  });

  let doc;
  if (parsed.kind === 'settings') {
    doc = await Model.findOneAndUpdate(
      { tenantId: parsed.tenantId, settingsKey: parsed.settingsKey },
      merge ? { $set: payload } : payload,
      { new: true, upsert: true }
    );
  } else if (DOC_BY_TENANT_ID(parsed)) {
    doc = await Model.findOneAndUpdate(
      { tenantId: parsed.tenantId },
      merge ? { $set: payload } : payload,
      { new: true, upsert: true }
    );
  } else {
    const docId = parsed.docId!;
    const filter = mongoose.Types.ObjectId.isValid(docId)
      ? { _id: docId }
      : { $or: [{ _id: docId }, { firebaseId: docId }] };

    doc = await Model.findOneAndUpdate(
      parsed.tenantId ? { ...filter, tenantId: parsed.tenantId } : filter,
      merge ? { $set: payload } : payload,
      { new: true, upsert: true }
    );
  }

  return doc ? serializeDoc(doc) : null;
}

export async function deleteDocument(path: string[]) {
  const parsed = parsePath(path);
  const docId = parsed.docId || path[path.length - 1];
  const Model = getFlexibleModel(mongoCollectionName(parsed));

  if (parsed.kind === 'settings') {
    await Model.deleteOne({ tenantId: parsed.tenantId, settingsKey: parsed.settingsKey });
    return true;
  }

  if (DOC_BY_TENANT_ID(parsed)) {
    await Model.deleteOne({ tenantId: parsed.tenantId });
    return true;
  }

  const filter = mongoose.Types.ObjectId.isValid(docId)
    ? { _id: docId }
    : { $or: [{ _id: docId }, { firebaseId: docId }] };

  await Model.deleteOne(parsed.tenantId ? { ...filter, tenantId: parsed.tenantId } : filter);
  return true;
}
