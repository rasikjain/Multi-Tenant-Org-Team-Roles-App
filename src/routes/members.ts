import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client";
import { memberships, roleTypes, users } from "../db/schema";
import { makeError } from "../types/errors";
import { auditMiddleware, writeAudit } from "../middleware/audit";
import { CallerReq } from "../middleware/auth";
import { ensureOrgManage, ensureReadInOrg } from "../auth/rbac";
import { and, eq } from "drizzle-orm";

const router = Router({ mergeParams: true });

// POST /orgs/:orgId/members/:userId/role → change org role (idempotent)
router.post("/orgs/:orgId/members/:userId/role", auditMiddleware("org.role.change", "membership"), async (req: CallerReq, res) => {
  const orgId = req.params.orgId;
  const userId = req.params.userId;

  if (orgId !== req.caller.orgId) { res.status(403).json(makeError("FORBIDDEN", "Cross-org access denied")); return; }
  try {
    await ensureOrgManage(req.caller);
  }
  catch { res.status(403).json(makeError("FORBIDDEN", "Missing org:manage")); return; }

  const Body = z.object({ roleName: z.enum(["OrgAdmin", "TeamManager", "Member", "Auditor"]) });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json(makeError("BAD_REQUEST", "Invalid body", parsed.error.flatten())); return; }
  const { roleName } = parsed.data;
  const [role] = await db.select().from(roleTypes).where(and(eq(roleTypes.orgId, orgId), eq(roleTypes.name, roleName)));
  if (!role) { res.status(400).json(makeError("INVALID_ROLE", "Role not found in org")); return; }
  // idempotent upsert
  await db.insert(memberships).values({ orgId, userId, roleId: role.id }).onConflictDoUpdate({ target: [memberships.orgId, memberships.userId], set: { roleId: role.id } });
  await writeAudit({ orgId, actorUserId: req.caller.userId, action: "org.role.change", entityType: "membership", entityId: `${orgId}:${userId}`, ip: req.ip, userAgent: req.headers["user-agent"] as string });
  res.status(200).json({ ok: true });
  return;
});

// GET /orgs/:orgId/members → list members with roles (paginated)
router.get("/orgs/:orgId/members", async (req: CallerReq, res) => {
  const orgId = req.params.orgId;
  console.log('-------B-----')
  console.log(orgId)
  console.log(req.caller.orgId)
  console.log('-------E-----')
  if (orgId !== req.caller.orgId) { res.status(403).json(makeError("FORBIDDEN", "Cross-org access denied")); return; }
  try { await ensureReadInOrg(req.caller); } catch { res.status(403).json(makeError("FORBIDDEN", "Read not permitted")); return; }
  const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10) || 20, 100);
  const offset = parseInt(String(req.query.offset ?? "0"), 10) || 0;
  const rows = await db.select({ user: users, role: roleTypes, membership: memberships })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .innerJoin(roleTypes, eq(roleTypes.id, memberships.roleId))
    .where(eq(memberships.orgId, orgId))
    .limit(limit)
    .offset(offset);
  res.json({ items: rows, limit, offset });
  return;
});

export default router;

