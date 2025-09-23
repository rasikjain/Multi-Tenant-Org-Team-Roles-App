import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client";
import { invites, memberships, roleTypes, teamMemberships, users } from "../db/schema";
import { makeError } from "../types/errors";
import { auditMiddleware, writeAudit } from "../middleware/audit";
import { CallerReq } from "../middleware/auth";
import { ensureOrgManage } from "../auth/rbac";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { handleUniqueViolation } from "../utils/dbErrors";

const router = Router({ mergeParams: true });

// POST /orgs/:orgId/invites → invite by email, role, optional team
router.post("/orgs/:orgId/invites", auditMiddleware("invite.create", "invite"), async (req: CallerReq, res) => {
  const orgId = req.params.orgId;

  try { await ensureOrgManage(req.caller); } catch { res.status(403).json(makeError("FORBIDDEN", "Missing org:manage")); return; }
  const Body = z.object({ email: z.string().email(), roleName: z.enum(["OrgAdmin", "TeamManager", "Member", "Auditor"]), teamId: z.string().uuid().optional(), expiresInHours: z.number().int().min(1).max(720).default(72) });
  const parsed = Body.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json(makeError("BAD_REQUEST", "Invalid body", parsed.error.flatten())); return;
  }

  const { email, roleName, teamId, expiresInHours } = parsed.data;
  const [role] = await db.select().from(roleTypes).where(and(eq(roleTypes.orgId, orgId), eq(roleTypes.name, roleName)));

  if (!role) {
    res.status(400).json(makeError("INVALID_ROLE", "Role not found in org")); return;
  }

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
  let invite;

  try {
    [invite] = await db.insert(invites).values({ orgId, teamId: teamId ?? null, email, token, roleId: role.id, expiresAt }).returning();
  } catch (e) {
    if (handleUniqueViolation(res, e, "An invite already exists for this email/team")) { return; }
    throw e;
  }

  await writeAudit({ orgId, actorUserId: req.caller.userId, action: "invite.create", entityType: "invite", entityId: invite?.id ?? null, ip: req.ip, userAgent: req.headers["user-agent"] as string });
  res.status(201).json(invite ?? { ok: true });
  return;
});

// POST /invites/:token/accept → accept invite → create membership(s)
router.post("/invites/:token/accept", auditMiddleware("invite.accept", "invite"), async (req: CallerReq, res) => {
  const token = req.params.token;
  const [inv] = await db.select().from(invites).where(eq(invites.token, token));

  if (!inv) {
    res.status(404).json(makeError("NOT_FOUND", "Invite not found")); return;
  }
  if (inv.acceptedAt) {
    res.status(200).json({ ok: true }); return;
  }
  if (new Date(inv.expiresAt) < new Date()) {
    res.status(400).json(makeError("EXPIRED", "Invite expired")); return;
  }

  // Ensure a user exists for the invited email; create if missing
  let [user] = await db.select().from(users).where(eq(users.email, inv.email));
  if (!user) {
    try {
      [user] = await db.insert(users).values({ email: inv.email }).returning();
    } catch (e) {
      if (handleUniqueViolation(res, e, "A user already exists with this email")) { return; }
      throw e;
    }
  }

  // idempotent org membership for the created/found user
  await db.insert(memberships).values({ orgId: inv.orgId, userId: user.id, roleId: inv.roleId }).onConflictDoUpdate({ target: [memberships.orgId, memberships.userId], set: { roleId: inv.roleId } });
  // optional team membership
  if (inv.teamId) {
    await db.insert(teamMemberships).values({ orgId: inv.orgId, teamId: inv.teamId, userId: user.id, roleId: inv.roleId }).onConflictDoNothing();
  }
  await db.update(invites).set({ acceptedAt: new Date() }).where(eq(invites.id, inv.id));
  await writeAudit({ orgId: inv.orgId, actorUserId: user.id, action: "invite.accept", entityType: "invite", entityId: inv.id, ip: req.ip, userAgent: req.headers["user-agent"] as string });
  
  res.status(200).json({ ok: true });
  return;
});

export default router;

