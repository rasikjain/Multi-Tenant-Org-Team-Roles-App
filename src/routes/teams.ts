import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client";
import { teams } from "../db/schema";
import { makeError } from "../types/errors";
import { auditMiddleware, writeAudit } from "../middleware/audit";
import { CallerReq } from "../middleware/auth";
import { ensureOrgManage, ensureReadInOrg } from "../auth/rbac";
import { and, eq } from "drizzle-orm";

const router = Router({ mergeParams: true });

// POST /orgs/:orgId/teams → create team in org
router.post("/orgs/:orgId/teams", auditMiddleware("team.create", "team"), async (req: CallerReq, res) => {
  const orgId = req.params.orgId;
  try { await ensureOrgManage(req.caller); } catch { res.status(403).json(makeError("FORBIDDEN", "Missing org:manage")); return; }
  const Body = z.object({ name: z.string().min(1), slug: z.string().min(1) });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json(makeError("BAD_REQUEST", "Invalid body", parsed.error.flatten())); return; }
  const { name, slug } = parsed.data;
  const [team] = await db.insert(teams).values({ name, slug, orgId }).returning();
  await writeAudit({ orgId, actorUserId: req.caller.userId, action: "team.create", entityType: "team", entityId: team.id, ip: req.ip, userAgent: req.headers["user-agent"] as string });
  res.status(201).json(team);
  return;
});

// GET /orgs/:orgId/teams → list teams (paginated)
router.get("/orgs/:orgId/teams", async (req: CallerReq, res) => {
  const orgId = req.params.orgId;
  try { await ensureReadInOrg(req.caller); } catch { res.status(403).json(makeError("FORBIDDEN", "Read not permitted")); return; }
  const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10) || 20, 100);
  const offset = parseInt(String(req.query.offset ?? "0"), 10) || 0;
  const rows = await db.select().from(teams).where(eq(teams.orgId, orgId)).limit(limit).offset(offset);
  res.json({ items: rows, limit, offset });
  return;
});

export default router;

