import type { Request, Response, NextFunction } from "express";
import { makeError } from "../types/errors";
import { db } from "../db/client";
import { memberships } from "../db/schema";
import { and, eq } from "drizzle-orm";

// Demo header-based auth. In real apps use JWT.
// Expect header: x-user-id
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const userId = req.header("x-user-id");
  if (!userId) {
    res.status(401).json(makeError("UNAUTHENTICATED", "Missing x-user-id header"));
    return;
  }
  (req as any).caller = { userId };
  next();
}

export type CallerReq = Request & { caller: { userId: string; orgId?: string } };

// For routes with :orgId, validate membership and set caller.orgId
export async function orgScopeFromParam(req: Request, res: Response, next: NextFunction) {
  const caller = (req as any).caller as { userId?: string } | undefined;

  if (!caller?.userId) { res.status(401).json(makeError("UNAUTHENTICATED", "Missing caller")); return; }

  const rows = await db.select().from(memberships).where(eq(memberships.userId, caller.userId));
  if (rows.length === 0) { res.status(403).json(makeError("FORBIDDEN", "Not a member of this organization")); return; }
  
  const orgId = rows[0].orgId as string | undefined;
  
  if (!orgId) { res.status(403).json(makeError("FORBIDDEN", "Unable to resolve organization for user")); return; }
  
  (req as any).caller.orgId = orgId;
  next();
}

// Ensure :orgId in the route matches the resolved caller.orgId
export function requireOrgParamMatch(req: Request, res: Response, next: NextFunction) {
  const paramOrgId = (req.params as any).orgId as string | undefined;
  const caller = (req as any).caller as { orgId?: string } | undefined;
  if (!paramOrgId) { next(); return; }
  if (!caller?.orgId) { res.status(403).json(makeError("FORBIDDEN", "Organization not resolved for caller")); return; }
  if (paramOrgId !== caller.orgId) { res.status(403).json(makeError("FORBIDDEN", "Cross-org access denied")); return; }
  next();
}

