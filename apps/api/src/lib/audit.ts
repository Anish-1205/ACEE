import type { Db } from '../db';

export function audit(db: Db, entry: {
  actorId: string | null; action: string; entityType: string; entityId?: string | null;
  metadata?: Record<string, unknown>; ip?: string | null;
}) {
  return db.auditLog.create({
    data: { actorId: entry.actorId, action: entry.action, entityType: entry.entityType, entityId: entry.entityId ?? null, metadata: (entry.metadata ?? {}) as object, ip: entry.ip ?? null },
  });
}
