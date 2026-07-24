import { AuditLogModel, type AuditAction } from '../models/AuditLog.js';
import type { PlatformAuthUser } from '../../middleware/platformAuth.js';

export interface LogAdminActionInput {
  actor: PlatformAuthUser;
  action: AuditAction;
  organizationId?: string;
  organizationName?: string;
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  details?: Record<string, unknown>;
}

export async function logAdminAction(input: LogAdminActionInput) {
  const Audit = AuditLogModel();
  await Audit.create({
    actorId: input.actor.id,
    actorEmail: input.actor.email,
    actorName: input.actor.name,
    action: input.action,
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    targetType: input.targetType,
    targetId: input.targetId,
    targetLabel: input.targetLabel,
    details: input.details,
  });
}

export async function listAuditLogs(options: {
  limit?: number;
  skip?: number;
  organizationId?: string;
}) {
  const Audit = AuditLogModel();
  const filter: Record<string, string> = {};
  if (options.organizationId) filter.organizationId = options.organizationId;

  const [logs, total] = await Promise.all([
    Audit.find(filter).sort({ createdAt: -1 }).skip(options.skip ?? 0).limit(options.limit ?? 50).lean(),
    Audit.countDocuments(filter),
  ]);

  return {
    logs: logs.map((l) => ({
      id: l._id.toString(),
      actorId: l.actorId,
      actorEmail: l.actorEmail,
      actorName: l.actorName,
      action: l.action,
      organizationId: l.organizationId,
      organizationName: l.organizationName,
      targetType: l.targetType,
      targetId: l.targetId,
      targetLabel: l.targetLabel,
      details: l.details,
      createdAt: l.createdAt,
    })),
    total,
  };
}
