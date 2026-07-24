import { AsyncLocalStorage } from 'node:async_hooks';
import type mongoose from 'mongoose';
import mongooseDefault from 'mongoose';

export interface TenantContext {
  connection: mongoose.Connection;
  dbName: string;
  legacyId: string;
  organizationId: string;
}

const storage = new AsyncLocalStorage<TenantContext>();

export function runWithTenantContext<T>(ctx: TenantContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export async function runWithTenantContextAsync<T>(
  ctx: TenantContext,
  fn: () => Promise<T>
): Promise<T> {
  return storage.run(ctx, fn);
}

export function getTenantContext(): TenantContext | undefined {
  return storage.getStore();
}

export function getActiveConnection(): mongoose.Connection {
  const ctx = storage.getStore();
  if (ctx?.connection?.readyState === 1) {
    return ctx.connection;
  }
  // Fallback: default mongoose connection (legacy single-tenant)
  return mongooseDefault.connection;
}
