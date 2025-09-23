import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client";
import { organizations, users, roleTypes, memberships } from "../db/schema";
import { makeError } from "../types/errors";
import { auditMiddleware, writeAudit } from "../middleware/audit";
import { CallerReq } from "../middleware/auth";
import { and, eq } from "drizzle-orm";
import { handleUniqueViolation } from "../utils/dbErrors";

const router = Router();

// POST /orgs → create org (first creator becomes OrgAdmin)
router.post("/orgs", auditMiddleware("org.create", "organization"), async (req: CallerReq, res) => {
  const Body = z.object({ name: z.string().min(1), slug: z.string().min(1), creatorEmail: z.string().email(), creatorName: z.string().optional() });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json(makeError("BAD_REQUEST", "Invalid body", parsed.error.flatten())); return; }
  const { name, slug, creatorEmail, creatorName } = parsed.data;
  let org;
  try {
    [org] = await db.insert(organizations).values({ name, slug }).returning();
  } catch (e) {
    if (handleUniqueViolation(res, e, "Organization slug already exists")) { return; }
    throw e;
  }
  let [creator] = await db.select().from(users).where(eq(users.email, creatorEmail));
  if (!creator) {
    [creator] = await db.insert(users).values({ email: creatorEmail, name: creatorName ?? null }).returning();
  }
  // Ensure OrgAdmin role exists (global or org-scoped). Create org-scoped if not
  let [adminRole] = await db.select().from(roleTypes).where(and(eq(roleTypes.name, "OrgAdmin"), eq(roleTypes.orgId, org.id)));
  if (!adminRole) {
    [adminRole] = await db.insert(roleTypes).values({ orgId: org.id, name: "OrgAdmin", canOrgManage: true, canTeamManage: true, canTeamWrite: true, canReadAll: true }).returning();
  }
  await db.insert(memberships).values({ orgId: org.id, userId: creator.id, roleId: adminRole.id }).onConflictDoNothing();
  await writeAudit({ orgId: org.id, actorUserId: creator.id, action: "org.create", entityType: "organization", entityId: org.id, ip: req.ip, userAgent: req.headers["user-agent"] as string });
  res.status(201).json(org);
  return;
});

export default router;

