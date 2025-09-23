import type { Request, Response, NextFunction } from "express";
import { db } from "../db/client";
import { auditEvents } from "../db/schema";

export async function writeAudit(opts: {
  orgId?: string | null;
  actorUserId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: string | null;
}) {
  await db.insert(auditEvents).values({
    orgId: opts.orgId ?? null,
    actorUserId: opts.actorUserId ?? null,
    action: opts.action,
    entityType: opts.entityType ?? null,
    entityId: opts.entityId ?? null,
    ip: opts.ip ?? null,
    userAgent: opts.userAgent ?? null,
    metadata: opts.metadata ?? null,
  });
}

export function auditMiddleware(action: string, entityType?: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    (req as any)._audit = { action, entityType };
    next();
  };
}

